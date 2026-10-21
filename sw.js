/* Step 3 Pacer — service worker.
   Caches the app shell on install so the pacers open offline, then refreshes it in the background.
   Bump VERSION whenever a page changes so installed copies pick up the update. */
const VERSION = "pacer-v4";
const FONT_CACHE = "pacer-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./review.html",
  "./stats.html",
  "./ccs.html",
  "./shared.css",
  "./shared.js",
  "./manifest.webmanifest",
  "./manifest-review.webmanifest",
  "./manifest-ccs.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/review-192.png",
  "./icons/review-512.png",
  "./icons/review-maskable-512.png",
  "./icons/review-apple-touch-icon.png",
  "./icons/ccs-192.png",
  "./icons/ccs-512.png",
  "./icons/ccs-maskable-512.png",
  "./icons/ccs-apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // App shell: serve from cache immediately, refresh the copy in the background.
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
        return cached || network;
      })
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    // Fonts: keep the first good copy so the clocks look the same offline.
    event.respondWith(
      caches.open(FONT_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
  }
  // api.github.com (sync) is never cached.
});
