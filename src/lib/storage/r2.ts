import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

import type { PresignParams, PresignResult, StoredObject, StorageAdapter } from "./types";
import { StorageError } from "./types";

/**
 * R2StorageAdapter — stores files in Cloudflare R2 via the S3-compatible API.
 *
 * Requires these environment variables:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_BASE_URL   (the public CDN base for public reads)
 *
 * If any are missing, the adapter throws on construction. The factory in
 * index.ts only instantiates this when all are present.
 */
export class R2StorageAdapter implements StorageAdapter {
  readonly type = "r2" as const;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

    const missing = [
      ["R2_ACCOUNT_ID", accountId],
      ["R2_ACCESS_KEY_ID", accessKeyId],
      ["R2_SECRET_ACCESS_KEY", secretAccessKey],
      ["R2_BUCKET_NAME", bucket],
      ["R2_PUBLIC_BASE_URL", publicBaseUrl],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new StorageError(
        `R2 adapter requires environment variables: ${missing.join(", ")}`,
        "r2_not_configured",
      );
    }

    this.bucket = bucket!;
    this.publicBaseUrl = publicBaseUrl!.replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }

  async presignUpload(params: PresignParams): Promise<PresignResult> {
    const { key, contentType, maxBytes } = params;
    const post = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 0, maxBytes],
        ["starts-with", "$Content-Type", contentType.split("/")[0]],
      ],
      Fields: { "Content-Type": contentType },
      Expires: 600, // 10 minutes
    });

    return {
      uploadUrl: post.url,
      method: "POST",
      fields: post.fields,
      headers: {},
      key,
      adapterType: "r2",
    };
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, size: body.length, contentType };
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new StorageError(`Object not found: ${key}`, "not_found");
    return Buffer.from(bytes);
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async presignDownload(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
