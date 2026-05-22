// =============================================================
// sw.js — Service Worker for Shady Store PWA
// Implements Cache-First strategy for app shell, Network-First
// for any API calls (not used here, but pattern is ready).
// =============================================================

const CACHE_NAME = "shady-store-v1.0.0";

// Files to pre-cache (app shell)
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./translations.js",
  "./manifest.json",
  // CDN resources are cached on first fetch via dynamic caching below
];

// ── Install: pre-cache the app shell ──────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Shady Store Service Worker…");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Pre-caching app shell");
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating…");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First with Network fallback ──────────────────
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // For CDN requests (Tailwind, FontAwesome), use Cache-First
  // For local files, also use Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache dynamically
      return fetch(event.request)
        .then((networkResponse) => {
          // Only cache valid responses
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type !== "opaque"
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: return cached index.html for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});

// ── Background Sync placeholder (future enhancement) ─────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-sales") {
    console.log("[SW] Background sync triggered for sales");
    // Future: sync sales to remote server
  }
});

// ── Push Notifications placeholder ───────────────────────────
self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "New notification from Shady Store",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    vibrate: [200, 100, 200],
  };
  event.waitUntil(
    self.registration.showNotification("Shady Store", options)
  );
});
