import * as zlib from "zlib";

import { db } from "@/lib/db";

/**
 * AI chat attachments.
 *
 * Files are stored through the normal WALLORA storage adapter (so the same
 * R2 / Vercel Blob / Postgres backends are used) and their metadata lives in
 * the existing StoredBlob JSON table. No Prisma schema change is required.
 */

export const AI_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const AI_ATTACHMENT_MAX_COUNT = 4;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/x-ndjson",
] as const;
const PDF_TYPES = ["application/pdf"] as const;

export type AiAttachmentKind = "image" | "text" | "pdf";

export type AiAttachment = {
  id: string;
  userId: string;
  name: string;
  contentType: string;
  size: number;
  kind: AiAttachmentKind;
  /** Raw storage key (used by getObject). */
  key: string;
  /** Publicly fetchable URL (shown in the UI). */
  url: string;
  createdAt: string;
};

export function attachmentKindFor(contentType: string, filename: string): AiAttachmentKind | null {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  if ((IMAGE_TYPES as readonly string[]).includes(ct)) return "image";
  if ((TEXT_TYPES as readonly string[]).includes(ct)) return "text";
  if ((PDF_TYPES as readonly string[]).includes(ct)) return "pdf";
  // Browsers sometimes report an empty/octet-stream type — fall back to the
  // extension so real files still work.
  const ext = filename.toLowerCase().split(".").pop();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")) return "image";
  if (["txt", "md", "csv", "json", "log", "ndjson"].includes(ext ?? "")) return "text";
  if (ext === "pdf") return "pdf";
  return null;
}

export const AI_ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".pdf",
].join(",");

function metaKey(userId: string, id: string) {
  return `ai-attachment-meta/${userId}/${id}`;
}

export function messageAttachmentsKey(messageId: string) {
  return `ai-message-attachments/${messageId}`;
}

async function writeJsonBlob(key: string, value: unknown) {
  const data = Buffer.from(JSON.stringify(value), "utf8");
  await db.storedBlob.upsert({
    where: { key },
    update: { data, contentType: "application/json", size: data.length },
    create: { key, data, contentType: "application/json", size: data.length },
  });
}

async function readJsonBlob<T>(key: string): Promise<T | null> {
  const blob = await db.storedBlob.findUnique({
    where: { key },
    select: { data: true },
  });
  if (!blob) return null;
  try {
    return JSON.parse(Buffer.from(blob.data).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function saveAttachmentMeta(meta: AiAttachment) {
  await writeJsonBlob(metaKey(meta.userId, meta.id), meta);
}

/** Reads one attachment and verifies it belongs to the given user. */
export async function readAttachmentMeta(
  userId: string,
  id: string,
): Promise<AiAttachment | null> {
  const meta = await readJsonBlob<AiAttachment>(metaKey(userId, id));
  return meta && meta.userId === userId ? meta : null;
}

export async function saveMessageAttachments(messageId: string, attachments: AiAttachment[]) {
  if (attachments.length === 0) return;
  await writeJsonBlob(
    messageAttachmentsKey(messageId),
    attachments.map((a) => ({
      id: a.id,
      name: a.name,
      contentType: a.contentType,
      kind: a.kind,
      url: a.url,
      size: a.size,
    })),
  );
}

export async function readMessageAttachments(
  messageId: string,
): Promise<Array<Pick<AiAttachment, "id" | "name" | "contentType" | "kind" | "url" | "size">>> {
  return (await readJsonBlob<Array<Pick<AiAttachment, "id" | "name" | "contentType" | "kind" | "url" | "size">>>(
    messageAttachmentsKey(messageId),
  )) ?? [];
}

/** Lightweight PDF text extraction (FlateDecode streams + Tj/TJ operators). */
export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;

  const unescape = (s: string) =>
    s
      .replace(/\\([nrtbf()\\])/g, (_m, c: string) => {
        const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "", f: "" };
        return map[c] ?? c;
      })
      .replace(/\\([0-7]{1,3})/g, (_m, oct: string) => String.fromCharCode(parseInt(oct, 8)));

  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    let data = Buffer.from(streamMatch[1], "latin1");
    try {
      data = zlib.inflateSync(data);
    } catch {
      // Some PDFs store streams uncompressed — use as-is.
    }
    const stream = data.toString("latin1");
    if (!/\bTj\b|\bTJ\b/.test(stream)) continue;
    const bits: string[] = [];
    const opRegex = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
    let op: RegExpExecArray | null;
    while ((op = opRegex.exec(stream)) !== null) {
      if (op[1] !== undefined) {
        bits.push(unescape(op[1]));
      } else if (op[2] !== undefined) {
        for (const part of op[2].match(/\(((?:\\.|[^\\()])*)\)/g) ?? []) {
          bits.push(unescape(part.slice(1, -1)));
        }
      }
    }
    if (bits.length) chunks.push(bits.join(""));
  }

  return chunks.join("\n").replace(/\s{3,}/g, "  ").trim().slice(0, 12000);
}

/** Turns an uploaded attachment into context text Aurora can reason over. */
export async function attachmentToContext(
  attachment: AiAttachment,
  readObject: (key: string) => Promise<Buffer>,
): Promise<string> {
  try {
    if (attachment.kind === "image") {
      // Vision descriptions are produced by the message route, which owns the
      // provider. Here we only need to confirm the file is readable.
      await readObject(attachment.key);
      return `[Attached image: ${attachment.name}]`;
    }
    if (attachment.kind === "pdf") {
      const buffer = await readObject(attachment.key);
      const text = extractPdfText(buffer);
      return text
        ? `[Attached document: ${attachment.name}]\n${text}`
        : `[Attached document: ${attachment.name}] — no selectable text could be extracted. Ask the user to upload a text or image version if details are needed.`;
    }
    const buffer = await readObject(attachment.key);
    const text = buffer.toString("utf8").slice(0, 12000);
    return `[Attached document: ${attachment.name}]\n${text}`;
  } catch {
    return `[Attached file: ${attachment.name} — content could not be read]`;
  }
}
