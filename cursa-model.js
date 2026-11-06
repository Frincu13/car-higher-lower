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
  // Nitro nu intră în scor (scorul e mașina pe un tur fără boost). Rezervorul are 3 celule de
  // bază + una pe fiecare nivel; o celulă ține o secundă (reală); se umple din frânări.
  const nitro = n => ({ celule: 3 + n, baza: 3, celula: 1 });
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
  // ---------- pista Cursei: drepte, frânări și turul lansat (aceleași pe telefon și pe server) ----------
  // VIT: secunde de cursă pe secundă reală. DT: pasul fix al simulării (secunde de cursă), ca un
  // tur să iasă la fel oriunde e refăcut din apăsări.
  const VIT = 2.2, ANUNT = 2.5, DUPA = .5, UZ = .0042, DT = 1 / 60;
  const RITM = { atac: { pf: 1.022, uz: 2.3 }, apara: { pf: .992, uz: 1.1 }, normal: { pf: 1, uz: 1 } };
  const SINGUR = { sc: 0, qf: 1, txt: '' };
  // Nota frânării, din cât de departe de mijlocul ferestrei ai apăsat (e, în secunde reale):
  // 100% în mijloc, scade lin spre margini; în afara ferestrei pierzi timp, mai mult dacă e târziu.
  function nota(e, fer) {
    const a = Math.abs(e);
    if (a <= fer) { const sc = 1 - a / fer; return { sc, qf: 1 + .05 * sc, txt: sc >= .9 ? 'Perfect' : sc >= .6 ? 'Foarte bine' : sc >= .3 ? 'Bine' : 'La limită' }; }
    const peste = Math.min(1, (a - fer) / .4);
    return e < 0 ? { sc: 0, qf: 1 - .04 * peste, txt: 'Devreme' } : { sc: 0, qf: 1 - .08 * peste, txt: 'Târziu · larg' };
  }
  // rezervorul de nitro se umple din frânări: perfectă = o celulă întreagă, medie = jumătate, ratată = nimic
  const umple = (c, sc) => { const f = Math.max(0, Math.min(1, (sc - .2) / .7)); if (f) c.nitro = Math.min(c.p.nitro.celule, c.nitro + f); return f; };

  let pistaCache = null;
  // `ref`: mașina de mijloc cu care se măsoară panourile (BMW M3 1997)
  function pista(ref) {
    if (pistaCache) return pistaCache;
    const CIRC = circRef || (circRef = circuit(REFERINTA)), { K, N, step, L } = CIRC;
    // viteza „a pistei” (nu a unei mașini): ce e dreaptă și ce e viraj
    const VTOP = 72, ALAT = 17;
    const VC = Float64Array.from(K, k => Math.min(VTOP, Math.sqrt(ALAT / Math.max(Math.abs(k), 1e-6))));
    const idx = s => Math.floor((((s / step) % N) + N) % N) % N;
    const DREAPTA = s => VC[idx(s)] >= VTOP * .98 && VC[idx(s + 50)] >= VTOP * .98;
    const REF = profil(parametri(ref, 0), CIRC);
    // Frânările mari: unde viteza ideală scade mult înainte de viraj. Acolo stă panoul.
    const FRANARI = [];
    for (let s = 1; s < N - 1; s++) {
      if (!(REF[s] <= REF[s - 1] && REF[s] < REF[s + 1])) continue;
      let b = s; while (b > 0 && REF[b - 1] >= REF[b]) b--;
      const vb = REF[b], va = REF[s];
      if ((vb - va) * 3.6 < 45) continue;
      let e = s; while (e < N - 1 && REF[e] < va + .6 * (vb - va)) e++;
      FRANARI.push({ sB: b * step, sA: s * step, sE: e * step, n: FRANARI.length + 1 });
    }
    // Virajele prea apropiate ca să apuci butonul de două ori devin un singur moment („V3+V4”);
    // fiecare grup are fereastra lui: mai lată la frânările ușoare, mai îngustă la cele grele.
    const secReal = (a, b) => { let t = 0; for (let s = Math.floor(a / step); s < Math.floor(b / step); s++) t += step / Math.max(REF[s % N], 1); return t / VIT; };
    const GRUPURI = [];
    for (const F of FRANARI) {
      const g = GRUPURI[GRUPURI.length - 1];
      if (g && secReal(g.sE, F.sB) < ANUNT + DUPA + .3) { g.sE = F.sE; g.membri.push(F.n); continue; }
      const cadere = (REF[Math.floor(F.sB / step)] - REF[Math.floor(F.sA / step)]) * 3.6;
      GRUPURI.push({ sB: F.sB, sE: F.sE, membri: [F.n], fer: Math.max(.2, Math.min(.36, .44 - cadere / 700)) });
    }
    GRUPURI.forEach((g, i) => { g.n = i + 1; g.eticheta = g.membri.map(m => 'V' + m).join('+'); });
    const ZONA = sl => GRUPURI.find(G => sl >= G.sB && sl <= G.sE) || null;
    // Fereastra unei mașini la un grup: mai îngustă cu cât intră mai repede, mai lată cu cât ține
    // mai bine în viraje și cu anvelope tunate.
    const ferMasina = (c, G) => G.fer * c.p.fereastra * Math.max(.55, Math.min(1.35, (.85 + .06 * (c.p.baza.tinere - 6)) * Math.pow(55 / Math.max(c.prof[idx(G.sB)], 20), .7)));
    const masina = (car, nivel) => { const p = parametri(car, nivel); return { car, nivel, p, prof: profil(p, CIRC) }; };
    // starea unei mașini la începutul turului lansat (pornește cu 150 m înainte de linie)
    const stareSolo = (d, extra) => ({ ...d, s: -150, v: d.prof[idx(-150)], ritm: 'atac', mod: { k: 'agresiv' }, tyre: 1, nitro: d.p.nitro.celule, nOn: false, tine: false, nT: 0, pit: 0, cere: false, fin: null, tura: 0, q: {}, qf: 1, qq: SINGUR, t0: null, sect: [], lansat: true, penal: 0, k: 0, st: { dr: 0, vir: 0, pit: 0, bloc: 0, uz: 0, start: 0, scor: 0, franari: 0 }, ...extra });
    // Un pas al unei mașini singure pe pistă (turul lansat). `notaBot`: cum frânează un bot
    // (pe telefon); mașina jucătorului primește frânările din apăsări.
    function pasSolo(c, t, dt, notaBot) {
      c.k++;
      if (c.fin !== null) { c.v = Math.max(18, c.v - 6 * dt); c.s += c.v * dt; return; }
      if (c.s < 0) c.st.start += dt;
      const dr = DREAPTA(c.s), sl = ((c.s % L) + L) % L, Z = c.s >= 0 ? ZONA(sl) : null;
      if (Z) {
        const cheie = `${Math.floor(c.s / L)}-${Z.n}`;
        if (!(cheie in c.q) && notaBot) { c.q[cheie] = notaBot(c, Z); c.st.franari++; c.st.scor += c.q[cheie].sc; umple(c, c.q[cheie].sc); }
        c.qq = c.q[cheie] || SINGUR; c.qf = c.qq.qf;
      } else { c.qq = SINGUR; c.qf = 1; }
      const R = c.ritm === 'atac' ? RITM.atac : RITM.normal;
      c.mod = { k: c.ritm === 'atac' ? 'agresiv' : 'normal', pf: R.pf, uz: R.uz };
      c.nOn = c.nitro > 0 && (c.eu ? c.tine : c.nT > 0);
      if (c.nOn) c.nitro = Math.max(0, c.nitro - dt / (c.p.nitro.celula * VIT));
      const i = idx(c.s), tf = .9 + .1 * c.tyre;
      const pot = c.prof[i] * R.pf * tf * c.qf * (dr && c.nOn ? 1.09 : 1);
      c.v += pot > c.v ? Math.min(pot - c.v, Math.max(.4, acc(c.p, c.v)) * (c.nOn ? (dr ? 1.4 : 1.15) : 1) * dt) : Math.max(pot - c.v, -c.p.abr * 1.3 * dt);
      const s1 = c.s; c.s += c.v * dt;
      if (c.t0 === null && c.s >= 0) c.t0 = t - c.s / Math.max(c.v, 1);
      if (c.t0 !== null && c.sect.length < 2 && c.s >= (c.sect.length + 1) * L / 3) c.sect.push(t - c.t0);
      if (c.s > 0) { if (dr) c.st.dr += dt; else c.st.vir += dt; c.st.uz += dt * (1 - tf); }
      c.tyre = Math.max(0, c.tyre - UZ * R.uz * dt * (c.v / 50));
      c.nT = Math.max(0, c.nT - dt);
      if (Math.floor(c.s / L) > Math.floor(s1 / L) && c.s > 0) { c.tura = Math.floor(c.s / L); if (c.s >= L) c.fin = t + c.penal; }
    }
    // O frânare apăsată la pasul curent: `e` (secunde reale față de mijlocul ferestrei), rotunjit
    // la 0,1 ms, ca telefonul și serverul să socotească aceeași notă.
    function frana(c, cheie, e) {
      const n = /^0-(\d+)$/.exec(cheie), G = n && GRUPURI[+n[1] - 1];
      if (!G || cheie in c.q || !Number.isFinite(e) || Math.abs(e) > 5) return null;
      const r = nota(Math.round(e * 1e4) / 1e4, ferMasina(c, G));
      c.q[cheie] = r; c.st.franari++; c.st.scor += r.sc; umple(c, r.sc);
      return r;
    }
    // Turul lansat refăcut din apăsări: `f` = [[pas, cheie, e], ...] (frânările), `n` = pașii la
    // care s-a apăsat sau s-a lăsat nitro. Întoarce timpul (secunde de cursă) sau null.
    function refaTur(car, nivel, intr) {
      const f = intr && Array.isArray(intr.f) ? intr.f : [], n = intr && Array.isArray(intr.n) ? intr.n : [];
      if (f.length > GRUPURI.length || n.length > 2000) return null;
      if (!f.every(x => Array.isArray(x) && x.length === 3 && Number.isInteger(x[0]) && typeof x[1] === 'string')) return null;
      if (!n.every((x, i) => Number.isInteger(x) && x >= 0 && (i === 0 || x >= n[i - 1]))) return null;
      const c = stareSolo(masina(car, nivel), { eu: 1 });
      let t = 0, fi = 0, ni = 0;
      const fr = f.slice().sort((a, b) => a[0] - b[0]), laPanou = {};
      while (c.fin === null && c.k < 60 * 300) {
        while (fi < fr.length && fr[fi][0] <= c.k) { const [, cheie, e] = fr[fi++]; if (!frana(c, cheie, e)) return null; }
        while (ni < n.length && n[ni] <= c.k) { c.tine = !c.tine; ni++; }
        for (const G of GRUPURI) if (!(G.n in laPanou) && c.s >= G.sB) laPanou[G.n] = c.k;
        t += DT; pasSolo(c, t, DT, null);
      }
      if (c.fin === null) return null;
      // cât de departe e fiecare `e` de momentul în care mașina chiar a trecut de panou (pe
      // telefon, sub 0,02 s): serverul respinge turul dacă e prea mare
      const abatere = fr.reduce((m, [k, cheie, e]) => { const g = +cheie.slice(2); return Math.max(m, g in laPanou ? Math.abs(e - (k - laPanou[g]) * DT / VIT) : 99); }, 0);
      return { timp: c.fin - c.t0, sect: c.sect.slice(), franari: c.st.franari, scor: c.st.scor, abatere };
    }
    pistaCache = { CIRC, VTOP, VC, idx, DREAPTA, FRANARI, GRUPURI, ZONA, ferMasina, masina, stareSolo, pasSolo, frana, refaTur, REF };
    return pistaCache;
  }

  const API = { REFERINTA, scor, circuit, baza, parametri, profil, timpTur, acc, piese, codPiese, nitro, PIESE, EFECT, scorDinTimp, seteazaReper, clasa, CLASE, pista, nota, umple, SINGUR, RITM, VIT, ANUNT, DUPA, UZ, DT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CursaModel = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
