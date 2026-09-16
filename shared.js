// Helpers shared by index.html (higher/lower) and draft.html (2-player draft).
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
    fmtCache[decimals] = fmtCache[decimals] || new Intl.NumberFormat('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return fmtCache[decimals].format(value);
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
    const photo = car.image ? `
      <img class="art-photo" src="${esc(car.image)}" alt="${esc(car.name)}" decoding="async" referrerpolicy="no-referrer">
      <a class="art-credit" href="${esc(car.source)}" target="_blank" rel="noopener">Foto: ${esc(car.credit)}, ${esc(car.license)}</a>` : '';
    return `<div class="art art-placeholder" style="--hue:${hue}" role="img" aria-label="${esc(car.name)}">
      <span class="art-brand">${esc(brand)}</span>
      <svg class="art-car" viewBox="0 0 240 80" aria-hidden="true">
        <path d="M14 58c0-7 3-11 11-13l36-8c11-11 25-19 45-21 24-2 48 3 67 16l33 6c12 2 20 8 20 18v6c0 3-2 5-5 5h-15a21 21 0 0 0-41 0H79a21 21 0 0 0-41 0H20c-4 0-6-2-6-6z"/>
        <circle cx="58" cy="66" r="13"/><circle cx="192" cy="66" r="13"/>
      </svg>${photo}
    </div>`;
  }

  function wirePhotos(root) {
    root.querySelectorAll('.art-photo').forEach(img => {
      const drop = () => { img.nextElementSibling?.remove(); img.remove(); };
      if (img.complete && img.naturalWidth === 0) drop(); // failed before we listened
      else img.addEventListener('error', drop, { once: true });
    });
  }

  function preload(car) {
    if (car && car.image) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.src = car.image; }
  }

  return { store, mulberry32, hashStr, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload };
})();
