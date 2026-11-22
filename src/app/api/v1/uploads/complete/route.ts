import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireVerification } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { processImage, type ImageMetadata } from "@/lib/image";
import {
  CompleteSchema,
  validateImageFile,
  buildVariantKey,
  type CompleteInput,
} from "@/lib/upload-helpers";
import {
  defaultVariationLabel,
  groupVariationAssets,
  variationPrefix,
  buildVariationMetadata,
  type VariationAsset,
  type VariationMetaEntry,
} from "@/lib/wallpaper-variants";
import { variationMetaKey } from "@/lib/variation-metadata";
import { slugify } from "@/lib/slugify";

/**
 * POST /api/v1/uploads/complete
 *
 * The core of the upload pipeline:
 *   1. Read every uploaded source from storage (1-3 for one post)
 *   2. Validate each file signature + dimensions
 *   3. Process each with Sharp (responsive variants, strip EXIF, metadata)
 *   4. Pre-store all assets to storage (OUTSIDE the transaction)
 *   5. Run a FAST DB-only transaction (one Wallpaper, all assets, tags, audit,
 *      variation metadata in StoredBlob)
 *
 * Steps 1-4 happen outside the transaction because Neon's PgBouncer pool
 * closes long-running interactive transactions. `maxDuration = 60` gives the
 * function time for up to three Sharp pipelines.
 *
 * Legacy clients still send a single `key` + `filename` and get the exact same
 * response shape (plus additive multi-variation fields).
 */
export const maxDuration = 60;

type NormalizedSource = {
  index: number;
  key: string;
  filename: string;
  label?: string;
  uploadId: string;
};

type StoredVariant = VariationAsset & {
  variationIndex: number;
  fileSize: number;
  format: string;
  mimeType: string;
};

function normalizeSources(parsed: CompleteInput): NormalizedSource[] {
  if (parsed.sources?.length) {
    return parsed.sources.map((source, index) => ({
      index,
      key: source.key,
      filename: source.filename,
      label: source.label,
      uploadId: uploadIdFromKey(source.key),
    }));
  }
  return [
    {
      index: 0,
      key: parsed.key!,
      filename: parsed.filename!,
      uploadId: uploadIdFromKey(parsed.key!),
    },
  ];
}

