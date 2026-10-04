// Startul: drag race pe sfert de milă, doi jucători unul lângă altul, pe același
// telefon. Fiecare cumpără pachete cu bugetul lui și le deschide la vedere, își
// așază mașinile pe runde pe ascuns, apoi rundele se joacă pe rând: sus e pista, jos
// fiecare are coloana lui cu un buton (Gata, Start când se sting luminile, apoi
// Schimbă la fiecare treaptă). Mașina dă timpul de bază, mâna îl împinge în sus sau
// în jos.
(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, wirePhotos, haptic, shuffle, thumbHTML } = window.Shared;
  const $ = id => document.getElementById(id);

  // ---------- mașinile ----------
  // Ținta: o cursă perfectă dă exact ce măsoară revistele (Car and Driver, Motor Trend,
  // MotorWeek, Road & Track) pentru mașina aceea. Formulele de mai jos sunt potrivite
  // pe media testelor instrumentate a 26 de mașini, de la Mazda MX-5 (14,6 s pe 1/4)
  // la Bugatti Chiron (9,4 s), plus 5 electrice; detaliile sunt în README.

  // O mașină electrică: datele nu spun mereu că e electrică (la Lotus Evija scrie doar
  // „AWD", la Mach-E sau Spectre nu scrie nimic, la Tesla Roadster scrie „1AT"), de
  // aici și lista de nume.
  const ELECTRICE = /\b(Evija|Mach-E|Rivian|Spectre|Tesla|Taycan|Nevera|Lucid|IONIQ|EV6|e-tron GT|Cyberster|HUMMER EV|Battista|EP9|i4|iX|I-Pace|Polestar|Enyaq|Macan Turbo Electric)\b/i;
  const electrica = c => /electric|kwh|induction|\b1\s*AT\b/i.test(c.engine || '') || ELECTRICE.test(c.name);

  // 0-100 din date: oficial unde există, altfel estimat. La câteva mașini estimarea era
  // departe de realitate (Taycan Turbo S: 4,0 s estimat, 2,8 s oficial și în teste),
  // așa că punem valoarea verificată: la electrice cea oficială, confirmată de teste;
  // la celelalte media testelor (0-60 mph cu rollout + 0,35 s, cât fac în medie
  // primul picior de pistă și ultimii 3 km/h).
  const ACC_VERIFICAT = {
    'Porsche Taycan Turbo S|2020': 2.8, 'Audi RS e-tron GT|2021': 3.3, 'MG Cyberster|2023': 3.2,
    'Lucid Air Sapphire|2023': 2.2, 'Rivian R1T|2022': 3.5, 'GMC HUMMER EV Pickup|2022': 3.6,
    'Toyota GR Supra|2020': 4.15, 'Ford Mustang GT|2018': 4.35, 'Ford Mustang GT|2024': 4.3,
    'Ford F-150 Raptor R|2023': 4.0, 'Audi RS 6 Avant|2021': 3.5, 'Lamborghini Huracán EVO|2020': 2.85,
    'Toyota GR86|2022': 6.4, 'Volkswagen Golf R|2014': 5.15, 'Cadillac Escalade-V|2023': 4.8,
  };
  const t100 = c => ACC_VERIFICAT[`${c.name.normalize('NFC')}|${c.years}`] ?? (c.accel != null ? c.accel : c.accelEst);
  const lbhp = c => (c.weight * 2.2046) / c.hp;
  const POOL = (window.CARS || []).filter(c => c.image && c.hp && c.weight && t100(c));

  // Timpul pe 1/4 de milă al unei curse perfecte. Pe benzină: din putere/greutate și
  // 0-100 (care aduce tracțiunea), potrivit prin cele mai mici pătrate: eroare medie
  // 0,31 s față de teste. Electricele pleacă mult mai tare și trag mai slab spre
  // final, deci la ele contează aproape numai 0-100: 0-60 în teste e cam 0-100
  // oficial minus 0,25 s, iar 1/4 vine din 0-60 ca la celelalte, plus 0,15 s.
  const baza = c => (electrica(c)
    ? (t100(c) + 5.424) / 0.784 + 0.15
    : 2.872 + 3.781 * Math.cbrt(lbhp(c)) + 0.367 * t100(c));
  // Pe un sfert de milă nu se ajunge de obicei în ultimele trepte: trepte minus două,
  // între trei și cinci schimbări. Cine nu are cutia în date primește patru. O
  // electrică n-are trepte: are trei Boost-uri, care se joacă la fel.
  function schimbari(c) {
    if (electrica(c)) return 3;
    const m = /(\d+)\s*(MT|AT|DCT|SMG|PDK|DSG|AMT|speed)/i.exec(c.engine || '');
    return m ? Math.max(3, Math.min(5, +m[1] - 2)) : 4;
  }

  // Profilul de viteză al fiecărei mașini, pe timpul unei curse perfecte (u de la 0 la
  // 1). Trece prin puncte reale: 60 mph la timpul din teste (în teste, 0-60 = 0,784 ×
  // 1/4 − 5,674, eroare medie 0,14 s; dar nu sub 2,3 s, cât lasă aderența unei mașini
  // pe benzină, sau 1,8 s la electrice), 30 mph la 40% din timpul acela (o mașină
  // trage mai tare la plecare decât spre 100), viteza la linie (formula lui Hale,
  // calibrată: 231 × ∛(cp/lb) mph, eroare medie 4 km/h; electricele ies cu 6% peste)
  // și distanța totală. Între puncte viteza crește în linie dreaptă, deci accelerația
  // scade pe parcurs, ca la o mașină reală. Viteza de mijloc se alege așa încât
  // suprafața de sub curbă să fie exact sfertul de milă.
  const SFERT = 402.336;
  function profil(c, T) {
    const ev = electrica(c);
    const t60 = Math.min(T * 0.55, Math.max(ev ? 1.8 : 2.3, 0.784 * (T - (ev ? 0.15 : 0)) - 5.674));
    const linie = (ev ? 245 : 231.2) * Math.cbrt(1 / lbhp(c)) * 0.44704;
    const u60 = t60 / T, v60 = (26.8224 * T) / SFERT;
    const U = [0, 0.4 * u60, u60, (u60 + 1) / 2, 1];
    const V = [0, 0.5 * v60, v60, 0, (linie * T) / SFERT];
    const arie = (i, j) => { let s = 0; for (let k = i; k < j; k++) s += ((U[k + 1] - U[k]) * (V[k] + V[k + 1])) / 2; return s; };
    // suprafața e liniară în viteza de mijloc V[3]: ce rămâne după primele două bucăți
    const rest = 1 - arie(0, 2);
    V[3] = (rest - ((U[3] - U[2]) * V[2]) / 2 - ((1 - U[3]) * V[4]) / 2) / ((1 - U[2]) / 2);
    // date care nu se potrivesc între ele: viteza de mijloc rămâne între vecinele ei,
    // iar viteza la linie se ajustează ca distanța să rămână exactă
    if (!(V[3] >= V[2] && V[3] <= V[4])) {
      V[3] = Math.min(Math.max(V[3], V[2]), V[4]);
      V[4] = (2 * (rest - ((U[3] - U[2]) * (V[2] + V[3])) / 2)) / (1 - U[3]) - V[3];
    }
    const G = [0];
    for (let i = 0; i < 4; i++) G.push(G[i] + ((U[i + 1] - U[i]) * (V[i] + V[i + 1])) / 2);
    return { U, V, G };
  }
  const seg = (pr, u) => { let i = 0; while (i < 3 && u >= pr.U[i + 1]) i++; return i; };
  const panta = (pr, i) => (pr.V[i + 1] - pr.V[i]) / (pr.U[i + 1] - pr.U[i]);
  // partea din distanță parcursă la u
  function poz(pr, u) {
    const i = seg(pr, u), d = u - pr.U[i];
    return Math.min(1, pr.G[i] + pr.V[i] * d + (panta(pr, i) * d * d) / 2);
  }
  // viteza la u, ca parte din distanță pe unitatea de timp a cursei
  const vit = (pr, u) => { const i = seg(pr, u); return pr.V[i] + panta(pr, i) * (u - pr.U[i]); };
  // u la care s-a parcurs partea x din distanță
  function inv(pr, x) {
    let i = 0;
    while (i < 3 && x >= pr.G[i + 1]) i++;
    const r = x - pr.G[i], s = panta(pr, i), v = pr.V[i];
    const d = Math.abs(s) < 1e-9 ? r / v : (-v + Math.sqrt(Math.max(0, v * v + 2 * s * r))) / s;
    return Math.min(1, pr.U[i] + d);
  }

  // ---------- cât valorează mâna ----------
  // Fiecare schimbare primește o notă, iar nota dă ritmul treptei care urmează: totul
  // perfect înseamnă exact timpii din teste, totul ok ×1,14, totul prost ×1,5, iar
  // o schimbare în roșul de după verde (târziu, ~) ×1,3.
  // Raportul de 1,5 dintre perfect și prost e cel cerut: o mașină de 15 s condusă
  // perfect egalează una de 10 s condusă prost, dar un Chiron condus oricât de prost
  // rămâne în fața celei mai lente mașini condusă perfect.
  const RITM = { '+': 1, '0': 1 / 0.88, '-': 1.5, '~': 1.3 };
  // Acul pornește fiecare treaptă de jos (R0) și urcă spre capăt. Verdele e centrat pe
  // 0,915, ok e de la 0,80 până la verde, sub 0,80 e prea devreme, după verde e roșul
  // (târziu), iar la 1 e limitatorul.
  const R0 = 0.55, RTINTA = 0.915, OK_DE_LA = 0.80;
  // O mașină rapidă e mai greu de condus perfect, deci tragerea bună din pachet nu mai
  // câștigă singură. Mai ales prin ac: la una de 14,5 s și peste urcă liniar, la un
  // Chiron urcă tot mai iute, ca o turație care explodează, și trece prin verde de
  // 1,8 ori mai repede (acul e r = R0 + (RTINTA - R0) · (t / D)^p, cu p de la 1 la
  // 1,8; ajunge în mijlocul verdelui tot la D, doar că în viteză). Verdele se
  // îngustează și el, cât să se vadă diferența: de la 0,08 la 0,055. În simulări,
  // un jucător obișnuit pierde cam 0,6 s cu o legendară, 0,35 s cu o exotică și
  // aproape nimic cu una comună.
  const VERDE_LAT = [0.055, 0.08], ACCEL_MAX = 1.8, RAPID_T = [9.5, 14.5];
  const rapiditate = T => 1 - Math.min(1, Math.max(0, (T - RAPID_T[0]) / (RAPID_T[1] - RAPID_T[0])));
  function verde(T) {
    const l = VERDE_LAT[1] - (VERDE_LAT[1] - VERDE_LAT[0]) * rapiditate(T);
    return [RTINTA - l / 2, RTINTA + l / 2];
  }
  const accel = T => 1 + (ACCEL_MAX - 1) * rapiditate(T);
  // Pe limitator mașina aproape nu mai trage, iar după o jumătate de secundă cutia
  // schimbă singură, cu nota cea proastă, ca nimeni să nu rămână blocat.
  const RITM_LIMITATOR = 1.6 / 0.88, LIMITATOR_MAX = 450;
  // Plecarea: un timp de reacție bun la telefon e sub 0,22 s.
  const notaReactie = ms => (ms < 220 ? '+' : ms < 330 ? '0' : '-');
  const PLECARE_MAX = 2000;            // cine n-a atins în 2 s pleacă oricum, prost

  // Reperele bonului de la final, ca la pistele adevărate: 60, 330 și 1000 de
  // picioare, o optime și un sfert de milă. Fiecare mașină ajunge la ele la un u
  // anume, din profilul ei. Viteza, în m/s, vine tot din profil.
  const PUNCTE = [18.288, 100.584, 201.168, 304.8, SFERT];
  const vitezaLa = (c, u, ritm) => (SFERT * vit(c.pr, u)) / (c.T * ritm);
  // 0-100 se măsoară de pe loc, iar cronometrul de pe pistă pornește abia după primul
  // picior (rollout): pe bon, 0-100 primește înapoi timpul acelui picior. 0,2 s e cât
  // dă, în medie, diferența dintre 0-60 din testele americane și 0-100 oficial.
  const ROLLOUT = 200;

  function nota(r, limitator, V) {
    if (limitator) return '-';
    if (r >= V[0] && r <= V[1]) return '+';
    if (r > V[1]) return '~';
    return r >= OK_DE_LA ? '0' : '-';
  }

  // Treptele: prima scurtă, apoi tot mai lungi, ca la o cutie reală. Durata unei
  // trepte e timpul în care acul ajunge în mijlocul verdelui la un joc normal. O
  // mașină rapidă are trepte mai scurte, deci acul trece mai iute prin verde: cu
  // ea nimerești mai greu; în plus, verdele ei e mai îngust (vezi verde()).
  function pregateste(c) {
    const T = baza(c), S = schimbari(c), G = S + 1, pr = profil(c, T);
    const w = Array.from({ length: G }, (_, k) => 1 + 0.35 * k);
    const s = w.reduce((a, b) => a + b, 0);
    return { car: c, T, G, ev: electrica(c), pr, V: verde(T), P: accel(T), PR: PUNCTE.map(m => inv(pr, m / SFERT)), D: w.map(x => (x / s) * T * 1000) };
  }

  function pilot(p, plan) {
    return {
      p, ...plan, faza: 'arm', gear: 0, r: R0, tg: 0, ritm: 1, u: 0, t: 0, lim: null,
      note: [], start: null, reactie: null, fin: null, fals: false,
      rep: 0, repere: [], vit: [], t100: null,
    };
  }

  // Simularea merge pe timpul real, în pași mici, până la o clipă dată. Atingerile
  // se evaluează la ora exactă a evenimentului, nu la cadrul următor, deci nimeni nu
  // e dezavantajat de un telefon care desenează mai rar.
  function avanseaza(c, acum) {
    if (c.start == null || c.fin != null) return;
    while (c.t < acum && c.fin == null) {
      const dt = Math.min(4, acum - c.t);
      const ultima = c.gear >= c.G - 1;
      // În ultima treaptă acul urcă mai încet și nu atinge limitatorul: acolo se
      // ajunge la linie, nu se mai schimbă.
      const durata = c.D[c.gear] * (ultima ? 1.5 : 1);
      if (c.r < 1) {
        c.tg += dt;
        c.r = Math.min(ultima ? 0.985 : 1, R0 + (RTINTA - R0) * Math.pow(c.tg / durata, c.P));
        if (c.r >= 1 && c.lim == null) c.lim = c.t + dt;
      }
      const ritm = c.lim != null ? RITM_LIMITATOR : c.ritm;
      const du = dt / (c.T * 1000 * ritm);
      // pentru bon: ora fiecărui reper, viteza în dreptul lui și momentul 0-100 km/h
      const u1 = Math.min(1, c.u + du);
      while (c.rep < c.PR.length && u1 >= c.PR[c.rep]) {
        c.repere.push(c.t + (dt * (c.PR[c.rep] - c.u)) / du);
        c.vit.push(vitezaLa(c, c.PR[c.rep], ritm));
        c.rep++;
      }
      if (c.t100 == null && vitezaLa(c, u1, ritm) >= 100 / 3.6) c.t100 = c.t + dt;
      if (c.u + du >= 1) { c.fin = c.t + (dt * (1 - c.u)) / du; c.u = 1; break; }
      c.u += du;
      c.t += dt;
      if (c.lim != null && c.t - c.lim > LIMITATOR_MAX) schimba(c, c.t, true);
    }
  }

  function schimba(c, la, fortat = false) {
    if (c.gear >= c.G - 1 || c.fin != null) return;
    avanseaza(c, la);
    if (c.fin != null) return;
    const n = nota(c.r, fortat || c.lim != null, c.V);
    c.motiv = fortat || c.lim != null ? 'Limitator' : n === '+' ? 'Perfect' : n === '0' ? 'Bine' : n === '~' ? 'Târziu' : 'Devreme';
    c.note.push(n);
    c.ritm = RITM[n];
    c.gear++;
    c.r = R0;
    c.tg = 0;
    c.lim = null;
    haptic(n === '+' ? 'success' : n === '-' || n === '~' ? 'error' : 'tick');
    puneNota(c, n);
  }

  function pleaca(c, la) {
    c.reactie = Math.max(0, la - cursa.verde);
    const n = notaReactie(c.reactie);
    c.note.push(n);
    c.ritm = RITM[n];
    c.start = la;
    c.t = la;
    c.faza = 'run';
    haptic(n === '+' ? 'success' : 'tick');
    puneNota(c, n);
  }

  // ---------- meciul ----------
  // Un meci: fiecare primește un buget, cumpără pe rând câte un pachet pentru fiecare
  // rundă și îl deschide la vedere, își așază apoi mașinile pe runde pe ascuns, iar
  // rundele se joacă una după alta. Câștigă cine ia mai multe runde; la egalitate,
  // cine a rămas cu mai mulți bani.
  const meci = {
    nume: store.get('drg_names', ['', '']), runde: store.get('drg_runde', 3),
    scor: [0, 0], curse: [], j: [], rand: 0, runda: 0, aseaza: 0, deschise: 0,
  };
  let cursa = null;
  const nume = p => (meci.nume[p] || '').trim() || `Jucător ${p + 1}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // ---------- pachetele ----------
  // Ca la cutiile din CS: fiecare pachet are șansele lui pe rarități, iar raritatea
  // vine din cât de rapidă e mașina în realitate, adică din timpul ei pe 1/4.
  const RARITATI = ['Comună', 'Rară', 'Epică', 'Exotică', 'Legendară'];
  // intervalul de timp pe 1/4 al fiecărei rarități, pentru lista din „Ce conține"
  const INTERVALE = ['peste 13,6 s', '12,3-13,6 s', '11,2-12,3 s', '10-11,2 s', 'sub 10 s'];
  const raritate = T => (T > 13.6 ? 0 : T > 12.3 ? 1 : T > 11.2 ? 2 : T > 10 ? 3 : 4);
  // Pe fața fiecărei lăzi, o mașină care o reprezintă, din pozele pe care le avem
  // deja, în culoarea pachetului: Golf GTI argintiu, M3 albastru, Huracán roz, P1 auriu.
  const PACHETE = [
    { id: 'strada', nume: 'Stradă', pret: 1, sanse: [55, 35, 10, 0, 0], fata: ['Volkswagen Golf GTI', '1983'] },
    { id: 'sport', nume: 'Sport', pret: 2, sanse: [20, 40, 30, 9, 1], fata: ['BMW M3', '1997'] },
    { id: 'super', nume: 'Supercar', pret: 4, sanse: [0, 15, 40, 35, 10], fata: ['Lamborghini Huracán LP 610-4', '2014'] },
    { id: 'hyper', nume: 'Hypercar', pret: 7, sanse: [0, 0, 25, 45, 30], fata: ['McLaren P1', '2013'] },
  ];
  PACHETE.forEach(pk => {
    pk.car = (window.CARS || []).find(c => c.name.normalize('NFC') === pk.fata[0].normalize('NFC') && String(c.years) === pk.fata[1]);
  });
  // Bugetul: 3 milioane pe rundă (9 la un meci de trei runde), dar cel puțin 8, ca
  // și la 1-2 runde să se poată lua un Hypercar (la două: Hypercar și Stradă).
  const BUGET_RUNDA = 3, BUGET_MINIM = 8;
  const buget = n => Math.max(BUGET_RUNDA * n, BUGET_MINIM);
  const TIMP = new Map(POOL.map(c => [c, baza(c)]));
  const rar = c => raritate(TIMP.get(c));
  const PE_RARITATE = RARITATI.map((_, r) => POOL.filter(c => rar(c) === r));

  // Întâi raritatea, după șansele pachetului, apoi o mașină din raritatea aceea. Un
  // jucător nu prinde de două ori aceeași mașină.
  function trage(pachet, exclus = []) {
    let x = Math.random() * 100, r = 0;
    while (r < 4 && x >= pachet.sanse[r]) { x -= pachet.sanse[r]; r++; }
    while (!pachet.sanse[r]) r--;
    const lista = PE_RARITATE[r].filter(c => !exclus.includes(c));
    return lista[Math.floor(Math.random() * lista.length)] || PE_RARITATE[r][0];
  }

  const mil = m => `${m} mil.`;
  // Poza mică (330 px, cam 35 KB în loc de 200) pentru cărți și liste, peste silueta
  // colorată după marcă: cât se încarcă, sau dacă nu vine, cartea nu rămâne goală.
  const poza = c => thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
  const fara = c => poza(c).replace(/<img[^>]*>/, '');
  const timpCarte = c => `${fmt(TIMP.get(c), 1)} s`;
  // Un pachet se poate lua doar dacă după el mai rămân bani pentru pachetele de Stradă
  // care mai trebuie luate: nimeni nu rămâne fără mașină pentru o rundă.
  function poateLua(j, pk) {
    const ramase = meci.runde - j.garaj.length;
    return ramase > 0 && j.bani - pk.pret >= (ramase - 1) * PACHETE[0].pret;
  }

  function meciNou() {
    oprestePeTot();
    cursa = null;
    meci.scor = [0, 0];
    meci.curse = [];
    meci.runda = 0;
    meci.rand = 0;
    meci.deschise = 0;
    meci.j = [0, 1].map(() => ({ bani: buget(meci.runde), garaj: [], ordine: [] }));
    magazin();
  }

  // ---------- magazinul ----------
  function panouJucator(q) {
    const j = meci.j[q], ramase = meci.runde - j.garaj.length;
    return `
      <div class="drg-juc-sus">
        <span class="drg-juc-n p${q}">${esc(nume(q))}</span>
        <b class="drg-juc-b">${mil(j.bani)}</b>
      </div>
      <span class="drg-juc-r">${ramase ? `${ramase} ${ramase === 1 ? 'pachet' : 'pachete'} de luat` : 'Garaj complet'}</span>
      <ul class="drg-garaj">${j.garaj.map(c => `<li class="rar-${rar(c)}"><span class="drg-g-f">${poza(c)}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></li>`).join('')}</ul>`;
  }

  function cardPachet(pk, ok) {
    const segm = pk.sanse.map((s, r) => (s ? `<i class="rar-${r}" style="flex:${s}"></i>` : '')).join('');
    const leg = pk.sanse.map((s, r) => (s ? `<span class="rar-${r}">${s}%</span>` : '')).join('');
    const img = pk.car ? `<img src="${esc(pk.car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" referrerpolicy="no-referrer">` : '';
    return `<div class="drg-pk-w"><button class="drg-pk pk-${pk.id}" type="button" data-pk="${pk.id}"${ok ? '' : ' disabled'} aria-label="${pk.nume}, ${mil(pk.pret)}">
      <span class="drg-lada" aria-hidden="true">
        <span class="drg-lada-foto">${img}</span>
        <span class="drg-lada-capac"><i class="drg-lada-maner"></i></span>
        <span class="drg-lada-et"><small>Pachet</small>${pk.nume}</span>
        <span class="drg-lada-pret">${mil(pk.pret)}</span>
        <i class="drg-lada-luciu"></i>
      </span>
      <span class="drg-pk-bar" aria-hidden="true">${segm}</span>
      <span class="drg-pk-s">${leg}</span>
    </button><button class="drg-pk-info" type="button" data-info="${pk.id}">Ce conține</button></div>`;
  }

  function magazin() {
    const p = meci.rand;
    [0, 1].forEach(q => {
      const el = $(`d-j${q}`);
      el.className = `drg-juc p${q}${q === p ? ' is-rand' : ''}`;
      el.innerHTML = panouJucator(q);
      wirePhotos(el);
    });
    $('d-rand').innerHTML = `<small>La rând</small><b class="p${p}">${esc(nume(p))}</b>`;
    $('d-pachete').innerHTML = PACHETE.map(pk => cardPachet(pk, poateLua(meci.j[p], pk))).join('');
    $('d-pk-credit').innerHTML = `<span>Fotografii:</span> ${PACHETE.filter(pk => pk.car).map(pk => `${esc(pk.car.name)} (${esc(pk.car.credit)}, ${esc(pk.car.license)})`).join(' · ')}`;
    $('d-cutie').hidden = true;
    show('screen-shop');
  }

  // ---------- ce conține un pachet ----------
  // Toate mașinile pe care le poate da pachetul, pe rarități, de la cea mai rapidă:
  // șansa, intervalul de timp și câte sunt. Pozele vin doar când ajungi la ele.
  let vazator = null;
  function continut(pk) {
    const card = c => `<div class="drg-cont-c rar-${rar(c)}"><span class="drg-cont-f">${poza(c).replace(' src="', ' data-src="')}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))} &middot; ${timpCarte(c)}</small></div>`;
    $('d-cont-t').innerHTML = `<small>Ce conține</small><span>${pk.nume}</span>`;
    $('d-cont-lista').innerHTML = pk.sanse.map((s, r) => (s ? `
      <section class="drg-cont-r rar-${r}">
        <h3><b>${RARITATI[r]}</b><span class="drg-cont-p">${s}%</span><small><span>${INTERVALE[r]}</span> pe 1/4 &middot; <span>${PE_RARITATE[r].length} mașini</span></small></h3>
        <div class="drg-cont-grid">${[...PE_RARITATE[r]].sort((a, b) => TIMP.get(a) - TIMP.get(b)).map(card).join('')}</div>
      </section>` : '')).join('');
    $('d-cont').hidden = false;
    $('d-cont-lista').scrollTop = 0;
    if (vazator) vazator.disconnect();
    const incarca = img => { img.src = img.dataset.src; img.removeAttribute('data-src'); wirePhotos(img.closest('.drg-cont-f')); };
    if (!('IntersectionObserver' in window)) { $('d-cont-lista').querySelectorAll('img[data-src]').forEach(incarca); return; }
    vazator = new IntersectionObserver(intrari => intrari.forEach(x => {
      if (!x.isIntersecting) return;
      vazator.unobserve(x.target);
      incarca(x.target);
    }), { root: $('d-cont-lista'), rootMargin: '300px 0px' });
    $('d-cont-lista').querySelectorAll('img[data-src]').forEach(img => vazator.observe(img));
  }

  // ---------- deschiderea: banda care se învârte ----------
  // Rezultatul se trage înainte; banda e doar spectacolul. Pe ea sunt mașini trase cu
  // aceleași șanse ca pachetul, iar cea câștigătoare stă pe poziția la care se
  // oprește banda, cu o mică abatere, ca oprirea să nu fie mereu fix la mijloc.
  const NR_CARTI = 46, CASTIG = 40;
  let cutie = null;
  const carte = (c, cuPoza) => `<div class="drg-carte rar-${rar(c)}"><span class="drg-carte-f">${cuPoza ? poza(c) : fara(c)}</span><span class="drg-carte-m">${esc(brandOf(c.name))}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></div>`;
  // Cărțile de la început trec prea repede ca să se vadă: doar ultimele, cele care
  // trec încet prin fața acului, își primesc poza (o duzină, nu 46).
  const cuPoza = i => i >= CASTIG - 9 && i <= CASTIG + 3;

  function deschide(pk) {
    const p = meci.rand, j = meci.j[p];
    if (cutie || !poateLua(j, pk)) return;
    j.bani -= pk.pret;
    const car = trage(pk, j.garaj);
    cutie = { p, car, gata: false, ceas: 0 };
    meci.deschise++;
    const lent = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // primele două deschideri cu tot spectacolul, apoi mai scurt, ca meciul să curgă
    const durata = !lent ? 700 : meci.deschise <= 2 ? 5600 : 3600;
    $('d-cutie-t').innerHTML = `<small class="p${p}">${esc(nume(p))}</small>${pk.nume}`;
    const banda = $('d-banda');
    banda.innerHTML = Array.from({ length: NR_CARTI }, (_, i) => carte(i === CASTIG ? car : trage(pk), cuPoza(i))).join('');
    wirePhotos(banda);
    banda.style.transition = 'none';
    banda.style.transform = 'translateX(0)';
    $('d-rev').hidden = true;
    $('d-sari').hidden = meci.deschise < 3;
    $('d-cutie').hidden = false;
    $('d-cutie').classList.remove('is-gata');
    haptic();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tinta = banda.children[CASTIG], fer = $('d-fereastra');
      const abatere = (Math.random() - 0.5) * tinta.offsetWidth * 0.7;
      const x = tinta.offsetLeft + tinta.offsetWidth / 2 - fer.clientWidth / 2 + abatere;
      cutie.x = x;
      banda.style.transition = `transform ${durata}ms cubic-bezier(.06, .62, .12, 1)`;
      banda.style.transform = `translateX(${-x}px)`;
      cutie.ceas = setTimeout(arata, durata + 120);
    }));
  }

  // Banda s-a oprit (sau s-a sărit peste ea): apare mașina.
  function arata() {
    if (!cutie || cutie.gata) return;
    clearTimeout(cutie.ceas);
    cutie.gata = true;
    const banda = $('d-banda');
    if (cutie.x != null) { banda.style.transition = 'none'; banda.style.transform = `translateX(${-cutie.x}px)`; }
    const c = cutie.car, r = rar(c);
    $('d-rev').className = `drg-rev rar-${r}`;
    $('d-rev').innerHTML = `
      <p class="drg-rev-r">${RARITATI[r]}</p>
      <div class="drg-rev-foto"><img class="art-photo" src="${esc(c.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <p class="drg-rev-n"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</p>
      <p class="drg-rev-t">${fmt(TIMP.get(c), 1)} s pe 1/4 milă</p>
      <p class="drg-rev-c">Foto: ${esc(c.credit)}, ${esc(c.license)}</p>
      <button class="btn btn-primary" type="button" id="d-rev-ok">Mai departe</button>`;
    wirePhotos($('d-rev'));
    $('d-rev').hidden = false;
    $('d-sari').hidden = true;
    $('d-cutie').classList.add('is-gata');
    haptic(r >= 3 ? 'success' : 'tick');
  }

  // Mașina intră în garaj; urmează celălalt, dacă mai are de luat.
  function inchideCutie() {
    if (!cutie || !cutie.gata) return;
    const { p, car } = cutie;
    meci.j[p].garaj.push(car);
    cutie = null;
    const plin = q => meci.j[q].garaj.length >= meci.runde;
    if (plin(0) && plin(1)) { $('d-cutie').hidden = true; incepeOrdinea(); return; }
    meci.rand = plin(1 - p) ? p : 1 - p;
    magazin();
  }

  // ---------- ordinea, pe ascuns ----------
  function incepeOrdinea() {
    if (meci.runde === 1) {
      meci.j.forEach(j => { j.ordine = [...j.garaj]; });
      rundaNoua();
      return;
    }
    ordinea(0);
  }

  // Întâi un ecran de pază: telefonul trece la cel care așază, celălalt nu se uită.
  const OCHI = '<svg class="drg-cover-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function ordinea(p) {
    meci.aseaza = p;
    meci.sel = 0;
    meci.j[p].ordine = Array(meci.runde).fill(null);
    $('d-cover').className = `drg-cover p${p}`;
    $('d-cover').innerHTML = `
      <div class="drg-cover-in">
        ${OCHI}
        <p class="drg-cover-e">Ordinea pe runde</p>
        <h2 class="drg-cover-n">${esc(nume(p))}</h2>
        <p class="drg-cover-s">${esc(nume(1 - p))} nu se uită.</p>
        <button class="btn btn-primary" type="button" id="d-cover-ok">Așază mașinile</button>
      </div>`;
    $('d-cover').hidden = false;
    $('d-line').hidden = true;
    show('screen-lineup');
  }

  // Fiecare rundă e un duel: mașina ta în stânga, cartea întoarsă a celuilalt în
  // dreapta. Atingi o rundă ca s-o alegi, apoi o mașină din garaj: intră acolo, iar
  // dacă era deja în altă rundă, cele două mașini își schimbă locurile.
  function randeazaOrdinea() {
    const p = meci.aseaza, j = meci.j[p], alt = meci.j[1 - p];
    const plin = j.ordine.every(Boolean);
    $('d-line').className = `drg-line p${p}`;
    $('d-line').innerHTML = `
      <div class="drg-line-cap"><span class="drg-line-n">${esc(nume(p))}</span><span class="drg-line-h">Ordinea pe runde</span></div>
      <ol class="drg-dueluri">${j.ordine.map((c, i) => `
        <li><button type="button" class="drg-duel${meci.sel === i ? ' is-sel' : ''}${c ? ` is-plin rar-${rar(c)}` : ''}" data-slot="${i}">
          <b class="drg-duel-r">${i + 1}</b>
          <span class="drg-duel-m">${c
            ? `<span class="drg-g-f">${poza(c)}</span><span class="drg-duel-t"><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></span>`
            : `<em>${meci.sel === i ? 'Alege o mașină' : 'Liber'}</em>`}</span>
          <span class="drg-duel-vs">vs</span>
          <span class="drg-duel-x p${1 - p}" aria-label="Mașina lui ${esc(nume(1 - p))}">?</span>
        </button></li>`).join('')}</ol>
      <p class="drg-line-t t-mele">Garajul tău</p>
      <div class="drg-mele">${j.garaj.map((c, i) => {
        const r = j.ordine.indexOf(c);
        return `<button type="button" class="drg-car-b rar-${rar(c)}${r >= 0 ? ' is-pus' : ''}" data-g="${i}"><span class="drg-cb-f">${poza(c)}</span>${r >= 0 ? `<i class="drg-cb-r">R${r + 1}</i>` : ''}<b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></button>`;
      }).join('')}</div>
      <p class="drg-line-t t-alt">Mașinile lui ${esc(nume(1 - p))}</p>
      <ul class="drg-garaj drg-garaj-alt">${alt.garaj.map(c => `<li class="rar-${rar(c)}"><span class="drg-g-f">${poza(c)}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></li>`).join('')}</ul>
      <div class="drg-line-gata"><button class="btn btn-primary" type="button" id="d-line-ok"${plin ? '' : ' disabled'}>Gata</button></div>`;
    wirePhotos($('d-line'));
  }

  // O mașină din garaj intră în runda aleasă; dacă era deja în alta, cele două își
  // schimbă locurile. Apoi alegerea trece la prima rundă liberă.
  function puneMasina(gi) {
    const j = meci.j[meci.aseaza], c = j.garaj[gi];
    const sel = meci.sel != null ? meci.sel : Math.max(0, j.ordine.indexOf(null));
    const unde = j.ordine.indexOf(c);
    if (unde >= 0) j.ordine[unde] = j.ordine[sel];
    j.ordine[sel] = c;
    const gol = j.ordine.indexOf(null);
    meci.sel = gol >= 0 ? gol : sel;
  }

  // ---------- rundele ----------
  function rundaNoua() {
    const r = meci.runda;
    meci.runda++;
    cursaNoua(meci.j.map(j => j.ordine[r]));
    dezvaluie();
  }

  // La începutul rundei, ambele mașini se întorc deodată, ca niște cărți.
  function dezvaluie() {
    const el = $('d-dezv');
    el.innerHTML = `<p class="drg-dz-t">Runda ${meci.runda} din ${meci.runde}</p>
      <div class="drg-dz-c">${cursa.piloti.map(c => `
        <div class="drg-dz-k rar-${rar(c.car)} p${c.p}">
          <span class="drg-dz-f">${poza(c.car)}</span>
          <span class="drg-dz-j">${esc(nume(c.p))}</span>
          <span class="drg-dz-r">${RARITATI[rar(c.car)]}</span>
          <b>${esc(modelOf(c.car.name) || c.car.name)}</b>
          <small>${timpCarte(c.car)}</small>
        </div>`).join('')}</div>`;
    wirePhotos(el);
    el.hidden = false;
    el.classList.remove('is-iese');
    cursa.ceasuri.push(setTimeout(ascundeDezv, 2600));
  }
  function ascundeDezv() {
    const el = $('d-dezv');
    if (el.hidden) return;
    el.classList.add('is-iese');
    setTimeout(() => { el.hidden = true; }, 260);
  }

  function cursaNoua(masini) {
    oprestePeTot();
    cursa = { faza: 'arm', piloti: masini.map((c, p) => pilot(p, pregateste(c))), verde: null, ceasuri: [], raf: 0, poateUrma: false };
    $('d-track').className = 'drg-track';
    luminiStinse();
    // Întâi ecranul, apoi pista: are nevoie de mărimea lui ca să se deseneze.
    show('screen-race');
    [0, 1].forEach(p => { randeazaJumatate(p); stare(p, 'arm'); });
    $('d-bon').hidden = true;
    $('d-next').hidden = true;
    document.querySelector('.drg-pads').classList.remove('is-final');
    tabela();
    $('d-nr').textContent = `Runda ${meci.runda}/${meci.runde}`;
    pista();
    cursa.piloti.forEach(c => deseneaza(c, 0));
  }

  function oprestePeTot() {
    if (!cursa) return;
    cursa.ceasuri.forEach(clearTimeout);
    cancelAnimationFrame(cursa.raf);
  }

  // ---------- luminile, ca în Formula 1 ----------
  // Cinci roșii se aprind una câte una, apoi, după o pauză pe care n-o poți ghici,
  // se sting toate deodată. Ora stingerii se ia la cadrul în care chiar dispar de
  // pe ecran, iar întârzierea afișajului e aceeași pentru amândoi.
  const becuri = () => [...$('d-lights').children];
  function luminiStinse() {
    becuri().forEach(b => b.classList.remove('on'));
    $('d-track').classList.remove('is-lit', 'is-go');
  }

  function lumini() {
    cursa.faza = 'lumini';
    [0, 1].forEach(p => stare(p, 'lumini'));
    becuri().forEach((b, i) => cursa.ceasuri.push(setTimeout(() => {
      b.classList.add('on');
      $('d-track').classList.add('is-lit');
      haptic();
    }, 600 + i * 850)));
    const tine = 600 + 4 * 850 + 500 + Math.random() * 2300;
    cursa.ceasuri.push(setTimeout(() => {
      if (cursa.faza !== 'lumini') return;
      luminiStinse();
      $('d-track').classList.add('is-go');
      requestAnimationFrame(t => {
        if (cursa.faza !== 'lumini') return;
        cursa.verde = t;
        cursa.faza = 'go';
        [0, 1].forEach(p => stare(p, 'go'));
        bucla();
      });
    }, tine));
  }

  // ---------- butoanele ----------
  // Fiecare are butonul lui, iar el își schimbă rostul pe parcurs: Gata, Start,
  // Schimbă, Mai departe. Două degete deodată sunt două evenimente separate, iar
  // ora e cea a evenimentului, nu a procesării.
  function atinge(p, la) {
    if (!cursa) return;
    const c = cursa.piloti[p];
    if (cursa.faza === 'arm') {
      if (c.faza !== 'arm') return;
      c.faza = 'gata';
      haptic();
      stare(p, 'ready');
      if (cursa.piloti.every(x => x.faza === 'gata')) lumini();
      return;
    }
    if (cursa.faza === 'lumini') { startFals(p); return; }
    if (cursa.faza === 'go') {
      if (c.fin != null) return;
      if (c.start == null) pleaca(c, la);
      else schimba(c, la);
      return;
    }
    if (cursa.faza === 'gata' && cursa.poateUrma) {
      if (meci.runda >= meci.runde) final(); else rundaNoua();
    }
  }

  // Ce scrie pe buton în fiecare moment. „Gata!" are semn, ca să nu se confunde cu
  // „Gata" de la celelalte jocuri, unde înseamnă „am terminat".
  const ETICHETE = {
    arm: 'Gata!', ready: 'Gata!', lumini: 'Start', go: 'Start', run: 'Schimbă',
    last: 'Ultima treaptă', next: 'Mai departe', rezultat: 'Rezultatul',
  };
  function stare(p, st) {
    const el = $(`d-half-${p}`);
    if (!el) return;
    el.dataset.st = st;
    const b = el.querySelector('.drg-btn');
    const eticheta = st === 'run' && cursa && cursa.piloti[p].ev ? 'Boost' : ETICHETE[st];
    if (eticheta) b.querySelector('span').textContent = eticheta;
    const inactiv = st === 'ready' || st === 'last' || st === 'done';
    b.setAttribute('aria-disabled', inactiv ? 'true' : 'false');
  }

  function startFals(p) {
    oprestePeTot();
    const c = cursa.piloti[p];
    c.fals = true;
    luminiStinse();
    haptic('error');
    $(`d-half-${p}`).classList.add('is-false');
    incheie(1 - p, null);
  }

  // ---------- bucla de desen ----------
  function bucla() {
    if (!cursa || cursa.faza !== 'go') return;
    // Următorul cadru se cere de la început: dacă un cadru se împiedică de ceva
    // neprevăzut, cursa merge mai departe în loc să înghețe. La final, incheie() îl
    // anulează.
    cursa.raf = requestAnimationFrame(bucla);
    const acum = performance.now();
    cursa.piloti.forEach(c => {
      if (c.start == null && acum - cursa.verde > PLECARE_MAX) pleaca(c, cursa.verde + PLECARE_MAX);
      avanseaza(c, acum);
      // Cine trece linia: flash pe linie, iar butonul lui se stinge.
      if (c.fin != null && !c.sosit) {
        c.sosit = true;
        clipa('fin-flash');
        stare(c.p, 'done');
      }
    });
    cursa.piloti.forEach(c => deseneaza(c, acum));
    if (cursa.piloti.every(c => c.fin != null)) {
      const [a, b] = cursa.piloti.map(c => c.fin - cursa.verde);
      incheie(a === b ? -1 : a < b ? 0 : 1, [a, b]);
    }
  }

  const pct = r => ((r - R0) / (1 - R0)) * 100;
  // Unde e mașina pe pistă, în procente, după profilul ei.
  const pozitie = c => poz(c.pr, c.u) * 100;

  function deseneaza(c, acum) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    el.querySelector('.drg-fill').style.width = `${pct(c.r)}%`;
    el.classList.toggle('in-verde', c.start != null && c.r >= c.V[0] && c.r <= c.V[1] && c.gear < c.G - 1);
    el.classList.toggle('in-rosu', c.start != null && c.r > c.V[1] && c.gear < c.G - 1);
    el.classList.toggle('pe-limita', c.lim != null);
    el.querySelector('.drg-gear span').textContent = c.gear + 1;
    const t = c.fin != null ? c.fin - cursa.verde : c.start != null ? acum - cursa.verde : 0;
    el.querySelector('.drg-time').textContent = c.start != null ? `${fmt(t / 1000, 2)} s` : '';
    auto(c.p, pozitie(c) / 100);
  }

  function puneNota(c, n) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    const prima = c.note.length === 1;
    const rau = n === '-' || n === '~';
    const eticheta = n === '+' ? '+' : rau ? '−' : '0';
    const titlu = prima ? `Plecare ${fmt(c.reactie / 1000, 2)} s` : `Schimbarea ${c.note.length - 1}`;
    el.querySelector('.drg-note').insertAdjacentHTML('beforeend',
      `<span class="drg-n n${n === '+' ? 'plus' : rau ? 'minus' : 'zero'}${prima ? ' is-start' : ''}" title="${esc(titlu)}">${eticheta}</span>`);
    const cls = n === '+' ? 'bun' : rau ? 'rau' : '';
    if (prima) {
      el.querySelector('.drg-rt').textContent = `reacție ${fmt(c.reactie / 1000, 2)} s`;
      fum(c.p);
      clipa('trepida');
      deasupra(c, `${fmt(c.reactie / 1000, 2)} s`, cls);
    } else {
      flama(c.p);
      deasupra(c, c.motiv, cls);
    }
    stare(c.p, c.gear >= c.G - 1 ? 'last' : 'run');
  }

  // ---------- bonul cursei ----------
  // Ca la pistele de drag adevărate: după cursă, timpii fiecăruia la fiecare reper.
  // Timpii sunt de la plecare, fără reacție, ca pe un bon real; totalul de jos e cel
  // cu reacție, adică cel care a decis cursa.
  const RANDURI = [['60 ft', 0], ['330 ft', 1], ['1/8 milă', 2, true], ['1000 ft', 3], ['1/4 milă', 4, true]];
  function bon(castigator) {
    const el = $('d-bon'), [a, b] = cursa.piloti;
    const t3 = ms => fmt(ms / 1000, 3);
    const cel = (c, html) => `<td class="p${c.p}${castigator === c.p ? ' is-win' : ''}">${html}</td>`;
    const rand = (eticheta, f) => `<tr><th>${eticheta}</th>${cel(a, f(a))}${cel(b, f(b))}</tr>`;
    let titlu, corp;
    const fals = cursa.piloti.find(c => c.fals);
    if (fals) {
      titlu = `${esc(nume(fals.p))} a plecat înainte`;
      corp = `<p class="drg-bon-fals">Start fals</p>`;
    } else {
      const dif = Math.abs(a.fin - b.fin) / 1000;
      titlu = castigator < 0 ? 'Egal' : `${esc(nume(castigator))} câștigă cu ${fmt(dif, 3)} s`;
      corp = `<table><thead><tr><th></th><th class="p0">${esc(nume(0))}</th><th class="p1">${esc(nume(1))}</th></tr></thead><tbody>`
        + rand('Reacție', c => t3(c.reactie))
        + rand('0-100 km/h', c => (c.t100 != null ? t3(c.t100 - c.start + ROLLOUT) : '–'))
        + RANDURI.map(([et, i, v]) => rand(et, c => `${t3(c.repere[i] - c.start)}${v ? ` <small>${Math.round(c.vit[i] * 3.6)} km/h</small>` : ''}`)).join('')
        + `</tbody><tfoot>${rand('Total', c => `${t3(c.fin - cursa.verde)} s`)}</tfoot></table>`;
    }
    el.innerHTML = `<p class="drg-bon-t"><span>Runda ${meci.runda}</span>${titlu}</p>${corp}`;
    el.hidden = false;
  }

  // ---------- sfârșitul cursei ----------
  function incheie(castigator, timpi) {
    cursa.faza = 'gata';
    cancelAnimationFrame(cursa.raf);
    if (castigator >= 0) meci.scor[castigator]++;
    meci.curse.push({
      masini: cursa.piloti.map(c => c.car.name),
      timpi: timpi ? timpi.map(x => x / 1000) : null,
      fals: cursa.piloti.findIndex(c => c.fals),
      castigator,
      // pentru statisticile de la finalul meciului
      date: cursa.piloti.map(c => ({
        rt: c.fals ? null : c.reactie,
        et: c.repere[4] != null ? c.repere[4] - c.start : null,
        linie: c.vit[4] != null ? c.vit[4] : null,
        perf: c.note.slice(1).filter(n => n === '+').length,
        sch: Math.max(0, c.note.length - 1),
      })),
    });
    const terminat = meci.runda >= meci.runde;
    tabela();
    if (castigator >= 0) $('d-track').classList.add(`castiga-${castigator}`);
    [0, 1].forEach(p => {
      $(`d-half-${p}`).classList.toggle('is-win', castigator === p);
      stare(p, 'done');
    });
    // bonul apare după o clipă, cât să se vadă săgețile trecând linia
    cursa.ceasuri.push(setTimeout(() => { if (cursa && cursa.faza === 'gata') bon(castigator); }, 450));
    // O clipă de pauză, ca o apăsare întârziată pe Schimbă să nu sară peste rezultat.
    cursa.ceasuri.push(setTimeout(() => {
      if (!cursa || cursa.faza !== 'gata') return;
      cursa.poateUrma = true;
      // un singur buton pentru amândoi, exact peste cele două (așezat din CSS, deci
      // rămâne la locul lui și când se schimbă mărimea ecranului)
      const urm = $('d-next'), pads = document.querySelector('.drg-pads');
      urm.querySelector('span').textContent = terminat ? 'Rezultatul' : 'Mai departe';
      urm.hidden = false;
      pads.classList.add('is-final');
    }, 1200));
    haptic(castigator >= 0 ? 'success' : 'tick');
  }

  function tabela() {
    $('d-tally').innerHTML = `<span class="p0">${esc(nume(0))}</span><b class="p0">${meci.scor[0]}</b><i>–</i><b class="p1">${meci.scor[1]}</b><span class="p1">${esc(nume(1))}</span>`;
  }

  // ---------- pista ----------
  // Văzută din spatele liniei de start, în perspectivă: la distanța f (0 la start,
  // 1 la finiș) totul e de 1 + K·f ori mai mic, deci finișul e de 3,6 ori mai mic
  // decât startul. Pista se desenează o dată pe mărimea ecranului; în cursă se mută
  // doar săgețile.
  const K = 2.6;
  // Reperele clasice de pe o pistă de drag: 330 de picioare, o optime de milă și
  // 1000 de picioare; finișul e la un sfert de milă (402 m).
  const MILA_4 = SFERT;
  const REPERE = [[100.584, '330 ft'], [201.168, '1/8'], [304.8, '1000 ft']];
  // petele de lumină de pe asfalt, din 50 în 50 de metri, așezate între repere
  const STALPI = [25, 75, 125, 175, 225, 275].map(m => m / MILA_4);
  // turnurile de reflectoare, ca la stadion: puține, departe de pistă, între repere
  // (mai aproape de 125 m ar ieși pe marginea ecranului, mai departe de 250 m ar
  // intra sub luminile de start)
  const TURNURI = [125, 250].map(m => m / MILA_4);
  // Săgeata fiecăruia: o pată de lumină pe asfalt, desenată în perspectivă, cu vârful
  // înainte. Lungimea e în bucăți de pistă (0,07 = 28 m), lățimea în jumătăți de
  // pistă (0,22 = aproape jumătate de bandă).
  const SAGEATA = 0.07, LAT_S = 0.22;
  let geo = null;

  function pista() {
    const tr = $('d-track'), W = tr.clientWidth, H = tr.clientHeight;
    if (!W || !H) return;
    const lum = $('d-lights');
    const yF = lum.offsetTop + lum.offsetHeight + Math.max(12, H * 0.05);   // finișul, sub lumini
    const yS = H - Math.max(8, H * 0.035);                                  // startul, aproape de margine
    const yH = (yF * (1 + K) - yS) / K;                                     // orizontul
    const lat0 = Math.min(W * 0.43, H * 0.6);                               // jumătate din pistă, la start
    const cx = W / 2;
    const s = f => 1 / (1 + K * f);
    const y = f => yH + (yS - yH) * s(f);
    const lat = f => lat0 * s(f);
    const fJos = ((yS - yH) / (H + 4 - yH) - 1) / K;                        // unde iese pista din ecran
    const SUS = 1.05;
    const n = v => v.toFixed(1);
    const trap = (f1, f2, a, b, atr) => `<polygon ${atr} points="${n(cx + a * lat(f1))},${n(y(f1))} ${n(cx + b * lat(f1))},${n(y(f1))} ${n(cx + b * lat(f2))},${n(y(f2))} ${n(cx + a * lat(f2))},${n(y(f2))}"/>`;
    const grad = (id, y1, y2, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y1)}" x2="0" y2="${n(y2)}">${stops}</linearGradient>`;

    let svg = '<defs>'
      + grad('drg-asf', y(SUS), H, '<stop offset="0" stop-color="#0d0e11"/><stop offset="1" stop-color="#2a2b31"/>')
      + grad('drg-cauc', y(0.4), y(0), '<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>')
      + [0, 1].map(p => grad(`drg-t${p}`, y(0.75), H,
        `<stop offset="0" style="stop-color:var(--p${p})" stop-opacity="0"/><stop offset="1" style="stop-color:var(--p${p})" stop-opacity=".2"/>`)).join('')
      // dâra din spatele săgeții, în culoarea jucătorului, care se stinge spre noi
      + [0, 1].map(p => `<linearGradient id="drg-u${p}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--p${p})" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--p${p})" stop-opacity="0"/></linearGradient>`).join('')
      + '<filter id="drg-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>'
      + '<radialGradient id="drg-pata"><stop offset="0" stop-color="#ffeccc" stop-opacity=".16"/><stop offset="1" stop-color="#ffeccc" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="drg-con" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4dc" stop-opacity=".2"/><stop offset="1" stop-color="#fff4dc" stop-opacity="0"/></linearGradient>'
      + '<filter id="drg-bec" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>'
      + grad('drg-zid', y(SUS) - lat0 * 0.1, H, '<stop offset="0" stop-color="#121317"/><stop offset="1" stop-color="#2c2e35"/>')
      + '</defs>';
    svg += trap(fJos, SUS, -1, 1, 'fill="url(#drg-asf)"');
    svg += trap(fJos, 1, -1, 0, 'class="tint l0" fill="url(#drg-t0)"') + trap(fJos, 1, 0, 1, 'class="tint l1" fill="url(#drg-t1)"');
    // pete moi de lumină pe asfalt, ca de la reflectoarele unei piste de noapte
    for (const f of STALPI) for (const sd of [-1, 1]) {
      svg += `<ellipse class="pata" cx="${n(cx + sd * 0.55 * lat(f))}" cy="${n(y(f))}" rx="${n(0.7 * lat(f))}" ry="${n(Math.max(2, (y(f - 0.035) - y(f + 0.035)) / 2))}" fill="url(#drg-pata)"/>`;
    }
    // urmele de cauciuc lăsate de plecările de dinainte
    for (const c of [-0.5, 0.5]) for (const r of [-0.15, 0.15]) svg += trap(fJos, 0.4, c + r - 0.035, c + r + 0.035, 'fill="url(#drg-cauc)"');
    // marginile, fiecare în culoarea benzii, și linia din mijloc
    svg += trap(fJos, SUS, -1.04, -0.93, 'class="glow p0"') + trap(fJos, SUS, -1, -0.975, 'class="margine p0"');
    svg += trap(fJos, SUS, 0.93, 1.04, 'class="glow p1"') + trap(fJos, SUS, 0.975, 1, 'class="margine p1"');
    svg += trap(fJos, SUS, -0.012, 0.012, 'class="mijloc"');
    svg += trap(0, 0.007, -1, 1, 'class="linie"');
    for (const [m] of REPERE) {
      const f = m / MILA_4;
      svg += trap(f, f + 0.004, -1, 1, 'class="reper"');
    }
    // finișul în carouri
    const yf = y(1), lat1 = lat(1), col = 14, ch = Math.max(3, (yS - yH) * 0.012);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < col; k++) {
        svg += `<rect x="${n(cx - lat1 + (k * 2 * lat1) / col)}" y="${n(yf - (r + 1) * ch)}" width="${n((2 * lat1) / col + 0.3)}" height="${n(ch)}" fill="${(r + k) % 2 ? '#0a0a0c' : '#f2f2f2'}"/>`;
      }
    }
    svg += trap(0.994, 1.014, -1.08, 1.08, 'class="fin-glow"');
    // parapetele, de-a lungul marginilor, cu o dungă în culoarea benzii pe muchie
    const zid = f => lat0 * 0.085 * s(f);
    for (const sd of [-1, 1]) {
      const x = f => cx + sd * 1.045 * lat(f);
      const fata = (h0, h1) => `${n(x(fJos))},${n(y(fJos) - zid(fJos) * h0)} ${n(x(SUS))},${n(y(SUS) - zid(SUS) * h0)} ${n(x(SUS))},${n(y(SUS) - zid(SUS) * h1)} ${n(x(fJos))},${n(y(fJos) - zid(fJos) * h1)}`;
      svg += `<polygon class="zid" points="${fata(0, 1)}" fill="url(#drg-zid)"/>`;
      svg += `<polygon class="zid-banda p${sd < 0 ? 0 : 1}" points="${fata(0.8, 1)}"/>`;
    }
    // turnurile de reflectoare: întâi conurile de lumină, apoi turnurile, de departe
    // spre aproape. Fiecare are un catarg subțire și sus un panou cu două rânduri de
    // becuri, întors spre pistă.
    let conuri = '', turnuri = '';
    for (const f of [...TURNURI].reverse()) for (const sd of [-1, 1]) {
      // cel din spate stă mai în lateral și mai jos, ca să nu intre sub luminile de start
      const dep = f > 0.5, k = s(f), x = cx + sd * (dep ? 2.2 : 1.75) * lat(f), jos = y(f), sus = jos - lat0 * (dep ? 1.15 : 1.45) * k;
      const pw = lat0 * 0.42 * k, ph = lat0 * 0.13 * k, px = x - sd * pw * 0.15;
      // colțul panoului dinspre pistă coboară spre interiorul pistei, cel dinspre afară
      // spre margine; altfel, pe o parte, conul iese răsucit în cruce
      const pin = px - sd * pw / 2, pout = px + sd * pw / 2;
      conuri += `<polygon class="con" points="${n(pin)},${n(sus + ph)} ${n(pout)},${n(sus + ph)} ${n(cx + sd * 0.98 * lat(f))},${n(jos)} ${n(cx + sd * 0.15 * lat(f))},${n(jos)}" fill="url(#drg-con)"/>`;
      turnuri += `<path class="catarg" stroke-width="${n(Math.max(1, 2.6 * k))}" d="M${n(x)} ${n(jos)}V${n(sus + ph)}"/>`;
      turnuri += `<rect class="panou" x="${n(px - pw / 2)}" y="${n(sus)}" width="${n(pw)}" height="${n(ph)}"/>`;
      const bw = pw / 4, bh = ph / 2;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
        const bx = px - pw / 2 + c * bw + bw * 0.18, by = sus + r * bh + bh * 0.2;
        turnuri += `<rect class="bec-h" x="${n(bx)}" y="${n(by)}" width="${n(bw * 0.64)}" height="${n(bh * 0.6)}" filter="url(#drg-bec)"/>`;
        turnuri += `<rect class="bec" x="${n(bx)}" y="${n(by)}" width="${n(bw * 0.64)}" height="${n(bh * 0.6)}"/>`;
      }
    }
    svg += conuri + turnuri;
    // etichetele reperelor, ultimele, ca nimic să nu treacă peste ele: lângă parapet,
    // pe partea dreaptă, cu un contur închis care le desparte de ce e în spate
    for (const [m, eticheta] of REPERE) {
      const f = m / MILA_4;
      svg += `<text class="reper-t" x="${n(cx + 1.08 * lat(f) + 3)}" y="${n(y(f) - zid(f) - 3)}" font-size="${n(Math.max(9, 17 * s(f)))}">${eticheta}</text>`;
    }
    svg += [0, 1].map(p => `<g class="drg-sageata p${p}"><polygon class="urma" fill="url(#drg-u${p})"/><polygon class="halo" filter="url(#drg-glow)"/><polygon class="varf"/></g>`).join('');
    // fumul de la plecare, la baza săgeții
    const w0 = lat0 * LAT_S;
    svg += [0, 1].map(p => {
      const x = cx + (p ? 0.5 : -0.5) * lat0;
      return `<g class="drg-fum f${p}">${[-1, 0, 1].map((d, i) =>
        `<circle cx="${n(x + d * w0)}" cy="${n(yS - w0 * 0.1)}" r="${n(w0 * (i === 1 ? 0.6 : 0.5))}"/>`).join('')}</g>`;
    }).join('');

    const road = $('d-road');
    road.setAttribute('viewBox', `0 0 ${W} ${H}`);
    road.innerHTML = svg;
    geo = { s, y, lat, cx, sageti: [...road.querySelectorAll('.drg-sageata')], urma: [0, 1].map(() => ({ f: 0, t: 0, v: 0 })) };
  }

  // Săgeata stă pe asfalt, deci fiecare colț trece prin perspectiva pistei: vârful e
  // mai departe și mai îngust decât baza. Dâra din spate crește cu viteza.
  function auto(p, f) {
    if (!geo) return;
    const st = geo.urma[p], t = performance.now();
    if (st.t && t > st.t) st.v += ((f - st.f) / ((t - st.t) / 1000) - st.v) * 0.3;
    st.f = f; st.t = t;
    const banda = p ? 0.5 : -0.5;
    const pt = (u, g) => `${(geo.cx + (banda + u) * geo.lat(g)).toFixed(1)},${geo.y(g).toFixed(1)}`;
    const varf = `${pt(0, f + SAGEATA)} ${pt(LAT_S, f)} ${pt(0, f + SAGEATA * 0.36)} ${pt(-LAT_S, f)}`;
    const coada = Math.min(0.12, Math.max(0, st.v) * 0.5);
    const g = geo.sageti[p];
    g.querySelector('.varf').setAttribute('points', varf);
    g.querySelector('.halo').setAttribute('points', varf);
    // Dâra pornește din interiorul săgeții (sub vârf, peste scobitura din spate), ca
    // să nu rămână loc gol între ele: săgeata se desenează peste ea și o acoperă.
    g.querySelector('.urma').setAttribute('points',
      `${pt(-0.06, f + SAGEATA * 0.6)} ${pt(0.06, f + SAGEATA * 0.6)} ${pt(0.03, f - coada)} ${pt(-0.03, f - coada)}`);
  }

  // La fiecare schimbare, săgeata se aprinde o clipă.
  function flama(p) {
    if (!geo) return;
    const g = geo.sageti[p];
    g.classList.remove('flacara');
    void g.getBoundingClientRect();
    g.classList.add('flacara');
  }

  // O clasă pe pistă, pusă din nou de la capăt, ca animația ei să pornească iar.
  function clipa(cls) {
    const tr = $('d-track');
    tr.classList.remove(cls);
    void tr.offsetWidth;
    tr.classList.add(cls);
  }

  // Un cuvânt care urcă deasupra săgeții și se stinge: reacția la plecare, apoi nota
  // fiecărei schimbări.
  function deasupra(c, text, cls) {
    if (!geo) return;
    const f = pozitie(c) / 100, el = document.createElement('p');
    el.className = `drg-pop${cls ? ` ${cls}` : ''}`;
    el.textContent = text;
    el.style.left = `${(geo.cx + (c.p ? 0.5 : -0.5) * geo.lat(f)).toFixed(1)}px`;
    el.style.top = `${geo.y(f + SAGEATA).toFixed(1)}px`;
    $('d-track').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function fum(p) {
    const tr = $('d-track');
    tr.classList.remove(`fum-${p}`);
    void tr.offsetWidth;
    tr.classList.add(`fum-${p}`);
  }

  // ---------- coloana fiecăruia ----------
  function zone(V) {
    const z = (a, b, cls) => `<span class="drg-z ${cls}" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"></span>`;
    return z(OK_DE_LA, V[0], 'ok') + z(V[0], V[1], 'verde') + z(V[1], 1, 'rosu');
  }

  function randeazaJumatate(p) {
    const c = cursa.piloti[p], car = c.car, el = $(`d-half-${p}`);
    el.className = `drg-half p${p}`;
    el.innerHTML = `
      <div class="drg-bg" aria-hidden="true"><img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <div class="drg-in">
        <div class="drg-id">
          <span class="drg-who">${esc(nume(p))} <i class="rar-${rar(car)}">${RARITATI[rar(car)]}</i></span>
          <span class="drg-car"><b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}</span>
          <span class="drg-base">${fmt(c.T, 1)} s &middot; ${c.ev ? 'electrică' : `${c.G - 1} schimbări`}</span>
        </div>
        <div class="drg-bar" aria-hidden="true">${zone(c.V)}<i class="drg-fill"></i></div>
        <div class="drg-ger">
          <b class="drg-gear"><span>1</span><small>/${c.G}</small></b>
          <span class="drg-tw"><span class="drg-time"></span><small class="drg-rt"></small></span>
        </div>
        <div class="drg-note" aria-label="Notele schimbărilor"></div>
        <button class="drg-btn" type="button"><span></span><kbd class="drg-kbd" aria-hidden="true">${p ? 'L' : 'A'}</kbd></button>
      </div>
      <p class="drg-credit">Foto: ${esc(car.credit)}, ${esc(car.license)}</p>`;
    wirePhotos(el);
  }

  // ---------- finalul meciului ----------
  function final() {
    oprestePeTot();
    cursa = null;
    const [a, b] = meci.scor, [ba, bb] = meci.j.map(j => j.bani);
    const c = a !== b ? (a > b ? 0 : 1) : ba !== bb ? (ba > bb ? 0 : 1) : -1;
    $('d-end-t').innerHTML = c < 0
      ? `Egalitate <em>${a}–${b}</em>`
      : `<span class="p${c}">${esc(nume(c))}</span> câștigă <em>${meci.scor[c]}–${meci.scor[1 - c]}</em>`;
    $('d-stat').innerHTML = statistici();
    $('d-recap').innerHTML = meci.curse.map((r, i) => `
      <li class="${r.castigator >= 0 ? `w${r.castigator}` : ''}">
        <span class="drg-rk">Runda ${i + 1}</span>
        <span class="drg-rc p0">${esc(r.masini[0])}${r.timpi ? ` <em>${fmt(r.timpi[0], 2)} s</em>` : r.fals === 0 ? ' <em>start fals</em>' : ''}</span>
        <span class="drg-rc p1">${esc(r.masini[1])}${r.timpi ? ` <em>${fmt(r.timpi[1], 2)} s</em>` : r.fals === 1 ? ' <em>start fals</em>' : ''}</span>
      </li>`).join('');
    show('screen-end');
    haptic('success');
  }

  // Statisticile meciului, în stilul bonului: pe fiecare rând, valoarea mai bună e
  // în verde.
  function statistici() {
    const d = [0, 1].map(p => meci.curse.map(r => r.date && r.date[p]).filter(Boolean));
    const vals = (p, k) => d[p].map(x => x[k]).filter(x => x != null);
    const min = (p, k) => (vals(p, k).length ? Math.min(...vals(p, k)) : null);
    const max = (p, k) => (vals(p, k).length ? Math.max(...vals(p, k)) : null);
    const sum = (p, k) => d[p].reduce((s, x) => s + (x[k] || 0), 0);
    const falsuri = p => meci.curse.filter(r => r.fals === p).length;
    const RANDURI = [
      ['Runde câștigate', p => meci.scor[p], 1, v => v],
      ['Bani rămași', p => meci.j[p].bani, 1, v => mil(v)],
      ['Cea mai bună reacție', p => min(p, 'rt'), -1, v => `${fmt(v / 1000, 3)} s`],
      ['Cel mai bun 1/4 milă', p => min(p, 'et'), -1, v => `${fmt(v / 1000, 3)} s`],
      ['Viteza maximă', p => max(p, 'linie'), 1, v => `${Math.round(v * 3.6)} km/h`],
      // se compară procentul, nu numărul: 4 din 4 e la fel de bun ca 5 din 5
      ['Schimbări perfecte', p => (sum(p, 'sch') ? sum(p, 'perf') / sum(p, 'sch') : null), 1, (v, p) => `${sum(p, 'perf')}<small>/${sum(p, 'sch')}</small>`],
    ];
    if (falsuri(0) + falsuri(1) > 0) RANDURI.push(['Starturi false', falsuri, -1, v => v]);
    const rand = ([eticheta, f, sens, arata]) => {
      const v = [f(0), f(1)];
      const bun = v.map((x, p) => x != null && (v[1 - p] == null || (x - v[1 - p]) * sens > 0));
      return `<tr><th>${eticheta}</th>${[0, 1].map(p => `<td class="p${p}${bun[p] ? ' is-win' : ''}">${v[p] == null ? '–' : arata(v[p], p)}</td>`).join('')}</tr>`;
    };
    return `<thead><tr><th></th><th class="p0">${esc(nume(0))}</th><th class="p1">${esc(nume(1))}</th></tr></thead><tbody>${RANDURI.map(rand).join('')}</tbody>`;
  }

  // ---------- legături ----------
  [0, 1].forEach(i => { $(`d-name-${i}`).value = meci.nume[i] || ''; });
  // câte runde: de la 1 la 5
  const arataRunde = () => document.querySelectorAll('#d-runde [data-r]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.r === meci.runde)));
  $('d-runde').addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    meci.runde = +b.dataset.r;
    store.set('drg_runde', meci.runde);
    arataRunde();
  });
  arataRunde();
  $('d-form').addEventListener('submit', e => {
    e.preventDefault();
    meci.nume = [0, 1].map(i => $(`d-name-${i}`).value);
    store.set('drg_names', meci.nume);
    meciNou();
  });

  let scutura = false;
  $('d-pachete').addEventListener('click', e => {
    const info = e.target.closest('[data-info]');
    if (info) { continut(PACHETE.find(x => x.id === info.dataset.info)); return; }
    const b = e.target.closest('[data-pk]');
    if (!b || b.disabled || cutie || scutura) return;
    const pk = PACHETE.find(x => x.id === b.dataset.pk);
    // lada se scutură o clipă, apoi se deschide
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deschide(pk); return; }
    scutura = true;
    b.classList.add('is-scutura');
    haptic();
    setTimeout(() => { scutura = false; deschide(pk); }, 420);
  });
  $('d-sari').addEventListener('click', arata);
  $('d-cont').addEventListener('click', e => {
    if (e.target.closest('[data-inchide]') || e.target === $('d-cont')) $('d-cont').hidden = true;
  });
  $('d-rev').addEventListener('click', e => { if (e.target.closest('#d-rev-ok')) inchideCutie(); });
  $('d-cover').addEventListener('click', e => {
    if (!e.target.closest('#d-cover-ok')) return;
    $('d-cover').hidden = true;
    randeazaOrdinea();
    $('d-line').hidden = false;
  });
  // ordinea: atingi o rundă ca s-o alegi (a doua atingere o golește), apoi o mașină
  $('d-line').addEventListener('click', e => {
    const j = meci.j[meci.aseaza];
    const slot = e.target.closest('[data-slot]'), g = e.target.closest('[data-g]');
    if (slot) {
      const i = +slot.dataset.slot;
      if (meci.sel === i && j.ordine[i]) j.ordine[i] = null;
      meci.sel = i;
    } else if (g) puneMasina(+g.dataset.g);
    else if (e.target.closest('#d-line-ok') && j.ordine.every(Boolean)) {
      if (meci.aseaza === 0) ordinea(1); else rundaNoua();
      return;
    } else return;
    haptic();
    randeazaOrdinea();
  });
  $('d-dezv').addEventListener('click', ascundeDezv);

  // Ieșirea din magazin sau din ordine: meciul se pierde, deci întrebăm.
  const iesire = async () => {
    if (await Shared.intreaba(I18n.t('Ieși? Meciul se pierde.'))) {
      if (cutie) { clearTimeout(cutie.ceas); cutie = null; }
      oprestePeTot();
      cursa = null;
      show('screen-setup');
    }
  };
  $('d-shop-quit').addEventListener('click', iesire);
  $('d-line-quit').addEventListener('click', iesire);

  [0, 1].forEach(p => {
    const el = $(`d-half-${p}`);
    el.addEventListener('pointerdown', e => {
      if (!e.target.closest('.drg-btn')) return;
      e.preventDefault();
      atinge(p, e.timeStamp || performance.now());
    });
    // Enter sau Space pe butonul cu focus: un click fără pointer.
    el.addEventListener('click', e => {
      if (e.detail === 0 && e.target.closest('.drg-btn')) atinge(p, performance.now());
    });
  });
  // Pe calculator: A pentru stânga, L pentru dreapta.
  document.addEventListener('keydown', e => {
    if (!$('screen-race').classList.contains('is-active') || e.repeat) return;
    const k = e.key.toLowerCase();
    if ((k === ' ' || k === 'enter') && !$('d-next').hidden) { e.preventDefault(); $('d-next').click(); return; }
    if (k === 'a') atinge(0, e.timeStamp || performance.now());
    if (k === 'l') atinge(1, e.timeStamp || performance.now());
  });

  // Pista urmează mărimea ecranului (bara de adrese care apare și dispare, rotirea).
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!cursa) return;
      pista();
      cursa.piloti.forEach(c => deseneaza(c, performance.now()));
    }).observe($('d-track'));
  }

  $('d-next').addEventListener('click', () => atinge(0, performance.now()));

  $('btn-quit').addEventListener('click', iesire);
  $('d-again').addEventListener('click', meciNou);
  $('d-menu').addEventListener('click', () => show('screen-setup'));

  // Pentru verificări din consolă: modelul, fără interfață.
  window.__drag = { baza, schimbari, verde, accel, pregateste, profil, poz, vit, inv, t100, electrica, RITM, POOL, SFERT, PACHETE, raritate, trage, PE_RARITATE };
})();
