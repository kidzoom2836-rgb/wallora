// Production web app that powers the WALLORA mobile client.
export const API_BASE = "https://wallora-inky.vercel.app";

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
