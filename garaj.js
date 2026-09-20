(() => {
  'use strict';

  const { store, brandOf, modelOf, esc, artHTML, wirePhotos, preload, haptic, shuffle } = window.Shared;
  const { kindOf, KINDS, KIND_LABEL } = window.Kinds;
  const CARS = (window.CARS || []).filter(c => c.image);

  const OPTS = [['keep', 'Garaj'], ['sell', 'Vânzare'], ['crush', 'Presă']];
  const OPT_LABEL = Object.fromEntries(OPTS);
  const THEMES = [['mix', 'Amestec'], ...KINDS];

  const $ = id => document.getElementById(id);
  const state = {
    theme: store.get('gsp_theme', 'mix'),
    round: 1, cars: [], next: null, pick: {}, used: new Set(), done: false,
  };
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // ---------- setup ----------
  function renderThemes() {
    if (!THEMES.some(([k]) => k === state.theme)) state.theme = 'mix';
    $('g-themes').innerHTML = THEMES.map(([k, label]) =>
      `<button type="button" class="gsp-theme${k === state.theme ? ' is-on' : ''}" role="radio" aria-checked="${k === state.theme}" data-theme="${k}">${esc(label)}</button>`).join('');
  }
  $('g-themes').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]'); if (!b) return;
    state.theme = b.dataset.theme; store.set('gsp_theme', state.theme); haptic(); renderThemes();
  });
  $('g-start').addEventListener('click', () => {
    state.round = 1; state.used = new Set(); state.next = null;
    $('g-theme').textContent = THEMES.find(([k]) => k === state.theme)[1];
    show('screen-play');
    newRound();
  });

  // ---------- cars ----------
  // Three cars of the chosen kind; in "Amestec", three different kinds.
  function drawThree() {
    let pool = CARS.filter(c => state.theme === 'mix' || kindOf(c) === state.theme);
    let fresh = pool.filter(c => !state.used.has(c.id));
    if (fresh.length < 3) { state.used = new Set(); fresh = pool; }
    fresh = shuffle(fresh.slice());
    const out = [];
    for (const c of fresh) {
      if (out.length === 3) break;
      const clash = out.some(o => brandOf(o.name) === brandOf(c.name) || (state.theme === 'mix' && kindOf(o) === kindOf(c)));
      if (!clash) out.push(c);
    }
    for (const c of fresh) if (out.length < 3 && !out.includes(c)) out.push(c);
    out.forEach(c => state.used.add(c.id));
    return out;
  }

  function newRound() {
    state.cars = state.next || drawThree();
    state.next = drawThree();
    state.next.forEach(preload);   // next round's photos load while this one is played
    state.pick = {}; state.done = false;
    $('g-round').textContent = state.round;
    $('g-cars').className = 'gsp-cars';
    $('g-cars').innerHTML = state.cars.map((c, i) => `
      <article class="gsp-card" data-i="${i}" style="--d:${i * 70}ms">
        <div class="gsp-photo">${artHTML(c)}<span class="gsp-stamp" aria-hidden="true"></span></div>
        <div class="gsp-info">
          <span class="brand">${esc(brandOf(c.name))}</span>
          <span class="gsp-model">${esc(modelOf(c.name) || c.name)}</span>
          <span class="meta">${esc(c.years)} &middot; ${esc(KIND_LABEL[kindOf(c)])}</span>
        </div>
        <div class="gsp-opts" role="radiogroup" aria-label="Ce faci cu ea">
          ${OPTS.map(([k, label]) => `<button type="button" class="gsp-opt o-${k}" data-opt="${k}">${label}</button>`).join('')}
        </div>
      </article>`).join('');
    // Effects layer on each photo: press plates, a for-sale tag, a light sweep, debris.
    const bits = [...Array(8)].map((_, n) => {
      const a = (n / 8) * Math.PI * 2 + Math.random() * .6, d = 60 + Math.random() * 60;
      return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * .6)}px;--r:${Math.round(Math.random() * 360)}deg"></i>`;
    }).join('');
    $('g-cars').querySelectorAll('.art').forEach(art => art.insertAdjacentHTML('beforeend', `
      <span class="gsp-fx" aria-hidden="true">
        <i class="gsp-plate top"></i><i class="gsp-plate bot"></i>
        <span class="gsp-tag">De vânzare</span>
        <span class="gsp-sweep"></span>
        <span class="gsp-bits">${bits}</span>
      </span>`));
    wirePhotos($('g-cars'));
    $('g-cars').querySelectorAll('.art-credit a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
    $('g-done').hidden = false; $('g-done').disabled = true;
    $('g-share').hidden = true; $('g-next').hidden = true;
    sync();
  }

  // ---------- choosing ----------
  // Each choice goes to exactly one car: picking one that another car has moves it here.
  $('g-cars').addEventListener('click', e => {
    const b = e.target.closest('[data-opt]');
    if (!b || state.done) return;
    const i = +b.closest('.gsp-card').dataset.i, opt = b.dataset.opt;
    if (state.pick[opt] === i) delete state.pick[opt];
    else {
      for (const k of Object.keys(state.pick)) if (state.pick[k] === i) delete state.pick[k];
      state.pick[opt] = i;
    }
    // Two chosen: the last one is obvious, fill it in.
    const free = OPTS.map(o => o[0]).filter(k => state.pick[k] == null);
    const bare = [0, 1, 2].filter(n => !Object.values(state.pick).includes(n));
    if (free.length === 1 && bare.length === 1) state.pick[free[0]] = bare[0];
    haptic();
    sync();
  });

  function sync() {
    const owner = {};
    for (const [k, i] of Object.entries(state.pick)) owner[i] = k;
    $('g-cars').querySelectorAll('.gsp-card').forEach(card => {
      const i = +card.dataset.i;
      card.dataset.choice = owner[i] || '';
      card.querySelectorAll('.gsp-opt').forEach(b => {
        const k = b.dataset.opt;
        b.classList.toggle('is-on', state.pick[k] === i);
        b.classList.toggle('is-taken', state.pick[k] != null && state.pick[k] !== i);
        b.setAttribute('aria-pressed', state.pick[k] === i);
      });
    });
    $('g-done').disabled = Object.keys(state.pick).length < 3;
  }

  // ---------- reveal ----------
  $('g-done').addEventListener('click', () => {
    if (Object.keys(state.pick).length < 3 || state.done) return;
    state.done = true;
    const box = $('g-cars');
    box.classList.add('is-done', 'is-revealing');
    $('g-done').hidden = true;
    // One car at a time, in the spotlight: the garage, the sale, and the press last.
    // [start, when the stamp lands] in ms for each step.
    const plan = { keep: [150, 450], sell: [1250, 1650], crush: [2400, 2830] };
    const cardOf = k => box.querySelector(`.gsp-card[data-i="${state.pick[k]}"]`);
    OPTS.forEach(([k]) => {
      const [t0, t1] = plan[k];
      setTimeout(() => {
        box.querySelectorAll('.gsp-card').forEach(c => c.classList.remove('is-focus'));
        const card = cardOf(k);
        card.classList.add('is-focus', `fx-${k}`);
        if (k !== 'crush') haptic('tick');
      }, t0);
      setTimeout(() => {
        const card = cardOf(k);
        card.querySelector('.gsp-stamp').textContent = OPT_LABEL[k];
        card.classList.add('is-stamped');
        if (k === 'keep') haptic('success');
      }, t1);
    });
    // The press lands 380 ms after it starts: shake everything.
    setTimeout(() => {
      box.classList.add('is-shake'); haptic('error');
      setTimeout(() => box.classList.remove('is-shake'), 400);
    }, plan.crush[0] + 380);
    setTimeout(() => {
      box.classList.remove('is-revealing');
      box.querySelectorAll('.gsp-card').forEach(c => c.classList.remove('is-focus'));
      $('g-share').hidden = false; $('g-next').hidden = false; $('g-next').focus({ preventScroll: true });
    }, 3500);
  });
  $('g-next').addEventListener('click', () => { state.round++; newRound(); });
  $('g-quit').addEventListener('click', () => { renderThemes(); show('screen-setup'); });

  // ---------- share ----------
  // A 1080x1350 card with the three photos and their stamps, shared as an image
  // where the phone allows it, otherwise downloaded.
  const loadImg = src => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  async function shareCard() {
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, W, H);
    const [logo, ...photos] = await Promise.all([loadImg('img/frq-logo.png'), ...state.cars.map(c => loadImg(c.image))]);
    if (logo) g.drawImage(logo, 60, 56, 164, 40);
    g.fillStyle = '#ed1b2f'; g.font = '700 26px Archivo, Arial'; g.textAlign = 'right';
    g.fillText(I18n.t('GARAJ SAU PRESĂ'), W - 60, 88);
    const colors = { keep: '#2ecc71', sell: '#ffffff', crush: '#ed1b2f' };
    const rowH = 372, top = 140;
    OPTS.forEach(([k], n) => {
      const i = state.pick[k], c = state.cars[i], img = photos[i], y = top + n * (rowH + 14);
      const x = 60, w = W - 120, ph = rowH - 70;
      g.fillStyle = '#18181d'; g.fillRect(x, y, w, ph);
      if (img) {
        const s = Math.max(w / img.width, ph / img.height), dw = img.width * s, dh = img.height * s;
        g.save(); g.beginPath(); g.rect(x, y, w, ph); g.clip();
        if (k === 'crush') g.filter = 'grayscale(1) brightness(.7)';
        g.drawImage(img, x + (w - dw) / 2, y + (ph - dh) / 2, dw, dh);
        g.restore();
      }
      g.save(); g.translate(x + w - 190, y + 70); g.rotate(-0.12);
      g.strokeStyle = colors[k]; g.lineWidth = 6; g.strokeRect(-150, -46, 300, 92);
      g.fillStyle = colors[k]; g.font = '400 50px "Archivo Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(I18n.t(OPT_LABEL[k]).toUpperCase(), 0, 4);
      g.restore();
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = '#9aa0a9'; g.font = '700 22px Archivo, Arial'; g.fillText(brandOf(c.name).toUpperCase(), x, y + ph + 32);
      g.fillStyle = '#ffffff'; g.font = '400 34px "Archivo Black", Arial'; g.fillText((modelOf(c.name) || c.name).toUpperCase().slice(0, 34), x, y + ph + 66);
    });
    g.fillStyle = '#6b7078'; g.font = '500 22px Archivo, Arial'; g.textAlign = 'center';
    g.fillText('frincu13.github.io/car-higher-lower', W / 2, H - 34);
    return new Promise(res => { try { cv.toBlob(b => res(b), 'image/png'); } catch { res(null); } });
  }
  $('g-share').addEventListener('click', async () => {
    haptic();
    const text = OPTS.map(([k]) => `${I18n.t(OPT_LABEL[k])}: ${state.cars[state.pick[k]].name}`).join('\n') + `\n${I18n.t('Garaj sau presă')}, ${I18n.t('Jocuri FRQ')}`;
    const blob = await shareCard();
    const file = blob && new File([blob], 'garaj-sau-presa.png', { type: 'image/png' });
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text });
      if (navigator.share) return await navigator.share({ text });
    } catch { return; } // cancelled
    if (file) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } else {
      try { await navigator.clipboard.writeText(text); $('g-share').textContent = 'Copiat'; } catch { /* nothing else to try */ }
    }
  });

  renderThemes();
})();
