/**
 * Client-safe upload configuration.
 *
 * Shared by the web upload UI and the server-side validation helpers so the
 * same limits apply on both sides. Keep this module free of server imports
 * (`sharp`, `db`) — it is imported directly by client components.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per variation
export const MIN_DIMENSION = 512;
export const MAX_DIMENSION = 8192;
/** A single wallpaper post may contain up to three source images. */
export const MAX_VARIATIONS = 3;

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/** Stable-enough local id for an unuploaded variation (no UUID dependency). */
export function createVariationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ClientImageCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

/**
 * Browser-side type / size / dimension check for one selected variation.
 * The server repeats these checks with `validateImageFile` after upload.
 */
export function validateClientImage(file: File): Promise<ClientImageCheck> {
  if (!isAllowedMimeType(file.type)) {
    return Promise.resolve({
      ok: false,
      error: "Only JPEG, PNG and WebP images are allowed.",
    });
  }
  if (file.size === 0) {
    return Promise.resolve({ ok: false, error: "File is empty." });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.resolve({ ok: false, error: "File exceeds the 10 MB limit." });
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        resolve({
          ok: false,
          error: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels (got ${width}×${height}).`,
        });
        return;
      }
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        resolve({
          ok: false,
          error: `Image must not exceed ${MAX_DIMENSION}×${MAX_DIMENSION} pixels (got ${width}×${height}).`,
        });
        return;
      }
      resolve({ ok: true, width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: "Could not read the selected image." });
    };
    image.src = url;
  });
}
