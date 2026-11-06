// Modelul Cursei: cum merge fiecare mașină pe circuit, din datele ei reale (cai putere,
// greutate, 0-100, viteză maximă, note de ținută și frânare) plus tuningul din garaj.
// Fără DOM: îl folosește pagina Cursei, iar mai târziu și serverul (premii, clasamente).
(function (root) {
  'use strict';
  const PAS_SIM = 0.01;

  // ---------- circuitul: puncte de control → o linie la ~2 m, cu direcție și curbură ----------
  function circuit(P) {
    const raw = [], n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
      for (let k = 0; k < 40; k++) {
        const t = k / 40, t2 = t * t, t3 = t2 * t;
        const f = (A, B, C, D) => .5 * (2 * B + (-A + C) * t + (2 * A - 5 * B + 4 * C - D) * t2 + (-A + 3 * B - 3 * C + D) * t3);
        raw.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]);
      }
    }
    const m = raw.length, cum = [0];
    for (let i = 1; i <= m; i++) { const a = raw[i - 1], b = raw[i % m]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const N = Math.round(cum[m] / 2), step = cum[m] / N, L = cum[m];
    const x = new Float64Array(N), y = new Float64Array(N); let j = 0;
    for (let s = 0; s < N; s++) {
      const dd = s * step; while (cum[j + 1] < dd) j++;
      const a = raw[j], b = raw[(j + 1) % m], u = (dd - cum[j]) / (cum[j + 1] - cum[j]);
      x[s] = a[0] + (b[0] - a[0]) * u; y[s] = a[1] + (b[1] - a[1]) * u;
    }
    const h = new Float64Array(N); for (let s = 0; s < N; s++) { const a = (s - 1 + N) % N, b = (s + 1) % N; h[s] = Math.atan2(y[b] - y[a], x[b] - x[a]); }
    const k = new Float64Array(N), W = 4;
    for (let s = 0; s < N; s++) { let d = h[(s + W) % N] - h[(s - W + N) % N]; d = Math.atan2(Math.sin(d), Math.cos(d)); k[s] = d / (2 * W * step); }
    // linia de start: spre capătul celei mai lungi drepte (raza mare pe sute de metri)
    const drept = Float64Array.from(k, v => Math.abs(v) < .004 ? 1 : 0);
    let best = 0, bi = 0, run = 0;
    for (let s = 0; s < 2 * N; s++) { if (drept[s % N]) { run++; if (run > best) { best = run; bi = s % N; } } else run = 0; }
    const s0 = (bi - Math.floor(best * .65) + N) % N, rot = a => { const r = new Float64Array(N); for (let s = 0; s < N; s++) r[s] = a[(s + s0) % N]; return r; };
    return { X: rot(x), Y: rot(y), Hd: rot(h), K: rot(k), N, step, L };
  }

  // ---------- statsurile de bază ale unei mașini ----------
  const g = c => c.grades || {};
  function baza(c) {
    const kg = c.weight || 1450, hp = c.hp || 150;
    // fără viteză maximă în date: din putere și rezistența aerului (o caroserie obișnuită)
    const vmaxKmh = g(c).kmh || c.topSpeed || Math.cbrt(2 * hp * 745.7 * .8 / (1.2 * .62)) * 3.6 * .95;
    const t100 = c.accel != null ? c.accel : c.accelEst != null ? c.accelEst : Math.max(2.4, 3 + 60 * kg / hp / 100);
    return { kg, hp, vmax: vmaxKmh / 3.6, t100, tinere: g(c).handling != null ? g(c).handling : 5, frana: g(c).braking != null ? g(c).braking : 5 };
  }

  // ---------- tuningul: 5 piese, 0-5 fiecare, în același număr ca în garaj ----------
  // nivel = a + 6u + 36m + 216c + 1296n (Anvelope, Ușurare, Motor, Cutie, Nitro)
  const PIESE = ['Anvelope', 'Ușurare', 'Motor', 'Cutie', 'Nitro'];
  const piese = nivel => { const n = Math.max(0, Math.floor(Number(nivel) || 0)); return [1, 6, 36, 216, 1296].map(p => Math.min(5, Math.floor(n / p) % 6)); };
  const codPiese = p => p.reduce((s, x, i) => s + (x || 0) * 6 ** i, 0);
  // Nitro nu schimbă viteza pe tur (nici scorul): e pentru dueluri. În secunde reale, pe nivel:
  // butelia ține 0,14 s mai mult (1,4 s stoc) și se reumple cu 2 s mai repede (25 s stoc);
  // la nivelul 5, a treia butelie.
  const nitro = n => ({ durata: 1.4 + .14 * n, reumple: 25 - 2 * n, butelii: n >= 5 ? 3 : 2 });
  // Ce face fiecare piesă în Cursă (pe nivel):
  //   Anvelope: +3% aderență în viraje, +3% frânare, fereastra frânei +5% mai lată
  //   Ușurare:  −2,5% greutate (accelerează mai tare, frânează și virează puțin mai bine)
  //   Motor:    +6% putere (accelerație și viteză maximă)
  //   Cutie:    +5% aderență la plecare și +2% putere folosită (ieșirea din virajele lente)
  const EFECT = { aderenta: .03, frana: .03, fereastra: .05, greutate: .025, putere: .06, cutie: .05, cutiePutere: .02 };

  // accelerația la viteza v: limitată de aderență la plecare, de putere mai sus, zero la viteza maximă
  const acc = (p, v) => Math.min(p.aGrip, p.pw / Math.max(v, 3)) - (p.pw / p.vmax) * (v / p.vmax) ** 2;
  // 0-100 simulat, ca să potrivim aderența la plecare cu 0-100 real al mașinii
  function t100Sim(p) { let v = 0, t = 0; while (v < 27.78 && t < 30) { const a = acc(p, v); if (a <= 0) return 99; v += a * PAS_SIM; t += PAS_SIM; } return t; }

  const cache = new Map();
  function parametri(c, nivel = 0) {
    const cheie = `${c.name}|${c.years}|${nivel}`;
    if (cache.has(cheie)) return cache.get(cheie);
    const b = baza(c), [a, u, m, cu, ni] = piese(nivel);
    const kgStoc = b.kg, kg = b.kg * (1 - EFECT.greutate * u), hp = b.hp * (1 + EFECT.putere * m);
    const pw = hp * 745.7 * .8 * (1 + EFECT.cutiePutere * cu) / kg, vmax = b.vmax * Math.cbrt(hp / b.hp);
    // aderența la plecare (stoc) potrivită ca mașina să facă exact 0-100 din date
    const pS = { pw: b.hp * 745.7 * .8 / kgStoc, vmax: b.vmax, aGrip: 0 };
    let lo = 2, hi = 16; for (let i = 0; i < 24; i++) { pS.aGrip = (lo + hi) / 2; if (t100Sim(pS) > b.t100) lo = pS.aGrip; else hi = pS.aGrip; }
    const aGrip = pS.aGrip * (1 + EFECT.cutie * cu) * (kgStoc / kg) ** .5;
    const p = {
      vmax, pw, aGrip, kg, hp,
      alat: (10.5 + .85 * b.tinere) * (1 + EFECT.aderenta * a + .004 * u),
      abr: (8 + .7 * b.frana) * (1 + EFECT.frana * a + .01 * u),
      fereastra: 1 + EFECT.fereastra * a,
      nitro: nitro(ni),
      piese: [a, u, m, cu, ni], baza: b,
    };
    cache.set(cheie, p);
    return p;
  }

  // ---------- viteza ideală în fiecare punct al circuitului ----------
  function profil(p, C, f = 1) {
    const { K, N, step } = C, al = p.alat * f, v = Float64Array.from(K, k => Math.min(p.vmax, Math.sqrt(al / Math.max(Math.abs(k), 1e-6))));
    for (let r = 0; r < 3; r++) {
      for (let s = 1; s <= N; s++) { const i = s % N, q = s - 1; v[i] = Math.min(v[i], Math.sqrt(Math.max(0, v[q] * v[q] + 2 * Math.max(.05, acc(p, v[q])) * step))); }
      for (let s = N - 1; s >= 0; s--) { const nx = (s + 1) % N; v[s] = Math.min(v[s], Math.sqrt(v[nx] * v[nx] + 2 * p.abr * step)); }
    }
    return v;
  }
  const timpTur = (p, C) => { const v = profil(p, C); let t = 0; for (let s = 0; s < C.N; s++) t += C.step / v[s]; return t; };

  // ---------- scorul de circuit (100-999) și clasa ----------
  // Din timpul pe tur pe circuitul de referință. T_REPEDE/T_INCET se potrivesc o dată pe toate
  // mașinile (vezi tools/cursa-calibrare.mjs).
  let T_REPEDE = 55.44, T_INCET = 83.2;
  const seteazaReper = (rapid, incet) => { T_REPEDE = rapid; T_INCET = incet; };
  const scorDinTimp = t => Math.round(Math.max(100, Math.min(999, 100 + 899 * (T_INCET - t) / (T_INCET - T_REPEDE))));
  // fiecare clasă are cam o cincime din mașini (stoc)
  const CLASE = [['S', 782], ['A', 669], ['B', 590], ['C', 501], ['D', 0]];
  const clasa = scor => CLASE.find(([, min]) => scor >= min)[0];

  // Circuitul de referință (Serpentine): pe el se calculează scorul fiecărei mașini.
  const REFERINTA = [[0,0],[650,0],[760,50],[760,160],[660,210],[520,200],[430,250],[440,360],[560,410],[780,420],[880,500],[860,630],[740,680],[420,680],[180,640],[70,540],[100,410],[20,300],[-90,240],[-160,140],[-130,40]].map(p => [p[0] * .7, p[1] * .7]);
  let circRef = null;
  // Scorul unei mașini (cu tuning): din tabelul calculat dinainte pentru mașinile stoc
  // (data/cursa-scoruri.js, refăcut de tools/cursa-calibrare.mjs), altfel calculat pe loc.
  function scor(c, nivel = 0) {
    const tab = root.CURSA_SCORURI, k = `${c.name}|${c.years}`;
    let v = !Number(nivel) && tab ? tab[k] : undefined;
    if (v == null) v = scorDinTimp(timpTur(parametri(c, nivel), circRef || (circRef = circuit(REFERINTA))));
    const cl = clasa(v);
    return { v, clasa: cl, k: 'DCBAS'.indexOf(cl) };
  }
  const API = { REFERINTA, scor, circuit, baza, parametri, profil, timpTur, acc, piese, codPiese, nitro, PIESE, EFECT, scorDinTimp, seteazaReper, clasa, CLASE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CursaModel = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
