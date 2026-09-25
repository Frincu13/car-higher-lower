// Offline support: the game files are cached on install, so the games run with no
// signal. Pages are fetched from the network first (so a deploy shows up right away)
// and fall back to the cache; car photos from Wikimedia are kept in a second cache.
const V = 'frq-v11';
const CORE = `${V}-core`;
const PHOTOS = `${V}-photos`;
const PHOTO_MAX = 300;

const FILES = [
  './', 'index.html', 'sus-sau-jos.html', 'draft.html', 'turometru.html', 'ordine.html',
  'garaj.html', 'licitatie.html', 'samsar.html',
  'styles.css', 'i18n.js', 'shared.js', 'scores.js', 'kinds.js', 'grades.js', 'data/cars.js',
  'app.js', 'draft.js', 'turometru.js', 'ordine.js', 'garaj.js', 'licitatie.js',
  'samsar.js', 'data/samsar.js',
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
  if (url.origin !== location.origin) {
    if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(url.pathname)) return;
    e.respondWith(caches.open(PHOTOS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) { c.put(req, res.clone()); trimPhotos(); }
      return res;
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
