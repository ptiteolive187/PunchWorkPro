// ==========================================
// SERVICE WORKER - PUNCH WORK PRO (SW.JS)
// ==========================================

const CACHE_NAME = 'punchworkpro-cache-v2.0.1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-512.png',
  './js/storage.js',
  './js/agendrix.js',
  './js/results.js',
  './js/punch.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Avertissement pré-cache SW :', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('codetabs.com') ||
    url.hostname.includes('agendrix.com')
    ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(req);
        if (cachedResponse) return cachedResponse;

        if (req.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }

        return new Response('Ressource indisponible hors-ligne', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});