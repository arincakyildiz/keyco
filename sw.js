const CACHE_NAME = 'keyco-static-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // HTML/documents: network-first for freshness
  const isDocument = req.mode === 'navigate' || req.destination === 'document' || (url.origin === location.origin && url.pathname === '/');
  if (isDocument) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Static assets: network-first for immediate freshness
  if (['script', 'style', 'image', 'font'].includes(req.destination)) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Default: try network, fallback to cache
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(req)) || (await cache.match('/index.html'));
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || networkPromise || fetch(req);
}


