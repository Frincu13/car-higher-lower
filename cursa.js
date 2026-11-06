// Cursa: prototipul de cursă în stil manager. Pista se vede de sus, mașinile sunt jetoane cu
// poza lor; tu alegi ritmul (Atac, Normal, Ușor), folosești nitro pe dreaptă și intri la boxe.
// Depășirile ies din ritm, mașină, anvelope, aspirație și nitro. Nu atinge garajul sau tuningul.
(() => {
const $ = i => document.getElementById(i);
// Pozele mașinilor (Wikimedia Commons), micșorate și puse aici ca jetoanele să se deseneze și fără semnal.
const FOTO = {
 "m3": "data:image/jpeg;base64,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",
 "civic": "data:image/jpeg;base64,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",
 "supra": "data:image/jpeg;base64,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",
 "golf": "data:image/jpeg;base64,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",
 "clio": "data:image/jpeg;base64,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",
 "cayman": "data:image/jpeg;base64,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"
};
$('fo').src = FOTO.m3;
// ---------- circuitul ----------
const VTOP = 72, ALAT = 17, ABR = 13;
const P = [[0,0],[650,0],[760,50],[760,160],[660,210],[520,200],[430,250],[440,360],[560,410],[780,420],[880,500],[860,630],[740,680],[420,680],[180,640],[70,540],[100,410],[20,300],[-90,240],[-160,140],[-130,40]].map(p => [p[0] * .7, p[1] * .7]);
let X, Y, Hd, K, VC, N, step, L;
(() => {
  const raw = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) { const t = k / 40, t2 = t * t, t3 = t2 * t, f = (A, B, C, D) => .5 * (2 * B + (-A + C) * t + (2 * A - 5 * B + 4 * C - D) * t2 + (-A + 3 * B - 3 * C + D) * t3); raw.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]); }
  }
  const m = raw.length, cum = [0];
  for (let i = 1; i <= m; i++) { const a = raw[i - 1], b = raw[i % m]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  N = Math.round(cum[m] / 2); step = cum[m] / N; L = cum[m];
  const x = new Float64Array(N), y = new Float64Array(N); let j = 0;
  for (let s = 0; s < N; s++) { const dd = s * step; while (cum[j + 1] < dd) j++; const a = raw[j], b = raw[(j + 1) % m], u = (dd - cum[j]) / (cum[j + 1] - cum[j]); x[s] = a[0] + (b[0] - a[0]) * u; y[s] = a[1] + (b[1] - a[1]) * u; }
  const h = new Float64Array(N); for (let s = 0; s < N; s++) { const a = (s - 1 + N) % N, b = (s + 1) % N; h[s] = Math.atan2(y[b] - y[a], x[b] - x[a]); }
  const k = new Float64Array(N), W = 4; for (let s = 0; s < N; s++) { let d = h[(s + W) % N] - h[(s - W + N) % N]; d = Math.atan2(Math.sin(d), Math.cos(d)); k[s] = d / (2 * W * step); }
  const vc = Float64Array.from(k, v => Math.min(VTOP, Math.sqrt(ALAT / Math.max(Math.abs(v), 1e-6))));
  let best = 0, bi = 0, run = 0; for (let s = 0; s < 2 * N; s++) { if (vc[s % N] >= VTOP * .99) { run++; if (run > best) { best = run; bi = s % N; } } else run = 0; }
  const s0 = (bi - Math.floor(best * .65) + N) % N, rot = a => { const r = new Float64Array(N); for (let s = 0; s < N; s++) r[s] = a[(s + s0) % N]; return r; };
  X = rot(x); Y = rot(y); Hd = rot(h); K = rot(k); VC = rot(vc);
})();
const idx = s => Math.floor((((s / step) % N) + N) % N) % N;
const DREAPTA = s => VC[idx(s)] >= VTOP * .98 && VC[idx(s + 50)] >= VTOP * .98;
const VIRAJ_APROAPE = s => { for (let d = 20; d < 160; d += 10) if (VC[idx(s + d)] < VTOP * .7) return true; return false; };
function profil(pow, grip) {
  const vt = VTOP * Math.sqrt(pow), am = 7.2 * pow, v = Float64Array.from(K, k => Math.min(vt, Math.sqrt(ALAT * grip / Math.max(Math.abs(k), 1e-6))));
  for (let r = 0; r < 3; r++) {
    for (let s = 1; s <= N; s++) { const i = s % N, p = s - 1; v[i] = Math.min(v[i], Math.sqrt(v[p] * v[p] + 2 * am * (1 - (v[p] / vt) ** 2) * step)); }
    for (let s = N - 1; s >= 0; s--) { const nx = (s + 1) % N; v[s] = Math.min(v[s], Math.sqrt(v[nx] * v[nx] + 2 * ABR * step)); }
  }
  return v;
}
// ---------- mașinile: diferențe mici, ca deciziile să conteze ----------
const DEF = [
  { n: 'Andrei', sc: 'AND', m: 'Toyota Supra', f: 'supra', col: '#f5b82e', pow: 1.04, grip: .97, ag: .6 },
  { n: 'Tu', sc: 'TU', m: 'BMW M3', f: 'm3', col: '#d81528', pow: 1.0, grip: 1.0, eu: 1 },
  { n: 'Teo', sc: 'TEO', m: 'VW Golf R', f: 'golf', col: '#3d7bff', pow: .99, grip: 1.02, ag: .45 },
  { n: 'Ștefi', sc: 'ȘTE', m: 'Mégane R.S.', f: 'clio', col: '#ff5c7a', pow: .98, grip: 1.03, ag: .5 },
  { n: 'Radu', sc: 'RAD', m: 'Civic Type R', f: 'civic', col: '#ff8a00', pow: .97, grip: 1.04, ag: .55 },
  { n: 'FRQ Bot', sc: 'BOT', m: 'Porsche Cayman', f: 'cayman', col: '#9aa0a9', pow: 1.02, grip: .99, ag: .5 },
];
const IMG = {}; for (const [k, v] of Object.entries(FOTO)) { const im = new Image(); im.src = v; IMG[k] = im; }
const TURURI = 3, RITM = { usor: [.968, .35], normal: [1, 1], atac: [1.022, 2.3] }, UZ = .0042, PAS = 13, NITRO = 3;
let C, eu, t, pornit, gata, harta = false, pozVeche = 2;
function nou() {
  C = DEF.map((d, i) => ({ ...d, i, prof: profil(d.pow, d.grip), s: -i * 15 - 40, v: 40, ritm: 'normal', tyre: 1, nitro: 2, nT: 0, cere: false, pit: 0, pr: 0, trece: null, tT: 0, latC: 0, latF: 0, latFT: 0, fin: null, tura: 0, st: { dr: 0, vir: 0, pit: 0, bloc: 0, uz: 0, start: 0 } }));
  eu = C.find(c => c.eu); t = 0; pornit = false; gata = false; pozVeche = 2; setRitm('normal');
}
const ord = () => C.slice().sort((a, b) => (a.fin !== null && b.fin !== null) ? a.fin - b.fin : (b.fin !== null) - (a.fin !== null) || b.s - a.s);
function treci(f, l) { f.trece = l; f.tT = 2.2; f.pr = 0; l.pr = 0; const p = l.latC >= 0 ? -1 : 1; f.latF = 4.6 * p; f.latFT = 1.8; l.latF = -3.6 * p; l.latFT = 1.8; }
// ---------- simularea ----------
function pas(dt) {
  t += dt;
  const o = C.slice().sort((a, b) => b.s - a.s);
  for (let k = 0; k < o.length; k++) {
    const c = o[k];
    if (c.fin !== null) { c.v = Math.max(18, c.v - 6 * dt); c.s += c.v * dt; continue; }
    if (c.s < 0) c.st.start += dt;
    if (c.pit > 0) { c.pit -= dt; c.st.pit += dt; c.v = 0; c.latC += (17 - c.latC) * Math.min(1, dt * 4); if (c.pit <= 0) { c.tyre = 1; c.v = 14; } continue; }
    const din = k > 0 ? o[k - 1] : null, spate = k < o.length - 1 ? o[k + 1] : null, gap = din && din.pit <= 0 ? din.s - c.s : 1e9, gs = spate ? c.s - spate.s : 1e9;
    const dr = DREAPTA(c.s);
    if (!c.eu) {
      const ultim = c.s > (TURURI - 1) * L;
      c.ritm = c.tyre < .3 && !ultim ? 'usor' : (gap < 30 || gs < 16) && c.tyre > .4 ? (Math.random() < c.ag ? 'atac' : 'normal') : 'normal';
      if (c.nT <= 0 && c.nitro > 0 && dr && t > 10 && (gap < 22 || gs < 14) && Math.random() < dt * .6) { c.nitro--; c.nT = NITRO; }
      if (!c.cere && c.tyre < .22 && !ultim) c.cere = true;
    }
    const i = idx(c.s), [pf, uz] = RITM[c.ritm], tf = .9 + .1 * c.tyre;
    const pot = c.prof[i] * pf * tf * (dr && c.nT > 0 ? 1.09 : 1) * (dr && gap < 30 ? 1.03 : 1);
    c.v += pot > c.v ? Math.min(pot - c.v, 7.5 * c.pow * (c.nT > 0 ? 1.5 : 1) * dt) : Math.max(pot - c.v, -ABR * 1.3 * dt);
    // regula: pe dreaptă câștigă nitro; în viraje câștigă Atacul
    if (din && gap < 16 && din.fin === null) {
      const fr = c.prof[idx(c.s + 40)] < c.v * .8, dn = din.nT > 0 && DREAPTA(din.s);
      c.pr += Math.max(0, pot / Math.max(din.v, 1) - 1) * dt * 6;
      if (dr) c.pr += ((c.nT > 0 ? 2.2 : 0) - (dn ? 2.2 : 0)) * dt;
      if (fr) c.pr += ((c.ritm === 'atac' ? 1 : 0) - (din.ritm === 'atac' ? .9 : 0) + (c.tyre - din.tyre) * 1.5) * dt;
      c.pr = Math.max(0, c.pr);
      if (c.pr > 1 && c.trece !== din && ((dr && c.prof[idx(c.s + 70)] > c.v * .9) || (fr && c.ritm === 'atac'))) treci(c, din);
    } else c.pr = Math.max(0, c.pr - dt);
    let bloc = false;
    if (din && c.trece !== din && gap < PAS && din.pit <= 0) { if (pot > din.v * 1.01) bloc = true; c.v = Math.min(c.v, din.v); c.s = Math.min(c.s, din.s - PAS); }
    let lt = (c.i % 3 - 1) * 1.4;
    if (c.latFT > 0) lt = c.latF; else if (din && gap < 18) lt = din.latC >= 0 ? -4 : 4;
    c.latC += (lt - c.latC) * Math.min(1, dt * 3);
    const s1 = c.s; c.s += c.v * dt;
    if (c.s > 0) { if (dr) c.st.dr += dt; else c.st.vir += dt; if (bloc) c.st.bloc += dt * Math.max(0, 1 - c.v / pot); c.st.uz += dt * (1 - tf); }
    c.tyre = Math.max(0, c.tyre - UZ * uz * dt * (c.v / 50));
    c.nT = Math.max(0, c.nT - dt); c.tT -= dt; if (c.tT <= 0) c.trece = null; c.latFT = Math.max(0, c.latFT - dt);
    if (Math.floor(c.s / L) > Math.floor(s1 / L) && c.s > 0) {
      c.tura = Math.floor(c.s / L);
      if (c.s >= TURURI * L) c.fin = t;
      else if (c.cere) { c.cere = false; c.pit = 3.2; }
    }
  }
}
// ---------- comenzile ----------
function setRitm(r) { if (eu) eu.ritm = r; document.querySelectorAll('#ct .rt').forEach(b => b.classList.toggle('on', b.dataset.r === r)); }
document.querySelectorAll('#ct .rt').forEach(b => b.addEventListener('click', () => setRitm(b.dataset.r)));
$('nb').addEventListener('click', () => { if (!pornit || eu.nT > 0 || eu.nitro <= 0 || !DREAPTA(eu.s)) return; eu.nitro--; eu.nT = NITRO; });
$('px').addEventListener('click', () => { if (pornit && eu.pit <= 0 && eu.fin === null && eu.tura < TURURI - 1 + (eu.s < (TURURI - 1) * L ? 1 : 0)) eu.cere = true; });
$('pxx').addEventListener('click', () => { eu.cere = false; });
$('hb').addEventListener('click', () => { harta = !harta; $('hb').classList.toggle('on', harta); });
const vg = (a, b) => Math.max(0, (a.s - b.s) / Math.max(b.v, 20));
const f1 = x => x.toFixed(1).replace('.', ',');
let popT = 0;
function hud(dt) {
  const o = ord(), k = o.indexOf(eu), din = k > 0 ? o[k - 1] : null, spate = o[k + 1], gap = din ? din.s - eu.s : 1e9, gs = spate ? eu.s - spate.s : 1e9;
  $('pp').textContent = 'P' + (k + 1);
  $('pf').innerHTML = din ? `<i style="background:${din.col}"></i>▲ ${din.sc} <span style="color:#cfd3da">+${f1(vg(din, eu))}</span>` : '<span style="color:#2ecc71">lider</span>';
  $('pb').innerHTML = spate ? `<i style="background:${spate.col}"></i>▼ ${spate.sc} <span style="color:${gs < 16 ? '#ed1b2f' : '#cfd3da'}">${f1(vg(eu, spate))}</span>` : '';
  $('turn').textContent = `${Math.min(TURURI, Math.max(1, eu.tura + 1))}/${TURURI}`;
  if (pornit && k + 1 !== pozVeche) { const d = pozVeche - (k + 1); $('pop').textContent = (d > 0 ? '+' : '−') + Math.abs(d); $('pop').style.color = d > 0 ? '#2ecc71' : '#ed1b2f'; $('pop').classList.add('on'); popT = 1.1; pozVeche = k + 1; }
  popT -= dt; if (popT <= 0) $('pop').classList.remove('on');
  const dr = DREAPTA(eu.s), activ = pornit && eu.fin === null && eu.pit <= 0;
  const nb = $('nb'); nb.classList.toggle('act', eu.nT > 0); nb.classList.toggle('off', eu.nT <= 0 && (eu.nitro <= 0 || !dr));
  nb.classList.toggle('puls', activ && dr && eu.nitro > 0 && eu.nT <= 0 && (gap < 28 || gs < 14));
  nb.querySelectorAll('.bt i').forEach((x, i) => x.classList.toggle('ok', i < eu.nitro));
  document.querySelector('#ct [data-r=atac]').classList.toggle('puls', activ && !dr && VIRAJ_APROAPE(eu.s) && (gap < 18 || gs < 14) && eu.ritm !== 'atac');
  $('vw').classList.toggle('nitro', eu.nT > 0);
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
const INEL_N = inel('#22d3ee'), INEL_R = inel('#ed1b2f');
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
let GM = [];
function scena() {
  GM.forEach(g => S.remove(g.grup));
  GM = C.map(c => {
    const grup = new THREE.Group(), j = jetonTex(c); j.desen('');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: j.tex, depthTest: false, transparent: true })); sp.renderOrder = 10 + (c.eu ? 5 : 0); sp.position.y = 5; grup.add(sp);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: flTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(-8, .3, 0); fl.visible = false; grup.add(fl);
    const rn = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_N, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })); rn.position.y = 5; rn.visible = false; rn.renderOrder = 20; grup.add(rn);
    const rr = new THREE.Sprite(new THREE.SpriteMaterial({ map: INEL_R, depthTest: false, transparent: true })); rr.position.y = 5; rr.visible = false; rr.renderOrder = 21; grup.add(rr);
    S.add(grup); return { grup, sp, fl, rn, rr, j, poz: '' };
  });
}
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
    const m = harta ? 3.2 : 1, z = (c.eu ? 12 : 9.5) * m; G.sp.scale.set(z, z, 1);
    const n = c.nT > 0 && DREAPTA(c.s); G.fl.visible = n && !harta; G.rn.visible = n; if (n) { G.fl.scale.x = .8 + Math.random() * .5; G.rn.scale.set(z * 1.25, z * 1.25, 1); }
    G.rr.visible = c.eu && pericol; if (G.rr.visible) { const q = z * (1.2 + .12 * Math.sin(tz * 10)); G.rr.scale.set(q, q, 1); }
  });
  if (harta) { S.fog.far = 9000; CAM.up.set(-1, 0, 0); CAM.position.set((x0 + x1) / 2, HH, (y0 + y1) / 2); CAM.lookAt((x0 + x1) / 2, 0, (y0 + y1) / 2); }
  else {
    S.fog.far = 620; CAM.up.set(0, 1, 0);
    const f = GM[eu.i].grup.position;
    if (!camOk) { tinta.copy(f); camOk = true; } else tinta.lerp(f, 1 - Math.exp(-dt * 12));
    CAM.position.set(tinta.x + 85, 135, tinta.z + 112); CAM.lookAt(tinta.x, 0, tinta.z);
  }
  R.render(S, CAM);
}
// ---------- grila și finalul ----------
const tok = c => `<img src="${FOTO[c.f]}" alt="" style="border:3px solid ${c.col}">`;
const pct = x => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
const bara = (d, col) => `<div class="br"><i style="left:50%;width:${Math.min(50, Math.abs(d) * 600)}%;${d < 0 ? 'transform:translateX(-100%);' : ''}background:${col}"></i><i style="left:50%;width:1px;background:#6b6f78"></i></div>`;
function ecranStart() {
  const rivali = C.filter(c => !c.eu);
  $('ov').innerHTML = `<p style="margin:0;color:#9aa0a9;font:700 11px Archivo;letter-spacing:.14em;text-transform:uppercase">Cursa · 3 tururi · pleci P2</p>
    <p class="d" style="font-size:30px">Adversarii față de M3</p>
    <div><div class="gr" style="color:#9aa0a9;font-size:10px;border:0"><span></span><span></span><span>drepte</span><span>viraje</span></div>
    ${rivali.map(c => { const dp = c.pow - eu.pow, dg = c.grip - eu.grip; return `<div class="gr">${tok(c)}<span><b>${c.n}</b><br><span style="color:#9aa0a9">${c.m}</span></span><span>${bara(dp, dp > 0 ? '#ed1b2f' : '#2ecc71')}<small style="color:${dp > 0 ? '#ed1b2f' : '#2ecc71'}">${pct(dp)}</small></span><span>${bara(dg, dg > 0 ? '#ed1b2f' : '#2ecc71')}<small style="color:${dg > 0 ? '#ed1b2f' : '#2ecc71'}">${pct(dg)}</small></span></div>`; }).join('')}</div>
    <p style="margin:0;color:#9aa0a9;font-size:11px">Roșu: el e mai rapid acolo. Verde: tu.</p>
    <div class="lg">
      <span style="color:#d81528">${document.querySelector('[data-r=atac] svg').outerHTML.replace('width="26" height="30"', 'width="18" height="20"')}</span><span>Atac: treci la frânare, dar roțile se duc repede.</span>
      <span style="color:#22d3ee">${document.querySelector('#nb svg').outerHTML.replace('width="22" height="30"', 'width="16" height="22"')}</span><span>Nitro, doar pe dreaptă: cine îl are acolo câștigă duelul. Pulsează când e momentul.</span>
      <span>${document.querySelector('#px svg').outerHTML.replace('width="58" height="58"', 'width="26" height="26"')}</span><span>Anvelopele. O atingere și intri la boxe la capătul turului (3 s, roți noi).</span>
      <span style="color:#ed1b2f;font:900 20px var(--display)">◯</span><span>Inel roșu pe tine: te ajunge cineva. Apără-te la fel: nitro pe dreaptă, Atac în viraj.</span>
    </div>
    <button type="button" class="go" id="go">Start</button>`;
  $('ov').style.display = 'flex'; $('go').onclick = () => { $('ov').style.display = 'none'; pornit = true; };
}
function final() {
  const o = ord(), p = o.indexOf(eu), ref = p === 0 ? o[1] : o[0], semn = p === 0 ? -1 : 1;
  const d = { dr: eu.st.dr - ref.st.dr, vir: eu.st.vir - ref.st.vir, pit: eu.st.pit - ref.st.pit, start: eu.st.start - ref.st.start };
  const rand = (lab, x, de) => Math.abs(x) < .05 ? '' : `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #1d1d23"><span>${lab}<br><small style="color:#9aa0a9">${de}</small></span><b style="color:${x > 0 ? '#ed1b2f' : '#2ecc71'};white-space:nowrap">${x > 0 ? 'pierzi ' : 'câștigi '}${f1(Math.abs(x))} s</b></div>`;
  const pierzi = x => x > 0, pw = Math.round(Math.abs(ref.pow - eu.pow) * 100);
  const motiv = {
    dr: pierzi(d.dr) ? (ref.pow > eu.pow + .005 ? `${ref.m} are motor cu ${pw}% mai mare` : eu.st.bloc > 1 ? 'ai stat blocat în spatele altora' : `${ref.n} a folosit nitro mai bine`) : (eu.pow > ref.pow + .005 ? 'M3 are motor mai mare' : 'nitro și aspirație folosite bine'),
    vir: pierzi(d.vir) ? (ref.grip > eu.grip + .005 ? `${ref.m} ține mai bine în viraje` : 'anvelope mai uzate sau ritm prea ușor') : (eu.grip > ref.grip + .005 ? 'M3 ține mai bine în viraje' : 'Atac la momentul bun, anvelope mai bune'),
    pit: pierzi(d.pit) ? `ai stat la boxe ${f1(eu.st.pit)} s${ref.st.pit > 0 ? '' : ', el n-a oprit'}` : `${ref.n} a stat la boxe ${f1(ref.st.pit)} s`,
    start: pierzi(d.start) ? 'ai plecat mai din spate' : 'ai plecat mai din față' };
  const linii = [['Pe drepte', d.dr, motiv.dr], ['În viraje', d.vir, motiv.vir], ['Boxe', d.pit, motiv.pit], ['Start', d.start, motiv.start]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(x => rand(...x)).join('');
  $('ov').innerHTML = `<p style="margin:0;color:#9aa0a9;font:700 11px Archivo;letter-spacing:.14em;text-transform:uppercase">Cursa · final</p>
    <div style="display:flex;align-items:center;gap:12px"><p class="d" style="font-size:64px">P${p + 1}</p><p style="margin:0;color:#cfd3da;line-height:1.4">${p === 0 ? `Ai câștigat cu ${f1(o[1].fin - eu.fin)} s.` : `La ${f1(eu.fin - o[0].fin)} s de ${o[0].n}.`}<br><small style="color:#9aa0a9">Blocat în spatele altora: ${f1(eu.st.bloc)} s</small></p></div>
    <p class="d" style="font-size:20px;margin-top:4px">${p === 0 ? `Unde l-ai bătut pe ${ref.n}` : `Unde ai pierdut față de ${ref.n}`}</p>
    <div>${linii || '<p style="color:#9aa0a9">La egalitate peste tot.</p>'}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${o.map((c, i) => `<span style="display:flex;align-items:center;gap:4px;${c.eu ? 'color:#ed1b2f;font-weight:700' : 'color:#9aa0a9'}">${i + 1}. <img src="${FOTO[c.f]}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:2px solid ${c.col}">${c.sc}</span>`).join('')}</div>
    <button type="button" class="go" id="go2">Încă o cursă</button>`;
  $('ov').style.display = 'flex'; $('go2').onclick = () => { nou(); scena(); ecranStart(); };
}
let last = performance.now(); const VIT = 2.2;
function cadru(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (pornit && !gata) { let r = dt * VIT; while (r > 0) { const h = Math.min(r, 1 / 60); pas(h); r -= h; } if (C.every(c => c.fin !== null)) { gata = true; pornit = false; final(); } }
  hud(dt); desen(dt);
  requestAnimationFrame(cadru);
}
nou(); scena(); ecranStart();
Object.values(IMG).forEach(im => im.addEventListener('load', () => GM.forEach(G => { G.poz = ''; })));
requestAnimationFrame(cadru);
})();
