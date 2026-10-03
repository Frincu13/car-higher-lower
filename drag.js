// Startul: drag race pe 402 m, doi jucători unul lângă altul, pe același telefon.
// Sus e pista, jos fiecare are coloana lui cu un buton: Gata, apoi Start când se
// sting luminile, apoi Schimbă la fiecare treaptă. Mașina dă timpul de bază, mâna
// îl împinge în sus sau în jos.
(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, wirePhotos, haptic, shuffle } = window.Shared;
  const $ = id => document.getElementById(id);

  // ---------- mașinile ----------
  const t100 = c => (c.accel != null ? c.accel : c.accelEst);
  // O mașină electrică are o singură treaptă, deci n-ar avea ce schimba. Deocamdată
  // stă pe tușă; își poate primi altă mecanică mai târziu. Datele nu spun mereu că e
  // electrică: la Lotus Evija scrie doar „AWD", la Mach-E sau Spectre nu scrie nimic,
  // iar la Tesla Roadster scrie „1AT", adică o singură treaptă. De aici și lista.
  const ELECTRICE = /\b(Evija|Mach-E|Rivian|Spectre|Tesla|Taycan|Nevera|Lucid|IONIQ|EV6|e-tron GT)\b/i;
  const electrica = c => /electric|kwh|induction|\b1\s*AT\b/i.test(c.engine || '') || ELECTRICE.test(c.name);
  const POOL = (window.CARS || []).filter(c => c.image && c.hp && c.weight && t100(c) && !electrica(c));

  // Timpul pe 402 m jucat „normal": media dintre formula clasică din putere și
  // greutate și una din 0-100, care aduce tracțiunea pe care puterea singură n-o
  // vede. Verificată pe 14 mașini cu timpi măsurați în teste (Chiron 9,4 s, 911 GT3
  // 11,6 s, M3 12,6 s...): ieșea constant cu 6,5% prea optimistă, de unde ×1,065.
  const baza = c => 1.065 * (5.825 * Math.cbrt(c.weight * 2.2046 / c.hp) + 0.96 * t100(c) + 7) / 2;
  // Pe un sfert de milă nu se ajunge de obicei în ultimele trepte: trepte minus două,
  // între trei și cinci schimbări. Cine nu are cutia în date primește patru.
  function schimbari(c) {
    const m = /(\d+)\s*(MT|AT|DCT|SMG|PDK|DSG|AMT|speed)/i.exec(c.engine || '');
    return m ? Math.max(3, Math.min(5, +m[1] - 2)) : 4;
  }

  // ---------- cât valorează mâna ----------
  // Fiecare schimbare primește o notă, iar nota dă ritmul treptei care urmează: totul
  // perfect înseamnă ×0,88 din timpul de bază, totul prost ×1,32. Raportul de 1,5
  // dintre ele e cel cerut: o mașină de 15 s condusă perfect egalează una de 10 s
  // condusă prost, dar un Chiron condus oricât de prost rămâne în fața celei mai
  // lente mașini condusă perfect.
  const RITM = { '+': 0.88, '0': 1, '-': 1.32 };
  // Acul pornește fiecare treaptă de jos (R0) și urcă liniar. Verdele e 0,89-0,94,
  // ok e 0,80-0,89 și 0,94-1, sub 0,80 e prea devreme, iar la 1 e limitatorul.
  const R0 = 0.55, RTINTA = 0.915;
  const VERDE = [0.89, 0.94], OK_DE_LA = 0.80;
  // Pe limitator mașina aproape nu mai trage, iar după o jumătate de secundă cutia
  // schimbă singură, cu nota cea proastă, ca nimeni să nu rămână blocat.
  const RITM_LIMITATOR = 1.6, LIMITATOR_MAX = 450;
  // Plecarea: un timp de reacție bun la telefon e sub 0,22 s.
  const notaReactie = ms => (ms < 220 ? '+' : ms < 330 ? '0' : '-');
  const PLECARE_MAX = 2000;            // cine n-a atins în 2 s pleacă oricum, prost
  const LA_VICTORIE = 3;

  function nota(r, limitator) {
    if (limitator) return '-';
    if (r >= VERDE[0] && r <= VERDE[1]) return '+';
    return r >= OK_DE_LA ? '0' : '-';
  }

  // Treptele: prima scurtă, apoi tot mai lungi, ca la o cutie reală. Durata unei
  // trepte e timpul în care acul ajunge în mijlocul verdelui la un joc normal. O
  // mașină rapidă are trepte mai scurte, deci acul trece mai iute prin verde: cu
  // ea nimerești mai greu, fără nicio regulă inventată.
  function pregateste(c) {
    const T = baza(c), S = schimbari(c), G = S + 1;
    const w = Array.from({ length: G }, (_, k) => 1 + 0.35 * k);
    const s = w.reduce((a, b) => a + b, 0);
    return { car: c, T, G, D: w.map(x => (x / s) * T * 1000) };
  }

  function pilot(p, plan) {
    return {
      p, ...plan, faza: 'arm', gear: 0, r: R0, ritm: 1, u: 0, t: 0, lim: null,
      note: [], start: null, reactie: null, fin: null, fals: false,
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
      const viteza = (RTINTA - R0) / (c.D[c.gear] * (ultima ? 1.5 : 1));
      if (c.r < 1) {
        c.r = Math.min(ultima ? 0.985 : 1, c.r + viteza * dt);
        if (c.r >= 1 && c.lim == null) c.lim = c.t + dt;
      }
      const ritm = c.lim != null ? RITM_LIMITATOR : c.ritm;
      const du = dt / (c.T * 1000 * ritm);
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
    const n = nota(c.r, fortat || c.lim != null);
    c.note.push(n);
    c.ritm = RITM[n];
    c.gear++;
    c.r = R0;
    c.lim = null;
    haptic(n === '+' ? 'success' : n === '-' ? 'error' : 'tick');
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
  const meci = { nume: store.get('drg_names', ['', '']), scor: [0, 0], curse: [] };
  let cursa = null;
  const nume = p => (meci.nume[p] || '').trim() || `Jucător ${p + 1}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  function alegeDoua() {
    const a = POOL[Math.floor(Math.random() * POOL.length)];
    let b = a;
    while (b === a || b.name === a.name) b = POOL[Math.floor(Math.random() * POOL.length)];
    return [a, b];
  }

  function cursaNoua() {
    oprestePeTot();
    const masini = alegeDoua();
    cursa = { faza: 'arm', piloti: masini.map((c, p) => pilot(p, pregateste(c))), verde: null, ceasuri: [], raf: 0, poateUrma: false };
    $('d-track').className = 'drg-track';
    luminiStinse();
    // Întâi ecranul, apoi pista: are nevoie de mărimea lui ca să se deseneze.
    show('screen-race');
    [0, 1].forEach(p => { randeazaJumatate(p); stare(p, 'arm'); mesajPista(p, ''); });
    tabela();
    $('d-nr').textContent = `Cursa ${meci.curse.length + 1}`;
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
      if (meci.scor.some(s => s >= LA_VICTORIE)) final(); else cursaNoua();
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
    if (ETICHETE[st]) b.querySelector('span').textContent = ETICHETE[st];
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
    mesajPista(p, 'Start fals', '', 'rau');
    mesajPista(1 - p, 'Câștigă', '', 'bun');
    incheie(1 - p, null);
  }

  // ---------- bucla de desen ----------
  function bucla() {
    if (!cursa || cursa.faza !== 'go') return;
    const acum = performance.now();
    cursa.piloti.forEach(c => {
      if (c.start == null && acum - cursa.verde > PLECARE_MAX) pleaca(c, cursa.verde + PLECARE_MAX);
      avanseaza(c, acum);
      // Cine trece linia își vede timpul pe loc, fără să-l aștepte pe celălalt.
      if (c.fin != null && !c.sosit) {
        c.sosit = true;
        stare(c.p, 'done');
        mesajPista(c.p, `${fmt((c.fin - cursa.verde) / 1000, 2)} s`);
      }
    });
    cursa.piloti.forEach(c => deseneaza(c, acum));
    if (cursa.piloti.every(c => c.fin != null)) {
      const [a, b] = cursa.piloti.map(c => c.fin - cursa.verde);
      incheie(a === b ? -1 : a < b ? 0 : 1, [a, b]);
      return;
    }
    cursa.raf = requestAnimationFrame(bucla);
  }

  const pct = r => ((r - R0) / (1 - R0)) * 100;
  // Pe pistă mașina accelerează: poziția crește mai repede spre final.
  const pozitie = u => Math.pow(u, 1.6) * 100;

  function deseneaza(c, acum) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    el.querySelector('.drg-fill').style.width = `${pct(c.r)}%`;
    el.classList.toggle('in-verde', c.start != null && c.r >= VERDE[0] && c.r <= VERDE[1] && c.gear < c.G - 1);
    el.classList.toggle('pe-limita', c.lim != null);
    el.querySelector('.drg-gear span').textContent = c.gear + 1;
    const t = c.fin != null ? c.fin - cursa.verde : c.start != null ? acum - cursa.verde : 0;
    el.querySelector('.drg-time').textContent = c.start != null ? `${fmt(t / 1000, 2)} s` : '';
    auto(c.p, pozitie(c.u) / 100);
  }

  function puneNota(c, n) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    const prima = c.note.length === 1;
    const eticheta = n === '+' ? '+' : n === '-' ? '−' : '0';
    const titlu = prima ? `Plecare ${fmt(c.reactie / 1000, 2)} s` : `Schimbarea ${c.note.length - 1}`;
    el.querySelector('.drg-note').insertAdjacentHTML('beforeend',
      `<span class="drg-n n${n === '+' ? 'plus' : n === '-' ? 'minus' : 'zero'}${prima ? ' is-start' : ''}" title="${esc(titlu)}">${eticheta}</span>`);
    if (prima) {
      el.querySelector('.drg-rt').textContent = `reacție ${fmt(c.reactie / 1000, 2)} s`;
      fum(c.p);
    } else flama(c.p);
    stare(c.p, c.gear >= c.G - 1 ? 'last' : 'run');
  }

  // Ce se întâmplă pe banda fiecăruia, scris chiar pe pistă: timpul, cine câștigă.
  function mesajPista(p, mare, mic = '', cls = '') {
    const el = $(`d-lm-${p}`);
    el.className = `drg-lm l${p}${cls ? ` ${cls}` : ''}`;
    el.innerHTML = mare ? `<b>${esc(mare)}</b>${mic ? `<small>${esc(mic)}</small>` : ''}` : '';
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
    });
    const terminat = meci.scor.some(s => s >= LA_VICTORIE);
    tabela();
    if (castigator >= 0) $('d-track').classList.add(`castiga-${castigator}`);
    [0, 1].forEach(p => {
      $(`d-half-${p}`).classList.toggle('is-win', castigator === p);
      stare(p, 'done');
      if (timpi) {
        const dif = Math.abs(timpi[0] - timpi[1]) / 1000;
        mesajPista(p, `${fmt(timpi[p] / 1000, 2)} s`,
          castigator === -1 ? 'Egal' : castigator === p ? 'Câștigă' : `+${fmt(dif, 2)} s`,
          castigator === p ? 'bun' : '');
      }
    });
    // O clipă de pauză, ca o apăsare întârziată pe Schimbă să nu sară peste rezultat.
    cursa.ceasuri.push(setTimeout(() => {
      if (!cursa || cursa.faza !== 'gata') return;
      cursa.poateUrma = true;
      [0, 1].forEach(p => stare(p, terminat ? 'rezultat' : 'next'));
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
  const REPERE = [100, 201, 305];
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
      + '</defs>';
    svg += trap(fJos, SUS, -1, 1, 'fill="url(#drg-asf)"');
    svg += trap(fJos, 1, -1, 0, 'class="tint l0" fill="url(#drg-t0)"') + trap(fJos, 1, 0, 1, 'class="tint l1" fill="url(#drg-t1)"');
    // urmele de cauciuc lăsate de plecările de dinainte
    for (const c of [-0.5, 0.5]) for (const r of [-0.15, 0.15]) svg += trap(fJos, 0.4, c + r - 0.035, c + r + 0.035, 'fill="url(#drg-cauc)"');
    // marginile, fiecare în culoarea benzii, și linia din mijloc
    svg += trap(fJos, SUS, -1.04, -0.93, 'class="glow p0"') + trap(fJos, SUS, -1, -0.975, 'class="margine p0"');
    svg += trap(fJos, SUS, 0.93, 1.04, 'class="glow p1"') + trap(fJos, SUS, 0.975, 1, 'class="margine p1"');
    svg += trap(fJos, SUS, -0.012, 0.012, 'class="mijloc"');
    svg += trap(0, 0.007, -1, 1, 'class="linie"');
    for (const m of REPERE) {
      const f = m / 402;
      svg += trap(f, f + 0.004, -1, 1, 'class="reper"');
      svg += `<text class="reper-t" x="${n(cx + lat(f) + 6)}" y="${n(y(f) + 4)}" font-size="${n(Math.max(8, 16 * s(f)))}">${m} m</text>`;
    }
    // finișul în carouri
    const yf = y(1), lat1 = lat(1), col = 14, ch = Math.max(3, (yS - yH) * 0.012);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < col; k++) {
        svg += `<rect x="${n(cx - lat1 + (k * 2 * lat1) / col)}" y="${n(yf - (r + 1) * ch)}" width="${n((2 * lat1) / col + 0.3)}" height="${n(ch)}" fill="${(r + k) % 2 ? '#0a0a0c' : '#f2f2f2'}"/>`;
      }
    }
    svg += `<text class="reper-t fin" x="${n(cx + lat1 + 6)}" y="${n(yf)}" font-size="11">402 m</text>`;
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
    [0, 1].forEach(p => {
      const lm = $(`d-lm-${p}`);
      lm.style.left = `${n(cx + (p ? 0.5 : -0.5) * lat(0.08))}px`;
      lm.style.top = `${n(y(0.08))}px`;
    });
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

  function fum(p) {
    const tr = $('d-track');
    tr.classList.remove(`fum-${p}`);
    void tr.offsetWidth;
    tr.classList.add(`fum-${p}`);
  }

  // ---------- coloana fiecăruia ----------
  function zone() {
    const z = (a, b, cls) => `<span class="drg-z ${cls}" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"></span>`;
    return z(OK_DE_LA, VERDE[0], 'ok') + z(VERDE[0], VERDE[1], 'verde') + z(VERDE[1], 1, 'ok');
  }

  function randeazaJumatate(p) {
    const c = cursa.piloti[p], car = c.car, el = $(`d-half-${p}`);
    el.className = `drg-half p${p}`;
    el.innerHTML = `
      <div class="drg-bg" aria-hidden="true"><img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <div class="drg-in">
        <div class="drg-id">
          <span class="drg-who">${esc(nume(p))}</span>
          <span class="drg-car"><b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}</span>
          <span class="drg-base">${fmt(c.T, 1)} s &middot; ${c.G - 1} schimbări</span>
        </div>
        <div class="drg-bar" aria-hidden="true">${zone()}<i class="drg-fill"></i></div>
        <div class="drg-ger">
          <b class="drg-gear"><span>1</span><small>/${c.G}</small></b>
          <span class="drg-tw"><span class="drg-time"></span><small class="drg-rt"></small></span>
        </div>
        <div class="drg-note" aria-label="Notele schimbărilor"></div>
        <button class="drg-btn" type="button"><span></span></button>
      </div>
      <p class="drg-credit">Foto: ${esc(car.credit)}, ${esc(car.license)}</p>`;
    wirePhotos(el);
  }

  // ---------- finalul meciului ----------
  function final() {
    oprestePeTot();
    cursa = null;
    const c = meci.scor[0] > meci.scor[1] ? 0 : 1;
    $('d-end-t').innerHTML = `<span class="p${c}">${esc(nume(c))}</span> câștigă <em>${meci.scor[c]}–${meci.scor[1 - c]}</em>`;
    $('d-recap').innerHTML = meci.curse.map((r, i) => `
      <li class="${r.castigator >= 0 ? `w${r.castigator}` : ''}">
        <span class="drg-rk">Cursa ${i + 1}</span>
        <span class="drg-rc p0">${esc(r.masini[0])}${r.timpi ? ` <em>${fmt(r.timpi[0], 2)} s</em>` : r.fals === 0 ? ' <em>start fals</em>' : ''}</span>
        <span class="drg-rc p1">${esc(r.masini[1])}${r.timpi ? ` <em>${fmt(r.timpi[1], 2)} s</em>` : r.fals === 1 ? ' <em>start fals</em>' : ''}</span>
      </li>`).join('');
    show('screen-end');
    haptic('success');
  }

  function meciNou() {
    meci.scor = [0, 0];
    meci.curse = [];
    cursaNoua();
  }

  // ---------- legături ----------
  [0, 1].forEach(i => { $(`d-name-${i}`).value = meci.nume[i] || ''; });
  $('d-form').addEventListener('submit', e => {
    e.preventDefault();
    meci.nume = [0, 1].map(i => $(`d-name-${i}`).value);
    store.set('drg_names', meci.nume);
    meciNou();
  });

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

  $('btn-quit').addEventListener('click', async () => {
    const pornit = cursa && cursa.faza !== 'arm' || meci.curse.length > 0;
    if (!pornit || await Shared.intreaba(I18n.t('Ieși? Meciul se pierde.'))) {
      oprestePeTot();
      cursa = null;
      show('screen-setup');
    }
  });
  $('d-again').addEventListener('click', meciNou);
  $('d-menu').addEventListener('click', () => show('screen-setup'));

  // Pentru verificări din consolă: modelul, fără interfață.
  window.__drag = { baza, schimbari, pregateste, RITM, POOL };
})();
