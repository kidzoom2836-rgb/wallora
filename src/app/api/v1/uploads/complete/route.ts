import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { processImage } from "@/lib/image";
import {
  CompleteSchema,
  validateImageFile,
  buildVariantKey,
} from "@/lib/upload-helpers";
import { slugify } from "@/lib/slugify";

/**
 * POST /api/v1/uploads/complete
 *
 * The core of the upload pipeline:
 *   1. Read the uploaded original from storage
 *   2. Validate the file signature + dimensions
 *   3. Process with Sharp (generate variants, strip EXIF, extract metadata)
 *   4. Pre-store all variants to storage (OUTSIDE the transaction)
 *   5. Run a FAST DB-only transaction (wallpaper + assets + tags + audit)
 *
 * Steps 1-4 happen outside the transaction because Neon's PgBouncer pool
 * closes long-running interactive transactions. The transaction uses
 * createMany for assets (1 query instead of N) and an extended timeout
 * (15s) to stay within the PgBouncer connection window.
 *
 * `maxDuration = 60` gives the Vercel serverless function enough time to
 * run Sharp + store variants + commit the transaction (default is 10s which
 * is too tight for image processing through a pooled DB connection).
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const result = await requireVerification();
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

  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid request.",
        },
      },
      { status: 400 },
    );
  }

  const { key, filename, title, categoryId, description, tags } = parsed.data;

  // Verify the key belongs to this user. The key may be:
  //   - raw: w/{userId}/{uploadId}/original.jpg          (local, R2)
  //   - DB serving URL: /api/v1/storage/w/{userId}/...    (database adapter)
  //   - Blob URL: https://…/w/{userId}/…                  (Vercel Blob adapter)
  const keyMatch = key.match(/(?:^|\/)w\/([^/]+)\/([^/]+)\//);
  const keyUserId = keyMatch?.[1];
  const keyUploadId = keyMatch?.[2];
  if (!keyUserId || keyUserId !== userId) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Key does not belong to the authenticated user." } },
      { status: 403 },
    );
  }

  // Verify the category exists
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Selected category does not exist." } },
      { status: 400 },
    );
  }

  const storage = getStorage();

  // 1. Read the uploaded original
  let originalBuffer: Buffer;
  try {
    originalBuffer = await storage.getObject(key);
  } catch {
    return NextResponse.json(
      { error: { code: "not_found", message: "Uploaded file not found. Please re-upload." } },
      { status: 404 },
    );
  }

  // 2. Validate the file (signature + dimensions)
  const declaredMime = key.endsWith(".png")
    ? "image/png"
    : key.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const validation = await validateImageFile(originalBuffer, declaredMime);
  if (!validation.ok) {
    return NextResponse.json(
      { error: { code: "validation_error", message: validation.error } },
      { status: 400 },
    );
  }

  // 3. Process with Sharp (outside the transaction)
  const processed = await processImage(originalBuffer);
  const { metadata, variants } = processed;

  // Derive a unique slug from the title
  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-6)}`;

  // 4. Pre-store variants to storage (OUTSIDE the transaction)
  const uploadId = keyUploadId ?? "";
  type StoredVariant = {
    variant: string;
    objectKey: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
    mimeType: string;
  };
  const storedVariants: StoredVariant[] = [];

  for (const v of variants) {
    const variantKey =
      v.variant === "original" ? key : buildVariantKey(userId, uploadId, v.variant);

    let storedKey = variantKey;
    if (v.variant !== "original") {
      try {
        const stored = await storage.putObject(variantKey, v.buffer, v.mimeType);
        storedKey = stored.key;
      } catch (err) {
        console.error("[upload.complete] variant storage failed:", v.variant, err);
        return NextResponse.json(
          { error: { code: "server_error", message: `Failed to store ${v.variant} variant.` } },
          { status: 500 },
        );
      }
    }

    storedVariants.push({
      variant: v.variant,
      objectKey: storedKey,
      width: v.width,
      height: v.height,
      fileSize: v.fileSize,
      format: v.format,
      mimeType: v.mimeType,
    });
  }

  // 5. Fast DB-only transaction.
  //    Uses createMany for assets (1 query) and an extended 15s timeout to
  //    accommodate Neon PgBouncer's higher per-query latency.
  try {
    const wp = await db.$transaction(
      async (tx) => {
        const wallpaper = await tx.wallpaper.create({
          data: {
            slug,
            title,
            description: description ?? null,
            userId,
            categoryId,
            status: "pending",
            license: "Personal",
            orientation: metadata.orientation,
            dominantColor: metadata.dominantColor,
            sourceType: "upload",
            isPublic: false,
          },
        });

        // Bulk-insert all variant assets in a single query
        await tx.wallpaperAsset.createMany({
          data: storedVariants.map((sv) => ({
            wallpaperId: wallpaper.id,
            variant: sv.variant,
            objectKey: sv.objectKey,
            width: sv.width,
            height: sv.height,
            fileSize: sv.fileSize,
            format: sv.format,
            mimeType: sv.mimeType,
          })),
        });

        // Tags
        if (tags && tags.length > 0) {
          for (const tagName of tags) {
            const tagSlug = slugify(tagName);
            const tag = await tx.tag.upsert({
              where: { slug: tagSlug },
              update: {},
              create: { slug: tagSlug, name: tagName },
            });
            await tx.wallpaperTag.upsert({
              where: {
                wallpaperId_tagId: { wallpaperId: wallpaper.id, tagId: tag.id },
              },
              update: {},
              create: { wallpaperId: wallpaper.id, tagId: tag.id },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: "upload.complete",
            targetType: "wallpaper",
            targetId: wallpaper.id,
            metadata: JSON.stringify({
              slug,
              title,
              variants: storedVariants.map((v) => v.variant),
              dimensions: `${metadata.width}x${metadata.height}`,
            }),
          },
        });

        return wallpaper;
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return NextResponse.json(
      {
        data: {
          id: wp.id,
          slug: wp.slug,
          title: wp.title,
          status: wp.status,
          orientation: wp.orientation,
          dominantColor: wp.dominantColor,
          license: wp.license,
          createdAt: wp.createdAt,
          assets: storedVariants.map((sv) => ({
            variant: sv.variant,
            objectKey: sv.objectKey,
            width: sv.width,
            height: sv.height,
            fileSize: sv.fileSize,
            format: sv.format,
          })),
          moderationNote:
            "Your upload is pending review. It will appear in discovery once approved.",
        },
        message: "Upload processed successfully.",
      },
      { status: 201 },
    );
  } catch (err) {
    const prismaErr = err as { code?: string } | null;
    if (prismaErr?.code === "P2002") {
      return NextResponse.json(
        { error: { code: "conflict", message: "A wallpaper with this title already exists. Try a different title." } },
        { status: 409 },
      );
    }
    console.error("[upload.complete] failed:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Could not process the upload. Please try again." } },
      { status: 500 },
    );
  }
}
