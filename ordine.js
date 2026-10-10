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
    if (location.hash === '#categorie') history.back();
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
    history.replaceState(null, '', `${location.pathname}?online`);
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
  }

  // ---------- partida salvată ----------
  const CARTI = new Map(CARS.map(c => [c.id, c]));
  const tine = () => salvata.scrie({
    cat: state.cat, mode: state.mode, names: state.names, timed: state.timed,
    list: state.list.map(c => c.id), next: state.next.id, used: state.gen.folosite(),
    gap: state.gap, turn: state.turn, placed: state.placed, best: state.best, run: state.run,
    daily: state.daily, ziua: state.ziua, partida: state.partida,
    rng: state.daily || state.partida ? state.rng.stare() : null, locuri: state.locuri,
  });
  function reia(s) {
    const list = s.list.map(id => CARTI.get(id)), next = CARTI.get(s.next);
    if (list.some(c => !c) || !next || !CATS[s.cat]) { salvata.sterge(); return; }
    Object.assign(state, {
      cat: s.cat, mode: s.mode, names: s.names, timed: s.timed, list, next,
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
        setTimeout(() => { renderCard(true); state.locked = false; }, 220);
      }, 650);
      return;
    }

    haptic('error');
    window.Sunete && Sunete.gresit();
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
      const winner = 1 - state.turn;
      $('o-over-kicker').textContent = `${nameOf(state.turn)} a greșit`;
      $('o-over-title').innerHTML = `<span class="p${winner}">${esc(nameOf(winner))}</span>`;
      $('o-over-sub').textContent = `câștigă, cu un clasament de ${state.list.length} mașini`;
    }
    // Provocarea zilei intră în clasament: pleacă locurile alese, scorul îl socotește serverul
    if (solo && state.daily && window.FrqCloud) {
      FrqCloud.afiseazaZi($('o-top10'), { joc: 'ordine', data: state.ziua, id: state.partida && state.partida.id, raspunsuri: state.locuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else if (solo && state.partida && window.FrqCloud) {
      FrqCloud.afiseazaGeneral($('o-top10'), { joc: 'ordine', cat: state.cat, id: state.partida.id, raspunsuri: state.locuri.slice(), timp_ms: Math.round(state.run.timeMs) });
    } else $('o-top10').hidden = true;
    state.partida = null;
    $('o-over').hidden = false;
    $('o-again').focus();
  }
  $('o-again').addEventListener('click', () => start(state.daily));
  const toMenu = () => {
    salvata.sterge(); clock.hide(); $('o-over').hidden = true;
    // după Provocarea zilei, meniul arată iar alegerile tale
    state.cat = store.get('ord_cat', 'hp'); state.mode = modLocal(); state.timed = ceasLocal();
    state.daily = false;
    renderSetup(); randeazaMeniuO(); show('screen-setup');
  };
  $('o-menu').addEventListener('click', toMenu);
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
    const rec = best && best.score ? ` · recordul ${best.score}` : '';
    const cont = document.querySelector('#ord-form [data-continua]');
    const r = [];
    if (cont && !cont.hidden) r.push({ id: 'continua', titlu: 'Continuă', sub: cont.querySelector('small').textContent, primar: true });
    r.push({ id: 'joaca', titlu: ONLINE ? 'Joacă' : 'Singur', sub: `${CATS[state.cat].label} · ${ONLINE || state.timed ? `${TIMER_SECS} secunde pe mașină` : 'fără cronometru'}${rec}`, primar: !r.length });
    if (ONLINE) {
      r.push({ id: 'zi', titlu: 'Provocarea zilei', sub: 'Aceleași mașini pentru toți, azi' });
      r.push({ id: 'prieten', titlu: 'Cu un prieten', sub: 'Live, pe rând, fiecare pe telefonul lui' });
    } else r.push({ id: 'duo', titlu: '1 la 1', sub: 'Pe rând, pe același telefon' });
    r.push({ id: 'cat', titlu: 'Clasament după', sub: CATS[state.cat].label });
    if (ONLINE) r.push({ id: 'cls', titlu: 'Clasament', sub: 'General, săptămâna, provocarea zilei' });
    else r.push({ id: 'ceas', titlu: 'Cronometru', sub: state.timed ? `${TIMER_SECS} secunde pe mașină` : 'Oprit' });
    $('o-meniu').innerHTML = Shared.randuriMeniu(r);
  }
  const pasO = () => {
    const s = $('screen-setup');
    s.classList.toggle('pas-cat', location.hash === '#categorie');
    s.classList.toggle('pas-nume', location.hash === '#nume');
    randeazaMeniuO();
  };
  window.addEventListener('hashchange', pasO);
  $('o-pas-inapoi').addEventListener('click', () => history.back());
  $('o-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'continua') document.querySelector('#ord-form [data-continua]').click();
    if (id === 'joaca') { state.mode = 'solo'; if (!ONLINE) store.set('ord_mode', 'solo'); renderSetup(); $('ord-form').requestSubmit(); }
    if (id === 'duo') { state.mode = 'duo'; store.set('ord_mode', 'duo'); renderSetup(); location.hash = 'nume'; }
    if (id === 'zi') $('o-daily').click();
    if (id === 'cls') $('btn-cls').click();
    if (id === 'prieten') location.href = 'camera.html?joc=ordine';
    if (id === 'cat') location.hash = 'categorie';
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
