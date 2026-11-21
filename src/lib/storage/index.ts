import { LocalStorageAdapter } from "./local";
import { R2StorageAdapter } from "./r2";
import { VercelBlobStorageAdapter } from "./vercel-blob";
import { DatabaseStorageAdapter } from "./database";
import type { StorageAdapter, StorageAdapterType } from "./types";

export type { StorageAdapter, PresignParams, PresignResult, StoredObject } from "./types";
export { StorageError } from "./types";
export { LocalStorageAdapter } from "./local";
export { R2StorageAdapter } from "./r2";
export { VercelBlobStorageAdapter } from "./vercel-blob";
export { DatabaseStorageAdapter } from "./database";

let cached: StorageAdapter | null = null;

/**
 * Returns the configured storage adapter.
 *
 * Selection logic (first match wins):
 *   - R2_* env vars all present → R2StorageAdapter (Cloudflare R2)
 *   - BLOB_READ_WRITE_TOKEN present → VercelBlobStorageAdapter (Vercel Blob)
 *   - Otherwise → DatabaseStorageAdapter (Postgres StoredBlob table)
 *
 * The database fallback means uploads work immediately with just the Neon
 * database — no extra storage service required. To upgrade to CDN-backed
 * object storage later, set the R2_* or BLOB_READ_WRITE_TOKEN env var and
 * redeploy; the adapter switches automatically with no code changes.
 */
export function getStorage(): StorageAdapter {
  if (cached) return cached;

  const r2Configured =
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!process.env.R2_BUCKET_NAME &&
    !!process.env.R2_PUBLIC_BASE_URL;

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  if (r2Configured) {
    cached = new R2StorageAdapter();
  } else if (blobConfigured) {
    cached = new VercelBlobStorageAdapter();
  } else {
    cached = new DatabaseStorageAdapter();
  }

  return cached;
}

export function getAdapterType(): StorageAdapterType {
  return getStorage().type;
}
