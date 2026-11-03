// ==========================================
// SERVICE WORKER - PUNCH WORK PRO (SW.JS)
// ==========================================

const CACHE_NAME = 'punchworkpro-cache-v1';

// Fichiers statiques vitaux à pré-charger pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png',
  './js/storage.js',
  './js/punch.js',
  './js/results.js',
  './js/app.js'
];

// 1. Installation : mise en cache des assets statiques locaux
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pré-mise en cache sans bloquer si un fichier secondaire manque
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Avertissement pré-cache SW :', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activation : purge des anciennes versions du cache
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

// 3. Récupération (Fetch) : Network-First avec repli Cache local
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ignore ce qui n'est pas du GET pur (POST, PUT, DELETE interdits dans le Cache API)
  if (req.method !== 'GET') {
    return;
  }

  // On ne met pas en cache les requêtes Firebase / Google Auth (gérées par le SDK Firestore)
  const url = new URL(req.url);
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Si la réponse est valide, on met à jour la copie locale dans le cache
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // En cas de panne réseau ou hors-ligne, on sert la copie en cache
        const cachedResponse = await caches.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si la ressource demandée était une navigation HTML, renvoyer la racine
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