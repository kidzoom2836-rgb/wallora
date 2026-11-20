// Typed API client for WALLORA. Implemented incrementally per phase.

export const API_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}/api/v1${path}`, {
    credentials: "include",
    ...init,
  });
}
