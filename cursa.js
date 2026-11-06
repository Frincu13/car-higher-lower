// Cursa: prototipul de cursă în stil manager. Pista se vede de sus, mașinile sunt jetoane cu
// poza lor; tu alegi ritmul (Atac, Normal, Ușor), folosești nitro pe dreaptă și intri la boxe.
// Depășirile ies din ritm, mașină, anvelope, aspirație și nitro. Nu atinge garajul sau tuningul.
(() => {
const $ = i => document.getElementById(i);
// Pozele mașinilor (Wikimedia Commons), micșorate și puse aici ca jetoanele să se deseneze și fără semnal.
// ---------- circuitul (același ca în modelul Cursei, cu care se calculează scorurile) ----------
const CM = window.CursaModel;
// ---------- mașinile, din datele lor (data/cars.js) ----------
const MASINI = (window.CARS || []).filter(c => c.image && c.hp && c.weight);
const cheieM = c => `${c.name}|${c.years}`;
const DUPA_CHEIE = new Map(MASINI.map(c => [cheieM(c), c]));
const IMPRUMUT = DUPA_CHEIE.get('BMW M3|1997') || MASINI[0];
const scorMasina = (c, nivel) => CM.scor(c, nivel).v;
// ---------- pista: circuitul, dreptele și frânările (din modelul Cursei, aceleași ca pe server) ----------
// Panourile și grupurile de frânare se măsoară cu o mașină de mijloc (BMW M3 1997).
const P = CM.pista(IMPRUMUT), CIRC = P.CIRC;
const { X, Y, Hd, K, N, step, L } = CIRC;
const { VTOP, VC, idx, DREAPTA, FRANARI, GRUPURI, ZONA, ferMasina } = P;
const { ANUNT, DUPA, VIT, nota, SINGUR } = CM;
const VIRAJ_APROAPE = s => { for (let d = 20; d < 160; d += 10) if (VC[idx(s + d)] < VTOP * .7) return true; return false; };
// boții: o abatere la întâmplare, mai mică la cei buni
const notaBot = (c, G) => { const r = (Math.random() + Math.random() + Math.random() - 1.5) * (.5 - c.sk * .4); return nota(r, ferMasina(c, G)); };
// ---------- mașina ta: din garajul de pe telefon (ultima copie), altfel una de împrumut ----------
function garajulMeu() {
  let r = null; try { r = JSON.parse(localStorage.getItem('frq_portofel') || 'null'); } catch { /* fără stocare */ }
  const ex = (r && r.r && r.r.exemplare) || [], cel = new Map();
  for (const e of ex) { const c = DUPA_CHEIE.get(e.masina); if (c && (!cel.has(e.masina) || (e.nivel || 0) > cel.get(e.masina).nivel)) cel.set(e.masina, { c, nivel: e.nivel || 0, ex: e.id ?? null }); }
  if (!ex.length && r && r.r && r.r.garaj) for (const g of r.r.garaj) { const c = DUPA_CHEIE.get(g.masina); if (c) cel.set(g.masina, { c, nivel: g.nivel || 0 }); }
  return [...cel.values()].map(x => ({ ...x, scor: scorMasina(x.c, x.nivel) })).sort((a, b) => b.scor - a.scor);
}
let aleasa = null;
try { const k = localStorage.getItem('frq_cursa_masina'); const g = garajulMeu(); aleasa = g.find(x => `${cheieM(x.c)}#${x.nivel}` === k) || g[0] || null; } catch { /* fără stocare */ }
if (!aleasa) aleasa = { c: IMPRUMUT, nivel: 0, imprumut: true, scor: scorMasina(IMPRUMUT, 0) };
// ---------- adversarii: din clasa ta, cu scor apropiat ----------
const PILOTI = [['Andrei', 'AND', '#f5b82e'], ['Teo', 'TEO', '#3d7bff'], ['Ștefi', 'ȘTE', '#ff5c7a'], ['Radu', 'RAD', '#ff8a00'], ['FRQ Bot', 'BOT', '#9aa0a9'], ['Mihai', 'MIH', '#2ecc71'], ['Ioana', 'IOA', '#b57bff'], ['Vlad', 'VLA', '#e8e8e8'], ['Ana', 'ANA', '#00b3a4']];
const scorStoc = c => CM.scor(c, 0).v;
// Aproape de tine: cei mai rapizi cu cel mult 5 puncte (cam 0,2 s pe tur), cei mai lenți până la 10;
// cel mult 5 mai rapizi și 5 mai lenți. Simulat pe toate clasele: un tur perfect ia pole-ul (cel
// mult P2), un tur obișnuit rămâne o luptă.
function alegeRivali(eu0) {
  const marca = c => c.name.split(' ')[0], folosite = new Set([marca(eu0.c)]), out = [];
  const pool = MASINI.filter(c => cheieM(c) !== cheieM(eu0.c)).sort(() => Math.random() - .5);
  let rapizi = 0, lenti = 0;
  for (const [lat, echilibru] of [[10, true], [16, true], [30, false], [70, false], [140, false]]) {
    for (const c of pool) {
      if (out.length >= 9) break;
      const d = scorStoc(c) - eu0.scor;
      if (folosite.has(marca(c)) || d < -lat || d > (echilibru ? lat / 2 : lat / 3) || (echilibru && (d > 0 ? rapizi : lenti) >= 5)) continue;
      folosite.add(marca(c)); out.push(c); if (d > 0) rapizi++; else lenti++;
    }
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
const UZ = CM.UZ, PAS = 13, APROAPE = 40;
function ritmul(c, din, gap, spate, gs) {
  const R = CM.RITM;
  if (c.ritm === 'atac') return gap < APROAPE ? { k: 'atac', pe: din, ...R.atac } : { k: 'agresiv', ...R.atac };
  if (c.ritm === 'apara' && gs < APROAPE * .8) return { k: 'apara', pe: spate, ...R.apara };
  return { k: 'normal', ...R.normal };
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
const stare = (d, i, extra) => ({ ...d, i, s: 0, v: 0, ritm: 'normal', mod: { k: 'normal' }, decT: 0, tyre: 1, nitro: d.p.nitro.celule, nOn: false, tine: false, nT: 0, latV: 0, puls: 0, cere: false, pit: 0, pr: 0, trece: null, latC: 0, latF: 0, latFT: 0, fin: null, tura: 0, q: {}, qf: 1, qq: SINGUR, t0: null, sect: [], lansat: true, penal: 0, st: { dr: 0, vir: 0, pit: 0, bloc: 0, uz: 0, start: 0, scor: 0, franari: 0 }, ...extra });
const definitiaMea = () => masinaCursa(aleasa.c, aleasa.nivel, ['Tu', 'TU', '#d81528'], { eu: 1 });
function pregatesteRivali() { RIVALI = alegeRivali(aleasa).map((c, i) => masinaCursa(c, 0, PILOTI[i])); }
function comun() {
  C.forEach(c => poza(c.car));
  eu = C.find(c => c.eu); t = 0; pornit = false; gata = false; finEu = null; $('fin').hidden = true; pozVeche = C.indexOf(eu) + 1; setRitm(TURURI === 1 ? 'atac' : 'normal'); anuntate = 0; mom = null;
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
  C = [P.stareSolo(definitiaMea(), { i: 0, latV: 0, latC: 0, latF: 0, latFT: 0, puls: 0, intr: { f: [], n: [] } })];
  comun();
}
// turul unui bot, simulat pe loc cu aceeași simulare (pentru calificări și fantome)
function turSolo(d) {
  const salv = [C, eu, t, TURURI];
  TURURI = 1;
  const c = P.stareSolo(d, { i: 0, push: true, latV: 0, latC: 0, latF: 0, latFT: 0 });
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
// Turul lansat: pasul din model (același pe server, care reface timpul din apăsări). Boții își
// aleg aici rafalele de nitro; tu ții butonul.
function pasSingur(c, dt) {
  if (!c.eu) { const dr = DREAPTA(c.s); if (c.nT <= 0 && c.nitro >= 1 && dr && Math.random() < dt * .6) c.nT = c.p.nitro.celula * VIT * (1 + Math.random() * 1.5); if (!dr) c.nT = 0; }
  P.pasSolo(c, t, dt, c.eu ? null : notaBot);
  const lt = (c.i % 3 - 1) * 1.4;
  c.latV += ((lt - c.latC) * 16 - c.latV * 8) * dt; c.latC = Math.max(-5.2, Math.min(5.2, c.latC + c.latV * dt));
  // urma turului, la fiecare 0,1 s, pentru fantome
  const u = c.urma || (c.urma = []), kk = Math.floor(t / .1); while (u.length <= kk) u.push(c.s);
}
function pas(dt) {
  t += dt;
  if (C.length === 1) { pasSingur(C[0], dt); return; }
  const o = C.slice().sort((a, b) => b.s - a.s);
  for (let k = 0; k < o.length; k++) {
    const c = o[k];
    if (c.remote) { pasRemote(c, dt); continue; }
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
      if (c.nT <= 0 && c.nitro >= 1 && dr && (t > 10 || c.push) && (gap < 22 || gs < 14 || c.push) && Math.random() < dt * .6) c.nT = c.p.nitro.celula * VIT * (1 + Math.random() * 1.5);
      if (!dr) c.nT = 0;
      if (!c.cere && c.tyre < .22 && !ultim) c.cere = true;
    }
    // în zona unei frânări mari: cât de bine a frânat (tu: butonul; boții: după cât de buni sunt)
    const sl = ((c.s % L) + L) % L, Z = c.s >= 0 ? ZONA(sl) : null;
    if (Z) {
      const cheie = `${Math.floor(c.s / L)}-${Z.n}`;
      if (!(cheie in c.q) && !c.eu) { c.q[cheie] = c.eu ? SINGUR : notaBot(c, Z); c.st.franari++; c.st.scor += c.q[cheie].sc; umple(c, c.q[cheie].sc); }
      c.qq = c.q[cheie] || SINGUR; c.qf = c.qq.qf;
    } else { c.qq = SINGUR; c.qf = 1; }
    c.mod = ritmul(c, din, gap, spate, gs);
    // nitro merge oriunde cât e apăsat: pe dreaptă dă tot, în viraj doar puțină accelerație la ieșire
    c.nOn = c.nitro > 0 && (c.eu ? c.tine && c.lansat : c.nT > 0);
    if (c.nOn) c.nitro = Math.max(0, c.nitro - dt / (c.p.nitro.celula * VIT));
    const i = idx(c.s), pf = c.mod.pf, uz = c.mod.uz, tf = .9 + .1 * c.tyre;
    if (c.trece && (c.s > c.trece.s + PAS * .8 || c.trece.s - c.s > 30 || c.trece.pit > 0 || c.trece.fin !== null)) gataDepasirea(c);
    const pot = c.prof[i] * pf * tf * c.qf * (dr && c.nOn ? 1.09 : 1) * (dr && gap < 30 ? 1.03 : 1) * (c.trece ? 1.025 : 1);
    c.v += pot > c.v ? Math.min(pot - c.v, Math.max(.4, CM.acc(c.p, c.v)) * (c.nOn ? (dr ? 1.4 : 1.15) : 1) * dt) : Math.max(pot - c.v, -c.p.abr * 1.3 * dt);
    // regula: pe dreaptă câștigă nitro; în viraje câștigă Atacul
    if (din && gap < 16 && din.fin === null) {
      const fr = c.prof[idx(c.s + 40)] < c.v * .8, dn = din.nOn && DREAPTA(din.s);
      c.pr += Math.max(0, pot / Math.max(din.v, 1) - 1) * dt * 6;
      // cine îl atacă pe cel din față împinge; cel din față care se apără de el închide linia
      const ataca = c.mod.k === 'atac' && c.mod.pe === din, apara = din.mod.k === 'apara' && din.mod.pe === c;
      if (dr) c.pr += ((c.nOn ? 2.2 : 0) - (dn ? 2.2 : 0) - (apara ? .7 : 0)) * dt;
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
// rezervorul se umple din frânări: perfectă = o celulă întreagă, medie = jumătate, ratată = nimic
function umple(c, sc) { if (CM.umple(c, sc) && c.eu) clipeste(); }
function clipeste() { const nb = $('nb'); nb.classList.remove('plin'); void nb.offsetWidth; nb.classList.add('plin'); }
// nitro: cât ții apăsat
const nitroPe = v => {
  if (!eu) return;
  const nou = !!(v && pornit);
  if (nou !== eu.tine && eu.intr) eu.intr.n.push(eu.k);
  eu.tine = nou; $('nb').classList.toggle('apasat', nou);
};
$('nb').addEventListener('pointerdown', e => { e.preventDefault(); try { $('nb').setPointerCapture(e.pointerId); } catch {} nitroPe(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('nb').addEventListener(ev, () => nitroPe(false));
$('nb').addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.code === 'KeyN' && !e.repeat) nitroPe(true); });
document.addEventListener('keyup', e => { if (e.code === 'KeyN') nitroPe(false); });
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
  let r;
  // în turul lansat: frânarea din model, notată cu pasul ei (serverul reface turul din apăsări)
  if (eu.intr) { const e = Math.round(mom.e * 1e4) / 1e4, n0 = eu.nitro; r = P.frana(eu, mom.cheie, e); if (!r) return; eu.intr.f.push([eu.k, mom.cheie, e]); if (eu.nitro > n0) clipeste(); }
  else { r = nota(mom.e, mom.fer); eu.q[mom.cheie] = r; eu.st.franari++; eu.st.scor += r.sc; umple(eu, r.sc); }
  mom.rez = r; mom.rezT = 1.1; eu.puls = .6;
  window.Shared && Shared.haptic(r.sc >= .6 ? 'success' : r.sc > 0 ? 'tick' : 'error');
  const fb = $('fb'); fb.classList.remove('bun', 'rau'); void fb.offsetWidth; fb.classList.add(r.sc > 0 ? 'bun' : 'rau');
}
$('fb').addEventListener('pointerdown', e => { e.preventDefault(); franeaza(); });
document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (START && eu && !eu.lansat) pleaca(); else franeaza(); } });
$('hb').addEventListener('click', () => { harta = !harta; $('hb').classList.toggle('on', harta); });
const vg = (a, b) => Math.max(0, (a.s - b.s) / Math.max(b.v, 20));
function hudSolo() {
  const timp = eu.t0 === null ? 0 : (eu.fin !== null ? eu.fin - eu.t0 : t - eu.t0), pp = $('pp'), lans = eu.t0 === null;
  if (pp.classList.contains('lans') && !lans) { pp.classList.add('linie'); window.Shared && Shared.haptic('tick'); }
  pp.classList.toggle('lans', lans);
  pp.textContent = lans ? 'Tur lansat' : fT(timp);
  const F = FANT;
  $('pf').innerHTML = eu.sect.map((x, i) => { const d = F && F.sect && F.sect[i] != null ? x - F.sect[i] : null; return `S${i + 1} <span style="color:${d == null ? '#cfd3da' : d <= 0 ? '#b57bff' : '#f5c542'}">${d == null ? fT(x) : fD(d)}</span>`; }).join(' · ') || '';
  $('pb').innerHTML = F ? `<i style="background:${F.d.col}"></i>${F.d.n} <span style="color:#cfd3da">${fT(F.timp)}</span>` : '';
  $('turn').textContent = PREMIU ? { cupa: 'Cupa', sapt: 'Săptămâna', camera: 'Camera' }[PREMIU.tip] : WK ? WK.etape[WK.k][0] : 'Antren.';
}
const f1 = x => x.toFixed(1).replace('.', ',');
let popT = 0;
function hud(dt) {
  const o = ord(), k = o.indexOf(eu), din = k > 0 ? o[k - 1] : null, spate = o[k + 1], gap = din ? din.s - eu.s : 1e9, gs = spate ? eu.s - spate.s : 1e9;
  if (TURURI === 1) { hudSolo(); } else {
  $('pp').innerHTML = `P${k + 1}<small>/${C.length}</small>`;
  $('pf').innerHTML = !eu.lansat ? '' : din ? `<i style="background:${din.col}"></i>${din.sc} <span style="color:#cfd3da">+${vg(din, eu).toFixed(3).replace('.', ',')}</span>` : '<span style="color:#2ecc71">În frunte</span>';
  $('pb').innerHTML = eu.lansat && spate && gs < 25 ? `<i style="background:${spate.col}"></i>${spate.sc} <span style="color:#ed1b2f">−${vg(eu, spate).toFixed(3).replace('.', ',')}</span>` : '';
  $('turn').textContent = `Tur ${Math.min(TURURI, Math.max(1, eu.tura + 1))}/${TURURI}`;
  }
  if (pornit && TURURI > 1 && k + 1 !== pozVeche) { const d = pozVeche - (k + 1); $('pop').textContent = (d > 0 ? '+' : '−') + Math.abs(d); $('pop').style.color = d > 0 ? '#2ecc71' : '#ed1b2f'; $('pop').classList.add('on'); popT = 1.1; pozVeche = k + 1; }
  popT -= dt; if (popT <= 0) $('pop').classList.remove('on');
  const dr = DREAPTA(eu.s), activ = pornit && eu.fin === null && eu.pit <= 0;
  const nb = $('nb'), N = eu.p.nitro; nb.classList.toggle('act', eu.nOn); nb.classList.toggle('off', eu.nitro < .05); nb.classList.toggle('gol', !N.celule);
  nb.classList.toggle('puls', activ && dr && eu.nitro >= 1 && !eu.nOn && (gap < 28 || gs < 14));
  // fără piesa Nitro: butonul stinge și trimite la Garaj (o celulă pe nivel cumpărat)
  const bt = nb.querySelector('.bt'); if (bt.dataset.n !== String(N.celule)) { bt.innerHTML = N.celule ? '<i></i>'.repeat(N.celule) : '<b>Garaj</b>'; bt.dataset.n = N.celule; }
  [...bt.children].forEach((x, k) => x.style.setProperty('--f', Math.max(0, Math.min(1, eu.nitro - k)).toFixed(2)));
  // ritmul: butonul potrivit pulsează când are pe cine ataca sau de cine să te aperi
  document.querySelector('#ct [data-r=atac]').classList.toggle('puls', activ && gap < 30 && eu.ritm !== 'atac');
  document.querySelector('#ct [data-r=apara]').classList.toggle('puls', activ && gs < 22 && gap >= 30 && eu.ritm !== 'apara');
  $('vw').classList.toggle('nitro', eu.nOn && dr);
  // frâna: momentul pornește cu ANUNT secunde înainte de panou
  const u = grupUrmator(), fb = $('fb'), D = ANUNT + DUPA;
  if (activ && u && !mom && u.sec <= ANUNT && u.sec > 0 && !(u.cheie in eu.q)) {
    mom = { cheie: u.cheie, G: u.G, fer: ferMasina(eu, u.G), rez: null, rezT: 0, e: -u.sec, trecut: null };
    anuntate++;
    let ghid = 0; try { ghid = +localStorage.getItem('frq_cursa_ghid') || 0; if (ghid < 2) localStorage.setItem('frq_cursa_ghid', ghid + 1); } catch { ghid = 2; }
    $('fbt').textContent = ghid < 2 ? 'Frână la panou' : u.G.membri.length > 1 ? u.G.eticheta : '';
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
const potrivesteScena = () => { if (!vw.clientWidth || !vw.clientHeight) return; W = vw.clientWidth; H = vw.clientHeight; R.setSize(W, H); CAM.aspect = W / H; CAM.updateProjectionMatrix(); HH = inaltHarta(); };
addEventListener('resize', potrivesteScena);
if (window.ResizeObserver) new ResizeObserver(potrivesteScena).observe(vw);
// bara de jos (Acasă, Jocuri, Garaj, Profil) doar pe meniurile Cursei, nu pe pistă și nu la rezultate
const CU_BARA_JOS = new Set(['meniu', 'cupa', 'sapt', 'prieteni', 'camera']);
const baraJos = () => { const ov = $('ov'); document.body.dataset.tabbar = ov.style.display !== 'none' && CU_BARA_JOS.has(ov.dataset.ecran) ? 'da' : 'nu'; };
new MutationObserver(baraJos).observe($('ov'), { attributes: true, attributeFilter: ['style', 'data-ecran'] });
function desen(dt) {
  tz += dt;
  const o = ord(), k0 = o.indexOf(eu), spate = o[k0 + 1], pericol = pornit && spate && eu.s - spate.s < 16 && eu.fin === null;
  const af = alfa();
  C.forEach((c, k) => {
    const sD = c.sA == null ? c.s : c.sA + (c.s - c.sA) * af, lD = c.lA == null ? c.latC : c.lA + (c.latC - c.lA) * af;
    const G = GM[k], i = idx(sD), j = (i + 1) % N, u = ((sD / step) % 1 + 1) % 1;
    let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u;
    G.grup.position.set(X[i] + (X[j] - X[i]) * u - Math.sin(h) * lD, 0, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * lD); G.grup.rotation.y = -h;
    const poz = String(o.indexOf(c) + 1); if (poz !== G.poz) { G.poz = poz; G.j.desen(poz); }
    const m = harta ? 3.8 : 1, z = (c.eu ? 6.8 : 5.7) * m; G.sp.scale.set(z, z, 1);
    const n = c.nOn; G.fl.visible = n && !harta; G.rn.visible = n; if (n) { G.fl.scale.x = .8 + Math.random() * .5; G.rn.scale.set(z * 1.25, z * 1.25, 1); }
    G.rr.visible = c.eu && pericol; if (G.rr.visible) { const q = z * (1.2 + .12 * Math.sin(tz * 10)); G.rr.scale.set(q, q, 1); }
    // pulsul de la frânare: un inel alb care se lărgește și se stinge
    G.ra.visible = c.puls > 0; if (c.puls > 0) { const f = 1 - c.puls / .6, q = z * (1.1 + f * 1.4); G.ra.scale.set(q, q, 1); G.ra.material.opacity = c.puls / .6; c.puls = Math.max(0, c.puls - dt); }
  });
  if (FG && FANT) {
    // urma are o poziție la 0,1 s: fantoma alunecă între ele și între punctele pistei, ca mașinile
    const U = FANT.urma, f = Math.max(0, Math.min(U.length - 1, (t - CM.DT * (1 - af)) / .1)), a = Math.floor(f), b = Math.min(U.length - 1, a + 1);
    const sF = U[a] + (U[b] - U[a]) * (f - a), i = idx(sF), j = (i + 1) % N, u = ((sF / step) % 1 + 1) % 1;
    let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u;
    FG.position.set(X[i] + (X[j] - X[i]) * u - Math.sin(h) * 2.5, 5, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * 2.5); const z = harta ? 22 : 6; FG.scale.set(z, z, 1);
  }
  if (harta) { S.fog.far = 9000; CAM.up.set(-1, 0, 0); CAM.position.set((x0 + x1) / 2, HH, (y0 + y1) / 2); CAM.lookAt((x0 + x1) / 2, 0, (y0 + y1) / 2); }
  else {
    S.fog.far = 620; CAM.up.set(0, 1, 0);
    const f = GM[eu.i].grup.position;
    if (!camOk) { tinta.copy(f); camOk = true; } else tinta.lerp(f, 1 - Math.exp(-dt * 12));
    CAM.position.set(tinta.x + 50, 72, tinta.z + 66); CAM.lookAt(tinta.x, 0, tinta.z);
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
const titluOv = txt => `<p class="et">${txt}</p>`;
const pozaMare = c => c.image.replace(/\/\d+px-/, '/500px-');
const clsBadge = v => { const k = CM.clasa(v); return `<span class="cls cls-${k}">${k} ${v}</span>`; };
const randQ = (d, i, timp, extra = '') => `<div class="qr${d.eu ? ' eu' : ''}${extra}"><span>${i + 1}</span>${tok(d)}<span class="nm"><b>${d.n}</b><small>${d.m}</small></span><b>${timp}</b></div>`;
const ICON = {
  complet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  calif: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  antren: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>',
};
let ajutor = false;
// ---------- meniul: mașina ta, modul, calificarea ----------
function ecranStart() {
  START = null; WK = null; FANT = null;
  const g = garajulMeu(), sc = CM.scor(aleasa.c, aleasa.nivel);
  const rand = (x, i) => `<button type="button" class="alm${cheieM(x.c) === cheieM(aleasa.c) && x.nivel === aleasa.nivel ? ' on' : ''}" data-i="${i}">${tok({ c: x.c })}<span><b>${x.c.name}</b> <small>${x.c.years}</small><br>${clsBadge(x.scor)}<small>${x.nivel ? 'tunată' : 'stoc'}</small></span></button>`;
  const mod = (k, titlu, sub) => `<button type="button" class="mc${SES.mod === k ? ' on' : ''}" data-mod="${k}">${ICON[k]}<b>${titlu}</b><small>${sub}</small></button>`;
  $('ov').innerHTML = `<button type="button" class="ajut" id="aj" aria-label="Cum se joacă">?</button>
    ${titluOv('Cursa · Serpentine')}
    <div class="mcar"><img src="${pozaMare(aleasa.c)}" alt="" referrerpolicy="no-referrer">
      ${g.length > 1 || (g.length && aleasa.imprumut) ? '<button type="button" id="schimb" class="sch">Schimbă</button>' : ''}
      <div class="mci"><p class="d" style="font-size:26px">${aleasa.c.name}</p><p class="an">${clsBadge(sc.v)}${aleasa.c.years}${aleasa.imprumut ? ' · de împrumut' : aleasa.nivel ? ' · tunată' : ''}</p></div></div>
    ${alegLista ? `<div class="alg">${g.map(rand).join('')}</div>` : ''}
    ${!g.length ? '<p class="sub" style="font-size:11px">Deschide Garajul o dată pe telefonul ăsta și mașinile tale apar aici.</p>' : ''}
    ${ajutor ? `<div class="lg">
      <span>${pict('#fb', 30, 30)}</span><span>La virajele mari apare frâna. Apasă când punctul ajunge la mijlocul arcului verde.</span>
      <span style="color:#22d3ee">${pict('#nb', 16, 22)}</span><span>Nitro: ține apăsat. Pe dreaptă dă cel mai mult. Frânările bune umplu rezervorul. Se cumpără din Garaj, o celulă pe nivel.</span>
      <span style="color:#ed1b2f">${pict('[data-r=atac]', 22, 22)}</span><span>Atac: îl ataci pe cel din față. Roțile se duc mai repede.</span>
      <span style="color:#3d7bff">${pict('[data-r=apara]', 22, 22)}</span><span>Apără: îi închizi linia celui din spate.</span>
      <span>${pict('#px', 26, 26)}</span><span>Anvelopele. O atingere și intri la boxe.</span>
      <span style="color:#ff2a3d;font:900 20px var(--display)">●</span><span>La start, când se sting luminile, apasă Pleacă. Mai devreme: +3 s.</span>
    </div>` : ''}
    <div class="mmod">${mod('complet', 'Weekend', 'Calificare și cursă')}${mod('calif', 'Calificare', 'Doar turul rapid')}${mod('antren', 'Antrenament', 'Cu fantoma ta')}</div>
    ${SES.mod !== 'antren' ? `<div class="mseg" data-g="calif"><button type="button" data-v="scurta" class="${SES.calif === 'scurta' ? 'on' : ''}">Un tur</button><button type="button" data-v="lunga" class="${SES.calif === 'lunga' ? 'on' : ''}">Q1 · Q2 · Q3</button></div>` : ''}
    <button type="button" class="go" id="go">${SES.mod === 'antren' ? 'Pe pistă' : 'Începe'}</button>
    ${E ? `${titluOv('Online')}<div class="mpr">${randPremiu('cupa')}${randPremiu('sapt')}${randPremiu('prieteni')}</div>` : ''}`;
  $('ov').dataset.ecran = 'meniu'; adresa('');
  $('ov').style.display = 'flex';
  $('go').onclick = incepe;
  $('ov').querySelectorAll('.pr').forEach(b => b.onclick = () => (b.dataset.pr === 'cupa' ? ecranCupa() : b.dataset.pr === 'sapt' ? ecranSapt() : ecranPrieteni()));
  $('aj').onclick = () => { ajutor = !ajutor; ecranStart(); };
  $('ov').querySelectorAll('.mc').forEach(b => b.onclick = () => { SES.mod = b.dataset.mod; ecranStart(); });
  $('ov').querySelectorAll('.mseg button').forEach(b => b.onclick = () => { SES.calif = b.dataset.v; ecranStart(); });
  const sch = $('schimb'); if (sch) sch.onclick = () => { alegLista = !alegLista; ecranStart(); };
  $('ov').querySelectorAll('.alm').forEach(b => b.onclick = () => {
    aleasa = g[+b.dataset.i]; alegLista = false;
    try { localStorage.setItem('frq_cursa_masina', `${cheieM(aleasa.c)}#${aleasa.nivel}`); } catch { /* fără stocare */ }
    soloNou(); scena(); ecranStart();
  });
}
// ---------- cu premii: Cupa de duminică și Turul săptămânii ----------
// Un tur lansat, refăcut pe server din apăsări (cursa-model.js): Cupa cu mașina cupei (aceeași
// pentru toți, trei încercări), Turul săptămânii cu mașina ta (clasament pe clase, premii luni).
const E = window.Economie, Cloud = () => window.FrqCloud || null;
const MD = window.DragModel && E ? window.DragModel.creeaza(window.CARS || []) : null;
const PR = { cupa: null, sapt: null };
let PREMIU = null, PARTIDA = null;
// adresa ecranului de acum, fără un pas nou în istoric (Shared.mergi; vezi „Înapoi” în shared.js)
let adresaInterna = false;
function adresa(h) {
  if ((location.hash || '') === h || (!h && location.hash.length <= 1)) return;
  adresaInterna = true;
  try { if (window.Shared && Shared.mergi) Shared.mergi(h || '#'); else history.replaceState(null, '', h || location.pathname + location.search); } finally { adresaInterna = false; }
}
const ICON_CUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>';
const ICON_SAPT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
function cupaLocal() {
  const z = E.ziua(), d = E.ziDinSaptamana(z), data = d === 0 ? z : E.laData(z, 7 - d), c = MD && MD.masinaZilei(`cupa-${data}`);
  return { deschisa: d === 0, data, masina: c ? cheieM(c) : null, incercari: E.CUPA.incercari, eu: null, local: true };
}
// starea de pe server (doar cu cont: o vizită nu face cont); fără cont, cupa se socotește aici
async function incarcaPremii() {
  if (!E) return;
  const C0 = Cloud();
  try {
    if (C0 && C0.areCont()) { const st = await C0.cursa({ actiune: 'stare' }); PR.cupa = st.cupa; PR.sapt = st.sapt; }
    else { PR.cupa = cupaLocal(); PR.sapt = { luni: E.luni(E.ziua()) }; }
  } catch { if (!PR.cupa) PR.cupa = cupaLocal(); }
  if ($('ov').dataset.ecran === 'meniu' && $('ov').style.display !== 'none') ecranStart();
}
const clasaMea = () => CM.clasa(scorMasina(aleasa.c, aleasa.nivel));
function randPremiu(k) {
  let sub = '…', icon = ICON_SAPT, titlu = 'Turul săptămânii';
  if (k === 'cupa') {
    titlu = 'Cupa de duminică'; const c = PR.cupa, car = c && c.masina && DUPA_CHEIE.get(c.masina);
    icon = car ? tok({ car, col: '#f5c542' }) : ICON_CUPA;
    if (c) {
      const ramase = c.incercari - (c.eu ? c.eu.folosite : 0);
      sub = !c.deschisa ? `Duminică · locul 1: ${E.CUPA.premii[0]} mil. și mașina` : c.eu && c.eu.timp != null ? `Azi · locul ${c.eu.loc} · ${fT(c.eu.timp / 1000)}` : ramase > 0 ? `Azi · ${ramase} încercări` : 'Azi · gata';
    }
  } else if (k === 'prieteni') { titlu = 'Cameră cu prietenii'; icon = ICON_PRIETENI; sub = CAMR ? `Camera ${CAMR.cod}` : 'Un cod, până la 10 piloți, și cursă live'; }
  else sub = aleasa.imprumut ? `Cu mașina ta · ${E.CURSA.sapt.premii[0]} mil. pe clasă` : `Clasa ${clasaMea()} · ${aleasa.c.name}`;
  return `<button type="button" class="pr" data-pr="${k}"><span class="pri">${icon}</span><span class="prt"><b>${titlu}</b><small>${sub}</small></span><span class="prs">›</span></button>`;
}
const randL = (x, timp) => `<div class="qr fara${x.eu ? ' eu' : ''}"><span>${x.loc}</span><span class="nm"><b>${String(x.nume).replace(/[<>&"]/g, '')}</b>${x.masina && DUPA_CHEIE.get(x.masina) ? `<small>${DUPA_CHEIE.get(x.masina).name}</small>` : ''}</span><b>${timp}</b></div>`;
const premiiChips = l => `<div class="prz">${l.map((x, i) => `<span><b>${i + 1}</b>${x}</span>`).join('')}</div>`;
const listaGoala = txt => `<p class="sub" style="font-size:12px;padding:14px 0">${txt}</p>`;
async function ecranCupa() {
  const c = PR.cupa || cupaLocal(), car = c.masina && DUPA_CHEIE.get(c.masina);
  if (!car) { ecranStart(); return; }
  const ramase = c.incercari - (c.eu ? c.eu.folosite : 0);
  const buton = !c.deschisa ? `Duminică, ${zi(c.data)}` : ramase > 0 ? (ramase === 1 ? 'Aleargă · ultima' : `Aleargă · ${ramase} rămase`) : 'Ai folosit încercările';
  $('ov').dataset.ecran = 'cupa'; adresa('#cupa');
  $('ov').innerHTML = `${titluOv('Cupa de duminică')}
    <div class="mcar mic"><img src="${pozaMare(car)}" alt="" referrerpolicy="no-referrer">
      <div class="mci"><p class="d" style="font-size:22px">${car.name}</p><p class="an">${clsBadge(scorMasina(car, 0))}aceeași pentru toți</p></div></div>
    <p class="sub">Un tur, ${c.incercari} încercări. Contează cel mai bun.</p>
    ${premiiChips([`${E.CUPA.premii[0]} mil. + mașina`, `${E.CUPA.premii[1]} mil.`, `${E.CUPA.premii[2]} mil.`])}
    <div class="qt lst" id="lcl">${listaGoala('Clasamentul se încarcă…')}</div>
    <button type="button" class="go" id="go"${c.deschisa && ramase > 0 ? '' : ' disabled'}>${buton}</button>
    <button type="button" class="go gh" id="go3">Înapoi</button>`;
  $('ov').style.display = 'flex';
  $('go3').onclick = ecranStart;
  $('go').onclick = () => pornestePremiu('cupa', car, 0);
  const C0 = Cloud(); if (!C0) return;
  try {
    const l = await C0.clasamentCupa(c.data, 20);
    if ($('ov').dataset.ecran !== 'cupa') return;
    $('lcl').innerHTML = l.top && l.top.length ? l.top.map(x => randL(x, fT(x.timp / 1000))).join('') : listaGoala(c.deschisa ? 'Niciun tur încă. Fii primul.' : 'Se deschide duminică.');
  } catch { if ($('ov').dataset.ecran === 'cupa') $('lcl').innerHTML = listaGoala('Clasamentul nu se poate încărca acum.'); }
}
const zi = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
let clasaSapt = null;
async function ecranSapt() {
  const k = clasaSapt || clasaMea(), C0 = Cloud(), cont = !!(C0 && C0.areCont());
  const poate = !aleasa.imprumut && clasaMea() === k;
  $('ov').dataset.ecran = 'sapt'; adresa('#sapt');
  $('ov').innerHTML = `${titluOv('Turul săptămânii')}
    <p class="sub">Un tur cu mașina ta. Premii luni, în fiecare clasă.</p>
    ${premiiChips(E.CURSA.sapt.premii.map(x => `${x} mil.`))}
    <div class="mseg cls5">${['D', 'C', 'B', 'A', 'S'].map(x => `<button type="button" data-k="${x}" class="${x === k ? 'on' : ''}"><span class="cls cls-${x}">${x}</span></button>`).join('')}</div>
    <div class="qt lst" id="lcl">${listaGoala(cont ? 'Clasamentul se încarcă…' : 'Clasamentul apare după primul tău tur.')}</div>
    <button type="button" class="go" id="go"${poate ? '' : ' disabled'}>${aleasa.imprumut ? 'Ai nevoie de o mașină din garaj' : poate ? `Aleargă cu ${aleasa.c.name}` : `Mașina ta e în clasa ${clasaMea()}`}</button>
    <button type="button" class="go gh" id="go3">Înapoi</button>`;
  $('ov').style.display = 'flex';
  $('go3').onclick = () => { clasaSapt = null; ecranStart(); };
  $('go').onclick = () => pornestePremiu('sapt', aleasa.c, aleasa.nivel);
  $('ov').querySelectorAll('.cls5 button').forEach(b => b.onclick = () => { clasaSapt = b.dataset.k; ecranSapt(); });
  if (!cont) return;
  try {
    const l = await C0.cursa({ actiune: 'sapt', clasa: k });
    if ($('ov').dataset.ecran !== 'sapt' || (clasaSapt || clasaMea()) !== k) return;
    const rand = l.top.map(x => randL(x, fT(x.timp / 1000))).join('') + (l.eu && l.eu.loc > l.top.length ? randL(l.eu, fT(l.eu.timp / 1000)) : '');
    $('lcl').innerHTML = rand || listaGoala('Niciun tur în clasa asta săptămâna asta.');
  } catch { if ($('ov').dataset.ecran === 'sapt') $('lcl').innerHTML = listaGoala('Clasamentul nu se poate încărca acum.'); }
}
// Un tur cu premii: la Cupă, încercarea se consumă de la start (pe server)
async function pornestePremiu(tip, car, nivel) {
  const C0 = Cloud(); if (!C0) return;
  const go = $('go'); go.disabled = true; go.textContent = 'Un moment…';
  if (tip === 'cupa') {
    try { const r = await C0.cursa({ actiune: 'cupa-start' }); if (PR.cupa) PR.cupa.eu = { ...(PR.cupa.eu || { timp: null, loc: null }), folosite: r.folosite }; }
    catch (e) { const k = await C0.codEroare(e); go.textContent = k === 'fara incercari' ? 'Ai folosit încercările' : k === 'inchisa' ? 'Cupa e închisă' : 'Nu merge acum. Mai încearcă.'; return; }
  }
  PREMIU = { tip, car, nivel, inapoi: aleasa, cod: CAMR && CAMR.cod };
  if (tip === 'cupa' || (tip === 'camera' && CAMR.mod === 'aceeasi')) aleasa = { c: car, nivel: 0, imprumut: true, scor: scorMasina(car, 0) };
  WK = null;
  const rec = recordul();
  soloNou(rec ? { timp: rec.timp, urma: rec.urma, sect: rec.sect, d: { n: 'Recordul tău', sc: 'REC', m: '', car: aleasa.c, col: '#ffffff' } } : null); scena();
  $('ov').dataset.ecran = ''; $('ov').style.display = 'none'; pornit = true; intra();
}
async function finalPremiu(timp) {
  const P0 = PREMIU, intr = eu.intr, C0 = Cloud();
  PREMIU = null; aleasa = P0.inapoi;
  const titlu = P0.tip === 'cupa' ? 'Cupa de duminică' : P0.tip === 'camera' ? `Camera ${P0.cod}` : 'Turul săptămânii';
  $('ov').dataset.ecran = 'rezultat'; adresa('#rezultat');
  $('ov').innerHTML = `${titluOv(titlu)}<p class="d" style="font-size:60px">${fT(timp)}</p>
    <p class="sub" id="vrf">Se verifică turul…</p>
    <button type="button" class="go" id="go" disabled>${P0.tip === 'cupa' ? 'Clasamentul cupei' : P0.tip === 'camera' ? 'Înapoi în cameră' : 'Clasamentul'}</button>
    <button type="button" class="go gh" id="go3">Meniu</button>`;
  $('ov').style.display = 'flex';
  $('go3').onclick = () => { soloNou(); scena(); ecranStart(); incarcaPremii(); };
  const laClasament = () => { soloNou(); scena(); P0.tip === 'cupa' ? ecranCupa() : P0.tip === 'camera' ? ecranCamera(P0.cod) : ecranSapt(); };
  const trimite = async () => {
  let txt, reia = false;
  try {
    const nume = C0.numeLocal() || undefined;
    if (P0.tip === 'camera') {
      const r = await C0.cursa({ actiune: 'camera-tur', cod: P0.cod, intrari: intr, masina: cheieM(P0.car), exemplar: P0.inapoi.ex ?? undefined, nume });
      txt = r.record ? `Locul ${r.loc} din ${r.total} în cameră.` : `Rămâi pe locul ${r.loc}, cu ${fT(r.cel_mai_bun / 1000)}.`;
    } else if (P0.tip === 'cupa') {
      const r = await C0.cursa({ actiune: 'cupa-tur', intrari: intr, nume });
      txt = r.record ? 'Cel mai bun tur al tău în cupă. Se vede în clasament.' : `Cel mai bun rămâne ${fT(r.cel_mai_bun / 1000)}.`;
    } else {
      const r = await C0.cursa({ actiune: 'sapt-tur', masina: cheieM(P0.car), exemplar: P0.inapoi.ex ?? undefined, intrari: intr, nume });
      clasaSapt = r.clasa;
      txt = r.record ? `Clasa ${r.clasa}: locul ${r.loc} din ${r.total}.` : `Clasa ${r.clasa}: rămâi pe locul ${r.loc}, cu ${fT(r.cel_mai_bun / 1000)}.`;
    }
  } catch (e) {
    const k = C0 ? await C0.codEroare(e) : null;
    txt = k === 'inchisa' ? 'Camera s-a închis.' : k === 'plina' ? 'Camera e plină (10 piloți).' : k === 'tur' ? 'Turul nu s-a putut verifica.' : k === 'nu e a ta' ? 'Mașina nu apare în garajul tău. Deschide Garajul și încearcă din nou.' : 'Fără semnal: turul nu s-a trimis.';
    reia = !['inchisa', 'plina', 'tur', 'nu e a ta'].includes(k);
  }
  if ($('ov').dataset.ecran !== 'rezultat') return;
  $('vrf').textContent = txt;
  const go = $('go');
  if (reia) { go.disabled = false; go.textContent = 'Trimite din nou'; go.onclick = () => { go.disabled = true; go.textContent = 'Un moment…'; $('vrf').textContent = 'Se verifică turul…'; trimite(); }; return; }
  go.disabled = false; go.textContent = P0.tip === 'cupa' ? 'Clasamentul cupei' : P0.tip === 'camera' ? 'Înapoi în cameră' : 'Clasamentul'; go.onclick = laClasament;
  incarcaPremii();
  };
  trimite();
}
// Cursa cu boții: partida pe server de la plecare, ca să plătească după loc (în plafonul zilei)
function pornestePartida() {
  PARTIDA = null; const C0 = Cloud();
  if (!C0 || !E || SES.mod !== 'complet') return;
  PARTIDA = { id: null, gata: C0.cursa({ actiune: 'start', mod: SES.calif }).then(r => { PARTIDA && (PARTIDA.id = r.id); }).catch(() => { PARTIDA = null; }) };
}
async function inchidePartida(loc) {
  const P0 = PARTIDA, C0 = Cloud(); PARTIDA = null;
  if (!P0 || !C0) return;
  const perfecte = Object.values(eu.q).filter(x => x && x.sc >= .9).length;
  let html = '';
  try {
    await P0.gata; if (!P0.id) throw new Error('fără partidă');
    const r = await C0.cursa({ actiune: 'final', id: P0.id, loc, perfecte });
    if (r.valid) { html = C0.randBani(r.bani, 'cursa'); C0.anuntaMisiuni(r.misiuni); }
  } catch { html = '<span class="sub">Banii cursei nu s-au putut trimite.</span>'; }
  const el = $('fbani'); if (el) el.innerHTML = html;
}
if (E) { incarcaPremii(); }
// ---------- camerele cu prietenii ----------
// Un cod, până la 10 piloți. Fiecare face tururi până se închide camera (o oră sau o zi); contează
// cel mai bun, refăcut pe server. Din cameră, gazda pornește o cursă live: toți deodată, pe
// telefoanele lor, cu grila din clasamentul camerei. Fiecare telefon își simulează mașina și o
// trimite celorlalți (Realtime); mașinile prietenilor vin din rețea.
const ICON_PRIETENI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.9.2 5 2.1 5 5.4"/></svg>';
let CAMR = null, camTimer = null, LIVE = null;
const PRIET = { mod: 'aceeasi', ore: 1 };
const linkCamera = cod => `${location.origin}${location.pathname}#camera=${cod}`;
const curat = x => String(x).replace(/[<>&"]/g, '');
function ecranPrieteni(msg) {
  oprireCamera();
  $('ov').dataset.ecran = 'prieteni'; adresa('#prieteni');
  const seg = (g, v, txt, on) => `<button type="button" data-g="${g}" data-v="${v}" class="${on ? 'on' : ''}">${txt}</button>`;
  $('ov').innerHTML = `${titluOv('Cameră cu prietenii')}
    <p class="sub">Faceți tururi până se închide camera. Contează cel mai bun. Apoi, dacă vreți, o cursă live, toți deodată.</p>
    <div class="mseg">${seg('mod', 'aceeasi', 'Aceeași mașină', PRIET.mod === 'aceeasi')}${seg('mod', 'a mea', 'Fiecare cu a lui', PRIET.mod === 'a mea')}</div>
    <p class="sub" style="font-size:11px">${PRIET.mod === 'aceeasi' ? `${aleasa.c.name}, stoc, pentru toți` : 'Fiecare aleargă cu mașina aleasă de el, cu tuningul ei'}</p>
    <div class="mseg">${seg('ore', 1, 'O oră', PRIET.ore === 1)}${seg('ore', 24, 'O zi', PRIET.ore === 24)}</div>
    <button type="button" class="go" id="go">Fă camera</button>
    ${titluOv('Ai un cod?')}
    <div class="cod"><input id="codin" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" aria-label="Codul camerei"><button type="button" class="go" id="go4">Intră</button></div>
    <p class="sub" id="pmsg" style="min-height:18px;color:#ff8a8a">${msg || ''}</p>
    <button type="button" class="go gh" id="go3">Înapoi</button>`;
  $('ov').style.display = 'flex';
  $('ov').querySelectorAll('.mseg button').forEach(b => b.onclick = () => { PRIET[b.dataset.g] = b.dataset.g === 'ore' ? +b.dataset.v : b.dataset.v; ecranPrieteni(); });
  $('go3').onclick = ecranStart;
  $('go4').onclick = () => { const cod = $('codin').value.trim().toUpperCase(); if (/^[A-Z0-9]{5}$/.test(cod)) ecranCamera(cod); else $('pmsg').textContent = 'Codul are 5 caractere.'; };
  $('go').onclick = async () => {
    const C0 = Cloud(); if (!C0) return;
    $('go').disabled = true; $('go').textContent = 'Un moment…';
    try { const r = await C0.cursa({ actiune: 'camera-noua', mod: PRIET.mod, masina: cheieM(aleasa.c), ore: PRIET.ore, nume: C0.numeLocal() || undefined }); ecranCamera(r.cod); }
    catch { ecranPrieteni('Camera nu s-a putut face acum.'); }
  };
}
function oprireCamera() { clearInterval(camTimer); camTimer = null; }
const ramas = c => { const ms = new Date(c.pana).getTime() - new Date(c.acum).getTime() - (Date.now() - c.primit); if (ms <= 0) return 'închisă'; const m = Math.ceil(ms / 60e3); return m >= 120 ? `mai e deschisă ${Math.round(m / 60)} ore` : `mai e deschisă ${m} min`; };
async function ecranCamera(cod) {
  const C0 = Cloud(); if (!C0) return;
  oprireCamera();
  $('ov').dataset.ecran = 'camera'; adresa('#camera=' + cod);
  if (!CAMR || CAMR.cod !== cod) {
    $('ov').innerHTML = `${titluOv(`Camera ${cod}`)}<p class="sub">Se deschide…</p>`; $('ov').style.display = 'flex';
    try { CAMR = { ...(await C0.cursa({ actiune: 'camera', cod, nume: C0.numeLocal() || undefined })), primit: Date.now() }; }
    catch (e) { const k = await C0.codEroare(e); CAMR = null; ecranPrieteni(k === 'nu exista' ? 'Nu există o cameră cu codul ăsta.' : 'Camera nu se poate deschide acum.'); return; }
  }
  const c = CAMR, car = c.mod === 'aceeasi' ? DUPA_CHEIE.get(c.masina) : aleasa.c, deschisa = ramas(c) !== 'închisă';
  $('ov').innerHTML = `${titluOv(`Camera ${c.cod}`)}
    <div class="camh"><span>${tok({ car, col: '#f5c542' })}</span><span><b>${c.mod === 'aceeasi' ? car.name : 'Fiecare cu mașina lui'}</b><small>${c.mod === 'aceeasi' ? 'stoc, pentru toți' : `tu: ${aleasa.c.name}`} · <i id="cram">${ramas(c)}</i></small></span>
      <button type="button" class="sch" id="share">Trimite codul</button></div>
    <div class="qt lst" id="lcl">${c.top.length ? c.top.map(x => randL(x, fT(x.timp / 1000))).join('') : listaGoala('Niciun tur încă. Trimite codul prietenilor.')}</div>
    <button type="button" class="go" id="go"${deschisa ? '' : ' disabled'}>${deschisa ? 'Un tur' : 'Camera s-a închis'}</button>
    <button type="button" class="go gh" id="go2">Cursă live</button>
    <button type="button" class="go gh" id="go3">Înapoi</button>`;
  $('ov').style.display = 'flex';
  $('go3').onclick = () => { oprireCamera(); ecranStart(); };
  $('go').onclick = () => { oprireCamera(); pornestePremiu('camera', car, c.mod === 'aceeasi' ? 0 : aleasa.nivel); };
  $('go2').onclick = () => { oprireCamera(); ecranLive(); };
  $('share').onclick = async () => {
    const url = linkCamera(c.cod), b = $('share');
    try { if (navigator.share) { await navigator.share({ title: 'Cursa FRQ', text: `Intră în camera mea: ${c.cod}`, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); b.textContent = 'Link copiat'; } catch { b.textContent = c.cod; }
  };
  // clasamentul se umple pe parcurs (și se cere acum, după un tur)
  const reia = async () => {
    if ($('ov').dataset.ecran !== 'camera') { oprireCamera(); return; }
    try {
      const n = await C0.cursa({ actiune: 'camera', cod: c.cod }); CAMR = { ...n, primit: Date.now() };
      if ($('ov').dataset.ecran !== 'camera') return;
      if (n.top.length) $('lcl').innerHTML = n.top.map(x => randL(x, fT(x.timp / 1000))).join('');
      $('cram').textContent = ramas(CAMR);
    } catch { /* data viitoare */ }
  };
  camTimer = setInterval(reia, 6000); reia();
}
// ---------- cursa live ----------
const masinaLive = () => (CAMR.mod === 'aceeasi' ? { c: DUPA_CHEIE.get(CAMR.masina), nivel: 0 } : { c: aleasa.c, nivel: aleasa.nivel });
async function ecranLive() {
  const C0 = Cloud(); if (!C0 || !CAMR) return;
  if (!LIVE || LIVE.cod !== CAMR.cod) {
    inchideLive();
    LIVE = { cod: CAMR.cod, euId: CAMR.eu_id, gazda: CAMR.gazda, piloti: new Map(), canal: null, inCursa: false, hb: null, ultim: 0 };
    try { LIVE.canal = await C0.canalLive(`cursa-${CAMR.id}`, laMesajLive); } catch { LIVE = null; ecranCamera(CAMR.cod); return; }
  }
  const m = masinaLive();
  LIVE.eu = { id: LIVE.euId, nume: C0.numeLocal() || 'Eu', masina: cheieM(m.c), nivel: m.nivel };
  const salut = () => LIVE && LIVE.canal && LIVE.canal.trimite({ t: 'h', ...LIVE.eu });
  salut(); clearInterval(LIVE.hb); LIVE.hb = setInterval(salut, 1500);
  $('ov').dataset.ecran = 'live'; adresa('#live');
  randLobby();
}
function pilotiLobby() {
  const acum = Date.now(), l = [LIVE.eu, ...[...LIVE.piloti.values()].filter(p => acum - p.vazut < 5000)];
  // ordinea grilei: clasamentul camerei, apoi cine n-are tur
  const loc = id => { const x = CAMR.top.find(t => t.id === id); return x ? x.loc : 99; };
  return l.slice(0, 10).sort((a, b) => loc(a.id) - loc(b.id) || a.id.localeCompare(b.id));
}
function randLobby() {
  if (!LIVE || $('ov').dataset.ecran !== 'live') return;
  const l = pilotiLobby();
  $('ov').innerHTML = `${titluOv(`Camera ${CAMR.cod} · live`)}
    <p class="d" style="font-size:44px">${l.length} ${l.length === 1 ? 'pilot' : 'piloți'}</p>
    <p class="sub">Trei tururi, toți deodată. Grila e clasamentul camerei.</p>
    <div class="qt lst" id="lcl">${l.map((p, i) => { const car = DUPA_CHEIE.get(p.masina); return randQ({ n: curat(p.nume), m: car ? car.name : '', car: car || IMPRUMUT, col: PILOTI[i % PILOTI.length][2], eu: p.id === LIVE.euId }, i, ''); }).join('')}</div>
    <button type="button" class="go" id="go"${LIVE.gazda && l.length >= 2 ? '' : ' disabled'}>${LIVE.gazda ? (l.length >= 2 ? 'Pornește cursa' : 'Așteaptă prietenii') : 'Gazda pornește cursa'}</button>
    <button type="button" class="go gh" id="go3">Înapoi în cameră</button>`;
  $('ov').style.display = 'flex';
  $('go3').onclick = () => { inchideLive(); ecranCamera(CAMR.cod); };
  $('go').onclick = () => {
    const grila = pilotiLobby(), msg = { t: 'start', grila, out: 4 * .8 + .8 + .4 + Math.random() * 1.8 };
    LIVE.canal.trimite(msg); startLive(msg);
  };
}
function laMesajLive(m) {
  if (!LIVE || !m || typeof m !== 'object' || typeof m.id !== 'string' && m.t !== 'start') return;
  if (m.t === 'h') {
    if (m.id === LIVE.euId) return;
    LIVE.piloti.set(m.id, { id: m.id, nume: String(m.nume || 'Pilot').slice(0, 16), masina: String(m.masina || ''), nivel: Math.max(0, Math.min(7775, m.nivel | 0)), vazut: Date.now() });
    if ($('ov').dataset.ecran === 'live' && Date.now() - LIVE.ultim > 700) { LIVE.ultim = Date.now(); randLobby(); }
  } else if (m.t === 'start' && !LIVE.inCursa && Array.isArray(m.grila) && m.grila.some(p => p && p.id === LIVE.euId)) startLive(m);
  else if (m.t === 'p' && LIVE.inCursa) {
    const c = C.find(x => x.rid === m.id); if (!c) return;
    c.sNet = +m.s || 0; c.netT = Number.isFinite(+m.tt) ? +m.tt : t; c.v = Math.max(0, +m.v || 0); c.latNet = Math.max(-5.2, Math.min(5.2, +m.l || 0));
    c.nOn = !!m.n; c.vazut = ceas; c.lansat = true; if (m.f != null && c.fin === null) c.fin = +m.f; c.tura = Math.max(0, Math.floor(c.sNet / L));
  }
}
function startLive(msg) {
  const grila = msg.grila.slice(0, 10).filter(p => p && typeof p.id === 'string');
  clearInterval(LIVE.hb); LIVE.inCursa = true; LIVE.trimis = 0; LIVE.finCeas = null;
  const defs = grila.map((p, i) => {
    const pilot = [curat(p.nume || 'Pilot').slice(0, 16), curat(p.nume || 'PIL').slice(0, 3).toUpperCase(), PILOTI[i % PILOTI.length][2]];
    if (p.id === LIVE.euId) { const m = masinaLive(); return masinaCursa(m.c, m.nivel, ['Tu', 'TU', '#d81528'], { eu: 1 }); }
    const car = DUPA_CHEIE.get(p.masina) || IMPRUMUT;
    return masinaCursa(car, Math.max(0, Math.min(7775, p.nivel | 0)), pilot, { remote: true, rid: p.id, sNet: null, latNet: 0, vazut: 0 });
  });
  cursaNoua(defs); scena();
  START.outFix = +msg.out || 4.8;
  $('ov').dataset.ecran = ''; $('ov').style.display = 'none'; pornit = true; START.t0 = ceas + .8; intra();
}
// Mașina unui prieten: spre poziția din ultimul mesaj, prelungită cu viteza lui (fără salturi).
// Mesajul spune și momentul din cursă când a plecat (`tt`): ceasul cursei pornește la fel pe toate
// telefoanele, deci întârzierea rețelei nu mai trage mașina în urmă (simulat: ~1 m în loc de ~10 m).
function pasRemote(c, dt) {
  if (c.sNet == null) return;
  if (ceas - c.vazut > 3) c.v = 0;
  const tinta = c.sNet + c.v * Math.max(-1.5, Math.min(1.5, t - c.netT));
  c.s += c.v * dt; c.s += (tinta - c.s) * Math.min(1, dt * 3);
  c.latC += (c.latNet - c.latC) * Math.min(1, dt * 5);
}
// cam 3 pe secundă: între ele mașina e prelungită lin pe telefonul celorlalți (simulat: eroare la fel
// ca la 8 pe secundă, sub 1 m în plus, și mai puține mesaje Realtime); finalul pleacă pe loc
function trimiteLive(acum) {
  if (!LIVE.canal || (!acum && ceas - LIVE.trimis < .3 && !(eu.fin !== null && !LIVE.finTrimis))) return;
  if (eu.fin !== null) LIVE.finTrimis = true;
  LIVE.trimis = ceas;
  LIVE.canal.trimite({ t: 'p', id: LIVE.euId, tt: Math.round(t * 1000) / 1000, s: Math.round(eu.s * 10) / 10, v: Math.round(eu.v * 10) / 10, l: Math.round(eu.latC * 10) / 10, n: eu.nOn ? 1 : 0, f: eu.fin });
}
function terminat() {
  if (TURURI === 1) return eu.fin !== null;
  if (!(LIVE && LIVE.inCursa)) {
    if (C.every(c => c.fin !== null)) return true;
    if (eu.fin === null) return false;
    if (finEu == null) finEu = ceas;
    if (ceas - finEu < 2.5) return false;
    // cei rămași pe pistă termină cu ritmul lor de până acum (ordinea dintre ei rămâne)
    for (const c of C) if (c.fin === null) c.fin = t + Math.max(0, TURURI * L - c.s) / Math.max(10, c.s / Math.max(t, 1)) + c.penal;
    return true;
  }
  if (eu.fin === null) return false;
  if (LIVE.finCeas == null) LIVE.finCeas = ceas;
  // după ce ai trecut linia: îi aștepți pe ceilalți, dar nu la nesfârșit (unul poate ieși din aplicație)
  return C.every(c => c.fin !== null || (c.remote && ceas - c.vazut > 5)) || ceas - LIVE.finCeas > 30;
}
function finalLive() {
  trimiteLive(true);
  const o = C.slice().sort((a, b) => (a.fin ?? 1e9) - (b.fin ?? 1e9) || b.s - a.s), p = o.indexOf(eu), t1 = o[0].fin;
  const loc = (c, i) => c ? `<div class="p${i + 1}${c.eu ? ' eu' : ''}">${tok(c)}<b>${i + 1}</b><small>${c.eu ? 'Tu' : c.n}</small></div>` : '<div></div>';
  $('ov').innerHTML = `${titluOv(`Camera ${CAMR.cod} · final`)}
    <div class="pod">${loc(o[1], 1)}${loc(o[0], 0)}${loc(o[2], 2)}</div>
    <p class="d" style="font-size:48px;margin-top:4px">P${p + 1}<span style="font-size:18px;color:#9aa0a9"> din ${o.length}</span></p>
    <div class="qt">${o.map((c, i) => randQ(c, i, c.fin == null ? '–' : i ? fD(c.fin - t1) : fT(c.fin - (c.t0 || 0)))).join('')}</div>
    <button type="button" class="go" id="go">Înapoi în cameră</button>`;
  $('ov').dataset.ecran = 'finallive'; $('ov').style.display = 'flex';
  $('go').onclick = () => { inchideLive(); soloNou(); scena(); ecranCamera(CAMR.cod); };
}
function inchideLive() { if (!LIVE) return; clearInterval(LIVE.hb); try { LIVE.canal && LIVE.canal.opreste(); } catch { /* deja închis */ } LIVE = null; }
// ---------- weekendul ----------
const ETAPE_LUNGI = [['Q1', 10, 7], ['Q2', 7, 5], ['Q3', 5, 5]];
function incepe() {
  if (SES.mod === 'antren') { adresa('#antrenament'); antrenament(); return; }
  adresa('#weekend');
  pregatesteRivali();
  WK = { etape: SES.calif === 'scurta' ? [['Calificare', 10, 10]] : ETAPE_LUNGI, k: 0, in: [definitiaMea(), ...RIVALI], coada: [], eliminat: null };
  etapa();
}
function etapa() {
  const [nume, n, trec] = WK.etape[WK.k];
  // boții își fac turul acum (simulat); cel mai rapid e fantoma ta
  WK.timpi = new Map(); let pol = null;
  for (const d of WK.in) if (!d.eu) { const r = turSolo(d); WK.timpi.set(d, r.timp); if (!pol || r.timp < pol.timp) pol = r; }
  WK.pol = pol;
  if (!WK.in.find(d => d.eu)) { inchideEtapa(); return; }
  soloNou(pol); scena();
  $('ov').innerHTML = `${titluOv(nume === 'Calificare' ? 'Calificare' : `Calificare · ${nume}`)}
    <p class="d" style="font-size:64px">${nume === 'Calificare' ? 'Un tur' : nume}</p>
    <p class="sub">${n} piloți${trec < n ? ` · primii ${trec} trec mai departe` : ' · ordinea face grila'}</p>
    <div class="qt">${randQ({ ...pol.d, eu: 0 }, 0, fT(pol.timp))}</div>
    <p class="sub" style="font-size:11px">Timpul de bătut. Fantoma lui merge lângă tine.</p>
    <button type="button" class="go" id="go">Pe pistă</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; intra(); };
}
function inchideEtapa() {
  const [nume, n, trec] = WK.etape[WK.k], ultima = WK.k === WK.etape.length - 1;
  const ordine = WK.in.slice().sort((a, b) => WK.timpi.get(a) - WK.timpi.get(b));
  const euPoz = ordine.findIndex(d => d.eu), euIn = euPoz >= 0;
  if (ultima) WK.grila = [...ordine, ...WK.coada]; else { WK.coada = [...ordine.slice(trec), ...WK.coada]; WK.in = ordine.slice(0, trec); }
  if (euIn && euPoz >= trec && !ultima) WK.eliminat = nume;
  const pol = WK.timpi.get(ordine[0]);
  const tabel = ordine.map((d, i) => (i === trec && trec < n ? '<div class="qsep"></div>' : '') + randQ(d, i, i ? fD(WK.timpi.get(d) - pol) : fT(pol), i >= trec ? ' out' : '')).join('');
  const urm = !ultima ? (euIn && euPoz >= trec ? 'Mai departe' : `Spre ${WK.etape[WK.k + 1][0]}`) : SES.mod === 'complet' ? 'Grila de start' : 'Rezultatul';
  $('ov').innerHTML = `${titluOv(nume === 'Calificare' ? 'Calificare' : `Calificare · ${nume}`)}
    ${euIn ? `<p class="d" style="font-size:56px">P${euPoz + 1}<span style="font-size:20px;color:#9aa0a9"> ${euPoz === 0 ? 'cel mai rapid' : euPoz >= trec ? 'eliminat' : `la ${fD(WK.timpi.get(ordine[euPoz]) - pol).slice(1)} s`}</span></p>` : ''}
    <div class="qt">${tabel}</div>
    <button type="button" class="go" id="go">${urm}</button>`;
  $('ov').style.display = 'flex';
  $('go').onclick = () => {
    if (!ultima) { WK.k++; if (WK.eliminat) { while (WK.k < WK.etape.length) simuleazaEtapa(); } else { etapa(); return; } }
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
  $('ov').innerHTML = `${titluOv('Calificare · final')}<p class="d" style="font-size:64px">P${p}</p>
    <p class="sub">${p === 1 ? 'Pole position.' : WK.eliminat ? `Ai ieșit în ${WK.eliminat}.` : `Pleci de pe locul ${p}.`}</p>
    <div class="qt">${WK.grila.map((d, i) => randQ(d, i, '')).join('')}</div>
    <button type="button" class="go" id="go">Meniu</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { soloNou(); scena(); ecranStart(); };
}
function ecranGrila() {
  cursaNoua(WK.grila); scena();
  const p = C.indexOf(eu) + 1;
  $('ov').innerHTML = `${titluOv('Cursa · 3 tururi')}<p class="d" style="font-size:56px">Pleci P${p}</p>
    <div class="qt">${C.map((d, i) => randQ(d, i, '', '')).join('')}</div>
    <button type="button" class="go" id="go">Pe grilă</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; START.t0 = ceas + .8; intra(); pornestePartida(); };
}
// ---------- antrenamentul: tururi singur, cu recordul pe mașină ----------
const cheieRec = () => `frq_cursa_rec2_${cheieM(aleasa.c)}#${aleasa.nivel}`;
const recordul = () => { try { return JSON.parse(localStorage.getItem(cheieRec()) || 'null'); } catch { return null; } };
// orice tur lansat cu o mașină îi poate bate recordul (antrenament, calificare, Cupă, săptămână, cameră)
function salveazaRecord(timp) {
  const rec = recordul(), nou = !rec || timp < rec.timp;
  if (nou) { try { localStorage.setItem(cheieRec(), JSON.stringify({ timp, urma: eu.urma, sect: eu.sect })); } catch { /* fără stocare */ } }
  return { rec, nou };
}
function antrenament() {
  WK = null;
  const rec = recordul();
  soloNou(rec ? { timp: rec.timp, urma: rec.urma, sect: rec.sect, d: { n: 'Recordul tău', sc: 'REC', m: '', car: aleasa.c, col: '#ffffff' } } : null); scena();
  $('ov').style.display = 'none'; pornit = true; intra();
}
function finalSolo() {
  const timp = eu.fin - eu.t0;
  const { rec, nou } = salveazaRecord(timp);
  if (PREMIU) { finalPremiu(timp); return; }
  if (WK) { WK.timpi.set(WK.in.find(d => d.eu), timp); inchideEtapa(); return; }
  // antrenament: recordul și fantoma lui
  const medie = eu.st.franari ? Math.round(eu.st.scor / eu.st.franari * 100) : 0;
  $('ov').innerHTML = `${titluOv('Antrenament')}<p class="d" style="font-size:60px">${fT(timp)}</p>
    <p class="sub" style="color:${nou ? '#2ecc71' : '#cfd3da'}">${nou ? (rec ? `Record nou, cu ${fD(rec.timp - timp).slice(1)} s mai bun.` : 'Primul tău record cu mașina asta.') : `Recordul: ${fT(rec.timp)} · ${fD(timp - rec.timp)} s`}</p>
    <p class="sub">Frânări: ${medie}%</p>
    <button type="button" class="go" id="go">Încă un tur</button>
    <button type="button" class="go gh" id="go3">Meniu</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = antrenament; $('go3').onclick = () => { soloNou(); scena(); ecranStart(); };
}
function final() {
  const o = ord(), p = o.indexOf(eu), ref = p === 0 ? o[1] : o[0];
  const d = { dr: eu.st.dr - ref.st.dr, vir: eu.st.vir - ref.st.vir, pit: eu.st.pit - ref.st.pit, start: eu.st.start - ref.st.start + (eu.penal - ref.penal) };
  const pierzi = x => x > 0, dDr = Math.round(Math.abs(eu.seg.dr - ref.seg.dr) / eu.seg.dr * 100), dVir = Math.round(Math.abs(eu.seg.vir - ref.seg.vir) / eu.seg.vir * 100);
  const motiv = {
    dr: pierzi(d.dr) ? (ref.seg.dr < eu.seg.dr * .995 ? `${ref.m}: ${ref.car.hp} CP, ${Math.round(ref.p.vmax * 3.6)} km/h` : eu.st.bloc > 1 ? 'blocat în spatele altora' : ref.p.nitro.celule ? 'el a folosit nitro mai bine' : 'aspirația, în spatele altora') : (eu.seg.dr < ref.seg.dr * .995 ? `mașina ta e cu ${dDr}% mai rapidă aici` : eu.p.nitro.celule ? 'nitro și aspirație' : 'aspirația'),
    vir: pierzi(d.vir) ? (ref.seg.vir < eu.seg.vir * .995 ? `${ref.m} e cu ${dVir}% mai rapidă aici` : 'frânări sau anvelope') : (eu.seg.vir < ref.seg.vir * .995 ? `mașina ta e cu ${dVir}% mai rapidă aici` : 'frânări mai bune'),
    pit: pierzi(d.pit) ? `ai stat ${f1(eu.st.pit)} s la boxe` : `el a stat ${f1(ref.st.pit)} s la boxe`,
    start: eu.penal ? 'start fals, +3 s' : 'grila și reacția' };
  const linii = [['Pe drepte', d.dr, motiv.dr], ['În viraje', d.vir, motiv.vir], ['Boxe', d.pit, motiv.pit], ['Start', d.start, motiv.start]]
    .filter(x => Math.abs(x[1]) >= .05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2)
    .map(([lab, x, de]) => `<div class="mot"><span>${lab}<small>${de}</small></span><b style="color:${x > 0 ? '#ed1b2f' : '#2ecc71'};white-space:nowrap">${x > 0 ? '−' : '+'}${Math.abs(x).toFixed(3).replace('.', ',')} s</b></div>`).join('');
  const loc = (c, i) => c ? `<div class="p${i + 1}${c.eu ? ' eu' : ''}">${tok(c)}<b>${i + 1}</b><small>${c.eu ? 'Tu' : c.n}</small></div>` : '<div></div>';
  const medie = eu.st.franari ? Math.round(eu.st.scor / eu.st.franari * 100) : 0;
  $('ov').innerHTML = `${titluOv('Cursa · final')}
    <div class="pod">${loc(o[1], 1)}${loc(o[0], 0)}${loc(o[2], 2)}</div>
    <p class="d" style="font-size:48px;margin-top:4px">P${p + 1}<span style="font-size:18px;color:#9aa0a9"> ${p === 0 ? `cu ${fD(o[1].fin - eu.fin).slice(1)} s avans` : `la ${fD(eu.fin - o[0].fin).slice(1)} s`}</span></p>
    <p class="sub">Frânări ${medie}% · ${eu.penal ? 'start fals' : START && START.reactie != null ? `reacție ${START.reactie.toFixed(3).replace('.', ',')} s` : ''}</p>
    ${linii ? `<div>${titluOv(p === 0 ? `Față de ${ref.n}` : `Față de ${ref.n}, câștigătorul`)}${linii}</div>` : ''}
    ${PARTIDA ? '<div class="fbani" id="fbani"><span class="cls-bani"><span class="cls-bani-s">Banii cursei…</span><span class="cls-bani-z">&nbsp;<i style="--p:0%"></i></span></span></div>' : ''}
    <button type="button" class="go" id="go2">Meniu</button>`;
  $('ov').style.display = 'flex'; $('go2').onclick = () => { soloNou(); scena(); ecranStart(); };
  inchidePartida(p + 1);
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
  if (START.out === null && k > 5) START.out = START.t0 + (START.outFix != null ? START.outFix : 4 * .8 + .8 + .4 + Math.random() * 1.8);
  const stinse = START.out !== null && ceas >= START.out;
  el.hidden = stinse && ceas > START.out + .5;
  el.querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', !stinse && Math.floor(i / 2) < Math.min(5, k)));
  el.classList.toggle('go', stinse);
  // boții pleacă după reacția lor; tu, la apăsare (după un start fals, la stingere)
  if (stinse) for (const c of C) if (!c.lansat && !c.remote) {
    if (!c.eu) { if (c.reactie == null) c.reactie = .17 + Math.random() * .3; if (ceas >= START.out + c.reactie) c.lansat = true; }
    else if (START.penal) { c.lansat = true; START.reactie = 0; }
    else if (ceas > START.out + 1.2) { c.lansat = true; START.reactie = 1.2; START.msg = 'Prea târziu'; START.msgT = 1.4; }
  }
  sb.classList.toggle('on', !eu.lansat && pornit);
  START.msgT -= 1 / 60;
  $('fbq').textContent = START.msgT > 0 ? START.msg : $('fbq').textContent;
}
let last = performance.now(), acum = 0, racire = 0, finEu = null;
// Simularea merge cu pas fix (ca serverul s-o poată reface): într-un cadru intră 2 sau 3 pași (la
// 120 Hz, 1 sau 2), deci desenul ar sări neregulat. Desenăm între ultimii doi pași, după cât s-a
// scurs din pasul următor: mișcarea e continuă, iar simularea rămâne aceeași.
function tine() { for (const c of C) { c.sA = c.s; c.lA = c.latC; } }
const alfa = () => (pornit ? Math.max(0, Math.min(1, acum / CM.DT)) : 1);
const RACIRE = 2.6;
function intra() { const v = $('vw'); v.classList.remove('intra'); void v.offsetWidth; v.classList.add('intra'); acum = 0; }
// timpul tău (față de fantomă) sau locul tău, mare pe pistă, cât mașina încetinește după linie
function arataFinal() {
  const b = $('finb'), sm = $('fins'); sm.style.color = '';
  if (TURURI === 1) {
    const timp = eu.fin - eu.t0; b.textContent = fT(timp);
    if (FANT && FANT.timp) { const d = timp - FANT.timp; sm.textContent = `${fD(d)} s`; sm.style.color = d <= 0 ? '#2ecc71' : '#f5c542'; }
    else sm.textContent = '';
  } else {
    const o = LIVE && LIVE.inCursa ? C.slice().sort((a, c) => (a.fin ?? 1e9) - (c.fin ?? 1e9) || c.s - a.s) : ord(), p = o.indexOf(eu);
    b.textContent = `P${p + 1}`;
    sm.textContent = p === 0 ? 'Câștigi' : o[0].fin != null ? `la ${fD(eu.fin - o[0].fin).slice(1)} s` : '';
    sm.style.color = p === 0 ? '#2ecc71' : '';
  }
  $('fin').hidden = false;
  const bun = TURURI === 1 ? !(FANT && FANT.timp) || eu.fin - eu.t0 <= FANT.timp : b.textContent === 'P1';
  window.Shared && Shared.haptic(bun ? 'success' : 'tick');
}
function cadru(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; ceas += dt;
  if (pornit && !gata) {
    acum += dt * VIT; while (acum >= CM.DT && pornit && !gata) { tine(); pas(CM.DT); acum -= CM.DT; if (terminat()) break; }
    if (LIVE && LIVE.inCursa) trimiteLive();
    // locul tău apare când treci linia (cei din față au terminat deja); restul cursei se termină sub el
    if (TURURI > 1 && eu.fin !== null && $('fin').hidden) arataFinal();
    if (terminat()) { gata = true; racire = ceas; if ($('fin').hidden) arataFinal(); }
  } else if (pornit && gata) {
    acum += dt * VIT; while (acum >= CM.DT) { tine(); pas(CM.DT); acum -= CM.DT; }
    if (LIVE && LIVE.inCursa) trimiteLive();
    if (ceas - racire > RACIRE) {
      pornit = false; $('fin').hidden = true;
      TURURI === 1 ? finalSolo() : LIVE && LIVE.inCursa ? finalLive() : final();
      const ov = $('ov'); ov.classList.remove('lin'); void ov.offsetWidth; ov.classList.add('lin');
    }
  }
  hud(dt); lumini(); desen(dt);
  requestAnimationFrame(cadru);
}
// adresa cu care s-a deschis pagina (linkul unei camere, #cupa, #sapt), citită înainte ca meniul s-o șteargă
const ADRESA0 = location.hash;
soloNou(); scena(); ecranStart();
const codLink = /^#camera=([A-Za-z0-9]{5})$/.exec(ADRESA0);
if (codLink) setTimeout(() => ecranCamera(codLink[1].toUpperCase()), 0); else if (ADRESA0 === '#cupa') setTimeout(ecranCupa, 0); else if (ADRESA0 === '#sapt') setTimeout(ecranSapt, 0); else if (ADRESA0 === '#prieteni') setTimeout(ecranPrieteni, 0);
// Înapoi (săgeata de sus sau butonul telefonului) șterge adresa ecranului: înapoi în meniul Cursei.
// O cursă sau un tur în desfășurare se lasă (la Cupă, încercarea e deja folosită).
// Un link deschis cu pagina deja pornită (#camera=COD, #cupa...) duce la ecranul lui.
window.addEventListener('hashchange', () => {
  if (adresaInterna) return;
  const h = location.hash, cam = /^#camera=([A-Za-z0-9]{5})$/.exec(h);
  if (h.length > 1 && !cam && !['#cupa', '#sapt', '#prieteni'].includes(h)) return;
  if (h.length <= 1 && $('ov').dataset.ecran === 'meniu') return;
  oprireCamera(); inchideLive(); clasaSapt = null; PARTIDA = null;
  if (PREMIU) { aleasa = PREMIU.inapoi; PREMIU = null; }
  soloNou(); scena();
  if (cam) ecranCamera(cam[1].toUpperCase()); else if (h === '#cupa') ecranCupa(); else if (h === '#sapt') ecranSapt(); else if (h === '#prieteni') ecranPrieteni(); else ecranStart();
});
if (new URLSearchParams(location.search).has('test')) {
  window.__fg = () => FG && { x: FG.position.x, z: FG.position.z };
  window.__cursa = { get GM() { return GM; }, get PR() { return PR; }, get LIVE() { return LIVE; }, laMesajLive, ecranCamera, get t() { return t; }, ecranCupa, ecranSapt, get C() { return C; }, get eu() { return eu; }, get mom() { return mom; }, get ceas() { return ceas; }, get START() { return START; }, get WK() { return WK; }, SES, GRUPURI, DREAPTA, L, VIT, franeaza, setRitm, pleaca, turSolo };
}
requestAnimationFrame(cadru);
})();
