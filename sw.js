// --- FitSnacks Service Worker ---
// Bump this when you change any cached files:
const CACHE = 'fitsnacks-v5-2025-09-26';

const ASSETS = [
  // Pages
  './',
  './index.html',

  // PWA
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',

  // Images used on the page
  './assets/carousel-1.jpg',
  './assets/carousel-2.jpg',
  './assets/carousel-3.jpg',
  './assets/product-funyuns.jpg',
  './assets/product-chesters.jpg',
  './assets/product-cheetos.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  // Take control ASAP after install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('fitsnacks-') && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Control all open tabs
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only same-origin GETs
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const acceptsHTML =
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  // Keep HTML fresh: network-first, cache fallback
  if (acceptsHTML) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else: cache-first, then network (and cache it)
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
    )
  );
});

// Optional: let pages tell the SW to activate immediately
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});