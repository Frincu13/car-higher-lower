// Duel de cărți, contra botului. Regulile sunt în carti-model.js; aici e masa: meniul,
// pachetul (din garaj, în buget), runda (categoria, cărțile, întoarcerea) și finalul.
// Cu cont, meciul îl pornește serverul (sămânța, împrumuturile) și tot el îl reface din
// mutări la final și plătește. Fără semnal se joacă oricum, doar fără bani.
// Cu un prieten se joacă în camere (camera.html?joc=carti).
(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, thumbHTML, wirePhotos, haptic } = window.Shared;
  const M = window.DragModel, K = window.CartiModel;
  const MD = M.creeaza(window.CARS || []);
  const MOD = K.creeaza(M, MD);
  const $ = id => document.getElementById(id);
  const masina = x => MD.dupaCheie(x.k);
  const rar = x => x.r;
  const sunet = n => { if (window.Sunete && Sunete[n]) Sunete[n](); };
  const poza = (c, lenes) => {
    const h = thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
    return lenes ? h.replace('<img ', '<img loading="lazy" ') : h;
  };
  // notele din 10 fără „,0" și lipite de „/10"; restul cu unitatea după un spațiu
  const nota = k => K.CAT[k].unit === '/10';
  const scurt = (x, k) => fmt(x[k], nota(k) && Number.isInteger(x[k]) ? 0 : K.CAT[k].dec);
  const valoare = (x, k) => `${scurt(x, k)}${nota(k) ? '' : ' '}${K.CAT[k].unit}`;
  const NUME_RAR = ['Comună', 'Rară', 'Epică', 'Exotică', 'Legendară'];

  // Botul: fiecare nivel are 4 pachete fixe (ia unul la întâmplare) și pune cărțile mai
  // bine sau mai prost. Din simulări, cu cineva atent: cu garajul gol câștigi cam 84% la
  // ușor, 24% la mediu, 0% la greu; cu 300 de lăzi 100/97/26%; cu toate mașinile
  // 100/100/60%. Greul e ținta pentru cine strânge mașini.
  const NIVELE = [
    { nume: 'Ușor', sub: 'Pachete de început, pune des la întâmplare' },
    { nume: 'Mediu', sub: 'Pachete dintr-un garaj mic, pune cea mai bună carte' },
    { nume: 'Greu', sub: 'Pachete de top și alege categoria cu cap' },
  ];
  const bani = n => (window.Economie ? Economie.CASTIG.carti(n, true) : null);

  const st = { fata: 0, garaj: null, nivel: Math.min(2, Math.max(0, store.get('crt_bot', 0))), joc: null, alesa: null, botCarte: null, faza: null, ceasuri: [] };
  const dupa = (ms, f) => { st.ceasuri.push(setTimeout(f, ms)); };
  const opreste = () => { st.ceasuri.forEach(clearTimeout); st.ceasuri = []; };

  // ---------- pachetul ----------
  // Mașinile din garaj care pot fi cărți (au toate valorile în date).
  const dinGaraj = () => (st.garaj || []).map(g => MOD.dupaCheie.get(g.masina)).filter(Boolean)
    .sort((a, b) => b.r - a.r || MOD.forta(b) - MOD.forta(a));
  const CHEIE_PACHET = 'crt_pachet';
  // ce ai ales tu (null: n-ai ales încă nimic, deci pachetul e cel automat)
  const alese = () => { const v = store.get(CHEIE_PACHET, null); return v ? new Set(v) : null; };
  const pachetul = () => K.pachetDinGaraj(dinGaraj(), alese(), MOD);
  const PLURAL_RAR = ['Comune', 'Rare', 'Epice', 'Exotice', 'Legendare'];

  async function incarcaGaraj() {
    if (!window.FrqCloud || !FrqCloud.areCont()) return;
    const salvat = FrqCloud.portofelSalvat && FrqCloud.portofelSalvat();
    if (salvat) { st.garaj = salvat.garaj || []; pasul(); }
    try { const r = await FrqCloud.portofel(); st.garaj = r.garaj || []; pasul(); } catch { /* rămâne ce era */ }
  }

  // ---------- meniul ----------
  function randeazaMeniu() {
    const p = pachetul();
    const cap = p.carti.slice().sort((a, b) => b.r - a.r || MOD.forta(b) - MOD.forta(a));
    const pozaMare = x => (x ? thumbHTML({ ...masina(x), image: String(masina(x).image || '').replace(/\/\d+px-/, '/960px-') }) : Shared.pozaDin('crt'));
    Shared.monteazaHub($('k-meniu'), {
      bara: [
        { id: 'bot', titlu: 'Botul', val: NIVELE[st.nivel].nume },
        { id: 'cls', titlu: 'Clasament' },
        { id: 'cum', titlu: 'Cum se joacă' },
      ],
      erou: { id: 'joaca', eticheta: `Contra botului · ${NIVELE[st.nivel].nume} · ${bani(st.nivel)} mil. victoria`, titlu: 'Duel de cărți', sub: 'Primul la 5 runde', buton: 'Joacă', poza: pozaMare(cap[0]) },
      dale: [
        { id: 'pachet', titlu: 'Pachetul tău', sub: p.carti.length ? `${p.carti.length} din garaj${p.imprumut ? `, ${p.imprumut} împrumutate` : ''} · câte 4 pe raritate` : 'Mașini împrumutate până ai garajul tău', poza: pozaMare(cap[1]) },
        { id: 'online', titlu: 'Contra unui jucător', sub: 'Cineva online, pachet contra pachet', poza: Shared.pozaDin('crt-online') },
        { id: 'prieten', titlu: 'Cu un prieten', sub: 'Cameră online, fiecare cu pachetul lui', poza: Shared.pozaDin('crt-prieten') },
      ],
    });
  }

  function randeazaBot() {
    $('k-bot').innerHTML = Shared.randuriMeniu(NIVELE.map((n, i) => ({ id: `n${i}`, titlu: `${n.nume} · ${bani(i)} mil.`, sub: n.sub, primar: i === st.nivel })));
  }

  // Pachetul tău, ca în Hearthstone: garajul (cărțile) și pachetul (o listă pe rarități)
  // una lângă alta pe calculator, în două file pe telefon. Sus stau mereu cele cinci
  // rarități, câte 4 locuri fiecare. Pe o carte din garaj nu se pune nimic peste poză: la
  // ce domină și starea sunt jos (în pachet / adaugă / plin). O atingere pune sau scoate
  // mașina.
  // la ce domină: categoria unde e cea mai bună, cu locul ei în tot jocul („top 3%")
  const domina = x => { const k = MOD.rol(x); return { k, top: Math.max(1, Math.round(100 * (1 - MOD.varf(x)))) }; };
  function carteGaraj(x, p, inPachet, sort) {
    const c = masina(x), e = inPachet.has(x.k), ok = e || K.incape(p.carti, x), d = domina(x);
    return `<button type="button" class="crt-c pkd-c rar-${x.r}${e ? ' is-in' : ok ? '' : ' is-scump'}" data-k="${esc(x.k)}">
      <span class="crt-c-f">${poza(c, true)}</span>
      <span class="crt-c-n"><small>${esc(brandOf(c.name))}</small><b>${esc(modelOf(c.name) || c.name)}</b></span>
      <span class="crt-c-s">${K.CHEI.map(q => `<i class="${[q === sort ? 'is-k' : '', q === d.k ? 'is-dom' : ''].join(' ').trim()}"><em>${K.CAT[q].scurt}</em>${scurt(x, q)}</i>`).join('')}</span>
      <span class="pkd-st"><span class="pkd-dom">${K.CAT[d.k].scurt}<b>top ${d.top}%</b></span><em>${e ? 'În pachet' : ok ? 'Adaugă' : 'Plin'}</em></span>
    </button>`;
  }
  function randPachet(x) {
    const c = masina(x), img = String(c.image || '').replace(/\/\d+px-/, '/330px-'), d = domina(x);
    return `<button type="button" class="pkd-r rar-${x.r}" data-k="${esc(x.k)}" aria-label="Scoate ${esc(c.name)}">
      <span class="pkd-n"><b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))} · ${K.CAT[d.k].scurt} top ${d.top}%</small></span>
      <span class="pkd-foto" aria-hidden="true">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">` : ''}</span>
      <span class="pkd-x" aria-hidden="true">&times;</span>
    </button>`;
  }
  function randeazaPachet() {
    const el = $('k-pachet'), ale = dinGaraj();
    if (!ale.length) {
      el.innerHTML = `<p class="col-nota">${window.FrqCloud && FrqCloud.areCont() && !st.garaj ? 'Se încarcă garajul…' : 'Garajul tău e gol, deci joci cu 20 de mașini împrumutate. Mașinile din lăzi și pachete intră aici.'}</p>
        <a class="btn btn-primary" href="colectie.html#lazi">Garajul meu</a>`;
      return;
    }
    const p = pachetul(), inPachet = new Set(p.carti.map(x => x.k));
    const sort = K.CAT[st.sort] ? st.sort : null, fila = st.filaPk === 'pachet' ? 'pachet' : 'garaj';
    const n = K.peRaritate(p.carti);
    const garaj = sort
      ? `<div class="pkd-grid">${ale.slice().sort((a, b) => K.bate(sort, b, a) || b.r - a.r).map(x => carteGaraj(x, p, inPachet, sort)).join('')}</div>`
      : [4, 3, 2, 1, 0].map(r => {
        const lista = ale.filter(x => x.r === r);
        return lista.length ? `<h3 class="pkd-h rar-${r}">${PLURAL_RAR[r]}<small>${n[r]} din ${K.COTE[r]} în pachet</small></h3>
          <div class="pkd-grid">${lista.map(x => carteGaraj(x, p, inPachet, null)).join('')}</div>` : '';
      }).join('');
    el.innerHTML = `
      <div class="pkd fila-${fila}">
        <div class="pkd-sus">
          <div class="pkd-file" role="tablist">
            <button type="button" role="tab" aria-selected="${fila === 'garaj'}" class="pkd-fila${fila === 'garaj' ? ' is-on' : ''}" data-fila="garaj">Garaj<small>${ale.length}</small></button>
            <button type="button" role="tab" aria-selected="${fila === 'pachet'}" class="pkd-fila${fila === 'pachet' ? ' is-on' : ''}" data-fila="pachet">Pachet<small id="k-pk-nr">${p.carti.length + p.imprumut}/${K.PACHET}</small></button>
          </div>
          <div class="pkd-cote">${[4, 3, 2, 1, 0].map(r => `<span class="rar-${r}${n[r] >= K.COTE[r] ? ' is-plin' : ''}"><small>${PLURAL_RAR[r]}</small><b>${n[r]}/${K.COTE[r]}</b></span>`).join('')}</div>
        </div>
        <div class="pkd-garaj">
          <div class="pkd-sort" role="radiogroup" aria-label="Ordinea">${[[null, 'Raritate'], ...K.CHEI.map(k => [k, K.CAT[k].label])].map(([k, n]) => `<button type="button" role="radio" aria-checked="${sort === k}" class="pkd-s${sort === k ? ' is-on' : ''}" data-sort="${k || ''}">${esc(n)}</button>`).join('')}</div>
          ${garaj}
        </div>
        <div class="pkd-lista">
          <h3 class="pkd-h pkd-h-lista">Pachetul tău<small>${p.carti.length} din garaj${p.imprumut ? `, ${p.imprumut} împrumutate` : ''}</small></h3>
          ${[4, 3, 2, 1, 0].map(r => {
            const ale = p.carti.filter(x => x.r === r).sort((a, b) => MOD.varf(b) - MOD.varf(a)), m = K.COTE[r] - ale.length;
            return `<h4 class="pkd-h pkd-h-rar rar-${r}">${PLURAL_RAR[r]}<small>${ale.length}/${K.COTE[r]}</small></h4>
              <div class="pkd-rows">${ale.map(randPachet).join('')}
              ${m > 0 ? `<div class="pkd-r is-liber rar-${r}"><span class="pkd-n"><b>${m === 1 ? 'Un loc liber' : `${m} locuri libere`}</b><small>se umple cu ${m === 1 ? 'o mașină împrumutată' : 'mașini împrumutate'}</small></span></div>` : ''}</div>`;
          }).join('')}
          <div class="pkd-act">
            <button class="btn btn-ghost" type="button" data-pk="auto">Pachet automat</button>
            <button class="btn btn-ghost" type="button" data-pk="gol"${p.carti.length ? '' : ' disabled'}>Golește</button>
          </div>
        </div>
      </div>`;
    wirePhotos(el);
  }
  $('k-pachet').addEventListener('click', e => {
    const t = e.target.closest('[data-fila]');
    if (t) { haptic(); st.filaPk = t.dataset.fila; randeazaPachet(); const sc = $('k-pachet').closest('.start'); if (sc) sc.scrollTop = 0; window.scrollTo(0, 0); return; }
    const f = e.target.closest('[data-sort]');
    if (f) { haptic(); st.sort = f.dataset.sort || null; randeazaPachet(); return; }
    if (e.target.closest('[data-pk="auto"]')) {
      haptic();
      store.set(CHEIE_PACHET, K.pachetAutomat(dinGaraj(), MOD).map(x => x.k));
      randeazaPachet();
      return;
    }
    if (e.target.closest('[data-pk="gol"]')) { haptic(); store.set(CHEIE_PACHET, []); randeazaPachet(); return; }
    const b = e.target.closest('[data-k]');
    if (!b) return;
    // prima atingere: pachetul automat de până acum devine alegerea ta, apoi o schimbi
    const p = pachetul(), sel = new Set(p.carti.map(x => x.k)), k = b.dataset.k, x = MOD.dupaCheie.get(k);
    if (sel.has(k)) sel.delete(k);
    else if (!K.incape(p.carti, x)) {
      b.classList.add('is-plin');
      Shared.indiciu(b, `Ai deja ${K.COTE[x.r]} ${PLURAL_RAR[x.r].toLowerCase()}. Scoate una întâi.`, 'crt_cote', 99);
      setTimeout(() => b.classList.remove('is-plin'), 400);
      return;
    } else sel.add(k);
    haptic();
    store.set(CHEIE_PACHET, [...sel]);
    // pe telefon, din garaj: numărul de pe fila Pachet clipește, ca să se vadă unde a ajuns
    const fila = st.filaPk === 'pachet' ? 'pachet' : 'garaj';
    // pagina rămâne unde era (pe telefon se derulează cutia paginii, nu fereastra)
    const sc = $('k-pachet').closest('.start'), y = sc ? sc.scrollTop : 0, wy = window.scrollY;
    randeazaPachet();
    if (sc) sc.scrollTop = y;
    window.scrollTo(0, wy);
    if (fila === 'garaj') { const n = $('k-pk-nr'); if (n) { n.classList.remove('is-puls'); void n.offsetWidth; n.classList.add('is-puls'); } }
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
    if (id === 'bot') Shared.mergi('#bot');
    if (id === 'pachet') Shared.mergi('#pachet');
    if (id === 'prieten') location.replace('camera.html?joc=carti');
    if (id === 'online') location.replace('camera.html?joc=carti&cauta=1');
    if (id === 'cum') $('how').hidden = false;
    if (id === 'cls' && window.FrqCloud) FrqCloud.arataClasament('carti');
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
  // Cu cont, meciul se joacă pe server: telefonul vede doar mâna lui și primește cartea
  // botului după ce o pune pe a lui (sămânța nu pleacă de acolo, deci nu se poate trișa).
  // Fără răspuns în câteva secunde (sau fără cont posibil), meciul se joacă pe telefon,
  // fără bani.
  async function dinServer(tale) {
    if (!window.FrqCloud || !(FrqCloud.areCont() || FrqCloud.poateFaceCont())) return null;
    const asteapta = FrqCloud.areCont() ? 5000 : 12000;
    try {
      return await Promise.race([
        FrqCloud.carti({ actiune: 'start', v: 2, nivel: st.nivel, pachet: tale.map(x => x.k), nume: FrqCloud.numeLocal() }),
        new Promise(gata => setTimeout(() => gata(null), asteapta)),
      ]);
    } catch { return null; }
  }
  async function porneste() {
    opreste();
    st.joc = null; st.faza = 'incarc'; st.partida = null; st.server = false; st.final = null; st.reia = null;
    show('screen-joc');
    $('k-scor').innerHTML = ''; $('k-mana').innerHTML = ''; $('k-loc').innerHTML = ''; $('k-mana-bot').innerHTML = '';
    $('k-cat').innerHTML = '<p class="crt-cat-k">Se amestecă pachetele</p><p class="crt-cat-n crt-gand">…</p>';
    const tale = pachetul().carti;
    const r = await dinServer(tale);
    if (st.faza !== 'incarc') return;   // a ieșit între timp
    st.mutari = [];
    if (r && r.id && r.vedere && r.vedere.mana.every(k => MOD.dupaCheie.get(k))) {
      st.imp = new Set(r.imprumut || []);
      st.partida = r.id;
      st.server = true;
      st.joc = dinVedere(r.vedere, []);
    } else {
      const seed = Math.floor(Math.random() * 2 ** 31);
      st.joc = K.meciBot(K.completeaza(MOD, tale, seed), st.nivel, seed, MOD);
    }
    st.vazute = new Set();
    runda();
  }

  // Meciul de pe server, în forma celui de pe telefon (cărțile botului nu se văd: doar câte are).
  function dinVedere(v, istoric) {
    const carte = k => (st.imp.has(k) ? { ...MOD.dupaCheie.get(k), imprumut: true } : MOD.dupaCheie.get(k));
    return {
      j: [{ mana: v.mana.map(carte), pachet: { length: v.pachet }, scor: v.scor[0] }, { mana: Array(v.bot).fill(null), scor: v.scor[1] }],
      k: v.k, kBot: v.kBot, alege: v.alege, runda: v.runda, istoric, gata: v.gata, castigator: v.castigator, carte,
    };
  }

  function runda() {
    const s = st.joc;
    st.alesa = null; st.botCarte = null; st.jucate = null; st.rez = null; st.manaAfisata = null; st.mutare = {};
    if (!s.k && s.alege === 1) {
      st.faza = 'bot-alege';
      deseneaza();
      dupa(1000, () => { K.alegeCategoria(s, 1, st.server ? s.kBot : K.botCategorie(s, MOD)); sunet('tic'); runda(); });
      return;
    }
    if (!s.k) { st.faza = 'cat'; deseneaza(); return; }
    st.faza = 'alege';
    // cartea din față e cea aleasă (o joci atingând-o sau cu „Joacă" de pe masă)
    st.fata = Math.min(st.fata, s.j[0].mana.length - 1);
    st.alesa = st.fata;
    deseneaza();
    // botul își pune cartea cu fața în jos cât te gândești
    dupa(600 + Math.random() * 1100, () => {
      if (st.faza !== 'alege' || st.botCarte != null) return;
      // pe server, cartea botului se află abia după a ta; aici doar se vede că a pus una
      st.botCarte = st.server ? -1 : K.botCarte(s, MOD);
      sunet('pune');
      deseneazaLoc();
      deseneazaManaBot();
    });
  }

  function alegeCategoria(k) {
    if (st.faza !== 'cat' || !K.alegeCategoria(st.joc, 0, k)) return;
    haptic();
    runda();
    st.mutare = { k };
  }

  function joacaCarte(i) {
    const s = st.joc;
    if (st.faza !== 'alege' || !s.j[0].mana[i]) return;
    if (st.server) return joacaPeServer(i);
    opreste();
    if (st.botCarte == null) st.botCarte = K.botCarte(s, MOD);
    const k = s.k;
    st.manaAfisata = s.j[0].mana.filter((_, j) => j !== i);
    st.mutari.push({ ...st.mutare, i });
    st.rez = K.joaca(s, [i, st.botCarte]);
    st.k = k;
    st.nrArata = s.runda;
    st.faza = 'arata';
    haptic();
    sunet('pune');
    deseneaza();
    intoarce();
  }
  // cartea ta ajunge pe masă, se întoarce a botului, apoi se vede cine a luat runda
  function intoarce() {
    dupa(420, () => $('k-loc').querySelector('.crt-loc-bot .crt-m')?.classList.add('is-fata'));
    dupa(1150, () => {
      const c = st.rez.castiga;
      $('k-loc').classList.add(c === 0 ? 'is-c0' : c === 1 ? 'is-c1' : 'is-egal');
      deseneazaScor(true);
      haptic(c === 0 ? 'success' : c === 1 ? 'error' : 'tick');
      sunet(c === 0 ? 'corect' : c === 1 ? 'gresit' : 'tic');
    });
    dupa(2650, () => { if (!st.joc.gata) $('k-loc').classList.add('is-pleaca'); });
    dupa(2900, () => (st.joc.gata ? final() : runda()));
  }

  // Pe server: cartea ta se vede pe masă, a botului stă cu fața în jos până răspunde serverul.
  function joacaPeServer(i) {
    const s = st.joc, k = s.k;
    opreste();
    const mutare = { ...st.mutare, i, n: st.mutari.length };
    st.mutari.push(mutare);
    st.manaAfisata = s.j[0].mana.filter((_, j) => j !== i);
    st.k = k;
    st.rez = { cat: k, carti: [s.j[0].mana[i], null], castiga: null };
    st.nrArata = s.runda + 1;
    st.faza = 'arata';
    haptic();
    sunet('pune');
    deseneaza();
    trimiteMutarea(s, mutare);
  }
  async function trimiteMutarea(s, mutare) {
    st.reia = null;
    let r = null, cod = null;
    for (const t of [0, 1500, 4000]) {
      if (t) await new Promise(g => setTimeout(g, t));
      if (st.joc !== s) return;
      try { r = await FrqCloud.carti({ actiune: 'muta', id: st.partida, ...mutare }); break; }
      catch (e) { cod = FrqCloud.codEroare ? await FrqCloud.codEroare(e) : null; if (['terminata', 'partida', 'mutare'].includes(cod)) break; }
    }
    if (st.joc !== s || st.faza !== 'arata') return;
    const loc = $('k-loc').querySelector('.crt-loc-bot');
    if (!r || !r.runda || !r.vedere) {
      // fără răspuns: se poate încerca din nou (aceeași mutare, nu se joacă de două ori)
      const gata = ['terminata', 'partida', 'mutare'].includes(cod);
      if (loc) loc.innerHTML = `<p>Botul</p><button class="crt-m crt-reia" type="button" data-reia>${gata ? 'Meciul s-a oprit' : 'Fără semnal'}<b>${gata ? 'Înapoi la meniu' : 'Încearcă din nou'}</b></button>`;
      st.reia = gata ? null : () => trimiteMutarea(s, mutare);
      return;
    }
    st.rez = { cat: r.runda.cat, carti: r.runda.carti.map(s.carte), castiga: r.runda.castiga };
    s.istoric.push(st.rez);
    st.joc = dinVedere(r.vedere, s.istoric);
    st.final = r.final || null;
    if (loc) { loc.innerHTML = `<p>Botul</p>${carteMare(st.rez.carti[1], st.k)}`; wirePhotos(loc); }
    intoarce();
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
    if (st.faza === 'arata') n = Math.min(K.MANA - 1, s.j[1].mana.length);
    else if (st.botCarte != null) n -= 1;
    $('k-mana-bot').innerHTML = Array.from({ length: Math.max(0, n) }, () => '<i></i>').join('');
  }
  function deseneazaCat() {
    const el = $('k-cat'), s = st.joc;
    if (st.faza === 'cat') { el.innerHTML = `<p class="crt-cat-k">Runda ${s.runda + 1}</p><p class="crt-cat-n">Alege categoria</p><p class="crt-cat-r">Ai pierdut runda, alegi tu</p>`; return; }
    if (st.faza === 'bot-alege') { el.innerHTML = '<p class="crt-cat-k">Botul alege categoria</p><p class="crt-cat-n crt-gand">…</p>'; return; }
    const k = st.faza === 'arata' ? st.k : s.k;
    el.innerHTML = `<p class="crt-cat-k">Runda ${st.faza === 'arata' ? st.nrArata : s.runda + 1}</p><p class="crt-cat-n">${K.CAT[k].label}</p><p class="crt-cat-r">${K.regula(k)}</p>`;
  }
  function deseneazaLoc() {
    const el = $('k-loc'), s = st.joc;
    el.className = 'crt-loc';
    // la întoarcere, cele două cărți stau mari peste mână (care rămâne pe loc dedesubt)
    el.parentElement.classList.toggle('is-arata', st.faza === 'arata');
    if (st.faza === 'arata') {
      const [eu, bot] = st.rez.carti, k = st.k;
      el.innerHTML = `
        <div class="crt-loc-eu"><p>Tu</p>${carteMare(eu, k, 'is-fata is-intra')}</div>
        <div class="crt-loc-bot"><p>Botul</p>${bot ? carteMare(bot, k) : spate()}</div>`;
    } else if (st.faza === 'cat') {
      const mana = s.j[0].mana;
      el.innerHTML = `<div class="crt-cat-opt">${K.CHEI.map((k, i) => {
        const best = mana.reduce((b, x) => (K.bate(k, x, b) > 0 ? x : b), mana[0]);
        return `<button type="button" class="crt-cat-b" data-cat="${k}"><b>${K.CAT[k].label}</b><small>cea mai bună: ${valoare(best, k)}</small><kbd>${i + 1}</kbd></button>`;
      }).join('')}</div>`;
    } else {
      const sel = st.alesa != null && st.faza === 'alege' ? s.j[0].mana[st.alesa] : null;
      el.innerHTML = `
        <div class="crt-loc-eu"><p>Tu</p>${sel ? `<button class="crt-m crt-joaca-loc" type="button" id="k-joaca"><b>Joacă</b><small>${esc(modelOf(masina(sel).name) || masina(sel).name)}</small><span>${valoare(sel, s.k)}</span></button>` : '<div class="crt-m crt-m-loc"></div>'}</div>
        <div class="crt-loc-bot"><p>Botul</p>${st.botCarte != null ? spate('is-pusa') : '<div class="crt-m crt-m-loc"></div>'}</div>`;
    }
    wirePhotos(el);
  }
  function deseneazaMana() {
    const el = $('k-mana'), s = st.joc;
    const mana = st.manaAfisata || s.j[0].mana;
    const k = st.faza === 'arata' ? null : s.k;
    el.innerHTML = mana.map((x, i) => carteMica(x, st.faza === 'alege' ? i : -1, k, st.vazute.has(x.k) ? '' : ' is-noua')).join('');
    el.classList.toggle('is-activa', st.faza === 'alege');
    mana.forEach(x => st.vazute.add(x.k));
    wirePhotos(el);
    st.fata = Math.max(0, Math.min(st.fata, mana.length - 1));
    CartiMana.aseaza(el, st.fata);
  }
  // altă carte în față: pe ecrane înguste e și cea aleasă
  function laFata(i) {
    const n = (st.manaAfisata || st.joc.j[0].mana).length;
    if (i < 0 || i >= n || (i === st.fata && st.alesa === i)) return;
    st.fata = i;
    if (st.faza === 'alege') st.alesa = i;
    haptic();
    CartiMana.aseaza($('k-mana'), i);
    if (st.faza === 'alege') deseneazaLoc();
  }
  addEventListener('resize', () => { if (st.joc && $('screen-joc').classList.contains('is-active')) CartiMana.aseaza($('k-mana'), st.fata); });

  CartiMana.lega($('k-mana'), '.crt-mana', {
    fata: () => st.fata,
    laFata,
    // atingere pe cartea din față (pe ecrane late, pe oricare): o joacă dacă era deja aleasă
    apasa: i => { if (st.faza !== 'alege') { laFata(i); return; } if (st.alesa === i) joacaCarte(i); else laFata(i); },
  });
  $('k-loc').addEventListener('click', e => { if (e.target.closest('#k-joaca') && st.alesa != null) joacaCarte(st.alesa); });
  $('k-loc').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) alegeCategoria(b.dataset.cat); });
  // pe calculator: 1-6 alege categoria, 1-5 sau săgețile aleg cartea, Enter o joacă
  document.addEventListener('keydown', e => {
    if (!$('screen-joc').classList.contains('is-active') || e.ctrlKey || e.metaKey || e.altKey || !st.joc) return;
    const n = +e.key;
    if (st.faza === 'cat' && n >= 1 && n <= K.CHEI.length) alegeCategoria(K.CHEI[n - 1]);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') laFata(st.fata + (e.key === 'ArrowLeft' ? -1 : 1));
    else if (st.faza === 'alege' && n >= 1 && n <= st.joc.j[0].mana.length) {
      if (st.alesa === n - 1) joacaCarte(n - 1); else laFata(n - 1);
    } else if (st.faza === 'alege' && e.key === 'Enter' && st.alesa != null) joacaCarte(st.alesa);
  });
  $('k-iesi').addEventListener('click', async () => {
    if (st.joc && !st.joc.gata && st.joc.runda > 0 && !(await Shared.intreaba('Ieși? Meciul se pierde.'))) return;
    opreste();
    st.joc = null; st.faza = null;
    show('screen-setup');
    pasul();
  });

  // ---------- finalul ----------
  async function trimite() {
    if (st.server) return st.final;
    if (!st.partida) return null;
    for (const t of [0, 2000, 5000]) {
      if (t) await new Promise(g => setTimeout(g, t));
      try { return await FrqCloud.carti({ actiune: 'gata', id: st.partida, mutari: st.mutari }); }
      catch (e) { if (FrqCloud.codEroare && ['terminata', 'partida'].includes(await FrqCloud.codEroare(e))) return null; }
    }
    return null;
  }
  async function final() {
    const s = st.joc, [a, b] = s.j.map(x => x.scor), am = s.castigator === 0;
    st.faza = 'final';
    sunet(am ? 'victorie' : 'infrangere');
    haptic(am ? 'success' : 'error');
    const rand = h => {
      const [eu, bot] = h.carti, ce = h.castiga === 0 ? 'is-c0' : h.castiga === 1 ? 'is-c1' : '';
      return `<li class="${ce}"><span class="crt-f-k">${K.CAT[h.cat].scurt}</span>
        <span class="crt-f-eu"><b>${esc(modelOf(masina(eu).name) || masina(eu).name)}</b>${valoare(eu, h.cat)}</span>
        <span class="crt-f-bot"><b>${esc(modelOf(masina(bot).name) || masina(bot).name)}</b>${valoare(bot, h.cat)}</span></li>`;
    };
    $('k-final').innerHTML = `
      <p class="eyebrow">Botul ${NIVELE[st.nivel].nume.toLowerCase()}</p>
      <h2 class="logo crt-f-t">${am ? 'Ai câștigat' : s.castigator === 1 ? 'Botul a câștigat' : 'Egal'}</h2>
      <p class="crt-f-scor"><span class="p0">${a}</span>–<span class="p1">${b}</span></p>
      <div class="crt-f-bani" id="k-bani">${st.partida ? '' : '<p class="col-nota">Meci fără bani: n-am ajuns la server când a început.</p>'}</div>
      <div class="start-actions">
        <button class="btn btn-primary" type="button" data-revansa>Revanșă</button>
        <button class="btn btn-ghost" type="button" data-meniu>Meniu</button>
      </div>
      <ol class="crt-f-lista">${s.istoric.map(rand).join('')}</ol>`;
    show('screen-final');
    const rez = await trimite();
    if (!rez || !rez.valid || st.faza !== 'final') return;
    const bn = rez.bani;
    $('k-bani').innerHTML = FrqCloud.randBani(bn, 'carti');
    FrqCloud.anuntaMisiuni(rez.misiuni);
    const randuri = [];
    if (bn.castig > 0) randuri.push({ text: rez.castigat ? `Victorie contra botului ${NIVELE[st.nivel].nume.toLowerCase()}` : 'Meci jucat', mil: bn.castig });
    if (bn.castig < bn.ar_fi) randuri.push({ text: 'Plafonul zilei atins', sub: `${bn.plafon} mil. din jocuri. Mâine se reia.`, mil: 0 });
    if (randuri.length) FrqCloud.ecranPremii(randuri);
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-revansa]')) { haptic(); porneste(); }
    if (e.target.closest('[data-reia]')) {
      haptic();
      if (st.reia) { const loc = $('k-loc').querySelector('.crt-loc-bot'); if (loc) loc.innerHTML = `<p>Botul</p>${spate()}`; st.reia(); }
      else { opreste(); st.joc = null; st.faza = null; show('screen-setup'); pasul(); }
    }
    if (e.target.closest('[data-meniu]')) { haptic(); st.joc = null; st.faza = null; show('screen-setup'); pasul(); }
  });

  pasul();
  incarcaGaraj();
  // pentru teste
  window.__carti = { st, K, MOD, porneste, joacaCarte, alegeCategoria };
})();
