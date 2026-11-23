// Production web app that powers the WALLORA mobile client.
// Override at build time with EXPO_PUBLIC_API_BASE_URL when pointing the app
// at a staging deployment or a local tunnel.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://wallora-inky.vercel.app";

/**
 * The web API stores asset references as absolute site paths
 * (e.g. "/showcase/collection-natural.jpg"). React Native needs a
 * fully-qualified URL, so resolve relative references against API_BASE.
 */
export function assetUrl(ref?: string | null): string | undefined {
  if (!ref) return undefined;
  if (/^https?:\/\//i.test(ref)) return ref;
  // Uploaded / generated assets are stored under the public /uploads prefix.
  if (/^(w|gen)\//.test(ref)) return `${API_BASE}/uploads/${ref}`;
  if (ref.startsWith("/")) return `${API_BASE}${ref}`;
  return `${API_BASE}/${ref}`;
}

/**
 * Older backend versions double-prefixed community clip URLs. Collapse repeated
 * `/api/v1/storage/` segments so existing posts can still resolve.
 */
export function normalizeMediaUrl(ref?: string | null): string | undefined {
  const url = assetUrl(ref);
  return url?.replace(/(\/api\/v1\/storage\/){2,}/g, "/api/v1/storage/");
}

/** Raw MPEG-TS captures are not playable by expo-video; HLS and MP4 are. */
export function isPlayableClipUri(uri?: string | null): boolean {
  if (!uri || !/^https?:\/\//i.test(uri)) return false;
  if (/\.ts(?:[?#]|$)/i.test(uri)) return false;
  return /\.(mp4|m4v|mov|webm|m3u8)(?:[?#]|$)/i.test(uri);
}
