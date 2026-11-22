import { z } from "zod";

import { extractMetadata } from "@/lib/image";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  MAX_VARIATIONS,
  MIN_DIMENSION,
} from "@/lib/upload-config";

export {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  MAX_VARIATIONS,
  MIN_DIMENSION,
} from "@/lib/upload-config";

/**
 * WALLORA upload validation.
 *
 * Validates files on three layers:
 *   1. Client-declared metadata (name, type, size) — Zod
 *   2. File signature (magic bytes) — real content detection
 *   3. Image dimensions — min/max after Sharp reads the buffer
 *
 * Multi-variation requests use `sources` (1-3 entries). The original single
 * fields (filename/contentType/size for presign, key/filename for complete)
 * remain supported so existing clients are unaffected.
 */

const filenameSchema = z
  .string()
  .trim()
  .min(1, { message: "Filename is required" })
  .max(200, { message: "Filename is too long" });

const contentTypeSchema = z.enum(ALLOWED_MIME_TYPES, {
  message: "Only JPEG, PNG and WebP images are allowed",
});

const sizeSchema = z
  .number()
  .int()
  .min(1, { message: "File is empty" })
  .max(MAX_UPLOAD_BYTES, { message: "File exceeds 10 MB limit" });

const FileMetaSchema = z.object({
  filename: filenameSchema,
  contentType: contentTypeSchema,
  size: sizeSchema,
});

/** Client-declared metadata validation (used at the presign step). */
export const PresignSchema = z
  .object({
    // Legacy single-file fields (kept optional for multi-source requests).
    filename: filenameSchema.optional(),
    contentType: contentTypeSchema.optional(),
    size: sizeSchema.optional(),
    sources: z.array(FileMetaSchema).min(1).max(MAX_VARIATIONS).optional(),
    groupId: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (data) =>
      (!!data.sources && data.sources.length > 0) ||
      (!!data.filename && !!data.contentType && !!data.size),
    { message: `Provide one to ${MAX_VARIATIONS} source images.` },
  );

export type PresignInput = z.infer<typeof PresignSchema>;

const CompleteSourceSchema = z.object({
  key: z.string().trim().min(1),
  filename: filenameSchema,
  label: z.string().trim().max(80).optional(),
});

/** Complete-step metadata (title, category, description, variations). */
export const CompleteSchema = z
  .object({
    // Legacy single-file fields (kept optional for multi-source requests).
    key: z.string().trim().min(1).optional(),
    filename: filenameSchema.optional(),
    sources: z.array(CompleteSourceSchema).min(1).max(MAX_VARIATIONS).optional(),
    groupId: z.string().trim().min(1).max(80).optional(),
    title: z
      .string()
      .trim()
      .min(2, { message: "Title must be at least 2 characters" })
      .max(120, { message: "Title is too long" }),
    categoryId: z.string().trim().min(1, { message: "Select a category" }),
    description: z
      .string()
      .trim()
      .max(2000, { message: "Description is too long" })
      .optional(),
    tags: z
      .array(z.string().trim().toLowerCase().min(2).max(30))
      .max(10, { message: "Maximum 10 tags" })
      .optional()
      .default([]),
  })
  .refine(
    (data) => (!!data.sources && data.sources.length > 0) || (!!data.key && !!data.filename),
    { message: `Provide one to ${MAX_VARIATIONS} uploaded sources.` },
  );

export type CompleteInput = z.infer<typeof CompleteSchema>;

/** File signature (magic byte) validation — verifies the actual file type. */
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
];

export function detectMimeType(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (!matches) continue;
    // For WebP, also check the WEBP marker at offset 8
    if (sig.mime === "image/webp") {
      if (buffer.length < 12) continue;
      const marker = buffer.slice(8, 12).toString("ascii");
      if (marker !== "WEBP") continue;
    }
    return sig.mime;
  }
  return null;
}

/** Full validation: signature + dimensions + consistency check. */
export async function validateImageFile(
  buffer: Buffer,
  declaredContentType: string,
): Promise<{ ok: true; dimensions: { width: number; height: number; format: string } } | { ok: false; error: string }> {
  if (buffer.length === 0) {
    return { ok: false, error: "File is empty" };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds 10 MB limit" };
  }

  const detected = detectMimeType(buffer);
  if (!detected) {
    return { ok: false, error: "File signature does not match a supported image type" };
  }
  if (detected !== declaredContentType) {
    return {
      ok: false,
      error: `File type mismatch: declared ${declaredContentType} but detected ${detected}`,
    };
  }

  const meta = await extractMetadata(buffer);
  if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
    return {
      ok: false,
      error: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels (got ${meta.width}×${meta.height})`,
    };
  }
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    return {
      ok: false,
      error: `Image must not exceed ${MAX_DIMENSION}×${MAX_DIMENSION} pixels (got ${meta.width}×${meta.height})`,
    };
  }

  return {
    ok: true,
    dimensions: { width: meta.width, height: meta.height, format: meta.format },
  };
}

/** Derive a storage-safe extension from the MIME type. */
export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Generate a storage key for an upload. */
export function buildUploadKey(userId: string, uploadId: string, ext: string): string {
  return `w/${userId}/${uploadId}/original.${ext}`;
}

/** Generate a variant key. */
export function buildVariantKey(userId: string, uploadId: string, variant: string): string {
  return `w/${userId}/${uploadId}/${variant}.jpg`;
}