/** Extract the upload id from a raw key, serving URL or Blob URL. */
function uploadIdFromKey(key: string): string {
  const match = key.match(/(?:^|\/)w\/([^/]+)\/([^/]+)\//);
  return match?.[2] ?? "";
}

function declaredMimeForKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

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

  const { title, categoryId, description, tags } = parsed.data;
  const sources = normalizeSources(parsed.data);

  // Verify each key belongs to this user. Keys may be raw, DB serving URLs or
  // Blob URLs — all contain the same w/{userId}/{uploadId}/ segment.
  for (const source of sources) {
    const match = source.key.match(/(?:^|\/)w\/([^/]+)\/([^/]+)\//);
    if (!match?.[1] || match[1] !== userId || !source.uploadId) {
      return NextResponse.json(
        {
          error: {
            code: "forbidden",
            message: `Source ${source.index + 1} does not belong to the authenticated user.`,
          },
        },
        { status: 403 },
      );
    }
  }

  if (new Set(sources.map((source) => source.key)).size !== sources.length) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Each variation must use a different upload." } },
      { status: 400 },
    );
  }

  // Verify the category exists
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json(
      {
        error: { code: "validation_error", message: "Selected category does not exist." },
      },
      { status: 400 },
    );
  }

  const storage = getStorage();

  // Pre-store every variant (outside the transaction).
  const storedVariants: StoredVariant[] = [];
  const variationMetaEntries: VariationMetaEntry[] = [];
  let baseMetadata: ImageMetadata | null = null;

  try {
    for (const source of sources) {
      // 1. Read the uploaded source
      let originalBuffer: Buffer;
      try {
        originalBuffer = await storage.getObject(source.key);
      } catch {
        return NextResponse.json(
          {
            error: {
              code: "not_found",
              message: `Uploaded file for variation ${source.index + 1} not found. Please re-upload.`,
            },
          },
          { status: 404 },
        );
      }

      // 2. Validate signature + dimensions
      const validation = await validateImageFile(
        originalBuffer,
        declaredMimeForKey(source.key),
      );
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: {
              code: "validation_error",
              message: `Variation ${source.index + 1}: ${validation.error}`,
            },
          },
          { status: 400 },
        );
      }

      // 3. Process with Sharp
      const processed = await processImage(originalBuffer);
      const { metadata, variants } = processed;
      if (source.index === 0) baseMetadata = metadata;

      // 4. Store responsive variants under a namespace unique to this source.
      //    The source object itself is reused as the variation's "original".
      const prefix = variationPrefix(source.index);
      for (const variant of variants) {
        const variantName = `${prefix}${variant.variant}`;
        const variantKey =
          variant.variant === "original"
            ? source.key
            : buildVariantKey(userId, source.uploadId, variantName);

        let storedKey = variantKey;
        if (variant.variant !== "original") {
          try {
            const stored = await storage.putObject(variantKey, variant.buffer, variant.mimeType);
            storedKey = stored.key;
          } catch (err) {
            console.error("[upload.complete] variant storage failed:", variantName, err);
            return NextResponse.json(
              {
                error: {
                  code: "server_error",
                  message: `Failed to store ${variantName} variant.`,
                },
              },
              { status: 500 },
            );
          }
        }

        storedVariants.push({
          variationIndex: source.index,
          variant: variantName,
          objectKey: storedKey,
          width: variant.width,
          height: variant.height,
          fileSize: variant.fileSize,
          format: variant.format,
          mimeType: variant.mimeType,
        });
      }

      variationMetaEntries.push({
        index: source.index,
        prefix,
        label: source.label?.trim() || defaultVariationLabel(source.index),
        filename: source.filename,
      });
    }
  } catch (err) {
    console.error("[upload.complete] image processing failed:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Could not process the image. Please try again." } },
      { status: 500 },
    );
  }

  if (!baseMetadata) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "No source image was processed." } },
      { status: 400 },
    );
  }

  // Derive a unique slug from the title
  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-6)}`;
  const metadata = baseMetadata;

  const variationMetadata = buildVariationMetadata("", variationMetaEntries);

  // 5. Fast DB-only transaction.
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

        // One row per responsive variant per source image.
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

        // Per-variation labels/captions in the existing StoredBlob JSON table.
        const payload = Buffer.from(
          JSON.stringify({ ...variationMetadata, wallpaperId: wallpaper.id }),
          "utf8",
        );
        const metaKey = variationMetaKey(wallpaper.id);
        await tx.storedBlob.upsert({
          where: { key: metaKey },
          update: { data: payload, contentType: "application/json", size: payload.length },
          create: {
            key: metaKey,
            data: payload,
            contentType: "application/json",
            size: payload.length,
          },
        });

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
              variationCount: sources.length,
              variants: storedVariants.map((v) => v.variant),
              dimensions: `${metadata.width}x${metadata.height}`,
            }),
          },
        });

        return wallpaper;
      },
      { timeout: 15000, maxWait: 10000 },
    );

    const grouped = groupVariationAssets(storedVariants, {
      ...variationMetadata,
      wallpaperId: wp.id,
    });

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
          // Legacy field: flat list of generated assets (base first).
          assets: storedVariants.map((sv) => ({
            variant: sv.variant,
            objectKey: sv.objectKey,
            width: sv.width,
            height: sv.height,
            fileSize: sv.fileSize,
            format: sv.format,
          })),
          // Additive: one entry per source image in submission order.
          variationCount: grouped.length,
          variations: grouped.map((group) => ({
            index: group.index,
            label: group.label,
            prefix: group.prefix,
            previewAsset: group.preview,
            originalAsset: group.original,
            assets: group.assets,
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
