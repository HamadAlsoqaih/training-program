// Service worker — cache-first app shell for full offline use.
const CACHE = 't15-v2';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/util.js',
  './js/program.js',
  './js/state.js',
  './js/schedule.js',
  './js/completion.js',
  './js/timers.js',
  './js/charts.js',
  './js/views/day.js',
  './js/views/programview.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/sheets.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// cache-first, network fallback (and refresh cache in background for HTML)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
