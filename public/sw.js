// public/sw.js
// MediKiosk Service Worker — offline support + asset caching
// Strategy: Cache-First for static assets, Network-First for API routes

const CACHE_NAME = "medikiosk-v1";
const OFFLINE_URL = "/";

// ── Assets to pre-cache on install ───────────────────────────────
const PRECACHE_ASSETS = [
  "/",
  "/login",
  "/consent",
  "/history",
  "/scan",
  "/summary",
  "/complete",
  "/logo.jpg",
  "/manifest.json",
];

// ── Install: pre-cache all static pages ──────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Pre-cache partial failure (ok in dev):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy depends on request type ───────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip: non-GET, external, API routes (always need fresh data)
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Static assets: Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — show home page
          return caches.match(OFFLINE_URL) ?? new Response("Offline", { status: 503 });
        });
    })
  );
});
