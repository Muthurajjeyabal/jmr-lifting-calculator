// JMR Lifting Calculator — offline-first service worker
// v2: network-first for the app HTML (so updates appear immediately when
// online, without needing to clear cache), cache-first for static icons
// (which rarely change). Falls back to cache whenever there's no network,
// so the app still works completely offline.
const CACHE_NAME = 'jmr-lifting-calculator-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
         (request.headers.get('accept') || '').includes('text/html') ||
         request.url.endsWith('/') ||
         request.url.endsWith('.html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first for HTML: always try to fetch the latest app shell when
  // online, and only fall back to the cached copy if the network fails
  // (offline). This means a fresh GitHub Pages deploy shows up on next
  // launch without the user having to clear the cache.
  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest) — these change rarely,
  // so serving instantly from cache is fine, with network as a fallback.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
