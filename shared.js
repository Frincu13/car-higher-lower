// Helpers shared by the games (Sus sau jos, Mașina perfectă, Turometrul).
window.Shared = (() => {
  'use strict';

  const MULTIWORD_BRANDS = ['Mercedes-Benz', 'Mercedes-AMG', 'Aston Martin', 'Alfa Romeo', 'Land Rover',
    'Range Rover', 'Rolls-Royce'];

  // Best-effort storage: never required for the game to work.
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const fmtCache = {};
  function fmt(value, decimals) {
    const loc = window.I18n && I18n.lang === 'en' ? 'en-GB' : 'ro-RO';
    const key = `${loc}|${decimals}`;
    fmtCache[key] = fmtCache[key] || new Intl.NumberFormat(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return fmtCache[key].format(value);
  }

  function brandOf(name) {
    return MULTIWORD_BRANDS.find(b => name.startsWith(b + ' ')) || name.split(' ')[0];
  }
  const modelOf = name => name.slice(brandOf(name).length).trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function artHTML(car) {
    const brand = brandOf(car.name);
    const hue = hashStr(brand) % 360;
    // The placeholder sits underneath the photo, so a photo that fails to load
    // (removed in wirePhotos) still leaves a finished-looking card.
    const photo = car.image
      ? `<img class="art-photo" src="${esc(car.image)}" alt="${esc(car.name)}" decoding="async" referrerpolicy="no-referrer">` : '';
    // Photo licenses (CC BY / BY-SA) require attribution: a quiet caption under the photo.
    const credit = car.image
      ? `<figcaption class="art-credit"><a href="${esc(car.source)}" target="_blank" rel="noopener">Foto: ${esc(car.credit)}, ${esc(car.license)}</a></figcaption>` : '';
    return `<figure class="art-fig">
      <div class="art art-placeholder" style="--hue:${hue}" role="img" aria-label="${esc(car.name)}">
        <span class="art-brand">${esc(brand)}</span>
        <svg class="art-car" viewBox="0 0 240 80" aria-hidden="true">
          <path d="M14 58c0-7 3-11 11-13l36-8c11-11 25-19 45-21 24-2 48 3 67 16l33 6c12 2 20 8 20 18v6c0 3-2 5-5 5h-15a21 21 0 0 0-41 0H79a21 21 0 0 0-41 0H20c-4 0-6-2-6-6z"/>
          <circle cx="58" cy="66" r="13"/><circle cx="192" cy="66" r="13"/>
        </svg>${photo}
      </div>${credit}
    </figure>`;
  }

  function wirePhotos(root) {
    root.querySelectorAll('.art-photo').forEach(img => {
      const drop = () => { img.closest('.art-fig')?.querySelector('.art-credit')?.remove(); img.remove(); };
      // Photos fade in over the placeholder instead of popping in.
      const shown = () => img.classList.add('is-loaded');
      if (img.complete) { if (img.naturalWidth === 0) drop(); else shown(); } // settled before we listened
      else {
        img.addEventListener('error', drop, { once: true });
        img.addEventListener('load', shown, { once: true });
      }
    });
  }

  function preload(car) {
    if (car && car.image) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.src = car.image; }
  }

  // A short buzz on taps. Android and desktop Chrome support this; iPhones do not,
  // because Safari has no Vibration API, so there a tap simply stays silent.
  function haptic(kind = 'tick') {
    try {
      if (!navigator.vibrate) return;
      navigator.vibrate(kind === 'error' ? [24, 70, 24] : kind === 'success' ? 16 : 7);
    } catch { /* blocked, nothing to do */ }
  }

  // A turn clock the games share: a bar that drains under the top bar, plus the seconds
  // left. It pauses while the tab is hidden, so switching apps costs nobody their turn.
  // `pauseWhenHidden` is the honest bit: casual runs pause when you switch away, timed
  // runs do not, or leaving the page would be a way to buy thinking time. Either way the
  // time spent away is counted, so a run can be judged later.
  function makeTimer({ box, bar, num, onEnd, pauseWhenHidden = true }) {
    let total = 0, elapsed = 0, raf = 0, running = false, last = 0, shown = -1;
    let hiddenMs = 0, awayCount = 0, hiddenAt = 0;
    const api = { pauseWhenHidden };

    function paint() {
      if (!total) return;                     // stopwatch: there is nothing to draw
      const left = Math.max(0, total - elapsed);
      const frac = left / total;
      if (bar) bar.style.transform = `scaleX(${frac})`;
      const s = Math.max(0, Math.ceil(left / 1000));
      if (num && s !== shown) {
        num.textContent = s;
        if (shown >= 0 && s > 0 && s <= 3) haptic();
        shown = s;
      }
      if (box) box.classList.toggle('is-late', frac < .3);
    }

    function expired() {
      if (!total || elapsed < total) return false;
      elapsed = total; running = false; paint();
      if (onEnd) onEnd();
      return true;
    }

    function settle() {
      if (!running) return;
      const now = performance.now();
      if (!document.hidden) elapsed += now - last;
      last = now;
    }

    function tick(now) {
      if (!running) return;
      if (document.hidden) { last = now; raf = requestAnimationFrame(tick); return; }
      elapsed += now - last; last = now;
      paint();
      if (expired()) return;
      raf = requestAnimationFrame(tick);
    }

    // Frames stop while the page is in the background, so the time away is added by hand.
    document.addEventListener('visibilitychange', () => {
      if (!running) return;
      if (document.hidden) { settle(); hiddenAt = performance.now(); return; }
      const gone = performance.now() - hiddenAt;
      hiddenMs += gone; awayCount++;
      last = performance.now();
      if (!api.pauseWhenHidden) { elapsed += gone; if (expired()) return; }
      paint();
    });

    Object.assign(api, {
      // seconds > 0 counts down and shows the bar; 0 just measures the turn
      start(seconds = 0) {
        total = seconds * 1000; elapsed = 0; shown = -1;
        hiddenMs = 0; awayCount = 0;
        running = true; last = performance.now();
        if (box) box.hidden = !total;
        if (bar) bar.style.transform = 'scaleX(1)';
        paint();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      },
      // stops and hands back how long the turn took, in ms
      stop() { settle(); running = false; cancelAnimationFrame(raf); return elapsed; },
      used() { settle(); return elapsed; },
      away() { return { hiddenMs, awayCount }; },
      hide() { this.stop(); if (box) box.hidden = true; if (bar) bar.style.transform = 'scaleX(0)'; },
    });
    return api;
  }

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Peisajul pe telefon: cerem întoarcerea, o singură dată, din același loc
  // pentru toate paginile. CSS-ul decide când se vede.
  // Un panou peste ecran trebuie să ia și tastatura, nu doar ecranul. Fără asta,
  // Tab pleacă pe sub el, la butoanele pe care nu le vezi, iar cititoarele de
  // ecran citesc mai departe pagina de dedesubt. Toate panourile se deschid și se
  // închid prin atributul hidden, deci le urmărim pe toate dintr-un singur loc.
  function wirePanouri() {
    const panouri = [...document.querySelectorAll('.overlay')];
    if (!panouri.length) return;
    const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const radacina = el => { let n = el; while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; return n; };
    // Unde ne întoarcem după închidere: ultimul lucru focusat din afara panourilor.
    // Nu îl putem citi la deschidere, fiindcă între timp focusul a intrat deja în panou.
    let ultim = null;
    document.addEventListener('focusin', e => { if (!e.target.closest('.overlay')) ultim = e.target; });
    let inainte = null;

    const comuta = (panou, deschis) => {
      const meu = radacina(panou);
      if (deschis && !inainte) inainte = (document.activeElement && !document.activeElement.closest('.overlay')) ? document.activeElement : ultim;
      for (const n of document.body.children) {
        if (n === meu || n.tagName === 'SCRIPT') continue;
        n.inert = deschis;
      }
      if (deschis) {
        if (!panou.contains(document.activeElement)) {
          const f = [...panou.querySelectorAll(SELECTOR)].find(x => x.getClientRects().length);
          if (f) f.focus();
        }
      } else if (inainte && inainte.isConnected) {
        if (inainte.getClientRects().length) inainte.focus();
        inainte = null;
      }
    };

    const obs = new MutationObserver(ms => { for (const m of ms) comuta(m.target, !m.target.hidden); });
    for (const p of panouri) {
      obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
      if (!p.hidden) comuta(p, true);
    }
  }

  function wireRotate() {
    if (document.querySelector('.rotate')) return;
    const el = document.createElement('div');
    el.className = 'rotate';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="rotate-in">'
      + '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/>'
      + '<path d="M3 15a9 9 0 0 0 3 5"/><path d="M21 9a9 9 0 0 0-3-5"/></svg>'
      + '<p class="rotate-t">Întoarce telefonul</p>'
      + '<p class="rotate-s">Jocurile FRQ se joacă pe lung.</p></div>';
    document.body.appendChild(el);
  }

  // "Cum se joacă": regulile stau într-un panou, nu pe ecranul de pregătire, ca
  // acolo să rămână numai ce ai de făcut. Orice pagină care are #how îl primește.
  function wireHow() {
    const box = document.getElementById('how');
    if (!box) return;
    const arata = v => { box.hidden = !v; };
    document.addEventListener('click', e => {
      if (e.target.closest('[data-how]')) arata(true);
      else if (e.target.closest('[data-how-close]') || e.target === box) arata(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) arata(false); });
  }
  const gata = () => { wireHow(); wireRotate(); wirePanouri(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gata);
  else gata();

  // Installable and playable offline: the service worker caches the game files.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* fine without it */ }));
  }

  return { store, mulberry32, hashStr, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, shuffle, makeTimer };
})();
