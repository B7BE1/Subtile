const CACHE_NAME = 'subtile-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/browse.html',
  '/movie.html',
  '/login.html',
  '/profile.html',
  '/css/main.css',
  '/css/ui-upgrade.css',
  '/css/movie.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/auth-ui.js',
  '/js/browse.js',
  '/js/data.js',
  '/js/i18n.js',
  '/js/movie-page.js',
  '/js/security.js',
  '/js/theme.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // API requests: network-first, cache fallback
  if (request.url.includes('/api/') || request.url.includes('cinemeta') || request.url.includes('anilist')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      });
    })
  );
});
