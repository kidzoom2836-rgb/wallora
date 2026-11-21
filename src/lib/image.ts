import sharp from "sharp";

/**
 * WALLORA image processing pipeline.
 *
 * Uses Sharp to:
 *   - Extract real image metadata (dimensions, format)
 *   - Compute a dominant color
 *   - Generate responsive variants (thumbnail, grid, detail, mobile, desktop)
 *   - Strip EXIF / metadata from all outputs
 *   - Avoid upscaling (withoutEnlargement)
 *
 * In production, this runs in a background worker. In this environment it
 * runs synchronously within the upload-complete request — Sharp processes
 * a single image in ~1-2 seconds, which is acceptable for dev.
 */

export type ImageVariantName =
  | "thumbnail"
  | "grid"
  | "detail"
  | "mobile"
  | "desktop"
  | "original";

export type ProcessedVariant = {
  variant: ImageVariantName;
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
};

export type ImageMetadata = {
  width: number;
  height: number;
  format: string;
  orientation: "portrait" | "landscape" | "square";
  dominantColor: string;
};

export type ProcessedImage = {
  metadata: ImageMetadata;
  variants: ProcessedVariant[];
};

const VARIANT_SPECS: {
  name: Extract<ImageVariantName, "thumbnail" | "grid" | "detail" | "mobile" | "desktop">;
  width: number;
  quality: number;
  condition?: (meta: ImageMetadata) => boolean;
}[] = [
  { name: "thumbnail", width: 300, quality: 70 },
  { name: "grid", width: 600, quality: 75 },
  { name: "detail", width: 1200, quality: 80 },
  { name: "mobile", width: 1080, quality: 80, condition: (m) => m.orientation === "portrait" },
  { name: "desktop", width: 1920, quality: 80, condition: (m) => m.orientation === "landscape" },
];

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Extract metadata + compute dominant color from an image buffer.
 */
export async function extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const format = meta.format ?? "jpeg";

  // Dominant color: resize to 1x1 and read the raw pixel.
  const { data } = await sharp(buffer)
    .resize(1, 1, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = meta.channels ?? 3;
  const r = data[0] ?? 0;
  const g = data[1] ?? r;
  const b = data[2] ?? r;
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  const orientation: ImageMetadata["orientation"] =
    height > width ? "portrait" : width > height ? "landscape" : "square";

  return { width, height, format, orientation, dominantColor: hex };
}

/**
 * Generate all responsive variants for an image buffer.
 * Strips EXIF from every output. Never upscales.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const metadata = await extractMetadata(buffer);

  const variants: ProcessedVariant[] = [];

  // Original — strip EXIF, keep format/dimensions
  const originalFormat = metadata.format;
  const originalMimeType = MIME_BY_FORMAT[originalFormat] ?? "image/jpeg";
  let originalPipeline = sharp(buffer, { animated: false }).rotate(); // auto-rotate from EXIF
  // Convert to a web-safe format and strip metadata
  if (originalFormat === "png") {
    originalPipeline = originalPipeline.png({ quality: 90 });
  } else if (originalFormat === "webp") {
    originalPipeline = originalPipeline.webp({ quality: 85 });
  } else {
    originalPipeline = originalPipeline.jpeg({ quality: 88, mozjpeg: true });
  }
  const originalBuf = await originalPipeline.toBuffer();
  const originalMeta = await sharp(originalBuf).metadata();
  variants.push({
    variant: "original",
    buffer: originalBuf,
    width: originalMeta.width ?? metadata.width,
    height: originalMeta.height ?? metadata.height,
    fileSize: originalBuf.length,
    format: originalMeta.format ?? originalFormat,
    mimeType: MIME_BY_FORMAT[originalMeta.format ?? originalFormat] ?? originalMimeType,
  });

  // Responsive variants
  for (const spec of VARIANT_SPECS) {
    if (spec.condition && !spec.condition(metadata)) continue;

    const resized = await sharp(buffer)
      .rotate() // auto-orient from EXIF, then strip it
      .resize(spec.width, undefined, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: spec.quality, mozjpeg: true })
      .toBuffer();

    const resizedMeta = await sharp(resized).metadata();
    variants.push({
      variant: spec.name,
      buffer: resized,
      width: resizedMeta.width ?? spec.width,
      height: resizedMeta.height ?? 0,
      fileSize: resized.length,
      format: "jpeg",
      mimeType: "image/jpeg",
    });
  }

  return { metadata, variants };
}
