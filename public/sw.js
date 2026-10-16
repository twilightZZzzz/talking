// Офлайн-оболочка «Утренней речи»: статика — из кэша, страницы — сеть с откатом на кэш, API — только сеть.
const VERSION = 'rech-v2-1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/', '/practice', '/progress', '/profile']).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (url.pathname.startsWith('/_next/static/') || /\.(?:png|svg|woff2?|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/')) || Response.error()),
    );
  }
});
