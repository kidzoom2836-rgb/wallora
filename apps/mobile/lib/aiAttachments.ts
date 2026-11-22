import { apiFetch } from "./api";

export const AI_ATTACHMENT_MAX_FILES = 4;
export const AI_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export type AiAttachment = {
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  kind: "image" | "document" | "pdf" | "text";
  url?: string;
};

export type LocalAiFile = {
  uri: string;
  name: string;
  type?: string | null;
  size?: number | null;
};

function normalizeType(file: LocalAiFile): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    default:
      return "text/plain";
  }
}

/** Client-side validation mirrors the web AI attachment endpoint. */
export function validateAiFiles(files: LocalAiFile[]): void {
  if (!files.length) return;
  if (files.length > AI_ATTACHMENT_MAX_FILES) {
    throw new Error(`Aurora can work with up to ${AI_ATTACHMENT_MAX_FILES} files at once.`);
  }
  for (const file of files) {
    const type = normalizeType(file);
    if (!SUPPORTED_TYPES.has(type)) {
      throw new Error(`"${file.name}" is not supported. Use a photo, PDF, TXT, MD, CSV or JSON file.`);
    }
    if ((file.size ?? 0) > AI_ATTACHMENT_MAX_BYTES) {
      throw new Error(`"${file.name}" must be under 10 MB.`);
    }
  }
}

/** Upload files to Aurora through the shared WALLORA storage adapter. */
export async function uploadAiAttachments(files: LocalAiFile[]): Promise<AiAttachment[]> {
  validateAiFiles(files);
  if (!files.length) return [];

  const form = new FormData();
  for (const file of files) {
    form.append("files", {
      uri: file.uri,
      name: file.name,
      type: normalizeType(file),
    } as unknown as Blob);
  }

  const res = await apiFetch("/api/v1/ai/attachments", { method: "POST", body: form });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    throw new Error(
      json?.error?.message ?? json?.message ?? `Attachment upload failed (${res.status}).`,
    );
  }
  return (json?.data ?? []) as AiAttachment[];
}
