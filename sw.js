// Offline support: the game files are cached on install, so the games run with no
// signal. Pages are fetched from the network first (so a deploy shows up right away)
// and fall back to the cache; car photos from Wikimedia are kept in a second cache.
const V = 'frq-v20';
const CORE = `${V}-core`;
const PHOTOS = `${V}-photos`;
const PHOTO_MAX = 300;

const FILES = [
  './', 'index.html', 'sus-sau-jos.html', 'draft.html', 'turometru.html', 'ordine.html',
  'garaj.html', 'licitatie.html', 'samsar.html',
  'styles.css', 'i18n.js', 'shared.js', 'scores.js', 'kinds.js', 'grades.js', 'data/cars.js',
  'app.js', 'draft.js', 'turometru.js', 'ordine.js', 'garaj.js', 'licitatie.js',
  'samsar.js', 'data/samsar.js',
  'fonts/archivo-var.woff2', 'fonts/archivo-black.woff2',
  'favicon.svg', 'manifest.webmanifest', 'img/frq-logo.png',
  'img/icon-192.png', 'img/icon-512.png',
  'img/hub-sus-sau-jos-640.webp', 'img/hub-masina-perfecta-640.webp', 'img/hub-turometru-640.webp',
  'img/hub-ordine-640.webp', 'img/hub-garaj-640.webp', 'img/hub-licitatie-640.webp',
  'img/hub-samsar-640.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE)
    .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CORE && k !== PHOTOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimPhotos() {
  const c = await caches.open(PHOTOS);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - PHOTO_MAX))) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Car photos: from the cache when they are there, otherwise fetched and kept.
  // The fetch asks for CORS on purpose. A plain no-cors fetch comes back opaque, and an
  // opaque response has two faults. Its status is always 0, so a 404 or a rate limit
  // looks exactly like a photo and gets kept for good: that is how a car ends up with
  // no picture for one player and a picture for another. And it cannot answer a
  // crossOrigin request, which is how Garaj sau presă draws its share card, so the
  // photos were missing from every shared image. Wikimedia allows CORS, so one request
  // gives us a real status and a response that serves both kinds of request.
  if (url.origin !== location.origin) {
    if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(url.pathname)) return;
    e.respondWith(caches.open(PHOTOS).then(async c => {
      const hit = await c.match(url.href, { ignoreVary: true });
      if (hit) return hit;
      let res = null;
      try { res = await fetch(url.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); } catch { /* host without CORS */ }
      if (res && res.ok) { c.put(url.href, res.clone()).then(trimPhotos); return res; }
      if (res) return res;            // a real error: hand it over, do not keep it
      return fetch(req);              // no CORS there: serve it, do not keep it
    }).catch(() => fetch(req)));
    return;
  }

  // Pages: network first, so a new version shows up as soon as it is online.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
    return;
  }

  // Everything else: from the cache, refreshed in the background.
  e.respondWith(caches.open(CORE).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
