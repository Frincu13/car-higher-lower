// Mâna din Duel de cărți, pe telefon: un rând glisabil. Cartea din față e mare (se
// citește toată), celelalte stau mai mici în stânga și în dreapta, în ordinea din mână.
// Glisezi sau atingi una din lateral ca s-o aduci în față; atingi cartea din față ca
// s-o joci. Pe ecrane late mâna rămâne un rând obișnuit (aseaza nu face nimic).
// Folosit de carti.js și de camera.js.
window.CartiMana = (() => {
  'use strict';

  const ingust = () => matchMedia('(max-width: 760px)').matches;
  const cartile = el => [...el.querySelectorAll('.crt-c')];

  // Pune cărțile din `el` în evantai, cu cea de la `fata` în față.
  function aseaza(el, fata) {
    if (!el) return;
    const carti = cartile(el), car = ingust();
    el.classList.toggle('is-carusel', car);
    carti.forEach((c, i) => {
      const d = i - fata, a = Math.abs(d);
      c.classList.toggle('is-fata', car && a === 0);
      if (!car) { c.style.transform = ''; c.style.zIndex = ''; c.style.opacity = ''; return; }
      c.style.transform = `translateX(calc(-50% + ${d * 56}%)) scale(${a === 0 ? 1 : a === 1 ? 0.8 : 0.66})`;
      c.style.zIndex = String(10 - a);
      c.style.opacity = a > 2 ? '0' : a === 2 ? '.5' : '1';
      c.setAttribute('aria-current', a === 0 ? 'true' : 'false');
    });
    // înălțimea rândului: cât cartea din față, ca restul paginii să nu se miște
    if (car && carti[fata]) el.style.height = `${carti[fata].offsetHeight + 4}px`;
    else el.style.height = '';
  }

  // `root`: elementul care rămâne (mâna se poate redesena înăuntru); `sel`: mâna.
  // `fata()` dă cartea din față; `laFata(i)` o schimbă; `apasa(i)`: atingere pe cea din față
  // (sau pe oricare, pe ecrane late).
  function lega(root, sel, { fata, laFata, apasa }) {
    let x0 = null, id = null, mutat = false;
    root.addEventListener('pointerdown', e => {
      if (!e.target.closest(sel)) return;
      x0 = e.clientX; id = e.pointerId; mutat = false;
    });
    root.addEventListener('pointermove', e => {
      if (x0 == null || e.pointerId !== id) return;
      if (Math.abs(e.clientX - x0) > 12) mutat = true;
    });
    root.addEventListener('pointercancel', () => { x0 = null; });
    root.addEventListener('pointerup', e => {
      if (x0 == null || e.pointerId !== id) return;
      const dx = e.clientX - x0;
      x0 = null;
      const el = root.matches(sel) ? root : root.querySelector(sel);
      if (!el) return;
      const n = cartile(el).length;
      if (mutat && Math.abs(dx) > 30 && ingust()) { laFata(Math.max(0, Math.min(n - 1, fata() + (dx < 0 ? 1 : -1)))); return; }
      if (mutat) return;
      const c = e.target.closest('.crt-c');
      if (!c || !el.contains(c)) return;
      const i = cartile(el).indexOf(c);
      if (!ingust() || i === fata()) apasa(i); else laFata(i);
    });
  }

  return { aseaza, lega, ingust };
})();
