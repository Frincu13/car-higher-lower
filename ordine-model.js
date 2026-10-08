// În ordine fără nimic de ecran: ce mașini intră, în ce ordine, și dacă un loc ales
// e corect. Îl folosesc jocul și funcția de pe server care verifică Provocarea zilei:
// din dată se refac aceleași mașini, iar serverul numără singur câte au fost puse la
// locul lor. Se încarcă și ca script (window.OrdineModel), și ca modul (globalThis).
(() => {
  'use strict';

  // 'desc': cel mai mare număr sus. La 0-100, cea mai rapidă e sus.
  const DIR = { hp: 'desc', weight: 'desc', accel: 'asc' };
  const CAT_KEYS = Object.keys(DIR);

  // Același algoritm ca Shared.mulberry32, cu starea la vedere: o partidă a zilei
  // întreruptă se reia exact de unde a rămas.
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
  // Provocarea zilei: categoria și mașinile vin din dată, la fel pentru toți.
  const categoriaZilei = data => CAT_KEYS[hashStr('ordine-cat-' + data) % CAT_KEYS.length];
  const rngZilei = data => rngDin(hashStr('ordine-' + data));

  // `cars`: doar cele cu poză, ca în joc. `rng`: Math.random sau rngZilei(data).
  function joc({ cars, rng, cat }) {
    const val = c => c[cat];
    const cheie = v => (DIR[cat] === 'desc' ? -v : v);
    // Un nume care conține deja răspunsul (McLaren 720S la 720 CP) nu apare.
    const tradeaza = c => (c.name.match(/\d+(?:[.,]\d+)?/g) || []).some(t => {
      const n = parseFloat(t.replace(',', '.')); return n >= 50 && Math.abs(n - val(c)) / val(c) <= 0.02;
    });
    const pool = cars.filter(c => val(c) != null && !tradeaza(c));
    let folosite = new Set();
    const amesteca = a => {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    // Două mașini de pornire destul de departe una de alta, cu loc pe ambele părți.
    function start() {
      folosite = new Set();
      const p = amesteca(pool.slice());
      const a = p[0], b = p.find(c => Math.abs(Math.log(val(c) / val(a))) > 0.3);
      const lista = [a, b].sort((x, y) => cheie(val(x)) - cheie(val(y)));
      lista.forEach(c => folosite.add(c.id));
      return lista;
    }
    function urmatoarea(lista) {
      const luate = new Set(lista.map(val));
      let cand = pool.filter(c => !folosite.has(c.id) && !luate.has(val(c)));
      if (!cand.length) { folosite = new Set(lista.map(c => c.id)); cand = pool.filter(c => !folosite.has(c.id)); }
      const c = cand[Math.floor(rng() * cand.length)];
      folosite.add(c.id);
      return c;
    }
    // locul k (0 = deasupra primei) e corect pentru mașina nouă?
    const corect = (lista, k, noua) => {
      const v = cheie(val(noua));
      return Number.isInteger(k) && k >= 0 && k <= lista.length
        && (k === 0 || cheie(val(lista[k - 1])) <= v) && (k === lista.length || v <= cheie(val(lista[k])));
    };
    const locCorect = (lista, noua) => { const i = lista.findIndex(c => cheie(val(noua)) < cheie(val(c))); return i === -1 ? lista.length : i; };
    return {
      start, urmatoarea, corect, locCorect, val, cheie,
      folosite: () => [...folosite],
      seteazaFolosite: ids => { folosite = new Set(ids); },
    };
  }

  // O partidă refăcută din locurile alese (indicele golului, la fiecare mașină; -1 =
  // timp expirat): câte au fost puse corect până la prima greșeală.
  function refaCu(cars, rng, cat, locuri) {
    const g = joc({ cars: cars.filter(c => c.image), rng, cat });
    const lista = g.start();
    let noua = g.urmatoarea(lista), scor = 0;
    for (const k of locuri) {
      if (!g.corect(lista, k, noua)) break;
      lista.splice(k, 0, noua);
      scor++;
      noua = g.urmatoarea(lista);
    }
    return scor;
  }
  // Provocarea zilei: categoria și mașinile vin din dată.
  const refa = (cars, data, locuri) => refaCu(cars, rngZilei(data), categoriaZilei(data), locuri);
  // O partidă pentru clasamentul general: seed-ul îl dă serverul la pornire.
  const refaPartida = (cars, seed, cat, locuri) => refaCu(cars, rngDin(seed), cat, locuri);

  globalThis.OrdineModel = { DIR, CAT_KEYS, rngDin, hashStr, categoriaZilei, rngZilei, joc, refa, refaPartida };
})();
