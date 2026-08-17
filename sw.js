/* Acute Stroke Guide — service worker.
   Strategy: precache the whole app on install; serve assets cache-first so
   the guide opens instantly with no signal; fetch navigations network-first so
   content corrections land on the next launch, not the one after.
   Bump CACHE on every content release. */

var CACHE = 'asg-v1.24.0';

var ASSETS = [
  './',
  './index.html',
  './assets/css/app.css',
  './assets/js/app.js',
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png',
  /* Reference plates. They are the only heavy assets here (~290 KB for the
     set), so they are precached deliberately: an ASPECTS diagram is useless
     if it needs a signal. Regenerate with tools/build-images.py. */
  './assets/images/aspects/aspects-ganglionic.webp',
  './assets/images/aspects/aspects-supraganglionic.webp',
  './assets/images/aspects/pc-aspects-supratentorial.webp',
  './assets/images/aspects/pc-aspects-infratentorial.webp'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* Navigations are network-first so a correction reaches the clinician on the
     next launch rather than the one after it; the cache is the offline
     fallback. Everything else is served from the precache, which install()
     populates atomically for one CACHE version and activate() swaps in whole.

     Runtime responses are deliberately NOT written back into the versioned
     cache. Doing that was how a v1 index.html could end up paired with a v2
     stylesheet — a mixed-version render in a clinical reference. The version
     bump is the only thing that changes cached content. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match(req, { ignoreSearch: true })
          .then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req);
    })
  );
});
