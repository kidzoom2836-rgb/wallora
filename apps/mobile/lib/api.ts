import * as SecureStore from "expo-secure-store";
import { fetch as expoFetch } from "expo/fetch";

import { API_BASE } from "./config";

/**
 * The web app authenticates with NextAuth credentials (cookies, not bearer
 * tokens). React Native's fetch has no persistent cookie jar, so we keep a
 * small one here and persist the session cookie to secure storage.
 */

const SESSION_COOKIE = "__Secure-next-auth.session-token";
const SESSION_STORE_KEY = "wallora_session_cookie";

let jar: Record<string, string> = {};

function parseSetCookie(raw: string | string[] | null | undefined): void {
  if (!raw) return;
  if (Array.isArray(raw)) {
    raw.forEach(parseSetCookie);
    return;
  }
  // Split a possibly-combined Set-Cookie header without breaking Expires dates.
  const parts = raw.split(/,\s*(?=[^;,=\s]+=)/);
  for (const part of parts) {
    const first = part.split(";")[0];
    const eq = first.indexOf("=");
    if (eq < 1) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name && value) jar[name] = value;
  }
}

function capture(res: Response): void {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    parseSetCookie(h.getSetCookie());
  } else {
    parseSetCookie(h.get("set-cookie"));
  }
}

function cookieHeader(): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Restore a previously saved session on app launch. */
export async function initSession(): Promise<boolean> {
  const saved = await SecureStore.getItemAsync(SESSION_STORE_KEY);
  if (saved) jar[SESSION_COOKIE] = saved;
  return !!saved;
}

export async function persistSession(): Promise<void> {
  const value = jar[SESSION_COOKIE];
  if (value) await SecureStore.setItemAsync(SESSION_STORE_KEY, value);
}

export async function clearSession(): Promise<void> {
  jar = {};
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY).catch(() => {});
}

export function isAuthenticated(): boolean {
  return !!jar[SESSION_COOKIE];
}

/** Debug helper: the names of cookies currently held in the in-memory jar. */
export function cookieNames(): string[] {
  return Object.keys(jar);
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by AuthProvider so a 401 anywhere can clear the stale session. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

interface ApiFetchInit extends RequestInit {
  /** Skip JSON content-type (used by the form-encoded NextAuth callback). */
  rawBody?: boolean;
}

/** Low-level fetch with cookie handling. Returns the raw Response. */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { rawBody, headers, ...rest } = init;
  const h = new Headers(headers);
  if (!rawBody && rest.body && typeof rest.body === "string" && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }
  const cookie = cookieHeader();
  if (cookie) h.set("Cookie", cookie);
  // Let the native layer keep its own cookie store too (iOS NSHTTPCookieStorage /
  // Android OkHttp). This is a fallback in case a platform strips our manual
  // Cookie header or does not expose Set-Cookie to JavaScript.
  // Expo's fetch keeps FormData/Blob semantics consistent on Android, where
  // React Native's legacy fetch rejects expo-file-system File parts.
  const res = await expoFetch(`${API_BASE}${path}`, {
    ...rest,
    headers: h,
    credentials: "include",
  });
  capture(res);
  return res;
}

/** High-level JSON fetch that unwraps the web app's `{ data: ... }` envelope. */
export async function apiJson<T = any>(path: string, init?: ApiFetchInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON response — fall through with an empty object.
  }
  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    const err: any = new Error(
      json?.error?.message ?? json?.message ?? `Request failed (${res.status})`,
    );
    err.code = json?.error?.code;
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return (json && Object.prototype.hasOwnProperty.call(json, "data") ? json.data : json) as T;
}

/** helpers for the NextAuth credentials flow */
export async function getCsrfToken(): Promise<string> {
  const data = await apiJson<{ csrfToken: string }>("/api/auth/csrf");
  return data.csrfToken;
}

export function signInBody(csrfToken: string, email: string, password: string): string {
  const body = new URLSearchParams();
  body.set("csrfToken", csrfToken);
  body.set("email", email);
  body.set("password", password);
  body.set("callbackUrl", API_BASE);
  body.set("json", "true");
  return body.toString();
}
