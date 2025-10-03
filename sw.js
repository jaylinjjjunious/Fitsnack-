/* FitSnacks Service Worker (enhanced v5)
   Strategy:
   - App shell (HTML/CSS/JS/manifest/icons): stale-while-revalidate
   - Images under /assets/: runtime cache with max entries & max age
   - Navigation requests: offline fallback to index.html
   - Exclude Firestore & other cross-origin APIs from caching
*/

const CACHE_VER = "v6";
const SHELL_CACHE = `fitsnacks-shell-${CACHE_VER}`;
const IMG_CACHE   = `fitsnacks-imgs-${CACHE_VER}`;

// List the core shell your app needs to boot offline.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Helper: is same-origin
const sameOrigin = (url) => self.location.origin === new URL(url).origin;

// Helper: cap cache size
async function trimCache(cacheName, maxEntries = 60) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== IMG_CACHE)
          .map((n) => caches.delete(n))
      );
      await clients.claim();
    })()
  );
});

// Should bypass caching (Firestore, APIs, etc.)
function shouldBypass(request) {
  const url = new URL(request.url);
  if (request.method !== "GET") return true;
  if (!sameOrigin(url)) return true;
  if (url.pathname.endsWith("/sw.js")) return true;
  return false;
}

// Runtime cache for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Navigation: fallback to index.html
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match("./index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  if (shouldBypass(request)) return;

  const url = new URL(request.url);

  // Cache images under /assets/
  if (url.pathname.includes("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMG_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then(async (res) => {
            if (res && res.status === 200 && res.type === "basic") {
              cache.put(request, res.clone());
              trimCache(IMG_CACHE, 120).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        return cached || (await networkPromise) || new Response("", { status: 504 });
      })()
    );
    return;
  }

  // Default shell caching: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then(async (res) => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(() => null);

      return cached || (await networkPromise) || new Response("", { status: 504 });
    })()
  );
});