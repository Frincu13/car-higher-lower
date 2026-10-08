// Sus sau jos și În ordine pe rând, într-o cameră online: același șir de mașini,
// fiecare răspunde la tura lui (10 secunde), iar cine greșește primul (sau rămâne
// fără timp) pierde. Șirul vine dintr-un seed ținut pe server; fiecare vede doar
// tura de acum. Mașinile și răspunsul corect le dau aceleași modele ca jocul
// (sus-model.js, ordine-model.js), deci serverul verifică singur fiecare răspuns.
// Se încarcă și ca script (window.RandModel), și ca modul. Are nevoie de SusModel
// și OrdineModel, încărcate înainte.
(() => {
  'use strict';

  const MS = { intro: 4000, tura: 10000, pauza: 1600 };

  // Partea comună: ture, termene, cine pierde.
  function joc({ start, raspunde, vedereTura }) {
    function noua(rng, acum, primul = 0, optiuni = {}) {
      const s = { faza: 'intro', termen: acum + MS.intro, primul, randul: primul, scor: [0, 0], raspunsuri: [], ultim: null, rezultat: null, seed: Math.floor(rng() * 2 ** 31) };
      start(s, optiuni);
      return s;
    }
    function pierde(s, p) {
      s.rezultat = { pierde: p, win: 1 - p, scor: s.scor.slice() };
      s.faza = 'final';
      s.termen = null;
    }
    function avanseaza(s, acum) {
      let schimbat = false;
      for (let pasi = 0; s.termen != null && s.termen <= acum && pasi < 20; pasi++) {
        const t = s.termen;
        schimbat = true;
        if (s.faza === 'intro') { s.faza = 'tura'; s.termen = t + MS.tura; }
        else if (s.faza === 'tura') { s.ultim = { p: s.randul, raspuns: null, corect: false, timp: true }; pierde(s, s.randul); }
        else s.termen = null;
      }
      return schimbat;
    }
    function muta(s, p, m, acum) {
      if (s.faza !== 'tura' || s.randul !== p) return 'tura';
      const r = raspunde(s, m.raspuns);
      if (r == null) return 'raspuns';
      s.raspunsuri.push(m.raspuns);
      s.ultim = { p, raspuns: m.raspuns, corect: r.corect, ...r.info };
      if (!r.corect) { pierde(s, p); return null; }
      s.scor[p]++;
      s.randul = 1 - p;
      s.termen = acum + MS.tura + MS.pauza;   // o clipă să se vadă răspunsul
      return null;
    }
    function vedere(s) {
      const v = { faza: s.faza, termen: s.termen, primul: s.primul, randul: s.randul, scor: s.scor, ultim: s.ultim, rezultat: s.rezultat, n: s.raspunsuri.length };
      Object.assign(v, vedereTura(s));
      return v;
    }
    return { MS, noua, avanseaza, muta, vedere };
  }

  // ---------- Sus sau jos ----------
  // O pereche: mașina din stânga (cu valoarea la vedere) și cea din dreapta.
  function sus(cars) {
    const SM = globalThis.SusModel;
    const MODURI = [SM.MIX, ...SM.CAT_KEYS];
    // Șirul de acum, refăcut din seed și din răspunsurile de până acum (toate corecte).
    function pozitie(s) {
      const g = SM.joc({ cars, rng: SM.rngDin(s.seed), mod: s.mod });
      let { cat, left, right } = g.prima();
      for (let i = 0; i < s.raspunsuri.length; i++) {
        const n = g.urmatoarea(right, i + 1);
        left = right; cat = n.cat; right = n.right;
        g.foloseste(right);
      }
      return { cat, left, right };
    }
    const api = joc({
      start: (s, o) => { s.mod = MODURI.includes(o.mod) ? o.mod : SM.MIX; },
      raspunde: (s, r) => {
        if (r !== 'u' && r !== 'd') return null;
        const { cat, left, right } = pozitie(s);
        return { corect: SM.corect(cat, left, right, r === 'u' ? 'up' : 'down'), info: { cat, stanga: left.id, dreapta: right.id, valoare: right[cat] } };
      },
      vedereTura: s => {
        if (s.faza === 'final') return { mod: s.mod };
        const { cat, left, right } = pozitie(s);
        return { mod: s.mod, cat, stanga: left.id, dreapta: right.id };
      },
    });
    return api;
  }

  // ---------- În ordine ----------
  // Lista crește la fiecare răspuns corect; cel de la rând pune mașina nouă la locul ei.
  function ordine(cars) {
    const OM = globalThis.OrdineModel;
    const cu = cars.filter(c => c.image);
    function pozitie(s) {
      const g = OM.joc({ cars: cu, rng: OM.rngDin(s.seed), cat: s.cat });
      const lista = g.start();
      let noua = g.urmatoarea(lista);
      for (const k of s.raspunsuri) { lista.splice(k, 0, noua); noua = g.urmatoarea(lista); }
      return { g, lista, noua };
    }
    return joc({
      start: (s, o) => { s.cat = OM.CAT_KEYS.includes(o.cat) ? o.cat : OM.CAT_KEYS[Math.floor((s.seed % 997) % OM.CAT_KEYS.length)]; },
      raspunde: (s, k) => {
        if (!Number.isInteger(k) || k < 0) return null;
        const { g, lista, noua } = pozitie(s);
        if (k > lista.length) return null;
        return { corect: g.corect(lista, k, noua), info: { masina: noua.id, loc: k, corect_la: g.locCorect(lista, noua) } };
      },
      vedereTura: s => {
        const { lista, noua } = pozitie(s);
        return { cat: s.cat, lista: lista.map(c => c.id), noua: s.faza === 'final' ? null : noua.id };
      },
    });
  }

  globalThis.RandModel = { MS, sus, ordine };
})();
