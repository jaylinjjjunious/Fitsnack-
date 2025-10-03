/* FitSnacks Service Worker (enhanced)
   Strategy:
   - App shell (HTML/CSS/JS/manifest/icons): stale-while-revalidate
   - Images under /assets/: runtime cache with max entries & max age
   - Navigation requests: offline fallback to index.html
   - Exclude Firestore & other cross-origin APIs from caching
*/

const CACHE_VER = "v4";
const SHELL_CACHE = `fitsnacks-shell-${CACHE_VER}`;
const IMG_CACHE   = `fitsnacks-imgs-${CACHE_VER}`;

// List the core shell your app needs to boot offline.
// Add other local JS/CSS files if you split your code later.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Optional: pre-cache a few critical images you always show on first load
  // "./assets/carousel-1.jpg",
  // "./assets/carousel-2.jpg",
  // "./assets/carousel-3.jpg",
];

// Helper: is same-origin
const sameOrigin = (url) => self.location.origin === new URL(url).origin;

// Helper: cap cache size
async function trimCache(cacheName, maxEntries = 60) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // delete oldest first
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting(); // take over immediately after install
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
      await clients.claim(); // control any open pages
    })()
  );
});

// Decide if we should bypass caching (e.g., Firestore or other cross-origin APIs)
function shouldBypass(request) {
  const url = new URL(request.url);

  // Bypass non-GET
  if (request.method !== "GET") return true;

  // Bypass cross-origin calls (e.g., Firestore, gstatic, etc.)
  if (!sameOrigin(url)) return true;

  // Don’t cache service worker itself
  if (url.pathname.endsWith("/sw.js")) return true;

  return false;
}

// Simple max-age logic for images (we’ll revalidate anyway)
const ONE_DAY = 24 * 60 * 60;

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // For app navigations, return index.html as an offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match("./index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Bypass?
  if (shouldBypass(request)) {
    return; // default network behavior
  }

  const url = new URL(request.url);

  // Runtime cache for /assets/ images (stale-while-revalidate + limits)
  if (url.pathname.startsWith("/assets/") || url.pathname.includes("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMG_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then(async (res) => {
            // Only cache successful, basic (same-origin) responses
            if (res && res.status === 200 && res.type === "basic") {
              cache.put(request, res.clone());
              // trim to N entries
              trimCache(IMG_CACHE, 120).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        // Return cache first if present (stale), otherwise wait for network
        return cached || (await networkPromise) || new Response("", { status: 504 });
      })()
    );
    return;
  }

  // App shell & other same-origin GETs: stale-while-revalidate
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

      // If we have cache, use it right away; otherwise wait for network
      return cached || (await networkPromise) || new Response("", { status: 504 });
    })()
  );
});