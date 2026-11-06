// Cursa: prototipul de cursă în stil manager. Pista se vede de sus, mașinile sunt jetoane cu
// poza lor; tu alegi ritmul (Atac, Normal, Ușor), folosești nitro pe dreaptă și intri la boxe.
// Depășirile ies din ritm, mașină, anvelope, aspirație și nitro. Nu atinge garajul sau tuningul.
(() => {
const $ = i => document.getElementById(i);
// Pozele mașinilor (Wikimedia Commons), micșorate și puse aici ca jetoanele să se deseneze și fără semnal.
// ---------- circuitul (același ca în modelul Cursei, cu care se calculează scorurile) ----------
const CM = window.CursaModel;
const CIRC = CM.circuit(CM.REFERINTA);
const { X, Y, Hd, K, N, step, L } = CIRC;
// viteza „a pistei” (nu a unei mașini): ce e dreaptă și ce e viraj, pentru nitro și sfaturi
const VTOP = 72, ALAT = 17;
const VC = Float64Array.from(K, k => Math.min(VTOP, Math.sqrt(ALAT / Math.max(Math.abs(k), 1e-6))));
const idx = s => Math.floor((((s / step) % N) + N) % N) % N;
const DREAPTA = s => VC[idx(s)] >= VTOP * .98 && VC[idx(s + 50)] >= VTOP * .98;
const VIRAJ_APROAPE = s => { for (let d = 20; d < 160; d += 10) if (VC[idx(s + d)] < VTOP * .7) return true; return false; };
// ---------- mașinile, din datele lor (data/cars.js) ----------
const MASINI = (window.CARS || []).filter(c => c.image && c.hp && c.weight);
const cheieM = c => `${c.name}|${c.years}`;
const DUPA_CHEIE = new Map(MASINI.map(c => [cheieM(c), c]));
const IMPRUMUT = DUPA_CHEIE.get('BMW M3|1997') || MASINI[0];
const scorMasina = (c, nivel) => CM.scor(c, nivel).v;
// panourile și grupurile de frânare țin de pistă: le măsurăm cu o mașină de mijloc
const REF = CM.profil(CM.parametri(IMPRUMUT, 0), CIRC);
// ---------- frânările mari, cu panou pe pistă ----------
// Unde viteza ideală scade mult înainte de viraj. Acolo stă panoul: cine apasă Frână când
// ajunge la el iese mai repede din viraj; cine nu apasă frânează singur.
const FRANARI = (() => {
  const v = REF, out = [];
  for (let s = 1; s < N - 1; s++) {
    if (!(v[s] <= v[s - 1] && v[s] < v[s + 1])) continue;
    let b = s; while (b > 0 && v[b - 1] >= v[b]) b--;
    const vb = v[b], va = v[s];
    if ((vb - va) * 3.6 < 45) continue;
    let e = s; while (e < N - 1 && v[e] < va + .6 * (vb - va)) e++;
    out.push({ sB: b * step, sA: s * step, sE: e * step, n: out.length + 1 });
  }
  return out;
})();
// Virajele prea apropiate ca să apuci butonul de două ori devin un singur moment („V3+V4”):
// frânarea de la primul contează pentru tot grupul. Fiecare grup are fereastra lui: mai lată
// la frânările ușoare, mai îngustă la cele grele, și se vede dinainte pe inel.
const ANUNT = 2.5, DUPA = .5, VIT = 2.2;
const GRUPURI = (() => {
  const v = REF, secReal = (a, b) => { let t = 0; for (let s = Math.floor(a / step); s < Math.floor(b / step); s++) t += step / Math.max(v[s % N], 1); return t / VIT; };
  const out = [];
  for (const F of FRANARI) {
    const g = out[out.length - 1];
    if (g && secReal(g.sE, F.sB) < ANUNT + DUPA + .3) { g.sE = F.sE; g.membri.push(F.n); continue; }
    const cadere = (v[Math.floor(F.sB / step)] - v[Math.floor(F.sA / step)]) * 3.6;
    out.push({ sB: F.sB, sE: F.sE, membri: [F.n], fer: Math.max(.2, Math.min(.36, .44 - cadere / 700)) });
  }
  out.forEach((g, i) => { g.n = i + 1; g.eticheta = g.membri.map(m => 'V' + m).join('+'); });
  return out;
})();
const ZONA = sl => GRUPURI.find(G => sl >= G.sB && sl <= G.sE) || null;
// Nota frânării, din cât de departe de mijlocul ferestrei ai apăsat (e, în secunde reale):
// 100% în mijloc, scade lin spre margini; în afara ferestrei pierzi timp, mai mult dacă e târziu.
function nota(e, fer) {
  const a = Math.abs(e);
  if (a <= fer) { const sc = 1 - a / fer; return { sc, qf: 1 + .05 * sc, txt: sc >= .9 ? 'Perfect' : sc >= .6 ? 'Foarte bine' : sc >= .3 ? 'Bine' : 'La limită' }; }
  const peste = Math.min(1, (a - fer) / .4);
  return e < 0 ? { sc: 0, qf: 1 - .04 * peste, txt: 'Devreme' } : { sc: 0, qf: 1 - .08 * peste, txt: 'Târziu · larg' };
}
const SINGUR = { sc: 0, qf: 1, txt: '' };
// boții: o abatere la întâmplare, mai mică la cei buni; anvelopele tunate lărgesc fereastra
// Fereastra unei mașini la un grup: mai îngustă cu cât intră mai repede (mașini rapide, tuning),
// mai lată cu cât ține mai bine în viraje (nota de ținută) și cu anvelope tunate.
const ferMasina = (c, G) => G.fer * c.p.fereastra * Math.max(.55, Math.min(1.35, (.85 + .06 * (c.p.baza.tinere - 6)) * Math.pow(55 / Math.max(c.prof[idx(G.sB)], 20), .7)));
const notaBot = (c, G) => { const r = (Math.random() + Math.random() + Math.random() - 1.5) * (.5 - c.sk * .4); return nota(r, ferMasina(c, G)); };
// ---------- mașina ta: din garajul de pe telefon (ultima copie), altfel una de împrumut ----------
function garajulMeu() {
  let r = null; try { r = JSON.parse(localStorage.getItem('frq_portofel') || 'null'); } catch { /* fără stocare */ }
  const ex = (r && r.r && r.r.exemplare) || [], cel = new Map();
  for (const e of ex) { const c = DUPA_CHEIE.get(e.masina); if (c && (!cel.has(e.masina) || (e.nivel || 0) > cel.get(e.masina).nivel)) cel.set(e.masina, { c, nivel: e.nivel || 0 }); }
  if (!ex.length && r && r.r && r.r.garaj) for (const g of r.r.garaj) { const c = DUPA_CHEIE.get(g.masina); if (c) cel.set(g.masina, { c, nivel: g.nivel || 0 }); }
  return [...cel.values()].map(x => ({ ...x, scor: scorMasina(x.c, x.nivel) })).sort((a, b) => b.scor - a.scor);
}
let aleasa = null;
try { const k = localStorage.getItem('frq_cursa_masina'); const g = garajulMeu(); aleasa = g.find(x => `${cheieM(x.c)}#${x.nivel}` === k) || g[0] || null; } catch { /* fără stocare */ }
if (!aleasa) aleasa = { c: IMPRUMUT, nivel: 0, imprumut: true, scor: scorMasina(IMPRUMUT, 0) };
// ---------- adversarii: din clasa ta, cu scor apropiat ----------
const PILOTI = [['Andrei', 'AND', '#f5b82e'], ['Teo', 'TEO', '#3d7bff'], ['Ștefi', 'ȘTE', '#ff5c7a'], ['Radu', 'RAD', '#ff8a00'], ['FRQ Bot', 'BOT', '#9aa0a9'], ['Mihai', 'MIH', '#2ecc71'], ['Ioana', 'IOA', '#b57bff'], ['Vlad', 'VLA', '#e8e8e8'], ['Ana', 'ANA', '#00b3a4']];
const scorStoc = c => CM.scor(c, 0).v;
function alegeRivali(eu0) {
  const marca = c => c.name.split(' ')[0], folosite = new Set([marca(eu0.c)]), out = [];
  const pool = MASINI.filter(c => cheieM(c) !== cheieM(eu0.c)).sort(() => Math.random() - .5);
  for (const lat of [25, 45, 80, 140]) {
    for (const c of pool) { if (out.length >= 9) break; if (folosite.has(marca(c)) || Math.abs(scorStoc(c) - eu0.scor) > lat) continue; folosite.add(marca(c)); out.push(c); }
    if (out.length >= 9) break;
  }
  return out;
}
let GM = [];
const IMG = {};
function poza(c) {
  const k = cheieM(c); if (IMG[k]) return IMG[k];
  const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer'; im.src = c.image.replace(/\/\d+px-/, '/250px-');
  im.addEventListener('load', () => GM.forEach(G => { G.poz = ''; })); IMG[k] = im; return im;
}
// timpul pe drepte și în viraje al fiecărei mașini (pentru grilă și explicația de la final)
function segmente(prof) { let dr = 0, vir = 0; for (let s = 0; s < N; s++) { const t = step / prof[s]; if (VC[s] >= VTOP * .98) dr += t; else vir += t; } return { dr, vir }; }
// Ritmul se adaptează la ce e în jur: Atac atacă mașina din față când e aproape (altfel mers
// agresiv, care toacă anvelopele); Apără îi închide linia celui din spate (fără nimeni în spate, mers normal).
let TURURI = 3;
const UZ = .0042, PAS = 13, APROAPE = 40;
function ritmul(c, din, gap, spate, gs) {
  if (c.ritm === 'atac') return gap < APROAPE ? { k: 'atac', pe: din, pf: 1.022, uz: 2.3 } : { k: 'agresiv', pf: 1.022, uz: 2.3 };
  if (c.ritm === 'apara' && gs < APROAPE * .8) return { k: 'apara', pe: spate, pf: .992, uz: 1.1 };
  return { k: 'normal', pf: 1, uz: 1 };
}
let C, eu, t, pornit, gata, harta = false, pozVeche = 2;
// Ce joci: SES vine din meniu (mod: complet / calif / antren; calif: scurta / lunga);
// WK e weekendul în curs (etapele de calificare, timpii, grila); START e startul cu lumini;
// FANT e fantoma din turul solo (cel mai rapid din etapă, sau recordul tău la antrenament).
const SES = { mod: 'complet', calif: 'scurta' };
let WK = null, START = null, FANT = null, RIVALI = [];
function masinaCursa(c, nivel, pilot, extra) {
  const p = CM.parametri(c, nivel), prof = CM.profil(p, CIRC);
  return { n: pilot[0], sc: pilot[1], col: pilot[2], m: c.name, an: c.years, f: cheieM(c), car: c, nivel, p, prof, seg: segmente(prof), scor: scorMasina(c, nivel), ag: .45 + Math.random() * .2, sk: .55 + Math.random() * .25, ...extra };
}
// starea de pe pistă a unei mașini (pornește din definiția ei)
const stare = (d, i, extra) => ({ ...d, i, s: 0, v: 0, ritm: 'normal', mod: { k: 'normal' }, decT: 0, tyre: 1, nitro: d.p.nitro.butelii, nitroT: 0, nT: 0, latV: 0, puls: 0, cere: false, pit: 0, pr: 0, trece: null, latC: 0, latF: 0, latFT: 0, fin: null, tura: 0, q: {}, qf: 1, qq: SINGUR, t0: null, sect: [], lansat: true, penal: 0, st: { dr: 0, vir: 0, pit: 0, bloc: 0, uz: 0, start: 0, scor: 0, franari: 0 }, ...extra });
const definitiaMea = () => masinaCursa(aleasa.c, aleasa.nivel, ['Tu', 'TU', '#d81528'], { eu: 1 });
function pregatesteRivali() { RIVALI = alegeRivali(aleasa).map((c, i) => masinaCursa(c, 0, PILOTI[i])); }
function comun() {
  C.forEach(c => poza(c.car));
  eu = C.find(c => c.eu); t = 0; pornit = false; gata = false; pozVeche = C.indexOf(eu) + 1; setRitm(TURURI === 1 ? 'atac' : 'normal'); anuntate = 0; mom = null;
  $('fo').src = aleasa.c.image.replace(/\/\d+px-/, '/250px-');
  const [a, u, m, cu, ni] = CM.piese(aleasa.nivel);
  $('cdn').textContent = aleasa.c.name;
  $('cdi').textContent = `${aleasa.c.years} · clasa ${CM.clasa(eu.scor)} · ${eu.scor} · motor ${m}, cutie ${cu}, anvelope ${a}, ușurare ${u}, nitro ${ni}${aleasa.imprumut ? ' · de împrumut' : ''}`;
  document.body.classList.toggle('solo', TURURI === 1);
}
// cursa: 10 mașini pe grilă, câte două pe rând, oprite; pleacă la stingerea luminilor
function cursaNoua(grila) {
  TURURI = 3; FANT = null;
  C = grila.map((d, i) => stare(d, i, { s: -Math.floor(i / 2) * 20 - (i % 2) * 10 - 6, latC: i % 2 ? 4 : -4, lansat: false }));
  comun();
  START = { t0: null, out: null, apasat: null, reactie: null, penal: 0, msg: '', msgT: 0 };
}
// un tur lansat, singur pe pistă (calificare sau antrenament)
function soloNou(fantoma) {
  TURURI = 1; FANT = fantoma || null; START = null;
  const d = definitiaMea();
  C = [stare(d, 0, { s: -150, v: d.prof[idx(-150)] })];
  comun();
}
// turul unui bot, simulat pe loc cu aceeași simulare (pentru calificări și fantome)
function turSolo(d) {
  const salv = [C, eu, t, TURURI];
  TURURI = 1;
  const c = stare(d, 0, { s: -150, v: d.prof[idx(-150)], ritm: 'atac', push: true });
  C = [c]; eu = null; t = 0;
  while (c.fin === null && t < 600) pas(1 / 60);
  const r = { timp: c.fin - c.t0, urma: c.urma || [], sect: c.sect.slice(), d };
  [C, eu, t, TURURI] = salv;
  return r;
}
const ord = () => C.slice().sort((a, b) => (a.fin !== null && b.fin !== null) ? a.fin - b.fin : (b.fin !== null) - (a.fin !== null) || b.s - a.s);
// Depășirea: cele două mașini se dau pe câte o parte a pistei și rămân așa până când cea din
// spate chiar a trecut (sau a renunțat). Nimeni nu e mutat dintr-o dată.
function treci(f, l) { if (f.trece && f.trece !== l) f.trece.latFT = .5; f.trece = l; f.pr = 0; l.pr = 0; const p = l.latC >= 0 ? -1 : 1; f.latF = 4.6 * p; f.latFT = 99; l.latF = -3.6 * p; l.latFT = 99; l.v *= .985; }
function gataDepasirea(f) { const l = f.trece; f.trece = null; f.latFT = .5; if (l) l.latFT = .5; }
// ---------- simularea ----------
function pas(dt) {
  t += dt;
  const o = C.slice().sort((a, b) => b.s - a.s);
  for (let k = 0; k < o.length; k++) {
    const c = o[k];
    if (c.fin !== null) { c.v = Math.max(18, c.v - 6 * dt); c.s += c.v * dt; continue; }
    if (!c.lansat) { c.v = 0; continue; }
    if (c.s < 0) c.st.start += dt;
    if (c.pit > 0) { c.pit -= dt; c.st.pit += dt; c.v = 0; c.latC += (17 - c.latC) * Math.min(1, dt * 4); if (c.pit <= 0) { c.tyre = 1; c.v = 14; } continue; }
    const din = k > 0 ? o[k - 1] : null, spate = k < o.length - 1 ? o[k + 1] : null, gap = din && din.pit <= 0 ? din.s - c.s : 1e9, gs = spate ? c.s - spate.s : 1e9;
    const dr = DREAPTA(c.s);
    if (!c.eu) {
      const ultim = c.s > (TURURI - 1) * L;
      // boții se hotărăsc la câteva secunde, nu la fiecare pas (în turul de calificare: atac)
      c.decT -= dt;
      if (c.push) c.ritm = 'atac';
      else if (c.decT <= 0) { c.decT = 2 + Math.random() * 2; const r = Math.random(); c.ritm = c.tyre < .3 && !ultim ? 'normal' : gs < 25 && r < c.ag * .9 ? 'apara' : gap < 30 && c.tyre > .4 && r < c.ag + .15 ? 'atac' : 'normal'; }
      if (c.nT <= 0 && c.nitro > 0 && dr && (t > 10 || c.push) && (gap < 22 || gs < 14 || c.push) && Math.random() < dt * .6) { c.nitro--; c.nT = c.p.nitro.durata * VIT; }
      if (!c.cere && c.tyre < .22 && !ultim) c.cere = true;
    }
    // în zona unei frânări mari: cât de bine a frânat (tu: butonul; boții: după cât de buni sunt)
    const sl = ((c.s % L) + L) % L, Z = c.s >= 0 ? ZONA(sl) : null;
    if (Z) {
      const cheie = `${Math.floor(c.s / L)}-${Z.n}`;
      if (!(cheie in c.q) && !c.eu) { c.q[cheie] = c.eu ? SINGUR : notaBot(c, Z); c.st.franari++; c.st.scor += c.q[cheie].sc; }
      c.qq = c.q[cheie] || SINGUR; c.qf = c.qq.qf;
    } else { c.qq = SINGUR; c.qf = 1; }
    c.mod = ritmul(c, din, gap, spate, gs);
    const i = idx(c.s), pf = c.mod.pf, uz = c.mod.uz, tf = .9 + .1 * c.tyre;
    if (c.trece && (c.s > c.trece.s + PAS * .8 || c.trece.s - c.s > 30 || c.trece.pit > 0 || c.trece.fin !== null)) gataDepasirea(c);
    const pot = c.prof[i] * pf * tf * c.qf * (dr && c.nT > 0 ? 1.09 : 1) * (dr && gap < 30 ? 1.03 : 1) * (c.trece ? 1.025 : 1);
    c.v += pot > c.v ? Math.min(pot - c.v, Math.max(.4, CM.acc(c.p, c.v)) * (c.nT > 0 ? 1.4 : 1) * dt) : Math.max(pot - c.v, -c.p.abr * 1.3 * dt);
    // regula: pe dreaptă câștigă nitro; în viraje câștigă Atacul
    if (din && gap < 16 && din.fin === null) {
      const fr = c.prof[idx(c.s + 40)] < c.v * .8, dn = din.nT > 0 && DREAPTA(din.s);
      c.pr += Math.max(0, pot / Math.max(din.v, 1) - 1) * dt * 6;
      // cine îl atacă pe cel din față împinge; cel din față care se apără de el închide linia
      const ataca = c.mod.k === 'atac' && c.mod.pe === din, apara = din.mod.k === 'apara' && din.mod.pe === c;
      if (dr) c.pr += ((c.nT > 0 ? 2.2 : 0) - (dn ? 2.2 : 0) - (apara ? .7 : 0)) * dt;
      // la frânare: o frânare bună trece și de o mașină mai bună; una târzie lasă loc
      if (fr) c.pr += ((ataca ? 1.1 : 0) - (apara ? 1.5 : 0) + (c.tyre - din.tyre) * 1.5 + 2.5 * c.qq.sc - 1.6 * din.qq.sc + (din.qq.qf < .97 ? 1.6 : 0)) * dt;
      c.pr = Math.max(0, c.pr);
      if (c.pr > 1 && c.trece !== din && ((dr && c.prof[idx(c.s + 70)] > c.v * .9) || (fr && (ataca || c.qq.sc > .6 || din.qq.qf < .97)))) treci(c, din);
    } else c.pr = Math.max(0, c.pr - dt);
    let bloc = false;
    // în spatele cuiva, pe aceeași parte: ține viteza lui (și lasă puțin loc dacă e prea aproape);
    // una lângă alta nu se încurcă
    const alaturi = din && Math.abs(c.latC - din.latC) > 6.5;
    // frânează treptat până la viteza lui, nu dintr-odată (doar foarte aproape, direct)
    if (din && c.trece !== din && din.trece !== c && !alaturi && gap < PAS && din.pit <= 0) {
      if (pot > din.v * 1.01) bloc = true;
      const tinta = din.v * (gap < PAS * .6 ? .93 : 1);
      if (c.v > tinta) c.v = gap < PAS * .45 ? tinta : Math.max(tinta, c.v - 24 * dt);
    }
    let lt = (c.i % 3 - 1) * 1.4;
    // cu o mașină alături (în față sau în spate, la câțiva metri): fiecare pe partea ei;
    // cine se apără se mută pe linia celui din spate
    const vecin = o.find(x => x !== c && x.pit <= 0 && x.fin === null && Math.abs(x.s - c.s) < 10);
    if (c.latFT > 0) lt = c.latF;
    else if (vecin) lt = vecin.latC > c.latC || (vecin.latC === c.latC && vecin.i > c.i) ? -4 : 4;
    else if (c.mod.k === 'apara') lt = Math.max(-4, Math.min(4, c.mod.pe.latC));
    else if (din && gap < 18) lt = din.latC >= 0 ? -4 : 4;
    // lateral ca un arc cu amortizor: pornește și se oprește lin
    c.latV += ((lt - c.latC) * 16 - c.latV * 8) * dt;
    c.latC = Math.max(-5.2, Math.min(5.2, c.latC + c.latV * dt));
    const s1 = c.s; c.s += c.v * dt;
    if (c.t0 === null && c.s >= 0) c.t0 = t - c.s / Math.max(c.v, 1);
    if (c.t0 !== null && c.sect.length < 2 && c.s >= (c.sect.length + 1) * L / 3) c.sect.push(t - c.t0);
    // urma turului solo, la fiecare 0,1 s, pentru fantome
    if (TURURI === 1) { const u = c.urma || (c.urma = []), kk = Math.floor(t / .1); while (u.length <= kk) u.push(c.s); }
    if (c.s > 0) { if (dr) c.st.dr += dt; else c.st.vir += dt; if (bloc) c.st.bloc += dt * Math.max(0, 1 - c.v / pot); c.st.uz += dt * (1 - tf); }
    c.tyre = Math.max(0, c.tyre - UZ * uz * dt * (c.v / 50));
    c.nT = Math.max(0, c.nT - dt); c.latFT = Math.max(0, c.latFT - dt);
    // buteliile de nitro se reumplu singure, câte una
    if (c.nitro < c.p.nitro.butelii) { c.nitroT += dt; if (c.nitroT >= c.p.nitro.reumple * VIT) { c.nitro++; c.nitroT = 0; } } else c.nitroT = 0;
    if (Math.floor(c.s / L) > Math.floor(s1 / L) && c.s > 0) {
      c.tura = Math.floor(c.s / L);
      if (c.s >= TURURI * L) c.fin = t + c.penal;
      else if (c.cere) { c.cere = false; c.pit = 3.2; }
    }
  }
  // nimeni nu rămâne pe o parte după o depășire care s-a terminat
  for (const c of C) if (c.latFT > 50 && !c.trece && !C.some(x => x.trece === c)) c.latFT = .5;
  // două mașini prea aproape, pe aceeași linie: se depărtează lin în lateral (fără salturi)
  const pe = C.filter(c => c.pit <= 0 && c.fin === null);
  for (const a of pe) for (const b of pe) {
    if (a.i >= b.i || Math.abs(a.s - b.s) > 9) continue;
    const dl = a.latC - b.latC; if (Math.abs(dl) >= 6.5) continue;
    const imp = (6.5 - Math.abs(dl)) * 10 * dt * (dl >= 0 ? 1 : -1);
    a.latV += imp; b.latV -= imp;
  }
}
// ---------- comenzile ----------
function setRitm(r) { if (eu) eu.ritm = r; document.querySelectorAll('#ct .rt').forEach(b => b.classList.toggle('on', b.dataset.r === r)); }
document.querySelectorAll('#ct .rt').forEach(b => b.addEventListener('click', () => setRitm(b.dataset.r)));
$('nb').addEventListener('click', () => { if (!pornit || eu.nT > 0 || eu.nitro <= 0 || !DREAPTA(eu.s)) return; eu.nitro--; eu.nT = eu.p.nitro.durata * VIT; });
$('px').addEventListener('click', () => { if (pornit && eu.pit <= 0 && eu.fin === null && eu.tura < TURURI - 1 + (eu.s < (TURURI - 1) * L ? 1 : 0)) eu.cere = true; });
$('pxx').addEventListener('click', () => { eu.cere = false; });
// Frâna: grupul de viraje următor. Momentul pornește cu ANUNT secunde înainte de panou și
// merge după ceasul tău (secunde reale): punctul de pe inel face un tur întreg în ANUNT + DUPA
// secunde, iar fereastra verde (cu mijlocul ei) se vede de la început.
let anuntate = 0, mom = null, ceas = 0;
function secPana(d) {
  const i0 = idx(eu.s), r = Math.max(.6, Math.min(1.05, eu.v / Math.max(eu.prof[i0], 1))); let t = 0;
  for (let k = 0; k * step < d; k++) t += step / Math.max(5, eu.prof[(i0 + k) % N] * r);
  return t / VIT;
}
function grupUrmator() {
  if (!eu || eu.s < 0 || eu.fin !== null || eu.pit > 0) return null;
  const sl = ((eu.s % L) + L) % L, tura = Math.floor(eu.s / L);
  for (const [G, tr] of [...GRUPURI.map(G => [G, tura]), ...GRUPURI.map(G => [G, tura + 1])]) {
    const d = G.sB - sl + (tr - tura) * L;
    if (d > -60 && tr < TURURI) return { G, cheie: `${tr}-${G.n}`, d, sec: d > 0 ? secPana(d) : d / Math.max(eu.v, 10) / VIT };
  }
  return null;
}
function franeaza() {
  if (!pornit || !mom || mom.rez || mom.cheie in eu.q) return;
  const r = nota(mom.e, mom.fer);
  eu.q[mom.cheie] = r; eu.st.franari++; eu.st.scor += r.sc;
  mom.rez = r; mom.rezT = 1.1; eu.puls = .6;
  window.Shared && Shared.haptic(r.sc >= .6 ? 'success' : r.sc > 0 ? 'tick' : 'error');
  const fb = $('fb'); fb.classList.remove('bun', 'rau'); void fb.offsetWidth; fb.classList.add(r.sc > 0 ? 'bun' : 'rau');
}
$('fb').addEventListener('pointerdown', e => { e.preventDefault(); franeaza(); });
document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (START && eu && !eu.lansat) pleaca(); else franeaza(); } });
$('hb').addEventListener('click', () => { harta = !harta; $('hb').classList.toggle('on', harta); });
const vg = (a, b) => Math.max(0, (a.s - b.s) / Math.max(b.v, 20));
function hudSolo() {
  const timp = eu.t0 === null ? 0 : (eu.fin !== null ? eu.fin - eu.t0 : t - eu.t0);
  $('pp').textContent = fT(timp);
  const F = FANT;
  $('pf').innerHTML = eu.sect.map((x, i) => { const d = F && F.sect && F.sect[i] != null ? x - F.sect[i] : null; return `S${i + 1} <span style="color:${d == null ? '#cfd3da' : d <= 0 ? '#b57bff' : '#f5c542'}">${d == null ? fT(x) : fD(d)}</span>`; }).join(' · ') || '<span style="color:#9aa0a9">tur lansat</span>';
  $('pb').innerHTML = F ? `<i style="background:${F.d.col}"></i>${F.d.n} <span style="color:#cfd3da">${fT(F.timp)}</span>` : '';
  $('turn').textContent = WK ? WK.etape[WK.k][0] : 'Antren.';
}
const f1 = x => x.toFixed(1).replace('.', ',');
let popT = 0;
function hud(dt) {
  const o = ord(), k = o.indexOf(eu), din = k > 0 ? o[k - 1] : null, spate = o[k + 1], gap = din ? din.s - eu.s : 1e9, gs = spate ? eu.s - spate.s : 1e9;
  if (TURURI === 1) { hudSolo(); } else {
  $('pp').textContent = 'P' + (k + 1);
  $('pf').innerHTML = din ? `<i style="background:${din.col}"></i>▲ ${din.sc} <span style="color:#cfd3da">+${f1(vg(din, eu))}</span>` : '<span style="color:#2ecc71">lider</span>';
  $('pb').innerHTML = spate ? `<i style="background:${spate.col}"></i>▼ ${spate.sc} <span style="color:${gs < 16 ? '#ed1b2f' : '#cfd3da'}">${f1(vg(eu, spate))}</span>` : '';
  $('turn').textContent = `${Math.min(TURURI, Math.max(1, eu.tura + 1))}/${TURURI}`;
  }
  if (pornit && TURURI > 1 && k + 1 !== pozVeche) { const d = pozVeche - (k + 1); $('pop').textContent = (d > 0 ? '+' : '−') + Math.abs(d); $('pop').style.color = d > 0 ? '#2ecc71' : '#ed1b2f'; $('pop').classList.add('on'); popT = 1.1; pozVeche = k + 1; }
  popT -= dt; if (popT <= 0) $('pop').classList.remove('on');
  const dr = DREAPTA(eu.s), activ = pornit && eu.fin === null && eu.pit <= 0;
  const nb = $('nb'); nb.classList.toggle('act', eu.nT > 0); nb.classList.toggle('off', eu.nT <= 0 && (eu.nitro <= 0 || !dr));
  nb.classList.toggle('puls', activ && dr && eu.nitro > 0 && eu.nT <= 0 && (gap < 28 || gs < 14));
  nb.querySelectorAll('.bt i').forEach((x, i) => x.classList.toggle('ok', i < eu.nitro));
  $('nrf').style.width = eu.nitro >= eu.p.nitro.butelii ? '0%' : Math.round(eu.nitroT / (eu.p.nitro.reumple * VIT) * 100) + '%';
  const bt = nb.querySelector('.bt'); if (bt.children.length !== eu.p.nitro.butelii) bt.innerHTML = '<i></i>'.repeat(eu.p.nitro.butelii);
  // ritmul: butonul potrivit pulsează când are pe cine ataca sau de cine să te aperi
  document.querySelector('#ct [data-r=atac]').classList.toggle('puls', activ && gap < 30 && eu.ritm !== 'atac');
  document.querySelector('#ct [data-r=apara]').classList.toggle('puls', activ && gs < 22 && gap >= 30 && eu.ritm !== 'apara');
  $('vw').classList.toggle('nitro', eu.nT > 0);
  // frâna: momentul pornește cu ANUNT secunde înainte de panou
  const u = grupUrmator(), fb = $('fb'), D = ANUNT + DUPA;
  if (activ && u && !mom && u.sec <= ANUNT && u.sec > 0 && !(u.cheie in eu.q)) {
    mom = { cheie: u.cheie, G: u.G, fer: ferMasina(eu, u.G), rez: null, rezT: 0, e: -u.sec, trecut: null };
    anuntate++; $('fbt').textContent = anuntate <= 2 ? 'Frână la panou' : u.G.membri.length > 1 ? u.G.eticheta : '';
    const z0 = (ANUNT - mom.fer) / D, z1 = (ANUNT + mom.fer) / D;
    $('fbz').setAttribute('stroke-dasharray', `${(z1 - z0) * 264} 264`); $('fbz').setAttribute('stroke-dashoffset', -z0 * 264);
    $('fbm').setAttribute('transform', `rotate(${ANUNT / D * 360} 48 48)`);
  }
  if (mom) {
    // e: cât de departe ești de panou, în secunde (negativ înainte, pozitiv după)
    if (!mom.rez) {
      if (u && u.cheie === mom.cheie && u.d > 0) mom.e = -u.sec; else { if (mom.trecut === null) mom.trecut = ceas; mom.e = ceas - mom.trecut; }
      const n = Math.max(0, Math.min(1, (ANUNT + mom.e) / D));
      $('fbr').setAttribute('stroke-dashoffset', 264 * (1 - n)); $('fbp').setAttribute('transform', `rotate(${n * 360} 48 48)`);
      // n-ai apăsat: frânează singură
      if (mom.e > DUPA + .05) { if (!(mom.cheie in eu.q)) { eu.q[mom.cheie] = SINGUR; eu.st.franari++; } mom = null; }
    } else { mom.rezT -= dt; if (mom.rezT <= 0) mom = null; }
    if (mom && !activ) mom = null;
  }
  fb.classList.toggle('on', !!mom);
  if (!mom) $('fbt').textContent = '';
  const rz = mom && mom.rez;
  $('fbq').textContent = rz ? (rz.sc > 0 ? `${Math.round(rz.sc * 100)}% · ${rz.txt}` : rz.txt) : '';
  $('fbq').style.color = rz ? (rz.sc > 0 ? `hsl(${Math.round(30 + rz.sc * 100)} 75% 55%)` : '#f5c542') : '';
  // liniile: pe Atac spre mașina din față, pe Apără spre cea din spate
  const ln = $('ln'), m = eu.mod, G0 = GM[eu.i];
  if (activ && G0 && G0.scr && m.pe && GM[m.pe.i] && GM[m.pe.i].scr && !harta) {
    const [x1, y1] = G0.scr, [x2, y2] = GM[m.pe.i].scr, col = m.k === 'atac' ? '#ed1b2f' : '#3d7bff';
    ln.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="22" fill="none" stroke="${col}" stroke-width="3"/>`;
  } else ln.innerHTML = '';
  const ch = $('chip');
  if (activ && G0 && G0.scr && !harta && m.k !== 'normal') {
    ch.hidden = false; ch.style.left = G0.scr[0] + 'px'; ch.style.top = (G0.scr[1] + 34) + 'px';
    ch.className = m.k === 'apara' ? 'b' : 'r';
    ch.textContent = { atac: `atac · ${m.pe && m.pe.sc}`, agresiv: 'agresiv', apara: `apăr · ${m.pe && m.pe.sc}` }[m.k];
  } else ch.hidden = true;
  const p = Math.round(eu.tyre * 100); $('tp').textContent = eu.pit > 0 ? f1(eu.pit) : p;
  $('tr0').setAttribute('stroke-dashoffset', 144.5 * (1 - eu.tyre)); $('tr0').setAttribute('stroke', p > 55 ? '#2ecc71' : p > 30 ? '#f5c542' : '#ed1b2f');
  $('px').classList.toggle('cere', eu.cere || eu.pit > 0); $('px').classList.toggle('puls', activ && p < 30 && !eu.cere && eu.s < (TURURI - 1) * L);
  $('pxx').hidden = !eu.cere; $('pxs').hidden = !(eu.cere || eu.pit > 0);
  $('pxs').textContent = eu.pit > 0 ? 'boxe' : `✓ boxe în ${Math.max(0, Math.ceil((L - ((eu.s % L) + L) % L) / 40 / VIT))} s`;
}
// ---------- scena: pista 3D, mașinile jetoane cu poză ----------
const vw = $('vw'); let W = vw.clientWidth, H = vw.clientHeight;
const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(W, H); vw.insertBefore(R.domElement, vw.firstChild);
const S = new THREE.Scene(); S.background = new THREE.Color(0x0b1020); S.fog = new THREE.Fog(0x0b1020, 260, 620);
const CAM = new THREE.PerspectiveCamera(32, W / H, 1, 4000);
S.add(new THREE.HemisphereLight(0x8aa0d8, 0x0d1a12, .55));
const luna = new THREE.DirectionalLight(0xb8c8ff, .55); luna.position.set(-300, 500, 200); S.add(luna);
let mx = 0, my = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
for (let i = 0; i < N; i++) { mx += X[i]; my += Y[i]; x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); } mx /= N; my /= N;
const sol = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x0f1e17 })); sol.rotation.x = -Math.PI / 2; sol.position.set(mx, -.05, my); S.add(sol);
const panglica = (o1, o2, yy, colFn, doar) => {
  const pos = [], col = [], c = new THREE.Color();
  for (let s = 0; s < N; s++) {
    if (doar && !doar(s)) continue; const j = (s + 1) % N, p = (i, o) => [X[i] - Math.sin(Hd[i]) * o, yy, Y[i] + Math.cos(Hd[i]) * o];
    const a = p(s, o1), b = p(s, o2), cc = p(j, o2), d = p(j, o1); pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    c.set(colFn(s)); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  S.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
};
const colt = s => Math.abs(K[s]) > .007;
panglica(-22, -8.4, .01, () => 0x2c2a26, s => colt(s) && K[s] < 0); panglica(8.4, 22, .01, () => 0x2c2a26, s => colt(s) && K[s] > 0);
panglica(-7, 7, .03, s => (Math.floor(s / 6) % 2 ? 0x33363e : 0x363941));
panglica(-7, -6.6, .05, () => 0xe8e8e8); panglica(6.6, 7, .05, () => 0xe8e8e8);
panglica(-8.4, -7, .06, s => (Math.floor(s / 2) % 2 ? 0xed1b2f : 0xffffff), colt); panglica(7, 8.4, .06, s => (Math.floor(s / 2) % 2 ? 0xed1b2f : 0xffffff), colt);
panglica(12.5, 21.5, .02, () => 0x2a2c33, s => s > N - 70 || s < 40);
panglica(12.5, 13, .04, () => 0xf5c542, s => s > N - 70 || s < 40);
const ck = document.createElement('canvas'); ck.width = 14; ck.height = 2; const kx = ck.getContext('2d');
for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) { kx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; kx.fillRect(i, j, 1, 1); }
const tx = new THREE.CanvasTexture(ck); tx.magFilter = THREE.NearestFilter;
const linie = new THREE.Mesh(new THREE.PlaneGeometry(2, 14), new THREE.MeshBasicMaterial({ map: tx })); linie.rotation.x = -Math.PI / 2; linie.rotation.z = -Hd[0]; linie.position.set(X[0], .08, Y[0]); S.add(linie);
const lang = (s, o) => [X[idx(s)] - Math.sin(Hd[idx(s)]) * o, Y[idx(s)] + Math.cos(Hd[idx(s)]) * o];
const cladire = (s, o, lung, lat, inalt, culoare, geam) => {
  const [x, z] = lang(s, o), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Hd[idx(s)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(lung, inalt, lat), new THREE.MeshLambertMaterial({ color: culoare })); b.position.y = inalt / 2; g.add(b);
  if (geam) { const w = new THREE.Mesh(new THREE.BoxGeometry(lung * .94, inalt * .28, lat + .2), new THREE.MeshBasicMaterial({ color: geam })); w.position.y = inalt * .62; g.add(w); }
  S.add(g);
};
cladire(-30, 29, 120, 10, 9, 0x2a2d36, 0xffd27a);
for (let r = 0; r < 4; r++) cladire(-20, -22 - r * 3, 110, 3, 2.5 + r * 2.2, r % 2 ? 0x3a3d47 : 0x30333c, r === 3 ? 0xd81528 : null);
const portal = new THREE.Group(); portal.position.set(X[0], 0, Y[0]); portal.rotation.y = -Hd[0];
const gm = new THREE.MeshLambertMaterial({ color: 0x24242b });
for (const z of [-10, 10]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.8, 9, .8), gm); st.position.set(0, 4.5, z); portal.add(st); }
const grinda = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 21), new THREE.MeshBasicMaterial({ color: 0xd81528 })); grinda.position.y = 9; portal.add(grinda); S.add(portal);
// panourile de frânare: o linie roșie peste asfalt și un panou cu dungi pe marginea pistei
const pc = document.createElement('canvas'); pc.width = 64; pc.height = 96; const px2 = pc.getContext('2d');
px2.fillStyle = '#fff'; px2.fillRect(0, 0, 64, 96); px2.fillStyle = '#ed1b2f';
for (let k = -2; k < 6; k++) { px2.beginPath(); px2.moveTo(0, k * 24); px2.lineTo(64, k * 24 + 40); px2.lineTo(64, k * 24 + 52); px2.lineTo(0, k * 24 + 12); px2.fill(); }
px2.lineWidth = 6; px2.strokeStyle = '#0a0a0c'; px2.strokeRect(3, 3, 58, 90);
const panouMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(pc) });
const linieMat = new THREE.MeshBasicMaterial({ color: 0xed1b2f });
for (const F of FRANARI) {
  const i = idx(F.sB), side = K[idx(F.sA)] > 0 ? -1 : 1;
  const ln = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 14), linieMat); ln.rotation.x = -Math.PI / 2; ln.rotation.z = -Hd[i]; ln.position.set(X[i], .09, Y[i]); S.add(ln);
  const [x, z] = lang(F.sB, 11.5 * side);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 6, 5), gm); st.position.set(x, 3, z); S.add(st);
  const sp = new THREE.Sprite(panouMat); sp.position.set(x, 8, z); sp.scale.set(5, 7.5, 1); S.add(sp);
}
const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hx = hc.getContext('2d'), gr = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
gr.addColorStop(0, 'rgba(255,236,190,.95)'); gr.addColorStop(.25, 'rgba(255,220,150,.45)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64);
const halo = new THREE.CanvasTexture(hc);
const hm = new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const halouSol = new THREE.MeshBasicMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .22 });
for (let s = 0; s < N; s += 22) {
  const side = (s / 22) % 2 ? 1 : -1, [x, z] = lang(s * step, 12 * side);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, 12, 5), gm); st.position.set(x, 6, z); S.add(st);
  const sp = new THREE.Sprite(hm); sp.position.set(x, 12.5, z); sp.scale.set(9, 9, 1); S.add(sp);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), halouSol); gl.rotation.x = -Math.PI / 2; const [x2, z2] = lang(s * step, 4 * side); gl.position.set(x2, .09, z2); S.add(gl);
}
const departe = (x, y, d) => { for (let s = 0; s < N; s += 4) if ((X[s] - x) ** 2 + (Y[s] - y) ** 2 < d * d) return false; return true; };
const copac = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 9, 6), new THREE.MeshLambertMaterial({ color: 0x173a26 }), 360); const o3 = new THREE.Object3D(); let nT = 0, seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
while (nT < 360) { const x = mx + (rnd() - .5) * 900, y = my + (rnd() - .5) * 760; if (!departe(x, y, 30)) continue; const sc = .7 + rnd() * .9; o3.position.set(x, 4.5 * sc, y); o3.scale.set(sc, sc, sc); o3.updateMatrix(); copac.setMatrixAt(nT++, o3.matrix); }
S.add(copac);
// dâra de nitro și inelele
const fc = document.createElement('canvas'); fc.width = 64; fc.height = 16; const fx = fc.getContext('2d'), fg = fx.createLinearGradient(0, 0, 64, 0);
fg.addColorStop(0, 'rgba(34,211,238,0)'); fg.addColorStop(.6, 'rgba(34,211,238,.7)'); fg.addColorStop(1, 'rgba(220,250,255,1)'); fx.fillStyle = fg; fx.fillRect(0, 2, 64, 12);
const flTex = new THREE.CanvasTexture(fc);
const inel = col => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = col; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.stroke(); return new THREE.CanvasTexture(c); };
const INEL_N = inel('#22d3ee'), INEL_R = inel('#ed1b2f'), INEL_A = inel('#ffffff');
function jetonTex(c) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 160; const tex = new THREE.CanvasTexture(cv);
  const desen = poz => {
    const x = cv.getContext('2d'); x.clearRect(0, 0, 160, 160);
    x.fillStyle = c.col; x.beginPath(); x.arc(80, 80, 76, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(80, 80, 64, 0, 7); x.clip(); x.fillStyle = '#18181d'; x.fillRect(0, 0, 160, 160);
    const im = IMG[c.f]; if (im && im.complete && im.naturalWidth) { const r = Math.max(128 / im.naturalWidth, 128 / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; x.drawImage(im, 80 - w / 2, 80 - h / 2, w, h); }
    x.restore();
    x.fillStyle = c.eu ? '#d81528' : '#0a0a0c'; x.beginPath(); x.arc(126, 126, 30, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.font = '900 38px "Big Shoulders Display", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(poz, 126, 128);
    tex.needsUpdate = true;
  };
  return { tex, desen };
}
function scena() {
  GM.forEach(g => S.remove(g.grup));
  GM = C.map(c => {
    const grup = new THREE.Group(), j = jetonTex(c); j.desen('');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: j.tex, depthTest: false, transparent: true })); sp.renderOrder = 10 + (c.eu ? 5 : 0); sp.position.y = 5; grup.add(sp);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: flTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(-8, .3, 0); fl.visible = false; grup.add(fl);
    const rn = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_N, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })); rn.position.y = 5; rn.visible = false; rn.renderOrder = 20; grup.add(rn);
    const rr = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_R, depthTest: false, transparent: true })); rr.position.y = 5; rr.visible = false; rr.renderOrder = 21; grup.add(rr);
    const ra = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_A, depthTest: false, transparent: true })); ra.position.y = 5; ra.visible = false; ra.renderOrder = 22; grup.add(ra);
    S.add(grup); return { grup, sp, fl, rn, rr, ra, j, poz: '', scr: null };
  });
  if (FG) { S.remove(FG); FG = null; }
  if (FANT && FANT.urma && FANT.urma.length) {
    const j = jetonTex({ ...FANT.d, f: cheieM(FANT.d.car), eu: 0 }); j.desen('');
    FG = new THREE.Sprite(new THREE.SpriteMaterial({ map: j.tex, depthTest: false, transparent: true, opacity: .45 })); FG.renderOrder = 5; S.add(FG);
  }
}
let FG = null;
const tinta = new THREE.Vector3(); let camOk = false, tz = 0;
const TG = Math.tan(16 * Math.PI / 180), inaltHarta = () => Math.max((x1 - x0) / 2 / TG, (y1 - y0) / 2 / (TG * W / H)) * 1.12;
let HH = inaltHarta();
addEventListener('resize', () => { W = vw.clientWidth; H = vw.clientHeight; R.setSize(W, H); CAM.aspect = W / H; CAM.updateProjectionMatrix(); HH = inaltHarta(); });
function desen(dt) {
  tz += dt;
  const o = ord(), k0 = o.indexOf(eu), spate = o[k0 + 1], pericol = pornit && spate && eu.s - spate.s < 16 && eu.fin === null;
  C.forEach((c, k) => {
    const G = GM[k], i = idx(c.s), j = (i + 1) % N, u = ((c.s / step) % 1 + 1) % 1;
    let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u;
    G.grup.position.set(X[i] + (X[j] - X[i]) * u - Math.sin(h) * c.latC, 0, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * c.latC); G.grup.rotation.y = -h;
    const poz = String(o.indexOf(c) + 1); if (poz !== G.poz) { G.poz = poz; G.j.desen(poz); }
    const m = harta ? 3.2 : 1, z = (c.eu ? 9.5 : 7.8) * m; G.sp.scale.set(z, z, 1);
    const n = c.nT > 0 && DREAPTA(c.s); G.fl.visible = n && !harta; G.rn.visible = n; if (n) { G.fl.scale.x = .8 + Math.random() * .5; G.rn.scale.set(z * 1.25, z * 1.25, 1); }
    G.rr.visible = c.eu && pericol; if (G.rr.visible) { const q = z * (1.2 + .12 * Math.sin(tz * 10)); G.rr.scale.set(q, q, 1); }
    // pulsul de la frânare: un inel alb care se lărgește și se stinge
    G.ra.visible = c.puls > 0; if (c.puls > 0) { const f = 1 - c.puls / .6, q = z * (1.1 + f * 1.4); G.ra.scale.set(q, q, 1); G.ra.material.opacity = c.puls / .6; c.puls = Math.max(0, c.puls - dt); }
  });
  if (FG && FANT) {
    const sF = FANT.urma[Math.min(FANT.urma.length - 1, Math.floor(t / .1))], i = idx(sF);
    FG.position.set(X[i] - Math.sin(Hd[i]) * 2.5, 5, Y[i] + Math.cos(Hd[i]) * 2.5); const z = harta ? 25 : 8; FG.scale.set(z, z, 1);
  }
  if (harta) { S.fog.far = 9000; CAM.up.set(-1, 0, 0); CAM.position.set((x0 + x1) / 2, HH, (y0 + y1) / 2); CAM.lookAt((x0 + x1) / 2, 0, (y0 + y1) / 2); }
  else {
    S.fog.far = 620; CAM.up.set(0, 1, 0);
    const f = GM[eu.i].grup.position;
    if (!camOk) { tinta.copy(f); camOk = true; } else tinta.lerp(f, 1 - Math.exp(-dt * 12));
    CAM.position.set(tinta.x + 85, 135, tinta.z + 112); CAM.lookAt(tinta.x, 0, tinta.z);
  }
  R.render(S, CAM);
  // unde e fiecare jeton pe ecran (pentru liniile de atac și apărare)
  C.forEach((c, k) => { const p = GM[k].grup.position; v3.set(p.x, 5, p.z).project(CAM); GM[k].scr = v3.z < 1 ? [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H] : null; });
}
const v3 = new THREE.Vector3();
// ---------- grila și finalul ----------
const urlPoza = c => c.image.replace(/\/\d+px-/, '/250px-');
const tok = c => `<img src="${urlPoza(c.car || c.c)}" alt="" referrerpolicy="no-referrer" style="border:3px solid ${c.col || '#d81528'}">`;
const pct = x => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
const bara = (d, col) => `<div class="br"><i style="left:50%;width:${Math.min(50, Math.abs(d) * 400)}%;${d < 0 ? 'transform:translateX(-100%);' : ''}background:${col}"></i><i style="left:50%;width:1px;background:#6b6f78"></i></div>`;
const pict = (sel, w, h) => document.querySelector(sel + ' svg').outerHTML.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
let alegLista = false;
// timpii sunt ai mașinii (un tur durează cât în realitate), nu ai ecranului, care merge accelerat
const fT = x => { if (x == null || !isFinite(x)) return '–'; const s = x, m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0').replace('.', ',')}`; };
const fD = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3).replace('.', ',');
const titluOv = txt => `<p style="margin:0;color:#9aa0a9;font:700 11px Archivo;letter-spacing:.14em;text-transform:uppercase">${txt}</p>`;
const seg = (nume, val, opt) => `<div class="mseg" data-g="${nume}">${opt.map(([v, t]) => `<button type="button" data-v="${v}" class="${SES[nume] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
// ---------- meniul: mașina, modul, calificarea ----------
function ecranStart() {
  START = null; WK = null; FANT = null;
  const g = garajulMeu();
  const rand = (x, i) => `<button type="button" class="alm${cheieM(x.c) === cheieM(aleasa.c) && x.nivel === aleasa.nivel ? ' on' : ''}" data-i="${i}">${tok({ c: x.c })}<span><b>${x.c.name}</b> <small>${x.c.years}</small><br><small>clasa ${CM.clasa(x.scor)} · ${x.scor}${x.nivel ? ' · tunată' : ''}</small></span></button>`;
  const sc = CM.scor(aleasa.c, aleasa.nivel);
  const masina = `<div class="gr" style="grid-template-columns:30px 1fr auto;border:0">${tok({ c: aleasa.c })}<span><b>${aleasa.c.name}</b> <small style="color:#9aa0a9">${aleasa.c.years}</small><br><small style="color:#9aa0a9">Clasa ${sc.clasa} · scor ${sc.v}${aleasa.imprumut ? ' · de împrumut' : ''}</small></span>${g.length > 1 || (g.length && aleasa.imprumut) ? '<button type="button" id="schimb" class="sch">Schimbă</button>' : ''}</div>`;
  $('ov').innerHTML = `${titluOv('Cursa · Serpentine')}
    ${masina}
    ${alegLista ? `<div class="alg">${g.map(rand).join('')}</div>` : ''}
    ${!g.length ? '<p style="margin:0;color:#9aa0a9;font-size:11px">Garajul tău nu e pe telefonul ăsta: deschide Garajul o dată și mașinile tale apar aici.</p>' : ''}
    ${seg('mod', 0, [['complet', 'Calificare + cursă'], ['calif', 'Doar calificare'], ['antren', 'Antrenament']])}
    ${SES.mod !== 'antren' ? seg('calif', 0, [['scurta', 'Un tur'], ['lunga', 'Q1 · Q2 · Q3']]) : ''}
    <p style="margin:0;color:#9aa0a9;font-size:12px;line-height:1.5">${SES.mod === 'antren' ? 'Singur pe pistă, câte tururi vrei, cu fantoma celui mai bun tur al tău cu mașina asta.' : `${SES.calif === 'scurta' ? 'Calificare dintr-un singur tur: ordinea timpilor face grila.' : 'Q1 cu toți 10, primii 7 trec în Q2, primii 5 în Q3. Un tur pe etapă.'}${SES.mod === 'complet' ? ' Apoi cursa de 3 tururi, cu start de pe loc.' : ''}`}</p>
    <details class="cum"><summary>Cum se joacă</summary><div class="lg">
      <span>${pict('#fb', 30, 30)}</span><span>Frână: la virajele mari apare butonul. Pe inel vezi de la început arcul verde: apasă când punctul ajunge la mijlocul lui. Cu cât mai aproape, cu atât ieși mai repede (până la 100%). La mașinile rapide arcul e mai îngust, la cele care țin bine în viraje e mai lat.</span>
      <span style="color:#22d3ee">${pict('#nb', 16, 22)}</span><span>Nitro, doar pe dreaptă. Buteliile se reumplu singure.</span>
      <span style="color:#ed1b2f">${pict('[data-r=atac]', 22, 22)}</span><span>În cursă, Atac: îl ataci pe cel din față (linie roșie); fără nimeni în față, mergi agresiv și toci roțile.</span>
      <span style="color:#3d7bff">${pict('[data-r=apara]', 22, 22)}</span><span>Apără: îi închizi linia celui din spate (linie albastră).</span>
      <span>${pict('#px', 26, 26)}</span><span>Anvelopele. O atingere și intri la boxe la capătul turului (3 s, roți noi).</span>
      <span style="color:#ed1b2f;font:900 20px var(--display)">●</span><span>Startul: se aprind 5 lumini roșii; când se sting, apasă Pleacă. Contează reacția; dacă pleci înainte, primești 3 secunde penalizare.</span>
    </div></details>
    <button type="button" class="go" id="go">${SES.mod === 'antren' ? 'Pe pistă' : 'Începe'}</button>`;
  $('ov').style.display = 'flex';
  $('go').onclick = incepe;
  $('ov').querySelectorAll('.mseg button').forEach(b => b.onclick = () => { SES[b.parentNode.dataset.g] = b.dataset.v; ecranStart(); });
  const sch = $('schimb'); if (sch) sch.onclick = () => { alegLista = !alegLista; ecranStart(); };
  $('ov').querySelectorAll('.alm').forEach(b => b.onclick = () => {
    aleasa = g[+b.dataset.i]; alegLista = false;
    try { localStorage.setItem('frq_cursa_masina', `${cheieM(aleasa.c)}#${aleasa.nivel}`); } catch { /* fără stocare */ }
    soloNou(); scena(); ecranStart();
  });
}
// ---------- weekendul ----------
const ETAPE_LUNGI = [['Q1', 10, 7], ['Q2', 7, 5], ['Q3', 5, 5]];
function incepe() {
  if (SES.mod === 'antren') { antrenament(); return; }
  pregatesteRivali();
  WK = { etape: SES.calif === 'scurta' ? [['Calificare', 10, 10]] : ETAPE_LUNGI, k: 0, in: [definitiaMea(), ...RIVALI], coada: [], eliminat: null };
  etapa();
}
function etapa() {
  const [nume, n, trec] = WK.etape[WK.k];
  // boții își fac turul acum (simulat); cel mai rapid e fantoma ta
  WK.timpi = new Map(); WK.sect = new Map(); let pol = null;
  for (const d of WK.in) if (!d.eu) { const r = turSolo(d); WK.timpi.set(d, r.timp); WK.sect.set(d, r.sect); if (!pol || r.timp < pol.timp) pol = r; }
  WK.pol = pol;
  const euIn = WK.in.find(d => d.eu);
  if (!euIn) { inchideEtapa(); return; }
  soloNou(pol); scena();
  $('ov').innerHTML = `${titluOv(`${nume} · ${n} piloți${trec < n ? ` · primii ${trec} trec` : ''}`)}
    <p class="d" style="font-size:40px">${nume === 'Calificare' ? 'Un tur' : nume}</p>
    <p style="margin:0;color:#cfd3da;line-height:1.5">Un tur lansat, singur pe pistă. Fantoma de lângă tine e cel mai rapid tur de până acum: <b>${pol.d.n}</b>, ${pol.d.m}, <b>${fT(pol.timp)}</b>.</p>
    <button type="button" class="go" id="go">Pe pistă</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; };
}
function inchideEtapa() {
  const [nume, n, trec] = WK.etape[WK.k], ultima = WK.k === WK.etape.length - 1;
  const ordine = WK.in.slice().sort((a, b) => WK.timpi.get(a) - WK.timpi.get(b));
  const euPoz = ordine.findIndex(d => d.eu), euIn = euPoz >= 0;
  if (ultima) WK.grila = [...ordine, ...WK.coada]; else { WK.coada = [...ordine.slice(trec), ...WK.coada]; WK.in = ordine.slice(0, trec); }
  if (euIn && euPoz >= trec && !ultima) WK.eliminat = nume;
  const pol = WK.timpi.get(ordine[0]);
  const tabel = ordine.map((d, i) => `<div class="qr${d.eu ? ' eu' : ''}${i >= trec ? ' out' : ''}"><span>${i + 1}</span>${tok(d)}<span><b>${d.n}</b> <small>${d.m}</small></span><b>${i ? fD(WK.timpi.get(d) - pol) : fT(pol)}</b></div>`).join('');
  const urm = !ultima ? (euIn && euPoz >= trec ? 'Rezultatul' : `Mai departe: ${WK.etape[WK.k + 1][0]}`) : SES.mod === 'complet' ? 'Grila de start' : 'Rezultatul';
  $('ov').innerHTML = `${titluOv(`${nume} · rezultat`)}
    ${euIn ? `<p class="d" style="font-size:44px">P${euPoz + 1}${euPoz >= trec ? ' · eliminat' : ''}</p>` : ''}
    <div class="qt">${tabel}</div>
    ${trec < n ? `<p style="margin:0;color:#9aa0a9;font-size:11px">Primii ${trec} trec mai departe.</p>` : ''}
    <button type="button" class="go" id="go">${urm}</button>`;
  $('ov').style.display = 'flex';
  $('go').onclick = () => {
    if (!ultima) { WK.k++; if (WK.eliminat) { while (WK.k < WK.etape.length) { simuleazaEtapa(); } } else { etapa(); return; } }
    if (SES.mod === 'complet') ecranGrila(); else rezultatCalif();
  };
}
// după ce ai fost eliminat, etapele care urmează se joacă doar între boți
function simuleazaEtapa() {
  const [, , trec] = WK.etape[WK.k], ultima = WK.k === WK.etape.length - 1;
  WK.timpi = new Map(); for (const d of WK.in) WK.timpi.set(d, turSolo(d).timp);
  const ordine = WK.in.slice().sort((a, b) => WK.timpi.get(a) - WK.timpi.get(b));
  if (ultima) WK.grila = [...ordine, ...WK.coada]; else { WK.coada = [...ordine.slice(trec), ...WK.coada]; WK.in = ordine.slice(0, trec); }
  WK.k++;
}
function rezultatCalif() {
  const p = WK.grila.findIndex(d => d.eu) + 1;
  $('ov').innerHTML = `${titluOv('Calificare · final')}<p class="d" style="font-size:56px">P${p}</p>
    <p style="margin:0;color:#cfd3da">${p === 1 ? 'Pole position.' : WK.eliminat ? `Eliminat în ${WK.eliminat}.` : `Pe locul ${p} pe grilă.`}</p>
    <div class="qt">${WK.grila.map((d, i) => `<div class="qr${d.eu ? ' eu' : ''}"><span>${i + 1}</span>${tok(d)}<span><b>${d.n}</b> <small>${d.m}</small></span><b></b></div>`).join('')}</div>
    <button type="button" class="go" id="go">Înapoi la meniu</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { soloNou(); scena(); ecranStart(); };
}
function ecranGrila() {
  cursaNoua(WK.grila); scena();
  const p = C.indexOf(eu) + 1;
  $('ov').innerHTML = `${titluOv('Cursa · 3 tururi · start de pe loc')}<p class="d" style="font-size:44px">Pleci P${p}</p>
    <div class="qt">${C.map((d, i) => `<div class="qr${d.eu ? ' eu' : ''}"><span>${i + 1}</span>${tok(d)}<span><b>${d.n}</b> <small>${d.m}</small></span><b style="font-weight:400;color:#9aa0a9;font-size:11px">${CM.clasa(d.scor)} ${d.scor}</b></div>`).join('')}</div>
    <p style="margin:0;color:#9aa0a9;font-size:12px">Se aprind 5 lumini roșii. Când se sting, apasă Pleacă.</p>
    <button type="button" class="go" id="go">Pe grilă</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; START.t0 = ceas + .8; };
}
// ---------- antrenamentul: tururi singur, cu recordul pe mașină ----------
const cheieRec = () => `frq_cursa_rec_${cheieM(aleasa.c)}#${aleasa.nivel}`;
const recordul = () => { try { return JSON.parse(localStorage.getItem(cheieRec()) || 'null'); } catch { return null; } };
function antrenament() {
  WK = null;
  const rec = recordul();
  soloNou(rec ? { timp: rec.timp, urma: rec.urma, d: { n: 'Recordul tău', m: '', car: aleasa.c, col: '#ffffff' } } : null); scena();
  $('ov').style.display = 'none'; pornit = true;
}
function finalSolo() {
  const timp = eu.fin - eu.t0;
  if (WK) { WK.timpi.set(WK.in.find(d => d.eu), timp); inchideEtapa(); return; }
  // antrenament: recordul și fantoma lui
  const rec = recordul(), nou = !rec || timp < rec.timp;
  if (nou) { const urma = eu.urma; try { localStorage.setItem(cheieRec(), JSON.stringify({ timp, urma })); } catch { /* fără stocare */ } }
  $('ov').innerHTML = `${titluOv('Antrenament')}<p class="d" style="font-size:52px">${fT(timp)}</p>
    <p style="margin:0;color:${nou ? '#2ecc71' : '#cfd3da'}">${nou ? (rec ? `Record nou, cu ${fD(rec.timp - timp).slice(1)} s mai bun.` : 'Primul tău record cu mașina asta.') : `Recordul tău: ${fT(rec.timp)} (${fD(timp - rec.timp)} s)`}</p>
    <p style="margin:0;color:#9aa0a9;font-size:12px">Frânări: media ${eu.st.franari ? Math.round(eu.st.scor / eu.st.franari * 100) : 0}%</p>
    <button type="button" class="go" id="go">Încă un tur</button>
    <button type="button" class="go gh" id="go3">Înapoi la meniu</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = antrenament; $('go3').onclick = () => { soloNou(); scena(); ecranStart(); };
}
function final() {
  const o = ord(), p = o.indexOf(eu), ref = p === 0 ? o[1] : o[0];
  const d = { dr: eu.st.dr - ref.st.dr, vir: eu.st.vir - ref.st.vir, pit: eu.st.pit - ref.st.pit, start: eu.st.start - ref.st.start + (eu.penal - ref.penal) };
  const rand = (lab, x, de) => Math.abs(x) < .05 ? '' : `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #1d1d23"><span>${lab}<br><small style="color:#9aa0a9">${de}</small></span><b style="color:${x > 0 ? '#ed1b2f' : '#2ecc71'};white-space:nowrap">${x > 0 ? 'pierzi ' : 'câștigi '}${f1(Math.abs(x))} s</b></div>`;
  const pierzi = x => x > 0, dDr = Math.round(Math.abs(eu.seg.dr - ref.seg.dr) / eu.seg.dr * 100), dVir = Math.round(Math.abs(eu.seg.vir - ref.seg.vir) / eu.seg.vir * 100);
  const motiv = {
    dr: pierzi(d.dr) ? (ref.seg.dr < eu.seg.dr * .995 ? `${ref.m} e cu ${dDr}% mai rapidă pe drepte (${ref.car.hp} CP, ${Math.round(ref.p.vmax * 3.6)} km/h)` : eu.st.bloc > 1 ? 'ai stat blocat în spatele altora' : `${ref.n} a folosit nitro mai bine`) : (eu.seg.dr < ref.seg.dr * .995 ? `mașina ta e cu ${dDr}% mai rapidă pe drepte` : 'nitro și aspirație folosite bine'),
    vir: pierzi(d.vir) ? (ref.seg.vir < eu.seg.vir * .995 ? `${ref.m} e cu ${dVir}% mai rapidă în viraje` : 'frânări mai slabe sau anvelope mai uzate') : (eu.seg.vir < ref.seg.vir * .995 ? `mașina ta e cu ${dVir}% mai rapidă în viraje` : 'frânări mai bune, Atac la momentul bun'),
    pit: pierzi(d.pit) ? `ai stat la boxe ${f1(eu.st.pit)} s${ref.st.pit > 0 ? '' : ', el n-a oprit'}` : `${ref.n} a stat la boxe ${f1(ref.st.pit)} s`,
    start: eu.penal ? 'start fals: 3 s penalizare' : pierzi(d.start) ? `locul de pe grilă și reacția (${START && START.reactie != null ? f1(START.reactie).replace(/,(\d)$/, ',$10') : '–'} s)` : 'locul de pe grilă și reacția' };
  const linii = [['Pe drepte', d.dr, motiv.dr], ['În viraje', d.vir, motiv.vir], ['Boxe', d.pit, motiv.pit], ['Start', d.start, motiv.start]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(x => rand(...x)).join('');
  $('ov').innerHTML = `${titluOv('Cursa · final')}
    <div style="display:flex;align-items:center;gap:12px"><p class="d" style="font-size:64px">P${p + 1}</p><p style="margin:0;color:#cfd3da;line-height:1.4">${p === 0 ? `Ai câștigat cu ${fD(o[1].fin - eu.fin).slice(1)} s.` : `La ${fD(eu.fin - o[0].fin).slice(1)} s de ${o[0].n}.`}<br><small style="color:#9aa0a9">Frânări: media ta ${eu.st.franari ? Math.round(eu.st.scor / eu.st.franari * 100) : 0}% · ${ref.n}: ${ref.st.franari ? Math.round(ref.st.scor / ref.st.franari * 100) : 0}%<br>Startul: ${eu.penal ? 'start fals · +3 s' : START && START.reactie != null ? `reacție ${START.reactie.toFixed(3).replace('.', ',')} s` : '–'}</small></p></div>
    <p class="d" style="font-size:20px;margin-top:4px">${p === 0 ? `Unde l-ai bătut pe ${ref.n}` : `Unde ai pierdut față de ${ref.n}`}</p>
    <div>${linii || '<p style="color:#9aa0a9">La egalitate peste tot.</p>'}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${o.map((c, i) => `<span style="display:flex;align-items:center;gap:4px;${c.eu ? 'color:#ed1b2f;font-weight:700' : 'color:#9aa0a9'}">${i + 1}. <img src="${urlPoza(c.car)}" alt="" referrerpolicy="no-referrer" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:2px solid ${c.col}">${c.sc}</span>`).join('')}</div>
    <button type="button" class="go" id="go2">Înapoi la meniu</button>`;
  $('ov').style.display = 'flex'; $('go2').onclick = () => { soloNou(); scena(); ecranStart(); };
}
// ---------- startul cu lumini ----------
// 5 lumini roșii, câte una la 0,8 s; se sting după o pauză la întâmplare. Apeși Pleacă după
// stingere: contează reacția. Înainte: start fals, pleci la stingere cu 3 s penalizare.
function pleaca() {
  if (!START || !pornit || eu.lansat || START.t0 === null || ceas < START.t0) return;
  if (START.out === null || ceas < START.out) { START.penal = 3; eu.penal = 3; START.msg = 'Start fals · +3 s'; START.msgT = 2; START.apasat = ceas; window.Shared && Shared.haptic('error'); return; }
  START.reactie = ceas - START.out; eu.lansat = true;
  START.msg = `Reacție ${START.reactie.toFixed(3).replace('.', ',')} s`; START.msgT = 1.6;
  window.Shared && Shared.haptic(START.reactie < .3 ? 'success' : 'tick');
}
$('sb').addEventListener('pointerdown', e => { e.preventDefault(); pleaca(); });
function lumini() {
  const el = $('lum'), sb = $('sb');
  if (!START || START.t0 === null) { el.hidden = true; sb.classList.remove('on'); return; }
  const k = Math.floor((ceas - START.t0) / .8) + 1;
  if (START.out === null && k > 5) START.out = START.t0 + 4 * .8 + .8 + .4 + Math.random() * 1.8;
  const stinse = START.out !== null && ceas >= START.out;
  el.hidden = stinse && ceas > START.out + 1.2;
  el.querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', !stinse && i < Math.min(5, k)));
  el.classList.toggle('go', stinse);
  // boții pleacă după reacția lor; tu, la apăsare (după un start fals, la stingere)
  if (stinse) for (const c of C) if (!c.lansat) {
    if (!c.eu) { if (c.reactie == null) c.reactie = .17 + Math.random() * .3; if (ceas >= START.out + c.reactie) c.lansat = true; }
    else if (START.penal) { c.lansat = true; START.reactie = 0; }
    else if (ceas > START.out + 1.2) { c.lansat = true; START.reactie = 1.2; START.msg = 'Prea târziu'; START.msgT = 1.4; }
  }
  sb.classList.toggle('on', !eu.lansat && pornit);
  START.msgT -= 1 / 60;
  $('fbq').textContent = START.msgT > 0 ? START.msg : $('fbq').textContent;
}
let last = performance.now();
function cadru(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; ceas += dt;
  if (pornit && !gata) {
    let r = dt * VIT; while (r > 0) { const h = Math.min(r, 1 / 60); pas(h); r -= h; }
    if (TURURI === 1 ? eu.fin !== null : C.every(c => c.fin !== null)) { gata = true; pornit = false; TURURI === 1 ? finalSolo() : final(); }
  }
  hud(dt); lumini(); desen(dt);
  requestAnimationFrame(cadru);
}
soloNou(); scena(); ecranStart();
if (new URLSearchParams(location.search).has('test')) window.__cursa = { get C() { return C; }, get eu() { return eu; }, get mom() { return mom; }, get ceas() { return ceas; }, get START() { return START; }, get WK() { return WK; }, SES, GRUPURI, franeaza, setRitm, pleaca, turSolo };
requestAnimationFrame(cadru);
})();
