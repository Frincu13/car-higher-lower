// Camera online: Licitația cu un prieten, fiecare pe telefonul lui. Pagina nu
// hotărăște nimic: trimite mutarea, iar serverul (funcția `camera`) o verifică cu
// același model (licitatie-model.js) și întoarce ce are voie să vadă fiecare.
// Schimbările făcute de celălalt vin prin Realtime; la fiecare termen trecut (tura
// de 10 secunde, privirea dinainte de licitare) pagina cere starea, iar serverul
// aplică termenul. Așa jocul merge mai departe și dacă unul închide telefonul.
(() => {
  'use strict';

  const { fmt, brandOf, modelOf, esc, artHTML, thumbHTML, wirePhotos, haptic } = window.Shared;
  const { ATTRS, points } = window.Grades;
  const LM = window.LicitatieModel;
  const M = LM.creeaza(window.CARS || []);
  const DM = window.DraftModel.creeaza(window.CARS || []);
  // Jocurile pe camere: titlul, textul din lobby și termenele (pentru bara de sus).
  const JOCURI = {
    licitatie: {
      titlu: 'Licitația', ms: LM.MS, distribuie: 'Hai la o Licitație cu mine. Cod: {cod}',
      lede: 'Faci o cameră și îi trimiți codul unui prieten. Fiecare licitează de pe telefonul lui: 10 milioane, 12 mașini, 4 pentru fiecare, apoi mașinile se bat pe 4 categorii.',
    },
    'sus-sau-jos': {
      titlu: 'Sus sau jos', ms: window.RandModel.MS, distribuie: 'Hai la un Sus sau jos cu mine. Cod: {cod}',
      lede: 'Faci o cameră și îi trimiți codul unui prieten. Răspundeți pe rând, pe același șir de mașini, câte 10 secunde. Cine greșește primul pierde.',
      optiuni: ['mod', [['mix', 'Mixt'], ['hp', 'Cai putere'], ['weight', 'Greutate'], ['accel', '0-100 km/h']]],
    },
    ordine: {
      titlu: 'În ordine', ms: window.RandModel.MS, distribuie: 'Hai la un În ordine cu mine. Cod: {cod}',
      lede: 'Faci o cameră și îi trimiți codul unui prieten. Puneți pe rând câte o mașină la locul ei în listă, câte 10 secunde. Cine greșește primul pierde.',
      optiuni: ['cat', [['hp', 'Cai putere'], ['weight', 'Greutate'], ['accel', '0-100 km/h']]],
    },
    draft: {
      titlu: 'Mașina perfectă', ms: DM.MS, distribuie: 'Hai la o Mașină perfectă cu mine. Cod: {cod}',
      lede: 'Faci o cameră și îi trimiți codul unui prieten. Opt runde: pe rând, unul ia o mașină din două și o pune într-un slot, celălalt primește ce rămâne. Câștigă media mai mare.',
    },
  };
  let JOC = JOCURI[new URLSearchParams(location.search).get('joc')] ? new URLSearchParams(location.search).get('joc') : 'licitatie';
  function puneJocul(j) {
    if (!JOCURI[j]) return;
    JOC = j;
    document.body.className = `${j === 'draft' ? 'draft' : j === 'licitatie' ? 'auc' : 'ord'} cam`;
    $('k-title').innerHTML = `${esc(JOCURI[j].titlu)}<span>cu un prieten</span>`;
    document.title = `${JOCURI[j].titlu} online | FRQ`;
  }
  const $ = id => document.getElementById(id);
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
  const masina = id => M.DUPA_ID.get(id);
  const attrOf = k => ATTRS.find(a => a.key === k);
  const money = v => (Math.abs(v) >= 1e6
    ? `${fmt(v / 1e6, v % 1e6 === 0 ? 0 : v % 1e5 === 0 ? 1 : 2)} mil. €`
    : `${fmt(v / 1e3, 0)}k €`);
  const MIZE = [[0, 'Fără miză'], [5, '5 mil.'], [10, '10 mil.'], [25, '25 mil.']];
  const ERORI = {
    'revansa': 'Revanșa nu a mers acum.',
    'cont nelegat': 'Camerele cu miză cer un garaj legat de mail (din Setări).',
    bani: 'Nu ai destui bani pentru miza asta.',
    camera: 'Nu există nicio cameră cu codul ăsta.',
    stare: 'Camera a început deja sau s-a închis.',
    tura: 'Nu e rândul tău.',
    pas: 'Trebuie să ridici cel puțin cât a ridicat el.',
  };

  const st = {
    camera: null, joc: null, eu: 0, decalaj: 0, miza: 0,
    oprireAscultare: null, asezare: {}, alesa: null, trimisa: false, cerere: false,
  };
  const CHEIE = 'frq_camera';
  const amintește = id => { try { if (id) localStorage.setItem(CHEIE, id); else localStorage.removeItem(CHEIE); } catch { /* fără stocare */ } };
  const acumServer = () => Date.now() + st.decalaj;
  const nume = p => (st.joc && st.joc.nume && st.joc.nume[p]) || (st.camera && st.camera.nume && st.camera.nume[p]) || `Jucător ${p + 1}`;
  const tag = p => `<span class="pn p${p}">${esc(p === st.eu ? 'Tu' : nume(p))}</span>`;

  // ---------- serverul ----------
  async function cere(corp) {
    try {
      return await FrqCloud.camera(corp);
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      const err = new Error(k || 'retea');
      err.cod = k;
      throw err;
    }
  }
  // O stare nouă de la server (răspuns la o cerere): cu ora serverului și cu tot ce
  // e al meu (așezarea mea).
  function partidaNoua(faza) {
    if (st.joc && st.joc.faza === 'final' && faza && faza !== 'final') {
      st.asezare = {}; st.trimisa = false; st.alesa = null; st.alesaD = null; st.rundaD = null;
    }
  }
  function primeste(r) {
    if (r.acum) st.decalaj = r.acum - Date.now();
    // aceeași stare (de pildă la întrebarea din 6 în 6 secunde): ecranul rămâne cum e,
    // ca o atingere care tocmai cade pe un buton să nu se piardă la redesenare
    const semn = JSON.stringify([r.camera, r.joc, r.eu]);
    if (semn === st.semn) return;
    st.semn = semn;
    st.camera = r.camera;
    st.eu = r.eu;
    if (r.joc) { partidaNoua(r.joc.faza); st.joc = r.joc; }
    randeaza();
  }
  async function stare() {
    if (!st.camera || st.cerere) return;
    st.cerere = true;
    try { primeste(await cere({ actiune: 'stare', id: st.camera.id })); }
    catch { /* data viitoare */ }
    st.cerere = false;
  }
  async function muta(mutare) {
    try { primeste(await cere({ actiune: 'muta', id: st.camera.id, mutare })); haptic(); }
    catch (e) { haptic('error'); arataEroare(ERORI[e.cod] || 'Mutarea nu a mers. Încearcă din nou.'); stare(); }
  }
  // Realtime: rândul camerei s-a schimbat (o mutare a celuilalt sau un termen).
  function laSchimbare(rand) {
    if (!rand || !st.camera || rand.v <= (st.camera.v || 0)) return;
    st.camera = { ...st.camera, v: rand.v, stare: rand.stare, revansa: [!!rand.revansa_a, !!rand.revansa_b] };
    if (rand.public && rand.public.faza && rand.public.faza !== 'asteapta') {
      partidaNoua(rand.public.faza);
      // vederea publică nu are așezarea mea: o păstrez pe a mea
      const eraMea = st.joc && st.joc.place && st.joc.place[st.eu];
      st.joc = rand.public;
      if (st.joc.place && st.joc.faza !== 'final' && typeof eraMea === 'object') st.joc.place[st.eu] = eraMea;
    }
    if (rand.stare === 'anulata') st.joc = { faza: 'anulata' };
    randeaza();
  }
  async function asculta(id) {
    if (st.oprireAscultare) st.oprireAscultare();
    try { st.oprireAscultare = await FrqCloud.ascultaCamera(id, laSchimbare); } catch { st.oprireAscultare = null; }
  }

  // ---------- lobby ----------
  function arataEroare(t) {
    const el = document.querySelector('.cam-err');
    if (el) { el.textContent = I18n.t(t); el.hidden = false; return; }
    const p = document.createElement('p');
    p.className = 'col-alerta';
    p.setAttribute('role', 'status');
    p.textContent = I18n.t(t);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
  function lobby() {
    show('screen-setup');
    $('k-lobby').innerHTML = `
      <p class="lede">${esc(JOCURI[JOC].lede)}</p>
      ${JOCURI[JOC].optiuni ? `<h2 class="label">${JOC === 'ordine' ? 'Clasament după' : 'Categorie'}</h2>
        <div class="categories cam-mize" role="radiogroup">${JOCURI[JOC].optiuni[1].map(([k, n]) => {
          const on = (st.optiune || JOCURI[JOC].optiuni[1][0][0]) === k;
          return `<button type="button" class="cat${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-opt="${k}"><span class="cat-name">${esc(n)}</span></button>`;
        }).join('')}</div>` : ''}
      <h2 class="label">Miza</h2>
      <div class="categories cam-mize" role="radiogroup" aria-label="Miza">${MIZE.map(([v, n]) => `
        <button type="button" class="cat${st.miza === v ? ' is-on' : ''}" role="radio" aria-checked="${st.miza === v}" data-miza="${v}">
          <span class="cat-name">${esc(n)}</span><span class="cat-sub">${v ? `câștigătorul ia ${2 * v - Math.floor(2 * v * 0.1)} mil.` : 'doar de plăcere'}</span></button>`).join('')}</div>
      <p class="cam-err" role="alert" hidden></p>
      <div class="start-actions"><button class="btn btn-primary" type="button" id="k-fa">Fă camera</button></div>
      <h2 class="label">Ai un cod?</h2>
      <form class="drg-dl-cod cam-cod-f" id="k-intra"><input maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Cod cameră" aria-label="Cod cameră"><button class="btn btn-ghost" type="submit">Intră</button></form>`;
  }
  function asteapta() {
    show('screen-setup');
    const c = st.camera;
    const link = `${location.origin}${location.pathname}?cod=${c.cod}`;
    $('k-lobby').innerHTML = `
      <p class="lede">Trimite codul sau linkul prietenului. Jocul pornește când intră.</p>
      <p class="drg-dl-cod-mare" aria-label="Codul camerei">${esc(c.cod)}</p>
      <p class="cam-miza">${c.miza ? `Miza: ${c.miza} mil. fiecare` : 'Fără miză'}</p>
      <div class="start-actions">
        <button class="btn btn-primary" type="button" id="k-trimite" data-link="${esc(link)}">Trimite linkul</button>
        <button class="btn btn-ghost" type="button" id="k-anuleaza">Închide camera</button>
      </div>
      <p class="cam-err" role="alert" hidden></p>`;
  }
  $('k-lobby').addEventListener('click', async e => {
    const m = e.target.closest('[data-miza]');
    if (m) { st.miza = +m.dataset.miza; haptic(); lobby(); return; }
    const o = e.target.closest('[data-opt]');
    if (o) { st.optiune = o.dataset.opt; haptic(); lobby(); return; }
    if (e.target.closest('#k-fa')) {
      e.target.disabled = true;
      try {
        const opt = JOCURI[JOC].optiuni ? { [JOCURI[JOC].optiuni[0]]: st.optiune || JOCURI[JOC].optiuni[1][0][0] } : {};
        const r = await cere({ actiune: 'creeaza', joc: JOC, miza: st.miza, ...opt });
        st.camera = { id: r.id, cod: r.cod, joc: JOC, miza: st.miza, v: 0, stare: 'asteapta' };
        amintește(r.id);
        history.replaceState(null, '', `${location.pathname}?id=${r.id}`);
        await asculta(r.id);
        asteapta();
      } catch (err) { arataEroare(ERORI[err.cod] || 'Camera nu s-a putut face acum.'); e.target.disabled = false; }
      return;
    }
    if (e.target.closest('#k-trimite')) {
      const url = e.target.closest('#k-trimite').dataset.link;
      const text = I18n.t(JOCURI[JOC].distribuie, { cod: st.camera.cod });
      try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (er) { if (er && er.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${text} ${url}`); arataEroare('Link copiat'); } catch { window.prompt(I18n.t('Copiază linkul'), url); }
      return;
    }
    if (e.target.closest('#k-anuleaza')) {
      try { await cere({ actiune: 'anuleaza', id: st.camera.id }); } catch { /* era deja închisă */ }
      amintește(null);
      location.href = 'index.html#online';
    }
  });
  $('k-lobby').addEventListener('submit', async e => {
    e.preventDefault();
    const cod = e.target.querySelector('input').value.trim().toUpperCase();
    if (cod) intra(cod);
  });
  async function intra(cod) {
    try {
      const r = await cere({ actiune: 'intra', cod });
      deschide(r.id);
    } catch (err) {
      if (!$('k-lobby').innerHTML) lobby();
      arataEroare(ERORI[err.cod] || 'Nu s-a putut intra acum.');
    }
  }
  async function deschide(id) {
    amintește(id);
    history.replaceState(null, '', `${location.pathname}?id=${id}`);
    try {
      const r = await cere({ actiune: 'stare', id });
      primeste(r);
      await asculta(id);
    } catch {
      amintește(null);
      lobby();
      arataEroare('Camera nu mai e.');
    }
  }

  // ---------- finalul: revanșa ----------
  // Fiecare o cere de pe telefonul lui; celălalt vede „X vrea revanșă” și o acceptă.
  function butoaneFinal(s) {
    const rv = (st.camera && st.camera.revansa) || [false, false], eu = st.eu, el = 1 - eu;
    const miza = s.miza ? `, tot pe ${s.miza} mil.` : '';
    let rev;
    if (rv[eu]) rev = `<p class="auc-note cam-rev">Aștepți să accepte ${esc(nume(el))}.</p>`;
    else if (rv[el]) rev = `<p class="auc-note cam-rev"><b>${esc(nume(el))}</b> vrea revanșă${esc(miza)}.</p><button class="btn btn-primary" id="k-revansa" type="button">Accept revanșa</button>`;
    else rev = `<button class="btn btn-primary" id="k-revansa" type="button">Revanșă</button>`;
    return `<div class="cam-final-act">${rev}<div class="start-actions"><button class="btn btn-ghost" id="k-noua" type="button">Cameră nouă</button><a class="btn btn-ghost" href="index.html#online" data-iesi>Meniu</a></div></div>`;
  }

  // ---------- jocul ----------
  const etapa = (k, v) => { $('k-phase-k').textContent = I18n.t(k); $('k-phase').textContent = I18n.t(v); };
  const stage = html => { $('k-stage').innerHTML = html; wirePhotos($('k-stage')); };
  const chip = (k, i) => (k ? `<span class="auc-chip">${esc(attrOf(k).label)}</span>` : '<span class="auc-chip is-hidden">?</span>');

  function randeaza() {
    const c = st.camera, s = st.joc;
    if (!c) { lobby(); return; }
    if (c.joc && c.joc !== JOC) puneJocul(c.joc);
    if (c.stare === 'anulata' || (s && s.faza === 'anulata')) { amintește(null); lobby(); arataEroare('Camera s-a închis.'); return; }
    if (c.stare === 'asteapta' || !s) { asteapta(); return; }
    show('screen-game');
    $('k-cod').textContent = c.miza ? `${c.miza} mil.` : '';
    if (s.faza !== 'asezare') { st.trimisa = false; }
    if (JOC === 'draft') return draft(s);
    if (JOC === 'sus-sau-jos' || JOC === 'ordine') return peRand(s);
    if (s.faza === 'intro') return intro(s);
    if (s.faza === 'previz' || s.faza === 'licitatie' || s.faza === 'rezultat') return lot(s);
    if (s.faza === 'categorii') return categorii(s);
    if (s.faza === 'asezare') return asezare(s);
    if (s.faza === 'final') return final(s);
  }

  function intro(s) {
    etapa('Start', 'Categorii');
    stage(`<div class="auc-center">
      <span class="skew-bar" aria-hidden="true"></span>
      <h2 class="auc-big">${tag(0)} vs ${tag(1)}</h2>
      <div class="auc-lot-cats">${s.cats.map(chip).join('')}</div>
      <p class="auc-note">Două categorii le știți. Celelalte două apar după licitație. Licitația începe imediat.</p>
    </div>`);
  }

  function jucatori(s) {
    const b = s.bid;
    return `<div class="auc-duel cam-duel">${[0, 1].map(p => `<div class="auc-p p${p}${b && b.turn === p && s.faza === 'licitatie' ? ' is-active' : ''}${s.ultim && s.faza === 'rezultat' && s.ultim.p === p ? ' is-winner' : ''}">
        <span class="auc-p-name">${esc(p === st.eu ? `${nume(p)} (tu)` : nume(p))}</span>
        <span class="auc-p-cash${s.cash[p] < 0 ? ' is-debt' : ''}">${money(s.cash[p])}</span>
        <span class="auc-p-dots">${[0, 1, 2, 3].map(n => `<i class="${n < s.owned[p].length ? 'on' : ''}"></i>`).join('')}</span>
      </div>`).join(`<span class="auc-ball${b ? ` to-${b.turn}` : ''}" aria-hidden="true"></span>`)}</div>`;
  }

  function lot(s) {
    const id = s.lots[s.lot] != null ? s.lots[s.lot] : s.ultim && s.ultim.id;
    const car = masina(id);
    if (!car) return;
    etapa('Lot', `${s.lot + 1} / ${s.totalLoturi}`);
    const b = s.bid;
    let eticheta = 'Preț de pornire', pret = b ? b.price : 0;
    if (s.faza === 'rezultat' && s.ultim) {
      eticheta = s.ultim.tip === 'vandut' ? `Vândut lui ${s.ultim.p === st.eu ? 'tine' : nume(s.ultim.p)}` : 'Nimeni nu o vrea';
      if (s.ultim.tip === 'vandut') pret = s.ultim.price;
    } else if (b && b.holder !== null) eticheta = `Ofertă de la ${b.holder === st.eu ? 'tine' : nume(b.holder)}`;
    else if (b && b.refused !== null) eticheta = `${b.refused === st.eu ? 'Tu nu o vrei' : `${nume(b.refused)} nu o vrea`}`;
    else if (b && b.full != null) eticheta = `${b.full === st.eu ? 'Ai' : `${nume(b.full)} are`} deja 4 mașini`;
    const randulMeu = s.faza === 'licitatie' && b && b.turn === st.eu;
    let butoane = '';
    if (s.faza === 'licitatie' && b) {
      if (!randulMeu) butoane = `<p class="cam-asteapta">Licitează ${esc(nume(b.turn))}…</p>`;
      else if (b.solo) butoane = `<div class="auc-bids p${st.eu}"><button class="auc-bid" type="button" data-inc="0"${b.price > s.cash[st.eu] ? ' disabled' : ''}>Cumpăr · ${money(b.price)}</button></div><button class="auc-pass p${st.eu}" type="button" data-pass>Renunț</button>`;
      else if (b.holder === null) butoane = `<div class="auc-bids p${st.eu}"><button class="auc-bid" type="button" data-inc="0"${b.price > s.cash[st.eu] ? ' disabled' : ''}>Dau · ${money(b.price)}</button></div><button class="auc-pass p${st.eu}" type="button" data-pass>Renunț</button>`;
      else {
        butoane = `<div class="auc-bids p${st.eu}">${LM.INCS.map(v => `<button class="auc-bid" type="button" data-inc="${v}"${b.price + v > s.cash[st.eu] || v < b.pas ? ' disabled' : ''}>+${v >= 1e6 ? '1 mil.' : `${v / 1e3}k`}</button>`).join('')}</div>
          <button class="auc-pass p${st.eu}" type="button" data-pass>Renunț</button>`;
      }
    } else if (s.faza === 'previz') butoane = '<p class="cam-asteapta">Privește mașina. Licitația pornește imediat.</p>';
    stage(`<div class="auc-lot${randulMeu ? ' cam-tura' : ''}">
      <div class="auc-lot-cats">${s.cats.map(chip).join('')}</div>
      <div class="auc-car${s.faza === 'rezultat' && s.ultim && s.ultim.tip === 'nevandut' ? ' is-out' : ''}">
        ${artHTML(car)}
        <div class="auc-car-text">
          <span class="brand">${esc(brandOf(car.name))}</span>
          <span class="auc-model">${esc(modelOf(car.name) || car.name)}</span>
          <span class="meta">${esc(car.years)}</span>
        </div>
        ${s.faza === 'rezultat' && s.ultim ? `<span class="auc-hammer${s.ultim.tip === 'vandut' ? ` p${s.ultim.p}` : ' is-out'}">${s.ultim.tip === 'vandut' ? 'Vândut' : 'Nevândut'}</span>` : ''}
      </div>
      <div class="auc-price${s.faza === 'rezultat' && s.ultim && s.ultim.tip === 'vandut' ? ` is-sold p${s.ultim.p}` : ''}">
        <span class="auc-price-k">${esc(eticheta)}</span>
        <strong>${money(pret)}</strong>
        ${b && b.pas > LM.INCS[0] && s.faza === 'licitatie' ? `<span class="auc-min">minim +${b.pas >= 1e6 ? '1 mil.' : `${b.pas / 1e3}k`}</span>` : ''}
      </div>
      ${jucatori(s)}
      <div class="auc-controls cam-controls">${butoane}</div>
    </div>`);
    if (randulMeu) haptic();
  }

  function categorii(s) {
    etapa('Licitație încheiată', 'Categorii');
    stage(`<div class="auc-center">
      <span class="skew-bar" aria-hidden="true"></span>
      <h2 class="auc-big">Categoriile finale</h2>
      <div class="auc-lot-cats">${s.cats.map(chip).join('')}</div>
      <p class="auc-note">Acum fiecare își pune mașinile pe categorii, pe ascuns.</p>
    </div>`);
  }

  // Așezarea: atingi o mașină, apoi categoria. Celălalt nu vede nimic până la final.
  function asezare(s) {
    etapa('Așezare', 'Pe ascuns');
    const mine = s.owned[st.eu];
    const pusa = s.place && typeof s.place[st.eu] === 'object' && s.place[st.eu];
    if (pusa || st.trimisa) {
      stage(`<div class="auc-center"><span class="skew-bar" aria-hidden="true"></span>
        <h2 class="auc-big">Gata</h2><p class="auc-note">Așteaptă să-și așeze și ${esc(nume(1 - st.eu))} mașinile.</p></div>`);
      return;
    }
    const pl = st.asezare;
    const la = {}; for (const [k, i] of Object.entries(pl)) la[i] = k;
    stage(`<div class="auc-place p${st.eu}">
      <div class="auc-slots">${s.cats.map(k => {
        const i = pl[k], c = i == null ? null : masina(mine[i].id);
        return `<button type="button" class="auc-slot${c ? ' is-filled' : ''}" data-cat="${k}">
          <span class="auc-slot-k">${esc(attrOf(k).label)}</span>
          <span class="auc-slot-body">${c ? `<span class="auc-slot-img">${thumbHTML(c)}</span><span class="auc-slot-car"><b>${esc(brandOf(c.name))}</b>${esc(modelOf(c.name) || c.name)}</span>` : '<span class="auc-slot-plus">+</span>'}</span>
        </button>`;
      }).join('')}</div>
      <div class="auc-mine">${mine.map(({ id }, i) => {
        const c = masina(id);
        return `<button type="button" class="auc-own${st.alesa === i ? ' is-selected' : ''}${la[i] ? ' is-used' : ''}" data-car="${i}">
          <span class="auc-own-img">${thumbHTML(c)}</span>
          <span class="auc-own-name"><b>${esc(brandOf(c.name))}</b>${esc(modelOf(c.name) || c.name)}</span>
          <span class="auc-own-at">${la[i] ? esc(attrOf(la[i]).label) : ''}</span>
        </button>`;
      }).join('')}</div>
      <button class="btn btn-primary" id="k-gata" type="button"${Object.keys(pl).length < 4 ? ' disabled' : ''}>Gata</button>
    </div>`);
    $('k-stage').querySelector('.auc-place').classList.toggle('has-pick', st.alesa != null);
  }

  function final(s) {
    etapa('Final', 'Rezultat');
    const r = s.rezultat, eu = st.eu;
    const cats = r.cats.map(({ k, pts, win }) => {
      const a = attrOf(k);
      return `<div class="cam-rez">
        <span class="cam-rez-k">${esc(a.label)}</span>
        ${[0, 1].map(p => {
          const c = masina(s.owned[p][s.place[p][k]].id);
          return `<span class="cam-rez-c p${p}${win === p ? ' is-win' : ''}"><b>${esc(modelOf(c.name) || c.name)}</b><small>${fmt(pts[p] / 10, 1)}</small></span>`;
        }).join('')}
      </div>`;
    }).join('');
    const titlu = r.win === -1 ? 'Egalitate' : r.win === eu ? 'Ai câștigat' : `Câștigă ${nume(r.win)}`;
    const miza = s.miza ? (r.win === -1 ? `Fiecare își ia înapoi miza de ${s.miza} mil.` : r.win === eu ? `+${2 * s.miza - Math.floor(2 * s.miza * 0.1)} mil. în portofel` : `Miza de ${s.miza} mil. e a lui ${nume(r.win)}`) : '';
    stage(`<div class="auc-center auc-final">
      <span class="skew-bar" aria-hidden="true"></span>
      <p class="eyebrow">Final</p>
      <h2 class="auc-big">${esc(titlu)}</h2>
      ${miza ? `<p class="auc-note">${esc(miza)}</p>` : ''}
      <div class="cam-rez-cap"><span></span><span class="p0">${esc(nume(0))}</span><span class="p1">${esc(nume(1))}</span></div>
      ${cats}
      <div class="auc-totals">${[0, 1].map(p => `
        <div class="auc-total p${p}${r.win === p ? ' is-win' : ''}">
          <span class="auc-p-name">${esc(nume(p))}</span>
          <span class="auc-row is-in"><span>Bani rămași</span><b>${money(s.cash[p])}</b></span>
          <span class="auc-row is-in"><span>Premii</span><b>${money(s.prizes[p])}</b></span>
          <strong>${money(r.tot[p])}</strong>
        </div>`).join('')}</div>
      ${butoaneFinal(s)}
      ${ramase(s)}
    </div>`);
  }

  function ramase(s) {
    if (!s.ramase || !s.ramase.length) return '';
    return `<h3 class="label cam-sala-t">Ce a rămas în sală</h3>
      <div class="auc-rest cam-sala">${s.ramase.map(id => {
        const c = masina(id);
        if (!c) return '';
        const b = s.cats.map(k => ({ k, p: points(attrOf(k), c) })).sort((x, y) => y.p - x.p)[0];
        return `<div class="auc-g-car"><span class="auc-own-img">${thumbHTML(c)}</span>
          <span class="auc-own-name"><b>${esc(brandOf(c.name))}</b>${esc(modelOf(c.name) || c.name)}</span>
          <span class="auc-g-price">${esc(attrOf(b.k).label)} &middot; ${fmt(b.p / 10, 1)}</span></div>`;
      }).join('')}</div>`;
  }

  $('k-stage').addEventListener('click', async e => {
    if (e.target.closest('#k-revansa')) {
      const b = e.target.closest('#k-revansa');
      b.disabled = true;
      try { primeste(await cere({ actiune: 'revansa', id: st.camera.id })); haptic('success'); }
      catch (err) { b.disabled = false; arataEroare(ERORI[err.cod] || 'Revanșa nu a mers acum.'); }
      return;
    }
    if (e.target.closest('[data-iesi]')) amintește(null);
    const s = st.joc;
    if (!s) return;
    const sj = e.target.closest('[data-sj]');
    if (sj) { e.target.closest('.cam-sj').querySelectorAll('button').forEach(b => { b.disabled = true; }); muta({ raspuns: sj.dataset.sj }); return; }
    const gap = e.target.closest('[data-gap]');
    if (gap && !gap.disabled) { document.querySelectorAll('.cam-gap').forEach(b => { b.disabled = true; }); muta({ raspuns: +gap.dataset.gap }); return; }
    if (JOC === 'draft') {
      const alt = e.target.closest('.cam-board:not(.cam-board-eu)');
      if (alt) { alt.classList.toggle('is-open'); return; }
      const dc = e.target.closest('[data-dcar]');
      if (dc && s.faza === 'alege' && s.randul === st.eu) { st.alesaD = +dc.dataset.dcar; haptic(); draft(s); return; }
      const ds = e.target.closest('[data-dslot]');
      if (ds && !ds.disabled) {
        const car = s.faza === 'alege' ? st.alesaD : 1 - s.luata;
        if (car == null) return;
        ds.disabled = true;
        muta({ tip: 'pune', car, slot: ds.dataset.dslot });
        return;
      }
    }
    const bi = e.target.closest('[data-inc]');
    if (bi && !bi.disabled) { bi.disabled = true; muta({ tip: 'ofer', inc: +bi.dataset.inc }); return; }
    if (e.target.closest('[data-pass]')) { e.target.closest('[data-pass]').disabled = true; muta({ tip: 'renunt' }); return; }
    if (s.faza === 'asezare') {
      const car = e.target.closest('[data-car]');
      if (car) { const i = +car.dataset.car; st.alesa = st.alesa === i ? null : i; haptic(); asezare(s); return; }
      const slot = e.target.closest('[data-cat]');
      if (slot) {
        const k = slot.dataset.cat;
        if (st.alesa == null) { if (st.asezare[k] != null) { delete st.asezare[k]; haptic(); asezare(s); } return; }
        for (const kk of Object.keys(st.asezare)) if (st.asezare[kk] === st.alesa) delete st.asezare[kk];
        st.asezare[k] = st.alesa;
        const folosite = new Set(Object.values(st.asezare));
        const urm = s.owned[st.eu].findIndex((_, n) => !folosite.has(n));
        st.alesa = urm < 0 ? null : urm;
        haptic(); asezare(s);
        return;
      }
      if (e.target.closest('#k-gata') && Object.keys(st.asezare).length === 4) {
        st.trimisa = true;
        muta({ tip: 'asez', place: { ...st.asezare } });
        asezare(s);
        return;
      }
    }
    if (e.target.closest('#k-noua')) {
      if (st.oprireAscultare) { st.oprireAscultare(); st.oprireAscultare = null; }
      amintește(null);
      st.camera = null; st.joc = null; st.asezare = {};
      history.replaceState(null, '', `${location.pathname}?joc=${JOC}`);
      lobby();
    }
  });

  // ---------- Mașina perfectă ----------
  // Sus perechea de acum, dedesubt garajul tău cu cele 8 sloturi și, mai mic, al lui.
  // Cine alege atinge o mașină, apoi slotul; celălalt primește mașina rămasă.
  const notaD = (a, c) => fmt(points(a, c) / 10, 1);
  function slotD(i, a, activ) {
    const id = st.joc.boards[i][a.key];
    const c = id != null ? masina(id) : null;
    if (c) {
      return `<li class="slot-item"><div class="slot is-filled"><span class="slot-label">${esc(a.label)}</span>
        <span class="slot-car">${esc(c.name)}</span><span class="slot-grade">${notaD(a, c)}</span></div></li>`;
    }
    return `<li class="slot-item"><button type="button" class="slot" data-dslot="${a.key}"${activ ? '' : ' disabled'}>
      <span class="slot-label">${esc(a.label)}</span><span class="slot-car slot-empty">${activ ? '+' : 'Liber'}</span></button></li>`;
  }
  function garajD(i, activ) {
    const b = st.joc.boards[i];
    const n = Object.keys(b).length;
    const tot = ATTRS.reduce((sum, a) => sum + (b[a.key] != null ? points(a, masina(b[a.key])) : 0), 0);
    // pe telefon, garajul lui e un rând de note (atingi ca să-l vezi întreg)
    const mini = ATTRS.map(a => `<span class="mini${b[a.key] != null ? ' is-filled' : ''}">${b[a.key] != null ? notaD(a, masina(b[a.key])) : ''}</span>`).join('');
    return `<aside class="board p${i}${activ ? ' is-active' : ''} cam-board${i === st.eu ? ' cam-board-eu' : ''}">
      <div class="board-head"><span class="board-name">${esc(i === st.eu ? `${nume(i)} (tu)` : nume(i))}</span><span class="board-count">${n} / ${ATTRS.length}${n ? ` · ${fmt(tot / n / 10, 1)}` : ''}</span></div>
      ${i === st.eu ? '' : `<div class="board-mini" aria-hidden="true">${mini}</div>`}
      <ul class="slots">${ATTRS.map(a => slotD(i, a, activ)).join('')}</ul>
    </aside>`;
  }
  function draft(s) {
    if (s.faza === 'final') return draftFinal(s);
    etapa('Runda', `${Math.min(s.runda + 1, s.runde)} / ${s.runde}`);
    if (s.faza === 'intro') {
      stage(`<div class="auc-center"><span class="skew-bar" aria-hidden="true"></span>
        <h2 class="auc-big">${tag(0)} vs ${tag(1)}</h2>
        <p class="auc-note">${(s.primul || 0) === st.eu ? 'Alegi tu primul.' : `Alege primul ${esc(nume(s.primul || 0))}.`} Începe imediat.</p></div>`);
      return;
    }
    if (st.rundaD !== s.runda || st.fazaD !== s.faza) { st.rundaD = s.runda; st.fazaD = s.faza; st.alesaD = null; }
    const eu = st.eu, alMeu = s.randul === eu;
    const alegator = (s.runda + (s.primul || 0)) % 2;
    const aleasa = s.faza === 'pune' ? 1 - s.luata : st.alesaD;
    const poatePune = alMeu && aleasa != null;
    const cine = s.faza === 'alege' ? alegator : 1 - alegator;
    const indemn = alMeu
      ? (s.faza === 'alege' ? (st.alesaD == null ? 'Alege o mașină, apoi slotul' : 'Acum slotul') : 'Rămâne la tine: pune-o într-un slot')
      : `${s.faza === 'alege' ? 'Alege' : 'Pune'} ${nume(cine)}…`;
    const u = s.ultim, ua = u && ATTRS.find(a => a.key === u.slot), uc = u && masina(u.id);
    stage(`<div class="cam-draft">
      ${u ? `<p class="cam-ultim"><b class="p${u.p}">${esc(u.p === eu ? 'Tu' : nume(u.p))}</b>: ${esc(modelOf(uc.name) || uc.name)} la ${esc(ua.label)} · <b>${fmt(u.pts / 10, 1)}</b></p>` : ''}
      <p class="pick-prompt">${esc(indemn)}</p>
      <div class="pick-cars phase-${s.faza === 'alege' ? 'pick' : 'rest'}">${s.pereche.map((id, i) => {
        const c = masina(id);
        const luata = s.faza === 'pune' && i === s.luata;
        return `<div role="button" tabindex="0" class="pick-card p${luata ? alegator : cine}${aleasa === i ? ' is-selected' : ''}${luata ? ' is-taken' : ''}" data-dcar="${i}">
          ${artHTML(c)}
          <span class="pick-taken">${luata ? esc(alegator === eu ? 'Tu' : nume(alegator)) : ''}</span>
          <span class="pick-body"><span class="brand">${esc(brandOf(c.name))}</span>
          <span class="pick-model">${esc(modelOf(c.name) || c.name)}</span>
          <span class="meta">${[c.years, c.engine].filter(Boolean).map(esc).join(' • ')}</span></span>
        </div>`;
      }).join('')}</div>
      <div class="cam-boards">${garajD(eu, poatePune)}${garajD(1 - eu, false)}</div>
    </div>`);
    if (alMeu) haptic();
  }
  function draftFinal(s) {
    etapa('Final', 'Rezultat');
    const r = s.rezultat, eu = st.eu, n = ATTRS.length;
    const titlu = r.win === -1 ? 'Egalitate' : r.win === eu ? 'Ai câștigat' : `Câștigă ${nume(r.win)}`;
    const miza = s.miza ? (r.win === -1 ? `Fiecare își ia înapoi miza de ${s.miza} mil.` : r.win === eu ? `+${2 * s.miza - Math.floor(2 * s.miza * 0.1)} mil. în portofel` : `Miza de ${s.miza} mil. e a lui ${nume(r.win)}`) : '';
    stage(`<div class="auc-center auc-final cam-draft-final">
      <span class="skew-bar" aria-hidden="true"></span>
      <p class="eyebrow">Final</p>
      <h2 class="auc-big">${esc(titlu)}</h2>
      ${miza ? `<p class="auc-note">${esc(miza)}</p>` : ''}
      <div class="results-grid">${[0, 1].map(i => `
        <section class="result p${i}${r.win === i ? ' is-winner' : ''}">
          <header class="result-head"><span class="board-name">${esc(nume(i))}</span><span class="result-grade">${fmt(r.tot[i] / n / 10, 1)}<small>/10</small></span></header>
          <p class="result-best">${r.max[i] > r.tot[i] ? `Maxim posibil <strong>${fmt(r.max[i] / n / 10, 1)}</strong>` : 'Aranjare perfectă'}</p>
          <ul class="result-rows">${ATTRS.map(a => {
            const c = masina(s.boards[i][a.key]), pts = points(a, c);
            return `<li><span class="slot-label">${esc(a.label)}</span><span class="result-car" title="${esc(c.name)}">${esc(c.name)}</span>
              <span class="result-bar" style="--pts:${pts}"><span>${fmt(pts / 10, 1)}</span></span></li>`;
          }).join('')}</ul>
        </section>`).join('')}</div>
      ${butoaneFinal(s)}
      ${ramase(s)}
    </div>`);
  }

  // ---------- Sus sau jos și În ordine, pe rând ----------
  // Același șir de mașini; cel de la rând răspunde în 10 secunde, celălalt se uită.
  // Cine greșește primul (sau rămâne fără timp) pierde.
  const CAT_SSJ = {
    hp: { label: 'Cai putere', unit: 'CP', dec: 0, up: 'Mai mulți CP', down: 'Mai puțini CP' },
    weight: { label: 'Greutate', unit: 'kg', dec: 0, up: 'Mai grea', down: 'Mai ușoară' },
    accel: { label: '0-100 km/h', unit: 's', dec: 1, up: 'Mai lentă', down: 'Mai rapidă' },
  };
  const CAT_ORD = { hp: ['Cai putere', 'CP', 0, 'desc'], weight: ['Greutate', 'kg', 0, 'desc'], accel: ['0-100 km/h', 's', 1, 'asc'] };
  const valoare = (c, k, cats) => `${fmt(c[k], cats[k].dec != null ? cats[k].dec : cats[k][2])} ${cats[k].unit || cats[k][1]}`;
  const carteMica = (c, extra = '') => `<div class="cam-c">
      <span class="cam-c-f">${thumbHTML(c)}</span>
      <span class="cam-c-t"><span class="brand">${esc(brandOf(c.name))}</span><b>${esc(modelOf(c.name) || c.name)}</b>${extra}</span>
    </div>`;
  function scorRand(s) {
    return `<div class="cam-scor">${[0, 1].map(p => `<span class="p${p}${s.randul === p && s.faza === 'tura' ? ' is-rand' : ''}"><b>${esc(p === st.eu ? 'Tu' : nume(p))}</b> ${s.scor[p]}</span>`).join('')}</div>`;
  }
  function ultimRand(s) {
    const u = s.ultim;
    if (!u) return '';
    const cine = u.p === st.eu ? 'Tu' : nume(u.p);
    if (u.timp) return `<p class="cam-ultim"><b>${esc(cine)}</b>: a rămas fără timp</p>`;
    if (JOC === 'sus-sau-jos') {
      const c = masina(u.dreapta);
      return `<p class="cam-ultim"><b>${esc(cine)}</b>: ${u.corect ? 'corect' : 'greșit'} · ${esc(modelOf(c.name) || c.name)} are ${esc(valoare(c, u.cat, CAT_SSJ))}</p>`;
    }
    const c = masina(u.masina);
    return `<p class="cam-ultim"><b>${esc(cine)}</b>: ${u.corect ? 'corect' : `greșit, locul era ${u.corect_la + 1}`} · ${esc(modelOf(c.name) || c.name)}</p>`;
  }
  function peRand(s) {
    if (s.faza === 'final') return finalRand(s);
    const eu = st.eu, alMeu = s.faza === 'tura' && s.randul === eu;
    etapa('Rândul', s.faza === 'intro' ? 'Începe' : alMeu ? 'Tău' : nume(s.randul));
    if (s.faza === 'intro') {
      stage(`<div class="auc-center"><span class="skew-bar" aria-hidden="true"></span>
        <h2 class="auc-big">${tag(0)} vs ${tag(1)}</h2>
        <p class="auc-note">${s.primul === eu ? 'Începi tu.' : `Începe ${esc(nume(s.primul))}.`} Câte 10 secunde pe tură.</p></div>`);
      return;
    }
    const indemn = alMeu ? 'Rândul tău' : `Răspunde ${nume(s.randul)}…`;
    if (JOC === 'sus-sau-jos') {
      const k = s.cat, cat = CAT_SSJ[k], st0 = masina(s.stanga), dr = masina(s.dreapta);
      stage(`<div class="cam-draft cam-rand">
        ${scorRand(s)}${ultimRand(s)}
        <p class="pick-prompt">${esc(indemn)} · ${esc(cat.label)}</p>
        <div class="cam-pereche">
          ${carteMica(st0, `<strong class="cam-val">${esc(valoare(st0, k, CAT_SSJ))}</strong>`)}
          ${carteMica(dr, '<strong class="cam-val">?</strong>')}
        </div>
        <div class="cam-sj">${alMeu ? `<button class="btn btn-primary" type="button" data-sj="u">&#9650; ${esc(cat.up)}</button><button class="btn btn-primary" type="button" data-sj="d">&#9660; ${esc(cat.down)}</button>` : ''}</div>
      </div>`);
    } else {
      const k = s.cat, lab = CAT_ORD[k], nou = masina(s.noua), lista = s.lista.map(masina);
      const loc = g => `<button type="button" class="cam-gap" data-gap="${g}"${alMeu ? '' : ' disabled'}>${alMeu ? 'Aici' : ''}</button>`;
      stage(`<div class="cam-draft cam-rand">
        ${scorRand(s)}${ultimRand(s)}
        <p class="pick-prompt">${esc(indemn)} · ${esc(lab[0])}, ${lab[3] === 'desc' ? 'cel mai mare sus' : 'cea mai rapidă sus'}</p>
        <div class="cam-nou">${carteMica(nou)}</div>
        <ol class="cam-scara">${loc(0)}${lista.map((c, i) => `<li><span>${esc(brandOf(c.name))} <b>${esc(modelOf(c.name) || c.name)}</b></span><strong>${esc(valoare(c, k, CAT_ORD))}</strong></li>${loc(i + 1)}`).join('')}</ol>
      </div>`);
    }
    if (alMeu) haptic();
  }
  function finalRand(s) {
    etapa('Final', 'Rezultat');
    const r = s.rezultat, eu = st.eu;
    const titlu = r.win === eu ? 'Ai câștigat' : `Câștigă ${nume(r.win)}`;
    const miza = s.miza ? (r.win === eu ? `+${2 * s.miza - Math.floor(2 * s.miza * 0.1)} mil. în portofel` : `Miza de ${s.miza} mil. e a lui ${nume(r.win)}`) : '';
    stage(`<div class="auc-center auc-final">
      <span class="skew-bar" aria-hidden="true"></span>
      <p class="eyebrow">Final</p>
      <h2 class="auc-big">${esc(titlu)}</h2>
      ${ultimRand(s)}
      ${miza ? `<p class="auc-note">${esc(miza)}</p>` : ''}
      ${scorRand(s)}
      ${butoaneFinal(s)}
    </div>`);
  }

  // ---------- ceasul: bara de sus și termenele ----------
  // Bara arată cât mai e din etapa curentă; când trece termenul, cerem starea, iar
  // serverul aplică termenul (tura trece, licitația pornește, mașina se vinde).
  let ultimaCerere = 0;
  function ceas() {
    const s = st.joc;
    const bara = $('k-ceas');
    if (s && s.termen && st.camera && st.camera.stare === 'joc') {
      const ramas = s.termen - acumServer();
      const tot = JOCURI[JOC].ms[s.faza === 'licitatie' ? 'tura' : s.faza] || 10000;
      bara.style.transform = `scaleX(${Math.max(0, Math.min(1, ramas / tot))})`;
      bara.classList.toggle('is-tura', (s.faza === 'licitatie' && s.bid && s.bid.turn === st.eu) || ((JOC === 'draft' || s.faza === 'tura') && s.randul === st.eu));
      if (ramas < -300 && Date.now() - ultimaCerere > 1500) { ultimaCerere = Date.now(); stare(); }
    } else bara.style.transform = 'scaleX(0)';
    requestAnimationFrame(ceas);
  }
  requestAnimationFrame(ceas);
  // Realtime poate pierde un mesaj (telefon adormit): din când în când întrebăm și noi.
  setInterval(() => { if (st.camera && st.camera.stare !== 'gata' && !document.hidden) stare(); }, 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) stare(); });

  // ---------- pornirea ----------
  puneJocul(JOC);
  const q = new URLSearchParams(location.search);
  let idSalvat = null;
  try { idSalvat = localStorage.getItem(CHEIE); } catch { /* fără stocare */ }
  if (q.get('cod') && /^[A-Z0-9]{6}$/i.test(q.get('cod'))) { lobby(); intra(q.get('cod').toUpperCase()); }
  else if (q.get('id')) deschide(q.get('id'));
  else if (idSalvat && !q.get('joc')) deschide(idSalvat);
  else lobby();
})();
