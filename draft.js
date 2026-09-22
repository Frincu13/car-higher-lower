(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, makeTimer } = window.Shared;

  const { ATTRS, points, complete } = window.Grades;
  const ROUNDS = ATTRS.length;

  const all = (window.CARS || []).filter(complete);
  // Prefer cars with a photo; the pool is large enough without the rest.
  const withPhoto = all.filter(c => c.image);
  const POOL = withPhoto.length >= 100 ? withPhoto : all;

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

  // Optional clock: a few seconds per turn. When it runs out the car lands on its own,
  // in a free slot, so the game never waits on someone who walked away.
  const TIMER_SECS = 20;
  const TIMER_OPTS = [[false, 'Fără', 'Fără limită de timp'], [true, `${TIMER_SECS} de secunde`, 'Pe fiecare alegere']];
  const clock = makeTimer({
    box: $('hud-timer'), bar: $('timer-bar'), num: $('timer-num'),
    onEnd: () => autoPlace(),
  });
  const state = {
    timed: store.get('draft_timer', false),
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
    state.nextPair = null;
    newRound();
    show('screen-draft');
  }

  function newRound() {
    // The next pair is drawn a round early so its photos are already downloaded.
    state.pair = state.nextPair || drawPair();
    state.nextPair = state.round + 1 < ROUNDS ? drawPair() : null;
    (state.nextPair || []).forEach(preload);
    state.phase = 'pick';
    state.selected = null;
    state.taken = null;
    render();
    startClock();
  }

  // ---------- render ----------
  function render() {
    const p = current();
    $('round-label').textContent = `${state.round + 1} / ${ROUNDS}`;
    $('turn-label').innerHTML = `<span class="hud-k">Rândul lui</span><span class="turn-name p${p}">${esc(nameOf(p))}</span>`;
    $('draft-grid').className = `draft-grid turn-${p}`;

    $('pick-prompt').innerHTML = state.phase === 'pick'
      ? ''
      : `Rămâne la <strong class="p${p}">${esc(nameOf(p))}</strong>`;

    if (state.phase === 'rest') state.selected = 1 - state.taken;
    // Both cars stay on screen the whole round, so nothing jumps: the one already
    // taken is dimmed. Cards are rebuilt only when the pair changes (photos stay put).
    const box = $('pick-cars');
    const pairKey = state.pair.map(c => c.id).join();
    if (box.dataset.pair !== pairKey) {
      box.dataset.pair = pairKey;
      // A div, not a <button>: the photo credit link inside must stay a valid link.
      box.innerHTML = state.pair.map((car, i) => `
        <div role="button" tabindex="0" class="pick-card" data-car="${i}">
          ${artHTML(car)}
          <span class="pick-taken"></span>
          <span class="pick-body">
            <span class="brand">${esc(brandOf(car.name))}</span>
            <span class="pick-model">${esc(modelOf(car.name) || car.name)}</span>
            <span class="meta">${[car.years, car.engine].filter(Boolean).map(esc).join(' • ')}</span>
          </span>
        </div>`).join('');
      wirePhotos(box);
      box.querySelectorAll('.art-credit').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    }
    box.className = `pick-cars phase-${state.phase}`;
    box.querySelectorAll('.pick-card').forEach((el, i) => {
      const taken = state.phase === 'rest' && i === state.taken;
      const on = state.selected === i;
      el.className = `pick-card p${taken ? chooser() : p}${on ? ' is-selected' : ''}${taken ? ' is-taken' : ''}`;
      el.setAttribute('aria-pressed', on);
      el.querySelector('.pick-taken').textContent = taken ? nameOf(chooser()) : '';
    });

    [0, 1].forEach(i => renderBoard(i, i === p));
  }

  function renderBoard(i, active) {
    const board = state.boards[i];
    const canPlace = active && state.selected !== null;
    const filled = Object.keys(board).length;
    const open = $(`board-${i}`).classList.contains('is-open') && !active;
    $(`board-${i}`).className = `board p${i}${active ? ' is-active' : ''}${open ? ' is-open' : ''}`;
    // Phones: the waiting player's board shrinks to one row of grades (tap to see it all).
    const mini = ATTRS.map(a => {
      const car = board[a.key];
      return `<span class="mini${car ? ' is-filled' : ''}">${car ? fmt(points(a, car) / 10, 1) : ''}</span>`;
    }).join('');
    $(`board-${i}`).innerHTML = `
      <div class="board-head"><span class="board-name">${esc(nameOf(i))}</span><span class="board-count">${filled} / ${ROUNDS}</span></div>
      <div class="board-mini" aria-hidden="true">${mini}</div>
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
          <span class="slot-label">${esc(a.label)}</span><span class="slot-car slot-empty">${canPlace ? '+' : 'Liber'}</span></button>${info}</li>`;
      }).join('')}</ul>`;
  }

  // ---------- actions ----------
  $('pick-cars').addEventListener('click', e => {
    const btn = e.target.closest('[data-car]');
    if (!btn || state.phase !== 'pick' || state.locked) return;
    state.selected = Number(btn.dataset.car);
    haptic();
    render();
  });

  $('pick-cars').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-car]')) { e.preventDefault(); e.target.click(); }
  });

  document.querySelectorAll('.board').forEach(el => el.addEventListener('click', e => {
    const slot = e.target.closest('[data-slot]');
    // The waiting player's board (compact on phones): a tap opens or closes it.
    if (!el.classList.contains('is-active')) {
      if (!e.target.closest('.slot-info')) el.classList.toggle('is-open');
      return;
    }
    if (!slot || slot.disabled || state.selected === null || state.locked) return;
    placeCar(state.selected, slot.dataset.slot);
  }));

  function placeCar(carIndex, slotKey) {
    const p = current();
    const attr = ATTRS.find(a => a.key === slotKey);
    const car = state.pair[carIndex];
    state.boards[p][attr.key] = car;
    clock.stop();
    showGrade(p, attr, car, () => {
      if (state.phase === 'pick') {
        state.taken = carIndex;
        state.phase = 'rest';
        state.selected = null;
        render();
        startClock();
        return;
      }
      state.round++;
      if (state.round >= ROUNDS) return results();
      newRound();
    });
  }

  // Out of time: the car on the table goes into a free slot, picked at random.
  function autoPlace() {
    if (state.locked) return;
    const p = current();
    const carIndex = state.selected !== null ? state.selected : Math.floor(Math.random() * state.pair.length);
    const free = ATTRS.filter(a => !state.boards[p][a.key]);
    if (!free.length) return;
    haptic('error');
    placeCar(carIndex, free[Math.floor(Math.random() * free.length)].key);
  }

  const startClock = () => { if (state.timed) clock.start(TIMER_SECS); else clock.hide(); };

  // After a car is placed the grade stays on screen for a moment before the turn
  // passes (a tap skips it): everyone wants to see how good the pick was.
  function showGrade(p, attr, car, next) {
    state.locked = true;
    const sel = state.selected;
    state.selected = null;          // slots inert while the grade shows
    renderBoard(p, true);
    state.selected = sel;
    const g = points(attr, car) / 10;
    const best = ATTRS.reduce((b, a) => (points(a, car) > points(b, car) ? a : b), attr);
    const tier = g >= 7 ? 'hi' : g >= 4 ? 'mid' : 'lo';
    haptic(tier === 'lo' ? 'error' : 'success');
    const board = $(`board-${p}`);
    board.querySelectorAll('.slot-item')[ATTRS.indexOf(attr)]?.classList.add('is-new');
    const flash = document.createElement('div');
    flash.className = `grade-flash ${tier}`;
    flash.innerHTML = `<span class="gf-k">${esc(attr.label)}</span><strong>${fmt(g, 1)}</strong>` +
      (best !== attr ? `<span class="gf-best">Maxim ${fmt(points(best, car) / 10, 1)} la ${esc(best.label)}</span>` : '<span class="gf-best">Cel mai bun slot</span>');
    board.appendChild(flash);
    let done = false;
    const finish = e => {
      if (done) return;
      // A tap that skips the grade must not also select a card on the next screen.
      if (e) {
        const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', eat, true), 600);
      }
      done = true; state.locked = false;
      clearTimeout(timer);
      document.removeEventListener('pointerdown', finish, true);
      next();
    };
    const timer = setTimeout(() => finish(), 4000);
    setTimeout(() => document.addEventListener('pointerdown', finish, true), 150);
  }

  // ---------- results ----------
  function results() {
    clock.hide();
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
        <p class="result-best">${s.best > s.total ? `Maxim posibil <strong>${fmt(grade(s.best), 1)}</strong>` : 'Aranjare perfectă'}</p>
        <ul class="result-rows">${s.rows.map(r => `
          <li>
            <span class="slot-label">${esc(r.attr.label)}</span>
            <span class="result-car" title="${esc(r.car.name)}">${esc(r.car.name)}${r.attr.show ? ` <em>${esc(r.attr.show(r.attr.get(r.car), r.car))}</em>` : ''}</span>
            <span class="result-bar" style="--pts:${r.pts}"><span>${fmt(r.pts / 10, 1)}</span></span>
          </li>`).join('')}
        </ul>
      </section>`).join('');
    show('screen-results');
  }

  // ---------- wiring ----------
  [0, 1].forEach(i => { $(`name-${i}`).value = state.names[i] || ''; });
  function renderTimer() {
    $('d-timer').innerHTML = TIMER_OPTS.map(([v, name, sub]) => {
      const on = v === state.timed;
      return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-timer="${v}">
        <span class="cat-name">${esc(name)}</span>
        <span class="cat-sub">${esc(sub)}</span>
      </button>`;
    }).join('');
  }
  $('d-timer').addEventListener('click', e => {
    const b = e.target.closest('[data-timer]'); if (!b) return;
    state.timed = b.dataset.timer === 'true'; store.set('draft_timer', state.timed); haptic(); renderTimer();
  });

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
    if (state.round === 0 && state.phase === 'pick' || confirm(I18n.t('Ieși? Jocul se pierde.'))) { clock.hide(); renderTimer(); show('screen-setup'); }
  });
  renderTimer();
})();
