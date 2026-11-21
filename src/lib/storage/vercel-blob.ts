import { put, del } from "@vercel/blob";

import type {
  PresignParams,
  PresignResult,
  StoredObject,
  StorageAdapter,
} from "./types";
import { StorageError } from "./types";

/**
 * VercelBlobStorageAdapter — stores files in Vercel Blob storage.
 *
 * The native choice for Vercel deployments. Requires the
 * `BLOB_READ_WRITE_TOKEN` environment variable (set automatically when you
 * create a Blob store in the Vercel dashboard and link it to the project).
 *
 * Key model: `putObject(key, body)` calls `blob.put(pathname=key, body)` and
 * returns the resulting public URL as `stored.key`. Downstream code stores
 * that URL as the WallpaperAsset.objectKey, so `getObject(url)` and
 * `getPublicUrl(url)` simply return / fetch the URL.
 */
export class VercelBlobStorageAdapter implements StorageAdapter {
  readonly type = "blob" as const;

  async presignUpload(params: PresignParams): Promise<PresignResult> {
    // Blob uploads go through the same /api/v1/uploads/receive endpoint as
    // local — the receive route calls putObject() which forwards to Blob.
    return {
      uploadUrl: "/api/v1/uploads/receive",
      method: "POST",
      fields: { key: params.key },
      headers: {},
      key: params.key,
      adapterType: "blob",
    };
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const result = await put(key, body, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    // Return the public URL as the key — this is what gets stored in the DB
    // and used for reads / public display.
    return { key: result.url, size: body.length, contentType };
  }

  async getObject(key: string): Promise<Buffer> {
    // For Blob, the stored key IS the public URL.
    const res = await fetch(key);
    if (!res.ok) {
      throw new StorageError(
        `Object not found: ${key.slice(0, 80)}…`,
        "not_found",
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  getPublicUrl(key: string): string {
    // The stored key is already the public Blob URL.
    return key;
  }

  async presignDownload(key: string): Promise<string> {
    // Blob objects are public — no signing needed.
    return key;
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // already gone — fine
    }
  }
}
