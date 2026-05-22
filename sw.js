// ============================================================
// sw.js — Service Worker for Shady Store PWA
// Cache-first strategy for static assets, network-first for API
// ============================================================

const CACHE_NAME    = 'shady-store-v1.0.0';
const DYNAMIC_CACHE = 'shady-store-dynamic-v1';

// Assets to pre-cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './translations.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN resources cached on first fetch (see fetch handler)
];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to die
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // CDN resources: stale-while-revalidate
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // All other requests: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Return cached, fetch update in background
        fetchAndCache(request, DYNAMIC_CACHE);
        return cached;
      }
      return fetchAndCache(request, DYNAMIC_CACHE);
    })
  );
});

// ── Helpers ────────────────────────────────────────────────
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (!response || response.status !== 200 || response.type === 'error') {
      return response;
    }
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch {
    // Offline fallback: return cached version if available
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// ── Background Sync placeholder ────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sales') {
    console.log('[SW] Background sync: sales data');
    // Future: push local sales to cloud API
  }
});

// ── Push Notifications placeholder ────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'Shady Store', {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
  });
});
