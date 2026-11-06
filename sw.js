/* PocketTrack service worker: makes the app work offline */

const VERSION = 'v1';
const CACHE = 'pockettrack-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',

  './css/tokens.css',
  './css/layout.css',
  './css/components.css',
  './css/dashboard.css',
  './css/transactions.css',
  './css/budgets.css',
  './css/savings.css',
  './css/analytics.css',
  './css/settings.css',

  './js/utils.js',
  './js/icons.js',
  './js/store.js',
  './js/ui.js',
  './js/savings.js',
  './js/views/dashboard.js',
  './js/views/transactions.js',
  './js/views/analytics.js',
  './js/views/budgets.js',
  './js/views/settings.js',
  './js/app.js',
  './js/add-form.js'
];

// Install: save the whole app to the cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate: delete old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('pockettrack-') && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache instantly, refresh it quietly in the background
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (!sameOrigin && !isFont) return;

  event.respondWith(handle(event, req));
});

async function handle(event, req) {
  const cache = await caches.open(CACHE);

  let cached = await cache.match(req, { ignoreSearch: true });
  if (!cached && req.mode === 'navigate') {
    cached = await cache.match('./index.html');
  }

  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const res = await network;
  return res || Response.error();
}