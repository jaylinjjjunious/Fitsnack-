self.addEventListener('install', (event) => {
  // Install quickly and take control
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Become active on all clients immediately
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler (no caching yet)
self.addEventListener('fetch', (event) => {
  // Intentionally do nothing: browser handles the request
});
