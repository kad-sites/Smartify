self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // A basic fetch handler is required by Chrome to trigger the true PWA Install prompt.
  // We just let the network handle all requests normally.
  e.respondWith(fetch(e.request).catch(() => new Response("Offline")));
});
