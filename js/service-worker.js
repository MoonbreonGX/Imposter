// Imposter Game Service Worker
// Enables offline functionality and app installation

// Dynamic cache name using timestamp - automatically updates when deployed
// Updated: 2025-11-15 (Cache bump 2) - Clearing old cache, force refresh
const CACHE_NAME = 'imposter-game-' + new Date().getTime();
const urlsToCache = [
  '/',
  '/html/index.html',
  '/html/play.html',
  '/html/account.html',
  '/html/leaderboards.html',
  '/html/word-packs.html',
  '/html/shop.html',
  '/css/style.css',
  '/js/game.js',
  '/js/account.js',
  '/js/online.js',
  '/js/word-packs.js',
  '/js/crypto-utils.js',
  '/data/words.js'
];

// Install event - cache all files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((error) => {
        console.warn('Cache addAll failed, some files may not be available offline:', error);
        // Don't fail installation if some files fail to cache
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // Don't cache non-200 responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Return offline page or cached response
        return caches.match(event.request);
      });
    })
  );
});
