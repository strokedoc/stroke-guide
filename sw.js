/* Acute Stroke Guide — service worker.
   Strategy: precache the whole app on install; serve cache-first so the guide
   opens instantly with no signal; refresh the cache in the background so a
   connected device picks up content updates on the next launch.
   Bump CACHE on every content release. */

var CACHE = 'asg-v1.8.1';

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
  './icons/icon-180.png'
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

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          return caches.open(CACHE).then(function (c) {
            return c.put(req, copy);
          }).then(function () { return res; }, function () { return res; });
        }
        return res;
      });
      if (hit) {
        /* Keep the worker alive long enough to finish the background refresh. */
        e.waitUntil(network.catch(function () {}));
        return hit;
      }
      return network.catch(function () {
        /* An app-shell fallback is appropriate only for page navigation.  Returning
           HTML for a missing script, image, or manifest breaks those resources. */
        return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
      });
    })
  );
});
