// --- FitSnacks Service Worker ---
const CACHE = 'fitsnacks-v7'; // bump when assets change

const ASSETS = [
  './',
  './index.html',
  './checkout.html',

  // PWA
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',

  // Carousel images (your files)
  './assets/highland-aerial.jpg',
  './assets/front-entrance.jpg',
  './assets/pep-rally.jpg',

  // Product images
  './assets/product-funyuns.jpg',
  './assets/product-chesters.jpg',
  './assets/product-cheetos.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('fitsnacks-') && k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const wantsHTML =
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (wantsHTML) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      cached => cached ||
        fetch(event.request).then(res => {
          caches.open(CACHE).then(c => c.put(event.request, res.clone()));
          return res;
        })
    )
  );
});