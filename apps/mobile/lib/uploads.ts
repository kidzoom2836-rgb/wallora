import * as ImagePicker from "expo-image-picker";
import { fetch as expoFetch } from "expo/fetch";
import { File as ExpoFile, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { apiFetch, apiJson } from "./api";
import { API_BASE, assetUrl } from "./config";

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

function extensionForMime(mimeType: string, fileName: string): string {
  if (/png/i.test(mimeType)) return "png";
  if (/webp/i.test(mimeType)) return "webp";
  if (/quicktime/i.test(mimeType)) return "mov";
  if (/webm/i.test(mimeType)) return "webm";
  if (/m4v/i.test(mimeType)) return "m4v";
  if (/mp4/i.test(mimeType)) return "mp4";
  const existing = fileName.split(".").pop()?.toLowerCase();
  return existing && /^[a-z0-9]{2,5}$/.test(existing) ? existing : "jpg";
}

function safeFileName(fileName: string, mimeType: string): string {
  const base = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `wallora-${Date.now()}`;
  const ext = extensionForMime(mimeType, base);
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export type FormUploadFile = {
  blob: Blob;
  fileName: string;
  cleanup: () => void;
};

/**
 * React Native's `{ uri, name, type }` FormData object is not a real Blob and
 * Expo's SDK 58 fetch rejects it. Copy the picked asset into a typed
 * expo-file-system File so it can be appended as a standards-compliant Blob.
 */
export async function toFormUploadFile(input: {
  uri: string;
  fileName: string;
  mimeType: string;
}): Promise<FormUploadFile> {
  const fileName = safeFileName(input.fileName, input.mimeType);

  if (Platform.OS === "web") {
    const response = await fetch(input.uri);
    const source = await response.blob();
    return {
      blob: source,
      fileName,
      cleanup: () => {},
    };
  }

  const target = new ExpoFile(
    Paths.cache,
    `wallora-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`,
  );
  try {
    await new ExpoFile(input.uri).copy(target, { overwrite: true });
  } catch {
    // Some Android gallery URIs are content:// values that the modern File
    // constructor cannot copy directly; the legacy subpath still accepts them.
    const legacy = await import("expo-file-system/legacy");
    await legacy.copyAsync({ from: input.uri, to: target.uri });
  }

  return {
    blob: target as unknown as Blob,
    fileName,
    cleanup: () => {
      try {
        target.delete();
      } catch {
        /* temporary upload copies are safe to leave in the cache */
      }
    },
  };
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
  const file = await toFormUploadFile(image);
  const form = new FormData();
  Object.entries(upload.fields ?? {}).forEach(([key, value]) => form.append(key, String(value)));
  form.append("file", file.blob, file.fileName);

  const isAbsolute = /^https?:\/\//i.test(upload.uploadUrl);
  try {
    const response = isAbsolute
      ? await expoFetch(upload.uploadUrl, {
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
  } finally {
    file.cleanup();
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

export const MAX_CLIP_BYTES = 12 * 1024 * 1024;
const ALLOWED_CLIP_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

export type PickedClip = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationMs?: number;
};

export type UploadedClip = {
  key: string;
  videoUrl: string;
  contentType: string;
  size: number;
};

/** Pick a short video from the gallery for a community channel preview. */
export async function pickChannelClip(): Promise<PickedClip | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library access is required to attach a preview clip.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    videoMaxDuration: 9,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const fileName = asset.fileName || `wallora-clip-${Date.now()}.mp4`;
  const mimeType = asset.mimeType || "video/mp4";
  if (!ALLOWED_CLIP_TYPES.includes(mimeType)) {
    throw new Error("Choose an MP4, WebM or MOV video.");
  }
  const fileSize = asset.fileSize ?? 0;
  if (fileSize > MAX_CLIP_BYTES) {
    throw new Error("Preview clips must be smaller than 12MB.");
  }
  const durationMs = asset.duration ?? undefined;
  if (durationMs && durationMs > 10_500) {
    throw new Error("Choose a clip that is 9 seconds or shorter.");
  }
  return { uri: asset.uri, fileName, mimeType, fileSize, durationMs };
}

export type CaptureChannelClipInput = {
  channelId?: string;
  streamUrl: string;
  durationSec?: number;
  userId?: string;
};

type LiveSegment = { uri: string; duration: number };

/** Vercel serverless functions cap request bodies at 4.5MB. */
const MAX_ON_DEVICE_CLIP_BYTES = 4 * 1024 * 1024;
const CLIP_FETCH_TIMEOUT_MS = 20_000;

async function fetchHlsText(url: string): Promise<string> {
  const response = await expoFetch(url, {
    headers: { Accept: "application/vnd.apple.mpegurl,text/plain,*/*" },
    // Cleartext is allowed by the WALLORA Android network plugin.
  });
  if (!response.ok) throw new Error(`Channel playlist failed (${response.status}).`);
  return response.text();
}

/** Follow a master playlist to its first variant and collect the live tail. */
async function resolveLiveSegments(streamUrl: string, durationSec: number): Promise<LiveSegment[]> {
  let playlistUrl = streamUrl;
  let text = await fetchHlsText(playlistUrl);
  let lines = text.split(/\r?\n/).map((line) => line.trim());

  if (lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) {
    const variant = lines.findIndex(
      (line, index) =>
        index > 0 &&
        !line.startsWith("#") &&
        lines[index - 1]?.startsWith("#EXT-X-STREAM-INF"),
    );
    if (variant < 0) throw new Error("This channel has no playable variant.");
    playlistUrl = new URL(lines[variant], playlistUrl).toString();
    text = await fetchHlsText(playlistUrl);
    lines = text.split(/\r?\n/).map((line) => line.trim());
  }

  if (lines.some((line) => line.startsWith("#EXT-X-KEY:METHOD=AES-128"))) {
    throw new Error("This channel encrypts its segments and cannot be clipped on-device.");
  }

  const segments: LiveSegment[] = [];
  let pending: number | null = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const value = Number.parseFloat(line.slice(8).split(",")[0]);
      pending = Number.isFinite(value) && value > 0 ? value : null;
      continue;
    }
    if (!line || line.startsWith("#") || pending === null) continue;
    let uri: string;
    try {
      uri = new URL(line, playlistUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:$/.test(new URL(uri).protocol)) continue;
    segments.push({ uri, duration: pending });
    pending = null;
  }

  const tail: LiveSegment[] = [];
  let total = 0;
  for (let i = segments.length - 1; i >= 0 && total < durationSec; i -= 1) {
    tail.unshift(segments[i]);
    total += segments[i].duration;
  }
  if (!tail.length) throw new Error("No clippable segments were found in this channel.");
  return tail.slice(-4);
}

/** Fetch the live tail, join the TS segments and upload through storage. */
async function captureOnDevice(input: CaptureChannelClipInput): Promise<UploadedClip> {
  if (!input.userId) throw new Error("Sign in to capture a live preview.");
  const duration = input.durationSec ?? 9;
  const segments = await resolveLiveSegments(input.streamUrl, duration);

  const buffers: ArrayBuffer[] = [];
  let totalBytes = 0;
  for (const segment of segments) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIP_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await expoFetch(segment.uri, {
        headers: { Accept: "video/mp2t,video/*,*/*" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`Channel segment failed (${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) throw new Error("The channel returned an empty segment.");
    if (totalBytes + buffer.byteLength > MAX_ON_DEVICE_CLIP_BYTES) break;
    buffers.push(buffer);
    totalBytes += buffer.byteLength;
  }
  if (!buffers.length || !totalBytes) {
    throw new Error("This channel's preview is too large to capture on this connection.");
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  const localFile = new ExpoFile(
    Paths.cache,
    `wallora-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ts`,
  );
  await localFile.write(merged);

  const key = `w/${input.userId}/clips/live-${Date.now()}.ts`;
  const form = new FormData();
  form.append("key", key);
  form.append("file", localFile as unknown as Blob, "live-preview.ts");

  try {
    const response = await apiFetch("/api/v1/uploads/receive", {
      method: "POST",
      body: form,
      rawBody: true,
    });
    const text = await response.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error */
    }
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Preview upload failed (${response.status}).`);
    }
    return {
      key: payload?.data?.key ?? key,
      videoUrl: `${API_BASE}/api/v1/storage/${payload?.data?.key ?? key}`,
      contentType: "video/mp2t",
      size: payload?.data?.size ?? totalBytes,
    };
  } finally {
    try {
      localFile.delete();
    } catch {
      /* cache cleanup is best-effort */
    }
  }
}

/**
 * Capture a short preview directly from a live channel — never from the
 * user's gallery. The backend endpoint is preferred; older deployments fall
 * back to an on-device HLS tail capture through the existing storage API.
 */
export async function captureChannelClip(
  input: CaptureChannelClipInput,
): Promise<UploadedClip> {
  try {
    const data = await apiJson<{
      key?: string;
      videoUrl?: string;
      contentType?: string;
      size?: number;
    }>("/api/v1/community/clips/capture", {
      method: "POST",
      body: JSON.stringify({
        channelId: input.channelId,
        streamUrl: input.streamUrl,
        durationSec: input.durationSec ?? 9,
      }),
    });
    if (data?.videoUrl) {
      return {
        key: data.key ?? "",
        videoUrl: assetUrl(data.videoUrl) ?? data.videoUrl,
        contentType: data.contentType ?? "video/mp4",
        size: data.size ?? 0,
      };
    }
  } catch {
    // Deployment without the capture route — try the on-device path.
  }
  return captureOnDevice(input);
}

/** Upload a channel preview clip to the WALLORA backend. */
export async function uploadChannelClip(clip: PickedClip): Promise<UploadedClip> {
  const file = await toFormUploadFile(clip);
  const form = new FormData();
  form.append("file", file.blob, file.fileName);

  try {
    const response = await apiFetch("/api/v1/community/clips", {
      method: "POST",
      body: form,
      rawBody: true,
    });
    const text = await response.text();
    let payload: any = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error */
    }
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Upload failed (${response.status}).`);
    }
    const data = payload?.data;
    if (!data?.videoUrl) throw new Error("The upload service returned an invalid response.");
    return {
      key: data.key,
      videoUrl: assetUrl(data.videoUrl) ?? data.videoUrl,
      contentType: data.contentType,
      size: data.size,
    };
  } finally {
    file.cleanup();
  }
}
