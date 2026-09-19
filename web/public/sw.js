// Minimal service worker — exists mainly to satisfy the installability
// requirement for "Add to Home Screen" on Android/Chrome (a registered SW
// with a fetch handler is one of the criteria). Deliberately network-first,
// not an offline-first cache: this app ships often, and serving a stale
// bundle from cache after a big JS/CSS change would be far worse than just
// requiring network on first load. It only falls back to the cache when the
// network is truly unavailable, so a previously-visited page still opens.
const CACHE_NAME = "bloodjourney-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle same-origin GET requests — never intercept LINE's own
  // requests, analytics, or cross-origin calls.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
