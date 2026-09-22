(() => {
  'use strict';

  const CARS = window.CARS || [];
  const { store, mulberry32, hashStr, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, makeTimer } = window.Shared;

  // `up` / `down` are button labels for a numerically higher / lower value.
  // `hides` (optional) lists card details that would give the answer away.
  const CATEGORIES = {
    hp:     { label: 'Cai putere', unit: 'CP', decimals: 0, up: 'Mai mulți CP', down: 'Mai puțini CP' },
    weight: { label: 'Greutate',   unit: 'kg', decimals: 0, up: 'Mai grea',     down: 'Mai ușoară' },
    accel:  { label: '0-100 km/h', unit: 's',  decimals: 1, up: 'Mai lentă',    down: 'Mai rapidă' },
  };
  const MIX = 'mix';
  const CAT_KEYS = Object.keys(CATEGORIES);

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ---------- state ----------
  const state = {
    choice: store.get('hl_cat', MIX), // selected on the start screen
    daily: false,
    rng: Math.random,
    cat: 'hp',       // category of the current round
    left: null,
    right: null,
    score: 0,
    used: new Set(),
    locked: false,
    bestAtStart: 0,
    shownCat: null,  // category the player saw last round (for the "new category" cue)
    run: null,       // the run in progress, in the shape a leaderboard wants
    timed: store.get('hl_timer', false),
  };

  const $ = id => document.getElementById(id);

  // Optional clock: a few seconds per car, and running out counts as a wrong answer.
  const TIMER_SECS = 10;
  const clock = makeTimer({
    box: $('hud-timer'), bar: $('timer-bar'), num: $('timer-num'),
    onEnd: () => guess(null),
  });

  // ---------- start screen ----------
  function renderCategories() {
    const opts = [[MIX, 'Mixt', 'Se schimbă din mers'], ...CAT_KEYS.map(k => [k, CATEGORIES[k].label, CATEGORIES[k].unit])];
    $('categories').innerHTML = opts.map(([key, label, sub]) => {
      const best = bestOf(key, state.timed);
      const on = key === state.choice;
      return `<button class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-cat="${key}">
        <span class="cat-name">${esc(label)}</span>
        <span class="cat-sub">${esc(sub)}</span>
        <span class="cat-best">${best ? `Record ${best.score}${best.timeMs != null ? ` · ${Scores.time(best.timeMs)}` : ''}` : '&nbsp;'}</span>
      </button>`;
    }).join('');
  }
  const TIMER_OPTS = [[false, 'Fără', 'Fără limită de timp'], [true, `${TIMER_SECS} secunde`, 'Pe fiecare mașină']];
  function renderTimer() {
    $('hl-timer').innerHTML = TIMER_OPTS.map(([v, name, sub]) => {
      const on = v === state.timed;
      return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-timer="${v}">
        <span class="cat-name">${esc(name)}</span>
        <span class="cat-sub">${esc(sub)}</span>
      </button>`;
    }).join('');
  }
  $('hl-timer').addEventListener('click', e => {
    const btn = e.target.closest('[data-timer]');
    if (!btn) return;
    state.timed = btn.dataset.timer === 'true';
    store.set('hl_timer', state.timed);
    haptic();
    renderTimer();
    renderCategories();   // the records shown belong to the mode that is picked
  });

  $('categories').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.choice = btn.dataset.cat;
    store.set('hl_cat', state.choice);
    renderCategories();
  });

  // ---------- game flow ----------
  // One board per category and clock: only runs played the same way are compared.
  const boardOf = (choice = state.choice, timed = state.timed, daily = state.daily) =>
    daily ? `sus-sau-jos:daily-${todayKey()}:t${TIMER_SECS}`
      : `sus-sau-jos:${choice}:${timed ? `t${TIMER_SECS}` : 'free'}`;
  const bestOf = (choice, timed) => Scores.load(boardOf(choice, timed, false));

  function show(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === screen));
  }

  function startGame(daily) {
    state.daily = daily;
    state.timed = !daily && store.get('hl_timer', false);   // the daily run stays as it is
    Scores.migrate(`hl_best_${state.choice}`, boardOf(state.choice, false, false));
    state.run = Scores.start({
      game: 'sus-sau-jos', board: boardOf(), cat: state.choice,
      timed: state.timed, seconds: state.timed ? TIMER_SECS : 0,
      seed: daily ? todayKey() : null,   // a seeded run is the same for everyone
    });
    state.rng = daily ? mulberry32(hashStr('mmsmp-' + todayKey())) : Math.random;
    state.score = 0;
    state.used = new Set();
    state.locked = false;
    $('overlay').hidden = true;
    state.bestAtStart = (Scores.load(boardOf()) || {}).score || 0;

    const cats = catsForRound(null);
    state.cat = pickFrom(cats);
    state.left = pickFrom(CARS.filter(c => c[state.cat] != null));
    state.used.add(state.left.id);
    state.right = pickOpponent(state.left, state.cat);
    state.used.add(state.right.id);

    show('screen-game');
    state.shownCat = null;
    renderRound(false);
  }

  const pickFrom = arr => arr[Math.floor(state.rng() * arr.length)];

  function catsForRound(leftCar) {
    const mode = state.daily ? MIX : state.choice;
    const pool = mode === MIX ? CAT_KEYS : [mode];
    return leftCar ? pool.filter(k => leftCar[k] != null) : pool;
  }

  // Closer values as the score grows. Distance is |ln(a/b)| so "300 vs 330 CP"
  // and "3.0 vs 3.3 s" count as equally hard.
  function difficultyBand(score) {
    if (score < 3) return [0.35, Infinity];
    if (score < 8) return [0.15, 0.9];
    if (score < 15) return [0.06, 0.45];
    return [0.02, 0.2];
  }

  function pickOpponent(left, cat) {
    const a = left[cat];
    let pool = CARS.filter(c => c.id !== left.id && c[cat] != null && !state.used.has(c.id));
    if (pool.length < 5) { // ran through the list: allow repeats again
      state.used = new Set([left.id]);
      pool = CARS.filter(c => c.id !== left.id && c[cat] != null);
    }
    const [lo, hi] = difficultyBand(state.score);
    const dist = c => Math.abs(Math.log(c[cat] / a));
    let band = pool.filter(c => { const d = dist(c); return d >= lo && d <= hi && d > 0.01; });
    if (band.length === 0) band = pool.filter(c => dist(c) > 0.01);
    if (band.length === 0) band = pool;
    return pickFrom(band);
  }

  function announceCategory(label) {
    $('hud-cat').classList.remove('is-new'); void $('hud-cat').offsetWidth; $('hud-cat').classList.add('is-new');
    $('card-left').querySelector('.stat')?.classList.add('is-new');
    document.querySelector('.cat-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'cat-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `<span>Categorie nouă</span><strong>${esc(label)}</strong>`;
    $('arena').appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  function renderRound(animateIn) {
    const cat = CATEGORIES[state.cat];
    // Reset first: the name element is recreated every round and would replay the flash.
    $('hud-cat').classList.remove('is-new');
    $('hud-cat').innerHTML = `<span class="hud-k">Categorie</span><span class="hud-cat-name">${esc(cat.label)}</span>`;
    $('hud-score').textContent = state.score;
    $('hud-best').textContent = state.bestAtStart;

    $('card-left').className = 'card card-left';
    $('card-left').innerHTML = cardHTML(state.left, 'left');
    $('card-right').className = 'card card-right' + (animateIn ? ' is-entering' : '');
    $('card-right').addEventListener('animationend', e => e.target.classList.remove('is-entering'), { once: true });
    $('card-right').innerHTML = cardHTML(state.right, 'right');
    wirePhotos($('card-left'));
    wirePhotos($('card-right'));

    // Mixed mode: make a category switch impossible to miss, without blocking play.
    if (animateIn && state.shownCat && state.shownCat !== state.cat) announceCategory(cat.label);
    state.shownCat = state.cat;
    $('vs').className = 'vs';
    $('vs').innerHTML = '<span>VS</span>';

    clock.pauseWhenHidden = !state.timed;   // a timed run keeps counting while you are away
    clock.start(state.timed ? TIMER_SECS : 0);   // untimed runs are still measured
    $('card-right').querySelectorAll('[data-guess]').forEach(b => b.addEventListener('click', () => guess(b.dataset.guess)));
    const first = $('card-right').querySelector('[data-guess]');
    if (first && document.activeElement && document.activeElement.closest('#screen-game')) first.focus({ preventScroll: true });
  }

  function cardHTML(car, side) {
    const cat = CATEGORIES[state.cat];
    // Details shown before answering must never contain the answer: a category lists
    // the fields it hides (e.g. a future "year" category would hide `years`).
    // Power numbers are already stripped from `engine` by scripts/build.py.
    const hidden = cat.hides || [];
    const meta = ['years', 'engine'].filter(f => car[f] && !hidden.includes(f))
      .map(f => esc(car[f])).join(' <span class="dot">•</span> ');
    const head = `${artHTML(car)}
      <div class="card-body">
        <p class="brand">${esc(brandOf(car.name))}</p>
        <h2 class="model">${esc(modelOf(car.name) || car.name)}</h2>
        <p class="meta">${meta}</p>`;
    if (side === 'left') {
      return `${head}
        <div class="stat">
          <span class="stat-label">${esc(cat.label)}</span>
          <span class="stat-value">${fmt(car[state.cat], cat.decimals)}<small>${esc(cat.unit)}</small></span>
        </div>
      </div>`;
    }
    return `${head}
        <div class="stat stat-hidden" id="reveal">
          <span class="stat-label">${esc(cat.label)}</span>
          <span class="stat-value"><span id="reveal-num">?</span><small>${esc(cat.unit)}</small></span>
        </div>
        <div class="guess">
          <div class="guess-btns">
            <button class="btn btn-guess" data-guess="up"><span class="arrow" aria-hidden="true">▲</span>${esc(cat.up)}</button>
            <button class="btn btn-guess" data-guess="down"><span class="arrow" aria-hidden="true">▼</span>${esc(cat.down)}</button>
          </div>
          ${cat.hint ? `<p class="guess-hint">${esc(cat.hint)}</p>` : ''}
        </div>
      </div>`;
  }

  // `dir` is null when the clock runs out: same as answering wrong.
  function guess(dir) {
    if (state.locked) return;
    state.locked = true;
    state.run.timeMs += clock.stop();
    state.run.turns++;
    const away = clock.away();
    state.run.hiddenMs += away.hiddenMs;
    state.run.awayCount += away.awayCount;
    document.querySelector('.cat-toast')?.remove(); // don't cover the reveal on a quick answer
    const cat = CATEGORIES[state.cat];
    const a = state.left[state.cat];
    const b = state.right[state.cat];
    const correct = dir !== null && (a === b || (dir === 'up' ? b > a : b < a));

    const card = $('card-right');
    card.querySelector('.guess').classList.add('is-gone');
    card.querySelectorAll('[data-guess]').forEach(btn => { btn.disabled = true; });
    const reveal = $('reveal');
    reveal.classList.remove('stat-hidden');

    countUp($('reveal-num'), b, cat.decimals, 750, () => {
      haptic(correct ? 'success' : 'error');
      card.classList.add(correct ? 'is-right' : 'is-wrong');
      $('vs').classList.add(correct ? 'is-right' : 'is-wrong');
      $('vs').innerHTML = `<span>${correct ? '✓' : '✕'}</span>`;
      if (correct) {
        state.score++;
        $('hud-score').textContent = state.score;
        if (state.score > state.bestAtStart) $('hud-best').textContent = state.score;
        state.next = pickNext();
        preload(state.next.right);
        setTimeout(advance, 850);
      } else {
        setTimeout(gameOver, 1100);
      }
    });
  }

  function countUp(el, target, decimals, ms, done) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // rAF is paused in background tabs; skip the animation there so the round still resolves.
    if (reduce || document.hidden) { el.textContent = fmt(target, decimals); done(); return; }
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased, decimals);
      if (t < 1) requestAnimationFrame(step); else { el.textContent = fmt(target, decimals); done(); }
    };
    requestAnimationFrame(step);
  }

  // Chosen as soon as the answer is right, so the next photo can start loading
  // while the reveal animation plays.
  function pickNext() {
    const left = state.right;
    const cat = pickFrom(catsForRound(left));
    return { cat, right: pickOpponent(left, cat) };
  }

  function advance() {
    const arena = $('arena');
    arena.classList.add('is-advancing');
    setTimeout(() => {
      // Put the cards back at rest with transitions off, otherwise they visibly
      // slide back to their original place before the new content shows up.
      arena.classList.add('is-resetting');
      arena.classList.remove('is-advancing');
      state.left = state.right;
      ({ cat: state.cat, right: state.right } = state.next);
      state.used.add(state.right.id);
      state.locked = false;
      renderRound(true);
      void arena.offsetWidth; // commit the no-transition frame
      arena.classList.remove('is-resetting');
    }, 400);
  }

  function gameOver() {
    clock.hide();
    const cat = CATEGORIES[state.cat];
    const { record, best } = Scores.finish(state.run, state.score);
    const a = state.left, b = state.right;
    $('over-kicker').textContent = state.daily ? `Provocarea zilei, ${todayKey()}` : 'Final de cursă';
    $('over-title').textContent = state.score;
    $('over-sub').innerHTML = record
      ? `<span>Record nou!</span><span class="over-time">${Scores.time(state.run.timeMs)}</span>`
      : `<span>${state.score === 1 ? 'răspuns corect' : 'răspunsuri corecte'}</span>`
        + `<span class="over-time">${Scores.time(state.run.timeMs)}</span>`
        + `<span>record ${best ? best.score : state.score}</span>`;
    $('over-reveal').innerHTML = `
      <div><span>${esc(a.name)}</span><strong>${fmt(a[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>
      <div><span>${esc(b.name)}</span><strong>${fmt(b[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>`;
    $('btn-share').hidden = !state.daily;
    $('btn-share').textContent = 'Copiază scorul';
    $('overlay').hidden = false;
    $('btn-again').focus();
  }

  async function share() {
    const text = I18n.t('Sus sau jos (Jocuri FRQ), provocarea zilei {d}: {n} {pts}', { d: todayKey(), n: state.score, pts: I18n.t(state.score === 1 ? 'punct' : 'puncte') });
    try {
      await navigator.clipboard.writeText(text);
      $('btn-share').textContent = 'Copiat';
    } catch {
      $('btn-share').textContent = text;
    }
  }

  // ---------- wiring ----------
  $('btn-play').addEventListener('click', () => startGame(false));
  $('btn-daily').addEventListener('click', () => startGame(true));
  $('btn-again').addEventListener('click', () => startGame(state.daily));
  $('btn-share').addEventListener('click', share);
  const toMenu = () => { clock.hide(); $('overlay').hidden = true; renderTimer(); renderCategories(); show('screen-start'); };
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-quit').addEventListener('click', toMenu);

  document.addEventListener('keydown', e => {
    if (!$('screen-game').classList.contains('is-active') || !$('overlay').hidden) {
      if (e.key === 'Enter' && !$('overlay').hidden && document.activeElement === document.body) startGame(state.daily);
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); guess('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); guess('down'); }
    if (e.key === 'Escape') toMenu();
  });

  renderCategories();
  renderTimer();
})();
