// Duel de cărți, contra botului. Regulile sunt în carti-model.js; aici e masa: meniul,
// pachetul (din garaj), runda (categoria, cărțile, întoarcerea) și finalul.
(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, thumbHTML, wirePhotos, haptic } = window.Shared;
  const M = window.DragModel, K = window.CartiModel;
  const MD = M.creeaza(window.CARS || []);
  const MOD = K.creeaza(M, MD.POOL);
  const PE_CHEIE = new Map(MOD.toate.map(x => [x.k, x]));
  const $ = id => document.getElementById(id);
  const masina = x => MD.dupaCheie(x.k);
  const rar = x => MD.rar(masina(x));
  const sunet = n => { if (window.Sunete && Sunete[n]) Sunete[n](); };
  const poza = (c, lenes) => {
    const h = thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
    return lenes ? h.replace('<img ', '<img loading="lazy" ') : h;
  };
  const valoare = (x, k) => `${fmt(x[k], K.CAT[k].dec)} ${K.CAT[k].unit}`;
  const scurt = (x, k) => fmt(x[k], K.CAT[k].dec);

  // Botul: cât de bine pune cartea și cât de bine alege categoria (din simulări:
  // ușorul pierde cam 9 meciuri din 10 cu cineva atent; mediul și greul joacă bine).
  const NIVELE = [
    { nume: 'Ușor', sub: 'Pune des la întâmplare' },
    { nume: 'Mediu', sub: 'Pune cea mai bună carte pe categorie' },
    { nume: 'Greu', sub: 'Își păstrează cărțile bune și alege categoria cu cap' },
  ];
  const BOT_CARTE = [0, 1, 2], BOT_CAT = [0, 0, 2];

  const st = { garaj: null, nivel: Math.min(2, Math.max(0, store.get('crt_bot', 1))), joc: null, alesa: null, botCarte: null, faza: null, ceasuri: [] };
  const dupa = (ms, f) => { st.ceasuri.push(setTimeout(f, ms)); };
  const opreste = () => { st.ceasuri.forEach(clearTimeout); st.ceasuri = []; };

  // ---------- pachetul ----------
  // Mașinile din garaj care pot fi cărți (au cai, cuplu și greutate în date).
  const dinGaraj = () => (st.garaj || []).map(g => PE_CHEIE.get(g.masina)).filter(Boolean)
    .sort((a, b) => rar(b) - rar(a) || MOD.forta(b) - MOD.forta(a));
  const CHEIE_PACHET = 'crt_pachet';
  const alese = () => new Set(store.get(CHEIE_PACHET, []));
  // ce ai scos tu nu se mai pune la loc automat
  const scoase = () => new Set(store.get('crt_scoase', []));
  // Cele alese de tine, completate automat din garaj; dacă garajul nu ajunge, restul
  // sunt mașini împrumutate (comune și rare, la întâmplare).
  function pachetul() {
    const ale = dinGaraj(), sel = alese(), afara = scoase();
    let p = ale.filter(x => sel.has(x.k)).slice(0, K.PACHET);
    if (p.length < K.PACHET) p = p.concat(K.pachetAutomat(ale.filter(x => !sel.has(x.k) && !afara.has(x.k)), MOD).slice(0, K.PACHET - p.length));
    if (p.length < K.PACHET) {
      const folosite = new Set(p.map(x => x.k));
      const comune = MOD.toate.filter(x => !folosite.has(x.k) && rar(x) <= 1);
      p = p.concat(K.amesteca(comune, Math.random).slice(0, K.PACHET - p.length).map(x => ({ ...x, imprumut: true })));
    }
    return p;
  }

  async function incarcaGaraj() {
    if (!window.FrqCloud || !FrqCloud.areCont()) return;
    const salvat = FrqCloud.portofelSalvat && FrqCloud.portofelSalvat();
    if (salvat) { st.garaj = salvat.garaj || []; pasul(); }
    try { const r = await FrqCloud.portofel(); st.garaj = r.garaj || []; pasul(); } catch { /* rămâne ce era */ }
  }

  // ---------- meniul ----------
  function randeazaMeniu() {
    const p = pachetul(), ale = p.filter(x => !x.imprumut).length;
    const cap = p.slice().sort((a, b) => rar(b) - rar(a) || MOD.forta(b) - MOD.forta(a))[0];
    const pozaMare = x => thumbHTML({ ...masina(x), image: String(masina(x).image || '').replace(/\/\d+px-/, '/960px-') });
    Shared.monteazaHub($('k-meniu'), {
      bara: [
        { id: 'bot', titlu: 'Botul', val: NIVELE[st.nivel].nume },
        { id: 'cum', titlu: 'Cum se joacă' },
      ],
      erou: { id: 'joaca', eticheta: `Contra botului · ${NIVELE[st.nivel].nume}`, titlu: 'Duel de cărți', sub: 'Primul la 5 runde', buton: 'Joacă', poza: cap ? pozaMare(cap) : '' },
      dale: [{
        id: 'pachet', titlu: 'Pachetul tău',
        sub: ale >= K.PACHET ? '20 de mașini din garaj' : ale ? `${ale} din garaj, ${K.PACHET - ale} împrumutate` : 'Mașini împrumutate până ai garajul tău',
        poza: p[1] ? pozaMare(p[1]) : '', lat: true,
      }],
    });
  }

  function randeazaBot() {
    $('k-bot').innerHTML = Shared.randuriMeniu(NIVELE.map((n, i) => ({ id: `n${i}`, titlu: n.nume, sub: n.sub, primar: i === st.nivel })));
  }

  // Alegerea pachetului: atingi o mașină ca s-o pui sau s-o scoți.
  // Ce alegi tu are bifa plină; ce completează automat pachetul (până la 20), una goală.
  function randeazaPachet() {
    const el = $('k-pachet'), ale = dinGaraj(), sel = alese();
    const p = pachetul(), inPachet = new Set(p.filter(x => !x.imprumut).map(x => x.k));
    const imp = p.filter(x => x.imprumut).length, auto = [...inPachet].filter(k => !sel.has(k)).length;
    el.innerHTML = `
      <div class="crt-pk-cap">
        <p><b>${inPachet.size + imp}</b> / ${K.PACHET}${auto && auto < inPachet.size ? ` · ${auto} automat` : ''}${imp ? ` · ${imp} împrumutate` : ''}</p>
        ${ale.length > K.PACHET ? '<button class="btn btn-ghost" type="button" data-pk="auto">Automat</button>' : ''}
      </div>
      ${ale.length ? `<div class="crt-pk-grid">${ale.map(x => carteMica(x, null, null, sel.has(x.k) && inPachet.has(x.k) ? ' is-in' : inPachet.has(x.k) ? ' is-in is-auto' : '', true)).join('')}</div>`
        : `<p class="col-nota">${window.FrqCloud && FrqCloud.areCont() && !st.garaj ? 'Se încarcă garajul…' : 'Garajul tău e gol, deci joci cu mașini împrumutate. Mașinile din lăzi intră aici.'}</p>
           <a class="btn btn-primary" href="colectie.html#lazi">Garajul meu</a>`}`;
    wirePhotos(el);
  }
  $('k-pachet').addEventListener('click', e => {
    if (e.target.closest('[data-pk="auto"]')) {
      haptic();
      store.set(CHEIE_PACHET, K.pachetAutomat(dinGaraj(), MOD).map(x => x.k));
      store.set('crt_scoase', []);
      randeazaPachet();
      return;
    }
    const b = e.target.closest('[data-k]');
    if (!b) return;
    // prima atingere fixează pachetul de acum ca alegerea ta, apoi o schimbi
    const sel = store.get(CHEIE_PACHET, null) ? alese() : new Set(pachetul().filter(x => !x.imprumut).map(x => x.k)), k = b.dataset.k;
    const afara = scoase();
    if (sel.has(k)) { sel.delete(k); afara.add(k); }
    else if (sel.size < K.PACHET) { sel.add(k); afara.delete(k); }
    else { b.classList.add('is-plin'); setTimeout(() => b.classList.remove('is-plin'), 400); return; }
    haptic();
    store.set(CHEIE_PACHET, [...sel]);
    store.set('crt_scoase', [...afara]);
    randeazaPachet();
  });

  function pasul() {
    const s = $('screen-setup'), h = location.hash.slice(1);
    s.classList.toggle('pas-bot', h === 'bot');
    s.classList.toggle('pas-pachet', h === 'pachet');
    if (h === 'bot') randeazaBot();
    if (h === 'pachet') randeazaPachet();
    randeazaMeniu();
  }
  window.addEventListener('hashchange', pasul);
  $('k-pas-inapoi').addEventListener('click', () => Shared.inapoi('#'));
  $('k-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'joaca') porneste();
    if (id === 'bot') location.hash = 'bot';
    if (id === 'pachet') location.hash = 'pachet';
    if (id === 'cum') $('how').hidden = false;
  });
  $('k-bot').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    st.nivel = +r.dataset.mj.slice(1);
    store.set('crt_bot', st.nivel);
    Shared.inapoi('#');
  });

  // ---------- cărțile ----------
  // În mână: poza, numele și cele patru valori (cea a rundei, mai mare).
  function carteMica(x, i, k, cls = '', lenes = false) {
    const c = masina(x);
    return `<button type="button" class="crt-c rar-${rar(x)}${cls}"${i != null ? ` data-i="${i}"` : ` data-k="${esc(x.k)}"`}>
      <span class="crt-c-f">${poza(c, lenes)}</span>
      <span class="crt-c-n"><small>${esc(brandOf(c.name))}</small><b>${esc(modelOf(c.name) || c.name)}</b></span>
      <span class="crt-c-s">${K.CHEI.map(q => `<i${q === k ? ' class="is-k"' : ''}><em>${K.CAT[q].scurt}</em>${scurt(x, q)}</i>`).join('')}</span>
      ${x.imprumut ? '<span class="crt-imp">Împrumut</span>' : ''}
    </button>`;
  }
  // Pe masă: mare, cu spatele (logo) și fața; se întoarce cu clasa is-fata.
  function carteMare(x, k, cls = '') {
    const c = masina(x);
    return `<div class="crt-m rar-${rar(x)} ${cls}">
      <span class="crt-m-in">
        <span class="crt-m-spate"><img src="img/frq-logo.png" alt=""></span>
        <span class="crt-m-fata">
          <span class="crt-m-f">${poza(c)}</span>
          <span class="crt-m-t"><small>${esc(brandOf(c.name))}</small><b>${esc(modelOf(c.name) || c.name)}</b></span>
          <strong class="crt-m-v">${valoare(x, k)}</strong>
        </span>
      </span>
    </div>`;
  }
  const spate = (cls = '') => `<div class="crt-m crt-m-gol ${cls}"><span class="crt-m-in"><span class="crt-m-spate"><img src="img/frq-logo.png" alt=""></span></span></div>`;

  // ---------- partida ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
    window.scrollTo(0, 0);
  }
  function porneste(pachet = pachetul()) {
    opreste();
    st.pachet = pachet;
    st.joc = K.porneste([pachet, K.pachetPereche(pachet, MOD)], Math.floor(Math.random() * 2 ** 31));
    st.vazute = new Set();
    show('screen-joc');
    runda();
  }

  function runda() {
    const s = st.joc;
    st.alesa = null; st.botCarte = null; st.jucate = null; st.rez = null; st.manaAfisata = null;
    if (!s.k && s.alege === 1) {
      st.faza = 'bot-alege';
      deseneaza();
      dupa(1000, () => { K.alegeCategoria(s, 1, K.categorieBot(s, 1, BOT_CAT[st.nivel], MOD)); sunet('tic'); runda(); });
      return;
    }
    if (!s.k) { st.faza = 'cat'; deseneaza(); return; }
    st.faza = 'alege';
    deseneaza();
    // botul își pune cartea cu fața în jos cât te gândești
    dupa(600 + Math.random() * 1100, () => {
      if (st.faza !== 'alege' || st.botCarte != null) return;
      st.botCarte = K.alegeBot(s, 1, BOT_CARTE[st.nivel], MOD);
      sunet('pune');
      deseneazaLoc();
      deseneazaManaBot();
    });
  }

  function alegeCategoria(k) {
    if (st.faza !== 'cat' || !K.alegeCategoria(st.joc, 0, k)) return;
    haptic();
    runda();
  }

  function joacaCarte(i) {
    const s = st.joc;
    if (st.faza !== 'alege' || !s.j[0].mana[i]) return;
    opreste();
    if (st.botCarte == null) st.botCarte = K.alegeBot(s, 1, BOT_CARTE[st.nivel], MOD);
    const k = s.k;
    st.manaAfisata = s.j[0].mana.filter((_, j) => j !== i);
    st.rez = K.joaca(s, [i, st.botCarte]);
    st.k = k;
    st.faza = 'arata';
    haptic();
    sunet('pune');
    deseneaza();
    // se întoarce cartea botului, apoi se vede cine a luat runda
    dupa(80, () => $('k-loc').querySelector('.crt-loc-bot .crt-m')?.classList.add('is-fata'));
    dupa(850, () => {
      const c = st.rez.castiga;
      $('k-loc').classList.add(c === 0 ? 'is-c0' : c === 1 ? 'is-c1' : 'is-egal');
      deseneazaScor(true);
      haptic(c === 0 ? 'success' : c === 1 ? 'error' : 'tick');
      sunet(c === 0 ? 'corect' : c === 1 ? 'gresit' : 'tic');
    });
    dupa(2500, () => (s.gata ? final() : runda()));
  }

  // ---------- desenul mesei ----------
  function deseneaza() {
    deseneazaScor(false);
    deseneazaManaBot();
    deseneazaCat();
    deseneazaLoc();
    deseneazaMana();
  }
  function deseneazaScor(dupaRunda) {
    const s = st.joc, sc = s.j.map(x => x.scor);
    // în timpul întoarcerii, scorul vechi; se schimbă când se vede cine a luat runda
    if (st.faza === 'arata' && !dupaRunda && st.rez.castiga != null) sc[st.rez.castiga]--;
    $('k-scor').innerHTML = `<span class="p0${dupaRunda && st.rez.castiga === 0 ? ' is-plus' : ''}"><b>Tu</b>${sc[0]}</span><i>–</i><span class="p1${dupaRunda && st.rez.castiga === 1 ? ' is-plus' : ''}">${sc[1]}<b>Botul</b></span>`;
  }
  function deseneazaManaBot() {
    const s = st.joc;
    let n = s.j[1].mana.length;
    if (st.faza === 'arata') n = st.rez && !s.j[1].pachet.length && s.j[1].mana.length < K.MANA ? s.j[1].mana.length : K.MANA - 1;
    else if (st.botCarte != null) n -= 1;
    $('k-mana-bot').innerHTML = Array.from({ length: Math.max(0, n) }, () => '<i></i>').join('');
  }
  function deseneazaCat() {
    const el = $('k-cat'), s = st.joc;
    if (st.faza === 'cat') {
      const mana = s.j[0].mana;
      el.innerHTML = `<p class="crt-cat-k">Alege categoria</p><div class="crt-cat-opt">${K.CHEI.map((k, i) => {
        const best = mana.reduce((b, x) => (K.bate(k, x, b) > 0 ? x : b), mana[0]);
        return `<button type="button" class="crt-cat-b" data-cat="${k}"><b>${K.CAT[k].label}</b><small>${k === 'kg' ? 'Mai ușoară câștigă' : `cea mai bună: ${valoare(best, k)}`}</small><kbd>${i + 1}</kbd></button>`;
      }).join('')}</div>`;
      return;
    }
    if (st.faza === 'bot-alege') { el.innerHTML = '<p class="crt-cat-k">Botul alege categoria</p><p class="crt-cat-n crt-gand">…</p>'; return; }
    const k = st.faza === 'arata' ? st.k : s.k;
    el.innerHTML = `<p class="crt-cat-k">Runda ${s.runda + (st.faza === 'arata' ? 0 : 1)}</p><p class="crt-cat-n">${K.CAT[k].label}</p><p class="crt-cat-r">${K.regula(k)}</p>`;
  }
  function deseneazaLoc() {
    const el = $('k-loc'), s = st.joc;
    el.className = 'crt-loc';
    if (st.faza === 'arata') {
      const [eu, bot] = st.rez.carti, k = st.k;
      el.innerHTML = `
        <div class="crt-loc-eu"><p>Tu</p>${carteMare(eu, k, 'is-fata')}</div>
        <div class="crt-loc-bot"><p>Botul</p>${carteMare(bot, k)}</div>`;
    } else {
      const sel = st.alesa != null && st.faza === 'alege' ? s.j[0].mana[st.alesa] : null;
      el.innerHTML = `
        <div class="crt-loc-eu"><p>Tu</p>${sel ? `${carteMare(sel, s.k, 'is-fata is-previz')}<button class="btn btn-primary crt-joaca" type="button" id="k-joaca">Joacă</button>` : '<div class="crt-m crt-m-loc"></div>'}</div>
        <div class="crt-loc-bot"><p>Botul</p>${st.botCarte != null ? spate('is-pusa') : '<div class="crt-m crt-m-loc"></div>'}</div>`;
    }
    wirePhotos(el);
  }
  function deseneazaMana() {
    const el = $('k-mana'), s = st.joc;
    const mana = st.manaAfisata || s.j[0].mana;
    const k = st.faza === 'arata' ? null : s.k;
    el.innerHTML = mana.map((x, i) => carteMica(x, st.faza === 'alege' ? i : null, k,
      `${st.alesa === i && st.faza === 'alege' ? ' is-sel' : ''}${st.vazute.has(x.k) ? '' : ' is-noua'}`)).join('');
    el.classList.toggle('is-activa', st.faza === 'alege');
    mana.forEach(x => st.vazute.add(x.k));
    wirePhotos(el);
  }

  $('k-mana').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b || st.faza !== 'alege') return;
    const i = +b.dataset.i;
    if (st.alesa === i) { joacaCarte(i); return; }
    haptic();
    st.alesa = i;
    deseneazaLoc();
    deseneazaMana();
  });
  $('k-loc').addEventListener('click', e => { if (e.target.closest('#k-joaca') && st.alesa != null) joacaCarte(st.alesa); });
  $('k-cat').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) alegeCategoria(b.dataset.cat); });
  // pe calculator: 1-4 alege categoria, 1-5 alege cartea, Enter o joacă
  document.addEventListener('keydown', e => {
    if (!$('screen-joc').classList.contains('is-active') || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = +e.key;
    if (st.faza === 'cat' && n >= 1 && n <= 4) alegeCategoria(K.CHEI[n - 1]);
    else if (st.faza === 'alege' && n >= 1 && n <= st.joc.j[0].mana.length) {
      if (st.alesa === n - 1) joacaCarte(n - 1);
      else { st.alesa = n - 1; deseneazaLoc(); deseneazaMana(); }
    } else if (st.faza === 'alege' && e.key === 'Enter' && st.alesa != null) joacaCarte(st.alesa);
  });
  $('k-iesi').addEventListener('click', async () => {
    if (st.joc && !st.joc.gata && st.joc.runda > 0 && !(await Shared.intreaba('Ieși? Meciul se pierde.'))) return;
    opreste();
    st.joc = null;
    show('screen-setup');
    pasul();
  });

  // ---------- finalul ----------
  function final() {
    const s = st.joc, [a, b] = s.j.map(x => x.scor), am = s.castigator === 0;
    sunet(am ? 'victorie' : 'infrangere');
    haptic(am ? 'success' : 'error');
    const rand = h => {
      const [eu, bot] = h.carti, ce = h.castiga === 0 ? 'is-c0' : h.castiga === 1 ? 'is-c1' : '';
      return `<li class="${ce}"><span class="crt-f-k">${K.CAT[h.cat].label}</span>
        <span class="crt-f-eu"><b>${esc(modelOf(masina(eu).name) || masina(eu).name)}</b>${valoare(eu, h.cat)}</span>
        <span class="crt-f-bot"><b>${esc(modelOf(masina(bot).name) || masina(bot).name)}</b>${valoare(bot, h.cat)}</span></li>`;
    };
    $('k-final').innerHTML = `
      <p class="eyebrow">Botul ${NIVELE[st.nivel].nume.toLowerCase()}</p>
      <h2 class="logo crt-f-t">${am ? 'Ai câștigat' : s.castigator === 1 ? 'Botul a câștigat' : 'Egal'}</h2>
      <p class="crt-f-scor"><span class="p0">${a}</span>–<span class="p1">${b}</span></p>
      <div class="start-actions">
        <button class="btn btn-primary" type="button" data-revansa>Revanșă</button>
        <button class="btn btn-ghost" type="button" data-meniu>Meniu</button>
      </div>
      <ol class="crt-f-lista">${s.istoric.map(rand).join('')}</ol>`;
    show('screen-final');
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-revansa]')) { haptic(); porneste(); }
    if (e.target.closest('[data-meniu]')) { haptic(); st.joc = null; show('screen-setup'); pasul(); }
  });

  pasul();
  incarcaGaraj();
  // pentru teste
  window.__carti = { st, K, MOD, porneste, joacaCarte, alegeCategoria };
})();
