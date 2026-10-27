(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, makeTimer } = window.Shared;
  const CARS = (window.CARS || []).filter(c => c.image);
  // ce mașini intră și ce loc e corect: comun cu serverul, care verifică Provocarea zilei
  const OM = window.OrdineModel;
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // dir 'desc': the biggest number sits on top. For 0-100 the quickest time is on top.
  const CATS = {
    hp:     { label: 'Cai putere', unit: 'CP', dec: 0, dir: 'desc', top: 'Mai puternică', bottom: 'Mai slabă' },
    weight: { label: 'Greutate',   unit: 'kg', dec: 0, dir: 'desc', top: 'Mai grea',      bottom: 'Mai ușoară' },
    accel:  { label: '0-100 km/h', unit: 's',  dec: 1, dir: 'asc',  top: 'Mai rapidă',    bottom: 'Mai lentă' },
  };
  const MODES = { solo: ['Singur', 'Cât de lung îl faci'], duo: ['1 la 1', 'Pe rând, pe același telefon'] };

  const $ = id => document.getElementById(id);
  // Local: un telefon, singur sau 1 la 1, cronometrul la alegere. Online (?online):
  // singur, mereu cu 10 secunde, partida o pornește serverul și intră în clasament.
  const ONLINE = new URLSearchParams(location.search).has('online');
  const modLocal = () => (ONLINE ? 'solo' : store.get('ord_mode', 'solo'));
  const ceasLocal = () => ONLINE || store.get('ord_timer', false);
  const state = {
    cat: store.get('ord_cat', 'hp'),
    mode: modLocal(),
    names: store.get('ord_names', ['', '']),
    list: [], next: null,
    daily: false, ziua: null, rng: Math.random, gen: null,
    locuri: [],      // locul ales la fiecare mașină, pentru clasament (-1 = timp expirat)
    gap: 0, turn: 0, placed: 0, locked: false, best: 0,
    timed: ceasLocal(),
    run: null,       // the run in progress, in the shape a leaderboard wants
    partida: null,   // a timed solo run started by the server, for the overall leaderboard: { id, seed }
    pornind: false,
  };
  const cat = () => CATS[state.cat];
  const key = v => (cat().dir === 'desc' ? -v : v);
  // Optional clock: a few seconds per car, and running out counts as a wrong place.
  const TIMER_SECS = ONLINE ? 10 : 15;
  const TIMER_OPTS = [[false, 'Fără', 'Fără limită de timp'], [true, `${TIMER_SECS} secunde`, 'Pe mașină, cu clasament']];
  const clock = makeTimer({
    box: $('hud-timer'), bar: $('timer-bar'), num: $('timer-num'),
    onEnd: () => place(true),
  });
  // One board per category and clock; the daily run has its own; the duo game keeps no record.
  const boardOf = (k = state.cat, timed = state.timed, daily = state.daily) =>
    (daily ? `ordine:daily-${state.ziua}` : `ordine:${k}:${timed ? `t${TIMER_SECS}` : 'free'}`);

  const val = c => c[state.cat];
  const nameOf = i => (state.names[i] || '').trim() || `Jucător ${i + 1}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // ---------- setup ----------
  function renderSetup() {
    $('ord-cats').innerHTML = Object.entries(CATS).map(([k, c]) => {
      const best = Scores.load(boardOf(k, state.timed, false));
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
    if (location.hash === '#categorie') Shared.inapoi('#');
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
  // Provocarea zilei: aceeași categorie și aceleași mașini pentru toți, singur, fără ceas.
  $('o-daily').addEventListener('click', () => { haptic(); start(true); });
  if (ONLINE && window.FrqCloud) FrqCloud.pregateste();
  // prima pagină („Azi") pornește direct Provocarea zilei
  if (ONLINE && new URLSearchParams(location.search).has('provocare')) {
    history.replaceState(history.state, '', `${location.pathname}?online`);
    setTimeout(() => $('o-daily').click(), 0);
  }

  // ---------- cars ----------
  // Which cars come in and which place is right: ordine-model.js, shared with the server.
  // A timed solo run counts for the overall leaderboard: the server hands out the seed
  // first. Without it (offline, slow) the run is played anyway, just not ranked.
  const butoaneStart = () => [$('ord-form').querySelector('[type=submit]'), $('o-again')];
  async function start(daily = false) {
    if (state.pornind) return;
    daily = ONLINE && daily;
    let partida = null;
    if (ONLINE && window.FrqCloud) {
      state.pornind = true;
      butoaneStart().forEach(b => { b.disabled = true; });
      partida = await FrqCloud.pornestePartida('ordine', state.cat, 4000, daily ? todayKey() : null);
      butoaneStart().forEach(b => { b.disabled = false; });
      state.pornind = false;
    }
    // Provocarea zilei nu se joacă fără server: mașinile ei sunt aceleași pentru toți,
    // deci o partidă neînregistrată ar fi doar o repetiție cu răspunsurile aflate.
    if (daily && !(partida && partida.id)) {
      await Shared.intreaba(I18n.t('Fără semnal. Provocarea zilei are nevoie de internet, ca să intre în clasament. Mai încearcă puțin mai târziu.'), { da: 'Bine', nu: '', titlu: 'Provocarea zilei' });
      return;
    }
    state.partida = partida && partida.id ? { id: partida.id, seed: partida.seed } : null;
    state.daily = daily;
    state.ziua = todayKey();
    if (daily) {
      // categoria zilei, singur, fără ceas; alegerile din meniu revin la ieșire
      state.cat = OM.categoriaZilei(state.ziua);
      state.mode = 'solo';
      state.timed = true;
    }
    state.rng = daily ? OM.rngZilei(state.ziua) : state.partida ? OM.rngDin(state.partida.seed) : Math.random;
    state.gen = OM.joc({ cars: CARS, rng: state.rng, cat: state.cat });
    state.locuri = [];
    state.placed = 0; state.turn = 0; state.locked = false;
    if (!daily) Scores.migrate(`ord_best_${state.cat}`, boardOf(state.cat, false, false));
    state.best = (Scores.load(boardOf()) || {}).score || 0;
    state.run = Scores.start({
      game: 'ordine', board: boardOf(), mode: state.mode, cat: state.cat,
      timed: state.timed, seconds: state.timed ? TIMER_SECS : 0, seed: daily ? state.ziua : null,
    });
    state.list = state.gen.start();
    state.next = state.gen.urmatoarea(state.list);
    intraInJoc(1);
    tine();
  }

  // Ecranul de joc pentru starea curentă: aceeași cale la pornire și la reluare.
  function intraInJoc(gap) {
    $('o-over').hidden = true;
    show('screen-play');
    $('o-cat').textContent = cat().label;
    $('o-top').innerHTML = `&#9650; ${esc(cat().top)}`;
    $('o-bottom').innerHTML = `&#9660; ${esc(cat().bottom)}`;
    renderHud();
    renderCard(true);
    renderLadder();
    requestAnimationFrame(() => centerGap(gap, false));
    setTimeout(turaBotului, 500);
  }

  // ---------- contra botului ----------
  // FRQ Bot joacă rândul jucătorului 2: își mută ținta pe scară și pune mașina.
  // Nimerește după nivel; greșește mai des pe o scară lungă și când vecinii au valori
  // apropiate, ca un om. Când greșește, o pune cu un loc mai sus sau mai jos.
  const NIVELE_BOT = [
    { nume: 'Ușor', sansa: 0.72 }, { nume: 'Mediu', sansa: 0.84 }, { nume: 'Greu', sansa: 0.93 },
  ];
  const BOT = 'FRQ Bot';
  function turaBotului() {
    if (state.mode !== 'duo' || state.bot == null || state.turn !== 1 || state.locked || !$('screen-play').classList.contains('is-active')) return;
    const L = state.list, n = state.next;
    let bun = 0;
    for (let k = 0; k <= L.length; k++) if (state.gen.corect(L, k, n)) { bun = k; break; }
    const v = val(n), vec = [L[bun - 1], L[bun]].filter(Boolean).map(val);
    const dif = vec.length ? Math.min(...vec.map(x => Math.abs(x - v) / Math.max(Math.abs(x), Math.abs(v), 1e-9))) : 1;
    const sansa = Math.min(0.98, Math.max(0.45, NIVELE_BOT[state.bot].sansa - Math.max(0, L.length - 6) * 0.012 + (dif > 0.25 ? 0.05 : dif < 0.05 ? -0.15 : 0)));
    let k = bun;
    if (Math.random() >= sansa) {
      const gresite = [bun - 1, bun + 1].filter(x => x >= 0 && x <= L.length && !state.gen.corect(L, x, n));
      if (gresite.length) k = gresite[Math.floor(Math.random() * gresite.length)];
    }
    state.locked = true;   // degetul tău nu mută scara cât joacă el
    $('o-place').disabled = true;
    const pas = () => {
      if (!$('screen-play').classList.contains('is-active') || state.mode !== 'duo') return;
      // derularea lină nu mută ținta cât jocul e blocat: o mutăm noi, pas cu pas
      if (state.gap !== k) { const urm = state.gap + Math.sign(k - state.gap); centerGap(urm); state.gap = urm; markGap(); setTimeout(pas, 200); return; }
      setTimeout(() => { $('o-place').disabled = false; state.locked = false; place(); }, 550);
    };
    setTimeout(pas, 700);
  }

  // ---------- partida salvată ----------
  const CARTI = new Map(CARS.map(c => [c.id, c]));
  const tine = () => salvata.scrie({
    cat: state.cat, mode: state.mode, names: state.names, timed: state.timed, bot: state.bot,
    list: state.list.map(c => c.id), next: state.next.id, used: state.gen.folosite(),
    gap: state.gap, turn: state.turn, placed: state.placed, best: state.best, run: state.run,
    daily: state.daily, ziua: state.ziua, partida: state.partida,
    rng: state.daily || state.partida ? state.rng.stare() : null, locuri: state.locuri,
    salvatLa: Date.now(),   // cu cronometru: dacă lipsești mai mult decât are mașina, a expirat
  });
  function reia(s) {
    const list = s.list.map(id => CARTI.get(id)), next = CARTI.get(s.next);
    if (list.some(c => !c) || !next || !CATS[s.cat]) { salvata.sterge(); return; }
    Object.assign(state, {
      cat: s.cat, mode: s.mode, names: s.names, timed: s.timed, list, next, bot: s.bot != null ? s.bot : null,
      turn: s.turn, placed: s.placed, best: s.best, run: s.run, locked: false,
      gap: Math.min(s.gap || 1, list.length),
      daily: !!s.daily, ziua: s.ziua || todayKey(), locuri: s.locuri || [], partida: s.partida || null,
    });
    // generatorul reia exact de unde a rămas (la Provocarea zilei și în clasamentul
    // general, cu starea lui)
    const cuSeed = state.daily || state.partida;
    state.rng = cuSeed ? OM.rngDin(0) : Math.random;
    if (cuSeed) state.rng.seteaza(s.rng);
    state.gen = OM.joc({ cars: CARS, rng: state.rng, cat: state.cat });
    state.gen.seteazaFolosite(s.used || []);
    // O cursă cronometrată reluată a stat cât a vrut în afara ceasului: rămâne
    // valabilă, dar un clasament o poate deosebi de una dusă dintr-o suflare.
    if (state.run) state.run.reluari = (state.run.reluari || 0) + 1;
    intraInJoc(state.gap);
    // Cu cronometru, timpul mașinii a curs și cât ai lipsit: dacă s-a terminat, mașina
    // e pierdută (altfel ai fi putut căuta locul ei între timp și relua).
    if (state.timed && s.salvatLa && Date.now() - s.salvatLa > TIMER_SECS * 1000) setTimeout(() => place(true), 600);
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
    setTimeout(() => Shared.indiciu($('o-place'), 'Derulează lista până când linia roșie e la locul mașinii, apoi apasă Aici.', 'ord'), 600);
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
    clock.pauseWhenHidden = !state.timed;   // a timed run keeps counting while you are away
    clock.start(state.timed ? TIMER_SECS : 0);   // untimed runs are still measured
  }

  const GAP = 34;
  function renderLadder(newIndex = -1) {
    const L = state.list;
    const rung = (c, i) => `
      <div class="rung${i === newIndex ? ' is-new' : ''}">
        <span class="rung-pos">${i + 1}</span>
        <span class="rung-img"><img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer"></span>
        <span class="rung-name"><b>${esc(brandOf(c.name))}</b><span>${esc(modelOf(c.name) || c.name)}</span></span>
        <span class="rung-val">${value(c)}</span>
      </div>`;
    const gap = k => `<div class="gap" data-g="${k}"><span>Aici</span></div>`;
    $('o-ladder').innerHTML = L.map((c, i) => gap(i) + rung(c, i)).join('') + gap(L.length);
    $('o-ladder').querySelectorAll('.rung-img img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
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
    const away = clock.away();
    state.run.hiddenMs += away.hiddenMs;
    state.run.awayCount += away.awayCount;
    const L = state.list, k = state.gap;
    const ok = !timedOut && state.gen.corect(L, k, state.next);
    state.locuri.push(timedOut ? -1 : k);
    const card = $('o-new');
    card.classList.add('is-revealed', ok ? 'is-right' : 'is-wrong');

    if (ok) {
      haptic('success');
      window.Sunete && Sunete.corect();
      setTimeout(() => {
        L.splice(k, 0, state.next);
        state.placed++;
        renderLadder(k);
        // The new car lands where the aim was: keep it just above the line.
        state.gap = k + 1; centerGap(k + 1, false);
        if (state.mode === 'duo') state.turn = 1 - state.turn;
        state.next = state.gen.urmatoarea(state.list);
        tine();
        renderHud();
        card.classList.add('is-leaving');
        setTimeout(() => { renderCard(true); state.locked = false; turaBotului(); }, 220);
      }, 650);
      return;
    }

    haptic('error');
    window.Sunete && Sunete.gresit();
    // partida s-a terminat chiar acum: fără „Continuă" la aceeași mașină, cu locul ei văzut
    salvata.sterge();
    const correct = state.gen.locCorect(L, state.next);
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
    salvata.sterge();
    clock.hide();
    state.run.timeMs = Math.round(state.run.timeMs);   // the same milliseconds here and on the leaderboard
    const solo = state.mode === 'solo';
    if (solo) {
      const { record, best } = Scores.finish(state.run, state.placed);
      $('o-over-kicker').textContent = state.daily ? `Provocarea zilei · ${cat().label}` : cat().label;
      $('o-over-title').textContent = state.placed;
      const lipsa = best && !record ? best.score - state.placed : null;
      $('o-over-sub').innerHTML = record && state.placed
        ? `<span>Record nou!</span><span class="over-time">${Scores.time(state.run.timeMs)}</span>`
        : `<span>${state.placed === 1 ? 'mașină pusă' : 'mașini puse'} la locul lor</span>`
          + `<span class="over-time">${Scores.time(state.run.timeMs)}</span>`
          + (lipsa != null && lipsa <= 3 && best.score > 0
            ? `<span class="over-aproape">${lipsa === 0 ? 'Ai egalat recordul' : `Încă ${lipsa + 1} și băteai recordul (${best.score})`}</span>`
            : `<span>record ${best ? best.score : state.placed}</span>`);
      if (record && state.placed) setTimeout(() => window.Sunete && Sunete.record(), 350);
    } else {
      const winner = 1 - state.turn, tu = state.bot != null;
      $('o-over-kicker').textContent = tu && state.turn === 0 ? 'Ai greșit' : `${nameOf(state.turn)} a greșit`;
      $('o-over-title').innerHTML = `<span class="p${winner}">${esc(tu && winner === 0 ? 'Ai câștigat' : nameOf(winner))}</span>`;
      $('o-over-sub').textContent = tu && winner === 0 ? `cu un clasament de ${state.list.length} mașini` : `câștigă, cu un clasament de ${state.list.length} mașini`;
    }
    // Provocarea zilei intră în clasament: pleacă locurile alese, scorul îl socotește serverul
    if (solo && state.daily && window.FrqNotif) setTimeout(() => FrqNotif.propune('provocare'), 5000);
    if (solo && state.daily && window.FrqCloud) {
      FrqCloud.afiseazaZi($('o-top10'), { joc: 'ordine', data: state.ziua, id: state.partida && state.partida.id, raspunsuri: state.locuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else if (solo && state.partida && window.FrqCloud) {
      FrqCloud.afiseazaGeneral($('o-top10'), { joc: 'ordine', cat: state.cat, id: state.partida.id, raspunsuri: state.locuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else if (solo && ONLINE) {
      // pornită fără semnal (sau prea încet): s-a jucat, dar n-a intrat în clasament
      $('o-top10').innerHTML = `<p class="col-nota">${Shared.esc(I18n.t('Partida n-a intrat în clasament: n-a fost semnal când a început.'))}</p>`;
      $('o-top10').hidden = false;
    } else $('o-top10').hidden = true;
    state.partida = null;
    $('o-share').hidden = !(solo && state.placed);
    $('o-share').textContent = 'Bate-mi scorul';
    $('o-over').hidden = false;
    $('o-again').focus();
  }
  $('o-again').addEventListener('click', () => start(state.daily));
  const toMenu = () => {
    salvata.sterge(); clock.hide(); $('o-over').hidden = true;
    state.bot = null;
    if (location.hash === '#bot') Shared.inapoi('#');
    // după Provocarea zilei, meniul arată iar alegerile tale
    state.cat = store.get('ord_cat', 'hp'); state.mode = modLocal(); state.timed = ceasLocal();
    state.daily = false;
    renderSetup(); randeazaMeniuO(); show('screen-setup');
  };
  $('o-menu').addEventListener('click', toMenu);
  $('o-share').addEventListener('click', () => {
    const baza = `${location.origin}${location.pathname}`;
    const text = state.daily
      ? `Am pus ${state.placed} mașini la locul lor la Provocarea zilei din În ordine. Aceleași mașini pentru toți azi. Mă bați?`
      : `Am pus ${state.placed} mașini la locul lor în În ordine (${CATS[state.cat].label}). Mă bați?`;
    Shared.bateMa($('o-share'), text, state.daily ? `${baza}?online&provocare` : ONLINE ? `${baza}?online` : baza);
  });
  $('btn-cls').addEventListener('click', () => window.FrqCloud && FrqCloud.arataClasament('ordine', state.cat));
  $('btn-quit').addEventListener('click', async () => {
    if (state.placed === 0 || await Shared.intreaba(I18n.t('Ieși? Clasamentul se pierde.'))) toMenu();
  });

  renderSetup();
  // ---------- meniul jocului ----------
  // Rânduri mari: Continuă (dacă ai o partidă începută), Joacă, 1 la 1 (local, cu
  // numele pe pagina lor), Provocarea zilei și Clasamentul (online), Categoria,
  // Cronometrul (local). Fiecare pagină are adresa ei, deci Înapoi duce în meniu.
  function randeazaMeniuO() {
    const best = Scores.load(boardOf(state.cat, ONLINE || state.timed, false));
    const cont = document.querySelector('#ord-form [data-continua]');
    const continua = cont && !cont.hidden;
    const joaca = {
      id: 'joaca', eticheta: ONLINE ? 'Pe bani · 1 mil. pe mașină, +5 de la 5' : `Singur · ${state.timed ? `${TIMER_SECS} secunde pe mașină` : 'fără cronometru'}`,
      titlu: CATS[state.cat].label, sub: best && best.score ? `Recordul tău: ${best.score}` : 'Pune mașinile în ordine', buton: 'Joacă', poza: Shared.pozaDin('ord'),
    };
    const dale = [];
    // o partidă începută trece pe primul loc; Joacă devine o dală
    if (continua) dale.push({ id: 'joaca', titlu: 'Partidă nouă', sub: CATS[state.cat].label, poza: joaca.poza });
    if (ONLINE) {
      dale.push({ id: 'zi', titlu: 'Provocarea zilei', sub: '5 mil. · aceleași mașini pentru toți', insigna: 'Azi', poza: Shared.pozaDin('ord-zi') });
      dale.push({ id: 'prieten', titlu: 'Cu un prieten', sub: 'Live · 10 mil. dacă câștigi', poza: Shared.pozaDin('ord-prieten') });
    } else {
      dale.push({ id: 'bot', titlu: 'Contra botului', sub: `Pe rând, cu ${BOT}`, poza: Shared.pozaDin('ord-zi') });
      dale.push({ id: 'duo', titlu: '1 la 1', sub: 'Pe rând, pe același telefon', poza: Shared.pozaDin('ord-duo') });
    }
    Shared.monteazaHub($('o-meniu'), {
      bara: [
        { id: 'cat', titlu: 'Clasament după', val: CATS[state.cat].label },
        ONLINE ? { id: 'cls', titlu: 'Clasament' } : { id: 'ceas', titlu: 'Cronometru', val: state.timed ? `${TIMER_SECS} s` : 'Oprit' },
      ],
      erou: continua ? { id: 'continua', eticheta: 'Partida ta', titlu: 'Continuă', sub: cont.querySelector('small').textContent, buton: 'Continuă', poza: joaca.poza } : joaca,
      dale,
    });
  }
  const pasO = () => {
    const s = $('screen-setup');
    s.classList.toggle('pas-cat', location.hash === '#categorie');
    s.classList.toggle('pas-nume', location.hash === '#nume');
    s.classList.toggle('pas-bot', location.hash === '#bot');
    if (location.hash === '#bot') {
      const SUB = ['Greșește des. Bun ca să înveți mașinile', 'Știe bine mașinile', 'Aproape nu greșește'];
      $('o-bot-niv').innerHTML = Shared.randuriMeniu(NIVELE_BOT.map((n, i) => ({ id: `n${i}`, titlu: n.nume, sub: SUB[i], primar: i === store.get('ord_bot', 1) })));
    }
    randeazaMeniuO();
  };
  $('o-bot-niv').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const nivel = +r.dataset.mj.slice(1);
    store.set('ord_bot', nivel);
    state.mode = 'duo';
    state.bot = nivel;
    state.names = [(window.FrqCloud && FrqCloud.numeLocal()) || 'Tu', BOT];
    start();
  });
  window.addEventListener('hashchange', pasO);
  $('o-pas-inapoi').addEventListener('click', () => Shared.inapoi('#'));
  $('o-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'continua') document.querySelector('#ord-form [data-continua]').click();
    if (id === 'joaca') { state.bot = null; state.mode = 'solo'; if (!ONLINE) store.set('ord_mode', 'solo'); renderSetup(); $('ord-form').requestSubmit(); }
    if (id === 'duo') { state.bot = null; state.mode = 'duo'; store.set('ord_mode', 'duo'); renderSetup(); Shared.mergi('#nume'); }
    if (id === 'bot') Shared.mergi('#bot');
    if (id === 'zi') $('o-daily').click();
    if (id === 'cls') $('btn-cls').click();
    if (id === 'prieten') location.replace('camera.html?joc=ordine');
    if (id === 'cat') Shared.mergi('#categorie');
    if (id === 'ceas') { state.timed = !state.timed; store.set('ord_timer', state.timed); renderSetup(); randeazaMeniuO(); }
  });
  ['ord-modes', 'ord-timer'].forEach(id => { $(id).hidden = true; $(id).previousElementSibling.hidden = true; });
  $('o-daily').hidden = true;

  // ce se vede pe ecranul de start, după mod; Înapoi duce la meniul de jocuri potrivit
  document.querySelectorAll('a.back-btn[href="index.html"]').forEach(a => { a.href = ONLINE ? 'index.html#online' : 'index.html#local'; });
  if (ONLINE) {
    ['ord-modes', 'ord-timer'].forEach(id => { $(id).hidden = true; $(id).previousElementSibling.hidden = true; });
    document.querySelector('#screen-setup .eyebrow').textContent = 'Jocuri FRQ · Online';
    document.querySelector('#screen-setup .lede').textContent = 'Fiecare mașină nouă intră la locul ei în clasament. 10 secunde pe mașină, o greșeală și s-a terminat. Totul intră în clasament.';
  } else {
    $('o-daily').hidden = true;
    $('btn-cls').hidden = true;
  }
  const salvata = Shared.partida({
    cheie: ONLINE ? 'ordine-online' : 'ordine',
    rezumat: s => `${s.list.length} mașini în clasament`,
    reia,
  });
  pasO();
})();
