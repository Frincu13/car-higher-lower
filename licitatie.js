(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, artHTML, thumbHTML, wirePhotos, preload, haptic, shuffle } = window.Shared;
  const { kindOf, KINDS } = window.Kinds;
  const { ATTRS, points, complete } = window.Grades;
  const CARS = (window.CARS || []).filter(c => c.image && complete(c));

  const START_CASH = 10e6, PRIZE = 5e6, TURN_MS = 10000, PREVIEW_MS = 5000, LOTS = 12, PER_PLAYER = 4;
  const INCS = [[250e3, '+250k'], [500e3, '+500k'], [1e6, '+1 mil.']];

  // Cât face o mașină aici. Se trag 4 categorii din 8, iar mașina ajunge la una
  // singură, aia la care stă cel mai bine dintre cele trase. Deci valoarea ei e
  // nota așteptată la cea mai bună dintre cele patru care pot pica: dacă notele
  // ei ordonate descrescător sunt g1, g2, g3..., șansa ca maximul să fie exact
  // g_i e C(8-i,3)/C(8,4). Iese o medie ponderată 50% / 28,6% / 14,3% / 5,7% /
  // 1,4%, deci jumătate din greutate stă pe vârf (un 10 undeva contează mult),
  // dar contează și ce are dedesubt, fiindcă vârful e tras doar în jumătate din
  // partide. Nu am ales eu ponderile, le-au dat regulile jocului.
  //
  // Prețul rămâne mic dinadins: el spune cât face mașina în general, licitația
  // spune cât face în partida asta, cu categoriile astea. Două dintre ele sunt
  // știute dinainte, deci un Defender ieftin cu 9 la off-road se scumpește la
  // ciocan, nu în tabel.
  const PRETURI = [400e3, 500e3, 600e3, 700e3, 800e3, 900e3, 1e6, 1.1e6, 1.2e6];
  const comb = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  const PONDERI = ATTRS.map((_, i) => comb(ATTRS.length - i - 1, 3) / comb(ATTRS.length, 4));
  const valori = new WeakMap();
  function valoare(c) {
    if (!valori.has(c)) {
      valori.set(c, ATTRS.map(a => points(a, c)).sort((x, y) => y - x)
        .reduce((s, n, i) => s + PONDERI[i] * n, 0));
    }
    return valori.get(c);
  }
  // Pragurile împart mașinile egal pe cele nouă trepte, deci într-un set de 12
  // loturi pică aproximativ același număr din fiecare.
  const PRAGURI = (() => {
    const toate = CARS.map(valoare).sort((a, b) => a - b);
    return PRETURI.slice(1).map((_, i) =>
      toate[Math.round(((i + 1) / PRETURI.length) * (toate.length - 1))]);
  })();
  function pretDe(car) {
    const v = valoare(car);
    const i = PRAGURI.findIndex(prag => v < prag);
    return i === -1 ? PRETURI[PRETURI.length - 1] : PRETURI[i];
  }

  const $ = id => document.getElementById(id);
  const money = v => (Math.abs(v) >= 1e6
    ? `${fmt(v / 1e6, v % 1e6 === 0 ? 0 : v % 1e5 === 0 ? 1 : 2)} mil. €`
    : `${fmt(v / 1e3, 0)}k €`);
  const attrOf = k => ATTRS.find(a => a.key === k);
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  const state = {
    names: store.get('auc_names', ['', '']),
    phase: 'lot', lots: [], lot: 0, cash: [0, 0], owned: [[], []], cats: [], known: 2,
    bid: null, place: [{}, {}], placer: 0, pickCar: null, reveal: 0, prizes: [0, 0],
  };
  const nameOf = i => (state.names[i] || '').trim() || `Jucător ${i + 1}`;
  const tag = i => `<span class="pn p${i}">${esc(nameOf(i))}</span>`;

  // ---------- setup ----------
  [0, 1].forEach(i => { $(`a-name-${i}`).value = state.names[i] || ''; });
  $('a-form').addEventListener('submit', e => {
    e.preventDefault();
    state.names = [0, 1].map(i => $(`a-name-${i}`).value);
    store.set('auc_names', state.names);
    start();
  });

  function start() {
    // One car of each kind (a hypercar, an SUV, a classic...) plus a few more from
    // random kinds, never the same car twice.
    const all = KINDS.map(([k]) => k);
    const used = new Set();
    state.lots = shuffle([...all, ...shuffle(all).slice(0, LOTS - all.length)].map(k => {
      const pool = CARS.filter(c => kindOf(c) === k && !used.has(c));
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (c) used.add(c);
      return c;
    }).filter(Boolean)).slice(0, LOTS);
    state.lots.forEach(preload);
    state.cats = shuffle(ATTRS.map(a => a.key)).slice(0, 4);
    state.lot = 0; state.cash = [START_CASH, START_CASH]; state.owned = [[], []];
    state.place = [{}, {}]; state.prizes = [0, 0]; state.reveal = 0; state.known = 2;
    syncPeek();
    show('screen-game');
    intro();
  }

  // ---------- phase: the two categories known up front ----------
  function catCard(k, hidden = false, i = 0) {
    return `<div class="auc-cat${hidden ? ' is-hidden' : ''}" style="--d:${i * 120}ms">
      <span class="auc-cat-k">${hidden ? 'După licitație' : 'Categorie'}</span>
      <strong>${hidden ? '?' : esc(attrOf(k).label)}</strong>
    </div>`;
  }
  function intro() {
    setPhase('Start', 'Categorii');
    stage(`<div class="auc-center">
      <span class="skew-bar" aria-hidden="true"></span>
      <h2 class="auc-big">Se joacă pe</h2>
      <div class="auc-cats">${state.cats.map((k, i) => catCard(k, i >= state.known, i)).join('')}</div>
      <p class="auc-note">Două categorii le știți. Celelalte două apar după licitație.</p>
      <button class="btn btn-primary" id="a-go" type="button">Începe licitația</button>
    </div>`);
    $('a-go').addEventListener('click', () => { haptic(); startLot(); });
  }

  // ---------- phase: auction ----------
  const need = p => PER_PLAYER - state.owned[p].length;
  // Liciteaz cu banii pe care îi ai, atât. Nu se mai blochează nimic pentru
  // mașinile care urmează: dacă ai dat tot și sala te obligă să iei ultima,
  // intri pe minus, iar împrumutul se vede la final. Datoria nu e o alegere,
  // e o consecință, deci nu poți licita pe banii băncii.
  const maxBid = p => state.cash[p];
  // Cars nobody wants leave the auction, until only as many are left as the players
  // still need: from then on every car has to be sold.
  const left = () => LOTS - state.lot;
  const forced = () => left() <= need(0) + need(1);

  // Miniaturile din sloturi și din garaj: placeholder dedesubt, deci o poză care
  // întârzie lasă o cutie terminată, nu una goală. wirePhotos le mai dă o șansă.
  const thumb = thumbHTML;
  // Strigătul de deschidere e prima ofertă, nu ceva peste care trebuie să pui un
  // pas: la o licitație adevărată, dacă se strigă 400 și ridici mâna, plătești
  // 400. Deci cât timp nimeni nu a ofertat se vede un singur buton, cu prețul
  // mașinii, iar pașii apar abia peste o ofertă care există. Butoanele stau
  // toate în pagină de la început, CSS-ul arată perechea potrivită, ca să nu
  // reconstruim rândul la fiecare tură.
  const bidButtons = (solo, owner = '') => solo
    ? `<button class="auc-bid" type="button" data-inc="0"${owner}>Cumpăr · ${money(state.bid.start)}</button>`
    : `<button class="auc-bid auc-bid-open" type="button" data-inc="0"${owner}>Dau · ${money(state.bid.start)}</button>`
      + INCS.map(([v, l]) => `<button class="auc-bid" type="button" data-inc="${v}"${owner}>${l}</button>`).join('');

  function startLot() {
    const car = state.lots[state.lot];
    const pornire = pretDe(car);
    setPhase('Lot', `${state.lot + 1} / ${LOTS}`);
    state.bid = { price: pornire, start: pornire, holder: null, turn: state.lot % 2, refused: null, solo: false, wait: false };
    const full = [0, 1].find(p => need(p) === 0);
    const solo = full !== undefined && !forced();
    if (solo) { state.bid.turn = 1 - full; state.bid.solo = true; }
    // Phones: the two players side by side under the car, one shared row of bids.
    // Wide screens: each player gets a column with their own garage and buttons.
    stage(`<div class="auc-lot">
      <div class="auc-lot-cats">${state.cats.map((k, i) => i < state.known
        ? `<span class="auc-chip">${esc(attrOf(k).label)}</span>`
        : '<span class="auc-chip is-hidden">?</span>').join('')}</div>
      <div class="auc-car is-entering">
        ${artHTML(car)}
        <span class="auc-count" id="a-count" hidden></span>
        <div class="auc-car-text">
          <span class="brand">${esc(brandOf(car.name))}</span>
          <span class="auc-model">${esc(modelOf(car.name) || car.name)}</span>
          <span class="meta">${esc(car.years)}</span>
        </div>
      </div>
      <div class="auc-price" id="a-price-box">
        <span class="auc-price-k" id="a-price-k">Preț de pornire</span>
        <strong id="a-price">${money(pornire)}</strong>
      </div>
      <div class="auc-duel">
        ${[0, 1].map(p => `<div class="auc-p p${p}" id="a-p${p}">
          <span class="auc-p-name">${esc(nameOf(p))}</span>
          <span class="auc-p-cash${state.cash[p] < 0 ? ' is-debt' : ''}" id="a-cash${p}">${money(state.cash[p])}</span>
          <span class="auc-p-dots">${[0, 1, 2, 3].map(n => `<i class="${n < state.owned[p].length ? 'on' : ''}"></i>`).join('')}</span>
          <div class="auc-p-side">
            <div class="auc-p-garage" id="a-g${p}">${[0, 1, 2, 3].map(n => {
              const o = state.owned[p][n];
              return `<span class="auc-gthumb${o ? ' on' : ''}">${o ? thumb(o.car) + `<b>${money(o.price)}</b>` : ''}</span>`;
            }).join('')}</div>
            <div class="auc-p-bids${solo ? ' is-solo' : ''}">${bidButtons(solo, ` data-owner="${p}"`)}</div>
            <button class="auc-pass" type="button" data-pass data-owner="${p}">Renunț</button>
          </div>
          <span class="auc-bar"><i id="a-bar${p}"></i></span>
        </div>`).join('<span class="auc-ball" id="a-ball" aria-hidden="true"></span>')}
      </div>
      <div class="auc-controls">
        <div class="auc-bids" id="a-bids">${bidButtons(solo)}</div>
        <button class="auc-pass" id="a-pass" type="button" data-pass>Renunț</button>
      </div>
    </div>`);
    wirePhotos($('a-stage'));
    $('a-stage').querySelector('.auc-lot').addEventListener('click', e => {
      const el = e.target.closest('[data-inc], [data-pass]');
      if (!el || el.disabled || !state.bid) return;
      if (el.dataset.owner != null && +el.dataset.owner !== state.bid.turn) return;
      if (el.dataset.inc != null) bid(+el.dataset.inc); else pass();
    });
    // A player with four cars sits out. Near the end the other one has to take the rest.
    if (full !== undefined && !solo) {
      state.bid.turn = 1 - full; state.bid.auto = true;
      syncLot();
      $('a-price-k').textContent = `${nameOf(full)} are deja 4 mașini`;
      setTimeout(() => sold(1 - full, pornire), 1300);
      return;
    }
    if (solo) $('a-price-k').textContent = `${nameOf(full)} are deja 4 mașini`;
    else if (forced()) $('a-price-k').textContent = left() === 1 ? 'Ultima mașină' : `Ultimele ${left()}, se vând toate`;
    // A few seconds to look at the car before the first bid.
    state.bid.wait = true;
    syncLot();
    run(PREVIEW_MS, 'wait');
  }

  function syncLot() {
    const b = state.bid, t = b.turn, off = b.done || b.auto || b.wait;
    const lot = $('a-stage').querySelector('.auc-lot');
    lot.classList.toggle('is-waiting', !!b.wait);
    [0, 1].forEach(p => $(`a-p${p}`).classList.toggle('is-active', p === t && !b.done && !b.auto));
    $('a-ball').className = `auc-ball to-${t}`;
    const deschidere = !b.solo && b.holder === null;
    $('a-bids').className = `auc-bids p${t}${b.solo ? ' is-solo' : ''}${deschidere ? ' is-open' : ''}`;
    lot.querySelectorAll('.auc-p-bids').forEach(el => el.classList.toggle('is-open', deschidere));
    $('a-pass').className = `auc-pass p${t}`;
    lot.querySelectorAll('.auc-bid').forEach(el => {
      const who = el.dataset.owner == null ? t : +el.dataset.owner;
      el.disabled = off || who !== t || b.price + +el.dataset.inc > maxBid(t);
    });
    lot.querySelectorAll('[data-pass]').forEach(el => {
      el.disabled = off || (el.dataset.owner != null && +el.dataset.owner !== t);
    });
  }

  function bid(inc) {
    const b = state.bid;
    if (b.done || b.auto || b.wait || b.price + inc > maxBid(b.turn)) return;
    if (b.solo) { sold(b.turn, b.price); return; }
    b.price += inc; b.holder = b.turn; b.turn = 1 - b.turn;
    haptic();
    $('a-price').textContent = money(b.price);
    $('a-price-k').innerHTML = `Ofertă de la ${tag(b.holder)}`;
    const box = $('a-price-box');
    box.classList.remove('is-bump'); void box.offsetWidth; box.classList.add('is-bump');
    syncLot();
    startTimer();
  }

  // Passing (or running out of time) sells the car to the last bidder. With no bid yet,
  // the other player gets the chance at the starting price; if they don't want it
  // either, the car leaves the auction, or, when every remaining car has to be sold,
  // goes to whoever has fewer cars (on a tie, to the one who said no first).
  function pass() {
    const b = state.bid;
    if (!b || b.done || b.auto || b.wait) return;
    haptic('error');
    if (b.holder !== null) { sold(b.holder, b.price); return; }
    if (b.solo) { unsold(); return; }
    if (b.refused === null) {
      b.refused = b.turn; b.turn = 1 - b.turn;
      $('a-price-k').innerHTML = `${tag(b.refused)} nu o vrea`;
      syncLot(); startTimer();
      return;
    }
    if (!forced()) { unsold(); return; }
    sold(need(0) === need(1) ? b.refused : need(0) > need(1) ? 0 : 1, b.start);
  }

  function unsold() {
    const b = state.bid; b.done = true; stopTimer();
    syncLot();
    [0, 1].forEach(p => { $(`a-bar${p}`).style.transform = 'scaleX(0)'; });
    $('a-price-k').textContent = 'Nimeni nu o vrea';
    $('a-price-box').classList.add('is-out');
    const car = $('a-stage').querySelector('.auc-car');
    car.classList.add('is-out');
    car.insertAdjacentHTML('beforeend', '<span class="auc-hammer is-out">Nevândut</span>');
    nextLot();
  }

  function nextLot() {
    setTimeout(() => {
      state.lot++;
      if (need(0) + need(1) > 0 && state.lot < LOTS) startLot(); else draw();
    }, 1700);
  }

  // ---------- timers: the look before bidding and each turn (pause while the garage is open) ----------
  const timer = { left: 0, total: 0, kind: 'turn', last: 0, raf: 0, on: false, shown: 0 };
  function run(ms, kind) {
    Object.assign(timer, { left: ms, total: ms, kind, on: true, last: performance.now(), shown: 0 });
    cancelAnimationFrame(timer.raf);
    timer.raf = requestAnimationFrame(tick);
  }
  const startTimer = () => run(TURN_MS, 'turn');
  function stopTimer() { timer.on = false; cancelAnimationFrame(timer.raf); }
  function tick(now) {
    if (!timer.on || !state.bid) return;
    if (!$('a-drawer').hidden) { timer.last = now; timer.raf = requestAnimationFrame(tick); return; }
    timer.left -= now - timer.last; timer.last = now;
    if (timer.kind === 'wait') {
      const n = Math.max(1, Math.ceil(timer.left / 1000)), c = $('a-count');
      if (c && n !== timer.shown) {
        timer.shown = n; c.hidden = false; c.textContent = n;
        c.classList.remove('is-pop'); void c.offsetWidth; c.classList.add('is-pop');
      }
      if (timer.left <= 0) {
        stopTimer();
        if (c) c.classList.add('is-gone');
        state.bid.wait = false; syncLot(); haptic(); startTimer();
        return;
      }
    } else {
      const t = state.bid.turn, frac = Math.max(0, timer.left / timer.total);
      [0, 1].forEach(p => { const bar = $(`a-bar${p}`); if (bar) bar.style.transform = `scaleX(${p === t ? frac : 0})`; });
      [0, 1].forEach(p => $(`a-p${p}`)?.classList.toggle('is-late', p === t && frac < 0.3));
      if (timer.left <= 0) { stopTimer(); pass(); return; }
    }
    timer.raf = requestAnimationFrame(tick);
  }

  function sold(winner, price) {
    const b = state.bid; b.done = true; stopTimer();
    const car = state.lots[state.lot];
    state.cash[winner] -= price;
    state.owned[winner].push({ car, price });
    syncLot();
    [0, 1].forEach(p => {
      $(`a-bar${p}`).style.transform = 'scaleX(0)';
      $(`a-cash${p}`).textContent = money(state.cash[p]);
      $(`a-cash${p}`).classList.toggle('is-debt', state.cash[p] < 0);
    });
    $(`a-p${winner}`).classList.add('is-winner');
    $(`a-p${winner}`).querySelectorAll('.auc-p-dots i')[state.owned[winner].length - 1]?.classList.add('on', 'is-new');
    [0, 1].forEach(p => $(`a-p${p}`).classList.remove('is-late'));
    const g = $(`a-g${winner}`).children[state.owned[winner].length - 1];
    if (g) { g.innerHTML = thumb(car) + `<b>${money(price)}</b>`; g.classList.add('on', 'is-new'); }
    $('a-price').textContent = money(price);
    $('a-price-k').innerHTML = `Vândut lui ${tag(winner)}`;
    $('a-price-box').classList.add('is-sold', `p${winner}`);
    $('a-stage').querySelector('.auc-car').insertAdjacentHTML('beforeend', `<span class="auc-hammer p${winner}">Vândut</span>`);
    haptic('success');
    syncPeek();
    nextLot();
  }

  // ---------- phase: the last two categories ----------
  function draw() {
    state.bid = null;
    setPhase('Licitație încheiată', 'Categorii');
    stage(`<div class="auc-center">
      <span class="skew-bar" aria-hidden="true"></span>
      <h2 class="auc-big">Categoriile finale</h2>
      <div class="auc-cats">${state.cats.map((k, i) => catCard(k, false, i)).join('')}</div>
      <p class="auc-note">Acum fiecare își pune mașinile pe categorii, pe ascuns.</p>
      <button class="btn btn-primary" id="a-go" type="button">Mai departe</button>
    </div>`);
    $('a-stage').querySelectorAll('.auc-cat').forEach((el, i) => { if (i >= state.known) el.classList.add('is-flip'); });
    state.known = 4; syncPeek();
    setTimeout(() => haptic('success'), 500);
    $('a-go').addEventListener('click', () => { if (ramase().length) restView(); else { state.placer = 0; handoff(); } });
  }

  // ---------- phase: secret placement ----------
  function handoff() {
    const p = state.placer;
    setPhase('Așezare', nameOf(p));
    stage(`<div class="auc-center">
      <span class="skew-bar" aria-hidden="true"></span>
      <p class="eyebrow">Pe ascuns</p>
      <h2 class="auc-big">Telefonul la ${tag(p)}</h2>
      <button class="btn btn-primary" id="a-go" type="button">Start</button>
    </div>`);
    $('a-go').addEventListener('click', () => { haptic(); state.pickCar = 0; placeView(); });
  }

  function placeView() {
    const p = state.placer, mine = state.owned[p], pl = state.place[p];
    stage(`<div class="auc-place p${p}">
      <div class="auc-slots">${state.cats.map(k => `
        <button type="button" class="auc-slot" data-cat="${k}">
          <span class="auc-slot-k">${esc(attrOf(k).label)}</span>
          <span class="auc-slot-body"></span>
        </button>`).join('')}</div>
      <div class="auc-mine">${mine.map(({ car }, i) => `
        <button type="button" class="auc-own" data-car="${i}">
          <span class="auc-own-img">${thumb(car)}</span>
          <span class="auc-own-name"><b>${esc(brandOf(car.name))}</b>${esc(modelOf(car.name) || car.name)}</span>
          <span class="auc-own-at"></span>
        </button>`).join('')}</div>
      <button class="btn btn-primary" id="a-lock" type="button" disabled>Lock in</button>
    </div>`);
    const root = $('a-stage').querySelector('.auc-place');
    syncPlace();
    wirePhotos(root);
    root.querySelector('.auc-mine').addEventListener('click', e => {
      const b = e.target.closest('[data-car]'); if (!b) return;
      const i = +b.dataset.car;
      state.pickCar = state.pickCar === i ? null : i;
      haptic(); syncPlace();
    });
    root.querySelector('.auc-slots').addEventListener('click', e => {
      const slot = e.target.closest('[data-cat]'); if (!slot) return;
      const k = slot.dataset.cat, i = state.pickCar;
      if (i == null) {                       // tapping a filled slot sends the car back
        if (pl[k] != null) { delete pl[k]; haptic(); syncPlace(); }
        return;
      }
      const from = root.querySelector(`.auc-own[data-car="${i}"] .auc-own-img`).getBoundingClientRect();
      for (const kk of Object.keys(pl)) if (pl[kk] === i) delete pl[kk];
      pl[k] = i;
      // The next free car is picked automatically.
      const used = new Set(Object.values(pl));
      const nextFree = mine.findIndex((_, n) => !used.has(n));
      state.pickCar = nextFree < 0 ? null : nextFree;
      haptic(); syncPlace();
      fly(mine[i].car, from, slot);
    });
    $('a-lock').addEventListener('click', () => {
      if (Object.keys(pl).length < 4) return;
      haptic('success');
      if (state.placer === 0) { state.placer = 1; handoff(); } else { state.reveal = 0; revealView(); }
    });
  }

  // Updates the placement screen in place (no re-render, so nothing flickers).
  function syncPlace() {
    const p = state.placer, mine = state.owned[p], pl = state.place[p];
    const root = $('a-stage').querySelector('.auc-place');
    const at = {}; for (const [k, i] of Object.entries(pl)) at[i] = k;
    root.classList.toggle('has-pick', state.pickCar != null);
    root.querySelectorAll('.auc-own').forEach(el => {
      const i = +el.dataset.car;
      el.classList.toggle('is-selected', state.pickCar === i);
      el.classList.toggle('is-used', at[i] != null);
      el.querySelector('.auc-own-at').textContent = at[i] ? attrOf(at[i]).label : '';
    });
    root.querySelectorAll('.auc-slot').forEach(el => {
      const i = pl[el.dataset.cat], key = i == null ? '' : String(i);
      if (el.dataset.car === key) return;
      el.dataset.car = key;
      el.classList.toggle('is-filled', i != null);
      const c = i == null ? null : mine[i].car;
      el.querySelector('.auc-slot-body').innerHTML = c
        ? `<span class="auc-slot-img">${thumb(c)}</span><span class="auc-slot-car"><b>${esc(brandOf(c.name))}</b>${esc(modelOf(c.name) || c.name)}</span>`
        : '<span class="auc-slot-plus">+</span>';
      if (c) { el.classList.remove('is-drop'); void el.offsetWidth; el.classList.add('is-drop'); }
    });
    $('a-lock').disabled = Object.keys(pl).length < 4;
    wirePhotos(root);                      // sloturile tocmai umplute au poze noi
  }

  // The car's photo flies from its card into the slot.
  function fly(car, from, slot) {
    const target = slot.querySelector('.auc-slot-img');
    if (!target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = target.getBoundingClientRect();
    const ghost = document.createElement('img');
    ghost.className = 'auc-ghost'; ghost.src = car.image; ghost.alt = ''; ghost.referrerPolicy = 'no-referrer';
    document.body.appendChild(ghost);
    target.style.opacity = '0';
    const box = r => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const anim = ghost.animate([box(from), box(to)], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'forwards' });
    anim.onfinish = anim.oncancel = () => { target.style.opacity = ''; ghost.remove(); };
  }

  // ---------- phase: reveal, category by category ----------
  function revealView() {
    const k = state.cats[state.reveal], a = attrOf(k);
    const cars = [0, 1].map(p => state.owned[p][state.place[p][k]].car);
    const pts = cars.map(c => points(a, c));
    const win = pts[0] === pts[1] ? -1 : pts[0] > pts[1] ? 0 : 1;
    setPhase(`Categoria ${state.reveal + 1} / 4`, a.label);
    stage(`<div class="auc-reveal">
      <h2 class="auc-rev-title">${esc(a.label)}</h2>
      <div class="auc-vs">${[0, 1].map(p => {
        const c = cars[p], v = a.get(c);
        return `<div class="auc-side p${p}${win === p ? ' is-win' : ''}${win === -1 ? ' is-tie' : ''}" style="--pts:${pts[p]}">
          <span class="auc-side-who">${esc(nameOf(p))}</span>
          <div class="auc-side-photo">${artHTML(c)}<span class="auc-prize">+${money(win === -1 ? PRIZE / 2 : PRIZE)}</span></div>
          <span class="brand">${esc(brandOf(c.name))}</span>
          <span class="auc-side-model">${esc(modelOf(c.name) || c.name)}</span>
          <span class="auc-side-val">${a.show ? esc(a.show(v, c)) : '&nbsp;'}</span>
          <span class="auc-grade"><i></i><b>${fmt(pts[p] / 10, 1)}</b></span>
        </div>`;
      }).join('<span class="auc-vs-k">VS</span>')}</div>
      <button class="btn btn-primary" id="a-go" type="button">${state.reveal < 3 ? 'Următoarea' : 'Rezultat'}</button>
    </div>`);
    wirePhotos($('a-stage'));
    if (win === -1) { state.prizes[0] += PRIZE / 2; state.prizes[1] += PRIZE / 2; } else state.prizes[win] += PRIZE;
    setTimeout(() => { $('a-stage').querySelector('.auc-reveal').classList.add('is-shown'); haptic(win === -1 ? 'tick' : 'success'); }, 450);
    $('a-go').addEventListener('click', () => {
      haptic();
      if (++state.reveal < 4) revealView(); else finalView();
    });
  }

  // Un număr care urcă sau coboară. Trei lucruri îl făceau să se smucească.
  // Unitatea se alegea după valoarea de moment, deci șirul sărea de la „860k €"
  // la „1,25 mil. €" în mijlocul animației. Zecimalele erau când una, când două,
  // deci cifrele se mutau pe orizontală la fiecare cadru. Iar frânarea cubică se
  // târa atât de tare încât ultimele cadre arătau același număr și părea blocat.
  // Aici unitatea și zecimalele stau fixe cât ține numărătoarea, alese după unde
  // ajunge, frânarea e pătratică, iar forma normală se pune abia la oprire.
  const banAnim = (v, tinta) => (Math.abs(tinta) >= 1e6
    ? `${fmt(v / 1e6, 2)} mil. €`
    : `${fmt(Math.round(v / 1e3), 0)}k €`);
  let tweenN = 0;
  function numara(el, dela, la, ms) {
    if (!el) return;
    const meu = el.dataset.tween = String(++tweenN);
    const t0 = performance.now();
    const pas = acum => {
      if (el.dataset.tween !== meu) return;
      const k = Math.min(1, (acum - t0) / ms);
      if (k >= 1) { el.textContent = money(la); return; }
      el.textContent = banAnim(dela + (la - dela) * (1 - (1 - k) * (1 - k)), la);
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }

  function finalView() {
    // Banii rămași și împrumutul sunt două fețe ale aceluiași cont: pe minus poți
    // ajunge numai dacă sala te-a obligat să cumperi. Linia de împrumut se arată
    // oricum, chiar și la zero, ca tabelul să arate la fel la amândoi.
    const bani = p => Math.max(0, state.cash[p]);
    const datorie = p => Math.min(0, state.cash[p]);
    const tot = [0, 1].map(p => state.cash[p] + state.prizes[p]);
    const win = tot[0] === tot[1] ? -1 : tot[0] > tot[1] ? 0 : 1;
    setPhase('Final', 'Rezultat');
    stage(`<div class="auc-center auc-final is-counting">
      <span class="skew-bar" aria-hidden="true"></span>
      <p class="eyebrow">Final</p>
      <h2 class="auc-big">${win === -1 ? 'Egalitate' : `Câștigă ${tag(win)}`}</h2>
      <div class="auc-totals">${[0, 1].map(p => `
        <div class="auc-total p${p}" id="a-total${p}">
          <span class="auc-p-name">${esc(nameOf(p))}</span>
          <span class="auc-row" data-linie="0"><span>Bani rămași</span><b>${money(bani(p))}</b></span>
          <span class="auc-row${datorie(p) ? ' is-debt' : ''}" data-linie="1"><span>Împrumut</span><b>${money(datorie(p))}</b></span>
          <span class="auc-row" data-linie="2"><span>Premii</span><b>${money(state.prizes[p])}</b></span>
          <strong id="a-sum${p}">${money(0)}</strong>
        </div>`).join('')}</div>
      <div class="start-actions"><button class="btn btn-primary" id="a-again" type="button">Revanșă</button><button class="btn btn-ghost" id="a-menu" type="button">Meniu</button></div>
    </div>`);
    $('a-again').addEventListener('click', start);
    $('a-menu').addEventListener('click', () => show('screen-setup'));

    // Se citește ca un bilanț: fiecare linie apare la amândoi în același timp, iar
    // totalul urcă sau coboară pe loc, deci vezi de unde vine diferența. Verdictul
    // și rama câștigătorului vin la sfârșit, altfel numerele nu mai au ce spune.
    const trepte = [p => bani(p), p => bani(p) + datorie(p), p => tot[p]];
    const gata = () => {
      const box = $('a-stage').querySelector('.auc-final');
      if (!box) return;
      box.classList.remove('is-counting');   // scoate și liniile din ascuns, orice s-a întâmplat
      [0, 1].forEach(p => { const el = $(`a-sum${p}`); if (el) el.textContent = money(tot[p]); });
      if (win >= 0) $(`a-total${win}`).classList.add('is-win');
      haptic('success');
    };

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { gata(); return; }
    let t = 420;
    trepte.forEach((val, i) => {
      setTimeout(() => {
        if (!$('a-stage').querySelector('.auc-final')) return;
        [0, 1].forEach(p => {
          $(`a-total${p}`).querySelector(`[data-linie="${i}"]`).classList.add('is-in');
          const sum = $(`a-sum${p}`);
          numara(sum, i ? trepte[i - 1](p) : 0, val(p), 560);
          setTimeout(() => { sum.classList.remove('is-bump'); void sum.offsetWidth; sum.classList.add('is-bump'); }, 560);
        });
        haptic(i === 2 ? 'success' : 'tick');
      }, t);
      t += 800;
    });
    setTimeout(gata, t + 140);
  }

  // ---------- ce a rămas în sală ----------
  // Licitația se oprește când amândoi au patru mașini, deci aproape mereu rămân
  // loturi neatinse. Se arată pe loc, ca un pas al partidei, nu la final în
  // spatele unui buton: întrebarea o pui fix atunci, când tocmai s-a închis
  // sala. Vine după ce se trag ultimele două categorii, ca nota de lângă fiecare
  // mașină să aibă ce spune. Nu se poate strica nimic cu ea, mașinile astea nu
  // mai intră în joc, e doar cuțitul în rană sau ușurarea.
  const ramase = () => state.lots.slice(state.lot);

  function restView() {
    setPhase('Licitație încheiată', 'Ce a rămas în sală');
    stage(`<div class="auc-center auc-sala">
      <span class="skew-bar" aria-hidden="true"></span>
      <h2 class="auc-big">Ce a rămas în sală</h2>
      <p class="auc-note">Nu au mai apucat să iasă la ciocan. Lângă fiecare, categoria în care ar fi dat cel mai bine.</p>
      <div class="auc-rest">${ramase().map((c, i) => {
        const b = state.cats.map(k => ({ k, p: points(attrOf(k), c) })).sort((x, y) => y.p - x.p)[0];
        return `<div class="auc-g-car" style="--d:${i * 90}ms">
          <span class="auc-own-img">${thumb(c)}</span>
          <span class="auc-own-name"><b>${esc(brandOf(c.name))}</b>${esc(modelOf(c.name) || c.name)}</span>
          <span class="auc-g-price">${esc(attrOf(b.k).label)} &middot; ${fmt(b.p / 10, 1)}</span>
        </div>`;
      }).join('')}</div>
      <button class="btn btn-primary" id="a-go" type="button">Mai departe</button>
    </div>`);
    wirePhotos($('a-stage'));
    setTimeout(() => haptic(), 400);
    $('a-go').addEventListener('click', () => { state.placer = 0; handoff(); });
  }

  // ---------- garage drawer ----------
  function syncPeek() {
    const n = state.owned[0].length + state.owned[1].length;
    $('a-peek-n').textContent = n ? ` ${n}` : '';
  }
  function openDrawer() {
    $('a-sheet-k').textContent = I18n.t('Garaj');
    $('a-drawer-body').innerHTML = `
      <div class="auc-g-cats"><span class="auc-cat-k">Categorii</span>${state.cats.map((k, i) =>
        `<span class="auc-chip${i >= state.known ? ' is-hidden' : ''}">${i >= state.known ? '?' : esc(attrOf(k).label)}</span>`).join('')}</div>
      <div class="auc-g-cols">${[0, 1].map(p => `
        <div class="auc-g-col p${p}">
          <div class="auc-g-head"><span class="auc-p-name">${esc(nameOf(p))}</span><b>${money(state.cash[p])}</b></div>
          ${state.owned[p].length ? state.owned[p].map(({ car, price }) => `
            <div class="auc-g-car">
              <span class="auc-own-img">${thumb(car)}</span>
              <span class="auc-own-name"><b>${esc(brandOf(car.name))}</b>${esc(modelOf(car.name) || car.name)}</span>
              <span class="auc-g-price">${money(price)}</span>
            </div>`).join('') : '<p class="auc-g-empty">Nicio mașină încă</p>'}
        </div>`).join('')}</div>`;
    $('a-drawer').hidden = false;
    wirePhotos($('a-drawer-body'));
    haptic();
  }
  const closeDrawer = () => { $('a-drawer').hidden = true; };
  $('a-peek').addEventListener('click', openDrawer);
  $('a-close').addEventListener('click', closeDrawer);
  $('a-drawer').addEventListener('click', e => { if (e.target === $('a-drawer')) closeDrawer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('a-drawer').hidden) closeDrawer(); });

  // ---------- helpers ----------
  function setPhase(k, v) { $('a-phase-k').textContent = k; $('a-phase').textContent = v; }
  function stage(html) {
    $('a-stage').innerHTML = html;
    $('a-stage').querySelectorAll('.art-credit a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
  }
  $('a-quit').addEventListener('click', async () => {
    if (await Shared.intreaba(I18n.t('Ieși? Licitația se pierde.'))) { stopTimer(); state.bid = null; closeDrawer(); show('screen-setup'); }
  });
})();
