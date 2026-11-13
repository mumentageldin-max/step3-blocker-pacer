/* Step 3 Pacer — service worker.
   Caches the app shell on install so the pacers open offline, then refreshes it in the background.
   Holds the pacer's upcoming events while the page is hidden and shows them as notifications (best effort:
   the browser may stop an idle worker, so the page re-checks on return). Bump VERSION whenever a page changes
   so installed copies pick up the update. */
const VERSION = "pacer-v20";
const FONT_CACHE = "pacer-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./day.html",
  "./review.html",
  "./stats.html",
  "./ccs.html",
  "./template.html",
  "./shared.css",
  "./shared.js",
  "./manifest.webmanifest",
  "./manifest-review.webmanifest",
  "./manifest-ccs.webmanifest",
  "./manifest-day.webmanifest",
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
  "./icons/ccs-apple-touch-icon.png",
  "./icons/day-192.png",
  "./icons/day-512.png",
  "./icons/day-maskable-512.png",
  "./icons/day-apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())   // fresh copies, not the browser's ten-minute-old ones
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

/* ---------- scheduled notifications while a pacer page is hidden ---------- */
const timers = new Map(); // tag -> timeout id
function cancelAll() { timers.forEach(t => clearTimeout(t)); timers.clear(); }
function show(ev, url) {
  return self.registration.showNotification(ev.title, {
    body: ev.body || "", tag: ev.tag || ev.title, renotify: true,
    icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
    vibrate: ev.important ? [300, 120, 300, 120, 600] : [150, 80, 150],
    requireInteraction: !!ev.important, data: { url: url || "./" }
  }).catch(() => {});
}
self.addEventListener("message", event => {
  const msg = event.data || {};
  if (msg.type === "schedule") {
    cancelAll();
    const now = Date.now();
    (msg.events || []).forEach(ev => {
      const delay = ev.at - now;
      if (delay < 0 || delay > 6 * 3600 * 1000) return;
      timers.set(ev.tag, setTimeout(() => { timers.delete(ev.tag); show(ev, msg.url); }, delay));
    });
  } else if (msg.type === "cancel") {
    cancelAll();
  } else if (msg.type === "fired") { // the page showed it itself; drop the worker's copy
    const t = timers.get(msg.tag); if (t) { clearTimeout(t); timers.delete(msg.tag); }
  }
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const same = list.find(c => c.url === url) || list.find(c => c.url.indexOf(self.registration.scope) === 0);
    if (same && "focus" in same) return same.focus();
    return self.clients.openWindow(url);
  }));
});
