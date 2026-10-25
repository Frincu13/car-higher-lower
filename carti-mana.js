// Mâna din Duel de cărți, pe telefon: un rând care alunecă sub deget. Cartea din față
// e mare (se citește toată), celelalte stau mai mici în stânga și în dreapta, în
// ordinea din mână. Cât tragi, cărțile merg odată cu degetul (continuu, nu din carte
// în carte); când îl ridici, se opresc pe cea mai apropiată, cu puțin elan dacă ai
// tras repede. O atingere pe una din lateral o aduce în față; pe cea din față, o joacă.
// Pe ecrane late mâna rămâne un rând obișnuit (aseaza nu face nimic).
// Folosit de carti.js și de camera.js.
window.CartiMana = (() => {
  'use strict';

  const PAS = 0.56;   // cât din lățimea unei cărți e între două cărți vecine
  // pe telefon (îngust sau întors pe orizontală) mâna e carusel
  const ingust = () => matchMedia('(max-width: 760px), (orientation: landscape) and (max-height: 520px)').matches;
  const cartile = el => [...el.querySelectorAll('.crt-c')];
  // mărimea și vizibilitatea după distanța față de mijloc (poate fi fracționară)
  const scara = a => (a <= 1 ? 1 - 0.2 * a : a <= 2 ? 0.8 - 0.14 * (a - 1) : 0.66);
  const vizibil = a => (a <= 1 ? 1 : a <= 2 ? 1 - 0.5 * (a - 1) : Math.max(0, 0.5 - 0.5 * (a - 2)));

  // Pune cărțile din `el` cu poziția `poz` în față (fracționară cât tragi). `lin`: fără
  // tranziție (urmează degetul).
  function aseaza(el, poz, lin = false) {
    if (!el) return;
    const carti = cartile(el), car = ingust(), fata = Math.round(poz);
    el.classList.toggle('is-carusel', car);
    el.classList.toggle('is-trage', car && lin);
    carti.forEach((c, i) => {
      const d = i - poz, a = Math.abs(d);
      c.classList.toggle('is-fata', car && i === fata);
      if (!car) { c.style.transform = ''; c.style.zIndex = ''; c.style.opacity = ''; return; }
      c.style.transform = `translateX(calc(-50% + ${(d * PAS * 100).toFixed(2)}%)) scale(${scara(a).toFixed(3)})`;
      c.style.zIndex = String(Math.round(20 - a * 4));
      c.style.opacity = vizibil(a).toFixed(2);
      c.setAttribute('aria-current', i === fata ? 'true' : 'false');
    });
    // înălțimea rândului: cât o carte, ca restul paginii să nu se miște
    if (car && carti[fata]) el.style.height = `${carti[fata].offsetHeight + 4}px`;
    else el.style.height = '';
  }

  // `root`: elementul care rămâne (mâna se poate redesena înăuntru); `sel`: mâna.
  // `fata()` dă cartea din față; `laFata(i)` o schimbă; `apasa(i)`: atingere pe cea din față
  // (sau pe oricare, pe ecrane late).
  function lega(root, sel, { fata, laFata, apasa }) {
    let t = null;   // tragerea în curs: { id, x0, poz0, pas, ultim: [[timp, x]...], mutat, el }
    const mana = () => (root.matches(sel) ? root : root.querySelector(sel));
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest(sel);
      if (!el || !ingust()) { t = el ? { id: e.pointerId, x0: e.clientX, mutat: false, el } : null; return; }
      const c = cartile(el)[0];
      t = { id: e.pointerId, x0: e.clientX, poz0: fata(), pas: Math.max(40, (c ? c.offsetWidth : 160) * PAS), ultim: [[e.timeStamp, e.clientX]], mutat: false, el };
    });
    root.addEventListener('pointermove', e => {
      if (!t || e.pointerId !== t.id) return;
      const dx = e.clientX - t.x0;
      if (!t.mutat && Math.abs(dx) > 8) { t.mutat = true; try { t.el.setPointerCapture(e.pointerId); } catch { /* merge și așa */ } }
      if (!t.mutat || !t.pas) return;
      const n = cartile(t.el).length;
      // la capete se mai trage puțin, cu rezistență
      let poz = t.poz0 - dx / t.pas;
      if (poz < 0) poz /= 3; else if (poz > n - 1) poz = n - 1 + (poz - (n - 1)) / 3;
      t.poz = poz;
      t.ultim.push([e.timeStamp, e.clientX]);
      if (t.ultim.length > 5) t.ultim.shift();
      aseaza(t.el, poz, true);
    });
    const gata = e => {
      if (!t || e.pointerId !== t.id) return;
      const tr = t;
      t = null;
      const el = mana();
      if (!el) return;
      if (tr.mutat && tr.pas) {
        // elanul: viteza ultimelor mișcări (cărți pe secundă), cam o cincime de secundă înainte
        const [[t0, x0], [t1, x1]] = [tr.ultim[0], tr.ultim[tr.ultim.length - 1]];
        const v = t1 > t0 ? -((x1 - x0) / tr.pas) / ((t1 - t0) / 1000) : 0;
        const n = cartile(el).length;
        const tinta = Math.max(0, Math.min(n - 1, Math.round((tr.poz ?? tr.poz0) + v * 0.18)));
        aseaza(el, tinta);
        if (tinta !== fata()) laFata(tinta);
        return;
      }
      if (e.type === 'pointercancel' || tr.mutat) return;
      const c = e.target.closest('.crt-c');
      if (!c || !el.contains(c)) return;
      const i = cartile(el).indexOf(c);
      if (!ingust() || i === fata()) apasa(i); else laFata(i);
    };
    root.addEventListener('pointerup', gata);
    root.addEventListener('pointercancel', gata);
  }

  return { aseaza, lega, ingust };
})();
