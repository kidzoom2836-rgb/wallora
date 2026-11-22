import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { getStorage, getAdapterType } from "@/lib/storage";
import {
  PresignSchema,
  buildUploadKey,
  extensionForMime,
  MAX_UPLOAD_BYTES,
  MAX_VARIATIONS,
  type PresignInput,
} from "@/lib/upload-helpers";

/**
 * POST /api/v1/uploads/presign
 *
 * Validates file metadata, generates storage keys, and returns presigned
 * upload URLs + credentials. The client then uploads each file directly to
 * the returned URL (R2) or to /api/v1/uploads/receive (local/DB/Blob).
 *
 * One request may presign 1-3 sources for a single wallpaper post (`sources`),
 * sharing a `groupId`. The original single-file shape is still accepted and
 * the first upload is also returned in the top-level fields for backwards
 * compatibility.
 *
 * Auth required.
 */

type FileMeta = NonNullable<PresignInput["sources"]>[number];

type PresignedUpload = {
  index: number;
  key: string;
  uploadId: string;
  uploadUrl: string;
  method: "POST";
  fields: Record<string, string>;
  headers: Record<string, string>;
  adapterType: string;
  maxBytes: number;
};

function normalizeSources(parsed: PresignInput): FileMeta[] {
  if (parsed.sources?.length) return parsed.sources;
  return [
    {
      filename: parsed.filename!,
      contentType: parsed.contentType!,
      size: parsed.size!,
    },
  ];
}

export async function POST(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }

  const sources = normalizeSources(parsed.data);
  const groupId = parsed.data.groupId ?? crypto.randomUUID();
  const storage = getStorage();

  const uploads: PresignedUpload[] = [];
  for (const [index, source] of sources.entries()) {
    const ext = extensionForMime(source.contentType);
    const uploadId = crypto.randomUUID();
    const key = buildUploadKey(userId, uploadId, ext);

    const presign = await storage.presignUpload({
      key,
      contentType: source.contentType,
      maxBytes: MAX_UPLOAD_BYTES,
    });

    uploads.push({
      index,
      key,
      uploadId,
      uploadUrl: presign.uploadUrl,
      method: presign.method,
      fields: presign.fields,
      headers: presign.headers,
      adapterType: presign.adapterType,
      maxBytes: MAX_UPLOAD_BYTES,
    });
  }

  const first = uploads[0];

  // Record the pending upload batch for audit + completion. Single-file
  // requests keep the same targetId semantics (the upload id).
  await db.auditLog.create({
    data: {
      actorId: userId,
      action: "upload.presign",
      targetType: "upload",
      targetId: sources.length === 1 ? first.uploadId : groupId,
      metadata: JSON.stringify({
        groupId,
        count: uploads.length,
        sources: uploads.map((upload, index) => ({
          filename: sources[index].filename,
          contentType: sources[index].contentType,
          size: sources[index].size,
          key: upload.key,
          uploadId: upload.uploadId,
        })),
      }),
    },
  });

  return NextResponse.json({
    data: {
      // Legacy single-file response fields — always the first source.
      key: first.key,
      uploadId: first.uploadId,
      uploadUrl: first.uploadUrl,
      method: first.method,
      fields: first.fields,
      headers: first.headers,
      adapterType: first.adapterType,
      maxBytes: first.maxBytes,
      // Multi-variation additions.
      groupId,
      count: uploads.length,
      maxVariations: MAX_VARIATIONS,
      uploads,
    },
  });
}

/** GET returns the current adapter type + limits (for the client UI). */
export async function GET() {
  return NextResponse.json({
    data: {
      adapterType: getAdapterType(),
      maxBytes: MAX_UPLOAD_BYTES,
      maxVariations: MAX_VARIATIONS,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  });
}
