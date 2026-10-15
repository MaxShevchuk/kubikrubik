/* Offline support. The page itself is fetched from the network first (so updates show up at once)
   and falls back to the saved copy when there is no connection. */
const CACHE = 'rubik-algorithms-v17';
const SHELL = ['./', 'index.html', 'scanner.html', 'vendor/cfop-solver.js', 'vendor/cubejs-cube.js', 'vendor/cubejs-solve.js', 'manifest.webmanifest?v=6', 'icons/icon.svg?v=6', 'icons/icon-192.png?v=6', 'icons/icon-512.png?v=6', 'icons/maskable-512.png?v=6', 'icons/apple-touch-icon.png?v=6'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || (await cache.match('index.html')) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/sw.js')) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
