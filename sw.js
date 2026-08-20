const CACHE_NAME = 'subtile-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/browse.html',
  '/movie.html',
  '/login.html',
  '/profile.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/browse.js',
  '/js/movie-page.js',
  '/js/security.js',
  '/js/i18n.js',
  '/js/theme.js',
  '/js/auth.js',
  '/js/data.js',
  '/assets/default-avatar.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/') || url.hostname === 'api.jikan.moe' || url.hostname === 'graphql.anilist.co' || url.hostname === 'v3-cinemeta.strem.io') {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
