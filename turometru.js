(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, haptic } = window.Shared;
  const CARS = (window.CARS || []).filter(c => c.image);

  // ---- classify:start
  // Rough segment per car, so every axis gets cars that make sense on it.
  const { yearOf, segOf, kindOf: catOf, KINDS: CATS, KIND_LABEL: CAT_LABEL } = window.Kinds;

  const is = (...segs) => c => segs.includes(segOf(c));
  const not = (...segs) => c => !segs.includes(segOf(c));
  const years = (from, to) => c => yearOf(c) >= from && yearOf(c) <= to;
  const both = (a, b) => c => a(c) && b(c);

  // l = left end of the dial (0), r = right end (10).
  // pool: which cars can come up on this axis. mix: at least 2 of the 4 cars come from here.
  const AXES = [
    { l: 'Discretă', r: 'Toată strada se uită după ea' },
    { l: 'Plictisitoare', r: 'Nebunie curată' },
    { l: 'Uitată de toți', r: 'Legendă' },
    { l: 'Parchezi oriunde', r: 'Nu încape în nicio parcare' },
    { l: 'O împrumuți oricui', r: 'Nu o împrumuți nimănui' },
    { l: 'Sună a mașină de cusut', r: 'Sună a avion de vânătoare' },
    { l: 'Cumperi cu mintea', r: 'Cumperi cu inima' },
    { l: 'Stă mai mult în service', r: 'Nu moare niciodată' },
    { l: 'Nu o recunoaște nimeni', r: 'O recunoaște și un copil' },
    { l: 'Pentru drum la țară', r: 'Pentru Monaco' },
    { l: 'Strică prima întâlnire', r: 'Garantează a doua întâlnire' },
    { l: 'Nu o fură nimeni', r: 'Prima pe lista hoților' },
    { l: 'Confortabilă', r: 'Te doare spatele după 10 km' },
    { l: 'Mașina din copilăria ta', r: 'Mașina din viitor' },
    { l: 'Merge prin zăpadă', r: 'Stă în garaj toată iarna', mix: is('suv', 'offroad', 'rally') },
    { l: 'Pe asfalt e acasă', r: 'În noroi e acasă', mix: is('suv', 'offroad', 'rally') },
    { l: 'Ieftină la service', r: 'Te lasă sărac la service', pool: not('offroad') },
    { l: 'Mașină de bunic', r: 'Mașină de interlop', pool: not('offroad', 'hyper') },
    { l: 'Mașină de profesor', r: 'Mașină de rapper', pool: not('offroad') },
    { l: 'Șofer răbdător', r: 'Claxonează când se face verde', pool: not('offroad') },
    { l: 'Mașină de oraș', r: 'Mașină de autostradă', pool: not('offroad') },
    { l: 'Mașină de taxi', r: 'Mașină de colecție', pool: not('offroad') },
    { l: 'Mașină de familie', r: 'Mașină de burlac', pool: both(not('offroad'), years(1985, 2100)) },
    { l: 'Mașina stagiarului', r: 'Mașina șefului', pool: both(is('road', 'sport', 'suv', 'super'), years(1995, 2100)) },
    { l: 'Nu știe ce e driftul', r: 'Născută pentru drift', pool: is('road', 'sport', 'super', 'rally') },
    { l: 'Pur și simplu veche', r: 'Retro și cool', pool: years(0, 1994) },
    { l: 'Clasică de muzeu', r: 'Clasică de condus zilnic', pool: years(0, 1979) },
    { l: 'Arată îmbătrânită', r: 'Arată bine și azi', pool: both(not('offroad'), years(1975, 2008)) },
    { l: 'Supercar de fotbalist', r: 'Supercar de colecționar', pool: is('super', 'hyper') },
    { l: 'Costă cât o garsonieră', r: 'Costă cât un bloc', pool: both(is('sport', 'super', 'hyper'), years(1995, 2100)) },
    { l: 'Pentru Instagram', r: 'Pentru pistă', pool: is('sport', 'super', 'hyper') },
    { l: 'O conduce oricine', r: 'Doar un pilot o stăpânește', pool: is('sport', 'super', 'hyper', 'rally') },
    { l: 'SUV de mers la mall', r: 'SUV de aventură', pool: is('suv') },
  ];

  const poolFor = ax => CARS.filter(ax.pool || (() => true));

  // ---- classify:end

  // Distance from the target (dial units 0-100) -> points.
  const ZONES = [[3, 4], [8, 3], [13, 2]];
  const pointsFor = d => (ZONES.find(([w]) => d <= w) || [0, 0])[1];

  const $ = id => document.getElementById(id);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduceMotion = () => document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmtV = v => fmt(Math.round(v) / 10, 1);

  const state = {
    names: store.get('turo_names', ['', '']),
    rounds: store.get('turo_rounds', 8),
    round: 0,
    axes: [],
    phase: 'handoff', // handoff -> pick -> target -> pass -> guess -> reveal
    cars: [],
    rerolled: false,
    car: null,
    target: 50,
    guess: 50,
    score: 0,
    history: [],
    usedCars: new Set(),
  };

  const players = () => state.names.map((n, i) => n.trim() || `Jucător ${i + 1}`);
  const giver = () => players()[state.round % state.names.length];
  const axis = () => state.axes[state.round % state.axes.length];

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- setup ----------
  function renderNames() {
    $('names').innerHTML = state.names.map((n, i) => `
      <div class="turo-name">
        <label><span>Jucător ${i + 1}</span><input data-i="${i}" maxlength="16" autocomplete="off" placeholder="Jucător ${i + 1}" value="${esc(n)}"></label>
        ${state.names.length > 2 ? `<button type="button" class="turo-remove" data-remove="${i}" aria-label="Scoate jucătorul ${i + 1}">&times;</button>` : ''}
      </div>`).join('');
    $('btn-add').hidden = state.names.length >= 8;
  }
  $('names').addEventListener('input', e => { if (e.target.dataset.i != null) state.names[+e.target.dataset.i] = e.target.value; });
  $('names').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    state.names.splice(+b.dataset.remove, 1);
    renderNames();
  });
  $('btn-add').addEventListener('click', () => { state.names.push(''); renderNames(); $('names').querySelector('.turo-name:last-child input').focus(); });
  $('rounds').value = String(state.rounds);

  $('setup-form').addEventListener('submit', e => {
    e.preventDefault();
    state.rounds = +$('rounds').value;
    store.set('turo_names', state.names);
    store.set('turo_rounds', state.rounds);
    start();
  });

  function start() {
    state.round = 0;
    state.score = 0;
    state.history = [];
    state.usedCars = new Set();
    state.axes = shuffle(AXES.slice());
    newRound();
    show('screen-play');
  }

  function newRound() {
    state.phase = 'handoff';
    state.rerolled = false;
    state.kinds = shuffle(CATS.map(c => c[0]));
    state.car = null;
    state.target = 50;
    state.guess = 50;
    state.cars = drawCars();
    render();
  }

  // 4 cars that fit the axis, as varied as possible (different types and brands).
  // Four cars, one from each of four kinds (the reroll uses the other four kinds).
  // Axes that only make sense for one kind (SUVs only, classics only...) keep their
  // own pool and pick four different brands instead.
  function drawCars() {
    const ax = axis();
    const fits = poolFor(ax);
    let pool = fits.filter(c => !state.usedCars.has(c.id));
    if (pool.length < 8) pool = fits;
    shuffle(pool = pool.slice());

    const picked = [];
    const newBrand = c => !picked.some(p => brandOf(p.name) === brandOf(c.name));
    const kinds = state.rerolled ? state.kinds.slice(4) : state.kinds.slice(0, 4);
    const present = new Set(pool.map(catOf));
    if (!ax.pool || [...present].length >= 4) {
      // Missing kinds (a narrow axis) are replaced by kinds from the other half.
      const order = [...kinds, ...state.kinds.filter(k => !kinds.includes(k))].filter(k => present.has(k));
      for (const k of order) {
        if (picked.length === 4) break;
        const c = pool.find(x => catOf(x) === k && newBrand(x)) || pool.find(x => catOf(x) === k && !picked.includes(x));
        if (c) picked.push(c);
      }
    }
    for (const ok of [newBrand, () => true]) {
      for (const c of pool) if (picked.length < 4 && !picked.includes(c) && ok(c)) picked.push(c);
    }
    picked.forEach(c => state.usedCars.add(c.id));
    return picked;
  }

  // ---------- gauge ----------
  // Round tachometer with a 270 degree sweep: 0 at bottom left, 100 at bottom right.
  const C = 200;
  const ang = v => 225 - v * 2.7;
  const polar = (v, r) => {
    const a = ang(v) * Math.PI / 180;
    return [C + r * Math.cos(a), C - r * Math.sin(a)];
  };
  const arc = (from, to, r) => {
    if (to - from < .01) to = from + .01;
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${(to - from) * 2.7 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const LEDS = 15;

  function gaugeSVG({ interactive = false, needles }) {
    const parts = [];
    for (let v = 0; v <= 100; v += 2.5) {
      const major = v % 10 === 0, mid = v % 5 === 0;
      const [x1, y1] = polar(v, major ? 158 : mid ? 166 : 171), [x2, y2] = polar(v, 181);
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="tk${major ? ' tk-major' : mid ? ' tk-mid' : ''}${v >= 85 ? ' tk-red' : ''}"/>`);
      if (major) {
        const [tx, ty] = polar(v, 134);
        parts.push(`<text x="${tx.toFixed(1)}" y="${(ty + 9).toFixed(1)}" class="num${v >= 90 ? ' num-red' : ''}">${v / 10}</text>`);
      }
    }
    const leds = Array.from({ length: LEDS }, (_, i) =>
      `<rect x="${(58 + i * 19.4).toFixed(1)}" y="-30" width="15" height="12" class="led${i >= LEDS - 4 ? ' led-red' : ''}" transform="skewX(-24)" style="transform-box: fill-box; transform-origin: center"/>`).join('');

    return `<svg class="gauge${interactive ? ' is-interactive' : ''}" viewBox="0 -44 400 444"
        ${interactive ? 'role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="10" aria-label="Poziția acului"' : 'aria-hidden="true"'}>
      <defs>
        <radialGradient id="g-face" cx="50%" cy="42%" r="60%">
          <stop offset="0" stop-color="#1c1c22"/><stop offset=".75" stop-color="#0d0d11"/><stop offset="1" stop-color="#050507"/>
        </radialGradient>
        <linearGradient id="g-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#55555e"/><stop offset=".45" stop-color="#18181c"/><stop offset="1" stop-color="#34343b"/>
        </linearGradient>
        <radialGradient id="g-cap" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#6a6a73"/><stop offset=".6" stop-color="#232329"/><stop offset="1" stop-color="#0c0c0f"/>
        </radialGradient>
        <filter id="g-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="leds">${leds}</g>
      <circle cx="${C}" cy="${C}" r="198" fill="url(#g-bezel)"/>
      <circle cx="${C}" cy="${C}" r="191" fill="url(#g-face)"/>
      <circle cx="${C}" cy="${C}" r="191" class="face-edge"/>
      <g class="zones"></g>
      <path d="${arc(85, 100, 184)}" class="redline" filter="url(#g-glow)"/>
      ${parts.join('')}
      <path d="${arc(0, 100, 104)}" class="sweep-track"/>
      <path d="${arc(0, 0.01, 104)}" class="sweep" filter="url(#g-glow)"/>
      <text x="${C}" y="${C + 108}" class="readout">5,0</text>
      <text x="${C}" y="${C + 130}" class="unit">x1000 RPM</text>
      ${needles.map(n => `
      <g class="needle needle-${n}" transform="translate(${C} ${C}) rotate(-135)">
        <polygon points="-5,26 -1.4,-172 1.4,-172 5,26" filter="url(#g-glow)"/>
      </g>`).join('')}
      <circle cx="${C}" cy="${C}" r="21" fill="url(#g-cap)" class="cap"/>
      <circle cx="${C}" cy="${C}" r="7" class="cap-dot"/>
    </svg>`;
  }

  // Keeps the needles, LED strip and readout in sync, with a light spring so the needle feels mechanical.
  function Gauge(svg) {
    const needles = {};
    svg.querySelectorAll('.needle').forEach(g => {
      const key = g.classList.contains('needle-red') ? 'red' : 'white';
      needles[key] = { el: g, shown: 0, goal: 0 };
    });
    const leds = [...svg.querySelectorAll('.led')];
    const sweep = svg.querySelector('.sweep');
    const readout = svg.querySelector('.readout');
    let lead = Object.keys(needles)[0];
    let raf = 0;

    const draw = () => {
      for (const n of Object.values(needles)) n.el.setAttribute('transform', `translate(${C} ${C}) rotate(${(-135 + n.shown * 2.7).toFixed(2)})`);
      const v = needles[lead].shown;
      const lit = Math.round(v / 100 * LEDS);
      leds.forEach((l, i) => l.classList.toggle('on', i < lit));
      sweep.setAttribute('d', arc(0, Math.max(.01, v), 104));
      sweep.classList.toggle('is-red', v >= 85);
      readout.textContent = fmtV(v);
    };
    const loop = () => {
      let moving = false;
      for (const n of Object.values(needles)) {
        const d = n.goal - n.shown;
        if (Math.abs(d) < .05) n.shown = n.goal; else { n.shown += d * .24; moving = true; }
      }
      draw();
      raf = moving ? requestAnimationFrame(loop) : 0;
    };
    const api = {
      svg,
      set(key, v, instant = false) {
        const n = needles[key];
        n.goal = v;
        if (instant || reduceMotion()) { n.shown = v; draw(); return; }
        if (!raf) raf = requestAnimationFrame(loop);
      },
      // Direct drive for scripted animations (no spring).
      put(key, v) { needles[key].shown = needles[key].goal = v; draw(); },
      lead(key) { lead = key; draw(); },
      zones(target, grow = 1) {
        svg.querySelector('.zones').innerHTML = ZONES.slice().reverse().map(([w, pts]) =>
          `<path d="${arc(Math.max(0, target - w * grow), Math.min(100, target + w * grow), 170)}" class="zone z${pts}"/>`).join('');
      },
      stop() { cancelAnimationFrame(raf); raf = 0; },
    };
    return api;
  }

  function wireInput(g, key, onChange) {
    const svg = g.svg;
    const fromPointer = e => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let a = Math.atan2(C - p.y, p.x - C) * 180 / Math.PI;
      if (a < -90) a += 360; // bottom left belongs to the start of the scale
      set((225 - a) / 2.7);
    };
    let lastMark = null;
    const set = v => {
      v = Math.max(0, Math.min(100, v));
      const mark = Math.floor(v / 10);
      if (lastMark !== null && mark !== lastMark) haptic();
      lastMark = mark;
      onChange(v);
      g.set(key, v);
      svg.setAttribute('aria-valuenow', (v / 10).toFixed(1));
      svg.setAttribute('aria-valuetext', fmtV(v));
    };
    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); svg.classList.add('is-dragging'); fromPointer(e); });
    svg.addEventListener('pointermove', e => { if (svg.hasPointerCapture(e.pointerId)) fromPointer(e); });
    const release = () => svg.classList.remove('is-dragging');
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('keydown', e => {
      const cur = key === 'red' ? state.target : state.guess;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(cur - step); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(cur + step); }
    });
    set(key === 'red' ? state.target : state.guess);
  }

  // ---------- reveal animation ----------
  let revealToken = 0;
  function playReveal(g, last) {
    const token = ++revealToken;
    const stage = $('stage');
    const finish = () => {
      g.put('red', state.target);
      g.zones(state.target);
      stage.classList.add('is-revealed');
      haptic(last.points >= 3 ? 'success' : last.points === 0 ? 'error' : 'tick');
      if (last.points === 4) stage.classList.add('is-perfect');
    };
    g.put('white', state.guess);
    g.lead('red');
    if (reduceMotion()) return finish();

    const ease = t => 1 - Math.pow(1 - t, 3);
    const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const peak = Math.min(100, state.target + 22);
    const t0 = performance.now();
    const step = now => {
      if (token !== revealToken) return;
      const t = now - t0;
      if (t < 700) g.put('red', peak * ease(t / 700));
      else if (t < 1250) g.put('red', peak + (state.target - peak) * inOut((t - 700) / 550));
      else if (t < 1800) { g.put('red', state.target); g.zones(state.target, ease((t - 1250) / 550)); }
      else return finish();
      requestAnimationFrame(step);
    };
    g.put('red', 0);
    requestAnimationFrame(step);
    // Frames can stall (background tab, slow phone): never leave the result hidden.
    setTimeout(() => { if (token === revealToken && !stage.classList.contains('is-revealed')) { revealToken++; finish(); } }, 2400);
  }

  // ---------- render ----------
  const axisHTML = () => {
    const { l, r } = axis();
    return `<div class="turo-axis">
      <div class="axis-end axis-l"><span class="axis-n">0</span><span class="axis-t">${esc(l)}</span></div>
      <div class="axis-line" aria-hidden="true"></div>
      <div class="axis-end axis-r"><span class="axis-t">${esc(r)}</span><span class="axis-n">10</span></div>
    </div>`;
  };
  const carHTML = (car, kind = false) => `
    <div class="turo-car">
      ${artHTML(car)}${kind ? `<span class="turo-kind">${esc(CAT_LABEL[catOf(car)])}</span>` : ''}
      <div class="turo-car-text">
        <span class="brand">${esc(brandOf(car.name))}</span>
        <span class="turo-car-model">${esc(modelOf(car.name) || car.name)}</span>
        <span class="meta">${esc(car.years)}</span>
      </div>
    </div>`;
  const boardHTML = (side, gauge, who) => `
    <div class="turo-board">
      <div class="turo-side"><p class="eyebrow turo-who">${who}</p>${carHTML(state.car)}${side}</div>
      <div class="turo-gauge">${gauge}</div>
    </div>`;

  function render() {
    revealToken++;
    $('round-label').textContent = `${state.round + 1} / ${state.rounds}`;
    $('score-label').textContent = state.score;
    const g = esc(giver());
    let html = '';

    switch (state.phase) {
      case 'handoff':
        html = `<div class="turo-handoff">
          <span class="skew-bar" aria-hidden="true"></span>
          <p class="eyebrow">Runda ${state.round + 1}</p>
          <h2 class="turo-big">Telefonul la <em>${g}</em></h2>
          <button class="btn btn-primary" data-act="to-pick">Start</button>
        </div>`;
        break;

      case 'pick':
        html = `${axisHTML()}
          <div class="turo-pick">${state.cars.map((c, i) => `
            <div role="button" tabindex="0" class="turo-pick-card" data-pick="${i}">${carHTML(c, true)}</div>`).join('')}
          </div>
          <div class="turo-actions">
            ${state.rerolled ? '' : '<button class="btn btn-ghost" data-act="reroll">Altele</button>'}
          </div>`;
        break;

      case 'target':
        html = `${axisHTML()}
          ${boardHTML(`
            <button class="btn btn-primary" data-act="lock-target">Lock in</button>`,
            gaugeSVG({ interactive: true, needles: ['red'] }), g)}`;
        break;

      case 'pass':
        html = `<div class="turo-handoff">
          <span class="skew-bar" aria-hidden="true"></span>
          <p class="eyebrow">Runda ${state.round + 1}</p>
          <h2 class="turo-big">Telefonul la <em>echipă</em></h2>
          <button class="btn btn-primary" data-act="to-guess">Start</button>
        </div>`;
        break;

      case 'guess':
        html = `${axisHTML()}
          ${boardHTML(`
            <button class="btn btn-primary" data-act="lock-guess">Lock in</button>`,
            gaugeSVG({ interactive: true, needles: ['white'] }), 'Echipa')}`;
        break;

      case 'reveal': {
        const last = state.history[state.history.length - 1];
        const verdict = { 4: 'Perfect!', 3: 'Foarte aproape', 2: 'Aproape', 0: 'Ratat' }[last.points];
        html = `${axisHTML()}
          ${boardHTML(`
            <div class="turo-result">
              <span class="turo-points p${last.points}">+${last.points}</span>
              <span class="turo-verdict">${verdict}</span>
              <span class="turo-compare"><i class="dot-red"></i>${g}: ${fmtV(state.target)} <i class="dot-white"></i>Voi: ${fmtV(state.guess)}</span>
            </div>
            <button class="btn btn-primary" data-act="next">${state.round + 1 >= state.rounds ? 'Final' : 'Mai departe'}</button>`,
            gaugeSVG({ needles: ['white', 'red'] }), g)}`;
        break;
      }
    }

    $('stage').className = `turo-stage phase-${state.phase}`;
    $('stage').innerHTML = html;
    wirePhotos($('stage'));
    $('stage').querySelectorAll('.art-credit a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    const svg = $('stage').querySelector('svg.gauge');
    if (svg) {
      const gauge = Gauge(svg);
      if (state.phase === 'target') wireInput(gauge, 'red', v => { state.target = v; });
      if (state.phase === 'guess') wireInput(gauge, 'white', v => { state.guess = v; });
      if (state.phase === 'reveal') playReveal(gauge, state.history[state.history.length - 1]);
    }
    $('stage').querySelector('[data-act], [data-pick]')?.focus({ preventScroll: true });
  }

  // ---------- actions ----------
  $('stage').addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick && state.phase === 'pick') {
      state.car = state.cars[+pick.dataset.pick];
      state.phase = 'target';
      return render();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'to-pick') state.phase = 'pick';
    if (act === 'reroll' && !state.rerolled) { state.rerolled = true; state.cars = drawCars(); }
    if (act === 'lock-target') state.phase = 'pass';
    if (act === 'to-guess') { state.guess = 50; state.phase = 'guess'; }
    if (act === 'lock-guess') {
      const points = pointsFor(Math.abs(state.guess - state.target));
      state.score += points;
      state.history.push({ axis: axis(), car: state.car, giver: giver(), target: state.target, guess: state.guess, points });
      state.phase = 'reveal';
    }
    if (act === 'next') {
      state.round++;
      if (state.round >= state.rounds) return end();
      return newRound();
    }
    render();
  });
  $('stage').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pick]')) { e.preventDefault(); e.target.click(); }
  });

  // ---------- end ----------
  function end() {
    const max = state.rounds * 4;
    const ratio = state.score / max;
    $('end-title').textContent = `${state.score} din ${max}`;
    $('end-sub').textContent = ratio >= .75 ? 'Sunteți pe aceeași turație. Vă știți gândurile.'
      : ratio >= .5 ? 'Ați prins bine turația în cele mai multe runde.'
      : ratio >= .25 ? 'Mai e de lucru la sincronizare.'
      : 'Fiecare a mers pe alt drum.';
    $('recap').innerHTML = state.history.map(h => `
      <li>
        <span class="recap-axis">${esc(h.axis.l)} ↔ ${esc(h.axis.r)}</span>
        <span class="recap-car">${esc(h.car.name)} <em>de ${esc(h.giver)}</em></span>
        <span class="turo-points p${h.points}">+${h.points}</span>
      </li>`).join('');
    show('screen-end');
  }

  $('btn-again').addEventListener('click', start);
  $('btn-setup').addEventListener('click', () => { renderNames(); show('screen-setup'); });
  $('btn-quit').addEventListener('click', () => {
    if (confirm(I18n.t('Ieși? Scorul se pierde.'))) { renderNames(); show('screen-setup'); }
  });

  renderNames();
})();
