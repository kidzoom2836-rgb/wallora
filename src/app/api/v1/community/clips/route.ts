import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

import { requireVerification } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Short preview clips posted with WALLORA TV recommendations. */
const MAX_CLIP_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

/** POST /api/v1/community/clips — upload a short channel preview video. */
export async function POST(request: NextRequest) {
  const auth = await requireVerification("free");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid multipart upload." } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Choose a video to upload." } },
      { status: 400 },
    );
  }
  if (file.size > MAX_CLIP_BYTES) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Preview clips must be under 12 MB." } },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Use an MP4, WebM or MOV video." } },
      { status: 400 },
    );
  }

  const storage = getStorage();
  const ext = EXTENSIONS[file.type] ?? "mp4";
  const key = `clips/${auth.session.user.id}/${crypto.randomUUID()}.${ext}`;
  const stored = await storage.putObject(key, Buffer.from(await file.arrayBuffer()), file.type);

  await db.auditLog.create({
    data: {
      actorId: auth.session.user.id,
      action: "community.clip.upload",
      targetType: "upload",
      targetId: key,
      metadata: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type }),
    },
  });

  return NextResponse.json(
    {
      data: {
        key: stored.key,
        videoUrl: storage.getPublicUrl(stored.key),
        contentType: stored.contentType,
        size: stored.size,
      },
    },
    { status: 201 },
  );
}
