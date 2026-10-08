// Sus sau jos fără nimic de ecran: ce mașini vin, în ce categorie, și ce înseamnă un
// răspuns corect. Îl folosesc jocul și funcția de pe server care verifică Provocarea
// zilei: din dată se reface același șir, iar serverul numără singur răspunsurile
// corecte. Se încarcă și ca script (window.SusModel), și ca modul (globalThis).
(() => {
  'use strict';

  const CAT_KEYS = ['hp', 'weight', 'accel'];
  const MIX = 'mix';

  // Generatorul de numere, cu starea la vedere (ca o partidă să poată fi reluată).
  // Același algoritm ca Shared.mulberry32.
  function rngDin(seed) {
    let s = seed | 0;
    const f = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.stare = () => s;
    f.seteaza = v => { s = v | 0; };
    return f;
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const rngZilei = data => rngDin(hashStr('mmsmp-' + data));

  // Valori tot mai apropiate pe măsură ce crește scorul. Distanța e |ln(a/b)|, deci
  // „300 vs 330 CP" și „3,0 vs 3,3 s" sunt la fel de grele.
  function banda(scor) {
    if (scor < 3) return [0.35, Infinity];
    if (scor < 8) return [0.15, 0.9];
    if (scor < 15) return [0.06, 0.45];
    return [0.02, 0.2];
  }

  // `mod`: 'mix' sau o categorie. `rng`: Math.random sau rngZilei(data).
  function joc({ cars, rng, mod }) {
    let folosite = new Set();
    const alege = arr => arr[Math.floor(rng() * arr.length)];
    const categorii = left => {
      const pool = mod === MIX ? CAT_KEYS : [mod];
      return left ? pool.filter(k => left[k] != null) : pool;
    };
    function adversar(left, cat, scor) {
      const a = left[cat];
      let pool = cars.filter(c => c.id !== left.id && c[cat] != null && !folosite.has(c.id));
      if (pool.length < 5) { // s-a terminat lista: se pot repeta din nou
        folosite = new Set([left.id]);
        pool = cars.filter(c => c.id !== left.id && c[cat] != null);
      }
      const [lo, hi] = banda(scor);
      const dist = c => Math.abs(Math.log(c[cat] / a));
      let b = pool.filter(c => { const d = dist(c); return d >= lo && d <= hi && d > 0.01; });
      if (b.length === 0) b = pool.filter(c => dist(c) > 0.01);
      if (b.length === 0) b = pool;
      return alege(b);
    }
    function prima() {
      const cat = alege(categorii(null));
      const left = alege(cars.filter(c => c[cat] != null));
      folosite.add(left.id);
      const right = adversar(left, cat, 0);
      folosite.add(right.id);
      return { cat, left, right };
    }
    // după un răspuns corect: mașina din dreapta trece în stânga
    const urmatoarea = (left, scor) => { const cat = alege(categorii(left)); return { cat, right: adversar(left, cat, scor) }; };
    const foloseste = car => folosite.add(car.id);
    return { prima, urmatoarea, foloseste };
  }

  // dir 'up' / 'down', sau null când a expirat timpul (greșit)
  const corect = (cat, a, b, dir) => dir != null && (a[cat] === b[cat] || (dir === 'up' ? b[cat] > a[cat] : b[cat] < a[cat]));

  // O partidă refăcută din răspunsuri ('u' / 'd', 'x' = timp expirat): câte sunt
  // corecte până la prima greșeală.
  function refaCu(cars, rng, mod, raspunsuri) {
    const g = joc({ cars, rng, mod });
    let { cat, left, right } = g.prima();
    let scor = 0;
    for (const r of raspunsuri) {
      if (!corect(cat, left, right, r === 'u' ? 'up' : r === 'd' ? 'down' : null)) break;
      scor++;
      const n = g.urmatoarea(right, scor);
      left = right;
      cat = n.cat;
      right = n.right;
      g.foloseste(right);
    }
    return scor;
  }
  // Provocarea zilei: mașinile vin din dată, în mix.
  const refa = (cars, data, raspunsuri) => refaCu(cars, rngZilei(data), MIX, raspunsuri);
  // O partidă pentru clasamentul general: seed-ul îl dă serverul la pornire.
  const refaPartida = (cars, seed, mod, raspunsuri) => refaCu(cars, rngDin(seed), mod, raspunsuri);

  globalThis.SusModel = { CAT_KEYS, MIX, rngDin, rngZilei, hashStr, banda, joc, corect, refa, refaPartida };
})();
