(() => {
  'use strict';

  const CARS = window.CARS || [];
  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, makeTimer } = window.Shared;
  // ce mașini vin și ce e corect: comun cu serverul, care verifică Provocarea zilei
  const SM = window.SusModel;

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

  // Local: un telefon, fără cont, cronometrul la alegere. Online (?online): mereu cu
  // cronometru, partida o pornește serverul și totul intră în clasament.
  const ONLINE = new URLSearchParams(location.search).has('online');

  // ---------- state ----------
  const state = {
    choice: store.get('hl_cat', MIX), // selected on the start screen
    daily: false,
    rng: Math.random,
    gen: null,       // what comes next (SusModel.joc)
    ziua: null,      // the day of a daily run
    raspunsuri: [],  // every answer of the run ('u' / 'd' / 'x'), for the leaderboard
    cat: 'hp',       // category of the current round
    left: null,
    right: null,
    score: 0,
    locked: false,
    bestAtStart: 0,
    shownCat: null,  // category the player saw last round (for the "new category" cue)
    run: null,       // the run in progress, in the shape a leaderboard wants
    timed: ONLINE || store.get('hl_timer', false),
    partida: null,   // a timed run started by the server, for the overall leaderboard: { id, seed, cat }
    // 1 la 1 pe același telefon (doar local): pe rând, pe același șir; cine greșește pierde
    duo: false, names: store.get('hl_names', ['', '']), turn: 0, primul: 0, puncte: [0, 0],
    pornind: false,
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
  const TIMER_OPTS = [[false, 'Fără', 'Fără limită de timp'], [true, `${TIMER_SECS} secunde`, 'Pe mașină, cu clasament']];
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
    // aleasă categoria, înapoi în meniu
    if (location.hash === '#categorie') history.back();
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

  // Timed runs count for the overall leaderboard: the server hands out the seed first.
  // Without it (offline, slow) the run is played anyway, just not ranked.
  async function startGame(daily) {
    if (state.pornind) return;
    daily = ONLINE && daily;
    const timed = ONLINE || store.get('hl_timer', false);
    let partida = null;
    if (ONLINE && window.FrqCloud) {
      state.pornind = true;
      ['btn-play', 'btn-daily', 'btn-again'].forEach(id => { $(id).disabled = true; });
      partida = await FrqCloud.pornestePartida('sus-sau-jos', state.choice, 4000, daily ? todayKey() : null);
      ['btn-play', 'btn-daily', 'btn-again'].forEach(id => { $(id).disabled = false; });
      state.pornind = false;
    }
    state.partida = partida && partida.id ? { id: partida.id, seed: partida.seed, cat: state.choice } : null;
    state.daily = daily;
    state.timed = timed;
    Scores.migrate(`hl_best_${state.choice}`, boardOf(state.choice, false, false));
    state.run = Scores.start({
      game: 'sus-sau-jos', board: boardOf(), cat: state.choice,
      timed: state.timed, seconds: state.timed ? TIMER_SECS : 0,
      seed: daily ? todayKey() : null,   // a seeded run is the same for everyone
    });
    state.ziua = todayKey();
    state.rng = daily ? SM.rngZilei(state.ziua) : state.partida ? SM.rngDin(state.partida.seed) : Math.random;
    state.gen = SM.joc({ cars: CARS, rng: state.rng, mod: daily ? MIX : state.choice });
    state.raspunsuri = [];
    state.score = 0;
    state.puncte = [0, 0];
    state.turn = state.primul;
    state.locked = false;
    $('overlay').hidden = true;
    state.bestAtStart = (Scores.load(boardOf()) || {}).score || 0;

    ({ cat: state.cat, left: state.left, right: state.right } = state.gen.prima());

    show('screen-game');
    state.shownCat = null;
    renderRound(false);
  }

  // Which cars come next, in which category, and how close they get as the score
  // grows: all in sus-model.js, shared with the server.

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
    if (state.duo) {
      $('hud-cat').innerHTML = `<span class="hud-k">Rândul lui</span><span class="hud-cat-name hl-rand p${state.turn}">${esc(numeDuo(state.turn))}</span>`;
      $('hud-score').textContent = state.puncte[0];
      $('hud-best').textContent = state.puncte[1];
      $('hud-score').previousElementSibling.textContent = numeDuo(0);
      $('hud-best').previousElementSibling.textContent = numeDuo(1);
    }
    // 1 la 1: coloana celui de la rând e aprinsă, în culoarea lui
    document.body.classList.toggle('hl-duo', state.duo);
    [$('hud-score'), $('hud-best')].forEach((el, i) => {
      el.parentElement.classList.toggle('is-rand', state.duo && state.turn === i);
      el.parentElement.classList.toggle(`p${i}`, state.duo);
    });

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
    const b = state.right[state.cat];
    const correct = SM.corect(state.cat, state.left, state.right, dir);
    state.raspunsuri.push(dir === 'up' ? 'u' : dir === 'down' ? 'd' : 'x');

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
        if (state.duo) { state.puncte[state.turn]++; state.turn = 1 - state.turn; }
        $('hud-score').textContent = state.duo ? state.puncte[0] : state.score;
        if (state.duo) $('hud-best').textContent = state.puncte[1];
        if (!state.duo && state.score > state.bestAtStart) $('hud-best').textContent = state.score;
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
  const pickNext = () => state.gen.urmatoarea(state.right, state.score);

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
      state.gen.foloseste(state.right);
      state.locked = false;
      renderRound(true);
      void arena.offsetWidth; // commit the no-transition frame
      arena.classList.remove('is-resetting');
    }, 400);
  }

  function gameOver() {
    clock.hide();
    if (state.duo) return finalDuo();
    state.run.timeMs = Math.round(state.run.timeMs);   // the same milliseconds here and on the leaderboard
    const cat = CATEGORIES[state.cat];
    const { record, best } = Scores.finish(state.run, state.score);
    const a = state.left, b = state.right;
    $('over-kicker').textContent = state.daily ? `Provocarea zilei, ${todayKey()}` : 'Final de cursă';
    $('over-title').textContent = state.score;
    $('over-sub').innerHTML = record && state.score > 0
      ? `<span>Record nou!</span><span class="over-time">${Scores.time(state.run.timeMs)}</span>`
      : `<span>${state.score === 1 ? 'răspuns corect' : 'răspunsuri corecte'}</span>`
        + `<span class="over-time">${Scores.time(state.run.timeMs)}</span>`
        + `<span>record ${best ? best.score : state.score}</span>`;
    $('over-reveal').innerHTML = `
      <div><span>${esc(a.name)}</span><strong>${fmt(a[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>
      <div><span>${esc(b.name)}</span><strong>${fmt(b[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>`;
    $('btn-share').hidden = !state.daily;
    $('btn-share').textContent = 'Copiază scorul';
    // Provocarea zilei intră în clasament: pleacă răspunsurile, scorul îl socotește serverul
    if (state.daily && window.FrqCloud) {
      FrqCloud.afiseazaZi($('hl-top'), { joc: 'sus-sau-jos', data: state.ziua, id: state.partida && state.partida.id, raspunsuri: state.raspunsuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else if (state.partida && window.FrqCloud) {
      FrqCloud.afiseazaGeneral($('hl-top'), { joc: 'sus-sau-jos', cat: state.partida.cat, id: state.partida.id, raspunsuri: state.raspunsuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else $('hl-top').hidden = true;
    state.partida = null;
    $('overlay').hidden = false;
    $('btn-again').focus();
  }

  // 1 la 1: a pierdut cel de la rând; la revanșă începe celălalt
  const numeDuo = i => (state.names[i] || '').trim() || `Jucător ${i + 1}`;
  function finalDuo() {
    const pierde = state.turn, castiga = 1 - pierde;
    const cat = CATEGORIES[state.cat], a = state.left, b = state.right;
    $('over-kicker').textContent = `${numeDuo(pierde)} a greșit`;
    $('over-title').innerHTML = `<span class="p${castiga} hl-rand">${esc(numeDuo(castiga))}</span>`;
    $('over-sub').innerHTML = `<span>câștigă</span><span class="over-time">${state.puncte[0]} – ${state.puncte[1]}</span>`;
    $('over-reveal').innerHTML = `
      <div><span>${esc(a.name)}</span><strong>${fmt(a[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>
      <div><span>${esc(b.name)}</span><strong>${fmt(b[state.cat], cat.decimals)} ${esc(cat.unit)}</strong></div>`;
    $('btn-share').hidden = true;
    $('hl-top').hidden = true;
    state.primul = 1 - state.primul;
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
  // prima pagină („Azi") pornește direct Provocarea zilei
  if (ONLINE && new URLSearchParams(location.search).has('provocare')) {
    history.replaceState(null, '', `${location.pathname}?online`);
    setTimeout(() => $('btn-daily').click(), 0);
  }
  $('btn-again').addEventListener('click', () => startGame(state.daily));
  $('btn-share').addEventListener('click', share);
  $('btn-cls').addEventListener('click', () => window.FrqCloud && FrqCloud.arataClasament('sus-sau-jos', state.choice));
  const toMenu = () => {
    clock.hide(); $('overlay').hidden = true;
    // după 1 la 1, etichetele de sus revin la Scor / Record
    $('hud-score').previousElementSibling.textContent = I18n.t('Scor');
    $('hud-best').previousElementSibling.textContent = I18n.t('Record');
    if (location.hash === '#nume') history.back();
    renderTimer(); renderCategories(); randeazaMeniu(); show('screen-start');
  };
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-quit').addEventListener('click', async () => {
    if (state.score === 0 || await Shared.intreaba(I18n.t('Ieși? Scorul se pierde.'))) toMenu();
  });

  document.addEventListener('keydown', e => {
    if (!$('screen-game').classList.contains('is-active') || !$('overlay').hidden) {
      if (e.key === 'Enter' && !$('overlay').hidden && document.activeElement === document.body) startGame(state.daily);
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); guess('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); guess('down'); }
    if (e.key === 'Escape') toMenu();
  });

  // ---------- meniul jocului ----------
  // Rânduri mari: Joacă, Provocarea zilei (online), Categoria, Cronometrul (local),
  // Clasamentul (online). Categoria se alege pe pagina ei (#categorie), ca Înapoi-ul
  // telefonului să te întoarcă în meniu.
  const numeCat = k => (k === MIX ? 'Mixt' : CATEGORIES[k].label);
  function randeazaMeniu() {
    const best = bestOf(state.choice, ONLINE || state.timed);
    const rec = best && best.score ? ` · recordul ${best.score}` : '';
    $('hl-meniu').innerHTML = Shared.randuriMeniu(ONLINE ? [
      { id: 'joaca', titlu: 'Joacă', sub: `${numeCat(state.choice)} · 10 secunde pe mașină${rec}`, primar: true },
      { id: 'zi', titlu: 'Provocarea zilei', sub: 'Aceleași mașini pentru toți, azi' },
      { id: 'prieten', titlu: 'Cu un prieten', sub: 'Live, pe rând, fiecare pe telefonul lui' },
      { id: 'cat', titlu: 'Categoria', sub: numeCat(state.choice) },
      { id: 'cls', titlu: 'Clasament', sub: 'General, săptămâna, provocarea zilei' },
    ] : [
      { id: 'joaca', titlu: 'Joacă', sub: `${numeCat(state.choice)} · ${state.timed ? '10 secunde pe mașină' : 'fără cronometru'}${rec}`, primar: true },
      { id: 'duo', titlu: '1 la 1', sub: 'Pe rând, pe același telefon' },
      { id: 'cat', titlu: 'Categoria', sub: numeCat(state.choice) },
      { id: 'ceas', titlu: 'Cronometru', sub: state.timed ? '10 secunde pe mașină' : 'Oprit' },
    ]);
  }
  const pas = () => {
    $('screen-start').classList.toggle('pas-cat', location.hash === '#categorie');
    $('screen-start').classList.toggle('pas-nume', location.hash === '#nume');
    randeazaMeniu();
  };
  window.addEventListener('hashchange', pas);
  $('hl-pas-inapoi').addEventListener('click', () => history.back());
  $('hl-duo').addEventListener('submit', e => {
    e.preventDefault();
    state.names = [0, 1].map(i => $(`hl-name-${i}`).value.trim());
    store.set('hl_names', state.names);
    state.duo = true;
    state.primul = 0;
    startGame(false);
  });
  $('hl-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'joaca') { state.duo = false; $('btn-play').click(); }
    if (id === 'duo') { [0, 1].forEach(i => { $(`hl-name-${i}`).value = state.names[i] || ''; }); location.hash = 'nume'; }
    if (id === 'zi') $('btn-daily').click();
    if (id === 'cls') $('btn-cls').click();
    if (id === 'prieten') location.href = 'camera.html?joc=sus-sau-jos';
    if (id === 'cat') location.hash = 'categorie';
    if (id === 'ceas') { state.timed = !state.timed; store.set('hl_timer', state.timed); renderTimer(); renderCategories(); randeazaMeniu(); }
  });
  // butoanele vechi de start rămân în pagină doar ca ținte pentru meniu
  $('btn-play').closest('.start-actions').hidden = true;
  $('hl-timer').hidden = true;
  $('hl-timer').previousElementSibling.hidden = true;

  // ce se vede pe ecranul de start, după mod; Înapoi duce la meniul de jocuri potrivit
  document.querySelectorAll('a.back-btn[href="index.html"]').forEach(a => { a.href = ONLINE ? 'index.html#online' : 'index.html#local'; });
  if (ONLINE) {
    $('hl-timer').hidden = true;
    $('hl-timer').previousElementSibling.hidden = true;
    document.querySelector('#screen-start .eyebrow').textContent = 'Jocuri FRQ · Online';
    document.querySelector('#screen-start .lede').textContent = 'Următoarea mașină stă mai sus sau mai jos? 10 secunde pe mașină, o greșeală și s-a terminat. Totul intră în clasament.';
  } else {
    $('btn-daily').hidden = true;
    $('btn-cls').hidden = true;
  }
  renderCategories();
  renderTimer();
  pas();
})();
