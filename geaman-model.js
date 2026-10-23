// Geamănul: primești o mașină, cu cai putere, greutate și 0-100 la vedere, și alegi
// din toată lista (în afară de marca ei) câte o mașină pe fiecare categorie: una cât
// mai apropiată la cai putere, una la greutate, una la 0-100. Valorile celorlalte nu
// se văd: contează cât știi. Cinci runde; fiecare alegere se punctează doar pe
// categoria ei: 100 minus diferența față de mașina dată, în procente (2% -> 98).
// Se încarcă și ca script (window.GeamanModel), și ca modul (funcția `camera`).
(() => {
  'use strict';

  const RUNDE = 5;
  const CAT = ['hp', 'weight', 'accel'];
  const MAX = 100;   // pe o alegere
  // camera online: privirea dinainte, timpul de ales (trei mașini), cât se vede rezultatul;
  // „fără timp" (cu un prieten): 10 minute pe rundă, doar ca partida să nu rămână agățată
  const MS = { intro: 3000, alege: 45000, arata: 7000, faraTimp: 600000 };
  // botul alege la întâmplare din primele x% cele mai apropiate, pe fiecare categorie
  const NIVELE_BOT = [0.8, 0.45, 0.15];

  // Marca: aceeași listă de mărci din două cuvinte ca în pagini; Mercedes-Benz și
  // Mercedes-AMG sunt aceeași marcă.
  const MULTI = ['Mercedes-Benz', 'Mercedes-AMG', 'Aston Martin', 'Alfa Romeo', 'Land Rover', 'Range Rover', 'Rolls-Royce', 'De Tomaso'];
  function marca(nume) {
    const b = MULTI.find(x => nume.startsWith(x + ' ')) || nume.split(' ')[0];
    return /^Mercedes/i.test(b) ? 'Mercedes' : b.toLowerCase();
  }

  function rngDin(samanta) {
    let a = samanta >>> 0 || 1;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function creeaza(cars) {
    // doar mașinile cu toate trei valorile măsurate (fără 0-100 estimat) și cu poză
    const pool = (cars || []).filter(c => c.image && c.hp > 0 && c.weight > 0 && c.accel > 0);
    const dupaId = new Map(pool.map(c => [c.id, c]));
    // cât de departe pe o categorie: diferența relativă față de mașina dată
    const departe = (t, c, k) => Math.abs(c[k] - t[k]) / t[k];
    // diferența în procente, rotunjită, și punctele: 100 minus ea (cel puțin 0)
    const procent = (t, c, k) => Math.round(departe(t, c, k) * 100);
    const puncte = (t, c, k) => (c ? Math.max(0, MAX - procent(t, c, k)) : 0);
    const candidati = t => pool.filter(c => c.id !== t.id && marca(c.name) !== marca(t.name));
    const ePosibila = (t, c) => !!c && c.id !== t.id && marca(c.name) !== marca(t.name) && dupaId.has(c.id);
    const cache = new Map();
    function apropiate(t, k) {
      const ch = `${t.id}|${k}`;
      if (!cache.has(ch)) cache.set(ch, candidati(t).map(c => [c, departe(t, c, k)]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id).map(x => x[0]));
      return cache.get(ch);
    }
    const celeMaiBune = t => CAT.map(k => apropiate(t, k)[0]);
    function tinte(rng, n = RUNDE) {
      const ales = new Set(), mar = new Set();
      for (let i = 0; ales.size < n && i < 500; i++) {
        const c = pool[Math.floor(rng() * pool.length)];
        if (ales.has(c.id) || mar.has(marca(c.name))) continue;   // mărci diferite în aceeași partidă
        ales.add(c.id); mar.add(marca(c.name));
      }
      return [...ales].map(id => dupaId.get(id));
    }
    // botul: câte o mașină pe categorie
    function alegeBot(t, nivel, rng) {
      return CAT.map(k => {
        const l = apropiate(t, k);
        const n = Math.max(1, Math.round(l.length * NIVELE_BOT[nivel]));
        return l[Math.floor(rng() * Math.min(n, l.length))];
      });
    }
    // punctele unei alegeri de trei (null: n-a ales pe categoria aceea)
    const puncteAlegere = (t, trei) => CAT.map((k, i) => puncte(t, trei[i], k));
    return { pool, dupaId, departe, procent, puncte, puncteAlegere, candidati, ePosibila, apropiate, celeMaiBune, tinte, alegeBot, marca };
  }

  // ---------- cu un om, în cameră ----------
  // Fazele: 'intro', 'alege' (amândoi aleg cele trei, fiecare vede doar că celălalt a
  // trimis), 'arata' (se văd alegerile și punctele), 'final'. Ce nu trimiți la timp ia 0.
  function camera(cars) {
    const G = creeaza(cars);
    function noua(rng, acum, primul = 0, optiuni = {}) {
      return { faza: 'intro', termen: acum + MS.intro, runda: 0, tinte: G.tinte(rng).map(c => c.id), runde: [], acum: [null, null], scor: [0, 0], rezultat: null, fara: optiuni.timp === 'fara' };
    }
    const durata = s => (s.fara ? MS.faraTimp : MS.alege);
    function inchideRunda(s, acum) {
      const t = G.dupaId.get(s.tinte[s.runda]);
      const masini = s.acum.map(x => x || [null, null, null]);
      const pct = masini.map(trei => G.puncteAlegere(t, trei.map(id => (id == null ? null : G.dupaId.get(id)))));
      const total = pct.map(x => x.reduce((a, b) => a + b, 0));
      s.runde.push({ tinta: t.id, masini, puncte: pct, total, best: G.celeMaiBune(t).map(c => c.id) });
      s.scor = s.scor.map((x, p) => x + total[p]);
      s.acum = [null, null];
      s.faza = 'arata';
      s.termen = acum + MS.arata;
    }
    function avanseaza(s, acum) {
      let schimbat = false;
      for (let pasi = 0; s.termen != null && s.termen <= acum && pasi < 30; pasi++) {
        const t = s.termen;
        schimbat = true;
        if (s.faza === 'intro') { s.faza = 'alege'; s.termen = t + durata(s); }
        else if (s.faza === 'alege') inchideRunda(s, t);
        else if (s.faza === 'arata') {
          s.runda++;
          if (s.runda >= s.tinte.length) {
            s.faza = 'final'; s.termen = null;
            s.rezultat = { win: s.scor[0] > s.scor[1] ? 0 : s.scor[1] > s.scor[0] ? 1 : null, scor: s.scor.slice() };
          } else { s.faza = 'alege'; s.termen = t + durata(s); }
        } else s.termen = null;
      }
      return schimbat;
    }
    // m.masini: [cai putere, greutate, 0-100] (id-uri, sau null unde n-ai ales)
    function muta(s, p, m, acum) {
      if (s.faza !== 'alege') return 'faza';
      if (s.acum[p] != null) return 'deja';
      const t = G.dupaId.get(s.tinte[s.runda]);
      const trei = Array.isArray(m && m.masini) && m.masini.length === CAT.length ? m.masini : null;
      if (!trei || trei.every(x => x == null)) return 'masina';
      if (trei.some(id => id != null && !G.ePosibila(t, G.dupaId.get(id)))) return 'masina';
      s.acum[p] = trei.map(id => (id == null ? null : id));
      if (s.acum.every(x => x != null)) inchideRunda(s, acum);
      return null;
    }
    // ce vede fiecare: ținta de acum, rundele încheiate, alegerea lui; a celuilalt, doar că a trimis
    function vedere(s, p) {
      return {
        faza: s.faza, termen: s.termen, runda: s.runda, din: s.tinte.length, scor: s.scor, rezultat: s.rezultat, runde: s.runde, fara: !!s.fara,
        tinta: s.faza === 'final' ? null : s.tinte[s.runda], pus: s.acum.map(x => x != null), eu: p >= 0 ? s.acum[p] : null,
      };
    }
    return { MS, noua, avanseaza, muta, vedere };
  }

  globalThis.GeamanModel = { RUNDE, CAT, MAX, MS, NIVELE_BOT, marca, rngDin, creeaza, camera };
})();
