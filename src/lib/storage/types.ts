/**
 * WALLORA storage abstraction.
 *
 * A single StorageAdapter interface implemented by LocalStorageAdapter
 * (works now — writes to /public/uploads) and R2StorageAdapter (production —
 * uses Cloudflare R2 via the S3-compatible API).
 *
 * The factory in index.ts selects the adapter based on environment variables.
 * Swapping storage requires no changes to API routes or UI.
 */

export type StorageAdapterType = "local" | "r2" | "blob" | "db";

export type PresignResult = {
  /** The URL the client should upload the file to. */
  uploadUrl: string;
  /** HTTP method for the upload (POST for both local and R2). */
  method: "POST";
  /** Form fields the client must include (for R2 presigned POST; empty for local). */
  fields: Record<string, string>;
  /** Headers the client must include (for R2; empty for local). */
  headers: Record<string, string>;
  /** The storage key the file will be stored under. */
  key: string;
  /** The adapter type, so the client knows which upload flow to use. */
  adapterType: StorageAdapterType;
};

export type PresignParams = {
  /** Desired storage key (e.g. "uploads/w/abc/original.jpg"). */
  key: string;
  /** Detected MIME type from the client. */
  contentType: string;
  /** Max allowed bytes — enforced by the adapter / R2 conditions. */
  maxBytes: number;
};

export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export interface StorageAdapter {
  readonly type: StorageAdapterType;

  /** Generate an upload URL + credentials for the client to PUT/POST a file. */
  presignUpload(params: PresignParams): Promise<PresignResult>;

  /** Store a buffer server-side (used by Sharp variant generation). */
  putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject>;

  /** Read an object as a buffer (used by the processing pipeline). */
  getObject(key: string): Promise<Buffer>;

  /** A publicly-accessible URL for the object (for public assets). */
  getPublicUrl(key: string): string;

  /** A signed URL for private/authorized downloads (local returns public URL). */
  presignDownload(key: string, expiresInSeconds?: number): Promise<string>;

  /** Delete an object. */
  deleteObject(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
