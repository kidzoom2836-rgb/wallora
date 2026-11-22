import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { requireVerification } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { validateImageFile } from "@/lib/upload-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/v1/products/image
 *
 * Multipart `file` upload for marketplace cover art. Images are validated by
 * signature + dimensions, normalized with Sharp and stored under
 * `p/{userId}/...`. Returns the public URL to use as `coverUrl`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireVerification();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Expected multipart form data." } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Choose an image file." } },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageFile(buffer, file.type);
  if (!validation.ok) {
    return NextResponse.json(
      { error: { code: "validation_error", message: validation.error } },
      { status: 400 },
    );
  }

  try {
    const normalized = await sharp(buffer)
      .rotate()
      .resize(1600, undefined, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const key = `p/${auth.session.user.id}/cover-${Date.now().toString(36)}.jpg`;
    const stored = await getStorage().putObject(key, normalized, "image/jpeg");
    const url = stored.key;

    // `data` keeps the standard envelope; `url` is included for simple clients.
    return NextResponse.json({ data: { url }, url }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: err instanceof Error ? err.message : "Could not save cover image.",
        },
      },
      { status: 500 },
    );
  }
}
