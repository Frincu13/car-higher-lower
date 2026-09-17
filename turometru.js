(() => {
  'use strict';

  const { store, brandOf, modelOf, esc, artHTML, wirePhotos } = window.Shared;
  const CARS = (window.CARS || []).filter(c => c.image);

  // Each axis goes from the left end of the dial (0) to the right end (100).
  const AXES = [
    ['Mașină de bunic', 'Mașină de interlop'],
    ['Nimeni nu o vrea', 'Poster pe perete'],
    ['Cumpărare rațională', 'Criză a vârstei a doua'],
    ['Discretă', 'Toată strada se uită după ea'],
    ['O conduci la 20 de ani', 'O conduci la 60 de ani'],
    ['Plictisitoare', 'Nebunie curată'],
    ['Mașină de familie', 'Mașină de burlac'],
    ['Urâtă', 'Superbă'],
    ['Ieftină la service', 'Te lasă sărac la service'],
    ['Mașină de oraș', 'Mașină de autostradă'],
    ['Mașina stagiarului', 'Mașina șefului'],
    ['Uitată de toți', 'Legendă'],
    ['Liniștită', 'Vecinii sună la poliție'],
    ['Pentru drum la țară', 'Pentru Monaco'],
    ['Mașină din reclamă la bancă', 'Mașină din film cu urmăriri'],
    ['Parchezi oriunde', 'Nu încape în nicio parcare'],
    ['Confortabilă', 'Te doare spatele după 10 km'],
    ['O împrumuți oricui', 'Nu o împrumuți nimănui'],
    ['Pur și simplu veche', 'Retro și cool'],
    ['Mașina din copilărie', 'Mașina din viitor'],
    ['Strică prima întâlnire', 'Garantează a doua întâlnire'],
    ['Nu știe ce e driftul', 'Născută pentru drift'],
    ['Șofer răbdător', 'Claxonează când se face verde'],
    ['Mașină de ride sharing', 'Mașină de colecție'],
    ['Merge și prin zăpadă', 'Stă în garaj toată iarna'],
    ['Consum mic', 'Vezi acul de benzină cum coboară'],
    ['Sună a mașină de cusut', 'Sună a avion de vânătoare'],
    ['Mașina tatălui meu', 'Mașina visurilor mele'],
    ['Fără personalitate', 'Plină de personalitate'],
    ['Cumperi cu mintea', 'Cumperi cu inima'],
  ];

  // Distance from the target (dial units 0-100) -> points.
  const ZONES = [[3, 4], [8, 3], [13, 2]];
  const pointsFor = d => (ZONES.find(([w]) => d <= w) || [0, 0])[1];

  const $ = id => document.getElementById(id);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

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
    state.car = null;
    state.target = 50;
    state.guess = 50;
    state.cars = drawCars();
    render();
  }

  function drawCars() {
    let pool = CARS.filter(c => !state.usedCars.has(c.id));
    if (pool.length < 4) { state.usedCars = new Set(); pool = CARS.slice(); }
    const picked = shuffle(pool.slice()).slice(0, 4);
    picked.forEach(c => state.usedCars.add(c.id));
    return picked;
  }

  // ---------- dial ----------
  // Half-circle tachometer: value 0 at the far left, 100 at the far right.
  const CX = 200, CY = 212, R = 170;
  const polar = (v, r) => {
    const a = Math.PI * (1 - v / 100);
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
  };
  const arc = (from, to, r) => {
    const [x1, y1] = polar(from, r), [x2, y2] = polar(to, r);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  function dialSVG({ needle, needleClass = '', target = null, interactive = false }) {
    const ticks = [];
    for (let v = 0; v <= 100; v += 5) {
      const big = v % 10 === 0;
      const [x1, y1] = polar(v, R - (big ? 26 : 16)), [x2, y2] = polar(v, R - 4);
      ticks.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="tick${big ? ' big' : ''}${v >= 85 ? ' red' : ''}"/>`);
      if (big) {
        const [tx, ty] = polar(v, R - 46);
        ticks.push(`<text x="${tx.toFixed(1)}" y="${(ty + 6).toFixed(1)}" class="tick-num${v >= 90 ? ' red' : ''}">${v / 10}</text>`);
      }
    }
    let zones = '';
    if (target != null) {
      // Widest band first so the 4-point band sits on top.
      zones = ZONES.slice().reverse().map(([w, pts]) =>
        `<path d="${arc(Math.max(0, target - w), Math.min(100, target + w), R - 84)}" class="zone z${pts}"/>`).join('');
      const [mx, my] = polar(target, R - 30);
      zones += `<path d="${arc(Math.max(0, target - .6), Math.min(100, target + .6), R - 84)}" class="zone-center"/>`;
      zones += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" class="target-dot"/>`;
    }
    const angle = -90 + needle * 1.8;
    return `<svg class="dial${interactive ? ' is-interactive' : ''}" viewBox="0 0 400 236" role="${interactive ? 'slider' : 'img'}"
        ${interactive ? `tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(needle)}" aria-label="Poziția acului"` : 'aria-hidden="true"'}>
      <path d="${arc(0, 100, R)}" class="rim"/>
      <path d="${arc(85, 100, R - 10)}" class="redline"/>
      ${zones}
      ${ticks.join('')}
      <text x="${CX}" y="${CY + 23}" class="dial-unit">x1000 RPM</text>
      <g class="needle ${needleClass}" transform="rotate(${angle.toFixed(2)} ${CX} ${CY})">
        <line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 22}"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="13" class="hub"/>
    </svg>`;
  }

  function wireDial(root, onChange) {
    const svg = root.querySelector('svg.dial.is-interactive');
    if (!svg) return;
    const setFrom = e => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let a = Math.atan2(CY - p.y, p.x - CX) * 180 / Math.PI; // 180 = left, 0 = right
      if (a < 0) a = p.x < CX ? 180 : 0; // below the pivot: snap to the nearest end
      update(Math.max(0, Math.min(100, (180 - a) / 1.8)));
    };
    const update = v => {
      onChange(v);
      svg.querySelector('.needle').setAttribute('transform', `rotate(${(-90 + v * 1.8).toFixed(2)} ${CX} ${CY})`);
      svg.setAttribute('aria-valuenow', Math.round(v));
    };
    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); setFrom(e); });
    svg.addEventListener('pointermove', e => { if (svg.hasPointerCapture(e.pointerId)) setFrom(e); });
    svg.addEventListener('keydown', e => {
      const cur = +svg.getAttribute('aria-valuenow');
      const step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); update(Math.max(0, cur - step)); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); update(Math.min(100, cur + step)); }
    });
  }

  // ---------- render ----------
  const axisHTML = () => {
    const [l, r] = axis();
    return `<div class="turo-axis"><span class="axis-l">&larr; ${esc(l)}</span><span class="axis-r">${esc(r)} &rarr;</span></div>`;
  };
  const carHTML = (car, extra = '') => `
    <div class="turo-car ${extra}">
      ${artHTML(car)}
      <span class="brand">${esc(brandOf(car.name))}</span>
      <span class="turo-car-model">${esc(modelOf(car.name) || car.name)}</span>
      <span class="meta">${esc(car.years)}</span>
    </div>`;

  function render() {
    $('round-label').textContent = `${state.round + 1} / ${state.rounds}`;
    $('score-label').textContent = state.score;
    const g = esc(giver());
    const others = players().filter((_, i) => i !== state.round % state.names.length).map(esc).join(', ');
    let html = '';

    switch (state.phase) {
      case 'handoff':
        html = `<div class="turo-handoff">
          <span class="skew-bar" aria-hidden="true"></span>
          <p class="eyebrow">Runda ${state.round + 1}</p>
          <h2 class="turo-big">Dă telefonul lui <em>${g}</em></h2>
          <p class="turo-note">${others} nu se uită la ecran.</p>
          <button class="btn btn-primary" data-act="to-pick">Sunt ${g}, încep</button>
        </div>`;
        break;

      case 'pick':
        html = `<p class="turo-prompt"><strong>${g}</strong>, alege mașina pe care o așezi pe axa asta:</p>
          ${axisHTML()}
          <div class="turo-pick">${state.cars.map((c, i) => `
            <div role="button" tabindex="0" class="turo-pick-card" data-pick="${i}">${carHTML(c)}</div>`).join('')}
          </div>
          <div class="turo-actions">
            <button class="btn btn-ghost" data-act="reroll" ${state.rerolled ? 'disabled' : ''}>${state.rerolled ? 'Ai folosit reîmprospătarea' : 'Alte 4 mașini (o dată)'}</button>
          </div>`;
        break;

      case 'target':
        html = `<p class="turo-prompt"><strong>${g}</strong>, mută acul unde crezi tu că stă mașina.</p>
          ${axisHTML()}
          <div class="turo-board">
            ${carHTML(state.car, 'is-compact')}
            <div class="turo-dial">${dialSVG({ needle: state.target, needleClass: 'is-red', interactive: true })}</div>
          </div>
          <div class="turo-actions"><button class="btn btn-primary" data-act="lock-target">Gata, ascunde acul</button></div>`;
        break;

      case 'pass':
        html = `<div class="turo-handoff">
          <span class="skew-bar" aria-hidden="true"></span>
          <p class="eyebrow">Acul e ascuns</p>
          <h2 class="turo-big">Dă telefonul celorlalți</h2>
          <p class="turo-note">${others}: ghiciți unde a pus ${g} acul.</p>
          <button class="btn btn-primary" data-act="to-guess">Ghicim</button>
        </div>`;
        break;

      case 'guess':
        html = `<p class="turo-prompt">Unde a pus <strong>${g}</strong> acul? Discutați și mutați-l.</p>
          ${axisHTML()}
          <div class="turo-board">
            ${carHTML(state.car, 'is-compact')}
            <div class="turo-dial">${dialSVG({ needle: state.guess, interactive: true })}</div>
          </div>
          <div class="turo-actions"><button class="btn btn-primary" data-act="lock-guess">Blocăm răspunsul</button></div>`;
        break;

      case 'reveal': {
        const last = state.history[state.history.length - 1];
        const verdict = { 4: 'Perfect!', 3: 'Foarte aproape', 2: 'Aproape', 0: 'Ratat' }[last.points];
        html = `<p class="turo-prompt"><strong>${g}</strong> pusese acul unde vedeți punctul roșu.</p>
          ${axisHTML()}
          <div class="turo-board">
            ${carHTML(state.car, 'is-compact')}
            <div class="turo-dial">${dialSVG({ needle: state.guess, target: state.target })}</div>
          </div>
          <div class="turo-result">
            <span class="turo-points p${last.points}">+${last.points}</span>
            <span class="turo-verdict">${verdict}</span>
          </div>
          <div class="turo-actions"><button class="btn btn-primary" data-act="next">${state.round + 1 >= state.rounds ? 'Vezi finalul' : 'Runda următoare'}</button></div>`;
        break;
      }
    }

    $('stage').className = `turo-stage phase-${state.phase}`;
    $('stage').innerHTML = html;
    wirePhotos($('stage'));
    $('stage').querySelectorAll('.art-credit a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    if (state.phase === 'target') wireDial($('stage'), v => { state.target = v; });
    if (state.phase === 'guess') wireDial($('stage'), v => { state.guess = v; });
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
        <span class="recap-axis">${esc(h.axis[0])} ↔ ${esc(h.axis[1])}</span>
        <span class="recap-car">${esc(h.car.name)} <em>de ${esc(h.giver)}</em></span>
        <span class="turo-points p${h.points}">+${h.points}</span>
      </li>`).join('');
    show('screen-end');
  }

  $('btn-again').addEventListener('click', start);
  $('btn-setup').addEventListener('click', () => { renderNames(); show('screen-setup'); });
  $('btn-quit').addEventListener('click', () => {
    if (confirm('Ieși din joc? Scorul turei curente se pierde.')) { renderNames(); show('screen-setup'); }
  });

  renderNames();
})();
