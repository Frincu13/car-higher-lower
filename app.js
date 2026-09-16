(() => {
  'use strict';

  const CARS = window.CARS || [];

  // `up` / `down` are button labels for a numerically higher / lower value.
  // `hides` (optional) lists card details that would give the answer away.
  const CATEGORIES = {
    hp:       { label: 'Putere',        unit: 'CP',   decimals: 0, up: 'Mai mulți CP',  down: 'Mai puțini CP' },
    torque:   { label: 'Cuplu',         unit: 'Nm',   decimals: 0, up: 'Mai mult cuplu', down: 'Mai puțin cuplu' },
    accel:    { label: '0-100 km/h',    unit: 's',    decimals: 1, up: 'Mai lentă',     down: 'Mai rapidă', hint: 'Timp mai mic înseamnă mai rapidă' },
    topSpeed: { label: 'Viteză maximă', unit: 'km/h', decimals: 0, up: 'Mai rapidă',    down: 'Mai lentă' },
    weight:   { label: 'Greutate',      unit: 'kg',   decimals: 0, up: 'Mai grea',      down: 'Mai ușoară' },
  };
  const MIX = 'mix';
  const CAT_KEYS = Object.keys(CATEGORIES);

  const MULTIWORD_BRANDS = ['Mercedes-Benz', 'Mercedes-AMG', 'Aston Martin', 'Alfa Romeo', 'Land Rover',
    'Range Rover', 'Rolls-Royce'];

  // ---------- storage (best-effort, never required) ----------
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ---------- rng ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ---------- formatting ----------
  const fmtCache = {};
  function fmt(value, decimals) {
    const key = decimals;
    fmtCache[key] = fmtCache[key] || new Intl.NumberFormat('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return fmtCache[key].format(value);
  }
  function brandOf(name) {
    const multi = MULTIWORD_BRANDS.find(b => name.startsWith(b + ' '));
    return multi || name.split(' ')[0];
  }
  function modelOf(name) {
    return name.slice(brandOf(name).length).trim();
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  };

  const $ = id => document.getElementById(id);

  // ---------- start screen ----------
  function renderCategories() {
    const opts = [[MIX, 'Mixt', 'Altă categorie la fiecare rundă'], ...CAT_KEYS.map(k => [k, CATEGORIES[k].label, CATEGORIES[k].unit])];
    $('categories').innerHTML = opts.map(([key, label, sub]) => {
      const best = store.get(`hl_best_${key}`, 0);
      const on = key === state.choice;
      return `<button class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-cat="${key}">
        <span class="cat-name">${esc(label)}</span>
        <span class="cat-sub">${esc(sub)}</span>
        <span class="cat-best">${best ? `Record ${best}` : '&nbsp;'}</span>
      </button>`;
    }).join('');
  }
  $('categories').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.choice = btn.dataset.cat;
    store.set('hl_cat', state.choice);
    renderCategories();
  });
  $('car-count').textContent = `${fmt(CARS.length, 0)} de mașini din Forza Horizon 5 și 6, Need for Speed Heat și Unbound și The Crew Motorfest. Date tehnice: Forza Wiki și autoevolution.com. Poze: Wikimedia Commons, autorii sunt trecuți pe fiecare poză.`;

  // ---------- game flow ----------
  const bestKey = () => state.daily ? `hl_daily_${todayKey()}` : `hl_best_${state.choice}`;

  function show(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === screen));
  }

  function startGame(daily) {
    state.daily = daily;
    state.rng = daily ? mulberry32(hashStr('mmsmp-' + todayKey())) : Math.random;
    state.score = 0;
    state.used = new Set();
    state.locked = false;
    $('overlay').hidden = true;
    state.bestAtStart = store.get(bestKey(), 0);

    const cats = catsForRound(null);
    state.cat = pickFrom(cats);
    state.left = pickFrom(CARS.filter(c => c[state.cat] != null));
    state.used.add(state.left.id);
    state.right = pickOpponent(state.left, state.cat);
    state.used.add(state.right.id);

    show('screen-game');
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

  function renderRound(animateIn) {
    const cat = CATEGORIES[state.cat];
    $('hud-cat').innerHTML = `<span class="hud-k">Categorie</span><span class="hud-cat-name">${esc(cat.label)}</span>`;
    $('hud-score').textContent = state.score;
    $('hud-best').textContent = store.get(bestKey(), 0);

    $('card-left').className = 'card card-left';
    $('card-left').innerHTML = cardHTML(state.left, 'left');
    $('card-right').className = 'card card-right' + (animateIn ? ' is-entering' : '');
    $('card-right').addEventListener('animationend', e => e.target.classList.remove('is-entering'), { once: true });
    $('card-right').innerHTML = cardHTML(state.right, 'right');
    wirePhotos($('card-left'));
    wirePhotos($('card-right'));
    $('vs').className = 'vs';
    $('vs').innerHTML = '<span>VS</span>';

    $('card-right').querySelectorAll('[data-guess]').forEach(b => b.addEventListener('click', () => guess(b.dataset.guess)));
    const first = $('card-right').querySelector('[data-guess]');
    if (first && document.activeElement && document.activeElement.closest('#screen-game')) first.focus({ preventScroll: true });
  }

  function artHTML(car) {
    const brand = brandOf(car.name);
    const hue = hashStr(brand) % 360;
    // The placeholder sits underneath the photo, so a photo that fails to load
    // (removed in the error handler) still leaves a finished-looking card.
    const photo = car.image ? `
      <img class="art-photo" src="${esc(car.image)}" alt="${esc(car.name)}" decoding="async" referrerpolicy="no-referrer">
      <a class="art-credit" href="${esc(car.source)}" target="_blank" rel="noopener">Foto: ${esc(car.credit)}, ${esc(car.license)}</a>` : '';
    return `<div class="art art-placeholder" style="--hue:${hue}" role="img" aria-label="${esc(car.name)}">
      <span class="art-brand">${esc(brand)}</span>
      <svg class="art-car" viewBox="0 0 240 80" aria-hidden="true">
        <path d="M14 58c0-7 3-11 11-13l36-8c11-11 25-19 45-21 24-2 48 3 67 16l33 6c12 2 20 8 20 18v6c0 3-2 5-5 5h-15a21 21 0 0 0-41 0H79a21 21 0 0 0-41 0H20c-4 0-6-2-6-6z"/>
        <circle cx="58" cy="66" r="13"/><circle cx="192" cy="66" r="13"/>
      </svg>${photo}
    </div>`;
  }

  function wirePhotos(root) {
    root.querySelectorAll('.art-photo').forEach(img => {
      const drop = () => { img.nextElementSibling?.remove(); img.remove(); };
      if (img.complete && img.naturalWidth === 0) drop(); // failed before we listened
      else img.addEventListener('error', drop, { once: true });
    });
  }

  // Warm the cache for the next opponent's photo so it is there when the card slides in.
  function preload(car) {
    if (car && car.image) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.src = car.image; }
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
          <p class="guess-q">față de ${esc(state.left.name)}</p>
          <div class="guess-btns">
            <button class="btn btn-guess" data-guess="up"><span class="arrow" aria-hidden="true">▲</span>${esc(cat.up)}</button>
            <button class="btn btn-guess" data-guess="down"><span class="arrow" aria-hidden="true">▼</span>${esc(cat.down)}</button>
          </div>
          ${cat.hint ? `<p class="guess-hint">${esc(cat.hint)}</p>` : ''}
        </div>
      </div>`;
  }

  function guess(dir) {
    if (state.locked) return;
    state.locked = true;
    const cat = CATEGORIES[state.cat];
    const a = state.left[state.cat];
    const b = state.right[state.cat];
    const correct = a === b || (dir === 'up' ? b > a : b < a);

    const card = $('card-right');
    card.querySelector('.guess').classList.add('is-gone');
    card.querySelectorAll('[data-guess]').forEach(btn => { btn.disabled = true; });
    const reveal = $('reveal');
    reveal.classList.remove('stat-hidden');

    countUp($('reveal-num'), b, cat.decimals, 750, () => {
      card.classList.add(correct ? 'is-right' : 'is-wrong');
      $('vs').classList.add(correct ? 'is-right' : 'is-wrong');
      $('vs').innerHTML = `<span>${correct ? '✓' : '✕'}</span>`;
      if (correct) {
        state.score++;
        $('hud-score').textContent = state.score;
        const best = store.get(bestKey(), 0);
        if (state.score > best) { store.set(bestKey(), state.score); $('hud-best').textContent = state.score; }
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
    const cat = CATEGORIES[state.cat];
    const best = Math.max(state.bestAtStart, state.score);
    const a = state.left, b = state.right;
    $('over-kicker').textContent = state.daily ? `Provocarea zilei, ${todayKey()}` : 'Final de cursă';
    $('over-title').textContent = state.score;
    $('over-sub').textContent = state.score > state.bestAtStart
      ? 'Record nou!'
      : `${state.score === 1 ? 'răspuns corect' : 'răspunsuri corecte'} • record ${best}`;
    $('over-reveal').innerHTML = `
      <div><span>${esc(a.name)}</span><strong>${fmt(a[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>
      <div><span>${esc(b.name)}</span><strong>${fmt(b[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>`;
    $('btn-share').hidden = !state.daily;
    $('btn-share').textContent = 'Copiază rezultatul';
    $('overlay').hidden = false;
    $('btn-again').focus();
  }

  async function share() {
    const text = `Mai mult sau mai puțin, provocarea zilei ${todayKey()}: ${state.score} ${state.score === 1 ? 'punct' : 'puncte'}`;
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
  const toMenu = () => { $('overlay').hidden = true; renderCategories(); show('screen-start'); };
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
})();
