// Startul live: o cursă în doi, în același moment, fiecare pe telefonul lui, cu
// mașinile din garaj (din aceeași clasă). Serverul ține camera: alegerea mașinilor,
// ora la care se aprind luminile (aceeași pe ambele telefoane) și rezultatul, pe
// care îl reface din apăsările fiecăruia (drag-model.js), ca la dueluri. Mașina
// celuilalt se vede pe pistă din apăsările lui, trimise pe loc prin Realtime, dar
// rezultatul nu depinde de ele: îl socotește serverul. Se încarcă și ca script
// (window.StartulLive), și ca modul. Are nevoie de DragModel, încărcat înainte.
(() => {
  'use strict';

  // alegerea mașinii, numărătoarea până la lumini, cât poate dura cursa
  const MS = { alege: 60000, numaratoare: 4000, cursa: 60000 };

  function creeaza(cars) {
    const M = globalThis.DragModel;
    const MD = M.creeaza(cars);

    function noua(rng, acum, primul = 0, optiuni = {}) {
      const clasa = Number.isInteger(optiuni.clasa) && optiuni.clasa >= 0 && optiuni.clasa <= 4 ? optiuni.clasa : 0;
      return {
        faza: 'alege', termen: acum + MS.alege, clasa, primul,
        masini: [null, null], nivele: [0, 0], startLa: null, tine: null,
        curse: [null, null], rezultat: null, rng: Math.floor(rng() * 1e9),
      };
    }

    function final(s) {
      const t = s.curse.map(c => (c && !c.fals && c.timp != null ? c.timp : null));
      let win;
      if (s.masini[0] == null || s.masini[1] == null) win = -1;          // n-a ales unul: miza înapoi
      else if (t[0] == null && t[1] == null) win = -1;
      else if (t[0] == null) win = 1;
      else if (t[1] == null) win = 0;
      else win = t[0] === t[1] ? -1 : t[0] < t[1] ? 0 : 1;
      s.rezultat = { timpi: t, falsuri: s.curse.map(c => !!(c && c.fals)), win };
      s.faza = 'final';
      s.termen = null;
    }

    function avanseaza(s, acum) {
      if (s.termen == null || s.termen > acum) return false;
      // alegerea a expirat sau cursa nu s-a mai terminat: ce lipsește e pierdut
      final(s);
      return true;
    }

    const intregi = (a, max) => Array.isArray(a) && a.length <= max && a.every(x => Number.isInteger(x) && x >= 0 && x <= 60000);
    const crescator = (a, strict) => a.every((x, i) => i === 0 || (strict ? x > a[i - 1] : x >= a[i - 1]));

    // `m.nivel` îl pune serverul din garaj (nu se ia de la telefon).
    function muta(s, p, m, acum) {
      if (m.tip === 'masina') {
        if (s.faza !== 'alege') return 'faza';
        const car = MD.dupaCheie(m.masina);
        if (!car || !Number.isInteger(m.nivel)) return 'masina';
        if (M.clasa(car, m.nivel) !== s.clasa) return 'clasa';
        s.masini[p] = M.cheieMasina(car);
        s.nivele[p] = m.nivel;
        if (s.masini[0] && s.masini[1]) {
          s.faza = 'cursa';
          s.startLa = acum + MS.numaratoare;
          // după a cincea lumină, aceeași pauză pe ambele telefoane
          s.tine = M.BLOCARE + 500 + (s.rng % 2300);
          s.termen = s.startLa + s.tine + MS.cursa;
        }
        return null;
      }
      if (m.tip === 'cursa') {
        if (s.faza !== 'cursa') return 'faza';
        if (s.curse[p]) return 'trimisa';
        if (m.fals === true) { s.curse[p] = { fals: true }; }
        else {
          const apasari = m.apasari, tur = m.tur || [];
          if (!intregi(apasari, 8) || apasari.length < 2 || !crescator(apasari, true)) return 'apasari';
          if (!intregi(tur, 400) || !crescator(tur, false) || tur.some(x => x > M.BLOCARE)) return 'turatie';
          if (apasari[0] < 100) return 'reactie';
          const c = M.refa(MD.dupaCheie(s.masini[p]), apasari, tur, s.nivele[p]);
          if (c.fin == null || !Number.isFinite(c.fin)) return 'cursa';
          s.curse[p] = { timp: Math.round(c.fin), apasari, tur };
        }
        if (s.curse[0] && s.curse[1]) final(s);
        return null;
      }
      return 'mutare';
    }

    function vedere(s) {
      const v = JSON.parse(JSON.stringify(s));
      delete v.rng;
      // apăsările nu pleacă la celălalt prin server (le vede live pe pistă), doar timpul
      v.curse = s.curse.map(c => (c ? { timp: c.timp ?? null, fals: !!c.fals } : null));
      return v;
    }

    return { MD, MS, noua, avanseaza, muta, vedere };
  }

  globalThis.StartulLive = { MS, creeaza };
})();
