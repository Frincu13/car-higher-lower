// Geamănul contra botului: cinci mașini; la fiecare alegi din listă trei de altă marcă,
// câte una cât mai apropiată la cai putere, greutate și 0-100. Regulile și punctele sunt în
// geaman-model.js, ce se vede în geaman-ui.js. Cu cont, meciul contra botului se joacă
// prin server (funcția `geaman`: mașinile date și alegerile botului vin de acolo) și dă
// bani la final, ca Duelul de cărți; fără semnal sau fără cont, pe telefon, fără bani.
// Online (un necunoscut sau un prieten) se joacă în camere.
(() => {
  'use strict';

  const { store, esc, haptic } = window.Shared;
  const GM = window.GeamanModel, UI = window.GeamanUI, G = UI.G;
  const $ = id => document.getElementById(id);
  const sunet = n => { if (window.Sunete && Sunete[n]) Sunete[n](); };
  const NIVELE = [
    { nume: 'Ușor', sub: 'Alege ceva din aceeași zonă' },
    { nume: 'Mediu', sub: 'Știe bine mașinile' },
    { nume: 'Greu', sub: 'Aproape mereu una dintre cele mai apropiate' },
  ];
  const TIMP = GM.MS.alege;
  const bani = n => (window.Economie ? Economie.CASTIG.geaman(n, true) : null);
  const st = { nivel: Math.min(2, Math.max(0, store.get('gm_bot', 1))), faraTimp: !!store.get('gm_fara_timp', false), joc: null, ceas: null, termen: null };

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- meniul ----------
  function randeazaMeniu() {
    const r = GM.rngDin(Math.floor(Date.now() / 864e5));
    const poza = () => UI.poza(G.pool[Math.floor(r() * G.pool.length)], 960);
    Shared.monteazaHub($('g-meniu'), {
      bara: [
        { id: 'bot', titlu: 'Botul', val: NIVELE[st.nivel].nume },
        { id: 'timp', titlu: 'Timp', val: st.faraTimp ? 'Fără' : '45 s' },
        { id: 'cum', titlu: 'Cum se joacă' },
      ],
      erou: { id: 'joaca', eticheta: `Contra botului · ${NIVELE[st.nivel].nume} · ${bani(st.nivel)} mil. victoria`, titlu: 'Geamănul', sub: `${GM.RUNDE} mașini, câte trei gemeni`, buton: 'Joacă', poza: poza() },
      dale: [
        { id: 'zi', titlu: 'Provocarea zilei', sub: ziFacuta() ? 'Făcută azi. Mâine alte mașini.' : `${bani(1)} + ${window.Economie ? Economie.RECOMPENSE.provocare : 5} mil. · aceleași 5 mașini pentru toți`, insigna: ziFacuta() ? '' : 'Azi', poza: poza() },
        { id: 'online', titlu: 'Contra unui jucător', sub: 'Cineva online, aceleași mașini', poza: poza() },
        { id: 'prieten', titlu: 'Cu un prieten', sub: 'Cameră online, cu cod', poza: poza() },
      ],
    });
  }
  // Provocarea zilei făcută azi (din ce a spus serverul ultima dată)
  const ziFacuta = () => { const p = window.FrqCloud && FrqCloud.portofelSalvat && FrqCloud.portofelSalvat(); return !!(p && p.azi && p.azi.data === (window.Economie ? Economie.ziua() : '') && p.azi.provocari && p.azi.provocari.geaman); };
  function randeazaBot() {
    $('g-bot').innerHTML = Shared.randuriMeniu(NIVELE.map((n, i) => ({ id: `n${i}`, titlu: `${n.nume} · ${bani(i)} mil.`, sub: n.sub, primar: i === st.nivel })));
  }
  function pasul() {
    const s = $('screen-setup'), h = location.hash.slice(1);
    s.classList.toggle('pas-bot', h === 'bot');
    if (h === 'bot') randeazaBot();
    randeazaMeniu();
  }
  window.addEventListener('hashchange', pasul);
  $('g-pas-inapoi').addEventListener('click', () => Shared.inapoi('#'));
  $('g-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'joaca') porneste();
    if (id === 'zi') porneste({ zi: true });
    if (id === 'bot') Shared.mergi('#bot');
    if (id === 'timp') { st.faraTimp = !st.faraTimp; store.set('gm_fara_timp', st.faraTimp); randeazaMeniu(); }
    if (id === 'online') location.replace('camera.html?joc=geaman&cauta=1');
    if (id === 'prieten') location.replace('camera.html?joc=geaman');
    if (id === 'cum') $('how').hidden = false;
  });
  $('g-bot').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    st.nivel = +r.dataset.mj.slice(1);
    store.set('gm_bot', st.nivel);
    Shared.inapoi('#');
  });

  // ---------- partida ----------
  // Serverul pornește meciul; fără răspuns în câteva secunde (sau fără cont posibil),
  // se joacă pe telefon, fără bani.
  async function dinServer(zi) {
    if (!window.FrqCloud || !(FrqCloud.areCont() || FrqCloud.poateFaceCont())) return null;
    const asteapta = FrqCloud.areCont() ? (zi ? 9000 : 5000) : 12000;
    try {
      return await Promise.race([
        FrqCloud.geaman(zi ? { actiune: 'start', zi: true, nume: FrqCloud.numeLocal() } : { actiune: 'start', nivel: st.nivel, nume: FrqCloud.numeLocal() }),
        new Promise(gata => setTimeout(() => gata(null), asteapta)),
      ]);
    } catch (e) { return zi && FrqCloud.codEroare ? { eroare: await FrqCloud.codEroare(e) } : null; }
  }
  async function porneste({ zi = false } = {}) {
    const joc = { runda: 0, scor: [0, 0], runde: [], tinte: [], incarc: true, zi };
    st.joc = joc; st.termen = null;
    show('screen-joc');
    $('g-scor').innerHTML = ''; $('g-runda').textContent = '';
    $('g-masa').innerHTML = '<p class="gm-incarc">Se aleg mașinile…</p>';
    const r = await dinServer(zi);
    if (st.joc !== joc) return;   // a ieșit între timp
    joc.incarc = false;
    // Provocarea zilei se joacă doar pe server (e aceeași pentru toți și intră în clasament)
    if (zi && !(r && r.id && G.dupaId.get(r.tinta))) {
      st.joc = null;
      show('screen-setup'); pasul();
      await Shared.intreaba(r && r.eroare === 'deja' ? 'Ai jucat deja Provocarea zilei aici. Mâine alte mașini.' : 'Provocarea zilei are nevoie de internet. Încearcă din nou.', { titlu: 'Provocarea zilei', da: 'Bine', nu: '', primar: 'da' });
      return;
    }
    if (r && r.id && G.dupaId.get(r.tinta)) {
      joc.server = r.id;
      // o provocare reluată continuă de la runda la care ai rămas
      joc.runda = r.n || 0;
      if (r.scor) joc.scor = r.scor;
      joc.tinte = [...Array(joc.runda).fill(null), G.dupaId.get(r.tinta)];
    } else {
      joc.rng = GM.rngDin((Math.random() * 2 ** 32) >>> 0);
      joc.tinte = G.tinte(joc.rng);
    }
    runda();
  }
  const scor = () => {
    const j = st.joc;
    $('g-scor').innerHTML = `<span class="p0"><b>Tu</b>${j.scor[0]}</span><i>–</i><span class="p1">${j.scor[1]}<b>Botul</b></span>`;
    $('g-runda').textContent = `Runda ${Math.min(j.runda + 1, GM.RUNDE)} din ${GM.RUNDE}`;
  };
  function ceas() {
    cancelAnimationFrame(st.ceas);
    const bara = $('g-ceas');
    const pas = () => {
      if (st.termen == null) { bara.style.transform = 'scaleX(0)'; return; }
      const ramas = st.termen - Date.now();
      bara.style.transform = `scaleX(${Math.max(0, Math.min(1, ramas / TIMP))})`;
      bara.classList.toggle('is-putin', ramas < 8000);
      // timpul s-a dus: contează ce ai pus până acum
      if (ramas <= 0) { st.termen = null; trimite(st.joc && st.joc.lista ? st.joc.lista.alegeri() : [null, null, null]); return; }
      st.ceas = requestAnimationFrame(pas);
    };
    pas();
  }
  function runda() {
    const j = st.joc, t = j.tinte[j.runda];
    scor();
    $('g-masa').innerHTML = `${UI.tinta(t)}<div class="gm-alege" id="g-alege"></div>`;
    Shared.wirePhotos($('g-masa'));
    j.lista = UI.lista($('g-alege'), t, { laTrimitere: trimite });
    // fără timp: bara de sus rămâne goală, trimiți când ești gata
    st.termen = st.faraTimp ? null : Date.now() + TIMP;
    ceas();
  }
  const suma = a => a.reduce((x, y) => x + y, 0);
  function trimite(trei) {
    const j = st.joc;
    if (!j || j.gata || j.inchisa === j.runda) return;
    j.inchisa = j.runda;
    st.termen = null;
    if (j.lista) j.lista.opreste();
    if (j.server) { trimitePeServer(j, trei); return; }
    const t = j.tinte[j.runda];
    const bot = G.alegeBot(t, st.nivel, j.rng);
    arataRunda(j, t, trei, bot, [G.puncteAlegere(t, trei), G.puncteAlegere(t, bot)]);
  }
  // Pe server: alegerea pleacă, vin înapoi punctele, ale botului și mașina următoare.
  // Fără răspuns, se poate trimite din nou (aceeași mutare nu se joacă de două ori).
  async function trimitePeServer(j, trei) {
    const corp = { actiune: 'muta', id: j.server, n: j.runda, masini: trei.map(c => (c ? c.id : null)) };
    const nota = $('g-masa').querySelector('.gm-act');
    if (nota) nota.insertAdjacentHTML('beforebegin', '<p class="gm-incarc" id="g-trimit">Se trimite…</p>');
    let r = null;
    for (const t of [0, 1500, 4000]) {
      if (t) await new Promise(g => setTimeout(g, t));
      if (st.joc !== j) return;
      try { r = await FrqCloud.geaman(corp); break; } catch (e) {
        const cod = FrqCloud.codEroare ? await FrqCloud.codEroare(e) : null;
        if (['terminata', 'partida', 'mutare', 'masina'].includes(cod)) break;
      }
    }
    if (st.joc !== j) return;
    if (!r || !r.runda) {
      const el = $('g-trimit');
      if (el) el.outerHTML = '<p class="gm-incarc" id="g-trimit">Fără semnal. <button class="btn btn-ghost" type="button" id="g-reia">Încearcă din nou</button></p>';
      j.reia = () => { $('g-trimit')?.remove(); trimitePeServer(j, trei); };
      return;
    }
    const t = j.tinte[j.runda];
    const bot = r.runda.masini[1].map(id => G.dupaId.get(id));
    if (r.urm != null && G.dupaId.get(r.urm)) j.tinte.push(G.dupaId.get(r.urm));
    j.final = r.final || null;
    arataRunda(j, t, trei, bot, r.runda.puncte, r.scor);
  }
  function arataRunda(j, t, trei, bot, cat, scorServer) {
    const pct = cat.map(suma);
    j.scor = scorServer || j.scor.map((x, p) => x + pct[p]);
    j.runde.push({ t, trei, bot, pct });
    haptic(pct[0] >= pct[1] ? 'success' : 'error');
    sunet(pct[0] > pct[1] ? 'corect' : pct[0] < pct[1] ? 'gresit' : 'tic');
    scor();
    const ultima = j.runda + 1 >= GM.RUNDE;
    $('g-masa').innerHTML = UI.rezultat(t, [
      { cine: 'Tu', trei, pct: cat[0], castiga: pct[0] > pct[1] },
      { cine: 'Botul', trei: bot, pct: cat[1], castiga: pct[1] > pct[0] },
    ], G.celeMaiBune(t)) + `<div class="gm-act"><button class="btn btn-primary" type="button" id="g-urm">${ultima ? 'Vezi rezultatul' : 'Runda următoare'}</button></div>`;
    Shared.wirePhotos($('g-masa'));
  }
  $('g-masa').addEventListener('click', e => {
    if (e.target.closest('#g-reia') && st.joc && st.joc.reia) { haptic(); const f = st.joc.reia; st.joc.reia = null; f(); return; }
    if (!e.target.closest('#g-urm')) return;
    haptic();
    const j = st.joc;
    j.runda++;
    if (j.runda >= GM.RUNDE) final(); else runda();
  });

  function final() {
    const j = st.joc, [a, b] = j.scor, am = a > b;
    const f = j.final;
    j.gata = true;
    sunet(am ? 'victorie' : 'infrangere');
    const rand = r => `<li class="${r.pct[0] > r.pct[1] ? 'is-c0' : r.pct[1] > r.pct[0] ? 'is-c1' : ''}">
      <span class="crt-f-k">${esc(r.t.name)}</span>
      <span class="crt-f-eu"><b>Tu</b>${r.pct[0]}</span>
      <span class="crt-f-bot"><b>Botul</b>${r.pct[1]}</span></li>`;
    $('g-final').innerHTML = `
      <p class="eyebrow">${j.zi ? 'Provocarea zilei · botul mediu' : `Botul ${NIVELE[st.nivel].nume.toLowerCase()}`}</p>
      <h2 class="logo crt-f-t">${am ? 'Ai câștigat' : a < b ? 'Botul a câștigat' : 'Egal'}</h2>
      <p class="crt-f-scor"><span class="p0">${a}</span>–<span class="p1">${b}</span></p>
      <p class="gm-medie">Din ${GM.RUNDE * GM.MAX * 3} posibile.</p>
      <div class="crt-f-bani" id="g-bani">${j.server ? '' : '<p class="col-nota">Meci fără bani: n-am ajuns la server când a început.</p>'}</div>
      <div class="start-actions">
        <button class="btn btn-primary" type="button" data-revansa>Revanșă</button>
        <button class="btn btn-ghost" type="button" data-meniu>Meniu</button>
      </div>
      <ol class="crt-f-lista">${j.runde.map(rand).join('')}</ol>`;
    show('screen-final');
    if (f && f.valid && f.zi) {
      // Provocarea zilei: punctele în clasamentul zilei și premiile provocării
      $('g-bani').innerHTML = `<p class="crt-zi-scor">Punctele tale în clasamentul zilei: <b>${f.zi.scor}</b> · <button class="col-link" type="button" data-cls-zi>Vezi clasamentul</button></p>${f.bani ? FrqCloud.randBani(f.bani, 'geaman') : ''}`;
      $('g-final').querySelector('[data-revansa]').hidden = true;
      FrqCloud.anuntaMisiuni(f.misiuni);
      // banii meciului (ca victoria contra botului mediu) și, pe lângă, premiul provocării
      const bz = f.bani, randuri = [];
      if (bz && bz.castig > 0) randuri.push({ text: f.castigat ? 'Victorie contra botului mediu' : 'Meci jucat', mil: bz.castig });
      if (bz && bz.castig < bz.ar_fi) randuri.push({ text: 'Plafonul zilei atins', sub: `${bz.plafon} mil. din jocuri. Mâine se reia.`, mil: 0 });
      randuri.push(...FrqCloud.randuriPremii({ recompense: f.recompense, misiuni: f.misiuni }, 'geaman'));
      if (randuri.length) FrqCloud.ecranPremii(randuri);
      return;
    }
    // banii: îi dă serverul, în plafonul zilei
    if (!f || !f.valid || !f.bani) return;
    const bn = f.bani;
    $('g-bani').innerHTML = FrqCloud.randBani(bn, 'geaman');
    FrqCloud.anuntaMisiuni(f.misiuni);
    const randuri = [];
    if (bn.castig > 0) randuri.push({ text: f.castigat ? `Victorie contra botului ${NIVELE[st.nivel].nume.toLowerCase()}` : 'Meci jucat', mil: bn.castig });
    if (bn.castig < bn.ar_fi) randuri.push({ text: 'Plafonul zilei atins', sub: `${bn.plafon} mil. din jocuri. Mâine se reia.`, mil: 0 });
    if (randuri.length) FrqCloud.ecranPremii(randuri);
  }

  $('g-iesi').addEventListener('click', async () => {
    if (st.joc && !st.joc.gata && (st.joc.runda > 0 || st.joc.runde.length) && !(await Shared.intreaba('Ieși? Partida se pierde.'))) return;
    st.termen = null; st.joc = null;
    show('screen-setup');
    pasul();
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-revansa]')) { haptic(); porneste(); }
    if (e.target.closest('[data-meniu]')) { haptic(); st.termen = null; st.joc = null; show('screen-setup'); pasul(); }
    if (e.target.closest('[data-cls-zi]') && window.FrqCloud) FrqCloud.arataClasament('geaman', 'zi');
  });

  pasul();
  // din Acasă („Provocările zilei"): pornește direct provocarea
  if (new URLSearchParams(location.search).has('provocare')) {
    history.replaceState(history.state, '', location.pathname);
    setTimeout(() => porneste({ zi: true }), 300);
  }
  // pentru teste
  window.__geaman = { st, trimite, G };
})();
