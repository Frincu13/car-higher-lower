(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, shuffle, makeTimer } = window.Shared;
  const CARS = (window.CARS || []).filter(c => c.image);

  // dir 'desc': the biggest number sits on top. For 0-100 the quickest time is on top.
  const CATS = {
    hp:     { label: 'Cai putere', unit: 'CP', dec: 0, dir: 'desc', top: 'Mai puternică', bottom: 'Mai slabă' },
    weight: { label: 'Greutate',   unit: 'kg', dec: 0, dir: 'desc', top: 'Mai grea',      bottom: 'Mai ușoară' },
    accel:  { label: '0-100 km/h', unit: 's',  dec: 1, dir: 'asc',  top: 'Mai rapidă',    bottom: 'Mai lentă' },
  };
  const MODES = { solo: ['Singur', 'Cât de lung îl faci'], duo: ['1 la 1', 'Pe rând, pe același telefon'] };

  const $ = id => document.getElementById(id);
  const state = {
    cat: store.get('ord_cat', 'hp'),
    mode: store.get('ord_mode', 'solo'),
    names: store.get('ord_names', ['', '']),
    list: [], next: null, used: new Set(),
    gap: 0, turn: 0, placed: 0, locked: false, best: 0,
    timed: store.get('ord_timer', false),
    run: null,       // the run in progress, in the shape a leaderboard wants
  };
  const cat = () => CATS[state.cat];
  const key = v => (cat().dir === 'desc' ? -v : v);
  // Optional clock: a few seconds per car, and running out counts as a wrong place.
  const TIMER_SECS = 15;
  const TIMER_OPTS = [[false, 'Fără', 'Fără limită de timp'], [true, `${TIMER_SECS} secunde`, 'Pe fiecare mașină']];
  const clock = makeTimer({
    box: $('hud-timer'), bar: $('timer-bar'), num: $('timer-num'),
    onEnd: () => place(true),
  });
  // One board per category and clock; the duo game keeps no record.
  const boardOf = (k = state.cat, timed = state.timed) => `ordine:${k}:${timed ? `t${TIMER_SECS}` : 'free'}`;

  const val = c => c[state.cat];
  const nameOf = i => (state.names[i] || '').trim() || `Jucător ${i + 1}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // ---------- setup ----------
  function renderSetup() {
    $('ord-cats').innerHTML = Object.entries(CATS).map(([k, c]) => {
      const best = Scores.load(boardOf(k));
      const on = k === state.cat;
      return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-cat="${k}">
        <span class="cat-name">${esc(c.label)}</span>
        <span class="cat-sub">${esc(c.top)} sus</span>
        <span class="cat-best">${best ? `Record ${best.score}${best.timeMs != null ? ` · ${Scores.time(best.timeMs)}` : ''}` : '&nbsp;'}</span>
      </button>`;
    }).join('');
    $('ord-modes').innerHTML = Object.entries(MODES).map(([k, [label, sub]]) => {
      const on = k === state.mode;
      return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-mode="${k}">
        <span class="cat-name">${esc(label)}</span><span class="cat-sub">${esc(sub)}</span>
      </button>`;
    }).join('');
    $('ord-timer').innerHTML = TIMER_OPTS.map(([v, name, sub]) => {
      const on = v === state.timed;
      return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-timer="${v}">
        <span class="cat-name">${esc(name)}</span>
        <span class="cat-sub">${esc(sub)}</span>
      </button>`;
    }).join('');
    $('ord-form').classList.toggle('is-duo', state.mode === 'duo');
    [0, 1].forEach(i => { $(`o-name-${i}`).value = state.names[i] || ''; });
  }
  $('ord-cats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    state.cat = b.dataset.cat; store.set('ord_cat', state.cat); haptic(); renderSetup();
  });
  $('ord-modes').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    state.mode = b.dataset.mode; store.set('ord_mode', state.mode); haptic(); renderSetup();
  });
  $('ord-timer').addEventListener('click', e => {
    const b = e.target.closest('[data-timer]'); if (!b) return;
    state.timed = b.dataset.timer === 'true'; store.set('ord_timer', state.timed); haptic(); renderSetup();
  });
  $('ord-form').addEventListener('submit', e => {
    e.preventDefault();
    state.names = [0, 1].map(i => $(`o-name-${i}`).value);
    store.set('ord_names', state.names);
    start();
  });

  // ---------- cars ----------
  // A name that already contains the answer (McLaren 720S at 720 CP) never comes up.
  const leaks = c => (c.name.match(/\d+(?:[.,]\d+)?/g) || []).some(t => {
    const n = parseFloat(t.replace(',', '.')); return n >= 50 && Math.abs(n - val(c)) / val(c) <= 0.02;
  });
  const pool = () => CARS.filter(c => val(c) != null && !leaks(c));
  function pickNext() {
    const taken = new Set(state.list.map(val));
    let cands = pool().filter(c => !state.used.has(c.id) && !taken.has(val(c)));
    if (!cands.length) { state.used = new Set(state.list.map(c => c.id)); cands = pool().filter(c => !state.used.has(c.id)); }
    const c = cands[Math.floor(Math.random() * cands.length)];
    state.used.add(c.id);
    return c;
  }

  function start() {
    state.used = new Set(); state.placed = 0; state.turn = 0; state.locked = false;
    Scores.migrate(`ord_best_${state.cat}`, boardOf(state.cat, false));
    state.best = (Scores.load(boardOf()) || {}).score || 0;
    state.run = Scores.start({
      game: 'ordine', board: boardOf(), mode: state.mode, cat: state.cat,
      timed: state.timed, seconds: state.timed ? TIMER_SECS : 0,
    });
    // Two starting cars far enough apart to leave room on both sides.
    const p = shuffle(pool().slice());
    const a = p[0], b = p.find(c => Math.abs(Math.log(val(c) / val(a))) > 0.3);
    state.list = [a, b].sort((x, y) => key(val(x)) - key(val(y)));
    state.list.forEach(c => state.used.add(c.id));
    state.next = pickNext();
    $('o-over').hidden = true;
    show('screen-play');
    $('o-cat').textContent = cat().label;
    $('o-top').innerHTML = `&#9650; ${esc(cat().top)}`;
    $('o-bottom').innerHTML = `&#9660; ${esc(cat().bottom)}`;
    renderHud();
    renderCard(true);
    renderLadder();
    requestAnimationFrame(() => centerGap(1, false));
  }

  // ---------- render ----------
  const value = c => `${fmt(val(c), cat().dec)}<small>${esc(cat().unit)}</small>`;

  function renderHud() {
    $('o-hud-right').innerHTML = state.mode === 'duo'
      ? `<div class="hud-turn"><span class="hud-k">Rândul lui</span><span class="turn-name p${state.turn}">${esc(nameOf(state.turn))}</span></div>`
      : `<div><span class="hud-k">Scor</span><span class="hud-v">${state.placed}</span></div>
         <div><span class="hud-k">Record</span><span class="hud-v">${Math.max(state.best, state.placed)}</span></div>`;
  }

  function renderCard(entering) {
    const c = state.next;
    $('o-new').className = `ord-new${entering ? ' is-entering' : ''}${state.mode === 'duo' ? ` p${state.turn}` : ''}`;
    $('o-new').innerHTML = `
      ${artHTML(c)}
      <div class="ord-new-text">
        <span class="brand">${esc(brandOf(c.name))}</span>
        <span class="ord-new-model">${esc(modelOf(c.name) || c.name)}</span>
        <span class="meta">${esc(c.years)}</span>
        <span class="ord-new-val"><span class="q">?</span><span class="a">${value(c)}</span></span>
      </div>
      <div class="ord-meta">
        <span><b>${esc(cat().label)}</b>${esc(cat().top)}</span>
        ${state.mode === 'duo'
          ? `<span><b>Rândul lui</b><i class="p${state.turn}">${esc(nameOf(state.turn))}</i></span>`
          : `<span><b>Puse</b>${state.placed}</span><span><b>Record</b>${Math.max(state.best, state.placed)}</span>`}
      </div>`;
    wirePhotos($('o-new'));
    $('o-new').querySelectorAll('.art-credit a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    preload(c);
    clock.start(state.timed ? TIMER_SECS : 0);   // untimed runs are still measured
  }

  const GAP = 34;
  function renderLadder(newIndex = -1) {
    const L = state.list;
    const rung = (c, i) => `
      <div class="rung${i === newIndex ? ' is-new' : ''}">
        <span class="rung-pos">${i + 1}</span>
        <span class="rung-img"><img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"></span>
        <span class="rung-name"><b>${esc(brandOf(c.name))}</b><span>${esc(modelOf(c.name) || c.name)}</span></span>
        <span class="rung-val">${value(c)}</span>
      </div>`;
    const gap = k => `<div class="gap" data-g="${k}"><span>Aici</span></div>`;
    $('o-ladder').innerHTML = L.map((c, i) => gap(i) + rung(c, i)).join('') + gap(L.length);
    sizeLadder();
    markGap();
  }

  // Padding so the first and the last gap can reach the aim line in the middle.
  function sizeLadder() {
    const h = $('o-ladder').clientHeight;
    $('o-ladder').style.setProperty('--pad', `${Math.max(0, h / 2 - GAP / 2)}px`);
  }
  window.addEventListener('resize', () => { if (state.list.length) { sizeLadder(); centerGap(state.gap, false); } });

  const gaps = () => [...$('o-ladder').querySelectorAll('.gap')];
  function centerGap(k, smooth = true) {
    const g = gaps()[Math.max(0, Math.min(k, gaps().length - 1))];
    if (!g) return;
    const L = $('o-ladder');
    L.scrollTo({ top: g.offsetTop + g.offsetHeight / 2 - L.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
    if (!smooth) { state.gap = +g.dataset.g; markGap(); }
  }
  function nearestGap() {
    const L = $('o-ladder'), mid = L.scrollTop + L.clientHeight / 2;
    let best = 0, bd = Infinity;
    gaps().forEach((g, k) => { const d = Math.abs(g.offsetTop + g.offsetHeight / 2 - mid); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  function markGap() {
    gaps().forEach((g, k) => g.classList.toggle('is-aim', k === state.gap));
    const pos = $('o-aim-pos');
    if (pos) pos.textContent = state.gap + 1;
  }
  // Every notch the list passes under the aim line ticks, like a picker wheel.
  $('o-ladder').addEventListener('scroll', () => {
    if (state.locked) return;
    const k = nearestGap();
    if (k !== state.gap) { state.gap = k; markGap(); haptic(); }
  }, { passive: true });
  $('o-ladder').addEventListener('click', e => {
    const g = e.target.closest('.gap');
    if (g && !state.locked) centerGap(+g.dataset.g);
  });
  document.addEventListener('keydown', e => {
    if (!$('screen-play').classList.contains('is-active') || state.locked || !$('o-over').hidden) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); centerGap(state.gap - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); centerGap(state.gap + 1); }
    if (e.key === 'Enter') { e.preventDefault(); place(); }
  });

  // ---------- play ----------
  // `timedOut` is true when the clock ran out: the same as putting it in the wrong place.
  function place(timedOut = false) {
    if (state.locked) return;
    state.locked = true;
    state.run.timeMs += clock.stop();
    state.run.turns++;
    const L = state.list, k = state.gap, v = key(val(state.next));
    const ok = !timedOut && (k === 0 || key(val(L[k - 1])) <= v) && (k === L.length || v <= key(val(L[k])));
    const card = $('o-new');
    card.classList.add('is-revealed', ok ? 'is-right' : 'is-wrong');

    if (ok) {
      haptic('success');
      setTimeout(() => {
        L.splice(k, 0, state.next);
        state.placed++;
        renderLadder(k);
        // The new car lands where the aim was: keep it just above the line.
        state.gap = k + 1; centerGap(k + 1, false);
        if (state.mode === 'duo') state.turn = 1 - state.turn;
        state.next = pickNext();
        renderHud();
        card.classList.add('is-leaving');
        setTimeout(() => { renderCard(true); state.locked = false; }, 220);
      }, 650);
      return;
    }

    haptic('error');
    const right = L.findIndex(c => v < key(val(c)));
    const correct = right === -1 ? L.length : right;
    setTimeout(() => {
      centerGap(correct);
      gaps()[correct]?.classList.add('is-correct');
      gaps()[k]?.classList.add('is-miss');
    }, 700);
    setTimeout(end, 2100);
  }
  $('o-place').addEventListener('click', () => place());

  // ---------- end ----------
  function end() {
    clock.hide();
    const solo = state.mode === 'solo';
    if (solo) {
      const { record, best } = Scores.finish(state.run, state.placed);
      $('o-over-kicker').textContent = cat().label;
      $('o-over-title').textContent = state.placed;
      $('o-over-sub').innerHTML = record && state.placed
        ? `<span>Record nou!</span><span class="over-time">${Scores.time(state.run.timeMs)}</span>`
        : `<span>${state.placed === 1 ? 'mașină pusă' : 'mașini puse'} la locul lor</span>`
          + `<span class="over-time">${Scores.time(state.run.timeMs)}</span>`
          + `<span>record ${best ? best.score : state.placed}</span>`;
    } else {
      const winner = 1 - state.turn;
      $('o-over-kicker').textContent = `${nameOf(state.turn)} a greșit`;
      $('o-over-title').innerHTML = `<span class="p${winner}">${esc(nameOf(winner))}</span>`;
      $('o-over-sub').textContent = `câștigă, cu un clasament de ${state.list.length} mașini`;
    }
    $('o-over').hidden = false;
    $('o-again').focus();
  }
  $('o-again').addEventListener('click', start);
  const toMenu = () => { clock.hide(); $('o-over').hidden = true; renderSetup(); show('screen-setup'); };
  $('o-menu').addEventListener('click', toMenu);
  $('btn-quit').addEventListener('click', () => {
    if (state.placed === 0 || confirm(I18n.t('Ieși? Clasamentul se pierde.'))) toMenu();
  });

  renderSetup();
})();
