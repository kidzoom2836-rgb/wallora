import { apiFetch } from "./api";
import { toFormUploadFile, type PickedImage } from "./uploads";

export type ProfileMediaKind = "avatar" | "cover";

type ProfileMediaResponse = {
  data?: { url?: string; avatarUrl?: string; coverUrl?: string } | null;
  error?: { message?: string };
  message?: string;
};

/**
 * Send a picked image to the web API that owns avatar/cover normalization.
 * This posts the local image directly to `/api/v1/profile/media`, which
 * validates, resizes and stores it. No extra staging upload is needed.
 */
export async function uploadProfileMedia(
  kind: ProfileMediaKind,
  picked: PickedImage,
): Promise<string> {
  const file = await toFormUploadFile(picked);
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file.blob, file.fileName);

  let res: Response;
  try {
    res = await apiFetch("/api/v1/profile/media", {
      method: "POST",
      body: form,
      rawBody: true,
    });
  } finally {
    file.cleanup();
  }

  let payload: ProfileMediaResponse = {};
  try {
    payload = (await res.json()) as ProfileMediaResponse;
  } catch {
    /* non-JSON error response */
  }

  if (!res.ok) {
    throw new Error(
      payload.error?.message ?? payload.message ?? `Upload failed (${res.status}).`,
    );
  }

  const url =
    payload.data?.avatarUrl ?? payload.data?.coverUrl ?? payload.data?.url ?? null;
  if (!url) throw new Error("The server did not return a profile image URL.");
  return url;
}
