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
} from "@/lib/upload-helpers";

/**
 * POST /api/v1/uploads/presign
 *
 * Validates file metadata, generates a storage key, and returns a presigned
 * upload URL + credentials. The client then uploads the file directly to
 * the returned URL (R2) or to /api/v1/uploads/receive (local).
 *
 * Auth required.
 */
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

  const { filename, contentType, size } = parsed.data;
  const ext = extensionForMime(contentType);
  const uploadId = crypto.randomUUID();
  const key = buildUploadKey(userId, uploadId, ext);

  const storage = getStorage();
  const presign = await storage.presignUpload({
    key,
    contentType,
    maxBytes: MAX_UPLOAD_BYTES,
  });

  // Record the pending upload for audit + completion
  await db.auditLog.create({
    data: {
      actorId: userId,
      action: "upload.presign",
      targetType: "upload",
      targetId: uploadId,
      metadata: JSON.stringify({ filename, contentType, size, key }),
    },
  });

  return NextResponse.json({
    data: {
      key,
      uploadId,
      uploadUrl: presign.uploadUrl,
      method: presign.method,
      fields: presign.fields,
      headers: presign.headers,
      adapterType: presign.adapterType,
      maxBytes: MAX_UPLOAD_BYTES,
    },
  });
}

/** GET returns the current adapter type + limits (for the client UI). */
export async function GET() {
  return NextResponse.json({
    data: {
      adapterType: getAdapterType(),
      maxBytes: MAX_UPLOAD_BYTES,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  });
}
