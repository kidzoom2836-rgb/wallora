/**
 * WALLORA Service Worker
 *
 * Caching strategy:
 * - App shell (HTML, JS, CSS, fonts): stale-while-revalidate
 * - Static assets (images, icons): cache-first with network fallback
 * - API calls: network-first, fall back to cache if offline
 * - Auth endpoints: never cached (always network)
 *
 * The service worker enables offline app shell loading and cached asset
 * delivery. Private user data and auth responses are never cached.
 */

const CACHE_VERSION = "wallora-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/";

// Resources to precache (the app shell)
const PRECACHE_URLS = [
  "/",
  "/wallora-icon.svg",
  "/manifest.webmanifest",
];

// Never cache these (auth, session, private data)
const NEVER_CACHE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/v1\/auth\//,
  /\/api\/v1\/users\/me/,
  /\/api\/v1\/favorites/,
  /\/api\/v1\/ai\/conversations/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache auth/private endpoints
  if (NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // API calls: network-first, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 }))),
    );
    return;
  }

  // Static assets + pages: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match(OFFLINE_URL));
      return cached || fetchPromise;
    }),
  );
});
