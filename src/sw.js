// // Service worker: network-first supaya update selalu terambil, cache sebagai cadangan offline.
// const CACHE = 'pantul-v1';
// const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
// self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
// self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
// self.addEventListener('fetch', (e) => {
//   if (e.request.method !== 'GET') return;
//   e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
// });
// Service worker: network-first dengan cache fallback.
// Bump CACHE_VERSION setiap deploy supaya update terambil.
const CACHE_VERSION = 'pantul-v1';

const REQUIRED = ['./', './index.html'];
const OPTIONAL = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async (c) => {
      await c.addAll(REQUIRED);
      await Promise.all(
        OPTIONAL.map((url) =>
          c.add(url).catch(() => console.warn('[SW] optional skip:', url))
        )
      );
      await self.skipWaiting();
    })
  );
});

// ── Activate: hapus cache lama ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, cache fallback ──
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin (font, CDN, dll)
  if (url.origin !== self.location.origin) return;

  // Skip API call — biarkan selalu network
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req)
      .then((r) => {
        // Cache hanya response OK (bukan 404/500)
        if (r.ok && r.status === 200) {
          const copy = r.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return r;
      })
      .catch(() => caches.match(req))
  );
});

// ── Message: support manual skip-waiting dari halaman ──
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});