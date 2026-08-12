/* ===================================================================
   service-worker.js
   オフラインキャッシュ（アプリシェルのcache-first戦略）。
   内容を更新したら CACHE_VERSION を上げること。古いキャッシュは
   activate 時に自動削除されるので、更新の取りこぼしを防げる。
=================================================================== */

const CACHE_VERSION = 'gcb-v2';

const PRECACHE_URLS = [
  './index.html',
  './scales.html',
  './css/style.css',
  './js/chords.js',
  './js/app.js',
  './js/scales.js',
  './js/scales-app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
