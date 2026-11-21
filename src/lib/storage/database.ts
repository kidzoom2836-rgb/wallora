import { db } from "@/lib/db";
import type {
  PresignParams,
  PresignResult,
  StoredObject,
  StorageAdapter,
} from "./types";
import { StorageError } from "./types";

/**
 * DatabaseStorageAdapter — stores uploaded files directly in Postgres (bytea)
 * via the StoredBlob table.
 *
 * This is the default fallback when neither Cloudflare R2 nor Vercel Blob is
 * configured. It lets uploads work immediately using only the existing Neon
 * database — no extra storage service required.
 *
 * The public URL for a stored object is `/api/v1/storage/{key}`, served by the
 * dynamic route at src/app/api/v1/storage/[...key]/route.ts.
 *
 * Trade-off: images live in the database (which grows over time) and are
 * served via a server route (slower than a CDN first hit, but browser-cached
 * afterward via immutable Cache-Control headers). For high-volume production,
 * switch to R2 or Blob by setting their env vars — the adapter changes
 * automatically with no code changes.
 */
const SERVING_PREFIX = "/api/v1/storage/";

export class DatabaseStorageAdapter implements StorageAdapter {
  readonly type = "db" as const;

  async presignUpload(params: PresignParams): Promise<PresignResult> {
    // DB uploads go through the /api/v1/uploads/receive endpoint — the
    // receive route calls putObject() which writes to the StoredBlob table.
    return {
      uploadUrl: "/api/v1/uploads/receive",
      method: "POST",
      fields: { key: params.key },
      headers: {},
      key: params.key,
      adapterType: "db",
    };
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    await db.storedBlob.upsert({
      where: { key },
      update: { data: body, contentType, size: body.length },
      create: { key, data: body, contentType, size: body.length },
    });
    // Return the serving URL as the stored key — this is what gets persisted
    // as the WallpaperAsset.objectKey and used directly as the img src.
    return { key: this.getPublicUrl(key), size: body.length, contentType };
  }

  async getObject(keyOrUrl: string): Promise<Buffer> {
    // The key might be the raw key OR the serving URL (putObject returns the
    // URL as the key). Normalize to the raw key for the DB lookup.
    const key = keyOrUrl.startsWith(SERVING_PREFIX)
      ? keyOrUrl.slice(SERVING_PREFIX.length)
      : keyOrUrl;
    const blob = await db.storedBlob.findUnique({ where: { key } });
    if (!blob) {
      throw new StorageError(
        `Object not found: ${key.slice(0, 80)}`,
        "not_found",
      );
    }
    return Buffer.from(blob.data);
  }

  getPublicUrl(key: string): string {
    return `${SERVING_PREFIX}${key}`;
  }

  async presignDownload(key: string): Promise<string> {
    if (key.startsWith(SERVING_PREFIX)) return key;
    return this.getPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    const rawKey = key.startsWith(SERVING_PREFIX)
      ? key.slice(SERVING_PREFIX.length)
      : key;
    await db.storedBlob.deleteMany({ where: { key: rawKey } });
  }
}
