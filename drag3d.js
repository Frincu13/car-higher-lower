// Startul în 3D: pista noaptea, mașinile și camera care le urmărește. Logica
// cursei rămâne în drag.js; de aici vine doar imaginea. drag.js spune unde e
// fiecare mașină (0 la start, 1 la finiș) și ce se întâmplă (lumini, plecare,
// schimbare, final), iar aici se desenează. Dacă telefonul nu poate desena 3D,
// window.Pista3D nu apare și jocul rămâne pe pista desenată în SVG.
//
// Mașinile sunt din „Low Poly Cars" de Cosmo (CC0), în modele/. Fiecare tip de
// mașină din joc primește modelul cel mai apropiat, iar caroseria se revopsește în
// culoarea jucătorului.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/addons/environments/RoomEnvironment.js';

const LUNG = 402;            // metri până la finiș
const LAT = 11.6;            // lățimea pistei
const BANDA = 2.8;           // mijlocul fiecărei benzi, față de axul pistei
const MASINA = 4.5;          // lungimea la care se aduce orice model
// Camera se uită spre +z, deci stânga ecranului e +x: jucătorul 0 (roșu, stânga)
// stă pe +x, jucătorul 1 (alb, dreapta) pe -x.
const PARTE = [1, -1];
const CULORI = [[237, 27, 47], [236, 236, 238]];
const LINISTIT = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- ce model primește fiecare mașină ----------
const HATCH = /\b(Golf|Polo|up!|Fabia|Ibiza|Leon|Clio|M[ée]gane|20[58]|106|Saxo|Corsa|Astra|Focus|Fiesta|Puma|Civic|i20|i30|Veloster|Yaris|MINI|Mini|Cooper|Abarth|500|Swift|DS3|C30|Delta|Impreza|Evolution|Lancer|Escort|Celica|147|Giulietta|Scirocco|Corrado|Kadett|Type R|GTI|GTi|RS ?3|A 45|A45|M135i|M140i|Integrale|Countryman|Sportback)\b/;
const MODELE = {
  hyper: ['lamb', 'fenyr'], super: ['italia', 'fenyr'], sport: ['ghini'], lux: ['coupe'],
  suv: ['armor'], teren: ['jeep'], pickup: ['armor'], muscle: ['kamaro'],
  clasica: ['mobil'], clasicaSport: ['italia'],
};
function modelPentru(c) {
  if (c.model) return c.model;          // pentru verificări: un model anume
  const K = window.Kinds;
  if (K && K.segOf(c) === 'van') return 'van';
  const t = window.Machete ? window.Machete.tip(c) : 'sport';
  if (t === 'hot') return HATCH.test(c.name) ? 'rally' : 'coupe';
  const l = MODELE[t] || ['ghini'];
  let h = 0;
  for (const ch of c.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return l[h % l.length];
}

function creeaza() {
  const canvas = document.getElementById('d-3d');
  const track = document.getElementById('d-track');
  const ecran = document.getElementById('screen-race');
  if (!canvas || !track) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const aniz = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const CER = new THREE.Color(0x0d0f16);
  scene.fog = new THREE.Fog(CER, 70, 300);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  scene.add(new THREE.HemisphereLight(0x8e9cc0, 0x141416, 0.7));
  const soare = new THREE.DirectionalLight(0xfff1dc, 1.7);
  soare.position.set(-8, 16, -12);
  scene.add(soare);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);

  // ---------- texturi desenate pe loc ----------
  function panza(w, h, deseneaza) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    deseneaza(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniz;
    return t;
  }

  const asfalt = panza(256, 256, (g, w, h) => {
    g.fillStyle = '#1c1d21'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 22 + Math.random() * 38;
      g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.4})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
    }
  });
  asfalt.wrapS = asfalt.wrapT = THREE.RepeatWrapping;
  asfalt.repeat.set(2, 110);

  const moale = panza(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });

  // cerul: noapte sus, o pâclă spre orizont, de la luminile orașului
  scene.background = panza(4, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#030306'); v.addColorStop(0.5, '#0a0b12'); v.addColorStop(0.62, '#161826'); v.addColorStop(1, '#0d0f16');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });

  // ---------- pista ----------
  const LUNG_PISTA = 580, Z0 = -40;          // de la 40 m în spatele startului
  const plan = (w, l, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  const transparent = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...o });

  // pământul de lângă pistă și pista
  plan(400, 900, new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 1 }), 0, -0.02, 250);
  plan(LAT, LUNG_PISTA, new THREE.MeshStandardMaterial({ map: asfalt, roughness: 0.82, metalness: 0 }), 0, 0, Z0 + LUNG_PISTA / 2);

  // urmele de cauciuc de la plecările de dinainte: două dungi pe bandă, care se
  // sting spre 150 m
  const cauciuc = panza(64, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = v;
    g.fillRect(10, 0, 8, h); g.fillRect(w - 18, 0, 8, h);
  });
  for (const p of [0, 1]) plan(2.3, 90, transparent({ map: cauciuc }), PARTE[p] * BANDA, 0.01, 43);

  // linia din mijloc, întreruptă: trece pe lângă tine și se simte viteza
  const punctat = panza(8, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 34); });
  punctat.wrapT = THREE.RepeatWrapping;
  punctat.repeat.set(1, LUNG_PISTA / 7);
  plan(0.16, LUNG_PISTA, transparent({ map: punctat, opacity: 0.6 }), 0, 0.015, Z0 + LUNG_PISTA / 2);
  // marginile, fiecare în culoarea benzii, cu o strălucire în jur
  for (const p of [0, 1]) {
    const col = new THREE.Color(`rgb(${CULORI[p].join(',')})`);
    const x = PARTE[p] * (LAT / 2 - 0.25);
    plan(0.2, LUNG_PISTA, new THREE.MeshBasicMaterial({ color: col }), x, 0.016, Z0 + LUNG_PISTA / 2);
    plan(1.1, LUNG_PISTA, transparent({ map: moale, color: col, opacity: 0.22, blending: THREE.AdditiveBlending }), x, 0.017, Z0 + LUNG_PISTA / 2);
  }
  // startul, reperele, finișul
  plan(LAT, 0.4, new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), 0, 0.02, 0);
  for (const m of [100, 201, 305]) plan(LAT, 0.18, transparent({ color: 0xffffff, opacity: 0.32 }), 0, 0.02, m);
  const carouri = panza(256, 32, (g) => {
    for (let r = 0; r < 2; r++) for (let k = 0; k < 16; k++) {
      g.fillStyle = (r + k) % 2 ? '#0b0b0d' : '#f4f4f4';
      g.fillRect(k * 16, r * 16, 16, 16);
    }
  });
  plan(LAT, 1.4, new THREE.MeshBasicMaterial({ map: carouri }), 0, 0.02, LUNG);

  // panourile cu distanța, pe ambele părți
  const panou = (text, rosu) => panza(256, 128, (g, w, h) => {
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, w, h);
    g.fillStyle = rosu ? '#ed1b2f' : '#f2f2f2'; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#fff'; g.font = '700 64px "Big Shoulders Display", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 - 6);
  });
  for (const m of [100, 201, 305, 402]) {
    const tex = panou(m === 402 ? '402 m' : `${m} m`, m === 402);
    for (const p of [0, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
      b.position.set(PARTE[p] * (LAT / 2 + 2.1), 2.4, m);
      b.rotation.y = Math.PI;           // fața spre cei care vin
      scene.add(b);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x3a3c42 }));
      st.position.set(PARTE[p] * (LAT / 2 + 2.1), 0.9, m + 0.05);
      scene.add(st);
    }
  }
  // poarta de la finiș, în carouri
  const poarta = new THREE.Group();
  const stalp = new THREE.BoxGeometry(0.35, 7, 0.35), gri = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.6 });
  for (const p of [0, 1]) { const s = new THREE.Mesh(stalp, gri); s.position.set(PARTE[p] * (LAT / 2 + 0.9), 3.5, 0); poarta.add(s); }
  const bTex = carouri.clone(); bTex.repeat.set(2, 1); bTex.wrapS = THREE.RepeatWrapping; bTex.needsUpdate = true;
  const bara = new THREE.Mesh(new THREE.BoxGeometry(LAT + 2.2, 1, 0.3), new THREE.MeshBasicMaterial({ map: bTex }));
  bara.position.set(0, 7, 0);
  poarta.add(bara);
  poarta.position.z = LUNG;
  scene.add(poarta);

  // parapetele, cu o bandă în culoarea benzii de lângă ele
  for (const p of [0, 1]) {
    const x = PARTE[p] * (LAT / 2 + 0.45);
    const zid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.85, LUNG_PISTA), new THREE.MeshStandardMaterial({ color: 0x5f626a, roughness: 0.9 }));
    zid.position.set(x, 0.425, Z0 + LUNG_PISTA / 2);
    scene.add(zid);
    const banda = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, LUNG_PISTA), new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${CULORI[p].join(',')})`) }));
    banda.position.set(x, 0.86, Z0 + LUNG_PISTA / 2);
    scene.add(banda);
  }

  // stâlpii de iluminat, cu lumina lor pe asfalt (pete moi, nu lumini adevărate:
  // arată la fel și nu costă nimic)
  const STALPI = [];
  for (let z = -30; z < 540; z += 32) for (const p of [0, 1]) STALPI.push([PARTE[p], z]);
  const nS = STALPI.length, mat4 = new THREE.Matrix4();
  const tije = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c31 }), nS);
  const capete = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff4dc }), nS);
  const pete = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 12),
    transparent({ map: moale, color: 0xffe6bf, opacity: 0.2, blending: THREE.AdditiveBlending }), nS);
  const culcat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  STALPI.forEach(([s, z], i) => {
    tije.setMatrixAt(i, mat4.makeTranslation(s * (LAT / 2 + 1.3), 4, z));
    capete.setMatrixAt(i, mat4.makeTranslation(s * (LAT / 2 + 0.6), 8, z));
    pete.setMatrixAt(i, mat4.makeTranslation(s * (LAT / 2 - 2.2), 0.018, z).multiply(culcat));
  });
  scene.add(tije, capete, pete);

  // în depărtare, tribunele: siluete întunecate, fiecare cu o bandă de lumină pe
  // acoperiș, pierdute în ceață
  const tribuna = new THREE.MeshLambertMaterial({ color: 0x0a0b0e });
  const neon = new THREE.MeshBasicMaterial({ color: 0x39405a });
  for (const p of [0, 1]) for (let z = 10; z < 520; z += 64) {
    const h = 4 + Math.random() * 3;
    const t = new THREE.Mesh(new THREE.BoxGeometry(7, h, 48), tribuna);
    t.position.set(PARTE[p] * (LAT / 2 + 16), h / 2, z);
    scene.add(t);
    const n = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.15, 48.2), neon);
    n.position.set(PARTE[p] * (LAT / 2 + 16), h, z);
    scene.add(n);
  }

  // ---------- mașinile ----------
  const loader = new GLTFLoader();
  const incarcate = new Map();
  function incarca(nume) {
    if (!incarcate.has(nume)) {
      incarcate.set(nume, loader.loadAsync(`modele/${nume}.glb`).then(g => g.scene).catch(() => null));
    }
    return incarcate.get(nume);
  }

  // Culoarea caroseriei unui model: pe materialul „metallic" al caroseriei, culoarea
  // din paletă care acoperă cea mai mare suprafață.
  // Culoarea vopselei din paletă, pentru fiecare model, scoasă din fișiere (suprafața
  // pe culori a caroseriei). La mobil griul acoperișului are aproape aceeași
  // suprafață ca vopseaua, deci ghicitul nu e de încredere; restul se calculează
  // doar pentru un model nou, care nu e aici.
  const VOPSEA = {
    armor: [66, 66, 66], coupe: [46, 46, 46], fenyr: [46, 46, 254], ghini: [46, 46, 46],
    italia: [255, 0, 0], jeep: [254, 154, 46], kamaro: [255, 191, 0], lamb: [223, 1, 1],
    mobil: [46, 100, 254], rally: [254, 100, 46], van: [138, 161, 109],
  };
  const chei = new Map(Object.entries(VOPSEA));
  function pixeli(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    return { c, g, d: g.getImageData(0, 0, c.width, c.height) };
  }
  const eRoata = o => { for (let x = o; x; x = x.parent) if (/wheel/i.test(x.name)) return true; return false; };
  function culoareCaroserie(nume, corp, img) {
    if (chei.has(nume)) return chei.get(nume);
    const { d } = pixeli(img), W = img.width, H = img.height;
    const sume = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const m of corp) {
      const g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
      if (!uv) continue;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i + 2 < n; i += 3) {
        const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
        const arie = b.sub(a).cross(c.sub(a)).length();
        const fr = v => v - Math.floor(v);
        const u = fr((uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3), v = fr((uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3);
        const o = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4;
        const k = (d.data[o] << 16) | (d.data[o + 1] << 8) | d.data[o + 2];
        sume.set(k, (sume.get(k) || 0) + arie);
      }
    }
    let best = 0, max = -1;
    for (const [k, s] of sume) if (s > max) { max = s; best = k; }
    const rgb = [(best >> 16) & 255, (best >> 8) & 255, best & 255];
    chei.set(nume, rgb);
    return rgb;
  }
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b + 1;
  function vopsea(img, cheie, rgb) {
    const { c, g, d } = pixeli(img), p = d.data, lk = lum(...cheie);
    for (let o = 0; o < p.length; o += 4) {
      const dr = p[o] - cheie[0], dg = p[o + 1] - cheie[1], db = p[o + 2] - cheie[2];
      if (dr * dr + dg * dg + db * db > 52 * 52) continue;
      const f = Math.min(1.25, lum(p[o], p[o + 1], p[o + 2]) / lk);
      p[o] = Math.min(255, rgb[0] * f); p[o + 1] = Math.min(255, rgb[1] * f); p[o + 2] = Math.min(255, rgb[2] * f);
    }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    return t;
  }

  // Umbra de sub mașină: o pată moale, fără calcule de umbre.
  const umbraMat = transparent({ map: moale, color: 0x000000, opacity: 0.75 });
  const fumMat = new THREE.SpriteMaterial({ map: moale, color: 0xb9bac0, transparent: true, depthWrite: false, opacity: 0 });
  const flamaMat = new THREE.SpriteMaterial({ map: moale, color: 0xff8a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  const masini = [0, 1].map(p => {
    const g = new THREE.Group();
    g.position.set(PARTE[p] * BANDA, 0, -MASINA / 2);
    const u = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.6), umbraMat);
    u.rotation.x = -Math.PI / 2; u.position.y = 0.025;
    g.add(u);
    const flama = new THREE.Sprite(flamaMat.clone());
    flama.visible = false;
    g.add(flama);
    scene.add(g);
    return { p, g, model: null, roti: [], raza: 0.33, spate: -MASINA / 2, z: -MASINA / 2, v: 0, f: 0, sosit: false, flama, flamaPana: 0, fumPana: 0 };
  });

  async function puneModel(m, car, idCursa) {
    const nume = modelPentru(car);
    const sursa = await incarca(nume);
    if (!sursa || idCursa !== cursaId) return;
    const obj = sursa.clone(true);
    // la aceeași lungime, cu roțile pe asfalt, centrat
    const box = new THREE.Box3().setFromObject(obj), sz = box.getSize(new THREE.Vector3());
    const lungime = Math.max(sz.x, sz.z), peZ = sz.z >= sz.x;
    const s = MASINA / lungime;
    const pivot = new THREE.Group();
    obj.scale.setScalar(s);
    const cen = box.getCenter(new THREE.Vector3());
    obj.position.set(-cen.x * s, -box.min.y * s, -cen.z * s);
    pivot.add(obj);
    if (!peZ) pivot.rotation.y = Math.PI / 2;
    // revopsirea: doar materialul „metallic" al caroseriei, nu și jantele
    const corp = [];
    obj.traverse(o => { if (o.isMesh && o.material && o.material.name === 'metallic' && !eRoata(o)) corp.push(o); });
    const img = corp[0] && corp[0].material.map && corp[0].material.map.image;
    if (img) {
      const cheie = culoareCaroserie(nume, corp, img);
      const tex = vopsea(img, cheie, CULORI[m.p]);
      const mat = corp[0].material.clone();
      mat.map = tex;
      mat.metalness = m.p === 1 ? 0.2 : 0.4;
      mat.roughness = 0.24;
      corp.forEach(o => { o.material = mat; });
    }
    m.roti = [];
    obj.traverse(o => { if (/wheel/i.test(o.name) && o.parent && !/wheel/i.test(o.parent.name)) m.roti.push(o); });
    if (m.roti[0]) {
      const rb = new THREE.Box3().setFromObject(m.roti[0]);
      m.raza = Math.max(0.2, rb.getSize(new THREE.Vector3()).y / 2);
    }
    if (m.model) m.g.remove(m.model);
    m.model = pivot;
    m.g.add(pivot);
    // flacăra la evacuare, în spatele mașinii
    m.flama.position.set(0, 0.42, -MASINA / 2 - 0.15);
  }

  // ---------- fum ----------
  const FUM = [];
  function fum(m, n) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(fumMat.clone());
      const lat = (Math.random() < 0.5 ? -1 : 1) * 0.85;
      s.position.set(m.g.position.x + lat, 0.35, m.g.position.z - MASINA * 0.32);
      s.scale.setScalar(0.8);
      scene.add(s);
      FUM.push({ s, v: new THREE.Vector3(lat * (0.6 + Math.random()), 0.5 + Math.random() * 0.9, -1.5 - Math.random() * 2.5), t: 0, viata: 1.1 + Math.random() * 0.7 });
    }
  }
  function curataFum() { FUM.forEach(f => scene.remove(f.s)); FUM.length = 0; }

  // ---------- camera ----------
  let faza = 'arm', tStart = performance.now(), tremur = 0, castigator = -1;
  const camPos = new THREE.Vector3(0, 3, -12), camTinta = new THREE.Vector3(0, 1, 10);
  const vrea = new THREE.Vector3(), vreaTinta = new THREE.Vector3();

  function camera3d(dt, t) {
    const [a, b] = masini;
    const zMin = Math.min(a.g.position.z, b.g.position.z), zMax = Math.max(a.g.position.z, b.g.position.z);
    const gap = zMax - zMin, v = Math.max(a.v, b.v);
    if (faza === 'arm' && !LINISTIT) {
      // cât așteaptă jucătorii, camera se plimbă încet pe lângă mașini
      const u = (t - tStart) / 1000, th = Math.sin(u * 0.32) * 1.05;
      vrea.set(Math.sin(th) * 10.5, 2.4 + Math.sin(u * 0.5) * 0.4, -MASINA / 2 - Math.cos(th) * 10.5);
      vreaTinta.set(0, 0.9, -MASINA / 2 + 1.5);
    } else {
      // destul de departe cât să încapă ambele benzi pe lățimea ecranului
      const tanH = Math.tan(THREE.MathUtils.degToRad(27.5)) * camera.aspect;
      const dist = Math.max(8, (BANDA + 1.6) / tanH);
      const g = Math.min(gap, 90);
      vrea.set(0, 3 + g * 0.09, zMin - MASINA / 2 - dist - g * 0.22);
      vreaTinta.set(0, 1, zMin + 12 + g * 0.75);
    }
    const k = 1 - Math.exp(-dt * (faza === 'arm' ? 2.2 : 4.5));
    // pe lungime camera ține pasul exact cu mașinile; restul se așază lin
    camPos.lerp(vrea, k);
    camTinta.lerp(vreaTinta, k);
    if (faza !== 'arm' && Math.abs(vrea.z - camPos.z) < 25) {
      camPos.z = vrea.z;
      camTinta.z = vreaTinta.z;
    }
    camera.position.copy(camPos);
    if (tremur > 0.001 && !LINISTIT) {
      camera.position.x += (Math.random() - 0.5) * tremur;
      camera.position.y += (Math.random() - 0.5) * tremur;
    }
    tremur *= Math.exp(-dt * 6);
    camera.lookAt(camTinta);
    const fov = 55 + Math.min(14, v * 0.17);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
  }

  // ---------- bucla ----------
  let ultim = 0, ruleaza = false, cursaId = 0;
  const activ = () => ecran.classList.contains('is-active') && track.classList.contains('is-3d') && !document.hidden;

  function marime() {
    const w = track.clientWidth, h = track.clientHeight;
    if (!w || !h) return;
    const c = renderer.domElement;
    if (c.width !== Math.round(w * renderer.getPixelRatio()) || c.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function cadru(t) {
    if (!activ()) { ruleaza = false; return; }
    const dt = Math.min(0.05, ultim ? (t - ultim) / 1000 : 0.016);
    ultim = t;
    marime();
    for (const m of masini) {
      // după linie mașina mai rulează, tot mai încet, ca să nu se oprească în zid
      if (m.sosit) {
        m.v *= Math.exp(-dt * 0.8);
        m.g.position.z = Math.min(LUNG + 110, m.g.position.z + m.v * dt);
      }
      const rot = (m.v * dt) / m.raza;
      for (const r of m.roti) r.rotation.x += rot;
      if (m.fumPana > t) fum(m, 1);
      m.flama.visible = m.flamaPana > t;
      if (m.flama.visible) { const s = 0.5 + Math.random() * 0.5; m.flama.scale.set(s, s, s); }
    }
    for (let i = FUM.length - 1; i >= 0; i--) {
      const f = FUM[i];
      f.t += dt;
      const k = f.t / f.viata;
      if (k >= 1) { scene.remove(f.s); FUM.splice(i, 1); continue; }
      f.s.position.addScaledVector(f.v, dt);
      f.v.multiplyScalar(Math.exp(-dt * 1.2));
      f.s.scale.setScalar(0.8 + k * 4.2);
      f.s.material.opacity = 0.5 * (1 - k) * Math.min(1, k * 8);
    }
    camera3d(dt, t);
    renderer.render(scene, camera);
    requestAnimationFrame(cadru);
  }
  function porneste() {
    if (ruleaza || !activ()) return;
    ruleaza = true;
    ultim = 0;
    requestAnimationFrame(cadru);
  }
  document.addEventListener('visibilitychange', porneste);

  // ---------- ce vede drag.js ----------
  return {
    ok: true,
    cursa(cars) {
      cursaId++;
      faza = 'arm';
      tStart = performance.now();
      castigator = -1;
      curataFum();
      masini.forEach((m, p) => {
        m.g.position.z = -MASINA / 2;
        m.v = 0; m.f = 0; m.tz = null; m.sosit = false; m.fumPana = 0; m.flamaPana = 0;
        if (m.model) { m.g.remove(m.model); m.model = null; }
        puneModel(m, cars[p], cursaId);
      });
      camPos.set(9, 2.6, -11);
      porneste();
    },
    pozitie(p, f, acum) {
      const m = masini[p];
      if (m.sosit) return;
      const z = f * LUNG - MASINA / 2;
      const t = acum || performance.now();
      if (m.tz != null && t > m.tz) {
        const v = (z - m.g.position.z) / ((t - m.tz) / 1000);
        m.v += (v - m.v) * 0.35;
      }
      m.tz = t;
      m.g.position.z = z;
      m.f = f;
      if (f >= 1) m.sosit = true;
    },
    faza(f) {
      if (f === 'lumini' || f === 'go') faza = 'cursa';
      else if (f === 'gata') faza = 'final';
      porneste();
    },
    fum(p) {
      const m = masini[p];
      m.fumPana = performance.now() + 650;
      fum(m, 10);
      tremur = 0.16;
    },
    flama(p) {
      masini[p].flamaPana = performance.now() + 150;
      tremur = Math.max(tremur, 0.05);
    },
    castiga(p) { castigator = p; },
    porneste,
  };
}

const pista = creeaza();
if (pista) {
  window.Pista3D = pista;
  document.dispatchEvent(new CustomEvent('pista3d'));
}
