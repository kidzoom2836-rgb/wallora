import * as ImagePicker from "expo-image-picker";

import { apiFetch, apiJson } from "./api";
import { assetUrl } from "./config";

/** Images are capped at the same limit as the web upload pipeline. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PickedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
};

export type UploadedImage = {
  key: string;
  publicUrl: string;
  filename: string;
};

export type UploadOptions = {
  aspect?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
  max?: number;
};

type PresignUpload = {
  key: string;
  uploadUrl: string;
  method: "POST";
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  adapterType?: string;
};

type PresignResponse = PresignUpload & {
  groupId?: string;
  uploads?: PresignUpload[];
};

function mimeFromName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function normalizeAsset(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const fileName = asset.fileName || `wallora-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || mimeFromName(fileName);
  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  const fileSize = asset.fileSize ?? 0;
  if (fileSize > MAX_UPLOAD_BYTES) {
    throw new Error("Images must be smaller than 10MB.");
  }
  return {
    uri: asset.uri,
    fileName,
    mimeType,
    fileSize,
    width: asset.width || undefined,
    height: asset.height || undefined,
  };
}

/** Pick one or more images from the library, or a single photo from the camera. */
export async function pickImages(
  source: "library" | "camera" = "library",
  options: UploadOptions = {},
): Promise<PickedImage[]> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === "camera"
        ? "Camera access is required to take a photo."
        : "Photo library access is required to attach images.",
    );
  }

  const common = {
    mediaTypes: "images" as const,
    quality: options.quality ?? 0.85,
  };

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          ...common,
          allowsEditing: options.allowsEditing ?? true,
          aspect: options.aspect ?? [4, 3],
        })
      : await ImagePicker.launchImageLibraryAsync({
          ...common,
          allowsEditing: options.allowsEditing ?? (options.max ?? 1) === 1,
          aspect: options.aspect ?? [4, 3],
          allowsMultipleSelection: (options.max ?? 1) > 1,
          selectionLimit: options.max ?? 1,
        });

  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, options.max ?? 1).map(normalizeAsset);
}

/** Backwards-compatible single-image picker used by the community composer. */
export async function pickCommunityImage(
  source: "library" | "camera" = "library",
): Promise<PickedImage | null> {
  const images = await pickImages(source);
  return images[0] ?? null;
}

async function uploadToPresigned(image: PickedImage, upload: PresignUpload): Promise<void> {
  const form = new FormData();
  Object.entries(upload.fields ?? {}).forEach(([key, value]) => form.append(key, String(value)));
  form.append("file", {
    uri: image.uri,
    name: image.fileName,
    type: image.mimeType,
  } as unknown as Blob);

  const isAbsolute = /^https?:\/\//i.test(upload.uploadUrl);
  const response = isAbsolute
    ? await fetch(upload.uploadUrl, {
        method: upload.method ?? "POST",
        headers: upload.headers ?? {},
        body: form,
      })
    : await apiFetch(upload.uploadUrl, {
        method: upload.method ?? "POST",
        headers: upload.headers ?? {},
        body: form,
        rawBody: true,
      });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Upload failed (${response.status}).`;
    try {
      const json = text ? JSON.parse(text) : null;
      message = json?.error?.message ?? message;
    } catch {
      /* non-JSON error */
    }
    throw new Error(message);
  }
}

/** Upload one or more images through the web API's existing storage pipeline. */
export async function uploadImages(images: PickedImage[]): Promise<UploadedImage[]> {
  if (!images.length) throw new Error("Choose at least one image.");
  if (images.length > 3) throw new Error("You can upload up to three variations.");

  const presign = await apiJson<PresignResponse>("/api/v1/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      sources: images.map((image) => ({
        filename: image.fileName,
        contentType: image.mimeType,
        size: image.fileSize,
      })),
    }),
  });

  const uploads = presign.uploads?.length ? presign.uploads : [presign];
  if (uploads.length !== images.length) {
    throw new Error("The upload service returned an invalid response.");
  }

  for (const [index, upload] of uploads.entries()) {
    if (!upload?.key || !upload?.uploadUrl) {
      throw new Error("The upload service returned an invalid response.");
    }
    await uploadToPresigned(images[index], upload);
  }

  return uploads.map((upload, index) => ({
    key: upload.key,
    publicUrl: assetUrl(upload.key) ?? upload.uploadUrl,
    filename: images[index].fileName,
  }));
}

export type WallpaperUploadResult = {
  groupId: string;
  sources: { key: string; filename: string; label: string }[];
};

/**
 * Upload 1–3 wallpaper sources as one batch. The web `/uploads/complete`
 * endpoint requires the shared groupId returned by presign, so this keeps it
 * alongside the per-source keys.
 */
export async function uploadWallpaperImages(images: PickedImage[]): Promise<WallpaperUploadResult> {
  if (!images.length) throw new Error("Choose at least one image.");
  if (images.length > 3) throw new Error("You can publish up to three variations.");

  const presign = await apiJson<PresignResponse>("/api/v1/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      sources: images.map((image) => ({
        filename: image.fileName,
        contentType: image.mimeType,
        size: image.fileSize,
      })),
    }),
  });

  const uploads = presign.uploads?.length ? presign.uploads : [presign];
  if (uploads.length !== images.length) {
    throw new Error("The upload service returned an invalid response.");
  }

  for (const [index, upload] of uploads.entries()) {
    if (!upload?.key || !upload?.uploadUrl) {
      throw new Error("The upload service returned an invalid response.");
    }
    await uploadToPresigned(images[index], upload);
  }

  return {
    groupId: presign.groupId ?? `wallora-${Date.now()}`,
    sources: uploads.map((upload, index) => ({
      key: upload.key,
      filename: images[index].fileName,
      label: `Variation ${index + 1}`,
    })),
  };
}

/** Backwards-compatible single-image upload used by the community composer. */
export async function uploadCommunityImage(image: PickedImage): Promise<UploadedImage> {
  const [uploaded] = await uploadImages([image]);
  return uploaded;
}
