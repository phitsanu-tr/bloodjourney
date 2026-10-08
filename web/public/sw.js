// Minimal service worker — exists mainly to satisfy the installability
// requirement for "Add to Home Screen" on Android/Chrome (a registered SW
// with a fetch handler is one of the criteria). Deliberately network-first,
// not an offline-first cache: this app ships often, and serving a stale
// bundle from cache after a big JS/CSS change would be far worse than just
// requiring network on first load. It only falls back to the cache when the
// network is truly unavailable, so a previously-visited page still opens.
const CACHE_NAME = "bloodjourney-shell-v1";
// Every same-origin GET is cached so a visited page still opens offline, and each release brings new hashed file names.
// Without a limit the old releases' files would pile up forever: keep only the newest entries (cache.put moves a
// re-fetched file to the end, so the files of the current release are always among the newest).
const MAX_CACHE_ENTRIES = 80;
async function trimCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_CACHE_ENTRIES; i++) await cache.delete(keys[i]);
}

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
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).then(() => trimCache(cache))).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
