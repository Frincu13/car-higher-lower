(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos } = window.Shared;

  // Real figures where they exist; Forza Horizon 5 ratings (0-10) for qualities
  // that have no single real-world number.
  const rating = key => c => c.ratings && c.ratings[key];
  const ATTRS = [
    { key: 'hp',       label: 'Putere',          get: c => c.hp,     show: v => `${fmt(v, 0)} CP` },
    { key: 'torque',   label: 'Cuplu',           get: c => c.torque, show: v => `${fmt(v, 0)} Nm` },
    { key: 'weight',   label: 'Lejeritate',      get: c => c.weight, show: v => `${fmt(v, 0)} kg`, lowerIsBetter: true },
    { key: 'speed',    label: 'Viteză',          get: rating('speed'),    show: v => `${fmt(v, 1)} / 10` },
    { key: 'accel',    label: 'Accelerație',     get: rating('accel'),    show: v => `${fmt(v, 1)} / 10` },
    { key: 'handling', label: 'Manevrabilitate', get: rating('handling'), show: v => `${fmt(v, 1)} / 10` },
    { key: 'braking',  label: 'Frânare',         get: rating('braking'),  show: v => `${fmt(v, 1)} / 10` },
    { key: 'offroad',  label: 'Off-road',        get: rating('offroad'),  show: v => `${fmt(v, 1)} / 10` },
  ];
  const ROUNDS = ATTRS.length;

  const complete = c => ATTRS.every(a => a.get(c) != null);
  const all = (window.CARS || []).filter(complete);
  // Prefer cars with a photo; the pool is large enough without the rest.
  const withPhoto = all.filter(c => c.image);
  const POOL = withPhoto.length >= 100 ? withPhoto : all;

  // Points 0-100 = share of all complete cars this car beats in that attribute
  // (ties count half). Ranked against every eligible car, not only the pool.
  const sorted = Object.fromEntries(ATTRS.map(a => [a.key, all.map(a.get).sort((x, y) => x - y)]));
  function points(attr, car) {
    const arr = sorted[attr.key], v = attr.get(car), n = arr.length;
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    let eq = lo; while (eq < n && arr[eq] === v) eq++;
    const below = lo, equal = eq - lo - 1; // excluding the car itself
    const beaten = attr.lowerIsBetter ? n - eq : below;
    return Math.round(((beaten + equal / 2) / (n - 1)) * 100);
  }

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
        if (car) return `<li class="slot is-filled"><span class="slot-label">${esc(a.label)}</span><span class="slot-car">${esc(car.name)}</span></li>`;
        return `<li><button type="button" class="slot" data-slot="${a.key}" ${canPlace ? '' : 'disabled'}>
          <span class="slot-label">${esc(a.label)}</span><span class="slot-car slot-empty">${canPlace ? 'Pune aici' : 'Liber'}</span></button></li>`;
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
    const [a, b] = scores.map(s => grade(s.total));
    $('winner').innerHTML = Math.abs(a - b) < 0.05
      ? 'Egalitate'
      : `Câștigă <span class="p${a > b ? 0 : 1}">${esc(nameOf(a > b ? 0 : 1))}</span>`;

    $('results-grid').innerHTML = scores.map((s, i) => `
      <section class="result p${i}${grade(s.total) >= Math.max(a, b) ? ' is-winner' : ''}">
        <header class="result-head">
          <span class="board-name">${esc(nameOf(i))}</span>
          <span class="result-grade">${fmt(grade(s.total), 1)}<small>/10</small></span>
        </header>
        <p class="result-best">Maxim posibil cu aceleași mașini: <strong>${fmt(grade(s.best), 1)}</strong>
          ${s.best > s.total ? `(ai obținut ${Math.round((s.total / s.best) * 100)}%)` : '(aranjare perfectă)'}</p>
        <ul class="result-rows">${s.rows.map(r => `
          <li>
            <span class="slot-label">${esc(r.attr.label)}</span>
            <span class="result-car">${esc(r.car.name)} <em>${esc(r.attr.show(r.attr.get(r.car)))}</em></span>
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
