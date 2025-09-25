// --- FitSnacks Service Worker ---
// Bump this when you change any cached files:
const CACHE = 'fitsnacks-v4';
const ASSETS = [
  // Pages
  './',
  './index.html',
  './checkout.html',

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
  // Activate this SW immediately after install
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
  // Control all open clients without a reload
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GETs
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Keep HTML (documents) fresh: network-first with cache fallback
  const acceptsHTML =
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');

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

  // Everything else: cache-first with network fallback
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