// Startul: drag race pe sfert de milă, doi jucători unul lângă altul, pe același
// telefon. Fiecare cumpără pachete cu bugetul lui și le deschide la vedere, își
// așază mașinile pe runde pe ascuns, apoi rundele se joacă pe rând: sus e pista, jos
// fiecare are coloana lui cu un buton (Gata, Start când se sting luminile, apoi
// Schimbă la fiecare treaptă). Mașina dă timpul de bază, mâna îl împinge în sus sau
// în jos. Singur: același meci contra lui FRQ Bot, sau Cursa zilei, cu aceeași
// mașină pentru toți, contra fantomei recordului tău ori a unui prieten.
(() => {
  'use strict';

  const { store, fmt, brandOf, modelOf, esc, wirePhotos, haptic, shuffle, thumbHTML } = window.Shared;
  const $ = id => document.getElementById(id);
  // Local: meciul cu pachete, pe un telefon, fără cont. Online (?online, sau un link de
  // duel ori de provocare): Cursa zilei, Cupa, duelurile și echipa din garaj.
  const ONLINE = ['online', 'zi', 'duel', 'live'].some(k => new URLSearchParams(location.search).has(k));
  document.body.classList.toggle('mod-online', ONLINE);
  // Sunetul e un bonus: dacă lipsește sau dă greș, jocul merge mai departe în liniște.
  const sunet = (f, ...a) => { try { if (window.DragSunet) window.DragSunet[f](...a); } catch { /* fără sunet */ } };

  // ---------- modelul cursei ----------
  // Mașinile, profilul de viteză, nota fiecărei apăsări și simularea stau în
  // drag-model.js, comun cu serverul: clasamentul reface acolo fiecare cursă din
  // apăsări, cu exact același cod. Aici rămân doar legăturile cu ecranul.
  const M = window.DragModel;
  const MD = M.creeaza(window.CARS || []);
  const {
    electrica, t100, baza, schimbari, SFERT, profil, poz, vit, inv, RITM, R0, OK_DE_LA,
    verde, accel, PLECARE_MAX, ROLLOUT, pregateste, pilot, BLOCARE, LUMINA_0, LUMINA_PAS,
  } = M;
  const { POOL } = MD;
  const LANSARE = { '+': 'Perfectă', '~': 'Patinaj', '0': 'Moale', '-': 'Fără turație' };

  // Fiecare schimbare (și cele forțate de limitator) se vede și se aude.
  const peEcran = {
    schimba(c, n) {
      if (!c.auto) haptic(n === '+' ? 'success' : n === '-' || n === '~' ? 'error' : 'tick');
      sunet('schimba', c.p, n === '-' || n === '~');
      puneNota(c, n);
    },
  };
  const avanseaza = (c, acum) => M.avanseaza(c, acum, cursa.verde, peEcran);
  const schimba = (c, la, fortat = false) => M.schimba(c, la, cursa.verde, fortat, peEcran);
  function pleaca(c, la) {
    const n = M.pleaca(c, la, cursa.verde);
    if (!c.auto) haptic(n === '+' ? 'success' : n === '0' ? 'tick' : 'error');
    sunet('schimba', c.p, n !== '+');
    puneNota(c, n);
  }

  // ---------- pilotul automat ----------
  // FRQ Bot și fantomele. Botul țintește mijlocul verdelui, cu o abatere la
  // întâmplare cât nivelul lui. Fantoma repetă apăsările înregistrate ale cuiva, la
  // aceeași milisecundă de la stingerea luminilor; simularea fiind aceeași, cursa iese
  // la fel (la câteva milisecunde, cât pasul simulării).
  const NIVELE = [
    { nume: 'Ușor', abatere: 105, reactie: [310, 70], lansare: 0.05 },
    { nume: 'Mediu', abatere: 70, reactie: [245, 45], lansare: 0.03 },
    { nume: 'Greu', abatere: 42, reactie: [195, 25], lansare: 0.015 },
  ];
  const BOT = 'FRQ Bot';
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  function bot(nivel) {
    const n = NIVELE[nivel] || NIVELE[1];
    return { abatere: n.abatere, lansare: n.lansare, rt: Math.max(140, n.reactie[0] + gauss() * n.reactie[1]) };
  }
  function automat(c, acum) {
    const a = c.auto;
    if (!a || c.fin != null) return;
    const k = c.note.length;
    if (c.start == null) {
      const la = cursa.verde + (a.plan ? a.plan[0] : a.rt);
      if (acum >= la) pleaca(c, la);
      return;
    }
    if (c.gear >= c.G - 1) return;
    let la;
    if (a.plan) {
      if (a.plan[k] == null) return;
      la = cursa.verde + a.plan[k];
    } else {
      if (a.k !== k) { a.k = k; a.la = c.g0 + c.D[c.gear] + gauss() * a.abatere; }
      la = a.la;
    }
    if (acum >= la) schimba(c, Math.max(la, c.t));
  }

  // ---------- meciul ----------
  // Un meci: fiecare primește un buget, cumpără pe rând câte un pachet pentru fiecare
  // rundă și îl deschide la vedere, își așază apoi mașinile pe runde pe ascuns, iar
  // rundele se joacă una după alta. Câștigă cine ia mai multe runde; la egalitate,
  // cine a rămas cu mai mulți bani.
  const meci = {
    nume: store.get('drg_names', ['', '']), runde: store.get('drg_runde', 3),
    mod: store.get('drg_mod', 'doi'), nivel: store.get('drg_nivel', 1), zi: null,
    scor: [0, 0], curse: [], j: [], rand: 0, runda: 0, aseaza: 0, deschise: 0,
  };
  let cursa = null;
  // butonul fiecăruia e ținut apăsat acum? (pentru turația de la start)
  let apasat = [false, false];
  // un meci cu pachete contra lui FRQ Bot (nu Cursa zilei)
  const contraBot = () => meci.mod === 'ai' && !meci.zi && !meci.duel && !meci.cupa && !meci.live;
  // online ești tu, cu numele din Setări; la Local, numele scrise în joc
  const nume = p => (p === 0 && ONLINE ? ((window.FrqCloud && FrqCloud.numeLocal()) || 'Tu')
    : p === 1 && meci.live ? meci.live.advNume
    : p === 1 && (meci.antrenament || meci.cupa) ? BOT
    : p === 1 && meci.duel ? (meci.duel.rol === 'b' ? meci.duel.adv.nume : BOT)
    : p === 1 && meci.zi ? meci.zi.adversar
    : p === 1 && meci.mod === 'ai' ? BOT
      : (meci.nume[p] || '').trim() || `Jucător ${p + 1}`);
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // ---------- pachetele ----------
  // Ca la cutiile din CS: fiecare pachet are șansele lui pe rarități, iar raritatea
  // vine din cât de rapidă e mașina în realitate, adică din timpul ei pe 1/4.
  const RARITATI = ['Comună', 'Rară', 'Epică', 'Exotică', 'Legendară'];
  // clasa și intervalul de scor al fiecărei rarități, pentru lista din „Ce conține"
  const INTERVALE = ['D 100-500', 'C 501-600', 'B 601-700', 'A 701-800', 'S 801-999'];
  const CLASE = M.CLASE;
  const raritate = M.raritate;
  // Pe fața fiecărei lăzi, o mașină care o reprezintă, din pozele pe care le avem
  // deja, în culoarea pachetului: Golf GTI argintiu, M3 albastru, Huracán roz, P1 auriu.
  const PACHETE = [
    { id: 'strada', nume: 'Stradă', pret: 1, sanse: [55, 35, 10, 0, 0], fata: ['Volkswagen Golf GTI', '1983'] },
    { id: 'sport', nume: 'Sport', pret: 2, sanse: [20, 40, 30, 9, 1], fata: ['BMW M3', '1997'] },
    { id: 'super', nume: 'Supercar', pret: 4, sanse: [0, 15, 40, 35, 10], fata: ['Lamborghini Huracán LP 610-4', '2014'] },
    { id: 'hyper', nume: 'Hypercar', pret: 7, sanse: [0, 0, 25, 45, 30], fata: ['McLaren P1', '2013'] },
  ];
  PACHETE.forEach(pk => {
    pk.car = (window.CARS || []).find(c => c.name.normalize('NFC') === pk.fata[0].normalize('NFC') && String(c.years) === pk.fata[1]);
  });
  // Bugetul: 3 milioane pe rundă (9 la un meci de trei runde), dar cel puțin 8, ca
  // și la 1-2 runde să se poată lua un Hypercar (la două: Hypercar și Stradă).
  const BUGET_RUNDA = 3, BUGET_MINIM = 8;
  const buget = n => Math.max(BUGET_RUNDA * n, BUGET_MINIM);
  const { TIMP, rar, PE_RARITATE } = MD;

  // Întâi raritatea, după șansele pachetului, apoi o mașină din raritatea aceea. Un
  // jucător nu prinde de două ori aceeași mașină.
  function trage(pachet, exclus = []) {
    let x = Math.random() * 100, r = 0;
    while (r < 4 && x >= pachet.sanse[r]) { x -= pachet.sanse[r]; r++; }
    while (!pachet.sanse[r]) r--;
    const lista = PE_RARITATE[r].filter(c => !exclus.includes(c));
    return lista[Math.floor(Math.random() * lista.length)] || PE_RARITATE[r][0];
  }

  const mil = m => `${m} mil.`;
  // Poza mică (330 px, cam 35 KB în loc de 200) pentru cărți și liste, peste silueta
  // colorată după marcă: cât se încarcă, sau dacă nu vine, cartea nu rămâne goală.
  const poza = c => thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
  const fara = c => poza(c).replace(/<img[^>]*>/, '');
  // Scorul de performanță (ca în Forza): clasa și numărul, după tuning. Secundele nu
  // se arată pe mașini; fiecare și le descoperă alergând (recordurile lui).
  const pi = (c, nivel = 0) => { const s = M.scor(c, nivel); return `<span class="pi pi-${s.k}"><b>${s.clasa}</b>${s.v}</span>`; };
  const timpCarte = c => pi(c);
  // Un pachet se poate lua doar dacă după el mai rămân bani pentru pachetele de Stradă
  // care mai trebuie luate: nimeni nu rămâne fără mașină pentru o rundă.
  function poateLua(j, pk) {
    const ramase = meci.runde - j.garaj.length;
    return ramase > 0 && j.bani - pk.pret >= (ramase - 1) * PACHETE[0].pret;
  }

  function meciNou() {
    oprestePeTot();
    clearTimeout(meci.ceasBot);
    cursa = null;
    meci.zi = null;
    meci.duel = null;
    meci.antrenament = null;
    meci.cupa = null;
    inchideLive();
    meci.scor = [0, 0];
    meci.curse = [];
    meci.runda = 0;
    meci.rand = 0;
    meci.deschise = 0;
    meci.j = [0, 1].map(() => ({ bani: buget(meci.runde), garaj: [], ordine: [] }));
    magazin();
  }

  // ---------- magazinul ----------
  function panouJucator(q) {
    const j = meci.j[q], ramase = meci.runde - j.garaj.length;
    return `
      <div class="drg-juc-sus">
        <span class="drg-juc-n p${q}">${esc(nume(q))}</span>
        <b class="drg-juc-b">${mil(j.bani)}</b>
      </div>
      <span class="drg-juc-r">${ramase ? `${ramase} ${ramase === 1 ? 'pachet' : 'pachete'} de luat` : 'Garaj complet'}</span>
      <ul class="drg-garaj">${j.garaj.map(c => `<li class="rar-${rar(c)}"><span class="drg-g-f">${poza(c)}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></li>`).join('')}</ul>`;
  }

  function cardPachet(pk, ok) {
    const segm = pk.sanse.map((s, r) => (s ? `<i class="rar-${r}" style="flex:${s}"></i>` : '')).join('');
    const leg = pk.sanse.map((s, r) => (s ? `<span class="rar-${r}">${s}%</span>` : '')).join('');
    const img = pk.car ? `<img src="${esc(pk.car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" referrerpolicy="no-referrer">` : '';
    return `<div class="drg-pk-w"><button class="drg-pk pk-${pk.id}" type="button" data-pk="${pk.id}"${ok ? '' : ' disabled'} aria-label="${pk.nume}, ${mil(pk.pret)}">
      <span class="drg-lada" aria-hidden="true">
        <span class="drg-lada-foto">${img}</span>
        <span class="drg-lada-capac"><i class="drg-lada-maner"></i></span>
        <span class="drg-lada-et"><small>Pachet</small>${pk.nume}</span>
        <span class="drg-lada-pret">${mil(pk.pret)}</span>
        <i class="drg-lada-luciu"></i>
      </span>
      <span class="drg-pk-bar" aria-hidden="true">${segm}</span>
      <span class="drg-pk-s">${leg}</span>
    </button><button class="drg-pk-info" type="button" data-info="${pk.id}">Ce conține</button></div>`;
  }

  function magazin() {
    const p = meci.rand;
    [0, 1].forEach(q => {
      const el = $(`d-j${q}`);
      el.className = `drg-juc p${q}${q === p ? ' is-rand' : ''}`;
      el.innerHTML = panouJucator(q);
      wirePhotos(el);
    });
    const randBot = contraBot() && p === 1;
    $('d-rand').innerHTML = `<small>La rând</small><b class="p${p}">${esc(nume(p))}</b>`;
    $('d-pachete').innerHTML = PACHETE.map(pk => cardPachet(pk, poateLua(meci.j[p], pk) && !randBot)).join('');
    clearTimeout(meci.ceasBot);
    if (randBot) meci.ceasBot = setTimeout(alegeBot, 1100);
    $('d-pk-credit').innerHTML = `<span>Fotografii:</span> ${PACHETE.filter(pk => pk.car).map(pk => `${esc(pk.car.name)} (${esc(pk.car.credit)}, ${esc(pk.car.license)})`).join(' · ')}`;
    $('d-cutie').hidden = true;
    show('screen-shop');
  }

  // FRQ Bot cumpără ca un om: de obicei cel mai scump pachet pe care și-l permite,
  // uneori unul mai ieftin, ca să-i rămână bani pentru celelalte runde.
  function alegeBot() {
    if (!contraBot() || meci.rand !== 1 || cutie) return;
    const ok = PACHETE.filter(pk => poateLua(meci.j[1], pk));
    if (!ok.length) return;
    const pk = Math.random() < 0.65 ? ok[ok.length - 1] : ok[Math.floor(Math.random() * ok.length)];
    const lada = document.querySelector(`#d-pachete [data-pk="${pk.id}"]`);
    if (lada) lada.classList.add('is-scutura');
    meci.ceasBot = setTimeout(() => deschide(pk), 420);
  }

  // ---------- ce conține un pachet ----------
  // Toate mașinile pe care le poate da pachetul, pe rarități, de la cea mai rapidă:
  // șansa, intervalul de timp și câte sunt. Pozele vin doar când ajungi la ele.
  let vazator = null;
  function continut(pk) {
    const card = c => `<div class="drg-cont-c rar-${rar(c)}"><span class="drg-cont-f">${poza(c).replace(' src="', ' data-src="')}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))}</small><span class="drg-cont-pi">${timpCarte(c)}</span></div>`;
    $('d-cont-t').innerHTML = `<small>Ce conține</small><span>${pk.nume}</span>`;
    $('d-cont-lista').innerHTML = pk.sanse.map((s, r) => (s ? `
      <section class="drg-cont-r rar-${r}">
        <h3><b>${RARITATI[r]}</b><span class="drg-cont-p">${s}%</span><small><span>Clasa ${INTERVALE[r]}</span> &middot; <span>${PE_RARITATE[r].length} mașini</span></small></h3>
        <div class="drg-cont-grid">${[...PE_RARITATE[r]].sort((a, b) => TIMP.get(a) - TIMP.get(b)).map(card).join('')}</div>
      </section>` : '')).join('');
    $('d-cont').hidden = false;
    $('d-cont-lista').scrollTop = 0;
    if (vazator) vazator.disconnect();
    const incarca = img => { img.src = img.dataset.src; img.removeAttribute('data-src'); wirePhotos(img.closest('.drg-cont-f')); };
    if (!('IntersectionObserver' in window)) { $('d-cont-lista').querySelectorAll('img[data-src]').forEach(incarca); return; }
    vazator = new IntersectionObserver(intrari => intrari.forEach(x => {
      if (!x.isIntersecting) return;
      vazator.unobserve(x.target);
      incarca(x.target);
    }), { root: $('d-cont-lista'), rootMargin: '300px 0px' });
    $('d-cont-lista').querySelectorAll('img[data-src]').forEach(img => vazator.observe(img));
  }

  // ---------- deschiderea: banda care se învârte ----------
  // Rezultatul se trage înainte; banda e doar spectacolul. Pe ea sunt mașini trase cu
  // aceleași șanse ca pachetul, iar cea câștigătoare stă pe poziția la care se
  // oprește banda, cu o mică abatere, ca oprirea să nu fie mereu fix la mijloc.
  const NR_CARTI = 46, CASTIG = 40;
  let cutie = null;
  const carte = (c, cuPoza) => `<div class="drg-carte rar-${rar(c)}"><span class="drg-carte-f">${cuPoza ? poza(c) : fara(c)}</span><span class="drg-carte-m">${esc(brandOf(c.name))}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></div>`;
  // Cărțile de la început trec prea repede ca să se vadă: doar ultimele, cele care
  // trec încet prin fața acului, își primesc poza (o duzină, nu 46).
  const cuPoza = i => i >= CASTIG - 9 && i <= CASTIG + 3;

  function deschide(pk) {
    const p = meci.rand, j = meci.j[p];
    if (cutie || !poateLua(j, pk)) return;
    j.bani -= pk.pret;
    const car = trage(pk, j.garaj);
    cutie = { p, car, gata: false, ceas: 0 };
    meci.deschise++;
    const lent = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // primele două deschideri cu tot spectacolul, apoi mai scurt, ca meciul să curgă
    const durata = !lent ? 700 : meci.deschise <= 2 ? 5600 : 3600;
    $('d-cutie-t').innerHTML = `<small class="p${p}">${esc(nume(p))}</small>${pk.nume}`;
    const banda = $('d-banda');
    banda.innerHTML = Array.from({ length: NR_CARTI }, (_, i) => carte(i === CASTIG ? car : trage(pk), cuPoza(i))).join('');
    wirePhotos(banda);
    banda.style.transition = 'none';
    banda.style.transform = 'translateX(0)';
    $('d-rev').hidden = true;
    $('d-sari').hidden = meci.deschise < 3;
    $('d-cutie').hidden = false;
    $('d-cutie').classList.remove('is-gata');
    haptic();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tinta = banda.children[CASTIG], fer = $('d-fereastra');
      const abatere = (Math.random() - 0.5) * tinta.offsetWidth * 0.7;
      const x = tinta.offsetLeft + tinta.offsetWidth / 2 - fer.clientWidth / 2 + abatere;
      cutie.x = x;
      banda.style.transition = `transform ${durata}ms cubic-bezier(.06, .62, .12, 1)`;
      banda.style.transform = `translateX(${-x}px)`;
      cutie.ceas = setTimeout(arata, durata + 120);
    }));
  }

  // Banda s-a oprit (sau s-a sărit peste ea): apare mașina.
  function arata() {
    if (!cutie || cutie.gata) return;
    clearTimeout(cutie.ceas);
    cutie.gata = true;
    const banda = $('d-banda');
    if (cutie.x != null) { banda.style.transition = 'none'; banda.style.transform = `translateX(${-cutie.x}px)`; }
    const c = cutie.car, r = rar(c);
    $('d-rev').className = `drg-rev rar-${r}`;
    $('d-rev').innerHTML = `
      <p class="drg-rev-r">${RARITATI[r]}</p>
      <div class="drg-rev-foto"><img class="art-photo" src="${esc(c.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <p class="drg-rev-n"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</p>
      <p class="drg-rev-t">${pi(c)}</p>
      <p class="drg-rev-c">Foto: ${esc(c.credit)}, ${esc(c.license)}</p>
      <button class="btn btn-primary" type="button" id="d-rev-ok">Mai departe</button>`;
    wirePhotos($('d-rev'));
    $('d-rev').hidden = false;
    $('d-sari').hidden = true;
    $('d-cutie').classList.add('is-gata');
    haptic(r >= 3 ? 'success' : 'tick');
    // mașina botului rămâne o clipă la vedere, apoi intră singură în garaj
    if (contraBot() && cutie.p === 1) cutie.ceasBot = setTimeout(inchideCutie, 1900);
  }

  // Mașina intră în garaj; urmează celălalt, dacă mai are de luat.
  function inchideCutie() {
    if (!cutie || !cutie.gata) return;
    const { p, car } = cutie;
    clearTimeout(cutie.ceasBot);
    meci.j[p].garaj.push(car);
    cutie = null;
    const plin = q => meci.j[q].garaj.length >= meci.runde;
    if (plin(0) && plin(1)) { $('d-cutie').hidden = true; incepeOrdinea(); return; }
    meci.rand = plin(1 - p) ? p : 1 - p;
    magazin();
  }

  // ---------- ordinea, pe ascuns ----------
  function incepeOrdinea() {
    // botul își amestecă mașinile: nu știe ordinea ta, deci nici n-are ce calcula
    if (contraBot()) meci.j[1].ordine = shuffle([...meci.j[1].garaj]);
    if (meci.runde === 1) {
      meci.j.forEach(j => { j.ordine = [...j.garaj]; });
      rundaNoua();
      return;
    }
    ordinea(0);
  }

  // Întâi un ecran de pază: telefonul trece la cel care așază, celălalt nu se uită.
  const OCHI = '<svg class="drg-cover-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function ordinea(p) {
    meci.aseaza = p;
    meci.sel = 0;
    meci.j[p].ordine = Array(meci.runde).fill(null);
    $('d-cover').className = `drg-cover p${p}`;
    $('d-cover').innerHTML = `
      <div class="drg-cover-in">
        ${OCHI}
        <p class="drg-cover-e">Ordinea pe runde</p>
        <h2 class="drg-cover-n">${esc(nume(p))}</h2>
        <p class="drg-cover-s">${esc(nume(1 - p))} nu se uită.</p>
        <button class="btn btn-primary" type="button" id="d-cover-ok">Așază mașinile</button>
      </div>`;
    $('d-cover').hidden = false;
    $('d-line').hidden = true;
    show('screen-lineup');
    // contra botului n-are cine să se uite: direct la ordine
    if (contraBot()) {
      $('d-cover').hidden = true;
      randeazaOrdinea();
      $('d-line').hidden = false;
    }
  }

  // Fiecare rundă e un duel: mașina ta în stânga, cartea întoarsă a celuilalt în
  // dreapta. Atingi o rundă ca s-o alegi, apoi o mașină din garaj: intră acolo, iar
  // dacă era deja în altă rundă, cele două mașini își schimbă locurile.
  function randeazaOrdinea() {
    const p = meci.aseaza, j = meci.j[p], alt = meci.j[1 - p];
    const plin = j.ordine.every(Boolean);
    $('d-line').className = `drg-line p${p}`;
    $('d-line').innerHTML = `
      <div class="drg-line-cap"><span class="drg-line-n">${esc(nume(p))}</span><span class="drg-line-h">Ordinea pe runde</span></div>
      <ol class="drg-dueluri">${j.ordine.map((c, i) => `
        <li><button type="button" class="drg-duel${meci.sel === i ? ' is-sel' : ''}${c ? ` is-plin rar-${rar(c)}` : ''}" data-slot="${i}">
          <b class="drg-duel-r">${i + 1}</b>
          <span class="drg-duel-m">${c
            ? `<span class="drg-g-f">${poza(c)}</span><span class="drg-duel-t"><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></span>`
            : `<em>${meci.sel === i ? 'Alege o mașină' : 'Liber'}</em>`}</span>
          <span class="drg-duel-vs">vs</span>
          <span class="drg-duel-x p${1 - p}" aria-label="Mașina lui ${esc(nume(1 - p))}">?</span>
        </button></li>`).join('')}</ol>
      <p class="drg-line-t t-mele">Garajul tău</p>
      <div class="drg-mele">${j.garaj.map((c, i) => {
        const r = j.ordine.indexOf(c);
        return `<button type="button" class="drg-car-b rar-${rar(c)}${r >= 0 ? ' is-pus' : ''}" data-g="${i}"><span class="drg-cb-f">${poza(c)}</span>${r >= 0 ? `<i class="drg-cb-r">R${r + 1}</i>` : ''}<b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></button>`;
      }).join('')}</div>
      <p class="drg-line-t t-alt">Mașinile lui ${esc(nume(1 - p))}</p>
      <ul class="drg-garaj drg-garaj-alt">${alt.garaj.map(c => `<li class="rar-${rar(c)}"><span class="drg-g-f">${poza(c)}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></li>`).join('')}</ul>
      <div class="drg-line-gata"><button class="btn btn-primary" type="button" id="d-line-ok"${plin ? '' : ' disabled'}>Gata</button></div>`;
    wirePhotos($('d-line'));
  }

  // O mașină din garaj intră în runda aleasă; dacă era deja în alta, cele două își
  // schimbă locurile. Apoi alegerea trece la prima rundă liberă.
  function puneMasina(gi) {
    const j = meci.j[meci.aseaza], c = j.garaj[gi];
    const sel = meci.sel != null ? meci.sel : Math.max(0, j.ordine.indexOf(null));
    const unde = j.ordine.indexOf(c);
    if (unde >= 0) j.ordine[unde] = j.ordine[sel];
    j.ordine[sel] = c;
    const gol = j.ordine.indexOf(null);
    meci.sel = gol >= 0 ? gol : sel;
  }

  // ---------- rundele ----------
  function rundaNoua() {
    const r = meci.runda;
    meci.runda++;
    cursaNoua(meci.j.map(j => j.ordine[r]));
    dezvaluie();
  }

  // La începutul rundei, ambele mașini se întorc deodată, ca niște cărți.
  function dezvaluie() {
    const el = $('d-dezv');
    el.innerHTML = `<p class="drg-dz-t">Runda ${meci.runda} din ${meci.runde}</p>
      <div class="drg-dz-c">${cursa.piloti.map(c => `
        <div class="drg-dz-k rar-${rar(c.car)} p${c.p}">
          <span class="drg-dz-f">${poza(c.car)}</span>
          <span class="drg-dz-j">${esc(nume(c.p))}</span>
          <span class="drg-dz-r">${RARITATI[rar(c.car)]}</span>
          <b>${esc(modelOf(c.car.name) || c.car.name)}</b>
          <small>${timpCarte(c.car)}</small>
        </div>`).join('')}</div>`;
    wirePhotos(el);
    el.hidden = false;
    el.classList.remove('is-iese');
    cursa.ceasuri.push(setTimeout(ascundeDezv, 2600));
  }
  function ascundeDezv() {
    const el = $('d-dezv');
    if (el.hidden) return;
    el.classList.add('is-iese');
    setTimeout(() => { el.hidden = true; }, 260);
  }

  function cursaNoua(masini) {
    oprestePeTot();
    cursa = { faza: 'arm', piloti: masini.map((m, p) => pilot(p, m && m.car ? pregateste(m.car, m.nivel) : pregateste(m))), verde: null, ceasuri: [], raf: 0, poateUrma: false };
    // botul sau fantoma e gata din prima: luminile pornesc când apeși tu Gata. Botul
    // își alege turația de plecare: mijlocul verdelui, cu o abatere cât nivelul lui.
    apasat = [false, false];
    cursa.piloti.forEach(c => {
      c.auto = automatPentru(c.p);
      if (!c.auto) return;
      c.faza = 'gata';
      if (c.auto.lc == null) c.auto.lc = Math.min(1, Math.max(R0, (c.V[0] + c.V[1]) / 2 + gauss() * (c.auto.lansare || 0)));
    });
    $('d-track').className = 'drg-track';
    luminiStinse();
    // Întâi ecranul, apoi pista: are nevoie de mărimea lui ca să se deseneze.
    show('screen-race');
    [0, 1].forEach(p => { randeazaJumatate(p); stare(p, cursa.piloti[p].auto ? 'ready' : 'arm'); });
    $('d-bon').hidden = true;
    $('d-next').hidden = true;
    document.querySelector('.drg-pads').classList.remove('is-final');
    tabela();
    $('d-nr').textContent = meci.live ? 'Live' : meci.zi ? 'Cursa zilei' : meci.cupa ? 'Cupa' : meci.duel ? 'Duel' : meci.antrenament ? 'Antrenament' : `Runda ${meci.runda}/${meci.runde}`;
    pista();
    cursa.piloti.forEach(c => deseneaza(c, 0));
  }

  // Cine conduce singur: în Cursa zilei, adversarul (fantoma unui record sau, dacă
  // nu există, botul mediu); contra botului, botul la nivelul ales.
  function automatPentru(p) {
    if (p !== 1) return null;
    // live: celălalt, din apăsările lui care vin pe loc (planul se umple pe parcurs)
    if (meci.live) return { plan: meci.live.plan, lc: meci.live.lc, live: true };
    // în duel: B aleargă contra fantomei lui A; A, cu FRQ Bot doar ca să aibă ritm
    if (meci.antrenament) return bot(meci.nivel);
    if (meci.cupa) return bot(1);
    if (meci.duel) return meci.duel.rol === 'b' ? { plan: meci.duel.adv.plan, lc: meci.duel.adv.lc } : bot(1);
    if (meci.zi) return meci.zi.plan ? { plan: meci.zi.plan, lc: meci.zi.lc } : bot(1);
    return meci.mod === 'ai' ? bot(meci.nivel) : null;
  }

  function oprestePeTot() {
    sunet('opresteTot', 0.15);
    if (!cursa) return;
    cursa.ceasuri.forEach(clearTimeout);
    cancelAnimationFrame(cursa.raf);
  }

  // ---------- luminile, ca în Formula 1 ----------
  // Cinci roșii se aprind una câte una, apoi, după o pauză pe care n-o poți ghici,
  // se sting toate deodată. Ora stingerii se ia la cadrul în care chiar dispar de
  // pe ecran, iar întârzierea afișajului e aceeași pentru amândoi.
  const becuri = () => [...$('d-lights').children];
  function luminiStinse() {
    becuri().forEach(b => b.classList.remove('on'));
    $('d-track').classList.remove('is-lit', 'is-go');
  }

  function lumini() {
    cursa.faza = 'lumini';
    [0, 1].forEach(p => stare(p, 'lumini'));
    cursa.piloti.forEach(c => sunet('motor', c.p, c.ev));
    // turația se socotește din orele degetului de aici încolo
    cursa.l0 = performance.now();
    cursa.piloti.forEach(c => { if (!c.auto && apasat[c.p]) c.tur.push(0); });
    becuri().forEach((b, i) => cursa.ceasuri.push(setTimeout(() => {
      b.classList.add('on');
      $('d-track').classList.add('is-lit');
      sunet('bip', 520, 0.11);
      haptic();
      if (i === 4) blocheaza();
    }, LUMINA_0 + i * LUMINA_PAS)));
    cursa.tr = performance.now();
    bucla();
    // live: aceeași pauză pe ambele telefoane, aleasă de server
    const tine = meci.live ? meci.live.joc.tine : BLOCARE + 500 + Math.random() * 2300;
    cursa.ceasuri.push(setTimeout(() => {
      if (cursa.faza !== 'lumini') return;
      luminiStinse();
      $('d-track').classList.add('is-go');
      requestAnimationFrame(t => {
        if (cursa.faza !== 'lumini') return;
        cursa.verde = t;
        cursa.faza = 'go';
        [0, 1].forEach(p => stare(p, 'go'));
        cancelAnimationFrame(cursa.raf);
        bucla();
      });
    }, tine));
  }

  // A cincea lumină: turația fiecăruia rămâne unde e.
  function blocheaza() {
    cursa.blocat = true;
    cursa.piloti.forEach(c => {
      c.r = c.auto ? c.auto.lc : M.turatieLa(c.tur, BLOCARE);
      c.lc = c.r;
      c.blocat = true;
      stare(c.p, 'blocat');
    });
    if (meci.live) liveTrimite({ tip: 'lc', v: cursa.piloti[0].lc });
  }

  // Turația de dinainte de start: urcă cât ții apăsat și stă cât nu; în limitator
  // cade jos. Se socotește din orele degetului (M.turatieLa), la fel ca pe server.
  // Botul și fantoma ajung singure la turația lor.
  function turatii(acum) {
    const dt = Math.min(50, Math.max(0, acum - (cursa.tr || acum))) / 1000;
    cursa.tr = acum;
    const t = Math.min(acum - cursa.l0, BLOCARE);
    cursa.piloti.forEach(c => {
      if (c.blocat) return;
      if (c.auto) { c.r += (c.auto.lc - c.r) * Math.min(1, dt * 3); return; }
      c.r = M.turatieLa(c.tur, t);
      const n = M.limitatoare(c.tur, t);
      if (n > (c.limitari || 0)) { c.limitari = n; sunet('schimba', c.p, true); haptic('error'); }
    });
  }

  // ---------- butoanele ----------
  // Fiecare are butonul lui, iar el își schimbă rostul pe parcurs: Gata, Start,
  // Schimbă, Mai departe. Două degete deodată sunt două evenimente separate, iar
  // ora e cea a evenimentului, nu a procesării.
  function atinge(p, la) {
    if (!cursa) return;
    sunet('trezeste');
    const c = cursa.piloti[p];
    // butonul botului sau al fantomei nu se apasă
    if (c.auto && cursa.faza !== 'gata') return;
    const era = apasat[p];
    apasat[p] = true;
    if (cursa.faza === 'lumini' && !cursa.blocat && !era) c.tur.push(Math.max(0, Math.round(la - cursa.l0)));
    if (cursa.faza === 'arm') {
      if (c.faza !== 'arm') return;
      c.faza = 'gata';
      haptic();
      stare(p, 'ready');
      // live: luminile pornesc la ora dată de server, nu când apeși Gata
      if (cursa.piloti.every(x => x.faza === 'gata') && !meci.live) lumini();
      return;
    }
    // înainte de a cincea lumină apăsarea turează; după, e start fals
    if (cursa.faza === 'lumini') { if (cursa.blocat) startFals(p); return; }
    if (cursa.faza === 'go') {
      if (c.fin != null) return;
      if (c.start == null) pleaca(c, la);
      else schimba(c, la);
      return;
    }
    if (cursa.faza === 'gata' && cursa.poateUrma) {
      if (meci.antrenament) { oprestePeTot(); cursa = null; ecranDuel('antrenament'); }
      else if (meci.live) finalLive();
      else if (meci.cupa) finalCupa();
      else if (meci.duel) finalDuel();
      else if (meci.zi) finalZi();
      else if (meci.runda >= meci.runde) final(); else rundaNoua();
    }
  }

  // Degetul se ridică: înainte de stingere doar oprește turatul; după stingere, dacă
  // încă ținea, e plecarea.
  function elibereaza(p, la) {
    const tinea = apasat[p];
    apasat[p] = false;
    if (!cursa || !tinea) return;
    const c = cursa.piloti[p];
    if (c.auto) return;
    if (cursa.faza === 'lumini' && !cursa.blocat) c.tur.push(Math.max(0, Math.round(la - cursa.l0)));
    if (cursa.faza === 'go' && c.start == null && c.fin == null) pleaca(c, la);
  }

  // Ce scrie pe buton în fiecare moment. „Gata!" are semn, ca să nu se confunde cu
  // „Gata" de la celelalte jocuri, unde înseamnă „am terminat".
  const ETICHETE = {
    arm: 'Gata!', ready: 'Gata!', lumini: 'Turează', blocat: 'Start', go: 'Start', run: 'Schimbă',
    last: 'Ultima treaptă', next: 'Mai departe', rezultat: 'Rezultatul',
  };
  function stare(p, st) {
    const el = $(`d-half-${p}`);
    if (!el) return;
    el.dataset.st = st;
    const b = el.querySelector('.drg-btn');
    const eticheta = st === 'run' && cursa && cursa.piloti[p].ev ? 'Boost' : ETICHETE[st];
    if (eticheta) b.querySelector('span').textContent = eticheta;
    const inactiv = st === 'ready' || st === 'last' || st === 'done';
    b.setAttribute('aria-disabled', inactiv ? 'true' : 'false');
  }

  function startFals(p) {
    oprestePeTot();
    const c = cursa.piloti[p];
    c.fals = true;
    if (meci.live && p === 0) { liveTrimite({ tip: 'fals' }); trimiteCursaLive(); }
    luminiStinse();
    haptic('error');
    $(`d-half-${p}`).classList.add('is-false');
    incheie(1 - p, null);
  }

  // ---------- bucla de desen ----------
  function bucla() {
    if (!cursa || (cursa.faza !== 'go' && cursa.faza !== 'lumini')) return;
    // Următorul cadru se cere de la început: dacă un cadru se împiedică de ceva
    // neprevăzut, cursa merge mai departe în loc să înghețe. La final, incheie() îl
    // anulează.
    cursa.raf = requestAnimationFrame(bucla);
    const acum = performance.now();
    // cât se aprind luminile: doar turația
    if (cursa.faza === 'lumini') {
      turatii(acum);
      cursa.piloti.forEach(c => deseneaza(c, acum));
      return;
    }
    cursa.piloti.forEach(c => {
      // live: mașina celuilalt merge cu o clipă în urmă, ca apăsările lui să fi ajuns
      const t = c.auto && c.auto.live ? acum - LIVE_URMA : acum;
      if (c.auto && c.auto.live && (c.fals || t < cursa.verde)) return;
      automat(c, t);
      if (c.start == null && t - cursa.verde > PLECARE_MAX) pleaca(c, cursa.verde + PLECARE_MAX);
      avanseaza(c, t);
      // Cine trece linia: flash pe linie, iar butonul lui se stinge.
      if (c.fin != null && !c.sosit) {
        c.sosit = true;
        clipa('fin-flash');
        stare(c.p, 'done');
        sunet('opreste', c.p, 0.9);
      }
    });
    cursa.piloti.forEach(c => deseneaza(c, acum));
    if (meci.live) {
      // apăsările mele pleacă pe loc la celălalt; când trec linia, cursa pleacă la server
      const eu = cursa.piloti[0];
      while (meci.live.trimise < eu.apasari.length) { const i = meci.live.trimise++; liveTrimite({ tip: 'a', i, t: eu.apasari[i] }); }
      if (eu.fin != null) trimiteCursaLive();
      // Câștigătorul îl spune serverul, același pe ambele telefoane. Mașina celuilalt
      // de pe ecran e refăcută din apăsări care vin prin rețea și pot întârzia, deci
      // pista nu are voie să decidă.
      const r = meci.live.trimisa && live.joc && live.joc.rezultat;
      if (r) {
        const e = live.eu, t = [r.timpi[e], r.timpi[1 - e]];
        incheie(r.win === -1 ? -1 : r.win === e ? 0 : 1, t.every(x => x != null) ? t : null);
        return;
      }
      if (eu.fin != null) {
        // rezultatul vine prin Realtime; dacă întârzie, îl cerem noi
        if (!meci.live.cerut || acum - meci.live.cerut > 1500) {
          meci.live.cerut = acum;
          cereLive({ actiune: 'stare', id: meci.live.id }).then(primesteLiveTacit).catch(() => {});
        }
        // celălalt n-a terminat (a plecat, n-are semnal): pagina cu rezultatul așteaptă serverul
        if (acum - eu.fin > 15000) finalLive();
      }
      return;
    }
    if (cursa.piloti.every(c => c.fin != null)) {
      const [a, b] = cursa.piloti.map(c => c.fin - cursa.verde);
      incheie(a === b ? -1 : a < b ? 0 : 1, [a, b]);
    }
  }

  const pct = r => ((r - R0) / (1 - R0)) * 100;
  // Unde e mașina pe pistă, în procente, după profilul ei.
  const pozitie = c => poz(c.pr, c.u) * 100;

  function deseneaza(c, acum) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    el.querySelector('.drg-fill').style.width = `${Math.max(0, pct(c.r))}%`;
    // înainte de start bara arată turația de plecare
    const lansare = c.start == null && (cursa.faza === 'lumini' || cursa.faza === 'go');
    const activ = c.start != null ? c.gear < c.G - 1 : lansare;
    el.classList.toggle('in-verde', activ && c.r >= c.V[0] && c.r <= c.V[1]);
    el.classList.toggle('in-rosu', activ && c.r > c.V[1]);
    el.classList.toggle('pe-limita', c.lim != null);
    el.classList.toggle('is-blocat', lansare && c.blocat);
    el.querySelector('.drg-gear span').textContent = c.gear + 1;
    const t = c.fin != null ? c.fin - cursa.verde : c.start != null ? acum - cursa.verde : 0;
    el.querySelector('.drg-time').textContent = c.start != null ? `${fmt(t / 1000, 2)} s` : '';
    auto(c.p, pozitie(c) / 100);
    if (c.fin == null) {
      const tur = c.start != null ? c.r : lansare ? 0.1 + ((c.r - R0) / (1 - R0)) * 0.85 : 0.12;
      sunet('seteaza', c.p, tur, c.lim != null);
    }
  }

  function puneNota(c, n) {
    const el = $(`d-half-${c.p}`);
    if (!el) return;
    const prima = c.note.length === 1;
    const rau = n === '-' || n === '~';
    const eticheta = n === '+' ? '+' : rau ? '−' : '0';
    const titlu = prima ? `Plecare ${fmt(c.reactie / 1000, 2)} s` : `Schimbarea ${c.note.length - 1}`;
    el.querySelector('.drg-note').insertAdjacentHTML('beforeend',
      `<span class="drg-n n${n === '+' ? 'plus' : rau ? 'minus' : 'zero'}${prima ? ' is-start' : ''}" title="${esc(titlu)}">${eticheta}</span>`);
    const cls = n === '+' ? 'bun' : rau ? 'rau' : '';
    if (prima) {
      el.querySelector('.drg-rt').textContent = `reacție ${fmt(c.reactie / 1000, 2)} s`;
      fum(c.p);
      clipa('trepida');
      deasupra(c, c.motiv, cls);
    } else {
      flama(c.p);
      deasupra(c, c.motiv, cls);
    }
    stare(c.p, c.gear >= c.G - 1 ? 'last' : 'run');
  }

  // ---------- bonul cursei ----------
  // Ca la pistele de drag adevărate: după cursă, timpii fiecăruia la fiecare reper.
  // Timpii sunt de la plecare, fără reacție, ca pe un bon real; totalul de jos e cel
  // cu reacție, adică cel care a decis cursa.
  const RANDURI = [['60 ft', 0], ['330 ft', 1], ['1/8 milă', 2, true], ['1000 ft', 3], ['1/4 milă', 4, true]];
  function bon(castigator) {
    const el = $('d-bon'), [a, b] = cursa.piloti;
    const t3 = ms => fmt(ms / 1000, 3);
    const cel = (c, html) => `<td class="p${c.p}${castigator === c.p ? ' is-win' : ''}">${html}</td>`;
    const rand = (eticheta, f) => `<tr><th>${eticheta}</th>${cel(a, f(a))}${cel(b, f(b))}</tr>`;
    let titlu, corp;
    const fals = cursa.piloti.find(c => c.fals);
    if (fals) {
      titlu = `${esc(nume(fals.p))} a plecat înainte`;
      corp = `<p class="drg-bon-fals">Start fals</p>`;
    } else {
      const dif = Math.abs(a.fin - b.fin) / 1000;
      titlu = castigator < 0 ? 'Egal' : `${esc(nume(castigator))} câștigă cu ${fmt(dif, 3)} s`;
      corp = `<table><thead><tr><th></th><th class="p0">${esc(nume(0))}</th><th class="p1">${esc(nume(1))}</th></tr></thead><tbody>`
        + rand('Reacție', c => t3(c.reactie))
        + rand('Lansare', c => LANSARE[c.note[0]] || '–')
        + rand('0-100 km/h', c => (c.t100 != null ? t3(c.t100 - c.start + ROLLOUT) : '–'))
        + RANDURI.map(([et, i, v]) => rand(et, c => `${t3(c.repere[i] - c.start)}${v ? ` <small>${Math.round(c.vit[i] * 3.6)} km/h</small>` : ''}`)).join('')
        + `</tbody><tfoot>${rand('Total', c => `${t3(c.fin - cursa.verde)} s`)}</tfoot></table>`;
    }
    el.innerHTML = `<p class="drg-bon-t"><span>${meci.zi ? 'Cursa zilei' : meci.cupa ? 'Cupa' : meci.duel ? 'Duel' : meci.antrenament ? 'Antrenament' : `Runda ${meci.runda}`}</span>${titlu}</p>${corp}`;
    el.hidden = false;
  }

  // ---------- sfârșitul cursei ----------
  // Antrenamentul se reface pe server din apăsări; dacă e cel mai bun timp al tău cu
  // mașina asta, devine recordul ei.
  function trimiteAntrenament() {
    const a = meci.antrenament, c = cursa && cursa.piloti[0];
    if (!a || !c || c.fals || c.fin == null) return;
    FrqCloud.duel({ actiune: 'antrenament', masina: a.masina, apasari: [...c.apasari], tur: [...c.tur] })
      .then(r => {
        dl.antrRez = { masina: a.masina, timp: r.timp, record: r.record };
        if (r.record && dl.recorduri) dl.recorduri.set(a.masina, r.timp);
        if (dl.pas === 'antrenament' && !cursa) randeazaDuel();
      }).catch(() => {});
  }

  function incheie(castigator, timpi) {
    if (meci.antrenament) trimiteAntrenament();
    cursa.faza = 'gata';
    cancelAnimationFrame(cursa.raf);
    if (castigator >= 0) meci.scor[castigator]++;
    meci.curse.push({
      masini: cursa.piloti.map(c => c.car.name),
      timpi: timpi ? timpi.map(x => x / 1000) : null,
      fals: cursa.piloti.findIndex(c => c.fals),
      castigator,
      // pentru statisticile de la finalul meciului
      date: cursa.piloti.map(c => ({
        rt: c.fals ? null : c.reactie,
        et: c.repere[4] != null ? c.repere[4] - c.start : null,
        linie: c.vit[4] != null ? c.vit[4] : null,
        perf: c.note.slice(1).filter(n => n === '+').length,
        sch: Math.max(0, c.note.length - 1),
      })),
    });
    const terminat = !!meci.zi || !!meci.duel || !!meci.antrenament || !!meci.cupa || !!meci.live || meci.runda >= meci.runde;
    tabela();
    if (castigator >= 0) $('d-track').classList.add(`castiga-${castigator}`);
    [0, 1].forEach(p => {
      $(`d-half-${p}`).classList.toggle('is-win', castigator === p);
      stare(p, 'done');
    });
    // bonul apare după o clipă, cât să se vadă săgețile trecând linia
    cursa.ceasuri.push(setTimeout(() => { if (cursa && cursa.faza === 'gata') bon(castigator); }, 450));
    // O clipă de pauză, ca o apăsare întârziată pe Schimbă să nu sară peste rezultat.
    cursa.ceasuri.push(setTimeout(() => {
      if (!cursa || cursa.faza !== 'gata') return;
      cursa.poateUrma = true;
      // un singur buton pentru amândoi, exact peste cele două (așezat din CSS, deci
      // rămâne la locul lui și când se schimbă mărimea ecranului)
      const urm = $('d-next'), pads = document.querySelector('.drg-pads');
      urm.querySelector('span').textContent = terminat ? 'Rezultatul' : 'Mai departe';
      urm.hidden = false;
      pads.classList.add('is-final');
    }, 1200));
    haptic(castigator >= 0 ? 'success' : 'tick');
  }

  function tabela() {
    if (meci.cupa) {
      const k = meci.cupa;
      $('d-tally').innerHTML = k.timp != null ? `<span class="p0">Cel mai bun</span><b class="p0">${fmt(k.timp / 1000, 2)} s</b>` : '';
      return;
    }
    // Antrenamentul și Cupa își scriu deja numele în dreapta: bara nu-l mai repetă
    if (meci.antrenament) {
      $('d-tally').innerHTML = '';
      return;
    }
    if (meci.duel) {
      const d = meci.duel;
      $('d-tally').innerHTML = `<span class="p0">${d.tip === 'acte' ? 'Pe acte' : 'Pe bani'}</span><b class="p0">${d.tip === 'acte' ? '' : esc(mil(d.miza))}</b>`;
      return;
    }
    if (meci.zi) {
      const rec = meci.zi.data === azi() ? recordAzi() : null;
      $('d-tally').innerHTML = rec ? `<span class="p0">Recordul tău</span><b class="p0">${fmt(rec.t / 1000, 2)} s</b>` : `<span class="p0">${esc(nume(0))}</span>`;
      return;
    }
    $('d-tally').innerHTML = `<span class="p0">${esc(nume(0))}</span><b class="p0">${meci.scor[0]}</b><i>–</i><b class="p1">${meci.scor[1]}</b><span class="p1">${esc(nume(1))}</span>`;
  }

  // ---------- pista ----------
  // Văzută din spatele liniei de start, în perspectivă: la distanța f (0 la start,
  // 1 la finiș) totul e de 1 + K·f ori mai mic, deci finișul e de 3,6 ori mai mic
  // decât startul. Pista se desenează o dată pe mărimea ecranului; în cursă se mută
  // doar săgețile.
  const K = 2.6;
  // Reperele clasice de pe o pistă de drag: 330 de picioare, o optime de milă și
  // 1000 de picioare; finișul e la un sfert de milă (402 m).
  const MILA_4 = SFERT;
  const REPERE = [[100.584, '330 ft'], [201.168, '1/8'], [304.8, '1000 ft']];
  // petele de lumină de pe asfalt, din 50 în 50 de metri, așezate între repere
  const STALPI = [25, 75, 125, 175, 225, 275].map(m => m / MILA_4);
  // turnurile de reflectoare, ca la stadion: puține, departe de pistă, între repere
  // (mai aproape de 125 m ar ieși pe marginea ecranului, mai departe de 250 m ar
  // intra sub luminile de start)
  const TURNURI = [125, 250].map(m => m / MILA_4);
  // Săgeata fiecăruia: o pată de lumină pe asfalt, desenată în perspectivă, cu vârful
  // înainte. Lungimea e în bucăți de pistă (0,07 = 28 m), lățimea în jumătăți de
  // pistă (0,22 = aproape jumătate de bandă).
  const SAGEATA = 0.07, LAT_S = 0.22;
  let geo = null;

  function pista() {
    const tr = $('d-track'), W = tr.clientWidth, H = tr.clientHeight;
    if (!W || !H) return;
    const lum = $('d-lights');
    const yF = lum.offsetTop + lum.offsetHeight + Math.max(12, H * 0.05);   // finișul, sub lumini
    const yS = H - Math.max(8, H * 0.035);                                  // startul, aproape de margine
    const yH = (yF * (1 + K) - yS) / K;                                     // orizontul
    const lat0 = Math.min(W * 0.43, H * 0.6);                               // jumătate din pistă, la start
    const cx = W / 2;
    const s = f => 1 / (1 + K * f);
    const y = f => yH + (yS - yH) * s(f);
    const lat = f => lat0 * s(f);
    const fJos = ((yS - yH) / (H + 4 - yH) - 1) / K;                        // unde iese pista din ecran
    const SUS = 1.05;
    const n = v => v.toFixed(1);
    const trap = (f1, f2, a, b, atr) => `<polygon ${atr} points="${n(cx + a * lat(f1))},${n(y(f1))} ${n(cx + b * lat(f1))},${n(y(f1))} ${n(cx + b * lat(f2))},${n(y(f2))} ${n(cx + a * lat(f2))},${n(y(f2))}"/>`;
    const grad = (id, y1, y2, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y1)}" x2="0" y2="${n(y2)}">${stops}</linearGradient>`;

    let svg = '<defs>'
      + grad('drg-asf', y(SUS), H, '<stop offset="0" stop-color="#0d0e11"/><stop offset="1" stop-color="#2a2b31"/>')
      + grad('drg-cauc', y(0.4), y(0), '<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>')
      + [0, 1].map(p => grad(`drg-t${p}`, y(0.75), H,
        `<stop offset="0" style="stop-color:var(--p${p})" stop-opacity="0"/><stop offset="1" style="stop-color:var(--p${p})" stop-opacity=".2"/>`)).join('')
      // dâra din spatele săgeții, în culoarea jucătorului, care se stinge spre noi
      + [0, 1].map(p => `<linearGradient id="drg-u${p}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--p${p})" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--p${p})" stop-opacity="0"/></linearGradient>`).join('')
      + '<filter id="drg-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>'
      + '<radialGradient id="drg-pata"><stop offset="0" stop-color="#ffeccc" stop-opacity=".16"/><stop offset="1" stop-color="#ffeccc" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="drg-con" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4dc" stop-opacity=".2"/><stop offset="1" stop-color="#fff4dc" stop-opacity="0"/></linearGradient>'
      + '<filter id="drg-bec" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>'
      + grad('drg-zid', y(SUS) - lat0 * 0.1, H, '<stop offset="0" stop-color="#121317"/><stop offset="1" stop-color="#2c2e35"/>')
      + '</defs>';
    svg += trap(fJos, SUS, -1, 1, 'fill="url(#drg-asf)"');
    svg += trap(fJos, 1, -1, 0, 'class="tint l0" fill="url(#drg-t0)"') + trap(fJos, 1, 0, 1, 'class="tint l1" fill="url(#drg-t1)"');
    // pete moi de lumină pe asfalt, ca de la reflectoarele unei piste de noapte
    for (const f of STALPI) for (const sd of [-1, 1]) {
      svg += `<ellipse class="pata" cx="${n(cx + sd * 0.55 * lat(f))}" cy="${n(y(f))}" rx="${n(0.7 * lat(f))}" ry="${n(Math.max(2, (y(f - 0.035) - y(f + 0.035)) / 2))}" fill="url(#drg-pata)"/>`;
    }
    // urmele de cauciuc lăsate de plecările de dinainte
    for (const c of [-0.5, 0.5]) for (const r of [-0.15, 0.15]) svg += trap(fJos, 0.4, c + r - 0.035, c + r + 0.035, 'fill="url(#drg-cauc)"');
    // marginile, fiecare în culoarea benzii, și linia din mijloc
    svg += trap(fJos, SUS, -1.04, -0.93, 'class="glow p0"') + trap(fJos, SUS, -1, -0.975, 'class="margine p0"');
    svg += trap(fJos, SUS, 0.93, 1.04, 'class="glow p1"') + trap(fJos, SUS, 0.975, 1, 'class="margine p1"');
    svg += trap(fJos, SUS, -0.012, 0.012, 'class="mijloc"');
    svg += trap(0, 0.007, -1, 1, 'class="linie"');
    for (const [m] of REPERE) {
      const f = m / MILA_4;
      svg += trap(f, f + 0.004, -1, 1, 'class="reper"');
    }
    // finișul în carouri
    const yf = y(1), lat1 = lat(1), col = 14, ch = Math.max(3, (yS - yH) * 0.012);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < col; k++) {
        svg += `<rect x="${n(cx - lat1 + (k * 2 * lat1) / col)}" y="${n(yf - (r + 1) * ch)}" width="${n((2 * lat1) / col + 0.3)}" height="${n(ch)}" fill="${(r + k) % 2 ? '#0a0a0c' : '#f2f2f2'}"/>`;
      }
    }
    svg += trap(0.994, 1.014, -1.08, 1.08, 'class="fin-glow"');
    // parapetele, de-a lungul marginilor, cu o dungă în culoarea benzii pe muchie
    const zid = f => lat0 * 0.085 * s(f);
    for (const sd of [-1, 1]) {
      const x = f => cx + sd * 1.045 * lat(f);
      const fata = (h0, h1) => `${n(x(fJos))},${n(y(fJos) - zid(fJos) * h0)} ${n(x(SUS))},${n(y(SUS) - zid(SUS) * h0)} ${n(x(SUS))},${n(y(SUS) - zid(SUS) * h1)} ${n(x(fJos))},${n(y(fJos) - zid(fJos) * h1)}`;
      svg += `<polygon class="zid" points="${fata(0, 1)}" fill="url(#drg-zid)"/>`;
      svg += `<polygon class="zid-banda p${sd < 0 ? 0 : 1}" points="${fata(0.8, 1)}"/>`;
    }
    // turnurile de reflectoare: întâi conurile de lumină, apoi turnurile, de departe
    // spre aproape. Fiecare are un catarg subțire și sus un panou cu două rânduri de
    // becuri, întors spre pistă.
    let conuri = '', turnuri = '';
    for (const f of [...TURNURI].reverse()) for (const sd of [-1, 1]) {
      // cel din spate stă mai în lateral și mai jos, ca să nu intre sub luminile de start
      const dep = f > 0.5, k = s(f), x = cx + sd * (dep ? 2.2 : 1.75) * lat(f), jos = y(f), sus = jos - lat0 * (dep ? 1.15 : 1.45) * k;
      const pw = lat0 * 0.42 * k, ph = lat0 * 0.13 * k, px = x - sd * pw * 0.15;
      // colțul panoului dinspre pistă coboară spre interiorul pistei, cel dinspre afară
      // spre margine; altfel, pe o parte, conul iese răsucit în cruce
      const pin = px - sd * pw / 2, pout = px + sd * pw / 2;
      conuri += `<polygon class="con" points="${n(pin)},${n(sus + ph)} ${n(pout)},${n(sus + ph)} ${n(cx + sd * 0.98 * lat(f))},${n(jos)} ${n(cx + sd * 0.15 * lat(f))},${n(jos)}" fill="url(#drg-con)"/>`;
      turnuri += `<path class="catarg" stroke-width="${n(Math.max(1, 2.6 * k))}" d="M${n(x)} ${n(jos)}V${n(sus + ph)}"/>`;
      turnuri += `<rect class="panou" x="${n(px - pw / 2)}" y="${n(sus)}" width="${n(pw)}" height="${n(ph)}"/>`;
      const bw = pw / 4, bh = ph / 2;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
        const bx = px - pw / 2 + c * bw + bw * 0.18, by = sus + r * bh + bh * 0.2;
        turnuri += `<rect class="bec-h" x="${n(bx)}" y="${n(by)}" width="${n(bw * 0.64)}" height="${n(bh * 0.6)}" filter="url(#drg-bec)"/>`;
        turnuri += `<rect class="bec" x="${n(bx)}" y="${n(by)}" width="${n(bw * 0.64)}" height="${n(bh * 0.6)}"/>`;
      }
    }
    svg += conuri + turnuri;
    // etichetele reperelor, ultimele, ca nimic să nu treacă peste ele: lângă parapet,
    // pe partea dreaptă, cu un contur închis care le desparte de ce e în spate
    for (const [m, eticheta] of REPERE) {
      const f = m / MILA_4;
      svg += `<text class="reper-t" x="${n(cx + 1.08 * lat(f) + 3)}" y="${n(y(f) - zid(f) - 3)}" font-size="${n(Math.max(9, 17 * s(f)))}">${eticheta}</text>`;
    }
    svg += [0, 1].map(p => `<g class="drg-sageata p${p}"><polygon class="urma" fill="url(#drg-u${p})"/><polygon class="halo" filter="url(#drg-glow)"/><polygon class="varf"/></g>`).join('');
    // fumul de la plecare, la baza săgeții
    const w0 = lat0 * LAT_S;
    svg += [0, 1].map(p => {
      const x = cx + (p ? 0.5 : -0.5) * lat0;
      return `<g class="drg-fum f${p}">${[-1, 0, 1].map((d, i) =>
        `<circle cx="${n(x + d * w0)}" cy="${n(yS - w0 * 0.1)}" r="${n(w0 * (i === 1 ? 0.6 : 0.5))}"/>`).join('')}</g>`;
    }).join('');

    const road = $('d-road');
    road.setAttribute('viewBox', `0 0 ${W} ${H}`);
    road.innerHTML = svg;
    geo = { s, y, lat, cx, sageti: [...road.querySelectorAll('.drg-sageata')], urma: [0, 1].map(() => ({ f: 0, t: 0, v: 0 })) };
  }

  // Săgeata stă pe asfalt, deci fiecare colț trece prin perspectiva pistei: vârful e
  // mai departe și mai îngust decât baza. Dâra din spate crește cu viteza.
  function auto(p, f) {
    if (!geo) return;
    const st = geo.urma[p], t = performance.now();
    if (st.t && t > st.t) st.v += ((f - st.f) / ((t - st.t) / 1000) - st.v) * 0.3;
    st.f = f; st.t = t;
    const banda = p ? 0.5 : -0.5;
    const pt = (u, g) => `${(geo.cx + (banda + u) * geo.lat(g)).toFixed(1)},${geo.y(g).toFixed(1)}`;
    const varf = `${pt(0, f + SAGEATA)} ${pt(LAT_S, f)} ${pt(0, f + SAGEATA * 0.36)} ${pt(-LAT_S, f)}`;
    const coada = Math.min(0.12, Math.max(0, st.v) * 0.5);
    const g = geo.sageti[p];
    g.querySelector('.varf').setAttribute('points', varf);
    g.querySelector('.halo').setAttribute('points', varf);
    // Dâra pornește din interiorul săgeții (sub vârf, peste scobitura din spate), ca
    // să nu rămână loc gol între ele: săgeata se desenează peste ea și o acoperă.
    g.querySelector('.urma').setAttribute('points',
      `${pt(-0.06, f + SAGEATA * 0.6)} ${pt(0.06, f + SAGEATA * 0.6)} ${pt(0.03, f - coada)} ${pt(-0.03, f - coada)}`);
  }

  // La fiecare schimbare, săgeata se aprinde o clipă.
  function flama(p) {
    if (!geo) return;
    const g = geo.sageti[p];
    g.classList.remove('flacara');
    void g.getBoundingClientRect();
    g.classList.add('flacara');
  }

  // O clasă pe pistă, pusă din nou de la capăt, ca animația ei să pornească iar.
  function clipa(cls) {
    const tr = $('d-track');
    tr.classList.remove(cls);
    void tr.offsetWidth;
    tr.classList.add(cls);
  }

  // Un cuvânt care urcă deasupra săgeții și se stinge: reacția la plecare, apoi nota
  // fiecărei schimbări.
  function deasupra(c, text, cls) {
    if (!geo) return;
    const f = pozitie(c) / 100, el = document.createElement('p');
    el.className = `drg-pop${cls ? ` ${cls}` : ''}`;
    el.textContent = text;
    el.style.left = `${(geo.cx + (c.p ? 0.5 : -0.5) * geo.lat(f)).toFixed(1)}px`;
    el.style.top = `${geo.y(f + SAGEATA).toFixed(1)}px`;
    $('d-track').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function fum(p) {
    const tr = $('d-track');
    tr.classList.remove(`fum-${p}`);
    void tr.offsetWidth;
    tr.classList.add(`fum-${p}`);
  }

  // ---------- coloana fiecăruia ----------
  function zone(V) {
    const z = (a, b, cls) => `<span class="drg-z ${cls}" style="left:${pct(a)}%;width:${pct(b) - pct(a)}%"></span>`;
    return z(OK_DE_LA, V[0], 'ok') + z(V[0], V[1], 'verde') + z(V[1], 1, 'rosu');
  }

  function randeazaJumatate(p) {
    const c = cursa.piloti[p], car = c.car, el = $(`d-half-${p}`);
    el.className = `drg-half p${p}${c.auto ? ' is-auto' : ''}`;
    el.innerHTML = `
      <div class="drg-bg" aria-hidden="true"><img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <div class="drg-in">
        <div class="drg-id">
          <span class="drg-who">${esc(nume(p))} <i class="rar-${rar(car)}">${RARITATI[rar(car)]}</i></span>
          <span class="drg-car"><b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}</span>
          <span class="drg-base">${pi(car, c.nivel || 0)} &middot; ${c.ev ? 'electrică' : `${c.G - 1} schimbări`}${c.nivel ? ` &middot; nivel ${c.nivel}` : ''}</span>
        </div>
        <div class="drg-bar" aria-hidden="true">${zone(c.V)}<i class="drg-fill"></i></div>
        <div class="drg-ger">
          <b class="drg-gear"><span>1</span><small>/${c.G}</small></b>
          <span class="drg-tw"><span class="drg-time"></span><small class="drg-rt"></small></span>
        </div>
        <div class="drg-note" aria-label="Notele schimbărilor"></div>
        <button class="drg-btn" type="button"><span></span><kbd class="drg-kbd" aria-hidden="true">${p ? 'L' : 'A'}</kbd></button>
      </div>
      <p class="drg-credit">Foto: ${esc(car.credit)}, ${esc(car.license)}</p>`;
    wirePhotos(el);
  }

  // ---------- finalul meciului ----------
  function final() {
    oprestePeTot();
    cursa = null;
    const [a, b] = meci.scor, [ba, bb] = meci.j.map(j => j.bani);
    const c = a !== b ? (a > b ? 0 : 1) : ba !== bb ? (ba > bb ? 0 : 1) : -1;
    $('d-end-t').innerHTML = c < 0
      ? `Egalitate <em>${a}–${b}</em>`
      : `<span class="p${c}">${esc(nume(c))}</span> câștigă <em>${meci.scor[c]}–${meci.scor[1 - c]}</em>`;
    $('d-end-e').textContent = 'Meci încheiat';
    $('d-again').textContent = 'Revanșă';
    $('d-prov-b').hidden = true;
    $('d-img').hidden = true;
    $('d-top').hidden = true;
    $('d-stat').innerHTML = statistici();
    $('d-recap').innerHTML = meci.curse.map((r, i) => `
      <li class="${r.castigator >= 0 ? `w${r.castigator}` : ''}">
        <span class="drg-rk">Runda ${i + 1}</span>
        <span class="drg-rc p0">${esc(r.masini[0])}${r.timpi ? ` <em>${fmt(r.timpi[0], 2)} s</em>` : r.fals === 0 ? ' <em>start fals</em>' : ''}</span>
        <span class="drg-rc p1">${esc(r.masini[1])}${r.timpi ? ` <em>${fmt(r.timpi[1], 2)} s</em>` : r.fals === 1 ? ' <em>start fals</em>' : ''}</span>
      </li>`).join('');
    show('screen-end');
    haptic('success');
  }

  // Statisticile meciului, în stilul bonului: pe fiecare rând, valoarea mai bună e
  // în verde.
  function statistici() {
    const d = [0, 1].map(p => meci.curse.map(r => r.date && r.date[p]).filter(Boolean));
    const vals = (p, k) => d[p].map(x => x[k]).filter(x => x != null);
    const min = (p, k) => (vals(p, k).length ? Math.min(...vals(p, k)) : null);
    const max = (p, k) => (vals(p, k).length ? Math.max(...vals(p, k)) : null);
    const sum = (p, k) => d[p].reduce((s, x) => s + (x[k] || 0), 0);
    const falsuri = p => meci.curse.filter(r => r.fals === p).length;
    const RANDURI = [
      ['Runde câștigate', p => meci.scor[p], 1, v => v],
      ['Bani rămași', p => meci.j[p].bani, 1, v => mil(v)],
      ['Cea mai bună reacție', p => min(p, 'rt'), -1, v => `${fmt(v / 1000, 3)} s`],
      ['Cel mai bun 1/4 milă', p => min(p, 'et'), -1, v => `${fmt(v / 1000, 3)} s`],
      ['Viteza maximă', p => max(p, 'linie'), 1, v => `${Math.round(v * 3.6)} km/h`],
      // se compară procentul, nu numărul: 4 din 4 e la fel de bun ca 5 din 5
      ['Schimbări perfecte', p => (sum(p, 'sch') ? sum(p, 'perf') / sum(p, 'sch') : null), 1, (v, p) => `${sum(p, 'perf')}<small>/${sum(p, 'sch')}</small>`],
    ];
    if (falsuri(0) + falsuri(1) > 0) RANDURI.push(['Starturi false', falsuri, -1, v => v]);
    const rand = ([eticheta, f, sens, arata]) => {
      const v = [f(0), f(1)];
      const bun = v.map((x, p) => x != null && (v[1 - p] == null || (x - v[1 - p]) * sens > 0));
      return `<tr><th>${eticheta}</th>${[0, 1].map(p => `<td class="p${p}${bun[p] ? ' is-win' : ''}">${v[p] == null ? '–' : arata(v[p], p)}</td>`).join('')}</tr>`;
    };
    return `<thead><tr><th></th><th class="p0">${esc(nume(0))}</th><th class="p1">${esc(nume(1))}</th></tr></thead><tbody>${RANDURI.map(rand).join('')}</tbody>`;
  }

  // ---------- cursa zilei ----------
  // Aceeași mașină pentru toți în aceeași zi: o alege un generator pornit de la dată,
  // deci nu trebuie ținută nicăieri. Concurezi contra fantomei recordului tău de azi,
  // contra unui prieten care ți-a trimis linkul sau, prima dată, contra lui FRQ Bot.
  // Recordul și seria de zile stau pe telefon.
  const doi = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${doi(d.getMonth() + 1)}-${doi(d.getDate())}`;
  const azi = () => iso(new Date());
  const ieri = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
  const { cheieMasina } = M;
  const { masinaZilei, dupaCheie } = MD;
  const dataLunga = data => {
    const [y, m, d] = data.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(window.I18n && I18n.lang === 'en' ? 'en-GB' : 'ro-RO', { day: 'numeric', month: 'long' });
  };
  const recordAzi = () => { const r = store.get('drg_zi', null); return r && r.data === azi() ? r : null; };
  function serie() {
    const s = store.get('drg_serie', null);
    return s && (s.ultima === azi() || s.ultima === ieri()) ? s.n : 0;
  }
  function noteazaSerie() {
    const s = store.get('drg_serie', null), a = azi();
    if (s && s.ultima === a) return;
    store.set('drg_serie', { ultima: a, n: s && s.ultima === ieri() ? s.n + 1 : 1 });
  }

  function cardZi() {
    const data = azi(), car = masinaZilei(data), rec = recordAzi(), n = serie();
    $('d-zi-f').innerHTML = poza(car);
    wirePhotos($('d-zi-f'));
    $('d-zi-t').textContent = `Cursa zilei · ${dataLunga(data)}`;
    $('d-zi-m').innerHTML = `<b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}`;
    $('d-zi').className = `drg-zi rar-${rar(car)}`;
    const bucati = [`${RARITATI[rar(car)]} · ${timpCarte(car)}`];
    if (rec) bucati.push(`Recordul tău: ${fmt(rec.t / 1000, 2)} s`);
    if (n > 1) bucati.push(`Serie: ${n} zile`);
    $('d-zi-s').innerHTML = bucati.map(b => `<span>${esc(b)}</span>`).join('');
    // locul de azi, doar pentru cine are deja cont (nu facem conturi la simpla vizită)
    if (rec && window.DragCloud && DragCloud.areCont()) {
      DragCloud.clasament(data, 1).then(r => {
        if (r && r.eu && azi() === data) $('d-zi-s').insertAdjacentHTML('beforeend', `<span>${esc(`Locul ${r.eu.loc} din ${r.total}`)}</span>`);
      }).catch(() => {});
    }
  }

  // ---------- clasamentul zilei ----------
  // După fiecare cursă a zilei, serverul o reface din apăsări și o păstrează dacă e
  // cel mai bun timp al tău de azi; apoi apar primii zece și locul tău.
  async function clasamentZi(data, deTrimis) {
    const el = $('d-top');
    if (!window.DragCloud || (!deTrimis && !DragCloud.areCont())) { el.hidden = true; return; }
    const cap = b => `<p class="drg-cls-h"><span>Clasamentul zilei</span><b>${b}</b></p>`;
    el.innerHTML = cap('Se încarcă');
    el.hidden = false;
    try {
      const rez = deTrimis ? await DragCloud.trimiteZi(deTrimis) : null;
      const r = await DragCloud.clasament(data, 10);
      if (!$('screen-end').classList.contains('is-active')) return;
      el.innerHTML = randClasament(r, rez) + (rez ? DragCloud.randRecompense(rez.recompense) : '');
    } catch {
      el.innerHTML = cap('Indisponibil acum');
    }
  }
  function randClasament(r, rez) {
    const rand = x => `<li class="${x.eu ? 'is-eu' : ''}"><span class="drg-cls-l">${x.loc}</span><span class="drg-cls-n">${esc(x.nume)}</span><span class="drg-cls-t">${fmt(x.timp / 1000, 3)} s</span></li>`;
    const eu = r.eu;
    const titlu = eu ? `Locul ${eu.loc} din ${r.total}` : r.total === 1 ? '1 jucător' : `${r.total} jucători`;
    const jos = eu && eu.loc > r.top.length
      ? `<li class="drg-cls-sep" aria-hidden="true">···</li>${rand({ loc: eu.loc, nume: (rez && rez.nume) || nume(0), timp: eu.timp, eu: true })}`
      : '';
    return `<p class="drg-cls-h"><span>Clasamentul zilei</span><b>${titlu}</b></p>
      <ol class="drg-cls-lista">${r.top.map(rand).join('')}${jos}</ol>
      <p class="drg-cls-f"><a href="confidentialitate.html">Confidențialitate</a></p>`;
  }

  function cursaZilei(prieten = meci.zi && meci.zi.prieten) {
    oprestePeTot();
    clearTimeout(meci.ceasBot);
    const data = prieten ? prieten.data : azi();
    const car = prieten ? prieten.car : masinaZilei(data);
    const rec = data === azi() ? recordAzi() : null;
    const plan = prieten ? prieten.plan : rec && rec.plan;
    const lc = prieten ? prieten.lc : rec && rec.lc;
    meci.zi = {
      data, car, prieten: prieten || null, plan: plan || null, lc: lc != null ? lc : null,
      adversar: prieten ? prieten.nume : plan ? 'Recordul tău' : BOT,
    };
    meci.scor = [0, 0];
    meci.curse = [];
    meci.runda = 1;
    cursaNoua([car, car]);
  }

  // Cursa s-a terminat: recordul, seria și ecranul de final al zilei.
  function finalZi() {
    const z = meci.zi, [c, alt] = cursa.piloti;
    const t = c.fals || c.fin == null ? null : c.fin - cursa.verde;
    const ta = alt.fals || alt.fin == null ? null : alt.fin - cursa.verde;
    const azit = z.data === azi();
    const vechi = azit ? recordAzi() : null;
    let nou = false;
    if (t != null && azit) {
      noteazaSerie();
      if (!vechi || t < vechi.t) {
        store.set('drg_zi', { data: z.data, t: Math.round(t), plan: c.apasari, lc: c.lc, m: cheieMasina(z.car) });
        nou = true;
      }
    }
    const date = x => ({
      fals: x.fals, total: x.fals || x.fin == null ? null : x.fin - cursa.verde, reactie: x.reactie,
      t100: x.t100 != null ? x.t100 - x.start + ROLLOUT : null,
      repere: x.repere.map(r => r - x.start), vit: x.vit,
      perf: x.note.slice(1).filter(n => n === '+').length, sch: Math.max(0, x.note.length - 1),
      lans: x.note[0],
    });
    meci.ultim = { t, ta, nou, plan: c.apasari, lc: c.lc, eu: date(c), el: date(alt) };
    // ce pleacă la clasament: doar ce a făcut degetul; timpul îl socotește serverul
    const deTrimis = t != null && azit
      ? { data: z.data, apasari: [...c.apasari], tur: [...c.tur], nume: FrqCloud.numeLocal() }
      : null;
    oprestePeTot();
    cursa = null;

    $('d-end-e').textContent = `Cursa zilei · ${dataLunga(z.data)}`;
    $('d-end-t').innerHTML = t == null
      ? 'Start fals'
      : `${fmt(t / 1000, 3)} s${!azit ? '' : `<small class="drg-sub${nou && vechi ? ' is-record' : ''}">${nou ? (vechi ? 'Record nou' : 'Primul tău timp azi') : `Recordul tău: ${fmt(vechi.t / 1000, 3)} s`}</small>`}`;
    const u = meci.ultim, t3 = ms => (ms == null ? '–' : `${fmt(ms / 1000, 3)} s`);
    const RANDURI_Z = [
      ['Reacție', x => (x.fals ? null : x.reactie), -1, t3],
      ['Lansare', x => ({ '+': 0, '0': 1, '~': 2, '-': 3 })[x.lans] ?? null, -1, (v, x) => LANSARE[x.lans]],
      ['0-100 km/h', x => x.t100, -1, t3],
      ['60 ft', x => x.repere[0], -1, t3],
      ['1/8 milă', x => x.repere[2], -1, t3],
      ['1/4 milă', x => x.repere[4], -1, t3],
      ['Viteza la linie', x => x.vit[4], 1, v => `${Math.round(v * 3.6)} km/h`],
      ['Schimbări perfecte', x => (x.sch ? x.perf / x.sch : null), 1, (v, x) => `${x.perf}<small>/${x.sch}</small>`],
      ['Total', x => x.total, -1, t3],
    ];
    const rand = ([et, f, sens, arata]) => {
      const v = [f(u.eu), f(u.el)];
      return `<tr><th>${et}</th>${[u.eu, u.el].map((x, p) => {
        const bun = v[p] != null && (v[1 - p] == null || (v[p] - v[1 - p]) * sens > 0);
        return `<td class="p${p}${bun ? ' is-win' : ''}">${v[p] == null ? '–' : arata(v[p], x)}</td>`;
      }).join('')}</tr>`;
    };
    $('d-stat').innerHTML = `<thead><tr><th></th><th class="p0">${esc(nume(0))}</th><th class="p1">${esc(nume(1))}</th></tr></thead><tbody>${RANDURI_Z.map(rand).join('')}</tbody>`;
    const n = serie();
    $('d-recap').innerHTML = `
      <li><span class="drg-rk">Mașina zilei</span><span class="drg-rc">${esc(z.car.name)} <em>${timpCarte(z.car)}</em></span></li>
      ${n ? `<li><span class="drg-rk">Serie</span><span class="drg-rc">${n === 1 ? '1 zi' : `${n} zile`}</span></li>` : ''}`;
    $('d-again').textContent = 'Încă o dată';
    $('d-prov-b').textContent = 'Provoacă un prieten';
    $('d-prov-b').hidden = t == null && !(azit && recordAzi());
    $('d-img').textContent = 'Salvează bonul';
    $('d-img').hidden = t == null;
    show('screen-end');
    haptic(nou ? 'success' : 'tick');
    clasamentZi(z.data, deTrimis);
  }

  // ---------- provocarea: un link care conține tot ----------
  // Ziua, mașina, timpul și apăsările (în baza 36, ca linkul să rămână scurt). Cine
  // îl deschide primește aceeași mașină și concurează contra fantomei; timpul ei se
  // reface din apăsări, deci nu se ia pe cuvânt cifra din link.
  function linkProvocare() {
    const z = meci.zi, rec = z.data === azi() ? recordAzi() : null;
    const t = rec ? rec.t : meci.ultim.t, plan = rec ? rec.plan : meci.ultim.plan;
    const lc = rec ? rec.lc : meci.ultim.lc;
    const q = new URLSearchParams({
      zi: z.data, m: cheieMasina(z.car), t: String(Math.round(t)), n: nume(0).slice(0, 16),
      g: plan.map(x => Math.max(0, Math.round(x)).toString(36)).join('.'),
    });
    if (lc != null) q.set('l', String(Math.round(lc * 1000)));
    return { t, url: `${location.origin}${location.pathname}?${q}` };
  }

  function citesteProvocarea() {
    const q = new URLSearchParams(location.search);
    const data = q.get('zi'), g = q.get('g');
    if (!data || !g || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
    const plan = g.split('.').map(x => parseInt(x, 36));
    const bun = plan.length >= 2 && plan.length <= 8
      && plan.every((x, i) => Number.isFinite(x) && x >= 0 && x <= 60000 && (i === 0 || x > plan[i - 1]));
    if (!bun) return null;
    const car = dupaCheie(q.get('m') || '') || masinaZilei(data);
    if (!car) return null;
    const t = Number(q.get('t')), l = Number(q.get('l'));
    return {
      data, car, plan, lc: Number.isFinite(l) && l >= 550 && l <= 1000 ? l / 1000 : null,
      nume: (q.get('n') || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Un prieten',
      t: Number.isFinite(t) && t > 3000 && t < 60000 ? t : null,
    };
  }

  async function provoaca() {
    const b = $('d-prov-b');
    const { t, url } = linkProvocare();
    const masina = meci.zi.car.name;
    const text = I18n.t('Am făcut {t} s cu {m} la Cursa zilei. Mă bați?', { t: fmt(t / 1000, 2), m: masina });
    haptic();
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); b.textContent = 'Link copiat'; } catch { window.prompt(I18n.t('Copiază linkul'), url); }
  }

  // ---------- bonul ca imagine ----------
  // 1080x1350, ca să arate bine pe orice rețea: mașina, timpul mare și reperele.
  const incarcaImg = src => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  async function bonImagine() {
    const z = meci.zi, u = meci.ultim.eu, car = z.car;
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    try { await document.fonts.ready; } catch { /* fonturile sistemului */ }
    const [logo, foto] = await Promise.all([incarcaImg('img/frq-logo.png'), incarcaImg(car.image)]);
    const DISP = '"Big Shoulders Display", Arial', BODY = 'Archivo, Arial';
    g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, W, H);
    if (logo) g.drawImage(logo, 60, 56, 164, 40);
    g.textAlign = 'right'; g.fillStyle = '#ed1b2f'; g.font = `700 26px ${BODY}`;
    g.fillText(I18n.t('STARTUL · CURSA ZILEI'), W - 60, 78);
    g.fillStyle = '#9aa0a9'; g.font = `500 24px ${BODY}`;
    g.fillText(dataLunga(z.data), W - 60, 110);
    const fx = 60, fy = 150, fw = W - 120, fh = 470;
    g.fillStyle = '#18181d'; g.fillRect(fx, fy, fw, fh);
    if (foto) {
      const s = Math.max(fw / foto.width, fh / foto.height), dw = foto.width * s, dh = foto.height * s;
      g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
      g.drawImage(foto, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
      const umbra = g.createLinearGradient(0, fy + fh * 0.45, 0, fy + fh);
      umbra.addColorStop(0, 'rgba(10,10,12,0)'); umbra.addColorStop(1, 'rgba(10,10,12,.92)');
      g.fillStyle = umbra; g.fillRect(fx, fy, fw, fh);
      g.restore();
    }
    g.textAlign = 'left';
    g.fillStyle = '#9aa0a9'; g.font = `700 24px ${BODY}`;
    g.fillText(brandOf(car.name).toUpperCase(), fx + 28, fy + fh - 78);
    g.fillStyle = '#ffffff'; g.font = `400 54px ${DISP}`;
    g.fillText((modelOf(car.name) || car.name).toUpperCase().slice(0, 30), fx + 28, fy + fh - 28);
    // timpul, mare
    g.fillStyle = '#ffffff'; g.font = `400 190px ${DISP}`;
    const tt = `${fmt(meci.ultim.t / 1000, 3)} S`;
    g.fillText(tt, 60, 830);
    g.fillStyle = '#9aa0a9'; g.font = `500 26px ${BODY}`;
    g.fillText(I18n.t('pe sfert de milă, cu reacție'), 66, 878);
    // reperele, ca pe bon
    const t3 = ms => (ms == null ? '–' : `${fmt(ms / 1000, 3)} s`);
    const randuri = [
      ['Reacție', t3(u.reactie)], ['Lansare', I18n.t(LANSARE[u.lans] || '–')], ['0-100 km/h', t3(u.t100)], ['60 ft', t3(u.repere[0])],
      ['1/8 milă', `${t3(u.repere[2])}  ${u.vit[2] != null ? Math.round(u.vit[2] * 3.6) : '–'} km/h`],
      ['1/4 milă', `${t3(u.repere[4])}  ${u.vit[4] != null ? Math.round(u.vit[4] * 3.6) : '–'} km/h`],
      ['Schimbări perfecte', `${u.perf}/${u.sch}`],
    ];
    let y = 935;
    randuri.forEach(([et, v]) => {
      g.fillStyle = '#26262d'; g.fillRect(60, y + 18, W - 120, 2);
      g.textAlign = 'left'; g.fillStyle = '#9aa0a9'; g.font = `700 24px ${BODY}`;
      g.fillText(I18n.t(et).toUpperCase(), 60, y);
      g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.font = `600 30px ${BODY}`;
      g.fillText(v, W - 60, y);
      y += 50;
    });
    g.textAlign = 'center'; g.fillStyle = '#6b7078'; g.font = `500 18px ${BODY}`;
    g.fillText(I18n.t(`Foto: ${car.credit}, ${car.license}`).slice(0, 90), W / 2, H - 70);
    g.font = `500 22px ${BODY}`;
    g.fillText('frincu13.github.io/car-higher-lower/drag', W / 2, H - 34);
    return new Promise(res => { try { cv.toBlob(b => res(b), 'image/png'); } catch { res(null); } });
  }

  async function salveazaBonul() {
    haptic();
    const blob = await bonImagine();
    if (!blob) return;
    const file = new File([blob], `startul-${meci.zi.data}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Înapoi la meniu: Cursa zilei se pune la zi (record nou, serie).
  function laMeniu() {
    meci.zi = null;
    meci.duel = null;
    meci.antrenament = null;
    meci.cupa = null;
    inchideLive();
    if (ONLINE) { cardZi(); cardCupa(); randeazaEchipa(); }
    randeazaMeniuD();
    show('screen-setup');
  }

  // ---------- legături ----------
  // ---------- Cupa de duminică ----------
  // Aceeași mașină pentru toți, intrare 30 mil., trei încercări; contează cel mai bun
  // timp, iar potul (minus 10%) merge la primii trei. Serverul ține tot: intrarea,
  // încercările (consumate de la start) și timpul, refăcut din apăsări.
  const E = window.Economie;
  const cupa = { stare: null };
  async function cardCupa() {
    const el = $('d-cupa');
    if (!window.FrqCloud || !E) return;
    let s;
    if (FrqCloud.areCont()) {
      try { s = await FrqCloud.cupa({ actiune: 'stare' }); } catch { el.hidden = true; return; }
    } else {
      // fără cont nu facem unul la simpla vizită: cupa se socotește aici, potul vine public
      const zi = E.ziua(), dow = E.ziDinSaptamana(zi), deschisa = dow === 0;
      const data = deschisa ? zi : E.laData(zi, 7 - dow);
      let inscrisi = 0;
      try { inscrisi = (await FrqCloud.clasamentCupa(data, 1)).inscrisi || 0; } catch { /* fără pot */ }
      s = { deschisa, data, masina: cheieMasina(masinaZilei(`cupa-${data}`)), intrare: E.CUPA.intrare, incercari: E.CUPA.incercari, inscrisi, pot: E.potCupa(inscrisi), legat: false, eu: null };
    }
    cupa.stare = s;
    const car = dupaCheie(s.masina);
    if (!car) { el.hidden = true; return; }
    el.hidden = false;
    el.className = `drg-zi drg-cupa rar-${rar(car)}`;
    $('d-cupa-f').innerHTML = poza(car);
    wirePhotos($('d-cupa-f'));
    $('d-cupa-t').textContent = s.deschisa ? `Cupa de duminică · azi` : `Cupa de duminică · ${dataLunga(s.data)}`;
    $('d-cupa-m').innerHTML = `<b>${esc(brandOf(car.name))}</b> ${esc(modelOf(car.name) || car.name)}`;
    const bucati = [`Intrare ${mil(s.intrare)}`, `${s.incercari} încercări`];
    if (s.inscrisi) bucati.push(`Pot ${mil(s.pot)}`, s.inscrisi === 1 ? '1 înscris' : `${s.inscrisi} înscriși`);
    else bucati.push('Potul merge la primii 3');
    if (s.eu && s.eu.timp != null) bucati.push(`Tu: ${fmt(s.eu.timp / 1000, 2)} s, locul ${s.eu.loc}`);
    $('d-cupa-s').innerHTML = bucati.map(b => `<span>${esc(b)}</span>`).join('');
    const b = $('d-cupa-go');
    b.dataset.act = '';
    b.disabled = false;
    if (!s.deschisa) { b.textContent = 'Duminică'; b.disabled = true; }
    else if (!s.eu && !s.legat) { b.textContent = 'Leagă garajul'; b.dataset.act = 'leaga'; }
    else if (!s.eu) { b.textContent = `Intră · ${mil(s.intrare)}`; b.dataset.act = 'intra'; }
    else if (s.eu.folosite < s.incercari) {
      const r = s.incercari - s.eu.folosite;
      b.textContent = r === 1 ? 'Aleargă · ultima' : `Aleargă · ${r} rămase`;
      b.dataset.act = 'alearga';
    } else { b.textContent = 'Gata'; b.disabled = true; }
    randeazaMeniuD();
  }
  async function pornesteCupa() {
    const s = cupa.stare;
    try {
      const r = await FrqCloud.cupa({ actiune: 'porneste' });
      const car = dupaCheie(r.masina);
      meci.duel = null;
      meci.antrenament = null;
      meci.cupa = { data: s.data, car, timp: s.eu ? s.eu.timp : null };
      cursaDuel([{ car, nivel: 0 }, { car, nivel: 0 }]);
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      await Shared.intreaba(I18n.t(k === 'fara incercari' ? 'Nu mai ai încercări în cupa asta.' : k === 'inchisa' ? 'Cupa s-a închis.' : 'Cupa nu se poate porni acum.'), { da: 'Bine', nu: '' });
      cardCupa();
    }
  }
  async function finalCupa() {
    const k = meci.cupa, c = cursa.piloti[0];
    const fals = c.fals || c.fin == null;
    const corp = fals ? { actiune: 'cursa', fals: true } : { actiune: 'cursa', apasari: [...c.apasari], tur: [...c.tur] };
    oprestePeTot();
    cursa = null;
    await ecranDuel('incarc');
    try {
      const r = await FrqCloud.cupa(corp);
      const s = await FrqCloud.cupa({ actiune: 'stare' });
      cupa.stare = s;
      ecranDuel('cupa', { cupaRez: { ...r, fals, car: k.car, s } });
    } catch {
      ecranDuel('cupa', { cupaRez: { eroare: true, car: k.car, s: cupa.stare } });
    }
    meci.cupa = null;
  }
  $('d-cupa-go').addEventListener('click', async () => {
    const b = $('d-cupa-go'), act = b.dataset.act;
    if (!act || b.disabled) return;
    haptic();
    if (act === 'leaga') { location.href = 'colectie.html'; return; }
    if (act === 'intra') {
      const s = cupa.stare;
      if (!(await Shared.intreaba(I18n.t('Intri în cupă cu {m}? Ai {n} încercări, contează cel mai bun timp.', { m: mil(s.intrare), n: s.incercari }), { da: 'Intră', nu: 'Nu acum' }))) return;
      b.disabled = true;
      try { await FrqCloud.cupa({ actiune: 'intra' }); }
      catch (e) {
        const k = await FrqCloud.codEroare(e);
        await Shared.intreaba(I18n.t(k === 'bani' ? 'Nu ai destui bani pentru intrare.' : 'Nu s-a putut intra acum.'), { da: 'Bine', nu: '' });
      }
      cardCupa();
      return;
    }
    if (act === 'alearga') { b.disabled = true; pornesteCupa(); }
  });

  // ---------- Startul live: o cursă în doi, în același moment ----------
  // Faci o cameră (clasa și miza), trimiți codul; fiecare își alege mașina din garaj,
  // din clasa aceea. Serverul aprinde luminile la aceeași oră pe ambele telefoane și
  // reface cursa fiecăruia din apăsări; mașina celuilalt o vezi pe pistă din apăsările
  // lui, care vin pe loc (cu LIVE_URMA în urmă, ca să fi ajuns).
  const LIVE_URMA = 700;
  const SL = window.StartulLive;
  const live = { clasa: null, miza: 0, camera: null, joc: null, eu: 0, decalaj: 0, oprire: null, alesa: null };
  const acumServerLive = () => Date.now() + live.decalaj;
  const numeLive = p => (live.camera && live.camera.nume && live.camera.nume[p]) || (live.joc && live.joc.nume && live.joc.nume[p]) || `Jucător ${p + 1}`;
  function liveTrimite(m) { if (meci.live && meci.live.canal) meci.live.canal.trimite(m); }
  function inchideLive() {
    if (meci.live && meci.live.canal) meci.live.canal.opreste();
    meci.live = null;
  }
  async function cereLive(corp) {
    try { return await FrqCloud.camera(corp); } catch (e) { const k = await FrqCloud.codEroare(e); const err = new Error(k || 'retea'); err.cod = k; throw err; }
  }
  const ERORI_LIVE = {
    'cont nelegat': 'Cursele cu miză cer un garaj legat de mail (din Setări).',
    bani: 'Nu ai destui bani pentru miza asta.', camera: 'Nu există nicio cameră cu codul ăsta.',
    stare: 'Camera a început deja sau s-a închis.', clasa: 'Mașina nu e din clasa camerei.', masina: 'Mașina nu e în garajul tău.',
  };
  function primesteLive(r) {
    if (r.acum) live.decalaj = r.acum - Date.now();
    live.camera = r.camera;
    live.eu = r.eu;
    if (r.joc) live.joc = r.joc;
    pasLive();
  }
  async function stareLive() {
    if (!live.camera) return;
    try { primesteLive(await cereLive({ actiune: 'stare', id: live.camera.id })); } catch { /* data viitoare */ }
  }
  async function ascultaLive(id) {
    if (live.oprire) live.oprire();
    try {
      live.oprire = await FrqCloud.ascultaCamera(id, rand => {
        if (!live.camera || rand.v <= (live.camera.v || 0)) return;
        live.camera = { ...live.camera, v: rand.v, stare: rand.stare, revansa: [!!rand.revansa_a, !!rand.revansa_b] };
        if (rand.public && rand.public.faza && rand.public.faza !== 'asteapta') live.joc = rand.public;
        if (rand.stare === 'joc' && !live.camera.nume?.[1]) stareLive();   // a intrat celălalt: îi aflăm numele
        else pasLive();
      });
    } catch { live.oprire = null; }
  }
  // Ce pagină se vede, după starea camerei. În cursă nu se schimbă nimic din afară.
  function pasLive() {
    if (cursa && meci.live) return;
    const c = live.camera, s = live.joc;
    if (!c) return;
    if (c.stare === 'anulata') { ecranDuel('live', { eroare: 'Camera s-a închis.' }); return; }
    if (c.stare === 'asteapta' || !s) { ecranDuel('live-asteapta'); return; }
    if (s.faza === 'alege') {
      // garajul se reîncarcă la fiecare alegere (revanșă, lăzi deschise între timp)
      if (dl.pas !== 'live-alege') incarcaGarajDl().catch(() => {}).then(() => { if (live.joc && live.joc.faza === 'alege') ecranDuel('live-alege'); });
      else ecranDuel('live-alege');
      return;
    }
    if (s.faza === 'cursa') { pornesteLive(); return; }
    if (s.faza === 'final') ecranDuel('live-rez');
  }
  // Numărătoarea până la lumini, apoi cursa (cu luminile la ora serverului).
  function pornesteLive() {
    const s = live.joc, eu = live.eu;
    if (s.curse && s.curse[eu]) { ecranDuel('live-rez'); return; }   // am alergat deja
    const mea = MD.dupaCheie(s.masini[eu]), alt = MD.dupaCheie(s.masini[1 - eu]);
    if (!mea || !alt) return;
    meci.duel = null; meci.antrenament = null; meci.cupa = null;
    inchideLive();
    meci.live = { id: live.camera.id, joc: s, plan: [], lc: null, trimise: 0, trimisa: false, advNume: numeLive(1 - eu), canal: null };
    const m = meci.live;
    FrqCloud.canalLive(live.camera.id, msg => {
      if (meci.live !== m) return;
      if (msg.tip === 'a' && Number.isInteger(msg.i)) m.plan[msg.i] = msg.t;
      if (msg.tip === 'lc') {
        m.lc = msg.v;
        const el = cursa && cursa.piloti[1];
        if (el && el.auto) { el.auto.lc = msg.v; if (cursa.blocat) { el.r = el.lc = msg.v; } }
      }
      if (msg.tip === 'fals' && cursa) { const el = cursa.piloti[1]; el.fals = true; $('d-half-1').classList.add('is-false'); }
    }).then(canal => { m.canal = canal; });
    cursaDuel([{ car: mea, nivel: s.nivele[eu] }, { car: alt, nivel: s.nivele[1 - eu] }]);
    // luminile la ora serverului (aceeași pe ambele telefoane)
    const peste = Math.max(0, s.startLa - acumServerLive());
    $('d-nr').textContent = 'Live';
    cursa.ceasuri.push(setTimeout(() => { if (cursa && cursa.faza === 'arm' && meci.live === m) lumini(); }, peste));
  }
  async function trimiteCursaLive(fals = false) {
    const m = meci.live;
    if (!m || m.trimisa) return;
    m.trimisa = true;
    const c = cursa && cursa.piloti[0];
    const corp = fals || !c || c.fals || c.fin == null ? { tip: 'cursa', fals: true } : { tip: 'cursa', apasari: [...c.apasari], tur: [...c.tur] };
    try { primesteLiveTacit(await cereLive({ actiune: 'muta', id: m.id, mutare: corp })); } catch { /* serverul o închide la termen */ }
  }
  // starea nouă, fără să schimbe ecranul (suntem încă pe pistă)
  function primesteLiveTacit(r) { if (r.acum) live.decalaj = r.acum - Date.now(); live.camera = r.camera; if (r.joc) live.joc = r.joc; }
  async function finalLive() {
    oprestePeTot();
    cursa = null;
    inchideLive();
    await stareLive();
    ecranDuel('live-rez');
  }
  async function deschideLive() {
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    const clase = echipaEfectiva().filter(x => x.g).map(x => x.clasa);
    if (live.clasa == null || !clase.includes(live.clasa)) live.clasa = clase.length ? clase[clase.length - 1] : null;
    ecranDuel('live');
  }
  async function intraLive(cod) {
    await ecranDuel('incarc');
    try {
      await incarcaGarajDl().catch(() => {});
      const r = await cereLive({ actiune: 'intra', cod });
      await deschideCameraLive(r.id);
    } catch (e) { ecranDuel('live', { eroare: ERORI_LIVE[e.cod] || 'Nu s-a putut intra acum.' }); }
  }
  async function deschideCameraLive(id) {
    const r = await cereLive({ actiune: 'stare', id });
    live.alesa = null;
    primesteLive(r);
    await ascultaLive(id);
  }
  // întors în pagină cu alegerea deschisă (poate din Garajul meu, cu lăzi noi): garajul de acum
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dl.pas === 'live-alege' && !(cursa && meci.live)) incarcaGarajDl().then(() => ecranDuel('live-alege')).catch(() => {});
  });
  // termenele (alegerea mașinii, cursa): când trec, cerem starea și serverul le aplică
  setInterval(() => {
    if (!live.camera || live.camera.stare === 'gata' || (cursa && meci.live)) return;
    if (dl.pas && dl.pas.startsWith('live')) stareLive();
  }, 5000);

  function randeazaLive(el, err) {
    const s = live.joc, c = live.camera, eu = live.eu;
    if (dl.pas === 'live') {
      if (!dl.legat && live.miza > 0) live.miza = 0;
      const toate = echipaEfectiva();
      el.innerHTML = `<p class="drg-dl-titlu"><b>Cursă live</b></p>
        <p class="drg-dl-nota">O cursă în doi, în același moment, fiecare pe telefonul lui, cu mașinile din garaj. Alegi clasa și miza, apoi îi trimiți codul prietenului.</p>
        <p class="drg-line-t">Clasa</p>
        <div class="drg-dl-mize">${toate.map(x => `<button type="button" data-live-clasa="${x.clasa}" class="${live.clasa === x.clasa ? 'is-on' : ''}"${x.g ? '' : ' disabled'}>${CLASE[x.clasa]}</button>`).join('')}</div>
        <p class="drg-line-t">Miza</p>
        <div class="drg-dl-mize">${[0, 10, 25, 50].map(v => `<button type="button" data-live-miza="${v}" class="${live.miza === v ? 'is-on' : ''}"${v && !dl.legat ? ' disabled' : ''}>${v ? esc(mil(v)) : 'Fără'}</button>`).join('')}</div>
        ${err}
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="live-fa"${live.clasa == null ? ' disabled' : ''}>Fă camera</button></div>
        <p class="drg-line-t">Ai un cod?</p>
        <form class="drg-dl-cod" id="d-live-cod"><input maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Cod cameră" aria-label="Cod cameră"><button class="btn btn-ghost" type="submit">Intră</button></form>`;
      return;
    }
    if (dl.pas === 'live-asteapta') {
      el.innerHTML = `<p class="drg-dl-titlu"><b>Cursă live</b></p>
        <p class="drg-dl-nota">Trimite codul prietenului. Cursa pornește după ce intră și vă alegeți mașinile.</p>
        <p class="drg-dl-cod-mare" aria-label="Codul camerei">${esc(c.cod)}</p>
        <p class="drg-dl-nota">Clasa ${CLASE[(c.optiuni && c.optiuni.clasa) || 0]} · ${c.miza ? `${esc(mil(c.miza))} fiecare` : 'fără miză'}</p>
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="live-trimite">Trimite linkul</button>
        <button class="btn btn-ghost" type="button" data-act="live-inchide">Închide camera</button></div>${err}`;
      return;
    }
    if (dl.pas === 'live-alege') {
      const din = dl.garaj.filter(g => clasaG(g) === s.clasa);
      if (live.alesa == null || !din.some(g => g.masina === live.alesa)) {
        const ef = echipaEfectiva()[s.clasa];
        live.alesa = ef && ef.g ? ef.g.masina : din[0] && din[0].masina;
      }
      const a = s.masini[eu], b = s.masini[1 - eu];
      el.innerHTML = `<p class="drg-dl-titlu"><b>${esc(numeLive(0))}</b> vs <b>${esc(numeLive(1))}</b></p>
        <p class="drg-dl-nota">Clasa ${CLASE[s.clasa]}${s.miza || c.miza ? ` · ${esc(mil(c.miza))} fiecare` : ''}. ${b ? `${esc(numeLive(1 - eu))} și-a ales mașina.` : `${esc(numeLive(1 - eu))} își alege mașina…`}</p>
        ${a ? masinaMare(a, 'Mașina ta', s.nivele[eu]) + '<p class="drg-dl-nota">Gata. Cursa pornește când își alege și el mașina.</p>'
          : `${din.length ? `<div class="drg-dl-grid">${din.map(g => cardMasinaDl(g).replace('is-sel', '').replace(`data-m="${esc(g.masina)}"`, `data-live-m="${esc(g.masina)}"`).replace('class="drg-dl-m', `class="drg-dl-m${live.alesa === g.masina ? ' is-sel' : ''}`)).join('')}</div>`
            : `<p class="drg-dl-nota">Nu ai nicio mașină din clasa asta în garaj.</p>`}
            ${err}<div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="live-gata"${live.alesa ? '' : ' disabled'}>Gata</button></div>`}`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'live-rez') {
      const r = s && s.rezultat;
      if (!r) {
        el.innerHTML = `<p class="drg-dl-titlu"><b>Aștepți rezultatul</b></p><p class="drg-dl-nota">${esc(numeLive(1 - eu))} n-a terminat încă cursa.</p>`;
        return;
      }
      const t = ms => (ms == null ? '–' : `${fmt(ms / 1000, 3)} s`);
      const titlu = r.win === -1 ? 'Egal' : r.win === eu ? 'Ai câștigat' : `Câștigă ${numeLive(r.win)}`;
      const premiu = c.miza ? (r.win === -1 ? `Fiecare își ia înapoi miza de ${mil(c.miza)}` : r.win === eu ? `+${mil(2 * c.miza - Math.floor(2 * c.miza * 0.1))}` : `Miza de ${mil(c.miza)} e a lui ${numeLive(r.win)}`) : '';
      const rv = c.revansa || [false, false];
      const rev = rv[eu] ? `<p class="drg-dl-nota">Aștepți să accepte ${esc(numeLive(1 - eu))}.</p>`
        : rv[1 - eu] ? `<p class="drg-dl-nota"><b>${esc(numeLive(1 - eu))}</b> vrea revanșă.</p><button class="btn btn-primary" type="button" data-act="live-revansa">Accept revanșa</button>`
        : '<button class="btn btn-primary" type="button" data-act="live-revansa">Revanșă</button>';
      el.innerHTML = `<p class="drg-dl-titlu ${r.win === eu ? 'is-win' : ''}"><b>${esc(titlu)}</b></p>${premiu ? `<p class="drg-dl-nota">${esc(premiu)}</p>` : ''}
        <table class="drg-stat"><tbody>${[0, 1].map(p => `<tr><th>${esc(p === eu ? 'Tu' : numeLive(p))}</th><td class="${r.win === p ? 'is-win' : ''}">${r.falsuri[p] ? 'Start fals' : esc(t(r.timpi[p]))}</td></tr>`).join('')}</tbody></table>
        ${err}<div class="drg-dl-act">${rev}<button class="btn btn-ghost" type="button" data-act="live-nou">Cameră nouă</button><button class="btn btn-ghost" type="button" data-act="meniu">Meniu</button></div>`;
    }
  }

  // ---------- dueluri cu miză ----------
  // Fiecare aleargă pe telefonul lui, o singură dată: A își alege tipul (pe bani sau
  // pe acte), miza și mașina din garaj, aleargă și primește un cod; B îl deschide,
  // pune o mașină de aceeași raritate și aleargă contra fantomei lui A. Serverul
  // reface ambele curse din apăsări și mută banii sau mașina.
  const MIZE = [5, 10, 25, 50, 100];
  // Duel rapid: serverul alege adversarul (aceeași clasă, aceeași miză), deci doar
  // acestea intră în clasamentul zilei. Câteva mize fixe, ca să se găsească ușor.
  const MIZE_RAPID = [5, 10, 25, 50, 100];
  const COMISION = m => Math.floor(2 * m * 0.1);
  const ERORI_DUEL = {
    'cont nelegat': 'Duelurile cu miză cer un garaj legat de mail.',
    bani: 'Nu ai destui bani pentru miza asta.',
    blocata: 'Mașina e pusă deja în alt duel.',
    raritate: 'Trebuie o mașină de aceeași raritate.',
    stare: 'Duelul nu mai e deschis.',
    'al tau': 'E duelul tău.',
    duel: 'Nu există niciun duel cu codul ăsta.',
    masina: 'Mașina nu mai e în garajul tău.',
    'prea multe': 'Ai deja 3 dueluri rapide care așteaptă adversar.',
  };
  const dl = { pas: null, tip: 'bani', miza: 5, mizaRapid: 5, clasaRapid: null, alese: new Map(), masina: null, garaj: [], portofel: null, legat: true, vezi: null, rez: null, ale: null, eroare: '', creat: null };
  const linkDuel = cod => `${location.origin}${location.pathname}?duel=${cod}`;
  // clasa = raritatea timpului după tuning; duelurile se fac între mașini din aceeași clasă
  const clasaG = g => { const c = MD.dupaCheie(g.masina); return c ? M.clasa(c, g.nivel || 0) : -1; };
  const cardMasinaDl = (g, { dezactivat = false, nota = '' } = {}) => {
    const c = MD.dupaCheie(g.masina);
    if (!c) return '';
    const k = clasaG(g), niv = g.nivel || 0;
    return `<button type="button" class="drg-dl-m rar-${k}${dl.masina === g.masina ? ' is-sel' : ''}" data-m="${esc(g.masina)}"${dezactivat ? ' disabled' : ''}>
      <span class="drg-dl-mf">${poza(c)}${niv ? `<i class="drg-dl-niv">Nv ${niv}</i>` : ''}</span><b>${esc(modelOf(c.name) || c.name)}</b>
      <small>${pi(c, niv)}${recordText(g.masina)}${nota ? ` &middot; ${esc(nota)}` : ''}</small></button>`;
  };
  const masinaMare = (cheie, eticheta, nivel = 0) => {
    const c = MD.dupaCheie(cheie);
    if (!c) return '';
    const k = M.clasa(c, nivel);
    return `<div class="drg-dz-k rar-${k} drg-dl-mare"><span class="drg-dz-f">${poza(c)}</span><span class="drg-dz-j">${esc(eticheta)}</span>
      <span class="drg-dz-r">Clasa ${CLASE[k]}${nivel ? ` &middot; nivel ${nivel}` : ''}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))} &middot; ${pi(c, nivel)}${recordText(cheie)}</small></div>`;
  };
  // recordul tău cu o mașină (din curse verificate pe server), lângă scor
  const recordText = k => { const t = dl.recorduri && dl.recorduri.get(k); return t ? ` &middot; record ${fmt(t / 1000, 2)} s` : ''; };
  async function incarcaGarajDl() {
    FrqCloud.recorduri().then(m => { dl.recorduri = m; }).catch(() => {});
    const [r, eu] = await Promise.all([FrqCloud.portofel(), FrqCloud.cineSunt()]);
    dl.portofel = r.portofel;
    const timpG = g => M.timpTunat(MD.dupaCheie(g.masina), g.nivel || 0);
    dl.garaj = (r.garaj || []).filter(g => MD.dupaCheie(g.masina)).sort((a, b) => timpG(a) - timpG(b));
    dl.legat = !!eu && !eu.anonim;
    dl.alese = new Map((r.echipa || []).map(x => [x.clasa, x.masina]));
  }

  // ---------- echipa: câte o mașină pe clasă ----------
  // Ce ai ales tu, dacă mașina e încă în garaj și în clasa aceea (tuning-ul o poate
  // muta); altfel cea mai rapidă din clasa aceea. Duelul rapid pornește direct cu ea.
  function echipaEfectiva() {
    return [0, 1, 2, 3, 4].map(k => {
      const din = dl.garaj.filter(g => clasaG(g) === k);
      const ales = din.find(g => g.masina === dl.alese.get(k));
      const g = ales || din.find(x => !x.blocat) || din[0] || null;
      return { clasa: k, g, ales: !!ales, cate: din.length };
    });
  }
  async function randeazaEchipa() {
    const el = $('d-echipa');
    if (!window.FrqCloud || !FrqCloud.areCont()) { el.innerHTML = ''; return; }
    try { await incarcaGarajDl(); } catch { el.innerHTML = ''; return; }
    if (!dl.garaj.length) { el.innerHTML = '<a class="drg-echipa-gol" href="colectie.html">Garajul e gol. Deschide o ladă în Garajul meu.</a>'; return; }
    randeazaMeniuD();
    el.innerHTML = `<p class="drg-line-t">Echipa ta</p><div class="drg-echipa-r">${echipaEfectiva().map(x => {
      const c = x.g && MD.dupaCheie(x.g.masina);
      return `<button type="button" class="drg-echipa-s rar-${x.clasa}" data-echipa="${x.clasa}"${x.cate ? '' : ' disabled'}>
        <span class="drg-echipa-f">${c ? poza(c) : ''}</span>
        <small>Clasa ${CLASE[x.clasa]}</small><b>${c ? esc(modelOf(c.name) || c.name) : '–'}</b></button>`;
    }).join('')}</div>`;
    wirePhotos(el);
  }
  $('d-echipa').addEventListener('click', async e => {
    const b = e.target.closest('[data-echipa]');
    if (!b || b.disabled) return;
    haptic();
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    ecranDuel('echipa', { echipaClasa: +b.dataset.echipa, inapoi: 'meniu' });
  });
  async function ecranDuel(pas, extra = {}) {
    Object.assign(dl, { pas, eroare: '' }, extra);
    show('screen-duel');
    randeazaDuel();
  }
  const cerLegare = () => `<p class="drg-dl-nota">Duelurile cu miză cer un garaj legat de mail, ca nimeni să nu-și facă conturi noi ca să-și treacă bani sau mașini.</p>
    <a class="btn btn-primary" href="colectie.html">Leagă-ți garajul</a>`;
  function randeazaDuel() {
    const el = $('d-dl-in');
    const err = dl.eroare ? `<p class="drg-dl-err" role="alert">${esc(dl.eroare)}</p>` : '';
    if (dl.pas === 'incarc') { el.innerHTML = '<p class="drg-dl-nota">Se încarcă</p>'; return; }
    if (dl.pas === 'nou') {
      if (!dl.legat) { el.innerHTML = cerLegare(); return; }
      if (!dl.garaj.length) { el.innerHTML = `<p class="drg-dl-nota">Nu ai încă mașini în garaj. Deschide o ladă și vino înapoi.</p><a class="btn btn-primary" href="colectie.html">Garajul meu</a>`; return; }
      const bani = dl.portofel ? dl.portofel.mil : 0;
      el.innerHTML = `
        <div class="drg-runde"><span>Miză</span><div class="drg-seg" role="radiogroup" aria-label="Miză">
          ${['bani', 'acte'].map(t => `<button type="button" role="radio" data-tip="${t}" aria-checked="${dl.tip === t}">${t === 'bani' ? 'Pe bani' : 'Pe acte'}</button>`).join('')}</div></div>
        ${dl.tip === 'bani'
          ? `<div class="drg-dl-mize">${MIZE.map(m => `<button type="button" data-miza="${m}" class="${dl.miza === m ? 'is-on' : ''}"${m > bani ? ' disabled' : ''}>${esc(mil(m))}</button>`).join('')}</div>
             <p class="drg-dl-nota">Ai ${esc(mil(bani))} Câștigătorul ia ${esc(mil(2 * dl.miza - COMISION(dl.miza)))} (miza amândurora, minus 10%).</p>`
          : `<p class="drg-dl-nota drg-dl-acte">Pe acte: dacă pierzi, mașina ta e a lui. El pune o mașină de aceeași raritate.</p>`}
        <p class="drg-line-t">Mașina ta</p>
        <div class="drg-dl-grid">${dl.garaj.map(g => cardMasinaDl(g, { dezactivat: g.blocat, nota: g.blocat ? 'în alt duel' : '' })).join('')}</div>
        ${err}
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="alearga"${dl.masina && (dl.tip === 'acte' || dl.miza <= bani) ? '' : ' disabled'}>Alergă</button></div>
        <p class="drg-dl-nota">Alergi o singură dată, iar miza se blochează de la start. Dacă ieși din cursă, duelul se anulează cu o taxă.</p>`;
      wirePhotos(el);
      return;
    }
    if (dl.pas && dl.pas.startsWith('live')) { randeazaLive(el, err); return; }
    if (dl.pas === 'echipe') {
      const toate = echipaEfectiva();
      el.innerHTML = `<p class="drg-dl-titlu"><b>Echipa ta</b></p>
        <p class="drg-dl-nota">O mașină pentru fiecare clasă: cu ea alergi în duelurile din clasa aceea. Atinge o clasă ca s-o schimbi.</p>
        <div class="drg-echipa-r cam-echipe">${toate.map(x => {
          const c = x.g && MD.dupaCheie(x.g.masina);
          return `<button type="button" class="drg-echipa-s rar-${x.clasa}" data-echipa-l="${x.clasa}"${x.cate ? '' : ' disabled'}>
            <span class="drg-echipa-f">${c ? poza(c) : ''}</span>
            <small>Clasa ${CLASE[x.clasa]}</small><b>${c ? esc(modelOf(c.name) || c.name) : '–'}</b></button>`;
        }).join('')}</div>
        ${dl.garaj.length ? '' : '<p class="drg-dl-nota">Garajul e gol.</p><a class="btn btn-primary drg-gol-cta" href="colectie.html#lazi">Deschide o ladă</a>'}`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'cod') {
      el.innerHTML = `<p class="drg-dl-titlu"><b>Am un cod</b></p>
        <p class="drg-dl-nota">Codul de 6 litere primit de la un prieten.</p>
        <form class="drg-dl-cod" id="d-dl-cod2"><input maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Cod duel" aria-label="Cod duel"><button class="btn btn-primary" type="submit">Intră</button></form>${err}`;
      el.querySelector('input').focus();
      return;
    }
    if (dl.pas === 'cupa-info') {
      const s = cupa.stare;
      const car = s && dupaCheie(s.masina);
      const b = $('d-cupa-go');
      el.innerHTML = `<p class="drg-dl-titlu"><b>Cupa de duminică</b></p>
        ${car ? masinaMare(s.masina, s.deschisa ? 'Azi' : dataLunga(s.data)) : ''}
        <p class="drg-dl-nota">Aceeași mașină pentru toți, intrare ${esc(mil(s ? s.intrare : 10))}, ${s ? s.incercari : 3} încercări; contează cel mai bun timp. Potul (intrările minus 10%) merge la primii trei: 50, 30 și 20%.</p>
        ${s && s.inscrisi ? `<p class="drg-dl-nota">${s.inscrisi === 1 ? '1 înscris' : `${s.inscrisi} înscriși`} · pot ${esc(mil(s.pot))}${s.eu && s.eu.timp != null ? ` · tu: ${esc(fmt(s.eu.timp / 1000, 2))} s, locul ${s.eu.loc}` : ''}</p>` : ''}
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="cupa-go"${b.disabled || !b.dataset.act ? ' disabled' : ''}>${esc(b.textContent)}</button></div>`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'echipa') {
      const k = dl.echipaClasa;
      const din = dl.garaj.filter(g => clasaG(g) === k);
      const ef = echipaEfectiva()[k];
      el.innerHTML = `<p class="drg-dl-titlu"><b>Clasa ${CLASE[k]}</b></p>
        <p class="drg-dl-nota">Mașina cu care alergi în duelurile din clasa asta.</p>
        <div class="drg-dl-grid">${din.map(g => cardMasinaDl(g, { nota: ef.g && ef.g.masina === g.masina ? 'în echipă' : g.blocat ? 'în alt duel' : '' })).join('')}</div>
        ${err}
        <div class="drg-dl-act"><button class="btn btn-ghost" type="button" data-act="echipa-gata">Înapoi</button></div>`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'rapid') {
      if (!dl.legat) { el.innerHTML = cerLegare(); return; }
      if (!dl.garaj.length) { el.innerHTML = `<p class="drg-dl-nota">Nu ai încă mașini în garaj. Deschide o ladă și vino înapoi.</p><a class="btn btn-primary" href="colectie.html">Garajul meu</a>`; return; }
      const bani = dl.portofel ? dl.portofel.mil : 0, m = dl.mizaRapid;
      const echipa = echipaEfectiva().filter(x => x.g);
      if (!echipa.some(x => x.clasa === dl.clasaRapid)) dl.clasaRapid = (echipa.find(x => !x.g.blocat) || echipa[0]).clasa;
      const sel = echipa.find(x => x.clasa === dl.clasaRapid);
      dl.masina = sel && !sel.g.blocat ? sel.g.masina : null;
      el.innerHTML = `<p class="drg-dl-titlu"><b>Duel rapid</b></p>
        <div class="drg-dl-mize">${MIZE_RAPID.map(x => `<button type="button" data-miza-r="${x}" class="${m === x ? 'is-on' : ''}"${x > bani ? ' disabled' : ''}>${esc(mil(x))}</button>`).join('')}</div>
        <p class="drg-dl-nota">Ai ${esc(mil(bani))} Câștigătorul ia ${esc(mil(2 * m - COMISION(m)))} Adversarul îl alege serverul, din aceeași clasă și cu aceeași miză.</p>
        <p class="drg-line-t">Clasa</p>
        <div class="drg-dl-grid">${echipa.map(x => cardMasinaDl(x.g, { nota: x.g.blocat ? 'în alt duel' : '' }).replace(' data-m="', ` data-clasa-r="${x.clasa}" data-x="`).replace('is-sel', '').replace('class="drg-dl-m', `class="drg-dl-m${x.clasa === dl.clasaRapid ? ' is-sel' : ''}`)).join('')}</div>
        <div class="drg-dl-act"><button class="btn btn-ghost" type="button" data-act="schimba">Altă mașină în clasa asta</button></div>
        ${err}
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="rapid"${dl.masina && m <= bani ? '' : ' disabled'}>Găsește adversar</button></div>
        <p class="drg-dl-nota">Dacă cineva a alergat deja, alergi contra cursei lui. Dacă nu, alergi tu primul și primul venit aleargă contra ta. Ieșirea din cursă e start fals.</p>`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'creat' && dl.creat.rapid) {
      const k = dl.creat;
      el.innerHTML = `<p class="drg-dl-titlu"><b>${esc(fmt(k.timp / 1000, 3))} s</b></p>
        <p class="drg-dl-nota">Cursa ta așteaptă adversar: primul care vine cu o mașină din aceeași clasă și miza de ${esc(mil(k.miza))} aleargă contra ei. Dacă nu vine nimeni în 24 de ore, miza se întoarce la tine.</p>
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="rapid-iar">Încă un duel rapid</button>
        <button class="btn btn-ghost" type="button" data-act="ale">Duelurile mele</button></div>${err}`;
      return;
    }
    if (dl.pas === 'creat') {
      const k = dl.creat;
      el.innerHTML = `<p class="drg-dl-nota">Ai făcut ${esc(fmt(k.timp / 1000, 3))} s. Trimite codul cuiva: are 24 de ore să-l accepte.</p>
        <p class="drg-dl-cod-mare" aria-label="Codul duelului">${esc(k.cod)}</p>
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="trimite-cod">Trimite linkul</button>
        <button class="btn btn-ghost" type="button" data-act="anuleaza" data-id="${esc(k.id)}">Anulează duelul</button></div>
        <p class="drg-dl-nota">Miza rămâne blocată până se termină duelul. Rezultatul îl vezi în Duelurile mele.</p>${err}`;
      return;
    }
    if (dl.pas === 'vezi') {
      const v = dl.vezi;
      const miza = v.tip === 'acte' ? 'Pe acte: cine pierde își dă mașina' : `Pe bani: ${mil(v.miza)} fiecare, câștigătorul ia ${mil(2 * v.miza - COMISION(v.miza))}`;
      const potrivite = dl.garaj.filter(g => clasaG(g) === v.clasa);
      let jos;
      if (v.al_meu) jos = '<p class="drg-dl-nota">E duelul tău. Trimite codul cuiva.</p>';
      else if (v.stare !== 'deschis') jos = '<p class="drg-dl-nota">Duelul nu mai e deschis.</p>';
      else if (!dl.legat) jos = cerLegare();
      else if (!potrivite.length) jos = `<p class="drg-dl-nota">Ai nevoie de o mașină din clasa ${CLASE[v.clasa]}. O poți și tuna până acolo.</p><a class="btn btn-primary" href="colectie.html">Garajul meu</a>`;
      else {
        jos = `<p class="drg-line-t">Mașina ta (clasa ${CLASE[v.clasa]})</p>
          <div class="drg-dl-grid">${potrivite.map(g => cardMasinaDl(g, { dezactivat: g.blocat, nota: g.blocat ? 'în alt duel' : '' })).join('')}</div>
          ${err}<div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="accepta"${dl.masina ? '' : ' disabled'}>Acceptă și alergă</button></div>
          <p class="drg-dl-nota">Alergi o singură dată, contra fantomei lui ${esc(v.nume_a)}. Dacă ieși din cursă, pierzi.</p>`;
      }
      el.innerHTML = `<p class="drg-dl-titlu"><b>${esc(v.nume_a)}</b> te provoacă</p><p class="drg-dl-nota">${esc(miza)}</p>${masinaMare(v.masina_a, v.nume_a, v.nivel_a)}${jos}`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'rezultat') {
      const r = dl.rez, d = r.duel;
      let titlu, sub = '';
      if (r.egal) { titlu = 'Egal'; sub = 'Fiecare își ia miza înapoi.'; }
      else if (r.castigat) {
        titlu = 'Ai câștigat';
        sub = d.tip === 'acte' ? `${(MD.dupaCheie(r.masina_a) || {}).name || ''} e acum în garajul tău.` : `+${mil(2 * d.miza - COMISION(d.miza))}`;
      } else {
        titlu = r.fals ? 'Start fals' : 'Ai pierdut';
        sub = d.tip === 'acte' ? `${(MD.dupaCheie(r.masina_b) || {}).name || ''} e acum a lui ${d.adv.nume}.` : `Miza de ${mil(d.miza)} e a lui ${d.adv.nume}.`;
      }
      const t = ms => (ms == null ? '–' : `${fmt(ms / 1000, 3)} s`);
      el.innerHTML = `<p class="drg-dl-titlu ${r.castigat ? 'is-win' : ''}"><b>${esc(titlu)}</b></p><p class="drg-dl-nota">${esc(sub)}</p>
        <table class="drg-stat"><tbody>
          <tr><th>${esc(d.adv.nume)}</th><td>${esc(t(r.timp_a))}</td></tr>
          <tr><th>Tu</th><td class="${r.castigat ? 'is-win' : ''}">${esc(t(r.timp_b))}</td></tr>
        </tbody></table>
        <div class="drg-dl-act">${d.rapid ? '<button class="btn btn-primary" type="button" data-act="rapid-iar">Încă un duel rapid</button>' : ''}<button class="btn ${d.rapid ? 'btn-ghost' : 'btn-primary'}" type="button" data-act="ale">Duelurile mele</button><button class="btn btn-ghost" type="button" data-act="meniu">Meniu</button></div>`;
      return;
    }
    if (dl.pas === 'antrenament') {
      if (!dl.garaj.length) { el.innerHTML = `<p class="drg-dl-nota">Nu ai încă mașini în garaj. Deschide o ladă și vino înapoi.</p><a class="btn btn-primary" href="colectie.html">Garajul meu</a>`; return; }
      const ar = dl.antrRez, arC = ar && MD.dupaCheie(ar.masina);
      el.innerHTML = `${arC ? `<p class="drg-dl-nota drg-antr-rez"><b>${esc(modelOf(arC.name) || arC.name)}</b>: ${fmt(ar.timp / 1000, 3)} s${ar.record ? ' · <span class="col-noua">Record nou</span>' : ''}</p>` : ''}
        <p class="drg-dl-nota">Alergi cu o mașină din garaj contra lui FRQ Bot, cu aceeași mașină. Fără miză, de câte ori vrei: îi afli timpii și vezi ce face tuning-ul.</p>
        <div class="drg-dl-grid">${dl.garaj.map(g => cardMasinaDl(g)).join('')}</div>
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="antreneaza"${dl.masina ? '' : ' disabled'}>Alergă</button>
        <a class="btn btn-ghost" href="colectie.html">Tunează în garaj</a></div>`;
      wirePhotos(el);
      return;
    }
    if (dl.pas === 'cupa') {
      const r = dl.cupaRez, s = r.s || {};
      const ramase = s.eu ? s.incercari - s.eu.folosite : 0;
      const t = ms => (ms == null ? '–' : `${fmt(ms / 1000, 3)} s`);
      const titlu = r.eroare ? 'Cursa nu s-a putut trimite' : r.fals ? 'Start fals' : r.record ? 'Cel mai bun timp al tău' : t(r.timp);
      el.innerHTML = `<p class="drg-dl-titlu ${r.record ? 'is-win' : ''}"><b>${esc(titlu)}</b></p>
        <table class="drg-stat"><tbody>
          ${r.timp != null ? `<tr><th>Cursa asta</th><td>${esc(t(r.timp))}</td></tr>` : ''}
          <tr><th>Cel mai bun</th><td class="is-win">${esc(t(s.eu ? s.eu.timp : null))}</td></tr>
          ${s.eu && s.eu.loc ? `<tr><th>Locul</th><td>${s.eu.loc} din ${s.inscrisi}</td></tr>` : ''}
          <tr><th>Potul</th><td>${esc(mil(s.pot || 0))}</td></tr>
        </tbody></table>
        <p class="drg-dl-nota">${ramase > 0 ? (ramase === 1 ? 'Mai ai o încercare.' : `Mai ai ${ramase} încercări.`) : 'Ți-ai folosit încercările. Premiile se dau luni.'}</p>
        <div class="drg-dl-act">${ramase > 0 ? '<button class="btn btn-primary" type="button" data-act="cupa-iar">Încă o încercare</button>' : ''}<button class="btn ${ramase > 0 ? 'btn-ghost' : 'btn-primary'}" type="button" data-act="meniu">Meniu</button></div>`;
      return;
    }
    if (dl.pas === 'anulat') {
      el.innerHTML = `<p class="drg-dl-titlu"><b>Start fals</b></p><p class="drg-dl-nota">Duelul s-a anulat, cu taxa de abandon.</p>
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="nou">Duel nou</button><button class="btn btn-ghost" type="button" data-act="meniu">Meniu</button></div>`;
      return;
    }
    if (dl.pas === 'ale') {
      const STARE = {
        pregatit: 'În cursă', deschis: 'Așteaptă adversar', acceptat: 'Adversarul aleargă', anulat: 'Anulat', expirat: 'Neacceptat',
      };
      const rand = d => {
        const c = MD.dupaCheie(d.masina_mea), lui = d.masina_lui && MD.dupaCheie(d.masina_lui);
        let rez = STARE[d.stare] || '';
        if (d.stare === 'incheiat') {
          rez = d.castigat ? (d.tip === 'acte' ? `Câștigat: ${lui ? modelOf(lui.name) || lui.name : ''}` : `Câștigat: +${mil(2 * d.miza - COMISION(d.miza))}`)
            : d.pierdut ? (d.tip === 'acte' ? `Pierdut: ${c ? modelOf(c.name) || c.name : ''}` : `Pierdut: ${mil(d.miza)}`) : 'Egal';
        }
        const cls = d.castigat ? 'is-win' : d.pierdut ? 'is-loss' : '';
        return `<li class="${cls}"><span class="drg-dl-r-t">${d.tip === 'acte' ? 'Pe acte' : esc(mil(d.miza))}</span>
          <span class="drg-dl-r-n"><b>${esc(c ? modelOf(c.name) || c.name : '')}</b><small>${d.lui ? `vs ${esc(d.lui)}` : d.rapid ? 'rapid' : `cod ${esc(d.cod)}`}</small></span>
          <span class="drg-dl-r-s">${esc(rez)}${d.stare === 'deschis' && d.eu_a ? ` <button type="button" class="drg-dl-mic" data-act="anuleaza" data-id="${esc(d.id)}">Anulează</button>` : ''}</span></li>`;
      };
      el.innerHTML = `${err}${dl.ale && dl.ale.length ? `<ol class="drg-dl-lista">${dl.ale.map(rand).join('')}</ol>` : '<p class="drg-dl-nota">Niciun duel încă.</p>'}
        <div class="drg-dl-act"><button class="btn btn-primary" type="button" data-act="rapid-iar">Duel rapid</button><button class="btn btn-ghost" type="button" data-act="nou">Cu un prieten</button></div>`;
      return;
    }
  }

  async function deschideNou() {
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    dl.masina = null;
    ecranDuel('nou');
  }
  async function alegeInEchipa(masina) {
    try {
      const r = await FrqCloud.echipa(dl.echipaClasa, masina);
      dl.alese = new Map((r.echipa || []).map(x => [x.clasa, x.masina]));
      haptic('success');
    } catch {
      dl.eroare = 'Echipa nu s-a putut salva acum.';
      randeazaDuel();
      return;
    }
    if (dl.inapoi === 'rapid') { dl.clasaRapid = dl.echipaClasa; ecranDuel('rapid'); } else if (dl.inapoi === 'echipe') arataEchipele(); else laMeniu();
  }
  async function deschideRapid() {
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    if (!dl.garaj.some(g => g.masina === dl.masina && !g.blocat)) dl.masina = null;
    const bani = dl.portofel ? dl.portofel.mil : 0;
    // miza rămâne cea de data trecută, dacă încă ți-o permiți
    if (dl.mizaRapid > bani) dl.mizaRapid = [...MIZE_RAPID].reverse().find(x => x <= bani) || MIZE_RAPID[0];
    ecranDuel('rapid');
  }
  async function pornesteRapid() {
    const car = MD.dupaCheie(dl.masina);
    try {
      const r = await FrqCloud.duel({ actiune: 'rapid', miza: dl.mizaRapid, masina: dl.masina });
      meci.antrenament = null;
      const niv = (dl.garaj.find(g => g.masina === dl.masina) || {}).nivel || 0;
      if (r.rol === 'a') {
        meci.duel = { rol: 'a', rapid: true, id: r.id, cod: r.cod, tip: 'bani', miza: dl.mizaRapid, masina: dl.masina };
        cursaDuel([{ car, nivel: niv }, { car, nivel: niv }]);
      } else {
        meci.duel = {
          rol: 'b', rapid: true, id: r.id, cod: null, tip: 'bani', miza: r.miza, masina: dl.masina,
          adv: { nume: r.nume_a, plan: r.apasari_a, lc: M.turatieLa(r.tur_a || [], BLOCARE), car: MD.dupaCheie(r.masina_a), nivel: r.nivel_a || 0 },
        };
        cursaDuel([{ car, nivel: r.nivel_b || 0 }, { car: meci.duel.adv.car, nivel: meci.duel.adv.nivel }]);
      }
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      dl.eroare = ERORI_DUEL[k] || 'Nu s-a putut porni duelul. Încearcă din nou.';
      randeazaDuel();
    }
  }
  async function deschideAle() {
    await ecranDuel('incarc');
    try { const r = await FrqCloud.duel({ actiune: 'ale-mele' }); ecranDuel('ale', { ale: r.dueluri }); }
    catch { ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
  }
  async function deschideCod(cod) {
    await ecranDuel('incarc');
    try {
      const [v] = await Promise.all([FrqCloud.duel({ actiune: 'vezi', cod }), incarcaGarajDl()]);
      dl.masina = null;
      ecranDuel('vezi', { vezi: v });
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      ecranDuel('ale', { ale: [], eroare: ERORI_DUEL[k] || 'Nu se poate încărca acum.' });
    }
  }
  async function pornesteDuel(rol) {
    const car = MD.dupaCheie(dl.masina);
    try {
      if (rol === 'a') {
        const r = await FrqCloud.duel({ actiune: 'creeaza', tip: dl.tip, miza: dl.tip === 'bani' ? dl.miza : 0, masina: dl.masina });
        meci.antrenament = null;
        const niv = (dl.garaj.find(g => g.masina === dl.masina) || {}).nivel || 0;
        meci.duel = { rol: 'a', id: r.id, cod: r.cod, tip: dl.tip, miza: dl.tip === 'bani' ? dl.miza : 0, masina: dl.masina };
        cursaDuel([{ car, nivel: niv }, { car, nivel: niv }]);
      } else {
        const v = dl.vezi;
        const r = await FrqCloud.duel({ actiune: 'accepta', id: v.id, masina: dl.masina });
        meci.antrenament = null;
        meci.duel = {
          rol: 'b', id: v.id, cod: v.cod, tip: v.tip, miza: v.miza, masina: dl.masina,
          adv: { nume: r.nume_a, plan: r.apasari_a, lc: M.turatieLa(r.tur_a || [], BLOCARE), car: MD.dupaCheie(r.masina_a), nivel: r.nivel_a || 0 },
        };
        cursaDuel([{ car, nivel: r.nivel_b || 0 }, { car: meci.duel.adv.car, nivel: meci.duel.adv.nivel }]);
      }
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      dl.eroare = ERORI_DUEL[k] || 'Nu s-a putut porni duelul. Încearcă din nou.';
      randeazaDuel();
    }
  }
  function cursaDuel(masini) {
    oprestePeTot();
    clearTimeout(meci.ceasBot);
    meci.zi = null;
    meci.scor = [0, 0];
    meci.curse = [];
    meci.runda = 1;
    cursaNoua(masini);
  }
  async function finalDuel() {
    const d = meci.duel, c = cursa.piloti[0];
    const fals = c.fals || c.fin == null;
    const corp = fals ? { actiune: 'cursa', id: d.id, fals: true } : { actiune: 'cursa', id: d.id, apasari: [...c.apasari], tur: [...c.tur] };
    oprestePeTot();
    cursa = null;
    await ecranDuel('incarc');
    try {
      const r = await FrqCloud.duel(corp);
      if (d.rol === 'a') {
        if (r.fals) ecranDuel('anulat');
        else ecranDuel('creat', { creat: { id: d.id, cod: r.cod, timp: r.timp, rapid: !!d.rapid, miza: d.miza } });
      } else ecranDuel('rezultat', { rez: { ...r, duel: d } });
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      ecranDuel('ale', { ale: [], eroare: ERORI_DUEL[k] || 'Cursa nu s-a putut trimite. Rezultatul apare în Duelurile mele.' });
    }
    meci.duel = null;
  }
  async function trimiteCod(cod) {
    const url = linkDuel(cod);
    const text = I18n.t('Te provoc la un duel în Startul. Cod: {cod}', { cod });
    try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); dl.eroare = I18n.t('Link copiat'); randeazaDuel(); } catch { window.prompt(I18n.t('Copiază linkul'), url); }
  }
  $('d-dl-in').addEventListener('click', async e => {
    const m = e.target.closest('[data-m]');
    // în ecranul echipei, mașina aleasă pentru clasă se salvează în cont
    if (m && !m.disabled && dl.pas === 'echipa') { alegeInEchipa(m.dataset.m); return; }
    if (m && !m.disabled) { dl.masina = m.dataset.m; haptic(); randeazaDuel(); return; }
    const t = e.target.closest('[data-tip]');
    if (t && dl.pas === 'nou') { dl.tip = t.dataset.tip; randeazaDuel(); return; }
    const mz = e.target.closest('[data-miza]');
    if (mz && !mz.disabled) { dl.miza = +mz.dataset.miza; randeazaDuel(); return; }
    const lc = e.target.closest('[data-live-clasa]');
    if (lc && !lc.disabled) { live.clasa = +lc.dataset.liveClasa; haptic(); randeazaDuel(); return; }
    const lm = e.target.closest('[data-live-miza]');
    if (lm && !lm.disabled) { live.miza = +lm.dataset.liveMiza; haptic(); randeazaDuel(); return; }
    const lmas = e.target.closest('[data-live-m]');
    if (lmas) { live.alesa = lmas.dataset.liveM; haptic(); randeazaDuel(); return; }
    const el = e.target.closest('[data-echipa-l]');
    if (el && !el.disabled) { haptic(); ecranDuel('echipa', { echipaClasa: +el.dataset.echipaL, inapoi: 'echipe' }); return; }
    const cr = e.target.closest('[data-clasa-r]');
    if (cr) { dl.clasaRapid = +cr.dataset.clasaR; haptic(); randeazaDuel(); return; }
    const mr = e.target.closest('[data-miza-r]');
    if (mr && !mr.disabled) { dl.mizaRapid = +mr.dataset.mizaR; randeazaDuel(); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const act = a.dataset.act;
    if (act === 'alearga') { a.disabled = true; pornesteDuel('a'); }
    if (act === 'rapid') { a.disabled = true; pornesteRapid(); }
    if (act === 'rapid-iar') deschideRapid();
    if (act === 'schimba') ecranDuel('echipa', { echipaClasa: dl.clasaRapid, inapoi: 'rapid' });
    if (act === 'echipa-gata') { if (dl.inapoi === 'rapid') ecranDuel('rapid'); else if (dl.inapoi === 'echipe') arataEchipele(); else laMeniu(); }
    if (act === 'cupa-go') $('d-cupa-go').click();
    if (act === 'live-fa') {
      a.disabled = true;
      try {
        const r = await cereLive({ actiune: 'creeaza', joc: 'startul', miza: live.miza, clasa: live.clasa });
        live.camera = { id: r.id, cod: r.cod, joc: 'startul', miza: live.miza, v: 0, stare: 'asteapta', optiuni: { clasa: r.clasa } };
        live.joc = null;
        await ascultaLive(r.id);
        ecranDuel('live-asteapta');
      } catch (er) { dl.eroare = ERORI_LIVE[er.cod] || 'Camera nu s-a putut face acum.'; randeazaDuel(); }
    }
    if (act === 'live-trimite') {
      const url = `${location.origin}${location.pathname}?online&live=${live.camera.cod}`;
      const text = I18n.t('Hai la o cursă live în Startul. Cod: {cod}', { cod: live.camera.cod });
      try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (er) { if (er && er.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${text} ${url}`); dl.eroare = I18n.t('Link copiat'); randeazaDuel(); } catch { window.prompt(I18n.t('Copiază linkul'), url); }
    }
    if (act === 'live-inchide') {
      try { await cereLive({ actiune: 'anuleaza', id: live.camera.id }); } catch { /* era deja închisă */ }
      if (live.oprire) live.oprire();
      live.camera = null; live.joc = null;
      laMeniu();
    }
    if (act === 'live-gata' && live.alesa) {
      a.disabled = true;
      try { primesteLive(await cereLive({ actiune: 'muta', id: live.camera.id, mutare: { tip: 'masina', masina: live.alesa } })); haptic('success'); }
      catch (er) { dl.eroare = ERORI_LIVE[er.cod] || 'Nu s-a putut alege acum.'; randeazaDuel(); }
    }
    if (act === 'live-revansa') {
      a.disabled = true;
      try { live.alesa = null; primesteLive(await cereLive({ actiune: 'revansa', id: live.camera.id })); }
      catch (er) { dl.eroare = ERORI_LIVE[er.cod] || 'Revanșa nu a mers acum.'; randeazaDuel(); }
    }
    if (act === 'live-nou') { if (live.oprire) live.oprire(); live.camera = null; live.joc = null; deschideLive(); }
    if (act === 'cupa-iar') { a.disabled = true; pornesteCupa(); }
    if (act === 'antreneaza') {
      const g = dl.garaj.find(x => x.masina === dl.masina);
      const car = g && MD.dupaCheie(g.masina);
      if (!car) return;
      meci.duel = null;
      meci.antrenament = { masina: g.masina };
      cursaDuel([{ car, nivel: g.nivel || 0 }, { car, nivel: g.nivel || 0 }]);
    }
    if (act === 'accepta') { a.disabled = true; pornesteDuel('b'); }
    if (act === 'trimite-cod') trimiteCod(dl.creat.cod);
    if (act === 'nou') deschideNou();
    if (act === 'ale') deschideAle();
    if (act === 'meniu') laMeniu();
    if (act === 'anuleaza') {
      if (!(await Shared.intreaba(I18n.t('Anulezi duelul? Miza se întoarce la tine.'), { da: 'Anulează', nu: 'Rămân' }))) return;
      try { await FrqCloud.duel({ actiune: 'anuleaza', id: a.dataset.id }); } catch { /* lista arată starea reală */ }
      deschideAle();
    }
  });
  $('d-dl-in').addEventListener('submit', e => {
    if (e.target.id === 'd-live-cod') {
      e.preventDefault();
      const cod = e.target.querySelector('input').value.trim().toUpperCase();
      if (cod) intraLive(cod);
      return;
    }
    if (e.target.id !== 'd-dl-cod2') return;
    e.preventDefault();
    const cod = e.target.querySelector('input').value.trim().toUpperCase();
    if (cod) deschideCod(cod);
  });
  async function arataEchipele() {
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    ecranDuel('echipe');
  }

  // ---------- meniul Startului ----------
  // Local: alegi meciul (2 jucători sau contra botului), apoi numele și rundele.
  // Online: câte un rând pentru fiecare loc (Cursa zilei, duelurile, Cupa, echipa),
  // cu starea lui pe scurt; apeși și te duce acolo.
  function randeazaMeniuD() {
    const el = $('d-meniu');
    if (!ONLINE) {
      el.innerHTML = Shared.randuriMeniu([
        { id: 'doi', titlu: '2 jucători', sub: 'Pe același telefon, unul în stânga, unul în dreapta', primar: true },
        { id: 'ai', titlu: 'Contra botului', sub: 'Ușor, mediu sau greu' },
        { id: 'cum', titlu: 'Cum se joacă', sub: 'Pachete, mașini pe ascuns, sfert de milă' },
      ]);
      return;
    }
    const car = masinaZilei(azi()), rec = recordAzi(), cs = cupa.stare;
    const cupaSub = !cs ? 'Duminica, cu intrare în mil.'
      : !cs.deschisa ? `${dataLunga(cs.data)} · intrare ${mil(cs.intrare)}`
      : cs.eu ? (cs.eu.folosite < cs.incercari ? `Azi · ${cs.incercari - cs.eu.folosite} încercări rămase` : `Azi · ${cs.eu.loc ? `locul ${cs.eu.loc}` : 'gata'}`)
      : `Azi · intrare ${mil(cs.intrare)} · pot ${mil(cs.pot)}`;
    const nr = dl.garaj.length ? echipaEfectiva().filter(x => x.g).length : null;
    const carCupa = cs && dupaCheie(cs.masina);
    el.innerHTML = Shared.randuriMeniu([
      { id: 'zi', titlu: 'Cursa zilei', sub: `${modelOf(car.name) || car.name}${rec ? ` · recordul tău ${fmt(rec.t / 1000, 2)} s` : ' · aceeași mașină pentru toți'}`, primar: true, poza: poza(car) },
      { id: 'live', titlu: 'Cursă live', sub: 'Tu și un prieten, în același moment' },
      { id: 'rapid', titlu: 'Duel rapid', sub: 'Pe bani, cu un adversar din clasa ta' },
      { id: 'cupa', titlu: 'Cupa de duminică', sub: cupaSub, poza: carCupa ? poza(carCupa) : '' },
      { id: 'echipa', titlu: 'Echipa ta', sub: nr == null ? 'O mașină din garaj pentru fiecare clasă' : `${nr} din 5 clase` },
      { id: 'prieten', titlu: 'Cu un prieten', sub: 'Faci un duel și îi trimiți codul' },
      { id: 'cod', titlu: 'Am un cod', sub: 'Intri în duelul unui prieten' },
      { id: 'ale', titlu: 'Duelurile mele', sub: 'Ce așteaptă și ce s-a terminat' },
      { id: 'antr', titlu: 'Antrenament', sub: 'Cu mașinile tale, contra lui FRQ Bot, fără miză' },
    ]);
    wirePhotos(el);
  }
  const pasMeniu = () => { if (!ONLINE) document.body.classList.toggle('pas-meniu', location.hash !== '#meci'); };
  window.addEventListener('hashchange', pasMeniu);
  $('d-form-inapoi').addEventListener('click', () => { if (location.hash === '#meci') history.back(); else document.body.classList.add('pas-meniu'); });
  $('d-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r || r.disabled) return;
    haptic();
    const id = r.dataset.mj;
    if (id === 'cum') { document.querySelector('#screen-setup [data-how]').click(); return; }
    if (id === 'doi' || id === 'ai') {
      meci.mod = id; store.set('drg_mod', id); arataMod();
      location.hash = 'meci';
      return;
    }
    if (id === 'zi') $('d-zi-go').click();
    if (id === 'rapid') $('d-dl-rapid').click();
    if (id === 'live') deschideLive();
    if (id === 'cupa') ecranDuel('cupa-info');
    if (id === 'echipa') arataEchipele();
    if (id === 'prieten') $('d-dl-nou').click();
    if (id === 'cod') ecranDuel('cod');
    if (id === 'ale') $('d-dl-ale').click();
    if (id === 'antr') $('d-dl-antr').click();
  });

  $('d-dl-nou').addEventListener('click', () => { haptic(); deschideNou(); });
  $('d-dl-rapid').addEventListener('click', () => { haptic(); deschideRapid(); });
  $('d-dl-ale').addEventListener('click', () => { haptic(); deschideAle(); });
  $('d-dl-antr').addEventListener('click', async () => {
    haptic();
    await ecranDuel('incarc');
    try { await incarcaGarajDl(); } catch { return ecranDuel('ale', { ale: [], eroare: 'Nu se poate încărca acum.' }); }
    if (!dl.garaj.some(g => g.masina === dl.masina)) dl.masina = null;
    ecranDuel('antrenament');
  });
  $('d-dl-cod').addEventListener('submit', e => {
    e.preventDefault();
    const cod = $('d-dl-cod').querySelector('input').value.trim().toUpperCase();
    if (cod) deschideCod(cod);
  });
  $('d-dl-inapoi').addEventListener('click', () => laMeniu());
  {
    const codLive = new URLSearchParams(location.search).get('live');
    if (codLive && /^[A-Z0-9]{6}$/i.test(codLive)) intraLive(codLive.toUpperCase());
  }
  {
    const cod = new URLSearchParams(location.search).get('duel');
    if (cod && /^[A-Z0-9]{6}$/i.test(cod)) deschideCod(cod.toUpperCase());
  }

  [0, 1].forEach(i => { $(`d-name-${i}`).value = meci.nume[i] || ''; });
  // modul: doi jucători sau contra lui FRQ Bot, cu nivelul lui
  const arataMod = () => {
    document.querySelectorAll('#d-mod [data-m]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.m === meci.mod)));
    document.querySelectorAll('#d-nivel [data-n]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.n === meci.nivel)));
    $('d-p2').hidden = meci.mod === 'ai';
    $('d-nivel-w').hidden = meci.mod !== 'ai';
  };
  $('d-mod').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    meci.mod = b.dataset.m;
    store.set('drg_mod', meci.mod);
    arataMod();
  });
  $('d-nivel').addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    meci.nivel = +b.dataset.n;
    store.set('drg_nivel', meci.nivel);
    arataMod();
  });
  arataMod();
  document.querySelectorAll('a.back-btn[href="index.html"]').forEach(a => { a.href = ONLINE ? 'index.html#online' : 'index.html#local'; });
  if (ONLINE) {
    document.querySelector('#screen-setup .eyebrow').textContent = 'Jocuri FRQ · Online';
    document.querySelector('#screen-setup .lede').textContent = 'Cu mașinile din garajul tău: Cursa zilei, dueluri pe bani și Cupa de duminică.';
    cardZi();
    cardCupa();
    randeazaEchipa();
  }
  randeazaMeniuD();
  pasMeniu();
  $('d-zi-go').addEventListener('click', () => { haptic(); cursaZilei(null); });
  $('d-cls').addEventListener('click', () => window.FrqCloud && FrqCloud.arataClasament('startul'));
  const provocare = citesteProvocarea();
  if (provocare) {
    const c = provocare.car;
    $('d-prov').innerHTML = `
      <p class="drg-prov-e">Provocare</p>
      <p class="drg-prov-t"><b>${esc(provocare.nume)}</b> <span>te provoacă la Cursa zilei</span></p>
      <p class="drg-prov-m">${esc(c.name)}${provocare.t ? ` &middot; ${fmt(provocare.t / 1000, 2)} s` : ''}</p>
      <button class="btn btn-primary" type="button" id="d-prov-ok">Acceptă</button>`;
    $('d-prov').hidden = false;
    $('d-prov-ok').addEventListener('click', () => { haptic(); cursaZilei(provocare); });
  }
  $('d-prov-b').addEventListener('click', provoaca);
  $('d-img').addEventListener('click', salveazaBonul);
  $('d-sunet').setAttribute('aria-pressed', String(!window.DragSunet || window.DragSunet.pornit));
  $('d-sunet').addEventListener('click', () => {
    if (!window.DragSunet) return;
    $('d-sunet').setAttribute('aria-pressed', String(window.DragSunet.comuta()));
  });
  // câte runde: de la 1 la 5
  const arataRunde = () => document.querySelectorAll('#d-runde [data-r]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.r === meci.runde)));
  $('d-runde').addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    meci.runde = +b.dataset.r;
    store.set('drg_runde', meci.runde);
    arataRunde();
  });
  arataRunde();
  $('d-form').addEventListener('submit', e => {
    e.preventDefault();
    meci.nume = [0, 1].map(i => $(`d-name-${i}`).value);
    store.set('drg_names', meci.nume);
    meciNou();
  });

  let scutura = false;
  $('d-pachete').addEventListener('click', e => {
    const info = e.target.closest('[data-info]');
    if (info) { continut(PACHETE.find(x => x.id === info.dataset.info)); return; }
    const b = e.target.closest('[data-pk]');
    if (!b || b.disabled || cutie || scutura || (contraBot() && meci.rand === 1)) return;
    const pk = PACHETE.find(x => x.id === b.dataset.pk);
    // lada se scutură o clipă, apoi se deschide
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deschide(pk); return; }
    scutura = true;
    b.classList.add('is-scutura');
    haptic();
    setTimeout(() => { scutura = false; deschide(pk); }, 420);
  });
  $('d-sari').addEventListener('click', arata);
  $('d-cont').addEventListener('click', e => {
    if (e.target.closest('[data-inchide]') || e.target === $('d-cont')) $('d-cont').hidden = true;
  });
  $('d-rev').addEventListener('click', e => { if (e.target.closest('#d-rev-ok')) inchideCutie(); });
  $('d-cover').addEventListener('click', e => {
    if (!e.target.closest('#d-cover-ok')) return;
    $('d-cover').hidden = true;
    randeazaOrdinea();
    $('d-line').hidden = false;
  });
  // ordinea: atingi o rundă ca s-o alegi (a doua atingere o golește), apoi o mașină
  $('d-line').addEventListener('click', e => {
    const j = meci.j[meci.aseaza];
    const slot = e.target.closest('[data-slot]'), g = e.target.closest('[data-g]');
    if (slot) {
      const i = +slot.dataset.slot;
      if (meci.sel === i && j.ordine[i]) j.ordine[i] = null;
      meci.sel = i;
    } else if (g) puneMasina(+g.dataset.g);
    else if (e.target.closest('#d-line-ok') && j.ordine.every(Boolean)) {
      if (meci.aseaza === 0 && !contraBot()) ordinea(1); else rundaNoua();
      return;
    } else return;
    haptic();
    randeazaOrdinea();
  });
  $('d-dezv').addEventListener('click', ascundeDezv);

  // Ieșirea din magazin sau din ordine: meciul se pierde, deci întrebăm.
  const iesire = async () => {
    // din cursa unui duel: ieșirea e start fals (A plătește taxa de abandon, B pierde)
    // din cursa live: pierzi cursa
    if (meci.live && cursa && cursa.faza !== 'gata') {
      if (!(await Shared.intreaba(I18n.t('Ieși? Pierzi cursa.')))) return;
      liveTrimite({ tip: 'fals' });
      trimiteCursaLive(true);
      oprestePeTot();
      cursa = null;
      laMeniu();
      return;
    }
    // din cursa Cupei: încercarea s-a consumat la start
    if (meci.cupa && cursa && cursa.faza !== 'gata') {
      if (!(await Shared.intreaba(I18n.t('Ieși? Încercarea se pierde.')))) return;
      oprestePeTot();
      cursa = null;
      FrqCloud.cupa({ actiune: 'cursa', fals: true }).catch(() => {});
      laMeniu();
      return;
    }
    if (meci.duel && cursa && cursa.faza !== 'gata') {
      if (!(await Shared.intreaba(I18n.t(meci.duel.rol === 'a' ? 'Ieși? Duelul se anulează și plătești taxa de abandon.' : 'Ieși? Pierzi duelul.')))) return;
      const d = meci.duel;
      oprestePeTot();
      cursa = null;
      FrqCloud.duel({ actiune: 'cursa', id: d.id, fals: true }).catch(() => {});
      laMeniu();
      return;
    }
    if (await Shared.intreaba(I18n.t('Ieși? Meciul se pierde.'))) {
      if (cutie) { clearTimeout(cutie.ceas); clearTimeout(cutie.ceasBot); cutie = null; }
      clearTimeout(meci.ceasBot);
      oprestePeTot();
      cursa = null;
      laMeniu();
    }
  };
  $('d-shop-quit').addEventListener('click', iesire);
  $('d-line-quit').addEventListener('click', iesire);

  [0, 1].forEach(p => {
    const el = $(`d-half-${p}`);
    // Degetul rămâne „al butonului" până se ridică, chiar dacă alunecă puțin de pe el.
    let deget = null;
    el.addEventListener('pointerdown', e => {
      if (!e.target.closest('.drg-btn')) return;
      e.preventDefault();
      deget = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* fără captură, merge și așa */ }
      atinge(p, e.timeStamp || performance.now());
    });
    const ridica = e => {
      if (deget !== e.pointerId) return;
      deget = null;
      elibereaza(p, e.timeStamp || performance.now());
    };
    el.addEventListener('pointerup', ridica);
    el.addEventListener('pointercancel', ridica);
    // Enter sau Space pe butonul cu focus: un click fără pointer, apăsat și ridicat.
    el.addEventListener('click', e => {
      if (e.detail === 0 && e.target.closest('.drg-btn')) { const t = performance.now(); atinge(p, t); elibereaza(p, t); }
    });
  });
  // Pe calculator: A pentru stânga, L pentru dreapta.
  document.addEventListener('keydown', e => {
    if (!$('screen-race').classList.contains('is-active') || e.repeat) return;
    const k = e.key.toLowerCase();
    if ((k === ' ' || k === 'enter') && !$('d-next').hidden) { e.preventDefault(); $('d-next').click(); return; }
    if (k === 'a') atinge(0, e.timeStamp || performance.now());
    if (k === 'l') atinge(1, e.timeStamp || performance.now());
  });
  document.addEventListener('keyup', e => {
    if (!$('screen-race').classList.contains('is-active')) return;
    const k = e.key.toLowerCase();
    if (k === 'a') elibereaza(0, e.timeStamp || performance.now());
    if (k === 'l') elibereaza(1, e.timeStamp || performance.now());
  });

  // Pista urmează mărimea ecranului (bara de adrese care apare și dispare, rotirea).
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!cursa) return;
      pista();
      cursa.piloti.forEach(c => deseneaza(c, performance.now()));
    }).observe($('d-track'));
  }

  $('d-next').addEventListener('click', () => atinge(0, performance.now()));

  $('btn-quit').addEventListener('click', iesire);
  $('d-again').addEventListener('click', () => (meci.zi ? cursaZilei() : meciNou()));
  $('d-menu').addEventListener('click', laMeniu);

  // Pentru verificări din consolă: modelul, fără interfață.
  window.__drag = { masinaZilei, citesteProvocarea, NIVELE, baza, schimbari, verde, accel, pregateste, profil, poz, vit, inv, t100, electrica, RITM, POOL, SFERT, PACHETE, raritate, trage, PE_RARITATE };
})();
