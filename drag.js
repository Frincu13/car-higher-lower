// Startul: drag race pe 402 m, doi jucători pe același telefon pus pe masă.
// Fiecare are jumătatea lui de ecran, iar toată jumătatea e buton: prima atingere
// după stingerea luminilor e plecarea, fiecare atingere de după e o schimbare de
// treaptă. Mașina dă timpul de bază, mâna îl împinge în sus sau în jos.
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
    mesaj(c.p, '');
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
    cursa = { faza: 'arm', piloti: masini.map((c, p) => pilot(p, pregateste(c))), verde: null, ceasuri: [], raf: 0 };
    luminiStinse();
    [0, 1].forEach(randeazaJumatate);
    show('screen-race');
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
  function luminiStinse() { becuri().forEach(b => b.classList.remove('on')); $('d-lights').classList.remove('is-go'); }

  function lumini() {
    cursa.faza = 'lumini';
    [0, 1].forEach(p => mesaj(p, 'Așteaptă să se stingă luminile'));
    becuri().forEach((b, i) => cursa.ceasuri.push(setTimeout(() => { b.classList.add('on'); haptic(); }, 600 + i * 850)));
    const tine = 600 + 4 * 850 + 500 + Math.random() * 2300;
    cursa.ceasuri.push(setTimeout(() => {
      if (cursa.faza !== 'lumini') return;
      luminiStinse();
      $('d-lights').classList.add('is-go');
      requestAnimationFrame(t => {
        if (cursa.faza !== 'lumini') return;
        cursa.verde = t;
        cursa.faza = 'go';
        bucla();
      });
    }, tine));
  }

  // ---------- atingerile ----------
  // Fiecare jumătate ascultă doar de degetul de pe ea, deci două atingeri deodată
  // sunt două evenimente separate. Ora e cea a evenimentului, nu a procesării.
  function atinge(p, la) {
    if (!cursa) return;
    const c = cursa.piloti[p];
    if (cursa.faza === 'arm') {
      if (c.faza !== 'arm') return;
      c.faza = 'gata';
      haptic();
      document.getElementById(`d-half-${p}`).classList.add('is-ready');
      mesaj(p, 'Gata. Așteaptă-l pe celălalt');
      if (cursa.piloti.every(x => x.faza === 'gata')) lumini();
      return;
    }
    if (cursa.faza === 'lumini') { startFals(p); return; }
    if (cursa.faza === 'go') {
      if (c.start == null) pleaca(c, la);
      else schimba(c, la);
      return;
    }
    if (cursa.faza === 'gata' && Date.now() - cursa.gataLa > 1200) {
      if (meci.scor.some(s => s >= LA_VICTORIE)) final(); else cursaNoua();
    }
  }

  function startFals(p) {
    oprestePeTot();
    const c = cursa.piloti[p];
    c.fals = true;
    luminiStinse();
    haptic('error');
    document.getElementById(`d-half-${p}`).classList.add('is-false');
    mesaj(p, 'Start fals. Pierzi cursa', true);
    mesaj(1 - p, `${nume(p)} a plecat înainte. Câștigi cursa`, true);
    incheie(1 - p, null);
  }

  // ---------- bucla de desen ----------
  function bucla() {
    if (!cursa || cursa.faza !== 'go') return;
    const acum = performance.now();
    cursa.piloti.forEach(c => {
      if (c.start == null && acum - cursa.verde > PLECARE_MAX) pleaca(c, cursa.verde + PLECARE_MAX);
      avanseaza(c, acum);
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
    const el = document.getElementById(`d-half-${c.p}`);
    if (!el) return;
    const altul = cursa.piloti[1 - c.p];
    el.querySelector('.drg-fill').style.width = `${pct(c.r)}%`;
    el.classList.toggle('in-verde', c.r >= VERDE[0] && c.r <= VERDE[1] && c.gear < c.G - 1);
    el.classList.toggle('pe-limita', c.lim != null);
    el.querySelector('.drg-gear span').textContent = c.gear + 1;
    el.querySelector('.drg-dot.me').style.left = `${pozitie(c.u)}%`;
    el.querySelector('.drg-dot.him').style.left = `${pozitie(altul.u)}%`;
    const t = c.fin != null ? c.fin - cursa.verde : c.start != null ? acum - cursa.verde : 0;
    el.querySelector('.drg-time').textContent = c.start != null ? `${fmt(t / 1000, 2)} s` : '';
  }

  function puneNota(c, n) {
    const el = document.getElementById(`d-half-${c.p}`);
    if (!el) return;
    const prima = c.note.length === 1;
    const eticheta = n === '+' ? '+' : n === '-' ? '−' : '0';
    const titlu = prima ? `Plecare ${fmt(c.reactie / 1000, 2)} s` : `Schimbarea ${c.note.length - 1}`;
    el.querySelector('.drg-note').insertAdjacentHTML('beforeend',
      `<span class="drg-n n${n === '+' ? 'plus' : n === '-' ? 'minus' : 'zero'}${prima ? ' is-start' : ''}" title="${esc(titlu)}">${prima ? `<small>${fmt(c.reactie / 1000, 2)}</small>` : ''}${eticheta}</span>`);
  }

  function mesaj(p, text, tare = false) {
    const el = document.querySelector(`#d-half-${p} .drg-msg`);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-strong', tare);
  }

  // ---------- sfârșitul cursei ----------
  function incheie(castigator, timpi) {
    cursa.faza = 'gata';
    cursa.gataLa = Date.now();
    cancelAnimationFrame(cursa.raf);
    if (castigator >= 0) meci.scor[castigator]++;
    meci.curse.push({
      masini: cursa.piloti.map(c => c.car.name),
      timpi: timpi ? timpi.map(x => x / 1000) : null,
      fals: cursa.piloti.findIndex(c => c.fals),
      castigator,
    });
    const terminat = meci.scor.some(s => s >= LA_VICTORIE);
    [0, 1].forEach(p => {
      const el = document.getElementById(`d-half-${p}`);
      el.classList.add('is-done');
      el.classList.toggle('is-win', castigator === p);
      el.querySelector('.drg-score').innerHTML = scor(p);
      if (timpi) {
        const dif = Math.abs(timpi[0] - timpi[1]) / 1000;
        mesaj(p, castigator === -1 ? 'Egalitate la miime'
          : castigator === p ? `Câștigi cu ${fmt(dif, 2)} s` : `Pierzi cu ${fmt(dif, 2)} s`, true);
      }
      setTimeout(() => {
        if (!cursa || cursa.faza !== 'gata') return;
        const urm = el.querySelector('.drg-next');
        urm.textContent = terminat ? 'Atinge pentru rezultat' : 'Atinge pentru cursa următoare';
        urm.hidden = false;
      }, 1200);
    });
    haptic(castigator >= 0 ? 'success' : 'tick');
  }

  const scor = p => `<b>${meci.scor[p]}</b><span>–</span><b>${meci.scor[1 - p]}</b>`;

  // ---------- desenul unei jumătăți ----------
  function zone() {
    const z = (a, b, cls) => `<span class="drg-z ${cls}" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"></span>`;
    return z(OK_DE_LA, VERDE[0], 'ok') + z(VERDE[0], VERDE[1], 'verde') + z(VERDE[1], 1, 'ok');
  }

  function randeazaJumatate(p) {
    const c = cursa.piloti[p], car = c.car, el = $(`d-half-${p}`);
    el.className = `drg-half p${p}${p === 1 ? ' is-top' : ''}`;
    el.innerHTML = `
      <div class="drg-bg" aria-hidden="true"><img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <div class="drg-in">
        <div class="drg-head">
          <div class="drg-id">
            <span class="drg-who">${esc(nume(p))}</span>
            <span class="drg-car"><b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}</span>
            <span class="drg-base">${fmt(c.T, 1)} s pe 402 m &middot; ${c.G - 1} schimbări</span>
          </div>
          <div class="drg-score">${scor(p)}</div>
        </div>
        <div class="drg-strip" aria-hidden="true"><i class="drg-dot him"></i><i class="drg-dot me"></i></div>
        <div class="drg-tach">
          <div class="drg-bar" aria-hidden="true">${zone()}<i class="drg-fill"></i></div>
          <b class="drg-gear"><span>1</span><small>/${c.G}</small></b>
        </div>
        <div class="drg-row">
          <div class="drg-note" aria-label="Notele schimbărilor"></div>
          <span class="drg-time"></span>
        </div>
        <p class="drg-msg">Atinge când ești gata</p>
        <p class="drg-next" hidden></p>
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
    $(`d-half-${p}`).addEventListener('pointerdown', e => {
      if (e.target.closest('a')) return;            // creditul pozei rămâne link
      e.preventDefault();
      atinge(p, e.timeStamp || performance.now());
    });
  });
  // Pe calculator: A pentru jos, L pentru sus.
  document.addEventListener('keydown', e => {
    if (!$('screen-race').classList.contains('is-active') || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a') atinge(0, e.timeStamp || performance.now());
    if (k === 'l') atinge(1, e.timeStamp || performance.now());
  });

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
