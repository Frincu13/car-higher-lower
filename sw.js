// Offline support: the game files are cached on install, so the games run with no
// signal. Pages are fetched from the network first (so a deploy shows up right away)
// and fall back to the cache; car photos from Wikimedia are kept in a second cache.
const V = 'frq-v215';
const CORE = `${V}-core`;
const PHOTOS = `${V}-photos`;
const PHOTO_MAX = 300;
// paginile cer codul și stilurile cu `?v=<numărul versiunii>`, același ca aici
const VER = V.slice(V.lastIndexOf('v') + 1);
const versionat = f => (/\.(js|css)$/.test(f) ? `${f}?v=${VER}` : f);

const FILES = [
  './', 'index.html', 'sus-sau-jos.html', 'draft.html', 'turometru.html', 'ordine.html',
  'garaj.html', 'licitatie.html', 'samsar.html', 'drag.html',
  'styles.css', 'i18n.js', 'shared.js', 'scores.js', 'kinds.js', 'grades.js', 'data/cars.js', 'data/focus.json',
  'app.js', 'draft.js', 'turometru.js', 'ordine.js', 'garaj.js', 'licitatie.js', 'licitatie-model.js', 'draft-model.js', 'startul-live-model.js', 'rand-model.js', 'camera.js', 'camera.html',
  'meniu.js', 'meniu-formular.js', 'confidentialitate.js', 'geaman.html', 'geaman.js', 'geaman-model.js', 'geaman-ui.js', 'carti.html', 'carti.js', 'carti-model.js', 'carti-mana.js', 'samsar.js', 'data/samsar.js', 'drag.js', 'drag-sunet.js', 'drag-model.js', 'frq-cloud.js', 'cont.js', 'economie.js', 'seturi.js', 'colectie.html', 'colectie.js', 'sus-model.js', 'ordine-model.js', 'confidentialitate.html', 'termeni.html', 'notificari.js', 'reguli.js', 'sunete.js', 'img/badge-96.png',
  'fonts/archivo-var.woff2', 'fonts/big-shoulders.woff2',
  'favicon.svg', 'manifest.webmanifest', 'img/frq-logo.png',
  'img/icon-192.png', 'img/icon-512.png',
  'img/hub-sus-sau-jos-640.webp', 'img/hub-masina-perfecta-640.webp', 'img/hub-turometru-640.webp',
  'img/hub-ordine-640.webp', 'img/hub-garaj-640.webp', 'img/hub-licitatie-640.webp',
  'img/hub-samsar-640.webp', 'img/hub-drag-640.webp',
];

// Fiecare fisier se cere cu `reload`, adica ocolind cache-ul browserului. Pages
// trimite tot cu `max-age=600`, deci fara asta o versiune noua isi putea pune in
// cache fisiere vechi de zece minute sub eticheta cea noua.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE)
    .then(c => Promise.allSettled(FILES.map(f =>
      fetch(new Request(f, { cache: 'reload' })).then(res => (res.ok ? c.put(versionat(f), res) : null)))))
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
  // `no-cache` cere revalidare, nu o cerere noua: fara el, zece minute dupa un
  // deploy puteai primi tot pagina veche, din cache-ul browserului.
  // Cu semnal slab, după 3 s fără răspuns vine pagina din cache (dacă e acolo).
  if (req.mode === 'navigate') {
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); }
        return res;
      });
    const dinCache = () => caches.match(req).then(hit => hit || caches.match(new URL(req.url).pathname.split('/').pop() || 'index.html', { ignoreSearch: true }));
    const incet = new Promise(gata => setTimeout(gata, 3000)).then(dinCache).then(hit => hit || net);
    e.respondWith(Promise.race([net, incet])
      .catch(() => dinCache().then(hit => hit || caches.match('index.html'))));
    return;
  }

  // Codul și stilurile versiunii de acum (`?v=` din pagină): din cache, pe loc. Sub
  // numărul ăsta e un singur conținut, deci nu poate ieși unul vechi; o versiune nouă
  // vine cu alt număr, cerut din rețea.
  if (/\.(js|css)$/.test(url.pathname) && url.searchParams.get('v') === VER) {
    e.respondWith(caches.open(CORE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
      if (res.ok) c.put(req, res.clone());
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || Response.error())));
    return;
  }

  // Codul și stilurile: din rețea întâi, revalidate (un 304 e aproape gratis), din
  // cache doar fără semnal. Din cache întâi, după câteva versiuni sărite, pagina nouă
  // pornea o clipă cu scripturile vechi și jocul nu mergea până la reîncărcare.
  if (/\.(js|css|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match(req, { ignoreSearch: true }))
        .then(hit => hit || Response.error())));
    return;
  }

  // Restul (poze, fonturi, iconițe): din cache, reîmprospătate în fundal.
  e.respondWith(caches.open(CORE).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

// Notificările pe telefon: serverul trimite { titlu, text, url, tag } criptat, iar
// aici devine bannerul de pe ecran. Atingerea deschide pagina din mesaj (doar de pe
// site; serverul nu pune altceva), într-o fereastră FRQ deja deschisă dacă există.
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { text: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.titlu || 'FRQ', {
    body: m.text || '', tag: m.tag || undefined, lang: 'ro',
    icon: 'img/icon-192.png', badge: 'img/badge-96.png',
    data: { url: m.url || './index.html' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const scope = self.registration.scope;
  let url = new URL((e.notification.data && e.notification.data.url) || './index.html', scope).href;
  if (!url.startsWith(scope)) url = scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async ferestre => {
    const f = ferestre.find(w => w.url.startsWith(scope));
    if (f) {
      try { const n = await f.navigate(url); if (n) return n.focus(); } catch { /* fereastră necontrolată */ }
      return f.focus();
    }
    return self.clients.openWindow(url);
  }));
});
