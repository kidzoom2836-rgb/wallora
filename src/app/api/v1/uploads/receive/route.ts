import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";

/**
 * POST /api/v1/uploads/receive
 *
 * Local-storage adapter only: receives the uploaded file via multipart
 * POST and writes it to the local filesystem. For the R2 adapter, the
 * client uploads directly to R2 using the presigned URL — this endpoint
 * is not called.
 *
 * Auth required. The key must belong to the authenticated user.
 */
export async function POST(request: NextRequest) {
  const result = await requireUser();
  if (!result.ok) return result.response;

  const userId = result.session.user.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Expected multipart form data." } },
      { status: 400 },
    );
  }

  const key = formData.get("key") as string | null;
  const file = formData.get("file") as File | null;

  if (!key || !file) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Missing 'key' or 'file' field." } },
      { status: 400 },
    );
  }

  // Verify the key belongs to this user (prevents cross-user writes)
  const expectedPrefix = `w/${userId}/`;
  if (!key.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Key does not belong to the authenticated user." } },
      { status: 403 },
    );
  }

  const storage = getStorage();
  // R2 is the only adapter that uploads directly to the provider (bypassing
  // this endpoint). Local, Blob, and DB all receive the file here.
  if (storage.type === "r2") {
    return NextResponse.json(
      {
        error: {
          code: "wrong_adapter",
          message: "This endpoint is not used by the R2 storage adapter.",
        },
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storage.putObject(key, buffer, file.type || "image/jpeg");

  return NextResponse.json({
    data: {
      key: stored.key,
      size: stored.size,
      contentType: stored.contentType,
    },
  });
}
