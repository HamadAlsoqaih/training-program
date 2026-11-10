// Service worker — cache-first app shell for full offline use.
const CACHE = 't15-v19';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/util.js',
  './js/registry.js',
  './js/program.js',
  './js/deload.js',
  './js/programs/p15.js',
  './js/programs/p12.js',
  './js/programs/p12plus.js',
  './js/programs/rezero.js',
  './js/exercises.js',
  './js/schemes.js',
  './js/video.js',
  './js/dragsort.js',
  './js/state.js',
  './js/schedule.js',
  './js/completion.js',
  './js/analytics.js',
  './js/report.js',
  './js/timers.js',
  './js/push.js',
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
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return;   // the notification server is never cached
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

// Notifications sent by the server (api/send). A newer one with the same tag
// replaces the old, so they never pile up.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* plain text */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Training', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
  }));
});
// Tapping one opens the app, or brings it to the front.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('./'))));
});
