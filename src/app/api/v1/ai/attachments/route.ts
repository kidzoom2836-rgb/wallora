import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import {
  AI_ATTACHMENT_MAX_BYTES,
  AI_ATTACHMENT_MAX_COUNT,
  attachmentKindFor,
  saveAttachmentMeta,
  saveMessageAttachments,
  type AiAttachment,
} from "@/lib/ai/attachments";

/**
 * POST /api/v1/ai/attachments  (multipart/form-data, field: "files")
 *
 * Uploads photos and documents for Aurora to work with. Files go through the
 * configured storage adapter and metadata is tracked in StoredBlob JSON, so
 * no Prisma migration is needed. Up to four files, 10 MB each.
 *
 * Returns attachment descriptors. Pass their ids to the chat message endpoint
 * as `attachmentIds` so Aurora reads them as context.
 */
export async function POST(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Expected multipart/form-data." } },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((v): v is File => typeof v !== "string" && typeof v.arrayBuffer === "function")
    .slice(0, AI_ATTACHMENT_MAX_COUNT);

  if (files.length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Choose at least one file." } },
      { status: 400 },
    );
  }

  const storage = getStorage();
  const saved: AiAttachment[] = [];

  for (const file of files) {
    const kind = attachmentKindFor(file.type, file.name);
    if (!kind) {
      return NextResponse.json(
        {
          error: {
            code: "unsupported_type",
            message: `"${file.name}" is not supported. Use images, PDF, TXT, MD, CSV or JSON files.`,
          },
        },
        { status: 415 },
      );
    }
    if (file.size < 1 || file.size > AI_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "file_too_large",
            message: `"${file.name}" must be under 10 MB.`,
          },
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.toLowerCase().split(".").pop() ?? "bin").replace(/[^a-z0-9]/g, "").slice(0, 5);
    const id = crypto.randomUUID();
    const key = `ai-attachments/${userId}/${id}.${ext}`;

    await storage.putObject(key, buffer, file.type || "application/octet-stream");

    const attachment: AiAttachment = {
      id,
      userId,
      name: file.name.slice(0, 180),
      contentType: file.type || "application/octet-stream",
      size: file.size,
      kind,
      key,
      url: storage.getPublicUrl(key),
      createdAt: new Date().toISOString(),
    };

    await saveAttachmentMeta(attachment);
    saved.push(attachment);
  }

  // Keep an audit record without logging file contents.
  await db.auditLog.create({
    data: {
      actorId: userId,
      action: "ai.attachment.upload",
      targetType: "ai_attachment",
      targetId: saved[0].id,
      metadata: JSON.stringify({
        count: saved.length,
        files: saved.map((a) => ({ name: a.name, kind: a.kind, size: a.size })),
      }),
    },
  });

  return NextResponse.json({
    data: saved.map((a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      size: a.size,
      kind: a.kind,
      url: a.url,
    })),
  });
}

/** GET describes the supported attachment limits for the client UI. */
export async function GET() {
  return NextResponse.json({
    data: {
      maxBytes: AI_ATTACHMENT_MAX_BYTES,
      maxFiles: AI_ATTACHMENT_MAX_COUNT,
      accepts: ["images", "pdf", "txt", "md", "csv", "json"],
    },
  });
}

// Re-exported so the message route can persist message-level attachment
// references through the same JSON helper without duplicating keys.
export { saveMessageAttachments };
