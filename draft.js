(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos } = window.Shared;

  // Grades are absolute: a fixed scale per attribute, so a car's grade never depends
  // on which other cars happen to be in the list. Real figures (hp, Nm, kg) use log
  // scales anchored on real-world extremes; the 0-10 ratings are already absolute and
  // are used as they are. Raw ratings are never shown next to the grade.
  const rating = key => c => c.ratings && c.ratings[key];
  const clamp = v => Math.max(0, Math.min(10, v));
  // 0 at `lo`, 10 at `hi`, logarithmic in between (doubling power adds the same amount).
  const logScale = (lo, hi) => v => clamp(10 * Math.log(v / lo) / Math.log(hi / lo));
  // Off-road grade band per car type: [grade low, grade high, raw rating mapped to low, to high].
  // Fixed numbers, so a grade never depends on which other cars are in the list.
  const OFFROAD_BANDS = {
    supercar:     [0,   2,   3.5, 5.7],  // hypercars, supercars, track cars, race cars
    sport:        [1.5, 3.5, 4.0, 6.3],  // sports cars, GT, muscle
    road:         [3,   4.5, 4.4, 6.4],  // saloons, hot hatches, everyday cars
    classic:      [2,   5,   4.2, 7.0],  // rare classics, cult cars (Beetle, Mini, 2CV...)
    utility:      [3,   5,   5.0, 6.6],  // vans and work vehicles
    suvSport:     [5.5, 7,   5.6, 7.2],  // road-biased SUVs: Urus, X6 M, Cayenne
    rally:        [5,   8,   5.0, 8.1],  // road rally homologations (Evo, Impreza) low, real rally cars high
    rallyMonster: [7.5, 9,   6.8, 8.5],
    offroad4x4:   [7.5, 9.5, 5.7, 9.4],  // Wrangler, Defender, Raptor, pickups
    extreme:      [9,   10,  5.9, 10],   // trophy trucks, buggies, UTVs
  };
  const ATTRS = [
    { key: 'hp',       label: 'Putere',          get: c => c.hp,     show: v => `${fmt(v, 0)} CP`,
      score: logScale(50, 1500), // 150 CP ≈ 3, 300 CP ≈ 5, 700 CP ≈ 8, 1500 CP = 10
      tip: 'Caii putere ai motorului.' },
    { key: 'torque',   label: 'Cuplu',           get: c => c.torque, show: v => `${fmt(v, 0)} Nm`,
      score: logScale(60, 1600),
      tip: 'Forța cu care motorul împinge mașina. Se simte la plecarea de pe loc.' },
    { key: 'weight',   label: 'Greutate',        get: c => c.weight, show: v => `${fmt(v, 0)} kg`,
      score: w => logScale(700, 2800)(2800 * 700 / w), // mirrored: 700 kg = 10, 2.800 kg = 0
      tip: 'Greutatea mașinii. Mașinile mai ușoare iau note mai mari.' },
    { key: 'speed',    label: 'Viteză maximă',   get: rating('speed'),    score: v => v,
      tip: 'Viteza maximă pe care o poate atinge mașina.' },
    // Real 0-100 time (or an estimate from power and weight when it is missing), not the
    // in-game acceleration rating: that one penalises rear-wheel drive so much that a
    // 3.9 s BMW M4 scored below a 4.7 s Golf R. 2.3 s = 10, 12 s = 0, linear.
    { key: 'accel',    label: 'Accelerație',     get: c => c.accel ?? c.accelEst,
      score: t => clamp(10 * (12 - t) / (12 - 2.3)),
      tip: 'Cât de repede ajunge de la 0 la 100 km/h.' },
    { key: 'handling', label: 'Manevrabilitate', get: rating('handling'), score: v => v,
      tip: 'Cât de bine ține drumul și intră în viraje.' },
    { key: 'braking',  label: 'Frânare',         get: rating('braking'),  score: v => v,
      tip: 'Cât de repede oprește.' },
    // The raw rating barely separates types (a Urus and a sedan are both around 6), so
    // the car's type sets the band and the rating only places it inside that band.
    { key: 'offroad',  label: 'Off-road',        get: c => (c.ratings && c.offroadKind ? c : null),
      score: c => {
        if (c.offroadGrade != null) return c.offroadGrade; // manual fix for a bad source value
        const [lo, hi, from, to] = OFFROAD_BANDS[c.offroadKind] || OFFROAD_BANDS.sport;
        const t = Math.max(0, Math.min(1, (c.ratings.offroad - from) / (to - from)));
        return lo + (hi - lo) * t;
      },
      tip: 'Cât de bine merge pe pământ, nisip sau iarbă.' },
  ];
  const ROUNDS = ATTRS.length;

  const complete = c => ATTRS.every(a => a.get(c) != null);
  const all = (window.CARS || []).filter(complete);
  // Prefer cars with a photo; the pool is large enough without the rest.
  const withPhoto = all.filter(c => c.image);
  const POOL = withPhoto.length >= 100 ? withPhoto : all;

  // Points 0-100 = the slot grade × 10, whole numbers, so a slot grade has exactly one
  // decimal and the final grade is exactly the average of the slot grades players see.
  const points = (attr, car) => Math.round(attr.score(attr.get(car)) * 10);

  // Best total the same 8 cars could reach: assignment by DP over used slots.
  function bestTotal(cars) {
    const n = ATTRS.length, size = 1 << n;
    const dp = new Array(size).fill(-1); dp[0] = 0;
    for (let mask = 0; mask < size; mask++) {
      if (dp[mask] < 0) continue;
      const i = popcount(mask);
      if (i >= cars.length) continue;
      for (let s = 0; s < n; s++) {
        if (mask & (1 << s)) continue;
        const next = mask | (1 << s), val = dp[mask] + points(ATTRS[s], cars[i]);
        if (val > dp[next]) dp[next] = val;
      }
    }
    return dp[size - 1];
  }
  const popcount = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const grade = total => total / ATTRS.length / 10; // 0-10

  const $ = id => document.getElementById(id);
  const state = {
    names: store.get('draft_names', ['', '']),
    boards: [{}, {}],   // attr key -> car
    round: 0,
    pair: [],
    phase: 'pick',      // 'pick': chooser takes one of two; 'rest': other player places the leftover
    selected: null,     // index into pair
    taken: null,        // index taken by the chooser this round
    used: new Set(),
  };

  const nameOf = i => state.names[i] || `Jucător ${i + 1}`;
  const chooser = () => state.round % 2;
  const current = () => state.phase === 'pick' ? chooser() : 1 - chooser();

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
    window.scrollTo(0, 0);
  }

  function drawPair() {
    const avail = POOL.filter(c => !state.used.has(c.id));
    const pick = () => avail.splice(Math.floor(Math.random() * avail.length), 1)[0];
    const pair = [pick(), pick()];
    pair.forEach(c => state.used.add(c.id));
    return pair;
  }

  function start() {
    state.boards = [{}, {}];
    state.round = 0;
    state.used = new Set();
    newRound();
    show('screen-draft');
  }

  function newRound() {
    state.pair = drawPair();
    state.phase = 'pick';
    state.selected = null;
    state.taken = null;
    render();
  }

  // ---------- render ----------
  function render() {
    const p = current();
    $('round-label').textContent = `${state.round + 1} / ${ROUNDS}`;
    $('turn-label').innerHTML = `<span class="hud-k">Rândul lui</span><span class="turn-name p${p}">${esc(nameOf(p))}</span>`;
    $('draft-grid').className = `draft-grid turn-${p}`;

    $('pick-prompt').innerHTML = state.phase === 'pick'
      ? `<strong class="p${p}">${esc(nameOf(p))}</strong>, alege una dintre mașini și pune-o într-un slot liber.`
      : `<strong class="p${p}">${esc(nameOf(p))}</strong>, ți-a rămas mașina asta. Pune-o într-un slot liber.`;

    const cars = state.phase === 'pick' ? [0, 1] : [1 - state.taken];
    if (state.phase === 'rest') state.selected = 1 - state.taken;
    $('pick-cars').className = `pick-cars count-${cars.length}`;
    $('pick-cars').innerHTML = cars.map(i => {
      const car = state.pair[i];
      const on = state.selected === i;
      // A div, not a <button>: the photo credit link inside must stay a valid link.
      return `<div role="button" tabindex="0" class="pick-card p${p}${on ? ' is-selected' : ''}" data-car="${i}" aria-pressed="${on}">
        ${artHTML(car)}
        <span class="pick-body">
          <span class="brand">${esc(brandOf(car.name))}</span>
          <span class="pick-model">${esc(modelOf(car.name) || car.name)}</span>
          <span class="meta">${[car.years, car.engine].filter(Boolean).map(esc).join(' • ')}</span>
        </span>
      </div>`;
    }).join('');
    wirePhotos($('pick-cars'));
    $('pick-cars').querySelectorAll('.art-credit').forEach(a => a.addEventListener('click', e => e.stopPropagation()));

    [0, 1].forEach(i => renderBoard(i, i === p));
  }

  function renderBoard(i, active) {
    const board = state.boards[i];
    const canPlace = active && state.selected !== null;
    const filled = Object.keys(board).length;
    $(`board-${i}`).className = `board p${i}${active ? ' is-active' : ''}`;
    $(`board-${i}`).innerHTML = `
      <div class="board-head"><span class="board-name">${esc(nameOf(i))}</span><span class="board-count">${filled} / ${ROUNDS}</span></div>
      <ul class="slots">${ATTRS.map(a => {
        const car = board[a.key];
        // The info icon sits next to the slot, not inside it: a slot is a button and
        // tapping the icon on a phone must not place the car.
        const tipId = `tip-${i}-${a.key}`;
        const info = `<span class="slot-info" tabindex="0" aria-label="Ce înseamnă ${esc(a.label)}" aria-describedby="${tipId}">i</span>
          <span class="slot-tip" id="${tipId}" role="tooltip">${esc(a.tip)}</span>`;
        if (car) {
          const grade = points(a, car) / 10;
          return `<li class="slot-item">
            <div class="slot is-filled">
              <span class="slot-label">${esc(a.label)}</span>
              <span class="slot-car">${esc(car.name)}</span>
              <span class="slot-grade" title="Nota în acest slot">${fmt(grade, 1)}</span>
            </div>${info}</li>`;
        }
        return `<li class="slot-item"><button type="button" class="slot" data-slot="${a.key}" ${canPlace ? '' : 'disabled'}>
          <span class="slot-label">${esc(a.label)}</span><span class="slot-car slot-empty">${canPlace ? 'Pune aici' : 'Liber'}</span></button>${info}</li>`;
      }).join('')}</ul>`;
  }

  // ---------- actions ----------
  $('pick-cars').addEventListener('click', e => {
    const btn = e.target.closest('[data-car]');
    if (!btn || state.phase !== 'pick') return;
    state.selected = Number(btn.dataset.car);
    render();
    // On a phone the board is below the cars: bring the slots into view.
    const board = $(`board-${current()}`);
    if (board.getBoundingClientRect().top > window.innerHeight * 0.7) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('pick-cars').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-car]')) { e.preventDefault(); e.target.click(); }
  });

  document.querySelectorAll('.board').forEach(el => el.addEventListener('click', e => {
    const slot = e.target.closest('[data-slot]');
    if (!slot || slot.disabled || state.selected === null) return;
    const p = current();
    state.boards[p][slot.dataset.slot] = state.pair[state.selected];

    if (state.phase === 'pick') {
      state.taken = state.selected;
      state.phase = 'rest';
      state.selected = null;
      render();
      $('pick-cars').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    state.round++;
    if (state.round >= ROUNDS) return results();
    newRound();
    $('pick-cars').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  // ---------- results ----------
  function results() {
    const scores = [0, 1].map(i => {
      const rows = ATTRS.map(a => ({ attr: a, car: state.boards[i][a.key], pts: points(a, state.boards[i][a.key]) }));
      const total = rows.reduce((s, r) => s + r.pts, 0);
      const best = bestTotal(ATTRS.map(a => state.boards[i][a.key]));
      return { rows, total, best };
    });
    // Decide on the grades as shown (one decimal): 5,5 vs 5,5 is a tie for the players,
    // even if the unrounded averages differ by a few hundredths.
    const shown = scores.map(s => Math.round(grade(s.total) * 10));
    const [a, b] = shown;
    $('winner').innerHTML = a === b
      ? 'Egalitate'
      : `Câștigă <span class="p${a > b ? 0 : 1}">${esc(nameOf(a > b ? 0 : 1))}</span>`;

    $('results-grid').innerHTML = scores.map((s, i) => `
      <section class="result p${i}${shown[i] === Math.max(a, b) ? ' is-winner' : ''}">
        <header class="result-head">
          <span class="board-name">${esc(nameOf(i))}</span>
          <span class="result-grade">${fmt(grade(s.total), 1)}<small>/10</small></span>
        </header>
        <p class="result-best">Maxim posibil cu aceleași mașini: <strong>${fmt(grade(s.best), 1)}</strong>
          ${s.best > s.total ? `(ai obținut ${Math.round((s.total / s.best) * 100)}%)` : '(aranjare perfectă)'}</p>
        <ul class="result-rows">${s.rows.map(r => `
          <li>
            <span class="slot-label">${esc(r.attr.label)}</span>
            <span class="result-car" title="${esc(r.car.name)}">${esc(r.car.name)}${r.attr.show ? ` <em>${esc(r.attr.show(r.attr.get(r.car)))}</em>` : ''}</span>
            <span class="result-bar" style="--pts:${r.pts}"><span>${fmt(r.pts / 10, 1)}</span></span>
          </li>`).join('')}
        </ul>
      </section>`).join('');
    show('screen-results');
  }

  // ---------- wiring ----------
  [0, 1].forEach(i => { $(`name-${i}`).value = state.names[i] || ''; });
  $('setup-form').addEventListener('submit', e => {
    e.preventDefault();
    state.names = [0, 1].map(i => $(`name-${i}`).value.trim());
    store.set('draft_names', state.names);
    start();
  });
  // Rematch swaps seats so the other player gets first pick in round 1.
  $('btn-rematch').addEventListener('click', () => { state.names.reverse(); store.set('draft_names', state.names); start(); });
  $('btn-setup').addEventListener('click', () => {
    [0, 1].forEach(i => { $(`name-${i}`).value = state.names[i] || ''; });
    show('screen-setup');
  });
  $('btn-quit').addEventListener('click', () => {
    if (state.round === 0 && state.phase === 'pick' || confirm('Ieși din joc? Runda curentă se pierde.')) show('screen-setup');
  });
})();
