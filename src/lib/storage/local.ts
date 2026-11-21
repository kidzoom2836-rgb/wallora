import * as fs from "fs/promises";
import * as path from "path";

import type { PresignParams, PresignResult, StoredObject, StorageAdapter } from "./types";
import { StorageError } from "./types";

/**
 * LocalStorageAdapter — stores files on the local filesystem under /public.
 *
 * This is the development / fallback adapter. Files are written to
 * /public/uploads/{key} and served at /uploads/{key}. There is no real
 * presigning — the "presigned URL" points to the local receive endpoint
 * which accepts multipart POSTs.
 *
 * For production, switch to R2StorageAdapter by setting the R2_* env vars.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly type = "local" as const;

  private readonly rootDir: string;
  private readonly publicPrefix: string;

  constructor(rootDir?: string, publicPrefix = "/uploads") {
    this.rootDir = rootDir ?? path.join(process.cwd(), "public", "uploads");
    this.publicPrefix = publicPrefix;
  }

  private resolvePath(key: string): string {
    // Prevent path traversal — the key must not escape the uploads root.
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(this.rootDir, safe);
  }

  async presignUpload(params: PresignParams): Promise<PresignResult> {
    const { key } = params;
    // Ensure the parent directory exists
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    return {
      uploadUrl: "/api/v1/uploads/receive",
      method: "POST",
      fields: { key },
      headers: {},
      key,
      adapterType: "local",
    };
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
    return { key, size: body.length, contentType };
  }

  async getObject(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key);
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new StorageError(`Object not found: ${key}`, "not_found");
    }
  }

  getPublicUrl(key: string): string {
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return `${this.publicPrefix}/${safe}`;
  }

  async presignDownload(key: string, _expiresInSeconds?: number): Promise<string> {
    // Local files are public — no signing needed. In production (R2),
    // this returns a time-limited signed URL.
    return this.getPublicUrl(key);
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.unlink(fullPath);
    } catch {
      // already gone — fine
    }
  }
}
