import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { detectMimeType, MAX_UPLOAD_BYTES } from "@/lib/upload-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/v1/profile/media
 *
 * Self-service avatar / cover photo upload. Images are validated, normalized
 * with Sharp and stored through the configured storage adapter. No Prisma
 * migration is needed — Profile already has avatarUrl and coverUrl columns.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
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

  const kind = String(form.get("kind") ?? "avatar");
  if (kind !== "avatar" && kind !== "cover") {
    return NextResponse.json(
      { error: { code: "validation_error", message: "kind must be avatar or cover." } },
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
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Choose an image under 10 MB." } },
      { status: 400 },
    );
  }
  const detected = detectMimeType(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Unsupported image format. Use JPEG, PNG or WebP." } },
      { status: 400 },
    );
  }

  try {
    const meta = await sharp(buffer).metadata();
    const minSide = kind === "avatar" ? 96 : 256;
    if (!meta.width || !meta.height || meta.width < minSide || meta.height < minSide) {
      return NextResponse.json(
        { error: { code: "validation_error", message: `Image must be at least ${minSide}×${minSide} pixels.` } },
        { status: 400 },
      );
    }

    const pipeline = sharp(buffer).rotate();
    const normalized = await (kind === "avatar"
      ? pipeline.resize(512, 512, { fit: "cover", position: "attention" })
      : pipeline.resize(1600, undefined, { withoutEnlargement: true, fit: "inside" }))
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const key = `a/${auth.session.user.id}/${kind}-${Date.now().toString(36)}.jpg`;
    const stored = await getStorage().putObject(key, normalized, "image/jpeg");
    const url = stored.key;

    await db.$transaction([
      db.profile.update({
        where: { userId: auth.session.user.id },
        data: kind === "avatar" ? { avatarUrl: url } : { coverUrl: url },
      }),
      ...(kind === "avatar"
        ? [db.user.update({ where: { id: auth.session.user.id }, data: { image: url } })]
        : []),
      db.auditLog.create({
        data: {
          actorId: auth.session.user.id,
          action: kind === "avatar" ? "profile.avatar.update" : "profile.cover.update",
          targetType: "profile",
          targetId: auth.session.user.id,
          metadata: JSON.stringify({ key, url }),
        },
      }),
    ]);

    return NextResponse.json({
      data: { avatarUrl: kind === "avatar" ? url : undefined, coverUrl: kind === "cover" ? url : undefined, url },
      message: kind === "avatar" ? "Profile photo updated." : "Profile cover updated.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: err instanceof Error ? err.message : "Could not save image.",
        },
      },
      { status: 500 },
    );
  }
}
