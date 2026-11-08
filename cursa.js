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
// Pneurile: Soft merge mai repede și se uzează mult, Hard invers. Sub 25% cad brusc: mașina pierde
// ritm și fereastra frânei se strânge, așa că roțile terminate costă mult mai mult decât o oprire.
const PNEU = { S: { n: 'Soft', col: '#ed1b2f', ritm: 1.012, uz: 1.7 }, M: { n: 'Medium', col: '#f5c542', ritm: 1, uz: 1 }, H: { n: 'Hard', col: '#e8e8e8', ritm: .99, uz: .62 } };
const aderenta = c => PNEU[c.cmp || 'M'].ritm * (c.tyre >= .25 ? .9 + .1 * c.tyre : .925 - (.25 - c.tyre) * .3);
const franaPneu = c => (c.tyre >= .25 ? 1 : .7 + 1.2 * c.tyre);
// boții pleacă pe strategii diferite: cu ce pornesc și ce pun la boxe
const STRATEGII = [['M', 'H'], ['S', 'H'], ['S', 'M'], ['H', 'M'], ['M', 'S']];
let pneuStart = 'M'; try { pneuStart = PNEU[localStorage.getItem('frq_cursa_pneu')] ? localStorage.getItem('frq_cursa_pneu') : 'M'; } catch { /* fără stocare */ }
// Adversarii: Ușor (mai lenți, greșesc des), Mediu (pe măsura ta), Greu (mai rapizi, frânează bine)
// Adversarii, pe patru niveluri: off = cât de puternice sunt mașinile lor față de a ta (puncte de scor),
// sk = cât de bine frânează (de la, până la), tun = câți au piese cumpărate, nitro = câți au și Nitro,
// ag = cât de des atacă și se apără, liber = folosesc nitro pe orice dreaptă (nu doar în luptă).
// Reglate cu simularea (window.__cursa.calibrare, turul lansat, mașina de împrumut): cel mai rapid bot
// e la Amator mai lent decât un tur mediu de-al tău, la Pilot cam cât un tur bun, la Campion între un tur
// bun și unul perfect, la Legendă abia mai lent decât unul perfect (pole doar cu tur perfect, ~9 din 10).
const DIF = [
  { n: 'Amator', sub: 'Mașini mai slabe, greșesc des', off: -9, sk: [.3, .5], tun: 0, nitro: 0, ag: 0 },
  { n: 'Pilot', sub: 'Pe măsura ta', off: -3, sk: [.5, .75], tun: .5, nitro: .3, ag: 0 },
  { n: 'Campion', sub: 'Tunați, cu nitro, frânează bine', off: -2, sk: [.8, 1], tun: 1, nitro: .7, ag: .1, liber: true },
  { n: 'Legendă', sub: 'Doar un tur perfect îi bate', off: -1.5, sk: [1.05, 1.2], tun: 1, nitro: 1, ag: .2, liber: true },
];
let dif = 1; try { const v = localStorage.getItem('frq_cursa_dif'); if (v !== null && DIF[+v]) dif = +v; } catch { /* fără stocare */ }
// boții: o abatere la întâmplare, mai mică la cei buni
const notaBot = (c, G) => { const r = (Math.random() + Math.random() + Math.random() - 1.5) * Math.max(0, .5 - c.sk * .4); return nota(r, ferMasina(c, G) * franaPneu(c)); };
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
  const pool = MASINI.filter(c => cheieM(c) !== cheieM(eu0.c)).sort(() => Math.random() - .5), N = DIF[dif];
  // Nitro la boți doar dacă îl ai și tu (cu mașina de împrumut, fără Nitro, ar fi o luptă pierdută)
  const cuNitro = CM.piese(eu0.nivel || 0)[4] > 0;
  // piesele unui bot: la întâmplare (1-5 la fiecare), Nitro doar la o parte dintre ei
  const piese = () => CM.codPiese([1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 5)).concat(cuNitro && Math.random() < N.nitro ? 2 + Math.floor(Math.random() * 4) : 0));
  let rapizi = 0, lenti = 0;
  for (const [lat, echilibru] of [[10, true], [16, true], [30, false], [70, false], [140, false]]) {
    for (const c of pool) {
      if (out.length >= 9) break;
      if (folosite.has(marca(c))) continue;
      const bun = d => !(d < -lat || d > (echilibru ? lat / 2 : lat / 3) || (echilibru && (d > 0 ? rapizi : lenti) >= 5));
      // tunat: câteva încercări de piese până iese în fereastră; altfel de serie
      let ales = null;
      if (Math.random() < N.tun) for (let k = 0; k < 6 && !ales; k++) { const nv = piese(), d = scorMasina(c, nv) - eu0.scor - N.off; if (bun(d)) ales = { c, nivel: nv, d }; }
      if (!ales) { const d = scorStoc(c) - eu0.scor - N.off; if (bun(d)) ales = { c, nivel: 0, d }; }
      if (!ales) continue;
      folosite.add(marca(c)); out.push(ales); if (ales.d > 0) rapizi++; else lenti++;
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
// UZ_K: în cursă roțile se uzează mai repede decât în turul lansat. Reglat cu simCursaTest (5 tururi):
// cea mai bună e o oprire (Medium apoi Hard); fără oprire pierzi ~5 s pe Hard, ~14 s pe Medium, ~18 s pe Soft
const UZ = CM.UZ, PAS = 13, APROAPE = 40;
let UZ_K = 1.8;
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
  return { n: pilot[0], sc: pilot[1], col: pilot[2], m: c.name, an: c.years, f: cheieM(c), car: c, nivel, p, prof, seg: segmente(prof), scor: scorMasina(c, nivel), ag: .45 + DIF[dif].ag + Math.random() * .2, sk: DIF[dif].sk[0] + Math.random() * (DIF[dif].sk[1] - DIF[dif].sk[0]), ...extra };
}
// starea de pe pistă a unei mașini (pornește din definiția ei)
const stare = (d, i, extra) => ({ ...d, i, s: 0, v: 0, cmp: 'M', cmpNou: null, ritm: 'normal', mod: { k: 'normal' }, decT: 0, tyre: 1, nitro: d.p.nitro.celule, nOn: false, tine: false, nT: 0, latV: 0, puls: 0, cere: false, pit: 0, pr: 0, trece: null, latC: 0, latF: 0, latFT: 0, fin: null, tura: 0, q: {}, qf: 1, qq: SINGUR, t0: null, sect: [], lansat: true, penal: 0, st: { dr: 0, vir: 0, pit: 0, bloc: 0, uz: 0, uzD: 0, start: 0, scor: 0, franari: 0 }, ...extra });
const definitiaMea = () => masinaCursa(aleasa.c, aleasa.nivel, ['Tu', 'TU', '#d81528'], { eu: 1 });
function pregatesteRivali() { RIVALI = alegeRivali(aleasa).map((x, i) => masinaCursa(x.c, x.nivel, PILOTI[i])); }
function comun() {
  C.forEach(c => poza(c.car));
  eu = C.find(c => c.eu); t = 0; pornit = false; gata = false; finEu = null; $('fin').hidden = true; VZ = { loc: 0, tinta: null }; vzT = 0; pozVeche = C.indexOf(eu) + 1; setRitm(TURURI === 1 ? 'atac' : 'normal'); anuntate = 0; mom = null;
  $('fo').src = aleasa.c.image.replace(/\/\d+px-/, '/250px-');
  const [a, u, m, cu, ni] = CM.piese(aleasa.nivel);
  $('cdn').textContent = aleasa.c.name;
  $('cdi').textContent = `${aleasa.c.years} · clasa ${CM.clasa(eu.scor)} · ${eu.scor} · motor ${m}, cutie ${cu}, anvelope ${a}, ușurare ${u}, nitro ${ni}${aleasa.imprumut ? ' · de împrumut' : ''}`;
  document.body.classList.toggle('solo', TURURI === 1); document.body.classList.remove('ses');
  { const pp = $('pp'); scrise.delete(pp); delete pp.dataset.t; pp.textContent = ''; }
}
// cursa: 10 mașini pe grilă, câte două pe rând, oprite; pleacă la stingerea luminilor
function cursaNoua(grila) {
  TURURI = E ? E.CURSA.ture : 5; FANT = null;
  C = grila.map((d, i) => stare(d, i, { s: -Math.floor(i / 2) * 20 - (i % 2) * 10 - 6, latC: i % 2 ? 4 : -4, lansat: false }));
  C.forEach(c => { if (c.eu) { c.cmp = pneuStart; } else { const [a, b] = STRATEGII[Math.floor(Math.random() * STRATEGII.length)]; c.cmp = a; c.plan = b; c.prag = .2 + Math.random() * .1; } c.strat = [c.cmp]; });
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
// ---------- boxele, ca în F1 ----------
// Ceri boxele; cu BOX.intrare metri înainte de linie intri lin pe culoar (lângă linia de start), mergi
// cu limitatorul, oprești în boxa ta, roțile se schimbă (BOX.serviciu, secunde de cursă), pleci tot
// cu limitatorul și revii pe pistă lin după BOX.iesire. Cât ești pe culoar (c.pit > 0) nu încurci
// pe nimeni de pe pistă.
// lat: banda pe care se merge pe culoar; box: locurile de oprire, pe o parte, ca mașinile să nu treacă
// una peste alta
const BOX = { intrare: 110, iesire: 70, lat: 13.8, box: 20.5, v: 25, serviciu: 2.6, loc: i => -58 + (i % 10) * 9 };
const neted = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// culoarul, ca depărtare de axa pistei după cât ești față de linie (d, în metri): se desparte de pistă
// într-un singur loc, merge paralel în spatele zidului și se întoarce pe pistă tot într-un singur loc
// ieșirea e oglinda intrării: aceeași lungime (48 m), aceeași curbă
// la capete culoarul (lat 7,2 m) e chiar pe marginea pistei: axa la 3,4, marginea din afară la 7 (fără treaptă)
const latBoxe = d => d < -62 ? 3.4 + (BOX.lat - 3.4) * neted((d + BOX.intrare) / (BOX.intrare - 62)) : d > 22 ? BOX.lat + (3.4 - BOX.lat) * neted((d - 22) / (BOX.iesire - 22)) : BOX.lat;
// gura culoarului: unde culoarul se lipește de pistă (acolo linia albă a marginii pistei se întrerupe)
const guraBoxe = i => { const d = dLinie(i * step); return d >= -BOX.intrare && d <= BOX.iesire && latBoxe(d) - 3.6 < 6.9 && latBoxe(d) + 3.6 > 7.05; };
const dLinie = s => { let d = ((s % L) + L) % L; if (d > L / 2) d -= L; return d; };
// Schimbul de roți. Tu: ții apăsat (pistolul strânge piulița, bara se umple) și dai drumul în zona albă; cu
// cât mai aproape de mijlocul ei, cu atât mai repede (secunde de cursă: perfect 2,2, prost 4,4; dacă ții prea
// mult sau nu apeși deloc, 5,4). Boții, după cât de buni sunt. Locul boxei nu mai contează: cine are boxa
// într-un loc mai rapid al culoarului stă cu atât mai mult la schimb.
const SCH = { plin: 1.05, mij: .76, bun: .03, lat: .22, perfect: 2.2, prost: 4.4, ratat: 5.4 };
const tCuloar = loc => { let s = -BOX.intrare, v = BOX.v, t = 0; for (;;) { const r = loc - s; if (r <= .4) break; const v1 = Math.min(BOX.v, Math.max(1.2, Math.sqrt(14 * r))); v = v > v1 ? Math.max(v1, v - 24 / 60) : Math.min(v1, v + 5 / 60); s += v / 60; t += 1 / 60; } v = 0; while (s < BOX.iesire) { v = Math.min(BOX.v, v + 6 / 60); s += v / 60; t += 1 / 60; } return t; };
const COMP_BOX = (() => { const t = Array.from({ length: 10 }, (_, i) => tCuloar(BOX.loc(i))), m = Math.max(...t); return t.map(x => m - x); })();
const schimbBot = c => 2.1 + (1 - Math.max(0, Math.min(1, c.sk ?? .6))) * 2.4 + Math.random() * .5;
const SV = { tine: false, t0: 0, rez: null, rezT: 0 };
function schimbGata(c, T) { const B = c.box; B.asteapta = false; B.t = B.t0 = Math.max(.1, T + COMP_BOX[c.i % 10] - (B.el || 0)); }
function dropSchimb() {
  if (!SV.tine) return; SV.tine = false;
  const B = eu && eu.box; if (!B || !B.asteapta) return;
  const f = (ceas - SV.t0) / SCH.plin, d = Math.abs(f - SCH.mij);
  const T = d <= SCH.bun ? SCH.perfect : d >= SCH.lat ? SCH.prost : SCH.perfect + (SCH.prost - SCH.perfect) * (d - SCH.bun) / (SCH.lat - SCH.bun);
  SV.rez = d <= SCH.bun ? 'Perfect' : f < SCH.mij - SCH.lat ? 'Prea devreme' : f > SCH.mij + SCH.lat ? 'Prea târziu' : `${T.toFixed(1).replace('.', ',')} s`; SV.rezT = ceas + 1.1;
  window.Shared && Shared.haptic(d <= SCH.bun ? 'success' : 'tick');
  schimbGata(eu, T);
}
function intraLaBoxe(c) {
  const j = Math.floor(c.s / L) + 1;
  c.box = { faza: 'in', oprire: j * L + BOX.loc(c.i), iesire: j * L + BOX.iesire, t: 0, tyre0: c.tyre, s0: c.s, l0: c.latC };
  c.pit = 1; c.trece = null; c.latFT = 0; c.nT = 0; c.tine = false; c.nOn = false;
}
function pasBoxe(c, dt) {
  const B = c.box, s1 = c.s;
  c.st.pit += dt;
  if (B.faza === 'asteapta' || B.faza === 'parcat') {
    c.v = 0; c.st.pit -= dt;
    if (B.faza === 'asteapta' && t >= c.q8.iese) { B.faza = 'out'; c.q8.faza = 'lansare'; }
    return;
  }
  if (B.faza === 'in') {
    // spre boxa ta: frânezi tare până la limitator, apoi lin până în dreptul boxei
    const rest = B.oprire - c.s, v1 = Math.min(BOX.v, Math.max(1.2, Math.sqrt(Math.max(0, 2 * 7 * rest))));
    c.v = c.v > v1 ? Math.max(v1, c.v - 24 * dt) : Math.min(v1, c.v + 5 * dt);
    // pe bandă, iar în ultimii metri trage în locul tău, lângă bandă
    const lb = latBoxe(dLinie(c.s)); c.latC = B.l0 + (lb - B.l0) * neted((c.s - B.s0) / 25) + (BOX.box - lb) * neted(1 - rest / 7);
    if (rest <= .4) { c.v = 0; if (B.parcheaza) { B.faza = 'parcat'; c.q8.faza = 'gata'; return; } B.faza = 'stop'; B.el = 0; c.svc = 0; B.tyre0 = c.tyre; if (c.eu && !c.svcFix) { B.asteapta = true; B.t = B.t0 = 1; SV.tine = false; SV.rez = null; } else { B.asteapta = false; B.t = B.t0 = (c.svcFix || schimbBot(c)) + COMP_BOX[c.i % 10]; } if (c.cmpNou) { c.cmp = c.cmpNou; c.cmpNou = null; } if (c.strat) c.strat.push(c.cmp); }
  } else if (B.faza === 'stop') {
    // roțile noi: inelul anvelopei se umple cât ține schimbul
    c.v = 0; B.el += dt;
    if (B.asteapta) { c.svc = 0; if (!SV.tine && B.el >= SCH.ratat) { SV.rez = 'Automat'; SV.rezT = ceas + 1; schimbGata(c, SCH.ratat); } if (B.asteapta) return; }
    B.t -= dt; c.svc = Math.max(0, B.t);
    c.tyre = B.tyre0 + (1 - B.tyre0) * Math.min(1, 1 - B.t / B.t0);
    if (B.t <= 0) { c.tyre = 1; c.svc = 0; B.faza = 'out'; }
  } else {
    c.v = Math.min(BOX.v, c.v + 6 * dt);
    // pe culoar până la capăt, apoi înapoi pe pistă
    const lb = latBoxe(dLinie(c.s)); c.latC = lb + (BOX.box - lb) * (1 - neted((c.s - B.oprire) / 7));
    if (c.s >= B.iesire) { c.box = null; c.pit = 0; c.latV = 0; c.latC = Math.min(5.2, c.latC); }
  }
  c.s += c.v * dt;
  if (Math.floor(c.s / L) > Math.floor(s1 / L) && c.s > 0) c.tura = Math.floor(c.s / L);
}
// ---------- calificarea cu trafic (Q1·Q2·Q3) ----------
// Ca în F1: toți din etapă pleacă pe rând de la boxe (la SES_PAS secunde de cursă unul de altul), fac
// un tur de lansare, turul rapid și turul de intrare. Cine e pe lansare sau pe intrare se dă la o parte
// din fața celui pe tur rapid; doi pe tururi rapide se pot încurca (traficul). Q1: ordinea la
// întâmplare; Q2 și Q3: cel mai lent din etapa de dinainte iese primul.
let SESIUNE = false;
const SES_PAS = 6;
const cedeaza = x => !!(x && x.q8 && (x.q8.faza === 'lansare' || x.q8.faza === 'intrare'));
function turSesiune(c) {
  const q = c.q8, k = Math.floor(c.s / L), peste = c.s - k * L, tLinie = t - peste / Math.max(c.v, 1);
  if (q.faza === 'lansare' && k === 1) { q.faza = 'rapid'; q.t0 = tLinie; }
  else if (q.faza === 'rapid' && k === 2) { q.timp = tLinie - q.t0; q.faza = 'intrare'; }
}
function sesiuneNoua(ordine) {
  TURURI = 3; FANT = null; SESIUNE = true;
  C = ordine.map((d, i) => stare(d, i, { s: BOX.loc(i), latC: BOX.box, v: 0, pit: 1, box: { faza: 'asteapta', oprire: BOX.loc(i), iesire: BOX.iesire, t: 0, tyre0: 1 }, q8: { faza: 'garaj', iese: 1 + i * SES_PAS, t0: null, timp: null }, def: d }));
  comun();
  // ca turul solo (cronometrul sus), dar cu butoanele de ritm; boxele nu
  document.body.classList.add('solo', 'ses');
}
// după turul tău: restul sesiunii se rulează pe loc (cu trafic), apoi rezultatul
function finalSesiune() {
  let n = 0; while (C.some(c => c.q8.faza !== 'gata' && c.q8.faza !== 'intrare') && n++ < 60 * 400) pas(CM.DT);
  SESIUNE = false;
  for (const c of C) WK.timpi.set(c.def, c.q8.timp ?? 999);
  inchideEtapa();
}
// ---------- simularea ----------
// Turul lansat: pasul din model (același pe server, care reface timpul din apăsări). Boții își
// aleg aici rafalele de nitro; tu ții butonul.
function pasSingur(c, dt) {
  if (!c.eu) { const dr = DREAPTA(c.s); if (c.nT <= 0 && c.nitro >= 1 && dr && Math.random() < dt * .6) c.nT = c.p.nitro.celula * VIT * (1 + Math.random() * 1.5); if (!dr) c.nT = 0; }
  P.pasSolo(c, t, dt, c.eu ? null : notaBot);
  if (c.fin !== null) c.nOn = false;
  const lt = (c.i % 3 - 1) * 1.4;
  c.latV += ((lt - c.latC) * 16 - c.latV * 8) * dt; c.latC = Math.max(-5.2, Math.min(5.2, c.latC + c.latV * dt));
  // urma turului, la fiecare 0,1 s, pentru fantome
  const u = c.urma || (c.urma = []), kk = Math.floor(t / .1); while (u.length <= kk) u.push(c.s);
}
function pas(dt) {
  t += dt;
  if (TURURI === 1) { for (const c of C) c.remote ? pasRemote(c, dt) : pasSingur(c, dt); return; }
  const o = C.slice().sort((a, b) => b.s - a.s);
  for (let k = 0; k < o.length; k++) {
    const c = o[k];
    if (c.remote) { pasRemote(c, dt); continue; }
    if (c.fin !== null) { c.nOn = false; c.v = Math.max(18, c.v - 6 * dt); c.s += c.v * dt; continue; }
    if (!c.lansat) { c.v = 0; continue; }
    if (c.s < 0) c.st.start += dt;
    if (c.box) { pasBoxe(c, dt); continue; }
    // ai cerut boxele: intri pe culoar cu BOX.intrare metri înainte de linie (nu în ultimul tur)
    if (c.cere && c.s > 0 && ((c.s % L) + L) % L >= L - BOX.intrare && ((c.s % L) + L) % L < L - BOX.intrare + 14 && Math.floor(c.s / L) < TURURI - 1) { c.cere = false; intraLaBoxe(c); pasBoxe(c, dt); continue; }
    // în sesiune, după turul rapid: înapoi la boxe, unde rămâi
    if (SESIUNE && c.q8.faza === 'intrare' && ((c.s % L) + L) % L >= L - BOX.intrare) { intraLaBoxe(c); c.box.parcheaza = true; pasBoxe(c, dt); continue; }
    const din = k > 0 ? o[k - 1] : null, spate = k < o.length - 1 ? o[k + 1] : null, gap = din && din.pit <= 0 ? din.s - c.s : 1e9, gs = spate ? c.s - spate.s : 1e9;
    const dr = DREAPTA(c.s);
    // în sesiune: ritmul după tur (lansare și intrare normal, turul rapid în atac)
    // în sesiune: boții după tur (lansare și intrare normal, turul rapid în atac); tu alegi, dar la fiecare
    // tur nou butonul trece singur pe ce se potrivește (Atac pe rapid, Normal în rest)
    if (SESIUNE && !c.eu) { c.ritm = c.q8.faza === 'rapid' ? 'atac' : 'normal'; c.push = c.q8.faza === 'rapid'; }
    if (SESIUNE && c.eu && c.q8.faza !== c.q8.fazaR) { c.q8.fazaR = c.q8.faza; setRitm(c.q8.faza === 'rapid' ? 'atac' : 'normal'); }
    if (!c.eu) {
      const ultim = c.s > (TURURI - 1) * L;
      // boții se hotărăsc la câteva secunde, nu la fiecare pas (în turul de calificare: atac)
      c.decT -= dt;
      if (SESIUNE) { /* ritmul îl dă sesiunea */ }
      else if (c.push) c.ritm = 'atac';
      else if (c.decT <= 0) { c.decT = 2 + Math.random() * 2; const r = Math.random(); c.ritm = c.tyre < .3 && !ultim ? 'normal' : gs < 25 && r < c.ag * .9 ? 'apara' : gap < 30 && c.tyre > .4 && r < c.ag + .15 ? 'atac' : 'normal'; }
      if (c.nT <= 0 && c.nitro >= 1 && dr && (t > 10 || c.push) && (gap < 22 || gs < 14 || c.push || DIF[dif].liber) && Math.random() < dt * .6) c.nT = c.p.nitro.celula * VIT * (1 + Math.random() * 1.5);
      if (!dr) c.nT = 0;
      // boții opresc o dată (strategia lor); a doua oară doar cu roțile aproape terminate și mai mult de un tur rămas
      if (!SESIUNE && !c.cere && c.tyre < (c.opriri ? .05 : c.prag || .22) && !ultim && (!c.opriri || c.s < (TURURI - 1.5) * L)) { c.cere = true; c.cmpNou = c.plan || 'M'; c.opriri = (c.opriri || 0) + 1; }
    }
    // în zona unei frânări mari: cât de bine a frânat (tu: butonul; boții: după cât de buni sunt)
    const sl = ((c.s % L) + L) % L, Z = c.s >= 0 ? ZONA(sl) : null;
    if (Z) {
      const cheie = `${Math.floor(c.s / L)}-${Z.n}`;
      if (!(cheie in c.q) && !c.eu) { c.q[cheie] = c.eu ? SINGUR : notaBot(c, Z); c.st.franari++; c.st.scor += c.q[cheie].sc; umple(c, c.q[cheie].sc); }
      c.qq = c.q[cheie] || SINGUR; c.qf = c.qq.qf;
    } else { c.qq = SINGUR; c.qf = 1; }
    c.mod = ritmul(c, din, gap, spate, gs);
    // pe turul de lansare sau de intrare mergi mai domol; cu cineva pe tur rapid în spate, te dai la o parte
    const cedez = SESIUNE && cedeaza(c) && spate && spate.q8 && spate.q8.faza === 'rapid' && gs < 120;
    if (SESIUNE && cedeaza(c)) c.mod = { ...c.mod, pf: c.mod.pf * (cedez ? .86 : .94) };
    // nitro merge oriunde cât e apăsat: pe dreaptă dă tot, în viraj doar puțină accelerație la ieșire
    // în sesiunea de calificare, nitro doar pe turul rapid
    c.nOn = c.nitro > 0 && (!SESIUNE || c.q8.faza === 'rapid') && (c.eu ? c.tine && c.lansat : c.nT > 0);
    if (c.nOn) c.nitro = Math.max(0, c.nitro - dt / (c.p.nitro.celula * VIT));
    // în cursă: amestecul și uzura (sub 25%, cădere bruscă); în turul lansat, modelul
    const i = idx(c.s), pf = c.mod.pf, uz = c.mod.uz, tf = aderenta(c);
    if (c.trece && (c.s > c.trece.s + PAS * .8 || c.trece.s - c.s > 30 || c.trece.pit > 0 || c.trece.fin !== null)) gataDepasirea(c);
    const pot = c.prof[i] * pf * tf * c.qf * (dr && c.nOn ? 1.09 : 1) * (dr && gap < 30 ? 1.03 : 1) * (c.trece ? 1.025 : 1);
    c.v += pot > c.v ? Math.min(pot - c.v, Math.max(.4, CM.acc(c.p, c.v)) * (c.nOn ? (dr ? 1.4 : 1.15) : 1) * dt) : Math.max(pot - c.v, -c.p.abr * 1.3 * dt);
    // regula: pe dreaptă câștigă nitro; în viraje câștigă Atacul
    if (din && gap < 16 && din.fin === null && !(SESIUNE && cedeaza(din))) {
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
    if (din && c.trece !== din && din.trece !== c && !alaturi && gap < PAS && din.pit <= 0 && !(SESIUNE && cedeaza(din) && c.q8.faza === 'rapid')) {
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
    // cine se dă la o parte merge pe marginea pistei (jetoanele sunt late: la 4,6 m tot se atingeau)
    if (cedez) lt = spate.latC >= 0 ? -6.2 : 6.2;
    // lateral ca un arc cu amortizor: pornește și se oprește lin
    c.latV += ((lt - c.latC) * 16 - c.latV * 8) * dt;
    const lm = cedez ? 6.2 : Math.max(5.2, Math.abs(c.latC) - 4 * dt); c.latC = Math.max(-lm, Math.min(lm, c.latC + c.latV * dt));
    const s1 = c.s; c.s += c.v * dt;
    if (c.t0 === null && c.s >= 0) c.t0 = t - c.s / Math.max(c.v, 1);
    if (c.t0 !== null && c.sect.length < 2 && c.s >= (c.sect.length + 1) * L / 3) c.sect.push(t - c.t0);
    // urma turului solo, la fiecare 0,1 s, pentru fantome
    if (TURURI === 1) { const u = c.urma || (c.urma = []), kk = Math.floor(t / .1); while (u.length <= kk) u.push(c.s); }
    if (c.s > 0) { if (dr) c.st.dr += dt; else c.st.vir += dt; if (bloc) c.st.bloc += dt * Math.max(0, 1 - c.v / pot); c.st.uz += dt * (1 - tf); if (dr) c.st.uzD += dt * (1 - tf); }
    c.tyre = Math.max(0, c.tyre - UZ * UZ_K * PNEU[c.cmp || 'M'].uz * uz * dt * (c.v / 50));
    c.nT = Math.max(0, c.nT - dt); c.latFT = Math.max(0, c.latFT - dt);
    if (Math.floor(c.s / L) > Math.floor(s1 / L) && c.s > 0) {
      c.tura = Math.floor(c.s / L);
      if (SESIUNE) turSesiune(c);
      else if (c.s >= TURURI * L) c.fin = t + c.penal;
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
  eu.tine = nou;
};
$('nb').addEventListener('pointerdown', e => { e.preventDefault(); try { $('nb').setPointerCapture(e.pointerId); } catch {} nitroPe(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('nb').addEventListener(ev, () => nitroPe(false));
$('nb').addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.code === 'KeyN' && !e.repeat) nitroPe(true); });
document.addEventListener('keyup', e => { if (e.code === 'KeyN') nitroPe(false); });
// boxele: atingi inelul, alegi ce pui (S, M, H) și intri la următoarea trecere pe lângă boxe
let alegPneu = false;
const poateBoxe = () => pornit && eu.pit <= 0 && eu.fin === null && eu.tura < TURURI - 1 + (eu.s < (TURURI - 1) * L ? 1 : 0);
$('px').addEventListener('click', () => { if (!eu.cere && poateBoxe()) alegPneu = !alegPneu; });
$('sch').addEventListener('pointerdown', e => { e.preventDefault(); const B = eu && eu.box; if (!B || !B.asteapta || SV.tine) return; try { $('sch').setPointerCapture(e.pointerId); } catch { /* nu e nevoie */ } SV.tine = true; SV.t0 = ceas; });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('sch').addEventListener(ev, () => dropSchimb());
$('pxa').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; alegPneu = false; if (poateBoxe()) { eu.cere = true; eu.cmpNou = b.dataset.c; } });
$('pxx').addEventListener('click', () => { eu.cere = false; eu.cmpNou = null; });
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
// `cand`: momentul atingerii (performance.now); la el se adaugă cât a trecut de la ultimul cadru
function franeaza(cand) {
  if (!pornit || !mom || mom.rez || mom.cheie in eu.q) return;
  if (Number.isFinite(cand)) mom.e += Math.max(0, Math.min(.05, (cand - last) / 1000));
  let r;
  // în turul lansat: frânarea din model, notată cu pasul ei (serverul reface turul din apăsări)
  if (eu.intr) { const e = Math.round(mom.e * 1e4) / 1e4, n0 = eu.nitro; r = P.frana(eu, mom.cheie, e); if (!r) return; eu.intr.f.push([eu.k, mom.cheie, e]); if (eu.nitro > n0) clipeste(); }
  else { r = nota(mom.e, mom.fer); eu.q[mom.cheie] = r; eu.st.franari++; eu.st.scor += r.sc; umple(eu, r.sc); }
  mom.rez = r; mom.rezT = 1.1; eu.puls = .6;
  window.Shared && Shared.haptic(r.sc >= .6 ? 'success' : r.sc > 0 ? 'tick' : 'error');
  const fb = $('fb'); fb.classList.remove('bun', 'rau'); void fb.offsetWidth; fb.classList.add(r.sc > 0 ? 'bun' : 'rau');
}
$('fb').addEventListener('pointerdown', e => { e.preventDefault(); franeaza(e.timeStamp); });
document.addEventListener('pointerdown', () => { if (window.DragSunet) DragSunet.trezeste(); }, { passive: true });
document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); if (START && eu && !eu.lansat) pleaca(); else franeaza(e.timeStamp); } });
// zoom: butonul trece prin trei trepte; pe telefon și cu două degete pe pistă (nu pe butoane: nitro ținut
// plus frâna nu înseamnă zoom), pe calculator cu rotița
const ZOOM = [.72, 1, 1.4];
let zoom = 1, zoomV = 1, dinV = 1; try { zoom = Math.max(.6, Math.min(1.8, +localStorage.getItem('frq_cursa_zoom') || 1)); } catch { /* fără stocare */ }
const puneZoom = z => { zoom = Math.max(.6, Math.min(1.8, z)); try { localStorage.setItem('frq_cursa_zoom', zoom.toFixed(2)); } catch { /* fără stocare */ } };
$('zb').addEventListener('click', () => puneZoom(ZOOM.find(z => z > zoom + .05) || ZOOM[0]));
{
  const ve = $('vw'), deg = new Map(); let d0 = 0, z0 = 1;
  const dist = () => { const [a, b] = [...deg.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  ve.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || e.target.closest('button')) return; deg.set(e.pointerId, [e.clientX, e.clientY]); if (deg.size === 2) { d0 = dist(); z0 = zoom; } });
  ve.addEventListener('pointermove', e => { if (!deg.has(e.pointerId)) return; deg.set(e.pointerId, [e.clientX, e.clientY]); if (deg.size === 2 && d0 > 20) puneZoom(z0 * d0 / dist()); });
  const gata = e => deg.delete(e.pointerId); ve.addEventListener('pointerup', gata); ve.addEventListener('pointercancel', gata);
  ve.addEventListener('wheel', e => { if (harta) return; e.preventDefault(); puneZoom(zoom * Math.exp(e.deltaY * .0012)); }, { passive: false });
}
function puneCamera(m) {
  camDe = { t: ceas, p: camU }; camM = m; try { localStorage.setItem('frq_cursa_cam', m); } catch { /* fără stocare */ }
  const e = $('cbt'); e.textContent = CAMERE[m]; e.hidden = false; clearTimeout(puneCamera.t); puneCamera.t = setTimeout(() => { e.hidden = true; }, 1200);
}
$('cb').addEventListener('click', () => puneCamera((camM + 1) % CAMERE.length));
$('hb').addEventListener('click', () => { harta = !harta; $('hb').classList.toggle('on', harta); $('hm').toggleAttribute('hidden', !harta); camOk = false; });
const vg = (a, b) => Math.max(0, (a.s - b.s) / Math.max(b.v, 20));
const INEL_V = 44; // cât se strânge inelul frânei, în unități de buton pe secundă
// HUD-ul se scrie în pagină doar când o valoare chiar se schimbă: o scriere identică tot obligă
// telefonul să recalculeze stilurile și așezarea, la fiecare cadru. Diferențele dintre mașini (la
// miime) se reîmprospătează de 10 ori pe secundă; inelul frânei, nitro și liniile, la fiecare cadru.
const HE = {}, el = id => HE[id] || (HE[id] = $(id));
const scrise = new WeakMap();
function pune(e, k, v) {
  let m = scrise.get(e); if (!m) scrise.set(e, m = {});
  if (m[k] === v) return; m[k] = v;
  if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k === 'hidden') e.hidden = v;
  else if (k[0] === '@') e.setAttribute(k.slice(1), v); else if (k[0] === '.') e.classList.toggle(k.slice(1), v); else e.style.setProperty(k, v);
}
let hudT = 0;
// „Virajul X" dacă încape deasupra butonului, altfel doar numele
function numeViraj(G) {
  const sp = SP_VIRAJ.get(G); if (!sp) return G.eticheta;
  const t = 'Virajul ' + sp.nume, x = spC[0].getContext('2d'); x.font = '900 16px "Big Shoulders Display", Impact, sans-serif';
  if (window.Sponsori) window.Sponsori.vazut(sp.id, 'cursa-viraj');
  return x.measureText(t.toUpperCase()).width * 1.12 <= W - 150 ? t : sp.nume;
}
// În turul lansat, ca în jocul de F1: pe pistă vezi doar fantoma celui imediat în fața ta (dacă ești
// primul, a celui din spate), iar sus locul pe care ai fi acum. Toți pornesc la fel (de la 400 m), deci
// cine e mai departe în același moment e mai rapid până aici. Boții: din urma turului lor; prietenii
// (live): din poziția lor de acum.
let VZ = { loc: 0, tinta: null }, vzT = 0;
function vizavi() {
  if (ceas - vzT < .25 || !eu) return VZ; vzT = ceas;
  let alti;
  if (LIVE && LIVE.faza === 'calif') alti = C.filter(c => c.remote).map(c => ({ c, s: c.s }));
  else if (WK && WK.ture && !PREMIU) { const k = t / .1; alti = WK.ture.map(r => ({ r, s: r.urma[Math.min(r.urma.length - 1, Math.floor(k))] ?? -1e9 })); }
  else return (VZ = { loc: 0, tinta: null });
  const fata = alti.filter(x => x.s > eu.s).sort((a, b) => a.s - b.s), spate = alti.filter(x => x.s <= eu.s).sort((a, b) => b.s - a.s);
  // Locul tău se actualizează pe loc; fantoma de urmărit se schimbă doar dacă noua situație ține 1,5 s și au
  // trecut 5 s de la ultima schimbare (umăr la umăr, ar sări înainte și înapoi de mai multe ori pe secundă).
  const crud = fata[0] || spate[0] || null, cheie = x => (x ? x.r || x.c : null), k = cheie(crud);
  let { ales = null, cand = null, candT = 0, schT = -99 } = VZ;
  if (!ales) { ales = k; schT = ceas; cand = null; }
  else if (k === ales) cand = null;
  else { if (cand !== k) { cand = k; candT = ceas; } if (ceas - candT >= 1.5 && ceas - schT >= 5) { ales = k; schT = ceas; cand = null; VZ.nrSch = (VZ.nrSch || 0) + 1; } }
  VZ = { loc: fata.length + 1, din: alti.length + 1, tinta: alti.find(x => cheie(x) === ales) || crud, ales, cand, candT, schT, nrSch: VZ.nrSch || 0 };
  return VZ;
}
// fantoma din calificarea cu boții urmărește turul celui din fața ta
function fantomaDupa(v) {
  if (!v.tinta || !v.tinta.r || v.tinta.r === FANT) return;
  if (FGv) { eliminaSprite(FGv); FGv = null; }
  if (FG && FANT) { FGv = FG; FGv.userData.urma = FANT.urma; FG = null; } else if (FG) { eliminaSprite(FG); FG = null; }
  FANT = v.tinta.r;
  FG = spriteFantoma(FANT.d, 0);
}
const eliminaSprite = sp => { S.remove(sp); sp.material.map && sp.material.map.dispose(); sp.material.dispose(); };
// Fantoma arată ca o fantomă: poza fără culoare și translucidă, cu un contur subțire punctat, fără inel plin.
const OP_F = .7;
function fantomaTex(d) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 160; const tex = new THREE.CanvasTexture(cv), car = d.car || d.c, im = car ? poza(car) : null;
  const desen = () => {
    const x = cv.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, 160, 160);
    x.save(); x.beginPath(); x.arc(80, 80, 70, 0, 7); x.clip(); x.fillStyle = '#9fb0bf'; x.fillRect(0, 0, 160, 160);
    if (im && im.complete && im.naturalWidth) { const r = Math.max(140 / im.naturalWidth, 140 / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; x.drawImage(im, 80 - w / 2, 80 - h / 2, w, h); }
    x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, 160, 160);
    x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(190,225,255,.3)'; x.fillRect(0, 0, 160, 160); x.restore();
    const g = x.createRadialGradient(80, 80, 12, 80, 80, 74); g.addColorStop(0, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, 160, 160); x.globalCompositeOperation = 'source-over';
    x.lineWidth = 4; x.strokeStyle = 'rgba(225,240,255,.9)'; x.setLineDash([13, 9]); x.beginPath(); x.arc(80, 80, 72, 0, 7); x.stroke(); x.setLineDash([]);
    tex.needsUpdate = true;
  };
  desen(); if (im && !(im.complete && im.naturalWidth)) im.addEventListener('load', desen, { once: true });
  return { tex, desen };
}
function spriteFantoma(d, op) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fantomaTex(d).tex, depthTest: false, transparent: true, opacity: op })); sp.renderOrder = 5; S.add(sp); return sp; }
// Cronometrul: fiecare cifră în căsuța ei, ca textul să nu se miște când se schimbă (1 e mai îngust ca 8).
function puneTimp(e, txt) {
  if (e.dataset.t === txt) return; e.dataset.t = txt;
  if (!/^\d+:\d\d,\d{3}$/.test(txt)) { e.textContent = txt; return; }
  if (e.children.length !== txt.length) { e.textContent = ''; for (const ch of txt) { const s = document.createElement('span'); s.className = /\d/.test(ch) ? 'c' : 's'; e.append(s); } }
  for (let i = 0; i < txt.length; i++) if (e.children[i].textContent !== txt[i]) e.children[i].textContent = txt[i];
}
function hudSesiune() {
  const q = eu.q8, pp = el('pp'), txt = q.faza === 'garaj' ? `Ieși în ${Math.max(0, Math.ceil((q.iese - t) / VIT))} s` : q.faza === 'lansare' ? 'Încălzire' : q.faza === 'rapid' ? fT(t - q.t0) : fT(q.timp);
  pune(pp, '.lans', q.faza === 'garaj'); pune(pp, '.incalz', q.faza === 'lansare'); pune(el('vw'), '.incalz', q.faza === 'lansare');
  puneTimp(pp, txt);
  const gata = C.filter(c => c.q8.timp != null).sort((a, b) => a.q8.timp - b.q8.timp), prim = gata[0];
  const loc = q.timp != null ? gata.indexOf(eu) + 1 : 0;
  pune(el('pf'), 'html', prim ? `<i style="background:${prim.col}"></i>${prim.eu ? 'Tu' : prim.n} <span style="color:#cfd3da">${fT(prim.q8.timp)}</span>` : '');
  // pe turul rapid: cine e pe pistă în fața ta, pe tur rapid (traficul)
  const fata = C.filter(c => c !== eu && c.q8.faza === 'rapid' && c.s > eu.s && c.s - eu.s < 250).sort((a, b) => a.s - b.s)[0];
  pune(el('pb'), 'html', loc ? `<b class="vzl">P${loc}</b> din ${gata.length}` : q.faza === 'lansare' ? '<span style="color:#f5c542">Turul rapid pornește la linie</span>' : q.faza === 'rapid' && fata ? `<span style="color:#f5c542">Trafic: ${fata.n} la ${Math.round(fata.s - eu.s)} m</span>` : '');
  pune(el('turn'), 'text', WK ? WK.etape[WK.k][0] : 'Q');
}
function hudSolo() {
  const timp = eu.t0 === null ? 0 : (eu.fin !== null ? eu.fin - eu.t0 : t - eu.t0), pp = el('pp'), lans = eu.t0 === null;
  if (scrise.get(pp)?.['.lans'] && !lans) { pp.classList.add('linie'); window.Shared && Shared.haptic('tick'); }
  pune(pp, '.lans', lans);
  puneTimp(pp, lans ? 'Tur lansat' : fT(timp));
  const F = FANT;
  pune(el('pf'), 'html', eu.sect.map((x, i) => { const d = F && F.sect && F.sect[i] != null ? x - F.sect[i] : null; return `S${i + 1} <span style="color:${d == null ? '#cfd3da' : d <= 0 ? '#b57bff' : '#f5c542'}">${d == null ? fT(x) : fD(d)}</span>`; }).join(' · '));
  const v = vizavi(); fantomaDupa(v);
  const tinta = v.tinta && (v.tinta.r ? { col: v.tinta.r.d.col, n: v.tinta.r.d.n, timp: fT(v.tinta.r.timp) } : { col: v.tinta.c.col, n: v.tinta.c.n, timp: '' });
  pune(el('pb'), 'html', v.loc && eu.t0 !== null ? `<b class="vzl">P${v.loc}</b>${tinta ? `<i style="background:${tinta.col}"></i>${tinta.n} <span style="color:#cfd3da">${tinta.timp}</span>` : ''}` : F ? `<i style="background:${F.d.col}"></i>${F.d.n} <span style="color:#cfd3da">${fT(F.timp)}</span>` : '');
  pune(el('turn'), 'text', LIVE && LIVE.faza === 'calif' ? numeEtapa(LIVE.k) : PREMIU ? { cupa: 'Cupa', sapt: 'Săptămâna', camera: 'Camera' }[PREMIU.tip] : WK ? WK.etape[WK.k][0] : 'Antren.');
}
const f1 = x => (+x || 0).toFixed(1).replace('.', ',');
const f3 = x => x.toFixed(3).replace('.', ',');
let popT = 0;
function hud(dt, o) {
  const k = o.indexOf(eu), din = k > 0 ? o[k - 1] : null, spate = o[k + 1], gap = din ? din.s - eu.s : 1e9, gs = spate ? eu.s - spate.s : 1e9;
  if (TURURI === 1) hudSolo();
  else if (SESIUNE) hudSesiune();
  else {
    pune(el('pp'), 'html', `P${k + 1}<small>/${C.length}</small>`);
    if (ceas - hudT > .1) {
      hudT = ceas;
      pune(el('pf'), 'html', !eu.lansat ? '' : din ? `<i style="background:${din.col}"></i>${din.sc} <span style="color:#cfd3da">+${f3(vg(din, eu))}</span>` : '<span style="color:#2ecc71">În frunte</span>');
      pune(el('pb'), 'html', eu.lansat && spate && gs < 25 ? `<i style="background:${spate.col}"></i>${spate.sc} <span style="color:#ed1b2f">−${f3(vg(eu, spate))}</span>` : '');
    }
    pune(el('turn'), 'text', `Tur ${Math.min(TURURI, Math.max(1, eu.tura + 1))}/${TURURI}`);
  }
  const pop = el('pop');
  if (pornit && TURURI > 1 && !SESIUNE && k + 1 !== pozVeche) { const d = pozVeche - (k + 1); pune(pop, 'text', (d > 0 ? '+' : '−') + Math.abs(d)); pune(pop, 'color', d > 0 ? '#2ecc71' : '#ed1b2f'); pune(pop, '.on', true); popT = 1.1; pozVeche = k + 1; }
  popT -= dt; if (popT <= 0) pune(pop, '.on', false);
  // primești mașina (frâna, nitro, ritmul, boxele) doar pe ce contează: în sesiunea de calificare, pe turul rapid
  const dr = DREAPTA(eu.s), activ = pornit && eu.fin === null && eu.pit <= 0 && (!SESIUNE || eu.q8.faza === 'rapid' || eu.q8.faza === 'lansare');
  const nb = el('nb'), N = eu.p.nitro;
  // nitro stins până începe turul cronometrat (turul lansat: linia; sesiunea: turul rapid)
  const nitroAcum = TURURI === 1 ? eu.t0 !== null : SESIUNE ? eu.q8.faza === 'rapid' : eu.lansat;
  // nitro se eliberează singur la linie, când s-a golit sau la boxe (degetul poate rămâne pe buton)
  if (eu.tine && (eu.fin !== null || eu.nitro <= 0 || eu.pit > 0)) nitroPe(false);
  pune(nb, '.apasat', !!eu.tine); pune(nb, '.act', eu.nOn && eu.fin === null && eu.pit <= 0); pune(nb, '.off', eu.nitro < .05 || !nitroAcum); pune(nb, '.gol', !N.celule);
  pune(nb, '.puls', activ && dr && eu.nitro >= 1 && !eu.nOn && (gap < 28 || gs < 14));
  // fără piesa Nitro: butonul stinge și trimite la Garaj (o celulă pe nivel cumpărat)
  const bt = HE.bt || (HE.bt = nb.querySelector('.bt'));
  if (bt.dataset.n !== String(N.celule)) { bt.innerHTML = N.celule ? '<i></i>'.repeat(N.celule) : '<b>Garaj</b>'; bt.dataset.n = N.celule; }
  for (let i = 0; i < bt.children.length; i++) pune(bt.children[i], '--f', Math.max(0, Math.min(1, eu.nitro - i)).toFixed(2));
  // ritmul: butonul potrivit pulsează când are pe cine ataca sau de cine să te aperi
  const ra = HE.ra || (HE.ra = document.querySelector('#ct [data-r=atac]')), rp = HE.rp || (HE.rp = document.querySelector('#ct [data-r=apara]'));
  pune(ra, '.puls', activ && gap < 30 && eu.ritm !== 'atac');
  pune(rp, '.puls', activ && gs < 22 && gap >= 30 && eu.ritm !== 'apara');
  pune(el('vw'), '.nitro', eu.nOn && dr);
  // frâna: momentul pornește cu ANUNT secunde înainte de panou
  const u = grupUrmator(), fb = el('fb');
  if (activ && u && !mom && u.sec <= ANUNT && u.sec > 0 && !(u.cheie in eu.q)) {
    mom = { cheie: u.cheie, G: u.G, fer: ferMasina(eu, u.G) * (eu.intr ? 1 : franaPneu(eu)), rez: null, rezT: 0, e: -u.sec, trecut: null };
    anuntate++;
    let ghid = 0; try { ghid = +localStorage.getItem('frq_cursa_ghid') || 0; if (ghid < 2) localStorage.setItem('frq_cursa_ghid', ghid + 1); } catch { ghid = 2; }
    pune(el('fbt'), 'text', ghid < 2 ? 'Frână în zona galbenă' : numeViraj(u.G));
    // toată fereastra (nota peste 0) estompat; partea unde nota trece de 50, verde plin
    pune(el('fbz'), '@stroke-width', (2 * INEL_V * mom.fer).toFixed(1)); pune(el('fbz2'), '@stroke-width', (2 * INEL_V * mom.fer * .39).toFixed(1));
  }
  if (mom) {
    // e: cât de departe ești de panou, în secunde (negativ înainte, pozitiv după)
    if (!mom.rez) {
      // înainte de panou din cât mai ai până la el, după panou din cât ai trecut (continuu, nu pe cadre)
      if (u && u.cheie === mom.cheie) mom.e = -u.sec; else { if (mom.trecut === null) mom.trecut = ceas - mom.e; mom.e = ceas - mom.trecut; }
      // inelul se strânge cu viteză constantă (ca să-l poți citi) și apare cu ~1 s înainte de panou
      const r = 38 - INEL_V * mom.e;
      pune(el('fbr'), '@r', Math.max(6, Math.min(74, r)).toFixed(1)); pune(el('fbr'), '@opacity', r > 74 ? '0' : '1');
      // n-ai apăsat: frânează singură
      if (mom.e > DUPA + .05) { if (!(mom.cheie in eu.q)) { eu.q[mom.cheie] = SINGUR; eu.st.franari++; } mom = null; }
    } else { mom.rezT -= dt; if (mom.rezT <= 0) mom = null; }
    if (mom && !activ) mom = null;
  }
  pune(fb, '.on', !!mom);
  if (!mom) pune(el('fbt'), 'text', '');
  const rz = mom && mom.rez, fq = el('fbq');
  // după apăsare: inelul rămâne unde l-ai prins, iar nota apare în buton
  pune(el('fbg'), 'text', rz ? (rz.sc > 0 ? String(Math.round(rz.sc * 100)) : '✕') : ''); pune(el('fbi'), '@opacity', rz ? '0' : '1');
  // cât inelul e în zona bună, tot butonul se aprinde
  pune(fb, '.zona', !!(mom && !rz && Math.abs(mom.e) <= mom.fer * .39));
  if (!START || START.msgT <= 0) {
    // sub buton: Perfect, altfel cât de devreme sau de târziu ai apăsat (ca să știi încotro să corectezi)
    pune(fq, 'text', rz ? (rz.sc >= .9 ? rz.txt : `${mom.e < 0 ? 'Devreme' : 'Târziu'} ${Math.abs(mom.e).toFixed(2).replace('.', ',')} s`) : '');
    pune(fq, 'color', rz && rz.sc >= .9 ? '#ffe27a' : '');
  }
  // liniile: pe Atac spre mașina din față, pe Apără spre cea din spate (elementele există; doar se mută)
  const ln = el('ln'), m = eu.mod, G0 = GM[eu.i];
  if (!HE.lnL) { ln.innerHTML = '<line stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><circle r="22" fill="none" stroke-width="3"/>'; HE.lnL = ln.firstChild; HE.lnC = ln.lastChild; }
  const arata = !!(activ && G0 && G0.scr && m.pe && GM[m.pe.i] && GM[m.pe.i].scr && !harta);
  pune(ln, '@visibility', arata ? 'visible' : 'hidden');
  if (arata) {
    const T = GM[m.pe.i], [x1, y1] = G0.scr, [x2, y2] = T.scr, col = m.k === 'atac' ? '#ed1b2f' : '#3d7bff';
    // cercul în jurul jetonului țintă (puțin mai mare decât el); linia între marginile celor două jetoane
    const rT = (T.rs || 20) + 6, r0 = (G0.rs || 20) + 3, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, lung = d > r0 + rT + 6;
    HE.lnL.setAttribute('x1', (x1 + ux * r0).toFixed(1)); HE.lnL.setAttribute('y1', (y1 + uy * r0).toFixed(1)); HE.lnL.setAttribute('x2', (x2 - ux * rT).toFixed(1)); HE.lnL.setAttribute('y2', (y2 - uy * rT).toFixed(1));
    pune(HE.lnL, '@visibility', lung ? 'visible' : 'hidden');
    HE.lnC.setAttribute('cx', x2.toFixed(1)); HE.lnC.setAttribute('cy', y2.toFixed(1)); HE.lnC.setAttribute('r', rT.toFixed(1));
    pune(HE.lnL, '@stroke', col); pune(HE.lnC, '@stroke', col);
  }
  const p = Math.round(eu.tyre * 100);
  pune(el('tp'), 'text', String(eu.box ? (eu.box.faza === 'stop' && !eu.box.asteapta ? f1(eu.svc || 0) : 'P') : p));
  pune(el('tr0'), '@stroke-dashoffset', (144.5 * (1 - eu.tyre)).toFixed(1)); pune(el('tr0'), '@stroke', PNEU[eu.cmp || 'M'].col); pune(el('tp'), 'color', p < 25 && !eu.box ? '#ed1b2f' : '');
  if (alegPneu && (!activ || eu.cere)) alegPneu = false;
  pune(el('pxa'), 'hidden', !alegPneu);
  const px = el('px'); pune(px, '.cere', eu.cere || eu.pit > 0); pune(px, '.puls', activ && p < 30 && !eu.cere && eu.s < (TURURI - 1) * L);
  // pistolul de roți: apare cât stai în box; bara se umple cât ții apăsat, se aprinde în zona bună
  {
    const B = eu.box, sta = !!(B && B.faza === 'stop' && eu.eu), f = SV.tine ? (ceas - SV.t0) / SCH.plin : 0, areRez = SV.rez && ceas < SV.rezT;
    if (SV.tine && f >= 1) { SV.tine = false; SV.rez = 'Prea târziu'; SV.rezT = ceas + 1.1; if (B && B.asteapta) schimbGata(eu, SCH.ratat); }
    pune(el('sch'), 'hidden', !(sta && (B.asteapta || areRez)));
    pune(el('schf'), 'width', `${Math.min(100, f * 100).toFixed(1)}%`);
    pune(el('sch'), '.zona', SV.tine && Math.abs(f - SCH.mij) <= SCH.lat * .45);
    pune(el('scht'), 'text', areRez ? SV.rez : SV.tine ? 'Strânge…' : 'Ține apăsat');
  }
  pune(el('pxx'), 'hidden', !eu.cere); pune(el('pxs'), 'hidden', !(eu.cere || eu.pit > 0) || alegPneu || !!(eu.box && eu.box.asteapta));
  pune(el('pxs'), 'text', eu.box ? (eu.box.faza === 'stop' ? 'Roți noi' : `${Math.round(BOX.v * 3.6)} km/h`) : `${PNEU[eu.cmpNou || eu.cmp || 'M'].n} în ${Math.ceil((((L - BOX.intrare - eu.s) % L) + L) % L / 40 / VIT)} s`);
}
// ---------- scena: pista 3D, mașinile jetoane cu poză ----------
const vw = $('vw'); let W = vw.clientWidth, H = vw.clientHeight;
const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(window.Shared && Shared.store.get('frq_cursa_gfx', 'clara') === 'baterie' ? 1 : Math.min(devicePixelRatio, 2)); R.setSize(W, H); vw.insertBefore(R.domElement, vw.firstChild);
// lumină de zi: cer deschis, iarbă verde crud, culori vii (arcade, se citește ușor pe telefon)
const S = new THREE.Scene(); S.background = new THREE.Color(0xb4dcf0); S.fog = new THREE.Fog(0xb4dcf0, 340, 720);
const CAM = new THREE.PerspectiveCamera(32, W / H, 15, 1100);
S.add(new THREE.HemisphereLight(0xffffff, 0x6f8f55, .78));
const soare = new THREE.DirectionalLight(0xfff4e0, .42); soare.position.set(-300, 600, 250); S.add(soare);
let mx = 0, my = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
for (let i = 0; i < N; i++) { mx += X[i]; my += Y[i]; x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); } mx /= N; my /= N;
// Texturile se fac pe loc, mici, fără fișiere de încărcat. Iarba are dungi de tuns (o textură de 64 px,
// repetată), asfaltul granulație.
const textura = (w, h, desen, rep, aniz = 1) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; desen(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(aniz, R.capabilities.getMaxAnisotropy()); if (rep) t.repeat.set(rep[0], rep[1]); return t;
};
let semT = 7; const rndT = () => (semT = (semT * 16807) % 2147483647) / 2147483647;
const zgomot = (x, w, h, [r0, g0, b0], amp, pete) => {
  const d = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = (rndT() - .5) * amp; d.data[i * 4] = r0 + v; d.data[i * 4 + 1] = g0 + v; d.data[i * 4 + 2] = b0 + v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0);
  for (let k = 0; k < (pete || 0); k++) { x.fillStyle = `rgba(0,0,0,${.04 + rndT() * .06})`; x.beginPath(); x.arc(rndT() * w, rndT() * h, 4 + rndT() * 14, 0, 7); x.fill(); }
};
const iarbaT = textura(64, 64, (x, w, h) => { zgomot(x, w, h, [138, 196, 76], 7); x.fillStyle = 'rgba(40,80,0,.07)'; x.fillRect(0, 0, w / 2, h); }, [200, 200]);
const sol = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: iarbaT })); sol.rotation.x = -Math.PI / 2; sol.position.set(mx, -.05, my); S.add(sol);
// doar asfaltul are filtrare la unghi (se vede de-a lungul pistei); iarba nu are nevoie
const asfaltT = textura(128, 128, (x, w, h) => zgomot(x, w, h, [66, 70, 82], 9, 10), null, 4);
// O panglică de-a lungul pistei, între două depărtări de axă (numere sau funcții de punct), cu
// culoare pe punct sau cu o textură (atunci u: pe lățime, v: pe lungime, la 8 m). plat: culorile exact cum
// sunt, fără lumină (liniile și bordurile rămân albe de-adevăratelea).
const panglica = (o1, o2, yy, colFn, doar, tex, plat) => {
  const pos = [], col = [], uv = [], c = new THREE.Color(), O = o => (typeof o === 'function' ? o : () => o);
  const f1 = O(o1), f2 = O(o2);
  for (let s = 0; s < N; s++) {
    if (doar && !doar(s)) continue; const j = (s + 1) % N, p = (i, o) => [X[i] - Math.sin(Hd[i]) * o, yy, Y[i] + Math.cos(Hd[i]) * o];
    const a = p(s, f1(s)), b = p(s, f2(s)), cc = p(j, f2(j)), d = p(j, f1(j)); pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    if (tex) { const v0 = s * step / 8, v1 = (s + 1) * step / 8; uv.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1); }
    else { c.set(colFn(s)); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (tex) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); else g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  S.add(new THREE.Mesh(g, tex ? new THREE.MeshLambertMaterial({ map: tex }) : plat ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
};
// un perete de-a lungul pistei (parapetul din virajele mari), la o depărtare de axă
const perete = (o, h, colFn, doar) => {
  const pos = [], col = [], c = new THREE.Color(), fo = typeof o === 'function' ? o : () => o;
  for (let s = 0; s < N; s++) {
    if (!doar(s)) continue; const j = (s + 1) % N, p = (i, y) => [X[i] - Math.sin(Hd[i]) * fo(i), y, Y[i] + Math.cos(Hd[i]) * fo(i)];
    const a = p(s, 0), b = p(s, h), cc = p(j, h), d = p(j, 0); pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    c.set(colFn(s)); for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  S.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
};
const colt = s => Math.abs(K[s]) > .007;
// Fiecare viraj: pietriș de nisip pe exterior, cu capete rotunjite (se lățește și se strânge lin, pe tot
// virajul și puțin după ieșire); bordurile doar unde sunt la un circuit: la intrare și la ieșire pe
// exterior, la vârf pe interior. Valorile țin partea (+1 sau -1, ca depărtarea de axă), 0 = nimic.
// La virajele rapide degajarea e din asfalt, cu o bandă vopsită roșu-alb lângă bordură (ca la circuitele
// noi); la cele lente, pietriș. asfaltD[i] = 1 unde degajarea e asfalt.
const pietrisL = new Float32Array(N), pietrisP = new Int8Array(N), bordura = new Int8Array(N), asfaltD = new Uint8Array(N), mod = k => ((k % N) + N) % N;
for (let i = 0; i < N; i++) if (colt(i) && !colt(mod(i - 1))) {
  let b = i; while (colt(mod(b + 1)) && b - i < N) b++;
  // exteriorul: K > 0 înseamnă viraj spre +depărtare (dreapta pe ecran), deci exteriorul e pe partea cealaltă
  const lung = b - i + 1, ext = -Math.sign(K[mod(i + (lung >> 1))]) || 1, fin = b + 12;
  let ap = i; for (let k = i; k <= b; k++) if (Math.abs(K[mod(k)]) > Math.abs(K[mod(ap)])) ap = k;
  let ap0 = i; for (let k = i; k <= b; k++) if (VC[mod(k)] < VC[mod(ap0)]) ap0 = k;
  const rapid = VC[mod(ap0)] >= VTOP * .44 ? 1 : 0;
  for (let k = i - 4; k <= fin; k++) { const l = 13.6 * neted(Math.min(k - (i - 4), fin - k) / 9); if (l > pietrisL[mod(k)]) { pietrisL[mod(k)] = l; pietrisP[mod(k)] = ext; asfaltD[mod(k)] = rapid; } }
  const r = Math.max(3, Math.round(lung * .2));
  for (let k = ap - r; k <= ap + r; k++) bordura[mod(k)] = -ext;
  for (let k = i - 2; k < i + Math.max(3, Math.round(lung * .15)); k++) bordura[mod(k)] = ext;
  for (let k = b - Math.round(lung * .3); k <= b + 6; k++) bordura[mod(k)] = ext;
}
// o degajare continuă are un singur fel (pietriș sau asfalt): două viraje apropiate nu mai lasă petice
for (const p of [-1, 1]) for (let i = 0; i < N; i++) if (pietrisP[i] === p && pietrisL[i] > .2 && !(pietrisP[mod(i - 1)] === p && pietrisL[mod(i - 1)] > .2)) {
  let n = 0, tip = 1; while (pietrisP[mod(i + n)] === p && pietrisL[mod(i + n)] > .2 && n < N) { tip = Math.min(tip, asfaltD[mod(i + n)]); n++; }
  for (let k = 0; k < n; k++) asfaltD[mod(i + k)] = tip;
}
for (const p of [-1, 1]) {
  for (let i = 0; i < N; i++) if (bordura[i] === p) for (let g = 2; g <= 5; g++) if (bordura[mod(i + g)] === p) { for (let k = 1; k < g; k++) if (!bordura[mod(i + k)]) bordura[mod(i + k)] = p; break; }
  for (let i = 0; i < N; i++) if (bordura[i] === p && bordura[mod(i - 1)] !== p) { let n = 0; while (bordura[mod(i + n)] === p && n < N) n++; if (n < 5) for (let k = 0; k < n; k++) bordura[mod(i + k)] = 0; }
}
const nisip = s => (Math.floor(s / 2) * 7919 % 5 < 2 ? 0xd8c99c : 0xd1c194);
for (const p of [-1, 1]) {
  const pe = i => pietrisP[i] === p && pietrisL[i] > .2, o1 = i => (p < 0 ? -8.4 - pietrisL[i] : 6.9), o2 = i => (p < 0 ? -6.9 : 8.4 + pietrisL[i]);
  panglica(o1, o2, .01, nisip, i => pe(i) && !asfaltD[i]);
  panglica(o1, o2, .012, () => 0x8db4d4, i => pe(i) && asfaltD[i]);
}
// asfaltul, cu textură, și urma de cauciuc de pe trasa ideală (spre interiorul virajelor)
panglica(-7, 7, .03, null, null, asfaltT);
const trasa = Float64Array.from(K, k => -Math.sign(k) * Math.min(4, Math.abs(k) * 380));
for (let r = 0; r < 3; r++) for (let i = 0; i < N; i++) trasa[i] = (trasa[(i - 1 + N) % N] + trasa[i] * 2 + trasa[(i + 1) % N]) / 4;
panglica(i => trasa[i] - 1.7, i => trasa[i] + 1.7, .04, () => 0x3a3d48);
// urmele de frână: dâre închise pe trasă, în zonele de frânare (apar și se sting lin)
const urme = new Float32Array(N);
for (const F of FRANARI) { const a = Math.floor(F.sB / step), b = Math.ceil(F.sA / step); for (let k = a; k <= b; k++) urme[mod(k)] = Math.max(urme[mod(k)], Math.sin(Math.PI * (k - a) / Math.max(1, b - a)) ** .6); }
const dara = s => new THREE.Color(0x42465a).lerp(new THREE.Color(0x23252c), urme[s] * .75).getHex();
for (const o of [-.95, .95]) panglica(i => trasa[i] + o - .22, i => trasa[i] + o + .22, .043, dara, i => urme[i] > .02);
for (const o of [-2.6, 2.4]) panglica(i => trasa[i] + o - .18, i => trasa[i] + o + .18, .042, s => new THREE.Color(0x42465a).lerp(new THREE.Color(0x1d1e22), urme[s] * .45).getHex(), i => urme[i] > .02);
panglica(-7, -6.6, .05, () => 0xf2f2f2, null, null, true); panglica(6.6, 7, .05, () => 0xf2f2f2, i => !guraBoxe(i), null, true);
const dunga = s => (Math.floor(s / 2) % 2 ? 0xd8202f : 0xf4f4f4);
panglica(-8.4, -7, .06, dunga, i => bordura[i] === -1, null, true); panglica(7, 8.4, .06, dunga, i => bordura[i] === 1, null, true);
// parapetul din cauciucuri pe exteriorul virajelor, cu o bandă colorată deasupra (se vede de sus)
// parapetul: chiar pe marginea pietrișului (se strânge odată cu el), doar unde pietrișul e lat
const parapet = i => pietrisL[i] > 9, banda = s => (Math.floor(s / 4) % 3 === 0 ? 0xf4f4f4 : 0xd81528);
for (const p of [-1, 1]) {
  const a = i => p * (8.6 + pietrisL[i]), b = i => p * (9.6 + pietrisL[i]), pe = i => parapet(i) && pietrisP[i] === p;
  perete(a, 1.1, () => 0x1b1c20, pe); perete(b, 1.1, () => 0x1b1c20, pe);
  panglica(p < 0 ? b : a, p < 0 ? a : b, 1.1, banda, pe, null, true);
}
// Culoarul boxelor: același asfalt ca pista, iese din ea și intră înapoi fără cusătură: la capete e lipit
// de pistă (marginea lui din afară continuă marginea pistei), iar linia albă a pistei se întrerupe la gură. Pe culoar: banda de trecere, o linie albă continuă, apoi boxele pe
// betonul din fața garajelor; între culoar și pistă, zidul.
{
  const dI = i => dLinie(i * step), pe = i => dI(i) >= -BOX.intrare && dI(i) <= BOX.iesire, lb = i => latBoxe(dI(i));
  const in1 = i => lb(i) - 3.6, ex1 = i => lb(i) + 3.6, garaje = i => dI(i) >= -63 && dI(i) <= 28;
  panglica(in1, ex1, .025, null, pe, asfaltT);
  panglica(BOX.lat + 3.6, 24, .026, () => 0x8a8f99, garaje);
  panglica(in1, i => in1(i) + .3, .045, () => 0xf2f2f2, i => pe(i) && in1(i) > 8.6, null, true);
  panglica(i => ex1(i) - .3, ex1, .045, () => 0xf2f2f2, i => pe(i) && ex1(i) > 7.05 && !garaje(i), null, true);
  panglica(23.7, 24, .045, () => 0xf2f2f2, garaje, null, true);
  // linia continuă dintre bandă și boxe
  panglica(BOX.lat + 3.45, BOX.lat + 3.75, .046, () => 0xf2f2f2, garaje, null, true);
  // linia de limitator, galbenă, la capetele culoarului drept
  panglica(in1, ex1, .05, () => 0xf5c542, i => Math.abs(dI(i) + 62) < 1 || Math.abs(dI(i) - 22) < 1);
  const zid = i => pe(i) && in1(i) >= 9.9;
  perete(9, 1.1, () => 0x9a9ea7, zid); perete(9.8, 1.1, () => 0x9a9ea7, zid);
  panglica(9, 9.8, 1.1, i => (Math.floor(i / 4) % 2 ? 0xe2e4e8 : 0xc4c7ce), zid);
}
const ck = document.createElement('canvas'); ck.width = 14; ck.height = 2; const kx = ck.getContext('2d');
for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) { kx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; kx.fillRect(i, j, 1, 1); }
const tx = new THREE.CanvasTexture(ck); tx.magFilter = THREE.NearestFilter;
const linie = new THREE.Mesh(new THREE.PlaneGeometry(2, 14), new THREE.MeshBasicMaterial({ map: tx })); linie.rotation.x = -Math.PI / 2; linie.rotation.z = -Hd[0]; linie.position.set(X[0], .08, Y[0]); S.add(linie);
const lang = (s, o) => [X[idx(s)] - Math.sin(Hd[idx(s)]) * o, Y[idx(s)] + Math.cos(Hd[idx(s)]) * o];
const departe = (x, y, d) => { for (let s = 0; s < N; s += 4) if ((X[s] - x) ** 2 + (Y[s] - y) ** 2 < d * d) return false; return true; };
// grila de start: câte o cutie albă pentru fiecare loc (aceleași locuri ca în cursaNoua)
{
  const g = new THREE.InstancedMesh(new THREE.PlaneGeometry(5, .5), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }), 10), o = new THREE.Object3D();
  for (let k = 0; k < 10; k++) { const sk = -Math.floor(k / 2) * 20 - (k % 2) * 10 - 3.5, [x, z] = lang(sk, k % 2 ? 4 : -4); o.position.set(x, .07, z); o.rotation.set(-Math.PI / 2, 0, -Hd[idx(sk)] + Math.PI / 2); o.updateMatrix(); g.setMatrixAt(k, o.matrix); }
  S.add(g);
}
// boxele: câte o linie albă între ele, pe beton (o singură desenare)
{
  const g = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, .3), new THREE.MeshBasicMaterial({ color: 0xd8d8d8 }), 11), o = new THREE.Object3D();
  for (let k = 0; k <= 10; k++) { const sk = BOX.loc(0) + (k - .5) * 9, [x, z] = lang(sk, BOX.lat + 6.7); o.position.set(x, .047, z); o.rotation.set(-Math.PI / 2, 0, -Hd[idx(sk)] + Math.PI / 2); o.updateMatrix(); g.setMatrixAt(k, o.matrix); }
  S.add(g);
}
const cladire = (s, o, lung, lat, inalt, culoare, geam) => {
  const [x, z] = lang(s, o), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Hd[idx(s)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(lung, inalt, lat), new THREE.MeshLambertMaterial({ color: culoare })); b.position.y = inalt / 2; g.add(b);
  if (geam) { const w = new THREE.Mesh(new THREE.BoxGeometry(lung * .94, inalt * .28, lat + .2), new THREE.MeshBasicMaterial({ color: geam })); w.position.y = inalt * .62; g.add(w); }
  S.add(g);
};
// garajele: clădirea din spatele boxelor, cu câte o ușă deschisă (interior luminat) în dreptul fiecărei
// boxe și FRQ mare pe acoperiș (se vede de sus); culoarea fiecărui pilot, deasupra ușii lui (în scena())
cladire(-28, 29, 126, 10, 9, 0x8d929c, null);
{
  const usa = textura(64, 48, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0c10'); g.addColorStop(.7, '#2a2620'); g.addColorStop(1, '#6b5a3c'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,220,160,.35)'; x.fillRect(6, 4, w - 12, 3); });
  const g = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 5.6), new THREE.MeshBasicMaterial({ map: usa }), 10), o = new THREE.Object3D();
  for (let k = 0; k < 10; k++) { const sk = BOX.loc(k), [x, z] = lang(sk, 23.9); o.position.set(x, 2.8, z); o.rotation.set(0, -Hd[idx(sk)] + Math.PI, 0); o.updateMatrix(); g.setMatrixAt(k, o.matrix); }
  S.add(g);
  const acop = textura(512, 64, (x, w, h) => { x.fillStyle = '#e9ebee'; x.fillRect(0, 0, w, h); x.fillStyle = '#d81528'; x.font = '900 52px "Big Shoulders Display", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('F R Q', w / 2, h / 2 + 3); });
  const [ax, az] = lang(-28, 29), a = new THREE.Mesh(new THREE.PlaneGeometry(120, 9), new THREE.MeshLambertMaterial({ map: acop }));
  a.rotation.order = 'YXZ'; a.rotation.set(-Math.PI / 2, -Hd[idx(-28)], 0); a.position.set(ax, 9.05, az); S.add(a);
}
// ---------- sponsorii pe pistă ----------
// Ca la F1, doar pe lângă pistă (nimic nu apare peste joc): principalul pe pod, pe poartă și pictat pe
// asfalt după linie; partenerii și susținătorii pe panourile de pe drepte; toți scriși mare pe degajări și
// pe pietriș (acolo mașina merge încet și chiar se văd) și pe tribune. Câte
// o textură pe loc de sponsor (0 = principalul, 1-5 = ceilalți pe rând), redesenată când vine lista de
// pe server; fără sponsori, FRQ. Panourile: numele mare pe culoarea lui.
const SPN = 6, spC = [], spT = [], spLung = document.createElement('canvas'); spLung.width = 1024; spLung.height = 48;
const spLungT = new THREE.CanvasTexture(spLung);
for (let k = 0; k < SPN; k++) { const c = document.createElement('canvas'); c.width = 256; c.height = 96; spC.push(c); const t = new THREE.CanvasTexture(c); t.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy()); spT.push(t); }
const SPM = 3, spMC = [], spMT = [], spTC = [], spTT = [];
const panza = (lista, texturi, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; lista.push(c); const t = new THREE.CanvasTexture(c); t.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy()); texturi.push(t); };
for (let k = 0; k < SPM; k++) { panza(spMC, spMT, 1024, 128); panza(spTC, spTT, 1024, 256); }
let SP_PRINCIPAL = null;
// ce s-a pus pe pistă, pentru hartă și pentru intro: fâșiile pictate și tribunele, cu locul și sponsorul lor
const FASII = [], TRIB = [], SP_SLOT = [], SP_VIRAJ = new Map();
let SP_SEMN = '';
const fontSp = (x, txt, w, max) => { let f = max; x.font = `900 ${f}px "Big Shoulders Display", Impact, sans-serif`; while (f > 14 && x.measureText(txt).width > w) { f -= 2; x.font = `900 ${f}px "Big Shoulders Display", Impact, sans-serif`; } };
// culoarea scrisului pe fundalul sponsorului: alb, sau închis pe culori deschise
const peCuloare = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff'; const n = parseInt(m[1], 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 > .62 ? '#0a0a0c' : '#fff'; };
function desenSponsor(c, tex, s, alt) {
  const x = c.getContext('2d'), w = c.width, h = c.height, txt = (s ? s.nume : 'FRQ').toUpperCase(), bg = s ? (s.culoare || '#d81528') : alt ? '#0a0a0c' : '#d81528';
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = peCuloare(bg); x.textAlign = 'center'; x.textBaseline = 'middle'; fontSp(x, txt, w - 16, Math.round(h * .74)); x.fillText(txt, w / 2, h / 2 + 2);
  tex.needsUpdate = true;
}
// Numele pictat pe jos, pe lung: o fâșie de 8 la 1 cu litere în proporțiile lor (nu se întind), fără fundal,
// cu contur închis. Numele se repetă cât încape întreg; dacă e prea lung, se micșorează, nu se taie.
function desenPictat(c, tex, s) {
  const x = c.getContext('2d'), w = c.width, h = c.height, txt = (s ? s.nume : 'FRQ').toUpperCase(), pauza = 90;
  x.clearRect(0, 0, w, h); x.textAlign = 'left'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  let f = Math.round(h * .92); x.font = `900 ${f}px "Big Shoulders Display", Impact, sans-serif`;
  let lat = x.measureText(txt).width;
  if (lat > w - 24) { f = Math.floor(f * (w - 24) / lat); x.font = `900 ${f}px "Big Shoulders Display", Impact, sans-serif`; lat = x.measureText(txt).width; }
  const n = Math.max(1, Math.floor((w - 24 + pauza) / (lat + pauza))), tot = n * lat + (n - 1) * pauza;
  x.lineWidth = Math.max(5, f * .09); x.strokeStyle = 'rgba(10,10,12,.88)'; x.fillStyle = s ? (s.culoare || '#d81528') : '#d81528';
  for (let k = 0; k < n; k++) { const px = (w - tot) / 2 + k * (lat + pauza); x.strokeText(txt, px, h / 2 + 3); x.fillText(txt, px, h / 2 + 3); }
  tex.needsUpdate = true;
}
// Tribuna: sus numele mare (acoperișul), jos o bandă cu numele repetat (peretele din față).
function desenTribuna(c, tex, s) {
  const x = c.getContext('2d'), w = c.width, h = c.height, txt = (s ? s.nume : 'FRQ').toUpperCase(), bg = s ? (s.culoare || '#d81528') : '#d81528';
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = peCuloare(bg); x.textAlign = 'center'; x.textBaseline = 'middle';
  fontSp(x, txt, w - 40, 170); x.fillText(txt, w / 2, 102);
  fontSp(x, txt, w / 4 - 24, 44); for (let k = 0; k < 4; k++) x.fillText(txt, w * (k + .5) / 4, 229);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 199, w, 2);
  tex.needsUpdate = true;
}
function sponsoriPista() {
  const SPO = window.Sponsori, l = SPO ? SPO.lista() : [], pr = l.find(s => s.nivel === 1) || null, rest = l.filter(s => s.nivel >= 2).sort((a, b) => a.nivel - b.nivel);
  SP_PRINCIPAL = pr;
  // virajele poartă nume de sponsori, câte unul, ca în F1: V1 principalul, apoi ceilalți; ce rămâne stă V1, V2...
  { const toti = (pr ? [pr] : []).concat(rest); SP_VIRAJ.clear(); GRUPURI.forEach((G, i) => { if (toti[i]) SP_VIRAJ.set(G, toti[i]); }); SP_SEMN = toti.map(x => x.id + x.nume + x.culoare).join('|'); }
  desenSponsor(spC[0], spT[0], pr, false);
  for (let k = 1; k < SPN; k++) desenSponsor(spC[k], spT[k], rest.length ? rest[(k - 1) % rest.length] : null, k % 2 === 1);
  for (let k = 0; k < SPM; k++) { const cine = k === 0 ? pr || rest[0] || null : rest.length ? rest[(k - 1) % rest.length] : pr; SP_SLOT[k] = cine; desenPictat(spMC[k], spMT[k], cine); desenTribuna(spTC[k], spTT[k], cine); }
  // banda lungă (podul, grinda porții): principalul de trei ori, sau FRQ
  const x = spLung.getContext('2d'), w = spLung.width, h = spLung.height, txt = (pr ? pr.nume : 'FRQ').toUpperCase();
  x.fillStyle = pr ? (pr.culoare || '#d81528') : '#d81528'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(0, 3, w, 2); x.fillRect(0, h - 5, w, 2);
  x.textAlign = 'center'; x.textBaseline = 'middle'; fontSp(x, txt, w / 3 - 30, 34); for (let k = 0; k < 3; k++) x.fillText(txt, w * (k + .5) / 3, h / 2 + 1);
  spLungT.needsUpdate = true;
}
// o afișare pe pagină pentru fiecare sponsor de pe pistă, când chiar pornește o cursă sau un tur
function numaraSponsoriPista() { const SPO = window.Sponsori; if (!SPO) return; SPO.lista().forEach(s => SPO.vazut(s.id, 'pista')); }
sponsoriPista();
document.addEventListener('frq-sponsori', sponsoriPista);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(sponsoriPista);
const portal = new THREE.Group(); portal.position.set(X[0], 0, Y[0]); portal.rotation.y = -Hd[0];
const gm = new THREE.MeshLambertMaterial({ color: 0x24242b });
for (const z of [-10, 10]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.8, 9, .8), gm); st.position.set(0, 4.5, z); portal.add(st); }
// grinda: roșie (un text pe ea, văzută de sus, ieșea strivit); luminile sunt pe panoul din față
const grinda = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 23), new THREE.MeshBasicMaterial({ color: 0xd81528 })); grinda.position.y = 9.4; portal.add(grinda);
// panoul cu cele 5 coloane de lumini, cu fața spre grilă (aprinse în lumini(), ca pe ecran)
const lumC = document.createElement('canvas'); lumC.width = 256; lumC.height = 64; const lumT = new THREE.CanvasTexture(lumC);
const poartaLumini = n => {
  const x = lumC.getContext('2d'); x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) { const on = i < n; x.fillStyle = on ? '#ff2a3d' : '#3a0d12'; x.beginPath(); x.arc(32 + i * 48, 20 + r * 24, 9, 0, 7); x.fill(); if (on) { x.fillStyle = 'rgba(255,90,100,.35)'; x.beginPath(); x.arc(32 + i * 48, 20 + r * 24, 14, 0, 7); x.fill(); } }
  lumT.needsUpdate = true;
};
poartaLumini(0);
{ const pl = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshBasicMaterial({ map: lumT })); pl.rotation.order = 'YXZ'; pl.rotation.set(-.45, -Math.PI / 2, 0); pl.position.set(-.8, 9.4, 0); portal.add(pl); }
{ const ps = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ map: spLungT })); ps.rotation.order = 'YXZ'; ps.rotation.set(-.45, -Math.PI / 2, 0); ps.position.set(-.9, 11.4, 0); portal.add(ps); }
S.add(portal);
// podul FRQ peste mijlocul celei mai lungi drepte (alta decât cea a boxelor)
{
  let best = null;
  for (let i = 0; i < N; i++) if (VC[i] >= VTOP * .98 && VC[mod(i - 1)] < VTOP * .98) {
    let b = i; while (VC[mod(b + 1)] >= VTOP * .98 && b - i < N) b++;
    const m = mod((i + b) >> 1); if (Math.abs(dLinie(m * step)) > 260 && (!best || b - i > best[1])) best = [m, b - i];
  }
  if (best) {
    const [m] = best, g = new THREE.Group(), [x, z] = lang(m * step, 0); g.position.set(x, 0, z); g.rotation.y = -Hd[m];
    const tFRQ = rot => { const t = textura(512, 64, (cx, w, h) => { cx.fillStyle = '#d81528'; cx.fillRect(0, 0, w, h); cx.fillStyle = '#fff'; cx.fillRect(0, 4, w, 3); cx.fillRect(0, h - 7, w, 3); cx.font = '900 44px "Big Shoulders Display", Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('FRQ  ·  FRQ  ·  FRQ', w / 2, h / 2 + 2); }); if (rot) { t.center.set(.5, .5); t.rotation = Math.PI / 2; } return new THREE.MeshLambertMaterial({ map: t }); };
    const mB = new THREE.MeshLambertMaterial({ color: 0x2c2e35 }), lat = new THREE.MeshBasicMaterial({ map: spLungT });
    const pod = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 42), [lat, lat, tFRQ(true), mB, mB, mB]); pod.position.y = 10; g.add(pod);
    for (const zz of [-19.5, 19.5]) { const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 2.2), mB); st.position.set(0, 5, zz); g.add(st); }
    S.add(g);
  }
}
// Panouri cu fața spre mașinile care vin, înclinate spre cameră (o placă paralelă cu pista, văzută de sus și
// din spate, ieșea o fâșie subțire sau scrisul în picioare): bannerele FRQ
// pe lângă drepte și panourile de distanță 150 / 100 / 50 m înainte de fiecare frânare.
const panouri = (tex, lung, inalt, locuri) => {
  const g = new THREE.InstancedMesh(new THREE.PlaneGeometry(lung, inalt), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), locuri.length), o = new THREE.Object3D();
  o.rotation.order = 'YXZ';
  locuri.forEach(([s, lat, sDir, px, pz], k) => { const [x, z] = px == null ? lang(s, lat) : [px, pz]; o.position.set(x, inalt * .45, z); o.rotation.set(-1, -Hd[idx(sDir ?? s)] - Math.PI / 2, 0); o.updateMatrix(); g.setMatrixAt(k, o.matrix); });
  S.add(g);
};
{
  // Panourile sponsorilor pe drepte, pe ambele părți (la 60 m, decalate): nu în viraje, nu lângă
  // boxe, poartă sau pod, nu peste panourile de distanță, doar unde nu e altă bucată de pistă aproape.
  const distante = []; for (const F of FRANARI) for (const d of [150, 100, 50]) distante.push(mod(Math.round((F.sB - d) / step)));
  const grupe = Array.from({ length: SPN }, () => []);
  let nr = 0;
  for (const p of [-1, 1]) for (let i = p < 0 ? 0 : 15; i < N; i += 30) {
    if (VC[i] < VTOP * .85 || pietrisL[i] > 0 || colt(i) || colt(mod(i + 4))) continue;
    const d = dLinie(i * step); if (d > -140 && d < 100) continue;
    if (distante.some(k => Math.abs(((k - i + N / 2) % N + N) % N - N / 2) < 6)) continue;
    const lat = 14 * p, [x, z] = lang(i * step, lat); if (!departe(x, z, 11)) continue;
    grupe[nr % 7 < 2 ? 0 : 1 + (nr % (SPN - 1))].push([i * step, lat]); nr++;
  }
  grupe.forEach((g, k) => { if (g.length) panouri(spT[k], 12, 4.5, g); });
  for (const d of [150, 100, 50]) {
    const td = textura(64, 44, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.lineWidth = 4; x.strokeStyle = '#0a0a0c'; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = '#0a0a0c'; x.font = '900 28px "Big Shoulders Display", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(d), w / 2, h / 2 + 1); });
    panouri(td, 4.4, 3, FRANARI.map(F => [F.sB - d, 10.5 * (K[idx(F.sA)] > 0 ? -1 : 1)]));
  }
}
// principalul pictat pe asfalt, după linie
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ map: spT[0], transparent: true, opacity: .82, depthWrite: false })); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, -Hd[idx(32)] - Math.PI / 2, 0); const [x, z] = lang(32, -1.5); m.position.set(x, .047, z); S.add(m); }
// Padocul din spatele garajelor: beton, camioanele echipelor în culorile piloților, rulote, o parcare.
{
  const dI = i => dLinie(i * step), aici = i => dI(i) >= -96 && dI(i) <= 34;
  panglica(35, 82, .02, () => 0xa3a8b0, aici);
  const cub = new THREE.BoxGeometry(1, 1, 1), o = new THREE.Object3D(), col = new THREE.Color();
  const loc = (s, lat, lu, la, h, k, m, c) => { const [x, z] = lang(s, lat); o.position.set(x, h / 2, z); o.rotation.set(0, -Hd[idx(s)], 0); o.scale.set(lu, h, la); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, col.set(c)); };
  const camioane = new THREE.InstancedMesh(cub, new THREE.MeshLambertMaterial({ color: 0xffffff }), 20);
  for (let k = 0; k < 10; k++) { const s = -88 + k * 12.5, c = PILOTI[k % PILOTI.length][2]; loc(s, 42, 10, 3.2, 3.8, k * 2, camioane, 0xe8eaee); loc(s + 6.6, 42, 3, 3, 3.2, k * 2 + 1, camioane, c); }
  const rulote = new THREE.InstancedMesh(cub, new THREE.MeshLambertMaterial({ color: 0xffffff }), 8);
  for (let k = 0; k < 8; k++) loc(-85 + k * 15.5, 54, 11, 4, 3.4, k, rulote, k % 2 ? 0x3a3d45 : 0xd8dadf);
  const masini = new THREE.InstancedMesh(cub, new THREE.MeshLambertMaterial({ color: 0xffffff }), 48), culori = [0xd81528, 0xf4f4f4, 0x2a2b31, 0x3d7bff, 0xf5c542, 0x9aa0a9, 0x1f9d57, 0x6b4b9a];
  for (let k = 0; k < 48; k++) loc(-90 + (k % 24) * 5, 66 + Math.floor(k / 24) * 9, 4.2, 2, 1.4, k, masini, culori[(k * 5 + Math.floor(k / 3)) % culori.length]);
  S.add(camioane, rulote, masini);
}
// Pete mari de iarbă mai deschisă sau mai închisă (ca să nu fie un singur verde) și umbrele norilor,
// care trec încet peste tot (se mișcă în desen()); amândouă dintr-o singură desenare fiecare.
let PETE = null;
const pataT = textura(64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
{
  const n = 22, m = PETE = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: pataT, transparent: true, opacity: .16, depthWrite: false }), n), o = new THREE.Object3D(), c = new THREE.Color();
  for (let k = 0; k < n; k++) { const sc = 60 + rndT() * 110; o.position.set(mx + (rndT() - .5) * 1000, -.04, my + (rndT() - .5) * 860); o.rotation.set(-Math.PI / 2, 0, rndT() * 6); o.scale.set(sc, sc * (.6 + rndT() * .5), 1); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, c.set(k % 2 ? 0xc8ff8a : 0x1f4d1a)); }
  S.add(m);
}
const economie = () => !!(window.Shared && Shared.store.get('frq_cursa_gfx', 'clara') === 'baterie');
const NORI = { m: new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: pataT, color: 0x000000, transparent: true, opacity: .13, depthWrite: false }), 4), p: [] };
for (let k = 0; k < 4; k++) NORI.p.push({ x: mx + (rndT() - .5) * 1100, z: my + (rndT() - .5) * 900, s: 140 + rndT() * 120, r: rndT() * 6 });
NORI.m.renderOrder = 3; S.add(NORI.m);
const oN = new THREE.Object3D();
function misaNori(dt) {
  const vede = !economie(); NORI.m.visible = vede; if (PETE) PETE.visible = vede; if (!vede) return;
  for (let k = 0; k < NORI.p.length; k++) {
    const n = NORI.p[k]; n.x += 4 * dt; n.z += 1.6 * dt;
    if (n.x > mx + 650) n.x -= 1300; if (n.z > my + 560) n.z -= 1120;
    oN.position.set(n.x, .3, n.z); oN.rotation.set(-Math.PI / 2, 0, n.r); oN.scale.set(n.s, n.s * .62, 1); oN.updateMatrix(); NORI.m.setMatrixAt(k, oN.matrix);
  }
  NORI.m.instanceMatrix.needsUpdate = true;
}
misaNori(0);
// Numele sponsorilor scris pe lung pe degajări și pe pietriș, de-a lungul curbei (acolo mașina merge
// încet); lângă ele, tribune adevărate: blocuri drepte de 36 m, cu 5 trepte și public pe ele,
// capete, perete în spate și acoperiș în culoarea sponsorului, cu numele lui. O singură geometrie pentru
// tribune, câte una pentru fiecare sponsor de pe acoperișuri.
{
  const ocupat = [], liber = (x, z, d) => ocupat.every(([a, b]) => (a - x) ** 2 + (b - z) ** 2 > d * d);
  const viraje = [];
  for (let i = 0; i < N; i++) if (colt(i) && !colt(mod(i - 1))) { let b = i; while (colt(mod(b + 1)) && b - i < N) b++; let a = i; for (let k = i; k <= b; k++) if (VC[mod(k)] < VC[mod(a)]) a = k; viraje.push({ a: mod(a), v: VC[mod(a)], p: pietrisP[mod(a)] || -Math.sign(K[mod(a)]) || 1 }); }
  viraje.sort((x, y) => x.v - y.v);
  // fâșiile cu nume: 44 m pe lung și 5,5 m lățime, urmează curba, lipite de bordură; doar unde pietrișul sau
  // degajarea sunt destul de late pe toată lungimea, deci nimic nu iese din ele. Partea de sus a literelor e
  // mereu spre exterior, ca textul să stea drept când îl vezi în viraj (și la stânga, și la dreapta).
  const fPos = [[], [], []], fUv = [[], [], []], LF = 22, GOL = 4, o1 = 9.3, o2 = 14.8;
  let nS = 0;
  for (const p of [-1, 1]) {
    const bun = i => pietrisP[mod(i)] === p && pietrisL[mod(i)] >= 7.2;
    let st = 0; while (bun(st) && st < N) st++;
    for (let i = st; i < st + N; i++) {
      if (!bun(i) || bun(i - 1)) continue;
      let n = 0; while (bun(i + n) && n < N) n++;
      for (let q = 0, c = Math.floor((n + GOL) / (LF + GOL)), start = i + Math.floor((n - (c * LF + (c - 1) * GOL)) / 2); q < c; q++) {
        const a = start + q * (LF + GOL), slot = nS++ % SPM, lo = p < 0 ? -o2 : o1, hi = p < 0 ? -o1 : o2;
        FASII.push({ s: (a + LF / 2) * step, lat: p * (o1 + o2) / 2, g: p, slot });
        const pt = (k, o) => { const j = mod(k); return [X[j] - Math.sin(Hd[j]) * o, .016, Y[j] + Math.cos(Hd[j]) * o]; };
        for (let k = 0; k < LF; k++) { fPos[slot].push(...pt(a + k, lo), ...pt(a + k, hi), ...pt(a + k + 1, hi), ...pt(a + k, lo), ...pt(a + k + 1, hi), ...pt(a + k + 1, lo)); const u0 = p < 0 ? k / LF : 1 - k / LF, u1 = p < 0 ? (k + 1) / LF : 1 - (k + 1) / LF, vL = p < 0 ? 1 : 0, vH = 1 - vL; fUv[slot].push(u0, vL, u0, vH, u1, vH, u0, vL, u1, vH, u1, vL); }
      }
      i += n;
    }
  }
  fPos.forEach((p, k) => { if (!p.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(fUv[k], 2)); S.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: spMT[k], transparent: true, depthWrite: false, side: THREE.DoubleSide }))); });
  // tribunele: textura are publicul (sus), roșu și beton (jos), într-o singură imagine
  const pub = textura(512, 64, (x, w, h) => {
    x.fillStyle = '#5a5e68'; x.fillRect(0, 0, w, 48); const c = ['#ed1b2f', '#f4f4f4', '#f5c542', '#3d7bff', '#1f9d57', '#d0d0d0', '#ff8a00', '#2a2b31'];
    for (let k = 0; k < 3400; k++) { x.fillStyle = c[k % c.length]; x.fillRect(Math.floor(rndT() * w), Math.floor(rndT() * 46), 2, 3); }
    x.fillStyle = '#d81528'; x.fillRect(0, 48, w, 8); x.fillStyle = '#8d929c'; x.fillRect(0, 56, w, 8);
  });
  const pos = [], uv = [], V_PUB = [.27, 1], V_ROSU = .19, V_BETON = .06, spPos = [[], [], []], spUv = [[], [], []];
  let nTr = 0;
  const tribuna = (s0, lat, slot = 1 + nTr++ % 2) => {
    const i = idx(s0), h = Hd[i], g = Math.sign(lat), [px, pz] = lang(s0, lat), ax = Math.cos(h), az = Math.sin(h), ox = -Math.sin(h) * g, oz = Math.cos(h) * g;
    TRIB.push({ s: s0, lat, g, slot, x: px, z: pz, ax, az, ox, oz });
    const P = (x, y, z) => [px + ax * x + ox * z, y, pz + az * x + oz * z];
    const fata = (a, b, c, d, u0, u1, v0, v1) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); };
    const plin = (x0, x1, y0, y1, z0, z1, v) => { fata(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), .1, .1, v, v); fata(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), .1, .1, v, v); fata(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), .1, .1, v, v); fata(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), .1, .1, v, v); fata(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), .1, .1, v, v); };
    const L2 = 18, ad = 2.2;
    for (let k = 0; k < 5; k++) {
      const z0 = k * ad, z1 = z0 + ad, y = k + 1, u0 = k * .17, u1 = u0 + .3;
      plin(-L2, L2, 0, y, z0, z1, V_BETON);
      fata(P(-L2, y + .01, z0), P(L2, y + .01, z0), P(L2, y + .01, z1), P(-L2, y + .01, z1), u0, u1, V_PUB[0], V_PUB[1]);
      fata(P(-L2, y - 1, z0 - .01), P(L2, y - 1, z0 - .01), P(L2, y, z0 - .01), P(-L2, y, z0 - .01), u0 + .3, u1 + .3, V_PUB[0], (V_PUB[0] + V_PUB[1]) / 2);
    }
    plin(-L2, L2, 0, 8.6, 11, 11.5, V_BETON);
    plin(-L2 - .6, L2 + .6, 8.6, 9.1, 6.2, 12.2, V_ROSU);
    // acoperișul și banda din față, cu numele sponsorului (citit dinspre pistă)
    const sp = (a, b, c, d, v0, v1) => { spPos[slot].push(...a, ...b, ...c, ...a, ...c, ...d); spUv[slot].push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1); };
    const X0 = g * (L2 + .6);
    sp(P(X0, 9.14, 6.2), P(-X0, 9.14, 6.2), P(-X0, 9.14, 12.2), P(X0, 9.14, 12.2), .23, 1);
    sp(P(X0 * .97, .05, -.04), P(-X0 * .97, .05, -.04), P(-X0 * .97, 1, -.04), P(X0 * .97, 1, -.04), 0, .21);
  };
  // la start: trei module, lângă linie, pe partea opusă boxelor
  for (const s0 of [-61, -25, 11]) tribuna(s0, -23, 0);
  // în jurul virajelor: pe exterior, de-o parte a vârfului, unde chiar e loc (nici brațul celălalt al unei
  // agrafe, nici panoul uriaș)
  let nT = 0;
  for (const { a, p } of viraje) {
    if (nT >= 6 || Math.abs(dLinie(a * step)) < 220) continue;
    for (const dI of [-24, 24]) {
      const i = mod(a + dI); let lp = 0; for (let k = -11; k <= 11; k++) lp = Math.max(lp, pietrisL[mod(i + k)]);
      if (lp < 9 || pietrisP[i] !== p) continue;
      const lat = p * (8.4 + lp + 3.5), [x, z] = lang(i * step, lat), [xs, zs] = lang(i * step, lat + p * 12);
      const cap = o => { const h = Hd[i]; return [xs + Math.cos(h) * o, zs + Math.sin(h) * o]; };
      if (![[x, z], [xs, zs], cap(-20), cap(20)].every(([qx, qz]) => departe(qx, qz, 15)) || !liber(x, z, 46)) continue;
      tribuna(i * step, lat); ocupat.push([x, z]); nT++; break;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  S.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: pub, side: THREE.DoubleSide })));
  spPos.forEach((p, k) => { if (!p.length) return; const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); gs.setAttribute('uv', new THREE.Float32BufferAttribute(spUv[k], 2)); S.add(new THREE.Mesh(gs, new THREE.MeshBasicMaterial({ map: spTT[k], side: THREE.DoubleSide }))); });
}
// panourile de frânare: o linie roșie peste asfalt și un panou cu dungi pe marginea pistei
// (departe e definit mai sus, pentru tribune)
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
const copac = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 9, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), 360); const o3 = new THREE.Object3D(); let nT = 0, seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const verde = [0x7fb543, 0x6aa33a, 0x8cc04e, 0x5e9435].map(c => new THREE.Color(c));
for (let incerc = 0; nT < 360 && incerc < 4000; incerc++) {
  const cx = mx + (rnd() - .5) * 900, cy = my + (rnd() - .5) * 760; if (!departe(cx, cy, 45)) continue;
  for (let k = 0, n = 6 + Math.floor(rnd() * 9); k < n && nT < 360; k++) {
    const x = cx + (rnd() - .5) * 40, y = cy + (rnd() - .5) * 40; if (!departe(x, y, 30)) continue;
    const sc = .7 + rnd() * .9; o3.position.set(x, 4.5 * sc, y); o3.scale.set(sc, sc * (.9 + rnd() * .4), sc); o3.updateMatrix(); copac.setMatrixAt(nT, o3.matrix); copac.setColorAt(nT, verde[Math.floor(rnd() * verde.length)]); nT++;
  }
}
copac.count = nT;
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
    // locul (în cursă); fără loc (fantome, sesiunea de calificare) nu se desenează bulina
    if (poz) {
      x.fillStyle = c.eu ? '#d81528' : '#0a0a0c'; x.beginPath(); x.arc(126, 126, 30, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = '900 38px "Big Shoulders Display", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(poz, 126, 128);
    }
    tex.needsUpdate = true;
  };
  return { tex, desen };
}
// jetoanele unei sesiuni vechi se eliberează (fiecare are textura și geometria lui)
const elibereaza = o => { o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); };
function scena() {
  GM.forEach(g => { S.remove(g.grup); elibereaza(g.grup); g.j.tex.dispose(); });
  GM = C.map(c => {
    const grup = new THREE.Group(), j = c.remote && TURURI === 1 ? fantomaTex(c) : jetonTex(c); j.desen('');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: j.tex, depthTest: false, transparent: true, opacity: c.remote && TURURI === 1 ? OP_F : 1 })); sp.renderOrder = 10 + (c.eu ? 5 : 0); sp.position.y = 5; grup.add(sp);
    // flacăra de nitro: la înălțimea jetonului (cu camera înclinată, una pe asfalt părea ruptă de mașină),
    // prinsă de spatele lui; pâlpâie doar spre spate (capătul dinspre mașină stă pe loc)
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 3).translate(-7, 0, 0), new THREE.MeshBasicMaterial({ map: flTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(-1.5, 5, 0); fl.renderOrder = 9; fl.visible = false; grup.add(fl);
    const rn = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_N, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })); rn.position.y = 5; rn.visible = false; rn.renderOrder = 20; grup.add(rn);
    const rr = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_R, depthTest: false, transparent: true })); rr.position.y = 5; rr.visible = false; rr.renderOrder = 21; grup.add(rr);
    const ra = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_A, depthTest: false, transparent: true })); ra.position.y = 5; ra.visible = false; ra.renderOrder = 22; grup.add(ra);
    S.add(grup); return { grup, sp, fl, rn, rr, ra, j, poz: '', scr: null };
  });
  if (BXG) { S.remove(BXG); elibereaza(BXG); BXG = null; }
  if (TURURI > 1) {
    BXG = new THREE.Group();
    for (const c of C) {
      const sB = BOX.loc(c.i), i = idx(sB), m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, .9), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.col) }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Hd[i]; const [x, z] = lang(sB, 23); m.position.set(x, .07, z); BXG.add(m);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.1), m.material); const [fx, fz] = lang(sB, 23.85); f.position.set(fx, 6.4, fz); f.rotation.y = -Hd[i] + Math.PI; BXG.add(f);
    }
    S.add(BXG);
  }
  if (FG) { eliminaSprite(FG); FG = null; }
  if (FGv) { eliminaSprite(FGv); FGv = null; }
  if (FANT && FANT.urma && FANT.urma.length) FG = spriteFantoma(FANT.d, OP_F);
}
let FG = null, FGv = null, BXG = null;
const tinta = new THREE.Vector3(); let camOk = false, camH = 0, camL = 0, tz = 0;
// Două camere, schimbate oricând: 0 urmărire (mai de sus), 1 fără rotație (nordul mereu sus). Se ține minte alegerea.
const CAMERE = ['Urmărire', 'Fără rotație'];
let camM = 0; try { const v = localStorage.getItem('frq_cursa_cam'); if (v !== null && CAMERE[+v]) camM = +v; } catch { /* fără stocare */ }
let camDe = null, camU = null;
// direcția camerei: media direcției pistei de la 12 m în urmă la 48 m în față (netedă pe toată pista)
const HdCam = Float64Array.from(Hd, (_, i) => { let a = 0, b = 0; for (let k = -6; k <= 24; k++) { const h = Hd[(i + k + N) % N]; a += Math.sin(h); b += Math.cos(h); } return Math.atan2(a, b); });
const TG = Math.tan(16 * Math.PI / 180), inaltHarta = () => Math.max((x1 - x0) / 2 / TG, (y1 - y0) / 2 / (TG * W / H)) * 1.12;
let HH = inaltHarta();
const potrivesteScena = () => { if (!vw.clientWidth || !vw.clientHeight) return; W = vw.clientWidth; H = vw.clientHeight; R.setSize(W, H); CAM.aspect = W / H; CAM.updateProjectionMatrix(); HH = inaltHarta(); };
addEventListener('resize', potrivesteScena);
if (window.ResizeObserver) new ResizeObserver(potrivesteScena).observe(vw);
// bara de jos (Acasă, Jocuri, Garaj, Profil) doar pe meniurile Cursei, nu pe pistă și nu la rezultate
const CU_BARA_JOS = new Set(['meniu', 'cupa', 'sapt', 'prieteni', 'cameranoua', 'camera', 'live', 'masini', 'ajutor']);
const baraJos = () => { const ov = $('ov'); if (ov.dataset.ecran !== 'meniu') ov.classList.remove('meniu-hub'); document.body.dataset.tabbar = ov.style.display !== 'none' && CU_BARA_JOS.has(ov.dataset.ecran) ? 'da' : 'nu'; document.body.classList.toggle('pe-pista', ov.style.display === 'none'); };
new MutationObserver(baraJos).observe($('ov'), { attributes: true, attributeFilter: ['style', 'data-ecran'] });
function desen(dt, o) {
  tz += dt;
  if (harta) { desenHarta(o); return; }
  misaNori(dt);
  const k0 = o.indexOf(eu), spate = o[k0 + 1], pericol = pornit && spate && eu.s - spate.s < 16 && eu.fin === null;
  const af = alfa();
  C.forEach((c, k) => {
    const sD = c.sA == null ? c.s : c.sA + (c.s - c.sA) * af, lD = c.lA == null ? c.latC : c.lA + (c.latC - c.lA) * af;
    const G = GM[k], i = idx(sD), j = (i + 1) % N, u = ((sD / step) % 1 + 1) % 1;
    let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u;
    G.grup.position.set(X[i] + (X[j] - X[i]) * u - Math.sin(h) * lD, 0, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * lD); G.grup.rotation.y = -h;
    const poz = SESIUNE ? '' : String(o.indexOf(c) + 1); if (poz !== G.poz) { G.poz = poz; G.j.desen(poz); }
    const m = harta ? 3.8 : 1, z = (c.eu ? 6.8 : 5.7) * m; G.sp.scale.set(z, z, 1);
    if (c.remote && TURURI === 1) { const vede = harta || !VZ.tinta || VZ.tinta.c === c; G.fa = Math.max(0, Math.min(1, (G.fa ?? (vede ? 1 : 0)) + (vede ? 1 : -1) * dt / .5)); G.sp.material.opacity = OP_F * G.fa; G.grup.visible = G.fa > .01; }
    const n = c.nOn; G.fl.visible = n && !harta; G.rn.visible = n; if (n) { G.fl.scale.x = .8 + Math.random() * .5; G.rn.scale.set(z * 1.25, z * 1.25, 1); }
    G.rr.visible = c.eu && pericol; if (G.rr.visible) { const q = z * (1.2 + .12 * Math.sin(tz * 10)); G.rr.scale.set(q, q, 1); }
    // pulsul de la frânare: un inel alb care se lărgește și se stinge
    G.ra.visible = c.puls > 0; if (c.puls > 0) { const f = 1 - c.puls / .6, q = z * (1.1 + f * 1.4); G.ra.scale.set(q, q, 1); G.ra.material.opacity = c.puls / .6; c.puls = Math.max(0, c.puls - dt); }
  });
  // urma are o poziție la 0,1 s: fantoma alunecă între ele și între punctele pistei, ca mașinile
  const peUrma = (sp, U) => {
    const f = Math.max(0, Math.min(U.length - 1, (t - CM.DT * (1 - af)) / .1)), a = Math.floor(f), b = Math.min(U.length - 1, a + 1);
    const sF = U[a] + (U[b] - U[a]) * (f - a), i = idx(sF), j = (i + 1) % N, u = ((sF / step) % 1 + 1) % 1;
    let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u;
    sp.position.set(X[i] + (X[j] - X[i]) * u - Math.sin(h) * 2.5, 5, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * 2.5); sp.scale.set(6, 6, 1);
  };
  if (FG && FANT) { peUrma(FG, FANT.urma); FG.material.opacity = Math.min(OP_F, FG.material.opacity + dt / .5 * OP_F); }
  if (FGv) { peUrma(FGv, FGv.userData.urma); FGv.material.opacity -= dt / .5 * OP_F; if (FGv.material.opacity <= 0) { eliminaSprite(FGv); FGv = null; } }
  if (harta) { S.fog.far = 9000; CAM.up.set(-1, 0, 0); CAM.position.set((x0 + x1) / 2, HH, (y0 + y1) / 2); CAM.lookAt((x0 + x1) / 2, 0, (y0 + y1) / 2); }
  else {
    S.fog.far = 620; CAM.up.set(0, 1, 0);
    // Camera din spatele mașinii, sus, pe direcția de mers: pista urcă pe ecran și îl umple. Depinde doar de
    // locul mașinii pe pistă (interpolat), nu de timpul dintre cadre: o urmărire care se ține după mașină cu
    // o întârziere variază cu fiecare cadru, iar pe ecran se vede ca o mașină care tremură.
    const sD = eu.sA == null ? eu.s : eu.sA + (eu.s - eu.sA) * af, lD = eu.lA == null ? eu.latC : eu.lA + (eu.latC - eu.lA) * af;
    const ci = idx(sD), cj = (ci + 1) % N, cu = ((sD / step) % 1 + 1) % 1, unghi = (p, q) => { const d = q - p; return p + Math.atan2(Math.sin(d), Math.cos(d)) * cu; };
    const hAx = unghi(Hd[ci], Hd[cj]); camH = unghi(HdCam[ci], HdCam[cj]);
    // lateral, puțin mai lent decât mașina (când schimbă partea, se vede pe pistă, nu se mișcă toată pista)
    if (!camOk) { camL = lD; camOk = true; } else camL += (lD - camL) * (1 - Math.exp(-dt * 5));
    tinta.set(X[ci] + (X[cj] - X[ci]) * cu - Math.sin(hAx) * camL, 0, Y[ci] + (Y[cj] - Y[ci]) * cu + Math.cos(hAx) * camL);
    // zoomul tău, lin, și puțin mai de sus cu cât mergi mai repede (camera nu stă înțepenită)
    zoomV += (zoom - zoomV) * (1 - Math.exp(-dt * 8)); dinV += (.94 + .12 * Math.min(1, eu.v / 70) - dinV) * (1 - Math.exp(-dt * 1.5));
    const port = H > W ? 1 : 0, Z = zoomV * dinV;
    let P_;
    if (camM === 1) {
      // fără rotație: doar alunecă deasupra mașinii, cu nordul mereu sus
      const u = 44 * Z, s_ = 118 * Z; P_ = [tinta.x, s_, tinta.z + u, tinta.x, tinta.z];
    } else {
      const m = 1.35, inapoi = (40 + 18 * port) * Z * m, sus = 70 * Z * m, inainte = (10 + 8 * port) * Z * m, cx = Math.cos(camH), cz = Math.sin(camH);
      P_ = [tinta.x - cx * inapoi, sus, tinta.z - cz * inapoi, tinta.x + cx * inainte, tinta.z + cz * inainte];
    }
    if (INTRO) P_ = pozaIntro(P_);
    // la schimbarea camerei: trecere lină
    if (camDe && camDe.p) { const k = neted((ceas - camDe.t) / .5); if (k >= 1) camDe = null; else P_ = P_.map((v, q) => camDe.p[q] + (v - camDe.p[q]) * k); }
    camU = P_;
    CAM.position.set(P_[0], P_[1], P_[2]); CAM.lookAt(P_[3], 0, P_[4]);
  }
  R.render(S, CAM);
  // unde e fiecare jeton pe ecran (pentru liniile de atac și apărare)
  // și cât de mare iese jetonul pe ecran (raza, în px), ca ținta să-l cuprindă oricât de aproape e camera
  // poarta de start se vede pe ecran? (atunci luminile de pe ecran nu mai trebuie)
  v3.set(X[0], 9.4, Y[0]).project(CAM); HE.poartaVizibila = v3.z < 1 && Math.abs(v3.x) < .85 && v3.y > -.45 && v3.y < .8;
  const tg = Math.tan(CAM.fov * Math.PI / 360);
  C.forEach((c, k) => { const G = GM[k], p = G.grup.position; v3.set(p.x, 5, p.z); G.rs = G.sp.scale.x * .48 / (v3.distanceTo(CAM.position) * tg) * H / 2; v3.project(CAM); G.scr = v3.z < 1 ? [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H] : null; });
}
const v3 = new THREE.Vector3();
// ---------- harta ----------
// O schiță plată a circuitului peste pistă: tu mare, roșu, pulsând; ceilalți cu locul lor; virajele,
// linia de start, sensul și boxele. Cât e deschisă, scena 3D nu se mai desenează.
const NS = 'http://www.w3.org/2000/svg', HM = { cheie: '', k: 1, rot: false, ox: 0, oy: 0, g: [], fg: null };
const lume = (s, lat) => { const i = idx(s), j = (i + 1) % N, u = ((s / step) % 1 + 1) % 1; let dh = Hd[j] - Hd[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const h = Hd[i] + dh * u; return [X[i] + (X[j] - X[i]) * u - Math.sin(h) * lat, Y[i] + (Y[j] - Y[i]) * u + Math.cos(h) * lat]; };
// rotită cu 90° când circuitul e lat și ecranul înalt (rotație, nu oglindire: virajele rămân pe partea lor)
const px = ([x, y]) => HM.rot ? [HM.ox - y * HM.k, HM.oy + x * HM.k] : [HM.ox + x * HM.k, HM.oy + y * HM.k];
const elS = (tag, at, txt) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; return e; };
function construiesteHarta() {
  const sv = $('hm'), sus = 96, jos = 150, lat = 18, aw = W - 2 * lat, ah = H - sus - jos;
  HM.rot = (x1 - x0 > y1 - y0) !== (aw > ah);
  const [w, h] = HM.rot ? [y1 - y0, x1 - x0] : [x1 - x0, y1 - y0];
  HM.k = Math.min(aw / w, ah / h);
  if (HM.rot) { HM.ox = lat + (aw - w * HM.k) / 2 + y1 * HM.k; HM.oy = sus + (ah - h * HM.k) / 2 - x0 * HM.k; }
  else { HM.ox = lat + (aw - w * HM.k) / 2 - x0 * HM.k; HM.oy = sus + (ah - h * HM.k) / 2 - y0 * HM.k; }
  sv.setAttribute('viewBox', `0 0 ${W} ${H}`); sv.textContent = '';
  const drum = (a, b, latM, pas) => { let d = ''; for (let s = a; s <= b + .01; s += pas) { const [x, y] = px(lume(s, latM)); d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } return d; };
  const tot = drum(0, L, 0, step * 2) + 'Z';
  // boxele: un drum separat, alături, cu intrarea și ieșirea în pistă
  const nrm = s => { const a = px(lume(s, 0)), b = px(lume(s, BOX.lat)), dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
  let dP = ''; for (let s = L - BOX.intrare; s <= L + BOX.iesire; s += 4) {
    const r = (latBoxe(s - L) - 4.6) / (BOX.lat - 4.6), [x, y] = px(lume(s, 0)), [nx, ny] = nrm(s);
    dP += (dP ? 'L' : 'M') + (x + nx * 12 * r).toFixed(1) + ' ' + (y + ny * 12 * r).toFixed(1);
  }
  const lat1 = Math.max(7, 14 * HM.k), linie = (d, cls, w, extra) => elS('path', { d, class: cls, 'stroke-width': w.toFixed(1), ...extra });
  // degajările, la locul lor: pietriș, sau asfalt la virajele rapide
  for (const p of [-1, 1]) for (let i = 0; i < N; i++) {
    const pe = k => pietrisP[mod(k)] === p && pietrisL[mod(k)] > .2; if (!pe(i) || pe(i - 1)) continue;
    let n = 0, tip = 1; while (pe(i + n) && n < N) { tip = Math.min(tip, asfaltD[mod(i + n)]); n++; }
    let d = ''; const pct = (k, o) => { const [a, b] = px(lume(k * step, o)); d += (d ? 'L' : 'M') + a.toFixed(1) + ' ' + b.toFixed(1); };
    for (let k = 0; k <= n; k++) pct(i + k, p * (8.4 + pietrisL[mod(i + k)]));
    for (let k = n; k >= 0; k--) pct(i + k, p * 6.9);
    sv.append(elS('path', { d: d + 'Z', class: tip ? 'hm-deg' : 'hm-pie' }));
  }
  sv.append(linie(dP, 'hm-box', Math.max(5, 8 * HM.k) + 2), linie(dP, 'hm-boxa', Math.max(5, 8 * HM.k)), linie(tot, 'hm-mar', lat1 + 3), linie(tot, 'hm-pista', lat1));
  // bordurile, roșu cu alb, doar unde sunt și pe pistă
  for (const p of [-1, 1]) for (let i = 0; i < N; i++) {
    if (bordura[i] !== p || bordura[mod(i - 1)] === p) continue;
    let n = 0, d = ''; while (bordura[mod(i + n)] === p && n < N) n++;
    for (let k = 0; k <= n; k++) { const [a, b] = px(lume((i + k) * step, p * 7.7)); d += (k ? 'L' : 'M') + a.toFixed(1) + ' ' + b.toFixed(1); }
    const w = Math.max(1.8, 2 * HM.k); sv.append(linie(d, 'hm-bo', w), linie(d, 'hm-br', w));
  }
  // tribunele, în culoarea sponsorului lor
  for (const q of TRIB) {
    const c = (u, v) => { const [a, b] = px([q.x + q.ax * u + q.ox * v, q.z + q.az * u + q.oz * v]); return a.toFixed(1) + ' ' + b.toFixed(1); }, sp = SP_SLOT[q.slot];
    sv.append(elS('path', { d: `M${c(-18, 0)}L${c(18, 0)}L${c(18, 12)}L${c(-18, 12)}Z`, fill: sp ? sp.culoare || '#d81528' : '#d81528', class: 'hm-tr' }));
  }
  { const sm = L - BOX.intrare / 2 + 30, [x, y] = px(lume(sm, 0)), [nx, ny] = nrm(sm); sv.append(elS('text', { x: (x + nx * 30).toFixed(1), y: (y + ny * 30 + 4).toFixed(1), class: 'hm-bt' }, 'BOXE')); }
  // linia de start și sensul de mers
  { const [x, y] = px(lume(0, 0)), [nx, ny] = nrm(0); sv.append(elS('path', { d: `M${(x - nx * 10).toFixed(1)} ${(y - ny * 10).toFixed(1)}L${(x + nx * 10).toFixed(1)} ${(y + ny * 10).toFixed(1)}`, class: 'hm-start' })); }
  { const [ax, ay] = px(lume(70, 0)), [bx, by] = px(lume(90, 0)), u = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    sv.append(elS('path', { d: 'M-5 -5L3 0L-5 5', class: 'hm-sens', transform: `translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${u.toFixed(0)})` })); }
  // virajele: cu nume de sponsor, o etichetă mare (nu la scară), legată de viraj; altfel V1, V2...
  const pista = []; for (let q = 0; q < L; q += 6) pista.push(px(lume(q, 0)));
  for (let q = L - BOX.intrare; q <= L + BOX.iesire; q += 8) { const [a, b] = px(lume(q, 0)), [nx, ny] = nrm(q); pista.push([a + nx * 12, b + ny * 12]); }
  const ocupat = [], jetoane = W >= 760 ? 0 : 66;
  const liberE = (x0, y0, x1, y1) => x0 >= lat && x1 <= W - lat && y0 >= sus && y1 <= H - jos && !(y1 > H - 205 && Math.abs((x0 + x1) / 2 - W / 2) < (x1 - x0) / 2 + 130) && !(x1 > W - jetoane - 14 && y0 < 250) && pista.every(([a, b]) => a < x0 - 11 || a > x1 + 11 || b < y0 - 11 || b > y1 + 11) && ocupat.every(([a, b, c, d]) => x1 < a - 5 || x0 > c + 5 || y1 < b - 5 || y0 > d + 5);
  const faraNume = new Set();
  for (const G of GRUPURI) {
    const sp = SP_VIRAJ.get(G); if (!sp) { G.membri.forEach(m => faraNume.add(m)); continue; }
    const sm = (G.sA + G.sE) / 2, h0 = Hd[idx(G.sB)], h1 = Hd[idx(G.sE + 20)], dh = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)), [x, y] = px(lume(sm, 0)), [nx, ny] = nrm(sm), semn = dh > 0 ? -1 : 1, u0 = Math.atan2(ny * semn, nx * semn);
    const txt = sp.nume.toUpperCase(), f = marimeNume(txt, 130, 17), cx = spC[0].getContext('2d'); cx.font = `900 ${f}px "Big Shoulders Display", Impact, sans-serif`;
    const w = Math.ceil(cx.measureText(txt).width) + 14, h = f + 9; let gasit = null;
    cauta: for (let r = 26; r <= 170; r += 8) for (const d of [0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.6, -2.6, Math.PI]) {
      const qx = x + Math.cos(u0 + d) * (r + w / 2 * Math.abs(Math.cos(u0 + d))), qy = y + Math.sin(u0 + d) * (r + h / 2 * Math.abs(Math.sin(u0 + d)));
      if (liberE(qx - w / 2, qy - h / 2, qx + w / 2, qy + h / 2)) { gasit = [qx, qy]; break cauta; }
    }
    if (!gasit) { G.membri.forEach(m => faraNume.add(m)); continue; }
    const [qx, qy] = gasit, bg = sp.culoare || '#d81528'; ocupat.push([qx - w / 2, qy - h / 2, qx + w / 2, qy + h / 2]);
    sv.append(elS('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: qx.toFixed(1), y2: qy.toFixed(1), stroke: bg, class: 'hm-leg' }), elS('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.5, fill: bg, class: 'hm-pun' }));
    sv.append(elS('rect', { x: (qx - w / 2).toFixed(1), y: (qy - h / 2).toFixed(1), width: w, height: h, fill: bg }), elS('text', { x: qx.toFixed(1), y: (qy + f * .36).toFixed(1), fill: peCuloare(bg), 'font-size': f, class: 'hm-sp' }, txt));
    if (window.Sponsori) window.Sponsori.vazut(sp.id, 'cursa-harta');
  }
  for (const F of P.FRANARI) {
    if (!faraNume.has(F.n)) continue;
    const sm = (F.sA + F.sE) / 2, h0 = Hd[idx(F.sB)], h1 = Hd[idx(F.sE + 20)], dh = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    const [x, y] = px(lume(sm, 0)), [nx, ny] = nrm(sm), o = dh > 0 ? -17 : 17;
    sv.append(elS('text', { x: (x + nx * o).toFixed(1), y: (y + ny * o + 4).toFixed(1), class: 'hm-v' }, 'V' + F.n));
  }
  HM.fg = FANT ? elS('circle', { r: 6, class: 'hm-fant' }) : null; if (HM.fg) sv.append(HM.fg);
  HM.g = C.map(c => {
    const g = elS('g', { class: c.eu ? 'hm-tu' : 'hm-c' });
    if (c.eu) g.append(elS('circle', { r: 13, class: 'hm-puls' }), elS('circle', { r: 13, class: 'hm-dot' }), elS('text', { y: 4 }, 'TU'));
    else g.append(elS('circle', { r: 8.5, fill: c.col }), elS('text', { y: 3.5 }, ''));
    return g;
  });
  C.forEach((c, k) => { if (!c.eu) sv.append(HM.g[k]); }); sv.append(HM.g[C.indexOf(eu)]);
  HM.cheie = W + 'x' + H + ':' + C.length + ':' + !!FANT + SP_SEMN;
}
function desenHarta(o) {
  if (HM.cheie !== W + 'x' + H + ':' + C.length + ':' + !!FANT + SP_SEMN || !HM.g[0] || !HM.g[0].isConnected) construiesteHarta();
  const af = alfa();
  C.forEach((c, k) => {
    const sD = c.sA == null ? c.s : c.sA + (c.s - c.sA) * af, lD = c.lA == null ? c.latC : c.lA + (c.latC - c.lA) * af;
    const [x, y] = px(lume(sD, lD * .7)), g = HM.g[k]; g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    if (!c.eu) { const poz = SESIUNE ? '' : String(o.indexOf(c) + 1), tx = g.lastChild; if (tx.textContent !== poz) tx.textContent = poz; }
  });
  if (HM.fg && FANT) { const U = FANT.urma, f = Math.max(0, Math.min(U.length - 1, t / .1)), a = Math.floor(f), b = Math.min(U.length - 1, a + 1), [x, y] = px(lume(U[a] + (U[b] - U[a]) * (f - a), 0)); HM.fg.setAttribute('cx', x.toFixed(1)); HM.fg.setAttribute('cy', y.toFixed(1)); }
}
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
// Meniul, așezat ca la celelalte jocuri (Shared.hub, ca la Startul): sus poza mașinii tale, numele
// jocului și Aleargă (weekendul); dedesubt setările (mașina, calificarea) și celelalte moduri.
const fotoMare = c => (window.Shared && Shared.thumbHTML ? Shared.thumbHTML({ ...c, image: c.image.replace(/\/\d+px-/, '/960px-') }) : '');
const fotoMica = c => (window.Shared && Shared.thumbHTML ? Shared.thumbHTML({ ...c, image: c.image.replace(/\/\d+px-/, '/330px-') }) : '');
// Sponsorii, în momentele în care imaginea stă și ai timp să te uiți: la semafor, la oprirea la boxe, după linie,
// la încărcare. Fiecare moment are alt sponsor, în ordinea nivelurilor. Fără sponsori, nu apare nimic.
const MOMENTE = { start: ['Startul oferit de', 0], boxe: ['Oprirea oferită de', 1], racire: ['Finalul oferit de', 2], incarcare: ['Oferit de', 3] };
const sponsorMoment = k => { const SPO = window.Sponsori, l = SPO ? SPO.lista().slice().sort((a, b) => a.nivel - b.nivel) : []; return l.length ? l[MOMENTE[k][1] % l.length] : null; };
const marimeNume = (txt, w, max) => { const x = spC[0].getContext('2d'); fontSp(x, txt.toUpperCase(), w, max); return parseInt(/(\d+)px/.exec(x.font)[1], 10); };
function puneMoment(e, k) {
  const sp = k && sponsorMoment(k), cheie = sp ? k + sp.id : '';
  if (e.dataset.k === cheie) return; e.dataset.k = cheie; e.classList.toggle('gol', !sp); if (!sp) return;
  const bg = sp.culoare || '#d81528';
  e.style.background = bg; e.style.color = peCuloare(bg);
  e.firstElementChild.textContent = MOMENTE[k][0];
  e.lastElementChild.textContent = sp.nume; e.lastElementChild.style.fontSize = marimeNume(sp.nume, Math.min(216, e.clientWidth - 24 || 216), 30) + 'px';
  window.Sponsori.vazut(sp.id, 'cursa-' + k);
}
function momentPista() {
  const B = eu && eu.box;
  const k = harta || INTRO ? null : START && START.t0 !== null && !eu.lansat ? 'start' : B && B.faza === 'stop' ? 'boxe' : !el('fin').hidden ? 'racire' : null;
  puneMoment(el('spm'), k);
}
// ---------- intro-ul dinaintea cursei ----------
// Câteva secunde cu camera pe lângă numele de pe pistă, privind spre exterior (de acolo se citesc), apoi coboară
// pe grilă și ajunge exact în camera de joc. O atingere sare peste. Doar la cursa cu boții: la live, toți pornesc odată.
let INTRO = null;
const CADRU_I = 1.3, FINAL_I = 1.5;
function planIntro() {
  const cu = (x, slot) => x.find(q => q.slot === slot) || x[0], colt = TRIB.filter(q => Math.abs(dLinie(q.s)) > 200), lista = [];
  const adauga = (q, lung, lat) => {
    if (!q) return; const [x, z] = lume(q.s, lat), h = Hd[idx(q.s)];
    lista.push({ x, z, tx: Math.cos(h), tz: Math.sin(h), ox: -Math.sin(h) * q.g, oz: Math.cos(h) * q.g, h: Math.max(55, Math.min(170, lung / (2 * 1.18 * TG * CAM.aspect))) });
  };
  if (FASII.length) { const q = cu(FASII, 0); adauga(q, 46, q.lat); }
  if (colt.length) { const q = cu(colt, 1); adauga(q, 40, q.lat + q.g * 9); }
  return lista;
}
function faIntro(dupa) {
  const plan = harta ? [] : planIntro();
  intra();
  if (!plan.length) { dupa(); return; }
  const e = $('intro'), titlu = SP_PRINCIPAL ? 'Marele Premiu ' + SP_PRINCIPAL.nume : 'Cursa';
  $('in-b').textContent = titlu; $('in-b').style.fontSize = marimeNume(titlu, Math.min(296, W - 56), 32) + 'px';
  $('in-s').textContent = 'Serpentine · ' + TURURI + ' tururi';
  e.hidden = false; document.body.classList.add('intro');
  INTRO = { t: ceas, plan, dupa, dur: plan.length * CADRU_I + FINAL_I };
}
function opresteIntro() { INTRO = null; $('intro').hidden = true; document.body.classList.remove('intro'); }
function gataIntro(sarit) {
  const I = INTRO; if (!I) return;
  opresteIntro(); if (sarit) camDe = { t: ceas, p: camU };
  I.dupa();
}
$('intro').addEventListener('click', () => gataIntro(true));
function pozaIntro(joc) {
  const I = INTRO, e = ceas - I.t, n = I.plan.length, k = Math.min(n, Math.floor(e / CADRU_I));
  // între cadre: o clipă de negru
  let d = 1; for (let q = 1; q <= n; q++) d = Math.min(d, Math.abs(e - q * CADRU_I) / .12);
  pune(el('inn'), 'opacity', (1 - d).toFixed(2));
  if (k < n) {
    const c = I.plan[k], u = e / CADRU_I - k, m = (u - .5) * 6, h = c.h * (1.06 - .12 * u), x = c.x + c.tx * m, z = c.z + c.tz * m;
    return [x - c.ox * h * .62, h, z - c.oz * h * .62, x, z];
  }
  const [gx, gz] = lume(-40, 0), h = Hd[idx(-40)], cx = Math.cos(h), cz = Math.sin(h), w = neted((e - n * CADRU_I) / FINAL_I), A = [gx - cx * 80, 130, gz - cz * 80, gx + cx * 20, gz + cz * 20];
  return A.map((v, q) => v + (joc[q] - v) * w);
}
// Ce durează (simularea rivalilor, pista) începe după ce s-a desenat ecranul de încărcare: apăsarea se vede pe loc.
function cuIncarcare(fa) {
  const e = $('inc'); e.hidden = false; puneMoment($('incs'), 'incarcare');
  requestAnimationFrame(() => setTimeout(() => { try { fa(); } finally { e.hidden = true; } }, 0));
}
function ecranStart() {
  opresteIntro(); START = null; WK = null; FANT = null;
  const g = garajulMeu(), sc = CM.scor(aleasa.c, aleasa.nivel), ture = E ? E.CURSA.ture : 5;
  const c = PR.cupa, carCupa = c && c.masina && DUPA_CHEIE.get(c.masina);
  const subCupa = !c ? 'Duminica, fără intrare' : !c.deschisa ? `Duminică · ${E.CUPA.premii[0]} mil. și mașina` : c.eu && c.eu.timp != null ? `Azi · locul ${c.eu.loc} · ${fT(c.eu.timp / 1000)}` : `Azi · ${c.incercari - (c.eu ? c.eu.folosite : 0)} încercări`;
  $('ov').innerHTML = Shared.hub({
    erou: { id: 'weekend', eticheta: `Clasa ${sc.clasa} · ${sc.v} · Serpentine`, titlu: 'Cursa', sub: `${aleasa.c.name} · calificare și ${ture} tururi`, buton: 'Aleargă', poza: fotoMare(aleasa.c) },
    // trei grupuri: ce mai poți juca, cu ce și contra cui, și ce e online
    grupuri: [
      { titlu: 'Joacă', randuri: [
        { id: 'doarcalif', icon: 'ceas', titlu: 'Doar calificare', sub: 'Fără cursă' },
        { id: 'antren', icon: 'runde', titlu: 'Antrenament', sub: 'Singur, cu fantoma ta' },
      ] },
      { titlu: 'Setări', randuri: [
        { id: 'masina', icon: 'garaj', titlu: 'Mașina ta', sub: aleasa.imprumut ? 'De împrumut' : `${aleasa.c.name}${aleasa.nivel ? ' · tunată' : ''}`, val: `${sc.clasa} ${sc.v}` },
        { id: 'dif', icon: 'bot', titlu: 'Adversarii', sub: DIF[dif].sub, val: DIF[dif].n },
        { id: 'calif', icon: 'ceas', titlu: 'Calificarea', sub: SES.calif === 'lunga' ? 'Ieșiți pe rând de la boxe, cu trafic' : 'Un tur, cu fantoma celui din față', val: SES.calif === 'lunga' ? 'Q1 · Q2 · Q3' : 'Un tur' },
      ] },
      { titlu: 'Online', randuri: E ? [
        { id: 'prieteni', icon: 'prieteni', titlu: 'Cu prietenii', sub: CAMR ? `Camera ${CAMR.cod}` : 'Live sau cu cod' },
        { id: 'cupa', titlu: 'Cupa de duminică', sub: subCupa, poza: carCupa ? fotoMica(carCupa) : null, icon: 'cupa' },
        { id: 'sapt', icon: 'zi', titlu: 'Turul săptămânii', sub: aleasa.imprumut ? `Cu mașina ta · ${E.CURSA.sapt.premii[0]} mil. pe clasă` : `Clasa ${clasaMea()} · premii luni` },
      ] : [] },
    ],
  });
  if (window.Shared && Shared.wirePhotos) Shared.wirePhotos($('ov'));
  $('ov').classList.add('meniu-hub');
  $('ov').dataset.ecran = 'meniu'; adresa('');
  $('ov').style.display = 'flex';
  $('ov').querySelectorAll('[data-mj]').forEach(x => x.onclick = () => {
    const k = x.dataset.mj;
    if (k === 'weekend') { SES.mod = 'complet'; cuIncarcare(incepe); }
    else if (k === 'doarcalif') { SES.mod = 'calif'; cuIncarcare(incepe); }
    else if (k === 'antren') { SES.mod = 'antren'; cuIncarcare(incepe); }
    else if (k === 'calif') { SES.calif = SES.calif === 'lunga' ? 'scurta' : 'lunga'; ecranStart(); }
    else if (k === 'dif') { dif = (dif + 1) % DIF.length; try { localStorage.setItem('frq_cursa_dif', dif); } catch { /* fără stocare */ } ecranStart(); }
    else if (k === 'masina') ecranMasini();
    else if (k === 'prieteni') ecranPrieteni();
    else if (k === 'cupa') ecranCupa();
    else if (k === 'sapt') ecranSapt();
  });
}
// alegi mașina din garaj (cea mai tunată copie a fiecărei mașini)
function ecranMasini() {
  const g = garajulMeu();
  const rand = (x, i) => `<button type="button" class="alm${cheieM(x.c) === cheieM(aleasa.c) && x.nivel === aleasa.nivel ? ' on' : ''}" data-i="${i}">${tok({ c: x.c })}<span><b>${x.c.name}</b> <small>${x.c.years}</small><br>${clsBadge(x.scor)}<small>${x.nivel ? 'tunată' : 'stoc'}</small></span></button>`;
  $('ov').classList.remove('meniu-hub');
  $('ov').innerHTML = `${titluOv('Mașina ta')}
    ${g.length ? `<div class="alg lung">${g.map(rand).join('')}</div>` : '<p class="sub">Deschide Garajul o dată pe telefonul ăsta și mașinile tale apar aici.</p><button type="button" class="go" id="go-garaj">Deschide Garajul</button>'}
    <button type="button" class="go gh" id="go3">Înapoi</button>`;
  if ($('go-garaj')) $('go-garaj').onclick = () => { location.href = 'garaj.html'; };
  $('ov').dataset.ecran = 'masini'; adresa('#masini'); $('ov').style.display = 'flex';
  $('go3').onclick = ecranStart;
  $('ov').querySelectorAll('.alm').forEach(x => x.onclick = () => {
    aleasa = g[+x.dataset.i];
    try { localStorage.setItem('frq_cursa_masina', `${cheieM(aleasa.c)}#${aleasa.nivel}`); } catch { /* fără stocare */ }
    soloNou(); scena(); ecranStart();
  });
}
// „?” din bara de sus: cum se joacă
function ecranAjutor() {
  $('ov').classList.remove('meniu-hub');
  $('ov').innerHTML = `${titluOv('Cum se joacă')}
    <div class="lg">
      <span>${pict('#fb', 30, 30)}</span><span>La virajele mari apare frâna. Apasă când inelul alb e pe linia din mijlocul benzii galbene. Butonul se aprinde cât ești în zonă.</span>
      <span style="color:#22d3ee">${pict('#nb', 16, 22)}</span><span>Nitro: ține apăsat. Pe dreaptă dă cel mai mult. Frânările bune umplu rezervorul. Se cumpără din Garaj, o celulă pe nivel.</span>
      <span style="color:#ed1b2f">${pict('[data-r=atac]', 22, 22)}</span><span>Atac: îl ataci pe cel din față. Roțile se duc mai repede.</span>
      <span style="color:#3d7bff">${pict('[data-r=apara]', 22, 22)}</span><span>Apără: îi închizi linia celui din spate.</span>
      <span>${pict('#px', 26, 26)}</span><span>Anvelopele: Soft rapid, Hard rezistent. Sub 25% încetinești mult. Atingi, alegi și intri la boxe. În box, ține apăsat și dă drumul în zona albă.</span>
      <span style="color:#ff2a3d;font:900 20px var(--display)">●</span><span>La start, când se sting luminile, apasă Pleacă. Mai devreme: +3 s.</span>
    </div>
    <button type="button" class="go" id="go3">Am înțeles</button>`;
  $('ov').dataset.ecran = 'ajutor'; adresa('#ajutor'); $('ov').style.display = 'flex';
  $('go3').onclick = ecranStart;
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
  $('ov').classList.remove('meniu-hub'); $('ov').dataset.ecran = 'cupa'; adresa('#cupa');
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
$('b-aj').onclick = () => { if (!pornit) ecranAjutor(); };
$('b-cls').onclick = () => { if (!pornit) ecranSapt(); };
// ---------- camerele cu prietenii ----------
// Un cod, până la 10 piloți. Fiecare face tururi până se închide camera (o oră sau o zi); contează
// cel mai bun, refăcut pe server. Din cameră, gazda pornește o cursă live: toți deodată, pe
// telefoanele lor, cu grila din clasamentul camerei. Fiecare telefon își simulează mașina și o
// trimite celorlalți (Realtime); mașinile prietenilor vin din rețea.
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_GARAJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-5 9 5v12M7 21v-7h10v7M7 17h10"/></svg>';
const ICON_PRIETENI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.9.2 5 2.1 5 5.4"/></svg>';
let CAMR = null, camTimer = null, LIVE = null;
const PRIET = { tip: 'live', mod: 'aceeasi', ore: 1 };
const linkCamera = cod => `${location.origin}${location.pathname}#camera=${cod}`;
const curat = x => String(x).replace(/[<>&"]/g, '');
// Cu prietenii: două lucruri, fiecare cu cardul lui (fă o cameră / am un cod) și camerele
// deschise în care ai intrat (ținute pe telefon), ca să te întorci fără cod.
const CHEIE_CAMERE = 'frq_cursa_camere';
const cameraleMele = () => { try { return (JSON.parse(localStorage.getItem(CHEIE_CAMERE) || '[]') || []).filter(c => new Date(c.pana).getTime() > Date.now()); } catch { return []; } };
function tineCamera(c) {
  try {
    const l = cameraleMele().filter(x => x.cod !== c.cod);
    l.unshift({ cod: c.cod, pana: c.pana, mod: c.mod, masina: c.masina, piloti: c.top ? c.top.length : 0 });
    localStorage.setItem(CHEIE_CAMERE, JSON.stringify(l.slice(0, 5)));
  } catch { /* fără stocare */ }
}
const catMai = pana => { const m = Math.ceil((new Date(pana).getTime() - Date.now()) / 60e3); return m >= 120 ? `încă ${Math.round(m / 60)} ore` : `încă ${m} min`; };
function ecranPrieteni(msg) {
  oprireCamera();
  $('ov').dataset.ecran = 'prieteni'; adresa('#prieteni');
  const mele = cameraleMele().slice(0, 3);
  const randCam = c => { const car = c.mod === 'aceeasi' && DUPA_CHEIE.get(c.masina); return `<button type="button" class="camr" data-cod="${c.cod}"><b>${c.cod}</b><small>${car ? car.name : 'Fiecare cu a lui'}${c.piloti ? ` · ${c.piloti} ${c.piloti === 1 ? 'pilot' : 'piloți'}` : ''} · ${catMai(c.pana)}</small><span class="prs">›</span></button>`; };
  $('ov').innerHTML = `${titluOv('Cu prietenii')}
    <button type="button" class="pr" id="noua"><span class="pri">${ICON_PLUS}</span><span class="prt"><b>Fă o cameră</b><small>Primești un cod pentru prieteni</small></span><span class="prs">›</span></button>
    <div class="pcod"><p class="pcod-t">Am un cod</p>
      <label class="cutii" aria-label="Codul camerei"><input id="codin" maxlength="5" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false">${'<i></i>'.repeat(5)}</label>
      <p class="sub" id="pmsg">${msg || 'Intri singur la a cincea literă.'}</p></div>
    ${mele.length ? `${titluOv('Camerele tale')}<div class="caml">${mele.map(randCam).join('')}</div>` : ''}`;
  $('ov').style.display = 'flex';
  if (msg) $('pmsg').classList.add('err');
  $('noua').onclick = ecranCameraNoua;
  $('ov').querySelectorAll('.camr').forEach(x => x.onclick = () => ecranCamera(x.dataset.cod));
  const inp = $('codin'), cutii = [...$('ov').querySelectorAll('.cutii i')];
  const arata = () => { const v = inp.value; cutii.forEach((x, i) => { x.textContent = v[i] || ''; x.classList.toggle('on', i === Math.min(v.length, 4) && document.activeElement === inp); }); };
  inp.addEventListener('input', () => {
    inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); arata();
    $('pmsg').classList.remove('err'); $('pmsg').textContent = 'Intri singur la a cincea literă.';
    if (inp.value.length === 5) { inp.blur(); ecranCamera(inp.value); }
  });
  inp.addEventListener('focus', arata); inp.addEventListener('blur', arata);
}
// Cameră nouă: alegeri cu poză (cu ce mașini, cât rămâne deschisă) și un singur buton
function ecranCameraNoua() {
  oprireCamera();
  $('ov').dataset.ecran = 'cameranoua'; adresa('#camera-noua');
  const alege = (g, v, on, cap, titlu, sub) => `<button type="button" class="alg2${on ? ' on' : ''}" data-g="${g}" data-v="${v}">${cap}<b>${titlu}</b><small>${sub}</small></button>`;
  $('ov').innerHTML = `${titluOv('Cameră nouă')}
    <p class="pcod-t">Cum jucați?</p>
    <div class="alg2s mici">${alege('tip', 'live', PRIET.tip === 'live', '', 'Live', 'Toți acum, gazda dă startul')}${alege('tip', 'clasament', PRIET.tip === 'clasament', '', 'Clasament', 'Fiecare când are timp')}</div>
    <p class="pcod-t">Cu ce mașini?</p>
    <div class="alg2s">${alege('mod', 'aceeasi', PRIET.mod === 'aceeasi', `<img src="${pozaMare(aleasa.c)}" alt="" referrerpolicy="no-referrer">`, `Toți cu ${aleasa.c.name}`, 'Stoc, pentru toți')}${alege('mod', 'a mea', PRIET.mod === 'a mea', `<span class="ico">${ICON_GARAJ}</span>`, 'Fiecare cu a lui', 'Din garaj, cu tuning')}</div>
    ${PRIET.tip === 'clasament' ? `<p class="pcod-t">Cât rămâne deschisă?</p>
    <div class="alg2s mici">${alege('ore', 1, PRIET.ore === 1, '', 'O oră', 'Pentru o seară')}${alege('ore', 24, PRIET.ore === 24, '', 'O zi', 'Până mâine')}</div>` : ''}
    <p class="sub" id="pmsg"></p>
    <button type="button" class="go" id="go">Fă camera și trimite codul</button>`;
  $('ov').style.display = 'flex';
  $('ov').querySelectorAll('.alg2').forEach(x => x.onclick = () => { PRIET[x.dataset.g] = x.dataset.g === 'ore' ? +x.dataset.v : x.dataset.v; ecranCameraNoua(); });
  $('go').onclick = async () => {
    const C0 = Cloud(); if (!C0) return;
    const go = $('go'); go.disabled = true; go.textContent = 'Un moment…';
    try {
      const r = await C0.cursa({ actiune: 'camera-noua', tip: PRIET.tip, mod: PRIET.mod, masina: cheieM(aleasa.c), ore: PRIET.ore, nume: C0.numeLocal() || undefined });
      await ecranCamera(r.cod);
      trimiteCodul(r.cod);
    } catch { go.disabled = false; go.textContent = 'Fă camera și trimite codul'; $('pmsg').textContent = 'Camera nu s-a putut face acum. Mai încearcă.'; }
  };
}
// meniul de trimitere al telefonului; fără el, linkul se copiază
async function trimiteCodul(cod, buton) {
  const url = linkCamera(cod);
  try { if (navigator.share) { await navigator.share({ title: 'Cursa FRQ', text: `Intră în camera mea: ${cod}`, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); if (buton) buton.textContent = 'Link copiat'; } catch { if (buton) buton.textContent = cod; }
}
function oprireCamera() { clearInterval(camTimer); camTimer = null; }
const ramas = c => { const ms = new Date(c.pana).getTime() - new Date(c.acum).getTime() - (Date.now() - c.primit); if (ms <= 0) return 'închisă'; const m = Math.ceil(ms / 60e3); return m >= 120 ? `mai e deschisă ${Math.round(m / 60)} ore` : `mai e deschisă ${m} min`; };
async function ecranCamera(cod) {
  const C0 = Cloud(); if (!C0) return;
  oprireCamera();
  $('ov').dataset.ecran = 'camera'; adresa('#camera=' + cod);
  if (!CAMR || CAMR.cod !== cod) {
    $('ov').innerHTML = `${titluOv(`Camera ${cod}`)}<p class="sub">Se deschide…</p>`; $('ov').style.display = 'flex';
    try { CAMR = { ...(await C0.cursa({ actiune: 'camera', cod, nume: C0.numeLocal() || undefined })), primit: Date.now() }; tineCamera(CAMR); }
    catch (e) { const k = await C0.codEroare(e); CAMR = null; ecranPrieteni(k === 'nu exista' ? 'Nu există o cameră cu codul ăsta.' : 'Camera nu se poate deschide acum.'); return; }
  }
  // camera live: direct în lobby
  if (CAMR.tip === 'live') { ecranLive(); return; }
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
  $('share').onclick = () => trimiteCodul(c.cod, $('share'));
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
// ---------- cursa live: lobby, calificare împreună, cursă ----------
// Gazda alege calificarea (un tur sau Q1·Q2·Q3) și dacă urmează cursa; toți văd setările. Fiecare
// telefon își face turul (ceilalți apar ca fantome, din rețea) și își trimite timpul; gazda închide
// etapa și trimite rezultatul, același pentru toți. Mesajele (Realtime, canalul camerei):
//   h {id, nume, masina, nivel, g?, set?} cine e în lobby (gazda trimite și setările)
//   set {set}  plan {piloti, etape, cursa}  etapa {k, ids}  timp {id, k, timp}  rez {k, ordine}
//   start {grila, out} (cursa)  gata (doar calificare)
const masinaLive = () => (CAMR.mod === 'aceeasi' ? { c: DUPA_CHEIE.get(CAMR.masina), nivel: 0 } : { c: aleasa.c, nivel: aleasa.nivel });
const SET0 = { calif: 'tur', cursa: true };
async function ecranLive() {
  const C0 = Cloud(); if (!C0 || !CAMR) return;
  if (!LIVE || LIVE.cod !== CAMR.cod) {
    inchideLive();
    LIVE = { cod: CAMR.cod, euId: CAMR.eu_id, gazda: CAMR.gazda, piloti: new Map(), canal: null, inCursa: false, hb: null, ultim: 0, set: { ...SET0 }, faza: 'lobby' };
    try { LIVE.canal = await C0.canalLive(`cursa-${CAMR.id}`, laMesajLive); } catch { LIVE = null; ecranCamera(CAMR.cod); return; }
  }
  const m = masinaLive();
  LIVE.eu = { id: LIVE.euId, nume: C0.numeLocal() || 'Eu', masina: cheieM(m.c), nivel: m.nivel };
  const salut = () => { if (!LIVE || !LIVE.canal) return; preiaGazda(); LIVE.canal.trimite({ t: 'h', ...LIVE.eu, ...(LIVE.gazda ? { g: 1, set: LIVE.set } : {}) }); if ($('ov').dataset.ecran === 'live') randLobby(); };
  salut(); clearInterval(LIVE.hb); LIVE.hb = setInterval(salut, 1500);
  LIVE.faza = 'lobby'; LIVE.inCursa = false;
  $('ov').dataset.ecran = 'live'; adresa('#live');
  randLobby();
}
// Dacă gazda nu mai trimite nimic de 6 s (a ieșit din aplicație), o preia cel cu id-ul cel mai mic
// dintre cei rămași: duce mai departe etapa, rezultatul sau lobby-ul. Dacă două telefoane se cred
// gazdă, rămâne cel cu id-ul mai mic.
function preiaGazda() {
  if (LIVE.gazda || !LIVE.gazdaVazut || Date.now() - LIVE.gazdaVazut < 6000) return;
  const prezenti = [LIVE.euId, ...[...LIVE.piloti.values()].filter(p => Date.now() - p.vazut < 5000 && p.id !== LIVE.gazdaId).map(p => p.id)].sort();
  if (prezenti[0] !== LIVE.euId) return;
  LIVE.gazda = true;
  if (LIVE.faza === 'calif') { clearTimeout(LIVE.tmo); LIVE.tmo = setTimeout(inchideEtapaLive, 20000); verificaEtapa(); }
  else if (LIVE.faza === 'rez' && LIVE.rez[LIVE.k]) aplicaRez({ k: LIVE.k, ordine: LIVE.rez[LIVE.k] });
}
function pilotiLobby() {
  const acum = Date.now(), l = [{ ...LIVE.eu, g: LIVE.gazda ? 1 : 0 }, ...[...LIVE.piloti.values()].filter(p => acum - p.vazut < 5000)];
  // gazda prima, apoi ceilalți (aceeași ordine pe toate telefoanele)
  return l.slice(0, 10).sort((a, b) => (b.g || 0) - (a.g || 0) || a.id.localeCompare(b.id));
}
// câte mașini trec dintr-o etapă în alta: Q1 toți, Q2 ~70%, Q3 ~50% (cel puțin 2; fără etape inutile)
function etapeLive(n, calif) {
  if (calif !== 'full') return [n];
  const e = [n];
  for (const f of [.7, .5]) { const k = Math.max(2, Math.round(n * f)); if (k < e[e.length - 1]) e.push(k); }
  return e;
}
const numeEtapa = k => (LIVE.plan && LIVE.plan.etape.length > 1 ? `Q${k + 1}` : 'Calificare');
const infoPilot = id => (LIVE.plan && LIVE.plan.piloti.find(p => p.id === id)) || { id, nume: 'Pilot', masina: '', nivel: 0 };
function randLobby() {
  if (!LIVE || $('ov').dataset.ecran !== 'live') return;
  const l = pilotiLobby(), g = LIVE.gazda, S = LIVE.set;
  const car = CAMR.mod === 'aceeasi' && DUPA_CHEIE.get(CAMR.masina);
  const seg = (k, v, txt) => `<button type="button" data-k="${k}" data-v="${v}" class="${String(S[k]) === String(v) ? 'on' : ''}"${g ? '' : ' disabled'}>${txt}</button>`;
  // se redesenează doar când s-a schimbat ceva (altfel o apăsare chiar atunci s-ar pierde)
  const html = `${titluOv('Cursă live')}
    <div class="camh"><span class="cod5">${CAMR.cod}</span><span><b>${l.length} ${l.length === 1 ? 'pilot' : 'piloți'}</b><small>${car ? `Toți cu ${car.name}` : 'Fiecare cu mașina lui'}</small></span>
      <button type="button" class="sch" id="share">Trimite codul</button></div>
    <div class="qt lst lob" id="lcl">${l.map((p, i) => { const c = DUPA_CHEIE.get(p.masina); return randQ({ n: curat(p.nume) + (p.g ? ' · gazda' : ''), m: c ? c.name : '', car: c || IMPRUMUT, col: PILOTI[i % PILOTI.length][2], eu: p.id === LIVE.euId }, i, ''); }).join('')}</div>
    <div class="setl"><span>Calificare</span><div class="mseg">${seg('calif', 'tur', 'Un tur')}${seg('calif', 'full', 'Q1 · Q2 · Q3')}</div>
      <span>Cursă</span><div class="mseg">${seg('cursa', 'true', `${E ? E.CURSA.ture : 5} tururi`)}${seg('cursa', 'false', 'Fără cursă')}</div></div>
    <p class="sub" id="lnota">${Date.now() - (LIVE.altiPePista || 0) < 3000 ? 'Ceilalți sunt pe pistă. Intri la runda următoare.' : ''}</p>
    <button type="button" class="go" id="go"${g && l.length >= 2 ? '' : ' disabled'}>${g ? (l.length >= 2 ? 'Start' : 'Așteaptă prietenii') : 'Gazda dă startul'}</button>
    ${CAMR.tip === 'live' ? '' : '<button type="button" class="go gh" id="go3">Înapoi în cameră</button>'}`;
  if (LIVE.lobbyHtml === html && $('ov').querySelector('.setl')) return;
  LIVE.lobbyHtml = html; $('ov').innerHTML = html;
  $('ov').style.display = 'flex';
  $('share').onclick = () => trimiteCodul(CAMR.cod, $('share'));
  if ($('go3')) $('go3').onclick = () => { inchideLive(); ecranCamera(CAMR.cod); };
  if (g) $('ov').querySelectorAll('.setl button').forEach(x => x.onclick = () => {
    LIVE.set = { ...LIVE.set, [x.dataset.k]: x.dataset.k === 'cursa' ? x.dataset.v === 'true' : x.dataset.v };
    LIVE.canal.trimite({ t: 'set', set: LIVE.set }); randLobby();
  });
  $('go').onclick = () => {
    if (!g) return;
    const piloti = pilotiLobby().map(({ id, nume, masina, nivel }) => ({ id, nume, masina, nivel }));
    const plan = { t: 'plan', piloti, etape: etapeLive(piloti.length, LIVE.set.calif), cursa: !!LIVE.set.cursa };
    LIVE.canal.trimite(plan); aplicaPlan(plan);
    const et = { t: 'etapa', k: 0, ids: piloti.map(p => p.id) };
    LIVE.canal.trimite(et); startEtapa(et);
  };
}
function aplicaPlan(m) {
  LIVE.plan = { piloti: m.piloti.slice(0, 10), etape: m.etape.slice(0, 3), cursa: !!m.cursa };
  LIVE.rez = []; LIVE.k = -1;
}
// O etapă de calificare: turul tău, cu ceilalți din etapă ca fantome (dacă ai ieșit, aștepți)
function startEtapa(m) {
  clearTimeout(LIVE.tmo);
  LIVE.faza = 'calif'; LIVE.k = m.k; LIVE.ids = m.ids.slice(0, 10); LIVE.timpi = new Map(); LIVE.eraInEtapa = LIVE.ids.includes(LIVE.euId);
  // gazda închide etapa și dacă unul nu-și trimite timpul (a ieșit din aplicație)
  if (LIVE.gazda) LIVE.tmo = setTimeout(inchideEtapaLive, 80000);
  if (!LIVE.eraInEtapa) { ecranEtapaLive(); return; }
  soloNou(null);
  LIVE.ids.filter(id => id !== LIVE.euId).forEach((id, i) => {
    const p = infoPilot(id), car = DUPA_CHEIE.get(p.masina) || IMPRUMUT;
    const d = masinaCursa(car, Math.max(0, Math.min(7775, p.nivel | 0)), [curat(p.nume).slice(0, 16), curat(p.nume).slice(0, 3).toUpperCase(), PILOTI[(i + 1) % PILOTI.length][2]], { remote: true, rid: id, sNet: null, latNet: 0, vazut: 0 });
    C.push(stare(d, C.length, { s: P.stareSolo(d).s, lansat: true }));
  });
  scena();
  LIVE.inCursa = true; LIVE.trimis = 0; LIVE.finTrimis = false;
  $('ov').dataset.ecran = ''; $('ov').style.display = 'none'; pornit = true; intra();
}
// după turul tău: îl trimiți și aștepți ceilalți
function finalEtapaEu(timp) {
  LIVE.inCursa = false;
  const tm = Math.round(timp * 1000);
  LIVE.timpi.set(LIVE.euId, tm);
  LIVE.canal.trimite({ t: 'timp', id: LIVE.euId, k: LIVE.k, timp: tm });
  ecranEtapaLive();
  verificaEtapa();
}
function ecranEtapaLive() {
  if (!LIVE || LIVE.faza !== 'calif') return;
  const rand = (id, i) => { const p = infoPilot(id), c = DUPA_CHEIE.get(p.masina), tm = LIVE.timpi.get(id); return `<div class="qr fara${id === LIVE.euId ? ' eu' : ''}"><span>${i + 1}</span><span class="nm"><b>${curat(p.nume)}</b>${c ? `<small>${c.name}</small>` : ''}</span><b>${tm != null ? fT(tm / 1000) : '<span class="sub">pe pistă</span>'}</b></div>`; };
  const ordine = LIVE.ids.slice().sort((x, y) => (LIVE.timpi.get(x) ?? 1e12) - (LIVE.timpi.get(y) ?? 1e12));
  const eu0 = LIVE.timpi.get(LIVE.euId);
  $('ov').innerHTML = `${titluOv(`Cursă live · ${numeEtapa(LIVE.k)}`)}
    <p class="d" style="font-size:52px">${eu0 != null ? fT(eu0 / 1000) : 'Ai ieșit'}</p>
    <p class="sub">${LIVE.timpi.size} din ${LIVE.ids.length} au terminat turul</p>
    <div class="qt">${ordine.map(rand).join('')}</div>`;
  $('ov').dataset.ecran = 'etapa'; $('ov').style.display = 'flex';
}
function verificaEtapa() { if (LIVE.gazda && LIVE.faza === 'calif' && LIVE.ids.every(id => LIVE.timpi.has(id))) inchideEtapaLive(); }
function inchideEtapaLive() {
  if (!LIVE || !LIVE.gazda || LIVE.faza !== 'calif') return;
  clearTimeout(LIVE.tmo);
  const ordine = LIVE.ids.map(id => [id, LIVE.timpi.get(id) ?? null]).sort((x, y) => (x[1] ?? 1e12) - (y[1] ?? 1e12) || x[0].localeCompare(y[0]));
  const m = { t: 'rez', k: LIVE.k, ordine };
  LIVE.canal.trimite(m); aplicaRez(m);
}
function aplicaRez(m) {
  if (!LIVE.plan) return;
  LIVE.rez[m.k] = m.ordine; LIVE.faza = 'rez'; LIVE.inCursa = false;
  if (pornit) { pornit = false; gata = true; }
  const ultima = m.k >= LIVE.plan.etape.length - 1, trec = ultima ? m.ordine.length : LIVE.plan.etape[m.k + 1];
  const pol = m.ordine[0] && m.ordine[0][1];
  const randR = ([id, tm], i) => { const p = infoPilot(id), c = DUPA_CHEIE.get(p.masina); return (i === trec && !ultima ? '<div class="qsep"></div>' : '') + `<div class="qr fara${id === LIVE.euId ? ' eu' : ''}${i >= trec ? ' out' : ''}"><span>${i + 1}</span><span class="nm"><b>${curat(p.nume)}</b>${c ? `<small>${c.name}</small>` : ''}</span><b>${tm == null ? '–' : i ? fD((tm - pol) / 1000) : fT(tm / 1000)}</b></div>`; };
  const urm = !ultima ? `Spre Q${m.k + 2}` : LIVE.plan.cursa ? 'Pe grilă' : 'Clasamentul';
  $('ov').innerHTML = `${titluOv(`Cursă live · ${numeEtapa(m.k)}`)}
    <div class="qt">${m.ordine.map(randR).join('')}</div>
    <button type="button" class="go" id="go"${LIVE.gazda ? '' : ' disabled'}>${LIVE.gazda ? urm : 'Gazda merge mai departe'}</button>`;
  $('ov').dataset.ecran = 'rezlive'; $('ov').style.display = 'flex';
  $('go').onclick = () => { if (LIVE.gazda) maiDeparteLive(); };
}
// ordinea finală a calificării: ultima etapă, apoi cei ieșiți înainte, în ordinea lor
function ordineCalif() {
  const out = [], vazut = new Set();
  for (let k = LIVE.rez.length - 1; k >= 0; k--) for (const [id] of LIVE.rez[k] || []) if (!vazut.has(id)) { vazut.add(id); out.push(id); }
  return out;
}
function maiDeparteLive() {
  const k = LIVE.k, R = LIVE.rez[k];
  if (k < LIVE.plan.etape.length - 1) {
    const m = { t: 'etapa', k: k + 1, ids: R.filter(x => x[1] != null).slice(0, LIVE.plan.etape[k + 1]).map(x => x[0]) };
    LIVE.canal.trimite(m); startEtapa(m); return;
  }
  if (LIVE.plan.cursa) {
    const m = { t: 'start', grila: ordineCalif().map(infoPilot), out: 4 * .8 + .8 + .4 + Math.random() * 1.8 };
    LIVE.canal.trimite(m); startLive(m); return;
  }
  LIVE.canal.trimite({ t: 'gata' }); finalCalifLive();
}
function finalCalifLive() {
  LIVE.faza = 'gata';
  const o = ordineCalif(), p = o.indexOf(LIVE.euId);
  const loc = (id, i) => { if (!id) return '<div></div>'; const x = infoPilot(id), c = DUPA_CHEIE.get(x.masina) || IMPRUMUT; return `<div class="p${i + 1}${id === LIVE.euId ? ' eu' : ''}">${tok({ car: c, col: PILOTI[i][2] })}<b>${i + 1}</b><small>${id === LIVE.euId ? 'Tu' : curat(x.nume)}</small></div>`; };
  $('ov').innerHTML = `${titluOv('Cursă live · calificare')}
    <div class="pod">${loc(o[1], 1)}${loc(o[0], 0)}${loc(o[2], 2)}</div>
    <p class="d" style="font-size:48px">P${p + 1}<span style="font-size:18px;color:#9aa0a9"> din ${o.length}</span></p>
    <button type="button" class="go" id="go">Înapoi în lobby</button>`;
  $('ov').dataset.ecran = 'finallive'; $('ov').style.display = 'flex';
  $('go').onclick = () => { soloNou(); scena(); ecranLive(); };
}
function laMesajLive(m) {
  if (!LIVE || !m || typeof m !== 'object' || typeof m.t !== 'string') return;
  if (m.t === 'h') {
    if (typeof m.id !== 'string' || m.id === LIVE.euId) return;
    LIVE.piloti.set(m.id, { id: m.id, nume: String(m.nume || 'Pilot').slice(0, 16), masina: String(m.masina || ''), nivel: Math.max(0, Math.min(7775, m.nivel | 0)), vazut: Date.now(), g: m.g ? 1 : 0 });
    if (m.g) { LIVE.gazdaVazut = Date.now(); LIVE.gazdaId = m.id; if (LIVE.gazda && m.id < LIVE.euId) LIVE.gazda = false; }
    if (m.g && m.set && !LIVE.gazda) LIVE.set = { calif: m.set.calif === 'full' ? 'full' : 'tur', cursa: m.set.cursa !== false };
    if ($('ov').dataset.ecran === 'live' && Date.now() - LIVE.ultim > 700) { LIVE.ultim = Date.now(); randLobby(); }
  } else if (m.t === 'set' && !LIVE.gazda && m.set) { LIVE.set = { calif: m.set.calif === 'full' ? 'full' : 'tur', cursa: m.set.cursa !== false }; randLobby(); }
  else if (m.t === 'plan' && Array.isArray(m.piloti) && Array.isArray(m.etape) && m.piloti.some(p => p && p.id === LIVE.euId)) aplicaPlan(m);
  else if (m.t === 'etapa' && LIVE.plan && Array.isArray(m.ids)) startEtapa(m);
  else if (m.t === 'timp' && LIVE.faza === 'calif' && m.k === LIVE.k && typeof m.id === 'string' && LIVE.ids.includes(m.id) && Number.isFinite(+m.timp)) {
    LIVE.timpi.set(m.id, Math.round(+m.timp));
    if ($('ov').dataset.ecran === 'etapa') ecranEtapaLive();
    verificaEtapa();
  } else if (m.t === 'rez' && LIVE.plan && Array.isArray(m.ordine)) aplicaRez(m);
  else if (m.t === 'gata' && LIVE.plan) finalCalifLive();
  else if (m.t === 'start' && !LIVE.inCursa && Array.isArray(m.grila) && m.grila.some(p => p && p.id === LIVE.euId)) startLive(m);
  else if (m.t === 'p' && !LIVE.inCursa) LIVE.altiPePista = Date.now();
  else if (m.t === 'p' && LIVE.inCursa) {
    const c = C.find(x => x.rid === m.id); if (!c) return;
    c.sNet = +m.s || 0; c.netT = Number.isFinite(+m.tt) ? +m.tt : t; c.v = Math.max(0, +m.v || 0); c.latNet = Math.max(-5.2, Math.min(5.2, +m.l || 0));
    c.nOn = !!m.n; c.vazut = ceas; c.lansat = true; if (TURURI > 1 && m.f != null && c.fin === null) c.fin = +m.f; c.tura = Math.max(0, Math.floor(c.sNet / L));
  }
}
function startLive(msg) {
  const grila = msg.grila.slice(0, 10).filter(p => p && typeof p.id === 'string');
  LIVE.faza = 'cursa'; LIVE.inCursa = true; LIVE.trimis = 0; LIVE.finCeas = null; LIVE.finTrimis = false;
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
  if (SESIUNE) return eu.q8.timp != null;
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
  LIVE.faza = 'gata';
  $('ov').innerHTML = `${titluOv('Cursă live · final')}
    <p class="d" style="font-size:48px;margin-top:4px">P${p + 1}<span style="font-size:18px;color:#9aa0a9"> din ${o.length}</span></p>
    <div class="qt">${o.map((c, i) => randQ(c, i, c.fin == null ? '–' : i ? fD(c.fin - t1) : fT(c.fin - (c.t0 || 0)))).join('')}</div>
    <button type="button" class="go" id="go">Înapoi în lobby</button>`;
  $('ov').dataset.ecran = 'finallive'; $('ov').style.display = 'flex';
  $('go').onclick = () => { soloNou(); scena(); ecranLive(); };
}
function inchideLive() { if (!LIVE) return; clearInterval(LIVE.hb); clearTimeout(LIVE.tmo); try { LIVE.canal && LIVE.canal.opreste(); } catch { /* deja închis */ } LIVE = null; }
// ---------- weekendul ----------
const ETAPE_LUNGI = [['Q1', 10, 7], ['Q2', 7, 5], ['Q3', 5, 5]];
function incepe() {
  if (SES.mod === 'antren') { $('ov').dataset.ecran = 'antren'; adresa('#antrenament'); antrenament(); return; }
  $('ov').dataset.ecran = 'weekend'; adresa('#weekend');
  pregatesteRivali();
  WK = { etape: SES.calif === 'scurta' ? [['Calificare', 10, 10]] : ETAPE_LUNGI, k: 0, in: [definitiaMea(), ...RIVALI], coada: [], eliminat: null };
  etapa();
}
function etapa() {
  const [nume, n, trec] = WK.etape[WK.k];
  if (WK.etape.length > 1 && WK.in.find(d => d.eu)) {
    // ordinea de ieșire: Q1 la întâmplare, apoi cel mai lent din etapa de dinainte primul
    const ord0 = WK.k === 0 ? WK.in.slice().sort(() => Math.random() - .5) : WK.in.slice().sort((a, b) => (WK.prev.get(b) ?? 0) - (WK.prev.get(a) ?? 0));
    WK.timpi = new Map(); sesiuneNoua(ord0); scena();
    const loc = ord0.findIndex(d => d.eu) + 1;
    $('ov').innerHTML = `${titluOv(`Calificare · ${nume}`)}
    <p class="d" style="font-size:64px">${nume}</p>
    <p class="sub">${n} piloți · primii ${trec} trec mai departe</p>
    <p class="sub">Ieșiți pe rând de la boxe: tu ești al ${loc}-lea. Un tur de lansare, turul rapid, apoi înapoi. Cine nu e pe tur rapid se dă la o parte.</p>
    <button type="button" class="go" id="go">Pe pistă</button>`;
    $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; intra(); };
    return;
  }
  // boții își fac turul acum (simulat); cel mai rapid e fantoma ta
  WK.timpi = new Map(); WK.ture = []; let pol = null;
  for (const d of WK.in) if (!d.eu) { const r = turSolo(d); WK.timpi.set(d, r.timp); WK.ture.push(r); if (!pol || r.timp < pol.timp) pol = r; }
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
  WK.prev = new Map(WK.timpi);
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
    cuIncarcare(() => {
      if (!ultima) { WK.k++; if (WK.eliminat) { while (WK.k < WK.etape.length) simuleazaEtapa(); } else { etapa(); return; } }
      if (SES.mod === 'complet') ecranGrila(); else rezultatCalif();
    });
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
  $('ov').innerHTML = `${titluOv(SP_PRINCIPAL ? `Marele Premiu ${Sponsori.esc(SP_PRINCIPAL.nume)} · ${TURURI} tururi` : `Cursa · ${TURURI} tururi`)}<p class="d" style="font-size:56px">Pleci P${p}</p>
    <div class="qt">${C.map((d, i) => randQ(d, i, '', '')).join('')}</div>
    <div class="pneu-al" role="radiogroup" aria-label="Pneuri">${Object.keys(PNEU).map(k => `<button type="button" class="pn${k === pneuStart ? ' on' : ''}" data-c="${k}" style="--c:${PNEU[k].col}" role="radio" aria-checked="${k === pneuStart}"><b>${k}</b><small>${PNEU[k].n}</small></button>`).join('')}</div>
    <button type="button" class="go" id="go">Pe grilă</button>`;
  $('ov').querySelectorAll('.pn').forEach(b => b.onclick = () => {
    pneuStart = b.dataset.c; eu.cmp = pneuStart; try { localStorage.setItem('frq_cursa_pneu', pneuStart); } catch { /* fără stocare */ }
    $('ov').querySelectorAll('.pn').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
  });
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; faIntro(() => { pornit = true; START.t0 = ceas + .8; acum = 0; pornestePartida(); }); };
}
// ---------- antrenamentul: tururi singur, cu recordul pe mașină ----------
const cheieRec = () => `frq_cursa_rec3_${cheieM(aleasa.c)}#${aleasa.nivel}`;
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
  if (LIVE && LIVE.faza === 'calif') { finalEtapaEu(timp); return; }
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
  // Unde ai câștigat și unde ai pierdut față de cel cu care te compari, în secunde (> 0 = ai pierdut).
  // Uzura e scoasă din Drepte și Viraje, ca barele să nu numere același lucru de două ori.
  const uzDr = eu.st.uzD - ref.st.uzD, uzT = eu.st.uz - ref.st.uz;
  const bare = [['Start', eu.st.start - ref.st.start + (eu.penal - ref.penal)], ['Drepte', eu.st.dr - ref.st.dr - uzDr], ['Viraje', eu.st.vir - ref.st.vir - (uzT - uzDr)], ['Boxe', eu.st.pit - ref.st.pit], ['Pneuri', uzT]];
  const vMax = Math.max(1, ...bare.map(x => Math.abs(x[1]))), rau = bare.reduce((m, x) => (x[1] > m[1] ? x : m)), bun = bare.reduce((m, x) => (x[1] < m[1] ? x : m));
  const concl = rau[1] > .3 ? `Ai pierdut cel mai mult: ${rau[0].toLowerCase()}` : bun[1] < -.3 ? `Ai câștigat cel mai mult: ${bun[0].toLowerCase()}` : 'Egal peste tot';
  const bara = ([n, x]) => { const k = x > .05 ? 'r' : x < -.05 ? 'v' : ''; return `<div class="gb"><span>${n}</span><div class="gb-z"><i class="${k}" style="width:${(Math.abs(x) / vMax * 50).toFixed(1)}%"></i></div><b class="${k}">${k === 'r' ? '−' : k === 'v' ? '+' : ''}${Math.abs(x).toFixed(1).replace('.', ',')} s</b></div>`; };
  // clasamentul complet: locul, mașina, pneurile puse (în ordine) și diferența față de primul
  const pn = c => (c.strat || [c.cmp || 'M']).map(k => `<i style="--c:${PNEU[k].col}">${k}</i>`).join('');
  const dif = (c, i) => (i === 0 ? fT(c.fin) : c.fin != null && o[0].fin != null ? fD(c.fin - o[0].fin) : '–');
  const clas = o.map((c, i) => `<div class="qr${c.eu ? ' eu' : ''}"><span>${i + 1}</span>${tok(c)}<span class="nm"><b>${c.eu ? 'Tu' : c.n}</b></span><span class="strat">${pn(c)}</span><b>${dif(c, i)}</b></div>`).join('');
  const medie = eu.st.franari ? Math.round(eu.st.scor / eu.st.franari * 100) : 0;
  const stat = `Frânări ${medie}%${eu.penal ? ' · start fals' : START && START.reactie != null ? ` · reacție ${START.reactie.toFixed(3).replace('.', ',')} s` : ''}`;
  $('ov').innerHTML = `<div class="fin-cap"><div class="fin-st">${titluOv(SP_PRINCIPAL ? `Marele Premiu ${Sponsori.esc(SP_PRINCIPAL.nume)}` : 'Cursa · final')}
      <p class="d fin-loc">P${p + 1}<small>${p === 0 ? `cu ${fD(o[1].fin - eu.fin).slice(1)} s avans` : `la ${fD(eu.fin - o[0].fin).slice(1)} s`}</small></p>
      <p class="fin-stat">${stat}</p></div>
      ${PARTIDA ? '<div class="fbani mic" id="fbani"><span class="cls-bani"><span class="cls-bani-s"><b>…</b></span><span class="cls-bani-z">&nbsp;<i style="--p:0%"></i></span></span></div>' : ''}</div>
    <div class="qt fcls">${clas}</div>
    <div class="fin-g"><p class="fin-gt"><span>Față de ${ref.eu ? 'tine' : ref.n}</span><em>${concl}</em></p>${bare.map(bara).join('')}</div>
    ${window.Sponsori ? Sponsori.final('cursa') : ''}<div class="fbt"><button type="button" class="go gh" id="go2">Meniu</button><button type="button" class="go" id="go4">Încă o cursă</button></div>`;
  $('ov').style.display = 'flex'; $('go2').onclick = () => { soloNou(); scena(); ecranStart(); };
  // aceeași mașină, adversari noi, de la calificare
  $('go4').onclick = () => { SES.mod = 'complet'; cuIncarcare(incepe); };
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
  const lu = el('lum'), sb = el('sb');
  if (!START || START.t0 === null) { pune(lu, 'hidden', true); pune(sb, '.on', false); return; }
  const k = Math.floor((ceas - START.t0) / .8) + 1;
  if (START.out === null && k > 5) START.out = START.t0 + (START.outFix != null ? START.outFix : 4 * .8 + .8 + .4 + Math.random() * 1.8);
  const stinse = START.out !== null && ceas >= START.out;
  pune(lu, 'hidden', (stinse && ceas > START.out + .5) || !!HE.poartaVizibila);
  const becuri = HE.becuri || (HE.becuri = [...lu.querySelectorAll('i')]);
  becuri.forEach((x, i) => pune(x, '.on', !stinse && Math.floor(i / 2) < Math.min(5, k)));
  const nL = stinse ? 0 : Math.min(5, k); if (nL !== HE.nPoarta) { if (window.DragSunet) { if (nL > (HE.nPoarta || 0)) DragSunet.bip(660, .12); else if (stinse && HE.nPoarta) DragSunet.bip(990, .3); } HE.nPoarta = nL; poartaLumini(nL); }
  pune(lu, '.go', stinse);
  // boții pleacă după reacția lor; tu, la apăsare (după un start fals, la stingere)
  if (stinse) for (const c of C) if (!c.lansat && !c.remote) {
    if (!c.eu) { if (c.reactie == null) c.reactie = .17 + Math.random() * .3; if (ceas >= START.out + c.reactie) c.lansat = true; }
    else if (START.penal) { c.lansat = true; START.reactie = 0; }
    else if (ceas > START.out + 1.2) { c.lansat = true; START.reactie = 1.2; START.msg = 'Prea târziu'; START.msgT = 1.4; }
  }
  pune(sb, '.on', !eu.lansat && pornit);
  START.msgT -= 1 / 60;
  if (START.msgT > 0) pune(el('fbq'), 'text', START.msg);
}
let last = performance.now(), acum = 0, racire = 0, finEu = null, ovDe = null, pauza = false;
// ---------- setările din cursă ----------
// Sunetul (motorul tău și luminile de start, același comutator ca la Startul), vibrațiile (doar unde
// telefonul le are), grafica (clară sau economie de baterie: jumătate din pixeli) și ieșirea. Cursa
// stă pe loc cât sunt deschise, mai puțin în cursele live și în încercările cu premii (acolo merge).
const ST = window.Shared ? Shared.store : { get: (k, d) => d, set() {} };
const GFX = () => (ST.get('frq_cursa_gfx', 'clara') === 'baterie' ? 1 : Math.min(devicePixelRatio, 2));
const poatePauza = () => !(LIVE && LIVE.inCursa) && !PREMIU;
function scrieSetari() {
  const r = k => document.querySelector(`#set [data-s=${k}] b`);
  r('sunet').textContent = window.DragSunet && DragSunet.pornit ? 'Pornit' : 'Oprit';
  r('vib').textContent = ST.get('frq_vibratii', true) === false ? 'Oprite' : 'Pornite';
  document.querySelector('#set [data-s=vib]').hidden = !navigator.vibrate;
  r('gfx').textContent = ST.get('frq_cursa_gfx', 'clara') === 'baterie' ? 'Economie' : 'Clară';
  r('cam').textContent = CAMERE[camM];
  $('set-t').innerHTML = poatePauza() ? 'Pauză' : 'Setări<small>Cursa merge mai departe</small>';
  const iesi = $('set-iesi'); iesi.textContent = 'Ieși din cursă'; delete iesi.dataset.sigur;
  $('set-d').textContent = `${screen.width}x${screen.height} · ${innerHeight} · ${Math.round(visualViewport ? visualViewport.height : 0)} · ${document.getElementById('vw').clientHeight} · ${navigator.standalone ? 'app' : 'browser'}`;
}
function setari(deschise) {
  $('set').hidden = !deschise; pauza = deschise && poatePauza() && pornit;
  if (deschise) { scrieSetari(); if (window.DragSunet) DragSunet.opresteTot(.15); }
}
$('gb').addEventListener('click', () => setari(true));
$('set-cont').addEventListener('click', () => setari(false));
$('set').addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) { if (e.target.id === 'set') setari(false); return; }
  const k = b.dataset.s;
  if (k === 'sunet' && window.DragSunet) DragSunet.comuta();
  else if (k === 'cam') puneCamera((camM + 1) % CAMERE.length);
  else if (k === 'vib') ST.set('frq_vibratii', ST.get('frq_vibratii', true) === false);
  else if (k === 'gfx') { ST.set('frq_cursa_gfx', ST.get('frq_cursa_gfx', 'clara') === 'baterie' ? 'clara' : 'baterie'); R.setPixelRatio(GFX()); potrivesteScena(); }
  scrieSetari();
});
// ieșirea: a doua atingere confirmă; apoi ca săgeata înapoi (în meniul Cursei)
$('set-iesi').addEventListener('click', () => {
  const b = $('set-iesi');
  if (!b.dataset.sigur) { b.dataset.sigur = '1'; b.textContent = PREMIU ? 'Sigur? Încercarea se pierde' : 'Sigur? Ieși'; return; }
  setari(false); pauza = false; if (window.DragSunet) DragSunet.opresteTot(.1);
  const inapoi = document.querySelector('.cursa-pag .back-btn'); if (inapoi) inapoi.click();
});
// ---------- sunetul cursei: motorul tău (turația urcă pe 7 trepte cu viteza) și luminile ----------
let motorPornit = false, treapta = 0;
const vMax = c => c.vMax || (c.vMax = (c.prof ? Math.max(...c.prof) : 70));
let sunetT = 0;
function sunetCursa() { try { sunetCursa0(); } catch { /* sunetul nu oprește jocul */ } }
function sunetCursa0() {
  const S = window.DragSunet;
  if (!S || !S.pornit) return;
  const merge = pornit && eu && eu.fin === null && !pauza && el('ov').style.display === 'none' && (eu.lansat || TURURI === 1);
  if (!merge) { if (motorPornit) { S.opreste('cursa', .4); motorPornit = false; } return; }
  if (!motorPornit) { S.motor('cursa', false, 0); motorPornit = true; treapta = 0; }
  if (ceas - sunetT < .07) return; sunetT = ceas;
  const w = vMax(eu) / 7, g = Math.min(6, Math.floor(Math.max(0, eu.v) / w));
  if (g > treapta) S.schimba('cursa', false); treapta = g;
  S.seteaza('cursa', .55 + .45 * Math.min(1, (Math.max(0, eu.v) - g * w) / w), false);
}
// Simularea merge cu pas fix (ca serverul s-o poată reface): într-un cadru intră 2 sau 3 pași (la
// 120 Hz, 1 sau 2), deci desenul ar sări neregulat. Desenăm între ultimii doi pași, după cât s-a
// scurs din pasul următor: mișcarea e continuă, iar simularea rămâne aceeași.
function tine() { for (const c of C) { c.sA = c.s; c.lA = c.latC; } }
const alfa = () => (pornit ? Math.max(0, Math.min(1, acum / CM.DT)) : 1);
const RACIRE = 2.6;
function intra() { numaraSponsoriPista(); const v = $('vw'); v.classList.remove('intra'); void v.offsetWidth; v.classList.add('intra'); acum = 0; }
// timpul tău (față de fantomă) sau locul tău, mare pe pistă, cât mașina încetinește după linie
function arataFinal() {
  const b = $('finb'), sm = $('fins'); sm.style.color = '';
  if (SESIUNE) {
    const gata = C.filter(c => c.q8.timp != null).sort((a, b) => a.q8.timp - b.q8.timp), p = gata.indexOf(eu), alt = gata.find(c => c !== eu);
    b.textContent = fT(eu.q8.timp);
    if (alt) { const d = eu.q8.timp - alt.q8.timp; sm.textContent = p === 0 ? `P1 · ${fD(d)} s` : `P${p + 1} · ${fD(eu.q8.timp - gata[0].q8.timp)} s`; sm.style.color = p === 0 ? '#2ecc71' : '#f5c542'; } else sm.textContent = 'Primul timp';
  } else if (TURURI === 1) {
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
  const bun = SESIUNE ? /^P1/.test(sm.textContent) || sm.textContent === 'Primul timp' : TURURI === 1 ? !(FANT && FANT.timp) || eu.fin - eu.t0 <= FANT.timp : b.textContent === 'P1';
  window.Shared && Shared.haptic(bun ? 'success' : 'tick');
}
function cadru(now) {
  // primul lucru: cadrul următor (o eroare într-un cadru nu mai poate îngheța jocul)
  requestAnimationFrame(cadru);
  // pauză (setările deschise, unde se poate): nimic nu merge mai departe, nici ceasul
  if (pauza) { last = now; return; }
  const dt = Math.min(.05, (now - last) / 1000); last = now; ceas += dt;
  if (INTRO && ceas - INTRO.t >= INTRO.dur) gataIntro(false);
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
      SESIUNE ? finalSesiune() : TURURI === 1 ? finalSolo() : LIVE && LIVE.inCursa ? finalLive() : final();
      const ov = $('ov'); ov.classList.remove('lin'); void ov.offsetWidth; ov.classList.add('lin');
    }
  }
  // sub un ecran de meniu (opac) pista nu se mai desenează după ce a apărut ecranul: baterie și căldură
  const ovVis = el('ov').style.display !== 'none';
  ovDe = ovVis ? (ovDe ?? ceas) : null;
  if (!ovVis || ceas - ovDe < .6) { const o = ord(); hud(dt, o); lumini(); momentPista(); desen(dt, o); }
  sunetCursa();
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
  oprireCamera(); inchideLive(); clasaSapt = null; PARTIDA = null; SESIUNE = false;
  if (PREMIU) { aleasa = PREMIU.inapoi; PREMIU = null; }
  soloNou(); scena();
  if (cam) ecranCamera(cam[1].toUpperCase()); else if (h === '#cupa') ecranCupa(); else if (h === '#sapt') ecranSapt(); else if (h === '#prieteni') ecranPrieteni(); else ecranStart();
});
// test: o cursă cu o singură mașină (fără boți), cu o oprire la boxe la sfârșitul turului `opriLa`
function simCursaTest(opriLa, ritm, cmp = 'M', cmpNou = 'M') {
  const salv = [C, eu, t, TURURI]; TURURI = E ? E.CURSA.ture : 5;
  const c = stare(masinaCursa(IMPRUMUT, 0, ['T', 'T', '#fff'], { eu: 1 }), 0, { s: -6, lansat: true, ritm, cmp, svcFix: 3 });
  C = [c]; eu = c; t = 0;
  while (c.fin === null && t < 3000) { if (opriLa != null && !c.cerut && c.tura === opriLa) { c.cere = true; c.cmpNou = cmpNou; c.cerut = true; } pas(CM.DT); }
  const rez = { timp: c.fin, boxe: c.st.pit, cmp: c.cmp, tyre: c.tyre };
  [C, eu, t, TURURI] = salv; return rez;
}
if (new URLSearchParams(location.search).has('test')) {
  window.__fg = () => FG && { x: FG.position.x, z: FG.position.z };
  function calibrare(n = 6, offs = null) {
  const salv = dif, rez = [], timp = d => turSolo(d).timp, offV = DIF.map(x => x.off); if (offs) offs.forEach((o, i) => { DIF[i].off = o; });
  const tu = sk => { const a = []; for (let k = 0; k < 4; k++) a.push(timp(masinaCursa(aleasa.c, aleasa.nivel, ['Tu', 'TU', '#fff'], { sk }))); return Math.min(...a); };
  const perfect = tu(1.25), bine = tu(.95), mediu = tu(.7);
  for (let d = 0; d < DIF.length; d++) {
    dif = d; const cele = [];
    for (let k = 0; k < n; k++) { const r = alegeRivali(aleasa).map((x, i) => masinaCursa(x.c, x.nivel, PILOTI[i])); const t = r.map(timp).sort((a, b) => a - b); cele.push(t[0], t[Math.floor(t.length / 2)]); }
    const cel = cele.filter((_, i) => i % 2 === 0), med = cele.filter((_, i) => i % 2 === 1), m = a => a.reduce((x, y) => x + y, 0) / a.length;
    rez.push({ nivel: DIF[d].n, celMaiBunBot: m(cel).toFixed(2), botMediu: m(med).toFixed(2), poleDinN: cel.filter(x => x > perfect).length + '/' + n });
  }
  dif = salv; DIF.forEach((x, i) => { x.off = offV[i]; }); return { perfect: perfect.toFixed(2), bine: bine.toFixed(2), mediu: mediu.toFixed(2), rez };
}
  window.__cursa = { get camM() { return camM; }, get INTRO() { return INTRO; }, get FASII() { return FASII; }, get TRIB() { return TRIB; }, get VZ() { return VZ; }, get FG() { return FG; }, get R() { return R; }, simCursaTest, pas, calibrare, alegeRivali, set dif(v) { dif = v; }, set UZ_K(v) { UZ_K = v; }, get GM() { return GM; }, get PR() { return PR; }, get LIVE() { return LIVE; }, laMesajLive, ecranCamera, get t() { return t; }, ecranCupa, ecranSapt, get C() { return C; }, get eu() { return eu; }, get mom() { return mom; }, get ceas() { return ceas; }, get START() { return START; }, get WK() { return WK; }, SES, GRUPURI, DREAPTA, L, VIT, franeaza, setRitm, pleaca, turSolo };
}
$('inc').hidden = true;
requestAnimationFrame(cadru);
})();
