// Givens Family Finances — service worker
// Strategy: network-first for the app HTML (so you always get the latest deployed
// version when online, since this app changes often), falling back to the cached
// copy when offline. Static assets (icons, manifest) are cache-first since they
// rarely change. All non-same-origin requests (Google auth/Sheets, Plaid server)
// pass straight through — this app needs a live connection to actually load your
// data, offline mode just means the shell still opens instead of a blank/error page.

const CACHE_NAME = 'givens-family-finances-v1';
const APP_SHELL = [
  './family-finances.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.log('[sw] precache failed', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let API/auth calls go straight to network

  const isAppShell = req.mode === 'navigate' || url.pathname.endsWith('family-finances.html');

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./family-finances.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      });
    })
  );
});
