// Garajul meu: portofelul (mil.), lăzile și colecția de mașini. Totul vine de pe
// server: banii și mașinile le mută doar funcția `portofel`, care trage și mașina din
// ladă; aici banda doar arată rezultatul, ca în Startul.
(() => {
  'use strict';

  const { fmt, brandOf, modelOf, esc, wirePhotos, haptic, thumbHTML, cadruLinistit } = window.Shared;
  const E = window.Economie, M = window.DragModel;
  const MD = M.creeaza(window.CARS || []);
  const { POOL, TIMP, rar, PE_RARITATE } = MD;
  const $ = id => document.getElementById(id);
  // Duel de cărți: la ce domină fiecare mașină și dacă e în pachetul tău
  const K = window.CartiModel, KM = K ? K.creeaza(M, MD) : null;
  const domina = k => {
    const x = KM && KM.dupaCheie.get(k);
    if (!x) return null;
    const c = KM.rol(x);
    return { cat: K.CAT[c].label, top: Math.max(1, Math.round(100 * (1 - KM.varf(x)))) };
  };
  function inPachet(k) {
    if (!KM) return false;
    const sel = Shared.store.get('crt_pachet', null);
    const ale = [...stare.garaj.keys()].map(x => KM.dupaCheie.get(x)).filter(Boolean);
    return K.pachetDinGaraj(ale, sel ? new Set(sel) : null, KM).carti.some(x => x.k === k);
  }

  // fața fiecărei lăzi, ca în Startul: Golf GTI, M3, Huracán, P1
  const FATA = {
    strada: ['Volkswagen Golf GTI', '1983'], sport: ['BMW M3', '1997'], super: ['Lamborghini Huracán LP 610-4', '2014'], hyper: ['McLaren P1', '2013'],
    jdm: ['Nissan Skyline GT-R V-Spec', '1999'], sua: ['Dodge Challenger SRT Hellcat', '2015'], italia: ['Ferrari F40', '1987'],
    anglia: ['McLaren F1', '1993'], germania: ['Porsche 911 GT3 RS', '2019'], electrice: ['Rimac Nevera', '2021'],
  };
  const dupaNume = ([n, y]) => (window.CARS || []).find(c => c.name.normalize('NFC') === n.normalize('NFC') && String(c.years) === y);
  const poza = c => thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
  const fara = c => poza(c).replace(/<img[^>]*>/, '');
  // Scorul de circuit (clasa și numărul, după tuning), din modelul Cursei: cât de rapidă e
  // mașina pe un tur, din datele ei reale și tuning.
  const CMod = window.CursaModel;
  const pi = (c, nivel = 0) => { const s = CMod.scor(c, nivel); return `<span class="pi pi-${s.k}"><b>${s.clasa}</b>${s.v}</span>`; };
  const timpCarte = c => pi(c);
  const PLURAL_RAR = ['Comune', 'Rare', 'Epice', 'Exotice', 'Legendare'];
  // „1 punct rar", „3 puncte rare"
  const PUNCT_SG = ['comun', 'rar', 'epic', 'exotic', 'legendar'];
  const puncteText = (n, r) => `${n} ${n === 1 ? `punct ${PUNCT_SG[r]}` : `puncte ${PLURAL_RAR[r].toLowerCase()}`}`;

  const stare = { portofel: null, garaj: new Map(), ex: new Map(), filtru: -1, doar: false, cutie: null, deschise: 0, misiuni: null, set: null, toateSeturile: false };
  const SETURI = window.Seturi.creeaza(POOL, { rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_SET });

  // ---------- exemplarele ----------
  // Fiecare mașină are exemplarele ei (id, nivel, blocat), fiecare cu tuningul lui.
  // `stare.garaj` e colecția (o mașină = un rând), refăcută din ele după fiecare schimbare.
  const VAL = E.valori(MD, M.cheieMasina);
  const valoare = k => VAL.get(k) || 0;
  const exemplare = k => stare.ex.get(k) || [];
  const netunate = k => exemplare(k).filter(e => !e.nivel && !e.blocat);
  // dublurile: exemplarele netunate, fără ultimul (dacă toate sunt netunate)
  const nrDubluriMasina = k => { const n = netunate(k).length; return exemplare(k).length > n ? n : Math.max(0, n - 1); };
  // cel mai tunat întâi (ca în garaj), apoi cel mai vechi
  const ordine = l => l.slice().sort((a, b) => M.nivelTotal(b.nivel) - M.nivelTotal(a.nivel) || (a.id || 0) - (b.id || 0));
  function refaMasina(k, raritate) {
    const l = exemplare(k);
    if (!l.length) { stare.garaj.delete(k); stare.ex.delete(k); return; }
    const g = stare.garaj.get(k) || { masina: k, raritate, nivel: 0, bucati: 0, blocat: false };
    g.bucati = l.length; g.nivel = ordine(l)[0].nivel; g.blocat = l.some(e => e.blocat);
    stare.garaj.set(k, g);
  }
  function adaugaExemplar(k, raritate, id) {
    stare.ex.set(k, [...exemplare(k), { id: id ?? null, nivel: 0, blocat: false }]);
    refaMasina(k, raritate);
  }
  // serverul ia dublura cea mai nouă (netunată, neblocată): aici la fel
  function scoateDublura(k) {
    const d = netunate(k).sort((a, b) => (b.id || 0) - (a.id || 0))[0];
    if (d) stare.ex.set(k, exemplare(k).filter(e => e !== d));
    refaMasina(k);
  }

  // ---------- starea ----------
  function randeazaStare() {
    const p = stare.portofel;
    $('c-mil').textContent = p ? E.mil(p.mil) : '–';
    // fără garajul de pe server nu arătăm „0 din 685": ar părea că s-au pierdut mașinile
    $('c-numar').textContent = stare.faraServer ? '–' : `${stare.garaj.size} din ${POOL.length}`;
    $('c-fara-semnal').hidden = !stare.faraServer;
    $('c-serie').textContent = p && p.serie ? (p.serie === 1 ? '1 zi' : `${p.serie} zile`) : '–';
    const pc = (p && p.puncte) || [0, 0, 0, 0, 0];
    $('c-puncte').hidden = !p;
    $('c-puncte').innerHTML = `<span>Puncte de upgrade</span>${pc.map((n, r) => `<b class="rar-${r}" title="${E.RARITATI[r]}"><small>${PLURAL_RAR[r]}</small>${n}</b>`).join('')}`;
  }
  // o dublură: bani sau un punct de raritatea ei (serverul hotărăște cât)
  async function schimbaDublura(masina, alegere) {
    const r = await FrqCloud.dublura(masina, alegere);
    stare.portofel = { ...stare.portofel, mil: r.mil, puncte: r.puncte };
    scoateDublura(masina);
    haptic('success');
    window.Sunete && Sunete[alegere === 'vinde' ? 'oferta' : 'pune']();
    randeazaStare();
    return r;
  }
  // o dublură ieșită din ladă: sus o vinzi sau o faci punct de upgrade, jos o păstrezi
  // (o hotărăști mai târziu, în Dubluri)
  const butoaneDublura = (c, cls = '') => {
    const r = rar(c);
    return `<div class="col-dubl col-dubl-3 ${cls}"><button class="btn btn-ghost" type="button" data-dubl="vinde">Vinde<small>+${E.mil(valoare(M.cheieMasina(c)))}</small></button>
      <button class="btn btn-primary" type="button" data-dubl="puncte">+1 punct<small>${PUNCT_SG[r]}</small></button>
      <button class="btn btn-ghost" type="button" data-dubl="pastreaza">Păstrează</button></div>`;
  };

  // ---------- sponsorii lăzilor (sponsori.js) ----------
  // Lada unui sponsor îi poartă logo-ul pe card, deasupra numelui (colțurile sunt ale
  // prețului), „powered by" la deschidere și pe dezvăluire. Pachetele iau sponsorul
  // lăzii lor.
  const SP = window.Sponsori;
  const spLada = id => (SP ? SP.pentruLada(id) : null);
  const spInsigna = id => { const s = spLada(id); return s ? `<span class="sp-lada" style="--sp:${esc(s.culoare)}">${SP.logo(s)}</span>` : ''; };
  if (SP) document.addEventListener('frq-sponsori', () => randeazaLazi());

  // ---------- lăzile ----------
  // Lăzile gratis nu au card separat: stau pe lada de Stradă, ca număr („2 gratis”), și
  // se deschid primele; când se termină, lada arată din nou prețul.
  function cardLada(l) {
    const p = stare.portofel;
    const gratis = p && l.id === E.LAZI[0].id ? p.lazi_gratis || 0 : 0;
    const ok = !!p && (gratis > 0 || p.mil >= l.pret);
    const car = dupaNume(FATA[l.id]);
    // la lăzile cu temă, șansele reale (doar raritățile pe care tema le are)
    const sanse = E.sanseLada(l, PE_RARITATE).map(x => Math.round(x));
    const segm = sanse.map((s, r) => (s ? `<i class="rar-${r}" style="flex:${s}"></i>` : '')).join('');
    const leg = sanse.map((s, r) => (s ? `<span class="rar-${r}">${s}%</span>` : '')).join('');
    const img = car ? `<img src="${esc(car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">` : '';
    const pret = gratis ? `${gratis} gratis` : E.mil(l.pret);
    return `<div class="drg-pk-w"><button class="drg-pk pk-${l.id}${gratis ? ' is-gratis' : ''}" type="button" data-lada="${l.id}"${gratis ? ' data-gratis' : ''}${ok ? '' : ' disabled'} aria-label="${esc(l.nume)}, ${esc(pret)}">
      <span class="drg-lada" aria-hidden="true">
        <span class="drg-lada-foto">${img}</span>
        <span class="drg-lada-capac"><i class="drg-lada-maner"></i></span>
        <span class="drg-lada-et">${spInsigna(l.id)}<small>Ladă</small>${esc(l.nume)}</span>
        <span class="drg-lada-pret">${esc(pret)}</span>
        <i class="drg-lada-luciu"></i>
      </span>
      <span class="drg-pk-bar" aria-hidden="true">${segm}</span>
      <span class="drg-pk-s">${leg}</span>
    </button></div>`;
  }
  function randeazaLazi() {
    $('c-pachete').innerHTML = E.LAZI.filter(l => !l.tema).map(l => cardLada(l)).join('');
    // ce-ți mai lipsește din fiecare temă
    $('c-teme').innerHTML = E.LAZI.filter(l => l.tema).map(l => {
      const toate = E.peRaritateLada(l, PE_RARITATE).flat();
      const ai = toate.filter(c => stare.garaj.has(M.cheieMasina(c))).length;
      return cardLada(l).replace('</button></div>', `<span class="col-tema-ai">${ai} din ${toate.length}</span></button></div>`);
    }).join('');
    $('c-pachete-mari').innerHTML = E.PACHETE.map(pk => cardPachet(pk)).join('');
    randeazaBonus();
    // o afișare pe sponsor, pe pagina Lăzi
    if (SP && document.body.dataset.pas === 'lazi') E.LAZI.forEach(l => { const s = spLada(l.id); if (s) SP.vazut(s.id, 'lada'); });
  }

  // ---------- lăzile de bonus ----------
  // După plafonul zilei, partidele umplu o bară cu trei trepte (Bronz, Argint, Aur), câte
  // o ladă fiecare. Locul e mereu același (și fără date), ca lăzile de sub el să nu sară.
  function randeazaBonus() {
    const B = E.BONUS, z = stare.bonus || { strans: 0, castigate: 0, deschise: 0, nedeschise: 0 };
    const k = B.praguri.findIndex(x => z.strans < x);
    const stare_ = z.nedeschise ? `${z.nedeschise === 1 ? 'O ladă te așteaptă' : `${z.nedeschise} lăzi te așteaptă`}`
      : k < 0 ? 'Toate trei luate azi. Mâine se reiau.'
      : z.strans > 0 ? `${B.nume[k]}: ${E.mil(z.strans - (k ? B.praguri[k - 1] : 0)).replace(' mil.', '')} din ${B.praguri[k] - (k ? B.praguri[k - 1] : 0)} mil.`
      : `Se umplu din partidele de după plafonul zilei (${E.CASTIG.plafon} mil.)`;
    $('c-bonus').innerHTML = `<p class="col-bonus-t"><b>Lăzi de bonus</b><small>${esc(stare_)}</small></p>
      <ol class="col-bonus-p">${B.nume.map((n, i) => {
        const de = i ? B.praguri[i - 1] : 0, p = Math.max(0, Math.min(1, (z.strans - de) / (B.praguri[i] - de)));
        return `<li class="col-bonus-${i}${p >= 1 ? ' is-gata' : ''}"><span>${n}</span><i style="--p:${Math.round(p * 100)}%"></i></li>`;
      }).join('')}</ol>
      <button class="btn ${z.nedeschise ? 'btn-primary' : 'btn-ghost'}" type="button" id="c-bonus-ok"${z.nedeschise ? '' : ' disabled'}>Deschide</button>`;
  }
  async function deschideBonus() {
    const b = $('c-bonus-ok');
    if (!b || b.disabled) return;
    b.disabled = true;
    let r;
    try { r = await FrqCloud.bonus(); } catch (e) {
      const k = await FrqCloud.codEroare(e);
      alerta(k === 'fara lada' ? 'Nicio ladă de bonus acum.' : 'Nu s-a putut deschide acum.');
      await incarcaTacit();
      return;
    }
    const pr = r.premiu, c = pr.masina && MD.dupaCheie(pr.masina);
    stare.portofel = { ...stare.portofel, mil: r.mil, puncte: r.puncte, lazi_gratis: r.lazi_gratis, pachete_gratis: r.pachete_gratis };
    if (pr.tip === 'masina' && pr.masina) adaugaExemplar(pr.masina, pr.raritate, r.exemplar);
    if (stare.bonus) { stare.bonus.nedeschise = Math.max(0, stare.bonus.nedeschise - 1); }
    haptic('success');
    window.Sunete && (pr.tip === 'masina' ? Sunete.lada(pr.raritate) : Sunete.pune());
    randeazaStare(); randeazaLazi(); randeazaColectia(); randeazaSeturi(); randeazaDubluri(); randeazaMeniuG();
    const titlu = `Lada de bonus ${r.nume}`;
    const rand = pr.tip === 'puncte' ? { text: `${pr.n} puncte ${PLURAL_RAR[pr.raritate].toLowerCase()}`, sub: 'Pentru tuning', val: `+${pr.n}` }
      : pr.tip === 'lada' ? { text: 'O ladă Stradă', sub: 'Gratis, în Lăzi', lazi: 1 }
      : pr.tip === 'pachet' ? { text: 'Un Pachet Sport', sub: 'Gratis, la Pachete', pachete: 1 }
      : { text: c ? c.name : 'O mașină', sub: `${E.RARITATI[pr.raritate]} · ${r.noua ? 'nouă în colecție' : 'încă un exemplar'}`, val: E.RARITATI[pr.raritate], accent: pr.raritate >= 3 };
    FrqCloud.ecranPremii([rand], { titlu });
    // un set completat de mașina asta se plătește la următoarea încărcare
    if (pr.tip === 'masina') incarcaTacit();
  }
  $('c-bonus').addEventListener('click', e => { if (e.target.closest('#c-bonus-ok')) deschideBonus(); });

  // ---------- deschiderea ----------
  const NR_CARTI = 46, CASTIG = 40;
  const carte = (c, cuPoza) => `<div class="drg-carte rar-${rar(c)}"><span class="drg-carte-f">${cuPoza ? poza(c) : fara(c)}</span><span class="drg-carte-m">${esc(brandOf(c.name))}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></div>`;
  // poze pe cărțile care se văd: primele (banda stă pe loc o clipă) și cele dinaintea
  // câștigului (banda încetinește); celelalte trec prea repede ca să conteze
  const cuPoza = i => i < 4 || (i >= CASTIG - 14 && i <= CASTIG + 3);

  async function deschide(lada, gratis) {
    if (stare.cutie) return;
    stare.cutie = { gata: false };
    const cutie = stare.cutie;
    $('c-cutie-t').innerHTML = `<small>${gratis ? 'Ladă gratis' : E.mil(lada.pret)}</small>${esc(lada.nume)}${SP ? SP.powered(spLada(lada.id), 'lada', 'sp-cutie') : ''}`;
    // Banda se face și pornește din clic, cu mașini trase din ladă, cât răspunde serverul.
    // Mașina câștigătoare se pune pe locul ei la răspuns, cât locul e încă departe, în
    // dreapta ferestrei. Dacă serverul întârzie până se apropie locul, banda se oprește
    // acolo și îl așteaptă.
    const banda = $('c-banda'), fer = $('c-fereastra');
    banda.style.transition = 'none';
    banda.style.transform = 'translateX(0)';
    banda.innerHTML = Array.from({ length: NR_CARTI }, (_, i) => carte(E.trage(lada, PE_RARITATE, Math.random).car, cuPoza(i))).join('');
    wirePhotos(banda);
    $('c-rev').hidden = true;
    $('c-sari').hidden = true;
    $('c-cutie').hidden = false;
    $('c-cutie').classList.remove('is-gata');
    haptic();
    const lent = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durata = !lent ? 700 : stare.deschise < 2 ? 5600 : 3600;
    const porneste = (ms, curba) => {
      const tinta = banda.children[CASTIG];
      if (cutie.x == null) cutie.x = tinta.offsetLeft + tinta.offsetWidth / 2 - fer.clientWidth / 2 + (Math.random() - 0.5) * tinta.offsetWidth * 0.7;
      banda.style.transition = `transform ${ms}ms ${curba}`;
      banda.style.transform = `translateX(${-cutie.x}px)`;
      cutie.ceas = setTimeout(arata, ms + 120);
    };
    const pazeste = () => {
      if (stare.cutie !== cutie || cutie.car) return;
      const t = banda.children[CASTIG].getBoundingClientRect();
      if (t.left < fer.getBoundingClientRect().right + t.width) {
        clearTimeout(cutie.ceas);
        const x = new DOMMatrix(getComputedStyle(banda).transform).m41;
        banda.style.transition = 'none';
        banda.style.transform = `translateX(${x}px)`;
        cutie.asteapta = true;
        return;
      }
      requestAnimationFrame(pazeste);
    };
    if (lent) cadruLinistit(220).then(() => {
      if (stare.cutie !== cutie || cutie.car) return;
      porneste(durata, 'cubic-bezier(.06, .62, .12, 1)');
      requestAnimationFrame(pazeste);
    });
    let r;
    // cum arăta garajul înainte, ca să aflăm ce s-a schimbat dacă răspunsul se pierde
    const inainte = new Map([...stare.garaj].map(([k, g]) => [k, g.bucati || 1]));
    try {
      r = await FrqCloud.deschideLada(lada.id, gratis);
    } catch {
      // Răspunsul s-a pierdut, dar lada poate să se fi deschis pe server (rețea mobilă,
      // ecran închis). Întrebăm garajul: dacă a apărut o mașină, o arătăm.
      r = await ceS_aDeschis(inainte);
      if (!r || r === 'nu') {
        stare.cutie = null;
        $('c-cutie').hidden = true;
        alerta(r === 'nu' ? 'Lada nu s-a deschis. Banii nu s-au luat.' : 'Nu știm încă dacă lada s-a deschis. Uită-te în Colecție când ai semnal: dacă s-a deschis, mașina e acolo.');
        incarcaTacit();
        return;
      }
    }
    const car = MD.dupaCheie(r.masina);
    if (!car) { stare.cutie = null; $('c-cutie').hidden = true; await incarca(); return; }
    cutie.r = r; cutie.car = car;
    stare.deschise++;
    banda.children[CASTIG].outerHTML = carte(car, true);
    wirePhotos(banda);
    $('c-sari').hidden = stare.deschise < 3;
    // banda a așteptat serverul: pornește din nou, încet, până la mașină
    if (cutie.asteapta) porneste(1500, 'cubic-bezier(.25, .6, .3, 1)');
    else if (cutie.x == null) {
      // a răspuns înainte să pornească banda (sau fără animații)
      await cadruLinistit();
      if (stare.cutie !== cutie || cutie.gata) return;
      porneste(durata, 'cubic-bezier(.06, .62, .12, 1)');
    }
  }

  // După un răspuns pierdut: citește garajul de pe server și caută mașina nouă (sau
  // dublura). Întoarce un răspuns ca al lăzii, 'nu' dacă nimic nu s-a schimbat sau
  // null dacă nici garajul nu se poate citi acum.
  async function ceS_aDeschis(inainte) {
    for (let i = 0; i < 3; i++) {
      await new Promise(g => setTimeout(g, 1200 * (i + 1)));
      let p;
      try { p = await FrqCloud.portofel(); } catch { continue; }
      const g = (p.garaj || []).find(x => (x.bucati || 1) > (inainte.get(x.masina) || 0));
      if (!g) return 'nu';
      const noua = !inainte.has(g.masina);
      aplicaPortofel(p);
      return { masina: g.masina, raritate: g.raritate, noua, gata: true, valoare: noua ? 0 : valoare(g.masina), mil: p.portofel.mil, lazi_gratis: p.portofel.lazi_gratis };
    }
    return null;
  }

  function arata() {
    const cutie = stare.cutie;
    if (!cutie || cutie.gata || !cutie.car) return;
    clearTimeout(cutie.ceas);
    cutie.gata = true;
    const banda = $('c-banda');
    if (cutie.x != null) { banda.style.transition = 'none'; banda.style.transform = `translateX(${-cutie.x}px)`; }
    const c = cutie.car, r = rar(c), rez = cutie.r;
    $('c-rev').className = `drg-rev rar-${r}`;
    $('c-rev').innerHTML = `
      <p class="drg-rev-r">${E.RARITATI[r]}${rez.noua ? ' · <span class="col-noua">Nouă</span>' : ''}</p>
      <div class="drg-rev-foto"><img class="art-photo" src="${esc(c.image)}" alt="" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer"></div>
      <p class="drg-rev-n"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</p>
      <p class="drg-rev-t">${rez.noua ? pi(c) : 'O aveai deja.'}</p>
      <p class="drg-rev-c">Foto: ${esc(c.credit)}, ${esc(c.license)}</p>
      ${rez.noua ? '<button class="btn btn-primary" type="button" id="c-rev-ok">Mai departe</button>' : butoaneDublura(c, 'col-dubl-rev')}`;
    wirePhotos($('c-rev'));
    $('c-rev').hidden = false;
    $('c-sari').hidden = true;
    $('c-cutie').classList.add('is-gata');
    haptic(r >= 3 || rez.noua ? 'success' : 'tick');
    window.Sunete && Sunete.lada(r);
    // starea nouă vine din răspunsul serverului
    stare.portofel = { ...stare.portofel, mil: rez.mil, lazi_gratis: rez.lazi_gratis };
    if (!rez.gata) adaugaExemplar(rez.masina, r, rez.exemplar);
  }

  function inchide() {
    if (!stare.cutie || !stare.cutie.gata) return;
    stare.cutie = null;
    $('c-cutie').hidden = true;
    randeazaStare();
    randeazaLazi();
    randeazaColectia();
    randeazaSeturi();
    // misiunea „deschide o ladă” sau un set completat se plătesc acum
    incarcaTacit();
  }

  // ---------- pachetele ----------
  // Ca în Hearthstone: pachetul stă în mijloc; îl atingi, tremură în culoarea celei mai
  // rare mașini din el și se sparge. Cele cinci cărți apar deodată, cu fața în jos, fiecare
  // cu lumina rarității ei în spate (la exotice și legendare, și raze), iar tu alegi pe
  // care o întorci. Cererea pleacă de cum apare pachetul, deci atingerea nu așteaptă.
  const lent = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FATA_PACHET = pk => dupaNume(FATA[pk.lada]);
  // pachetele gratis (din seria de zile) sunt de Sport: stau pe el, ca număr
  const PACHET_GRATIS = 'p-sport';
  function cardPachet(pk) {
    const p = stare.portofel, gratis = p && pk.id === PACHET_GRATIS ? p.pachete_gratis || 0 : 0;
    const ok = !!p && (gratis > 0 || p.mil >= pk.pret), car = FATA_PACHET(pk);
    const pret = gratis ? `${gratis} gratis` : E.mil(pk.pret);
    const img = car ? `<img src="${esc(car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">` : '';
    return `<div class="drg-pk-w"><button class="drg-pk pk-${pk.lada} pk-mare${gratis ? ' is-gratis' : ''}" type="button" data-pachet="${pk.id}"${gratis ? ' data-gratis' : ''}${ok ? '' : ' disabled'} aria-label="${esc(pk.nume)}, ${esc(pret)}">
      <span class="drg-lada pk-folie" aria-hidden="true">
        <span class="drg-lada-foto">${img}</span>
        <span class="pk-nr">×${pk.carti}</span>
        <span class="drg-lada-et">${spInsigna(pk.lada)}<small>Pachet · ${pk.carti} mașini</small>${esc(pk.nume.replace('Pachet ', ''))}</span>
        <span class="drg-lada-pret">${esc(pret)}</span>
        <i class="drg-lada-luciu"></i>
      </span>
      ${pk.garantat ? `<span class="pk-garantat rar-${pk.garantat}">Măcar o ${esc(E.RARITATI[pk.garantat])}</span>` : ''}
    </button></div>`;
  }
  const carteMare = (c, i, rez) => `
    <button class="pk-carte rar-${rar(c)}" type="button" data-i="${i}" style="--i:${i}" aria-label="Întoarce cartea ${i + 1}">
      <i class="pk-raze" aria-hidden="true"></i>
      <span class="pk-carte-in">
        <span class="pk-spate"><img src="img/frq-logo.png" alt=""></span>
        <span class="pk-fata">
          <span class="pk-fata-f">${poza(c)}</span>
          ${rez.noua ? '<i class="pk-noua">Nouă</i>' : '<i class="pk-dubla">Dublură</i>'}
          <small class="pk-fata-r">${E.RARITATI[rar(c)]}</small>
          <span class="pk-fata-m">${esc(brandOf(c.name))}</span>
          <b>${esc(modelOf(c.name) || c.name)}</b>
          <span class="pk-fata-pi">${pi(c)}</span>
        </span>
      </span>
    </button>`;
  const indemn = t => { const p = $('c-scena').querySelector('.pk-indemn'); if (p) p.textContent = t; };

  async function deschidePachet(pk, gratis = false) {
    if (stare.cutie) return;
    stare.cutie = { gata: false, faza: 'lada', pachet: true };
    const cutie = stare.cutie;
    $('c-pk-t').innerHTML = `<small>${gratis ? 'Gratis' : esc(E.mil(pk.pret))} · ${pk.carti} mașini</small>${esc(pk.nume)}${SP ? SP.powered(spLada(pk.lada), 'lada', 'sp-cutie') : ''}`;
    const scena = $('c-scena');
    scena.className = 'pk-scena';
    const car = FATA_PACHET(pk);
    scena.innerHTML = `
      <button class="pk-lada drg-pk pk-${pk.lada}" type="button" id="c-pachet" aria-label="Deschide pachetul">
        <span class="drg-lada pk-folie" aria-hidden="true">
          <span class="drg-lada-foto">${car ? `<img src="${esc(car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">` : ''}</span>
          <span class="pk-nr">×${pk.carti}</span>
          <span class="drg-lada-et"><small>Pachet</small>${esc(pk.nume.replace('Pachet ', ''))}</span>
          <i class="drg-lada-luciu"></i>
        </span>
      </button>
      <div class="pk-mana" id="c-pk-mana"></div>
      <p class="pk-indemn">Atinge pachetul</p>`;
    $('c-pk-act').innerHTML = '';
    $('c-pk').hidden = false;
    haptic();
    const inainte = new Map([...stare.garaj].map(([k, g]) => [k, g.bucati || 1]));
    let r;
    try { r = await FrqCloud.deschidePachet(pk.id, gratis); }
    catch {
      // răspunsul s-a pierdut: ce mașini au apărut în garaj între timp
      r = await ceA_iesitDinPachet(inainte);
      if (!r || r === 'nu') {
        stare.cutie = null;
        $('c-pk').hidden = true;
        alerta(r === 'nu' ? 'Pachetul nu s-a deschis. Banii nu s-au luat.' : 'Nu știm încă dacă pachetul s-a deschis. Uită-te în Colecție când ai semnal.');
        incarcaTacit();
        return;
      }
    }
    const carti = r.carti.map(x => ({ x, car: MD.dupaCheie(x.masina) })).filter(y => y.car);
    if (!carti.length) { stare.cutie = null; $('c-pk').hidden = true; await incarca(); return; }
    cutie.r = r; cutie.carti = carti; cutie.intoarse = new Set();
    stare.deschise++;
    // starea nouă vine din răspunsul serverului
    stare.portofel = { ...stare.portofel, mil: r.mil, lazi_gratis: r.lazi_gratis, ...(r.pachete_gratis != null ? { pachete_gratis: r.pachete_gratis } : {}) };
    if (!r.gata) for (const { x } of carti) adaugaExemplar(x.masina, x.raritate, x.exemplar);
    if (stare.cutie !== cutie) return;
    $('c-pk-mana').innerHTML = carti.map(({ car, x }, i) => carteMare(car, i, x)).join('');
    wirePhotos($('c-pk-mana'));
    if (!lent()) { scena.classList.add('is-deschisa'); cutie.faza = 'carti'; carti.forEach((_, i) => intoarceCartea(i, true)); return; }
    if (cutie.atinsa) spargePachetul();
  }

  // ca la ladă: după un răspuns pierdut, mașinile noi (sau dublurile) din garaj
  async function ceA_iesitDinPachet(inainte) {
    for (let i = 0; i < 3; i++) {
      await new Promise(g => setTimeout(g, 1200 * (i + 1)));
      let p;
      try { p = await FrqCloud.portofel(); } catch { continue; }
      const noi = (p.garaj || []).filter(x => (x.bucati || 1) > (inainte.get(x.masina) || 0));
      if (!noi.length) return 'nu';
      aplicaPortofel(p);
      return { gata: true, carti: noi.map(g => ({ masina: g.masina, raritate: g.raritate, noua: !inainte.has(g.masina), bucati: g.bucati || 1 })), mil: p.portofel.mil, lazi_gratis: p.portofel.lazi_gratis, pachete_gratis: p.portofel.pachete_gratis };
    }
    return null;
  }

  // pachetul atins: tremură în culoarea celei mai rare mașini din el, apoi se sparge
  function spargePachetul() {
    const cutie = stare.cutie;
    if (!cutie || cutie.faza !== 'lada') return;
    cutie.faza = 'sparge';
    const r = Math.max(...cutie.carti.map(({ car }) => rar(car))), scena = $('c-scena');
    scena.classList.add(`rar-${r}`, 'is-sparge');
    indemn('');
    [0, 380, 700, 900].forEach(t => setTimeout(() => stare.cutie === cutie && haptic('tick'), t));
    setTimeout(() => {
      if (stare.cutie !== cutie) return;
      scena.classList.add('is-deschisa');
      haptic(r >= 3 ? 'success' : 'tick');
      cutie.faza = 'carti';
      indemn('Atinge o carte');
      $('c-pk-act').innerHTML = '<button class="btn btn-ghost" type="button" id="c-pk-tot">Întoarce tot</button>';
    }, 1150);
  }
  function intoarceCartea(i, tacut = false) {
    const cutie = stare.cutie;
    if (!cutie || cutie.faza !== 'carti' || cutie.intoarse.has(i)) return;
    cutie.intoarse.add(i);
    const el = $('c-pk-mana').querySelector(`[data-i="${i}"]`), { car, x } = cutie.carti[i], r = rar(car);
    el.classList.remove('is-apasata');
    el.classList.add('is-intoarsa');
    // întâi apăsarea (o vibrație scurtă); sunetul și vibrația mare când se vede mașina
    if (!tacut) {
      haptic('tick');
      setTimeout(() => { haptic(r >= 3 || x.noua ? 'success' : 'tick'); window.Sunete && Sunete.lada(r); }, 380);
    }
    indemn(cutie.intoarse.size < cutie.carti.length ? 'Atinge o carte' : '');
    if (cutie.intoarse.size === cutie.carti.length) gataPachetul();
  }
  function gataPachetul() {
    const cutie = stare.cutie;
    cutie.gata = true;
    const noi = cutie.carti.filter(y => y.x.noua).length, dubl = cutie.carti.length - noi;
    const leg = cutie.carti.filter(y => rar(y.car) === 4).length;
    $('c-pk-act').innerHTML = `
      <p class="pk-rez">${leg ? `<b class="rar-4">${leg === 1 ? 'O legendară!' : `${leg} legendare!`}</b> · ` : ''}${noi === 1 ? '1 nouă' : `${noi} noi`}${dubl ? ` · ${dubl === 1 ? '1 dublură' : `${dubl} dubluri`}` : ''}</p>
      <div class="pk-act-b">${dubl ? '<button class="btn btn-ghost" type="button" id="c-pk-dubl">Dubluri</button>' : ''}<button class="btn btn-primary" type="button" id="c-pk-ok">Gata</button></div>`;
  }
  function inchidePachetul() {
    if (!stare.cutie || !stare.cutie.gata) return;
    stare.cutie = null;
    $('c-pk').hidden = true;
    randeazaStare(); randeazaLazi(); randeazaColectia(); randeazaSeturi();
    incarcaTacit();
  }
  // apăsarea se simte: cartea se lasă sub deget până ridici degetul
  const apasa = (e, jos) => {
    const c = e.target.closest && e.target.closest('.pk-mana .pk-carte');
    if (jos && c && !c.classList.contains('is-intoarsa')) c.classList.add('is-apasata');
    if (!jos) $('c-pk').querySelectorAll('.is-apasata').forEach(x => x.classList.remove('is-apasata'));
  };
  $('c-pk').addEventListener('pointerdown', e => apasa(e, true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('c-pk').addEventListener(t, e => apasa(e, false)));
  $('c-pk').addEventListener('click', e => {
    const cutie = stare.cutie;
    if (!cutie || !cutie.pachet) return;
    if (e.target.closest('#c-pk-ok')) { inchidePachetul(); return; }
    if (e.target.closest('#c-pk-dubl')) { inchidePachetul(); Shared.mergi('#dubluri'); return; }
    if (e.target.closest('#c-pk-tot')) {
      cutie.carti.map((_, i) => i).filter(i => !cutie.intoarse.has(i)).forEach((i, n) => setTimeout(() => intoarceCartea(i), n * 450));
      return;
    }
    if (e.target.closest('#c-pachet') && !cutie.atinsa) {
      cutie.atinsa = true;
      $('c-scena').classList.add('is-atinsa');
      haptic();
      if (cutie.carti) spargePachetul();
      return;
    }
    const c = e.target.closest('.pk-carte');
    if (c) intoarceCartea(+c.dataset.i);
  });


  // ---------- colecția ----------
  let vazator = null;
  function randeazaFiltre() {
    const ale = r => [...stare.garaj.values()].filter(g => r < 0 || g.raritate === r).length;
    const tot = r => (r < 0 ? POOL.length : PE_RARITATE[r].length);
    const buton = (r, eticheta) => `<button type="button" role="radio" class="col-f${r >= 0 ? ` rar-${r}` : ''}${stare.filtru === r ? ' is-on' : ''}" aria-checked="${stare.filtru === r}" data-r="${r}"><span>${eticheta}</span><small>${ale(r)}/${tot(r)}</small></button>`;
    $('c-filtre').innerHTML = buton(-1, 'Toate') + PLURAL_RAR.map((n, r) => buton(r, n)).reverse().join('');
  }
  function randeazaColectia() {
    // grila are toate mașinile (~700, aproape 10.000 de elemente): se face doar când se
    // vede; altfel doar se ține minte că trebuie refăcută (pagina se deschidea greu)
    if (document.body.dataset.pas !== 'colectie') { stare.colVeche = true; return; }
    stare.colVeche = false;
    randeazaFiltre();
    const setul = stare.set && SETURI.find(x => x.id === stare.set);
    const inSet = setul ? new Set(setul.chei) : null;
    $('c-set-activ').hidden = !setul;
    if (setul) $('c-set-activ').innerHTML = `Setul <b>${esc(setul.nume)}</b> <button type="button" class="col-set-x" data-set-x aria-label="Arată toată colecția">&times;</button>`;
    const lista = POOL
      .filter(c => !inSet || inSet.has(M.cheieMasina(c)))
      .filter(c => stare.filtru < 0 || rar(c) === stare.filtru)
      .filter(c => !stare.doar || stare.garaj.has(M.cheieMasina(c)))
      // întâi ce ai (după raritate, de la cea mai rapidă), apoi ce-ți lipsește
      .sort((a, b) => stare.garaj.has(M.cheieMasina(b)) - stare.garaj.has(M.cheieMasina(a)) || rar(b) - rar(a) || TIMP.get(a) - TIMP.get(b));
    $('c-grid').innerHTML = lista.length ? lista.map(c => {
      const g = stare.garaj.get(M.cheieMasina(c));
      const f = g ? poza(c).replace(' src="', ' data-src="') : fara(c);
      const niv = g ? g.nivel || 0 : 0;
      return `<button type="button" class="col-c rar-${rar(c)}${g ? ' is-a-mea' : ''}" data-det="${esc(M.cheieMasina(c))}">
        <span class="col-c-f">${f}${g ? '' : '<i class="col-c-q" aria-hidden="true">?</i>'}${g && g.bucati > 1 ? `<i class="col-c-x">×${g.bucati}</i>` : ''}${niv ? `<i class="col-c-niv">Nv ${M.nivelTotal(niv)}</i>` : ''}</span>
        <b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))}</small><span class="col-c-v">${c.hp ? `${c.hp} CP` : ''}${c.hp && c.accel ? ' · ' : ''}${c.accel ? `${fmt(c.accel, 1)} s` : ''}</span>
      </button>`;
    }).join('') : '<p class="col-gol">Nicio mașină aici încă. Deschide o ladă.</p>';
    if (vazator) vazator.disconnect();
    const incarcaImg = img => { img.src = img.dataset.src; img.removeAttribute('data-src'); wirePhotos(img.closest('.col-c-f')); };
    const imgs = $('c-grid').querySelectorAll('img[data-src]');
    if (!('IntersectionObserver' in window)) { imgs.forEach(incarcaImg); return; }
    vazator = new IntersectionObserver(intrari => intrari.forEach(x => {
      if (!x.isIntersecting) return;
      vazator.unobserve(x.target);
      incarcaImg(x.target);
    }), { rootMargin: '400px 0px' });
    imgs.forEach(img => vazator.observe(img));
  }

  // ---------- o mașină din garaj: tuning ----------
  // Tuningul e gândit pentru Cursă (cursa-model.js): fiecare piesă ajută într-un loc al
  // circuitului, iar scorul și clasa vin din timpul pe tur după tuning. Costul crește cu
  // raritatea și cu nivelul. În Startul, piesele își păstrează efectul lor de drag.
  let detaliu = null, detaliuEx = null;
  // în Duel de cărți: la ce domină și dacă e în pachet
  function blocDuel(k, lipsa = false) {
    const d = domina(k);
    if (!d) return '';
    return `<p class="col-joc-t">În Duel de cărți</p>
      <table class="col-det-t"><tbody>
        <tr><th>Domină la</th><td>${esc(d.cat)} · top ${d.top}%</td></tr>
        <tr><th>În pachetul tău</th><td>${lipsa ? 'Nu o ai încă' : inPachet(k) ? 'Da' : '<a class="col-link" href="carti.html#pachet">Nu · Pachetul tău</a>'}</td></tr>
      </tbody></table>`;
  }
  // Cursa, ca bare: cât de rapidă e (cu tuningul exemplarului) și ce a adus tuningul, mai deschis
  let circ = null;
  const turul = (c, niv) => CMod.timpTur(CMod.parametri(c, niv), circ || (circ = CMod.circuit(CMod.REFERINTA)));
  function cifreCursa(c, niv) {
    const p = CMod.parametri(c, niv);
    let v = 0, t = 0; while (v < 27.78 && t < 30) { v += Math.max(0, CMod.acc(p, v)) * .01; t += .01; }
    return { kmh: p.vmax * 3.6, t100: t, viraje: Math.min(10, Math.max(0, (p.alat - 10.5) / .85)), frana: Math.min(10, Math.max(0, (p.abr - 8) / .7)) };
  }
  function blocCursa(c, niv) {
    const a = cifreCursa(c, niv), s = niv ? cifreCursa(c, 0) : a, f1 = x => String(Math.round(x * 10) / 10).replace('.', ',');
    const prc = x => Math.max(4, Math.min(100, x * 100));
    const bara = (et, val, x, x0) => `<div class="col-st"><span>${et}</span><i><u style="width:${prc(x0)}%"></u>${x > x0 + .005 ? `<s style="left:${prc(x0)}%;width:${prc(x) - prc(x0)}%"></s>` : ''}</i><b>${val}</b></div>`;
    const tur = turul(c, niv), m = Math.floor(tur / 60);
    return `<div class="col-cursa">
      <p class="col-cursa-h"><span>În Cursă</span>${pi(c, niv)}<small>${m}:${(tur - m * 60).toFixed(2).padStart(5, '0').replace('.', ',')} pe tur</small></p>
      ${bara('Viteză', `${Math.round(a.kmh)} km/h`, (a.kmh - 140) / 300, (s.kmh - 140) / 300)}
      ${bara('0-100', `${f1(a.t100)} s`, (12 - a.t100) / 10, (12 - s.t100) / 10)}
      ${bara('Viraje', f1(a.viraje), a.viraje / 10, s.viraje / 10)}
      ${bara('Frânare', f1(a.frana), a.frana / 10, s.frana / 10)}
    </div>`;
  }
  function randeazaDetaliu() {
    const g = stare.garaj.get(detaliu);
    if (!g) { randeazaVitrina(); return; }
    const c = MD.dupaCheie(g.masina);
    if (!c) { $('c-det').hidden = true; return; }
    // exemplarul ales (implicit cel mai tunat): tuningul și vânzarea sunt ale lui
    const lista = ordine(exemplare(g.masina));
    const ex = lista.find(e => e.id != null && e.id === detaliuEx) || lista[0] || { id: null, nivel: g.nivel || 0, blocat: g.blocat };
    detaliuEx = ex.id;
    const niv = ex.nivel || 0, max = E.TUNING.max, p = CMod.piese(niv);
    const sc = CMod.scor(c, niv), clasa = sc.k;
    const ai = ((stare.portofel && stare.portofel.puncte) || [0, 0, 0, 0, 0])[rar(c)];
    // cele patru piese: nivelul, ce face, cât costă următorul și unde ajunge scorul
    const randPiesa = (i, ce) => {
      const n = p[i], bani = E.TUNING.peBani.includes(i);
      const cost = n >= max ? 0 : bani ? E.TUNING.mil(rar(c), n) : E.TUNING.puncte(n);
      const urm = n < max ? CMod.codPiese(p.map((x, j) => (j === i ? x + 1 : x))) : null;
      // Nitro nu mută scorul: arată ce primești la nivelul următor
      const nx = i === 4 && CMod.nitro(Math.min(max, n + 1));
      const cel = k => (k === 1 ? '1 celulă' : `${k} celule`);
      const castig = urm != null && i !== 4 ? turul(c, niv) - turul(c, urm) : 0;
      const efect = n >= max ? (i === 4 ? cel(CMod.nitro(n).celule) : 'Maxim') : i === 4 ? (n ? `${CMod.nitro(n).celule} &rarr; ${cel(nx.celule)}` : `Fără &rarr; ${cel(nx.celule)}`) : `&rarr; ${pi(c, urm)} <em>−${castig.toFixed(2).replace('.', ',')} s</em>`;
      const poate = n < max && !ex.blocat && (bani ? ((stare.portofel && stare.portofel.mil) || 0) : ai) >= cost;
      return `<li class="col-piesa">
        <span class="col-piesa-t"><b>${CMod.PIESE[i]}</b><small>${ce}</small></span>
        <span class="col-piesa-n" aria-label="Nivel ${n} din ${max}">${Array.from({ length: max }, (_, k) => `<i class="${k < n ? 'is-on' : ''}"></i>`).join('')}</span>
        <span class="col-piesa-e">${efect}</span>
        <button class="btn ${poate ? 'btn-primary' : 'btn-ghost'}" type="button" data-piesa="${i}"${poate ? '' : ' disabled'}>${n >= max ? '5/5' : `+1 · ${bani ? E.mil(cost) : `${cost} pct.`}`}</button>
      </li>`;
    };
    $('c-det-in').className = `modal col-det-in rar-${clasa}`;
    $('c-det-in').innerHTML = `
      <div class="col-det-f">${poza(c)}</div>
      <p class="col-det-r">${E.RARITATI[rar(c)]}</p>
      <h2 class="col-det-n" id="c-det-t"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</h2>
      <p class="col-det-spec">${[c.hp ? `${c.hp} CP` : '', c.weight ? `${c.weight} kg` : '', c.engine ? esc(c.engine) : ''].filter(Boolean).join(' &middot; ')}</p>
      ${blocDuel(g.masina)}
      ${blocCursa(c, niv)}
      ${blocExemplare(c, lista, ex)}
      <p class="label col-piese-t">Tuning pentru Cursă<span>${puncteText(ai, rar(c))} · ${E.mil((stare.portofel && stare.portofel.mil) || 0)}</span></p>
      <ul class="col-piese">
        ${randPiesa(0, 'Viraje și frânare, frâna mai iertătoare')}
        ${randPiesa(1, 'Mai ușoară: puțin peste tot')}
        ${randPiesa(2, 'Accelerație și viteză maximă')}
        ${randPiesa(3, 'Ieșirea din virajele lente')}
        ${randPiesa(4, 'Fără ea n-ai nitro. O celulă pe nivel')}
      </ul>
      ${ex.blocat ? '<p class="col-nota">E pus într-un duel: îl tunezi după.</p>' : ai < 2 ? `<p class="col-nota">Punctele ${PLURAL_RAR[rar(c)].toLowerCase()} le iei din dubluri.</p>` : ''}
      <div class="modal-actions col-det-act">
        ${nrDubluriMasina(g.masina) ? `<button class="btn btn-ghost" type="button" data-dubl="puncte">+1 punct ${PUNCT_SG[rar(c)]}</button>` : ''}
        <button class="btn btn-ghost" type="button" data-vinde${ex.id == null || ex.blocat ? ' disabled' : ''}>Vinde · +${E.mil(E.valoareExemplar(valoare(g.masina), rar(c), niv))}</button>
        <button class="btn btn-ghost" type="button" data-inchide>Închide</button>
      </div>`;
    wirePhotos($('c-det-in'));
    $('c-det').hidden = false;
  }
  // Exemplarele mașinii, pe mașină: câte unul pentru fiecare tunat (sau pus într-un duel),
  // cele netunate împreună. Alegi pe care îl tunezi sau îl vinzi.
  function blocExemplare(c, lista, ex) {
    if (lista.length < 2) return '';
    const grupe = [];
    for (const e of lista) {
      const simplu = !e.nivel && !e.blocat;
      const g = simplu && grupe.find(x => x.simplu);
      if (g) g.n++; else grupe.push({ e, simplu, n: 1 });
    }
    return `<p class="label col-ex-t">Exemplarele tale<span>${lista.length}</span></p>
      <div class="col-ex" role="radiogroup" aria-label="Exemplarul">${grupe.map(({ e, simplu, n }) => {
        const on = simplu ? !ex.nivel && !ex.blocat : e === ex;
        return `<button type="button" class="col-ex-b${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-ex="${e.id ?? ''}">
          ${pi(c, e.nivel)}<small>${e.blocat ? 'În duel' : simplu ? (n > 1 ? `Netunat ×${n}` : 'Netunat') : `Nivel ${M.nivelTotal(e.nivel)}`}</small></button>`;
      }).join('')}</div>`;
  }
  // Vinde exemplarul ales: prețul mașinii plus jumătate din tuningul lui. Ultimul scoate
  // mașina din colecție (seturile plătite rămân plătite), deci întrebăm înainte.
  async function vindeExemplar() {
    const g = stare.garaj.get(detaliu), c = g && MD.dupaCheie(g.masina);
    const ex = exemplare(detaliu).find(e => e.id === detaliuEx);
    if (!c || !ex || ex.blocat) return;
    const suma = E.valoareExemplar(valoare(detaliu), rar(c), ex.nivel);
    const ultimul = exemplare(detaliu).length === 1;
    const text = ultimul ? I18n.t('E ultimul exemplar: {m} iese din colecție. O vinzi cu {p}?', { m: c.name, p: E.mil(suma) })
      : I18n.t('Vinzi exemplarul cu {p}?', { p: E.mil(suma) });
    if (!(await Shared.intreaba(text, { da: 'Vinde', nu: 'Nu acum', titlu: ultimul ? 'Ultimul exemplar' : 'Vinzi?' }))) return;
    try {
      const r = await FrqCloud.vinde(ex.id);
      stare.portofel = { ...stare.portofel, mil: r.mil };
      stare.ex.set(detaliu, exemplare(detaliu).filter(e => e !== ex));
      refaMasina(detaliu);
      detaliuEx = null;
      haptic('success');
      window.Sunete && Sunete.oferta();
      randeazaStare(); randeazaLazi(); randeazaColectia(); randeazaSeturi(); randeazaMeniuG();
      if (!stare.garaj.has(detaliu)) { $('c-det').hidden = true; alerta(I18n.t('Vândută cu {p}.', { p: E.mil(r.valoare) })); return; }
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      alerta(k === 'blocata' ? 'E pus într-un duel.' : 'Nu s-a putut vinde acum.');
      await incarcaTacit();
    }
    randeazaDetaliu();
  }
  // Vitrina: exact mașina care îți lipsește, mai scump decât o ladă, dar sigur.
  function randeazaVitrina() {
    const c = MD.dupaCheie(detaliu);
    if (!c) { $('c-det').hidden = true; return; }
    const r = rar(c), pret = E.VITRINA[r], bani = stare.portofel ? stare.portofel.mil : 0;
    const seturi = SETURI.filter(x => x.chei.includes(detaliu)).map(x => x.nume);
    $('c-det-in').className = `modal col-det-in rar-${r}`;
    $('c-det-in').innerHTML = `
      <div class="col-det-f">${poza(c)}</div>
      <p class="col-det-r">${E.RARITATI[r]} &middot; nu o ai încă</p>
      <h2 class="col-det-n" id="c-det-t"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</h2>
      ${blocDuel(detaliu, true)}
      ${blocCursa(c, 0)}
      ${seturi.length ? `<table class="col-det-t"><tbody><tr><th>În seturile</th><td class="col-det-set">${seturi.map(esc).join(', ')}</td></tr></tbody></table>` : ''}
      <p class="col-nota">Din Vitrina iei exact mașina asta. O ladă e mai ieftină, dar e la noroc.${stare.portofel && bani < pret ? ` Îți trebuie ${E.mil(pret)}.` : ''}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" id="c-cumpara"${stare.portofel && bani >= pret ? '' : ' disabled'}>Cumpără: ${E.mil(pret)}</button>
        <button class="btn btn-ghost" type="button" data-inchide>Închide</button>
      </div>`;
    wirePhotos($('c-det-in'));
    $('c-det').hidden = false;
  }
  async function cumpara() {
    const b = $('c-cumpara');
    if (!b || b.disabled) return;
    const c = MD.dupaCheie(detaliu);
    const pret = E.VITRINA[rar(c)];
    if (!(await Shared.intreaba(I18n.t('Cumperi {m}? Costă {p}', { m: c.name, p: E.mil(pret) }), { da: 'Cumpără', nu: 'Nu acum' }))) return;
    b.disabled = true;
    try {
      const r = await FrqCloud.cumpara(detaliu);
      adaugaExemplar(r.masina, r.raritate, null);
      stare.portofel = { ...stare.portofel, mil: r.mil };
      haptic('success');
      randeazaStare();
      randeazaLazi();
      randeazaColectia();
      randeazaSeturi();
      // un set completat așa se plătește la următoarea încărcare a stării
      incarcaTacit();
    } catch (e) {
      const k = await FrqCloud.codEroare(e);
      alerta(k === 'bani' ? 'Nu ai destui bani.' : 'Nu s-a putut cumpăra acum.');
      // poate s-a cumpărat totuși (răspuns pierdut): garajul de pe server
      await incarcaTacit();
    }
    randeazaDetaliu();
  }

  // ---------- misiunile zilei ----------
  function randeazaMisiuni() {
    const l = stare.misiuni;
    $('c-mis-sec').hidden = !l || !l.length;
    if (!l) return;
    $('c-mis').innerHTML = l.map(m => `<li class="${m.gata ? 'is-gata' : ''}">
      <span class="col-mis-t">${esc(m.text)}</span>
      <span class="col-mis-b" aria-hidden="true"><i style="width:${Math.round((100 * m.progres) / m.n)}%"></i></span>
      <span class="col-mis-p">${m.gata ? '&#10003;' : `${m.progres}/${m.n}`}</span>
      <span class="col-mis-r">+${esc(E.mil(m.mil))}</span>
      ${m.gata ? '' : `<a class="col-mis-l" href="${esc(m.link)}">Joacă</a>`}
    </li>`).join('');
  }

  // ---------- seturile ----------
  function randeazaSeturi() {
    const are = k => stare.garaj.has(k);
    const lista = window.Seturi.progres(SETURI, are)
      .sort((a, b) => (a.ai === a.chei.length) - (b.ai === b.chei.length) || b.ai / b.chei.length - a.ai / a.chei.length || a.chei.length - b.chei.length);
    const complete = lista.filter(x => x.ai === x.chei.length).length;
    $('c-set-n').textContent = `${complete} din ${SETURI.length}`;
    const arata = stare.toateSeturile ? lista : lista.slice(0, 6);
    $('c-seturi').innerHTML = arata.map(x => {
      const gata = x.ai === x.chei.length;
      return `<button type="button" class="col-set${gata ? ' is-gata' : ''}${stare.set === x.id ? ' is-on' : ''}" data-set="${esc(x.id)}">
        <span class="col-set-t">${esc(x.nume)}</span>
        <span class="col-mis-b" aria-hidden="true"><i style="width:${Math.round((100 * x.ai) / x.chei.length)}%"></i></span>
        <span class="col-set-p">${x.ai}/${x.chei.length}</span>
        <span class="col-set-r">${gata ? 'Luat &#10003;' : `+${esc(E.mil(x.premiu))}`}</span>
      </button>`;
    }).join('');
    $('c-set-tot').textContent = stare.toateSeturile ? 'Mai puține' : 'Toate seturile';
  }
  $('c-seturi').addEventListener('click', e => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    stare.set = stare.set === b.dataset.set ? null : b.dataset.set;
    stare.filtru = -1;
    stare.doar = false;
    $('c-doar').checked = false;
    haptic();
    randeazaSeturi();
    randeazaColectia();
    // un set ales: colecția, doar cu mașinile lui
    if (stare.set) Shared.mergi('#colectie');
  });
  $('c-set-tot').addEventListener('click', () => { stare.toateSeturile = !stare.toateSeturile; randeazaSeturi(); });
  $('c-set-activ').addEventListener('click', e => {
    if (!e.target.closest('[data-set-x]')) return;
    stare.set = null;
    randeazaSeturi();
    randeazaColectia();
  });

  // ---------- premiile primite (săptămâna, cupa, seturi, misiuni) ----------
  // ecranul de premii comun (frq-cloud.js), la fel ca pe prima pagină
  const anuntaPremii = premii => FrqCloud.arataPremiiNoi(premii);
  function aplicaPortofel(r) {
    stare.portofel = r.portofel;
    stare.garaj = new Map((r.garaj || []).map(g => [g.masina, g]));
    // fără exemplare (un portofel salvat de o versiune veche): câte unul pe bucată
    stare.ex = new Map();
    if (Array.isArray(r.exemplare)) for (const e of r.exemplare) stare.ex.set(e.masina, [...exemplare(e.masina), { id: e.id, nivel: e.nivel || 0, blocat: !!e.blocat }]);
    else for (const g of r.garaj || []) stare.ex.set(g.masina, Array.from({ length: g.bucati || 1 }, (_, i) => ({ id: null, nivel: i ? 0 : g.nivel || 0, blocat: !i && !!g.blocat })));
    stare.misiuni = r.misiuni;
    stare.dinJocuri = r.azi ? r.azi.din_jocuri || 0 : null;
    stare.bonus = r.bonus || null;
  }
  async function incarcaTacit() {
    try {
      const r = await FrqCloud.portofel();
      aplicaPortofel(r);
      randeazaStare(); randeazaLazi(); randeazaMisiuni(); randeazaSeturi(); randeazaDubluri(); randeazaMeniuG();
      anuntaPremii(r.premii);
    } catch { /* rămâne ce e pe ecran */ }
  }

  async function tuneaza(piesa) {
    const b = $('c-det-in').querySelector(`[data-piesa="${piesa}"]`);
    if (!b || b.disabled) return;
    b.disabled = true;
    try {
      const r = await FrqCloud.tuneaza(detaliu, piesa, detaliuEx ?? undefined);
      const ex = exemplare(detaliu).find(e => e.id === r.exemplar) || exemplare(detaliu).find(e => e.id == null);
      if (ex) { ex.nivel = r.nivel; ex.id = r.exemplar ?? ex.id; detaliuEx = ex.id; }
      refaMasina(detaliu);
      stare.portofel = { ...stare.portofel, mil: r.mil, puncte: r.puncte };
      haptic('success');
      randeazaStare();
      randeazaLazi();
      randeazaColectia();
    } catch (e) {
      // răspunsul se poate pierde după ce serverul a făcut deja tuning-ul: luăm garajul
      // de pe server, ca să nu apeși din nou pe un nivel deja plătit
      const k = await FrqCloud.codEroare(e);
      alerta({ bani: 'Nu ai destui bani.', puncte: 'Nu ai destule puncte.', blocata: 'E pusă într-un duel.', maxim: 'Piesa e deja la maxim.' }[k] || 'Tuning-ul nu s-a putut face acum.');
      await incarcaTacit();
    }
    randeazaDetaliu();
  }
  $('c-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-det]');
    if (!b) return;
    detaliu = b.dataset.det;
    detaliuEx = null;
    haptic();
    randeazaDetaliu();
  });
  $('c-det').addEventListener('click', e => {
    const tp = e.target.closest('[data-piesa]');
    if (tp) { tuneaza(+tp.dataset.piesa); return; }
    if (e.target.closest('#c-cumpara')) { cumpara(); return; }
    const x = e.target.closest('[data-ex]');
    if (x) { detaliuEx = x.dataset.ex ? +x.dataset.ex : null; haptic('tick'); randeazaDetaliu(); return; }
    const v = e.target.closest('[data-vinde]');
    if (v && !v.disabled) { vindeExemplar(); return; }
    const d = e.target.closest('[data-dubl]');
    if (d && !d.disabled && detaliu) {
      d.disabled = true;
      schimbaDublura(detaliu, d.dataset.dubl)
        .then(() => { randeazaColectia(); randeazaDetaliu(); })
        .catch(() => { alerta('Nu s-a putut acum. Mai încearcă.'); incarcaTacit().then(randeazaDetaliu); });
      return;
    }
    if (e.target.closest('[data-inchide]') || e.target === $('c-det')) $('c-det').hidden = true;
  });

  function alerta(text) {
    const el = document.createElement('p');
    el.className = 'col-alerta';
    el.setAttribute('role', 'status');
    el.textContent = I18n.t(text);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- dublurile ----------
  // Fiecare mașină cu dubluri, pe un rând: alegi ce faci cu dublurile ei (le vinzi, le
  // faci puncte sau le păstrezi). Nimic nu se schimbă până nu confirmi; la final, un
  // rezumat cu ce ai primit. (Lăzile de câte una le vând și direct, la deschidere.)
  const alegeri = new Map();   // masina -> 'vinde' | 'puncte'
  // dublurile sunt exemplarele netunate în plus; cele tunate le vinzi din mașina lor
  const cuDubluri = () => [...stare.garaj.values()]
    .map(g => ({ g, c: MD.dupaCheie(g.masina), n: nrDubluriMasina(g.masina) })).filter(x => x.c && x.n > 0)
    .sort((a, b) => rar(b.c) - rar(a.c) || a.c.name.localeCompare(b.c.name));
  const nrDubluri = () => cuDubluri().reduce((s, x) => s + x.n, 0);
  function randeazaDubluri() {
    if (document.body.dataset.pas !== 'dubluri') return;
    const l = cuDubluri();
    for (const k of [...alegeri.keys()]) if (!l.some(x => x.g.masina === k)) alegeri.delete(k);
    $('c-dubl').innerHTML = l.length ? l.map(({ g, c, n }) => {
      const r = rar(c), v = valoare(g.masina), ales = alegeri.get(g.masina) || '';
      const opt = (id, text) => `<button type="button" class="${ales === id ? 'is-on' : ''}" data-alege="${id}" aria-pressed="${ales === id}">${text}</button>`;
      return `<li class="col-dub rar-${r}" data-masina="${esc(g.masina)}">
        <span class="col-dub-f">${poza(c)}</span>
        <span class="col-dub-n"><small>${E.RARITATI[r]} · ${n === 1 ? '1 dublură' : `${n} dubluri`}</small><b>${esc(c.name)}</b></span>
        <span class="col-dub-o">${opt('', 'Păstrează')}${opt('vinde', `Vinde +${E.mil(v * n)}`)}${opt('puncte', `+${n} ${n === 1 ? 'punct' : 'puncte'}`)}</span>
      </li>`;
    }).join('') : '';
    $('c-dubl-gol').hidden = l.length > 0;
    wirePhotos($('c-dubl'));
    randeazaTotalDubluri();
  }
  // ce primești dacă confirmi acum
  function randeazaTotalDubluri() {
    let mil = 0, puncte = 0;
    for (const { g, n } of cuDubluri()) {
      const a = alegeri.get(g.masina);
      if (a === 'vinde') mil += valoare(g.masina) * n;
      if (a === 'puncte') puncte += n;
    }
    const b = $('c-dubl-ok');
    b.disabled = !alegeri.size;
    b.textContent = I18n.t(alegeri.size ? `Confirmă · ${[mil ? `+${E.mil(mil)}` : '', puncte ? `+${puncte === 1 ? '1 punct' : `${puncte} puncte`}` : ''].filter(Boolean).join(' · ')}` : 'Confirmă');
    $('c-dubl-bara').hidden = !cuDubluri().length;
  }
  $('c-dubl').addEventListener('click', e => {
    const b = e.target.closest('[data-alege]');
    if (!b) return;
    const m = b.closest('[data-masina]').dataset.masina;
    if (b.dataset.alege) alegeri.set(m, b.dataset.alege); else alegeri.delete(m);
    haptic('tick');
    b.parentElement.querySelectorAll('[data-alege]').forEach(x => {
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', on);
    });
    randeazaTotalDubluri();
  });
  $('c-dubl-ok').addEventListener('click', async () => {
    const lista = cuDubluri().filter(x => alegeri.has(x.g.masina)).map(x => ({ masina: x.g.masina, alegere: alegeri.get(x.g.masina), n: x.n }));
    const b = $('c-dubl-ok');
    if (!lista.length || b.disabled) return;
    b.disabled = true;
    let r;
    try { r = await FrqCloud.dubluri(lista); } catch {
      alerta('Nu s-a putut acum. Mai încearcă.');
      await incarcaTacit();
      randeazaTotalDubluri();
      return;
    }
    stare.portofel = { ...stare.portofel, mil: r.mil, puncte: r.puncte };
    for (const x of r.facute) while (exemplare(x.masina).length > x.bucati && netunate(x.masina).length) scoateDublura(x.masina);
    alegeri.clear();
    haptic('success');
    window.Sunete && Sunete[r.vandute ? 'oferta' : 'pune']();
    randeazaStare(); randeazaDubluri(); randeazaColectia(); randeazaMeniuG();
    const rows = [];
    if (r.vandute) rows.push({ text: 'Vândute', sub: r.vandute === 1 ? '1 dublură' : `${r.vandute} dubluri`, mil: r.mil_primit });
    r.puncte_primite.forEach((n, rr) => { if (n) rows.push({ text: `Puncte ${PLURAL_RAR[rr].toLowerCase()}`, sub: 'Pentru tuning', val: `+${n}` }); });
    if (rows.length) FrqCloud.ecranPremii(rows, { titlu: 'Din dubluri' });
    else alerta('Nu s-a schimbat nimic. Poate o mașină e pusă într-un duel.');
  });

  // ---------- garajul altcuiva ----------
  // Din clasamentul garajului (numele) sau dintr-un link (colectie.html?garaj=...): scorul,
  // câte mașini, legendarele, seturile și cele mai tari 12 mașini ale lui, fiecare cu cel
  // mai tunat exemplar. Fereastra are înălțimea fixă de la început, ca să nu sară.
  async function arataGarajul(cine) {
    const ov = document.createElement('div');
    ov.className = 'overlay gp-ov';
    ov.innerHTML = '<div class="modal cls-mod gp-mod" role="dialog" aria-modal="true" aria-labelledby="gp-t">'
      + '<div class="cls-cap"><div><p class="cls-k">Garaj</p><h2 class="cls-t" id="gp-t">&nbsp;</h2></div><button class="cls-x" type="button" aria-label="Închide">&times;</button></div>'
      + '<div class="gp-stare"><div class="col-bani"><small>Scor</small><b>…</b></div><div class="col-bani"><small>Mașini</small><b>…</b></div><div class="col-bani"><small>Legendare</small><b>…</b></div><div class="col-bani"><small>Seturi</small><b>…</b></div></div>'
      + '<p class="label gp-l">Cele mai tari 12</p><div class="gp-grid"></div><div class="gp-act"></div></div>';
    document.body.appendChild(ov);
    const inchide = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.cls-x, [data-gp-x]')) inchide(); });
    let r;
    try { r = await FrqCloud.garajPublic(cine); } catch { r = undefined; }
    if (!r) { ov.querySelector('.gp-grid').innerHTML = '<p class="cls-gol">Garajul nu se poate vedea acum.</p>'; return; }
    ov.querySelector('#gp-t').textContent = r.nume;
    const nr = n => Number(n || 0).toLocaleString('ro-RO');
    ov.querySelectorAll('.gp-stare b').forEach((b, i) => { b.textContent = [nr(r.scor), nr(r.masini), nr(r.legendare), nr(r.seturi)][i]; });
    // cel mai tunat exemplar al fiecărei mașini (lista vine cu cele mai tunate întâi)
    const niv = new Map();
    for (const e of r.exemplare || []) if (!niv.has(e.masina)) niv.set(e.masina, e.nivel || 0);
    const top = (r.chei || []).map(k => ({ k, c: MD.dupaCheie(k), n: niv.get(k) || 0 })).filter(x => x.c)
      .map(x => ({ ...x, v: CMod.scor(x.c, x.n).v })).sort((a, b) => b.v - a.v).slice(0, 12);
    ov.querySelector('.gp-grid').innerHTML = top.map(({ c, n }) => '<div class="gp-c rar-' + rar(c) + '"><span class="gp-f">' + poza(c)
      + (n ? '<i class="col-c-niv">Nv ' + M.nivelTotal(n) + '</i>' : '') + '</span><b>' + esc(modelOf(c.name) || c.name) + '</b><small>' + esc(brandOf(c.name)) + '</small>' + pi(c, n) + '</div>').join('')
      || '<p class="cls-gol">Nicio mașină încă.</p>';
    wirePhotos(ov.querySelector('.gp-grid'));
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'colectie.html?garaj=' + encodeURIComponent(r.id_public || cine);
    ov.querySelector('.gp-act').innerHTML = r.eu
      ? '<button class="btn btn-primary" type="button" data-gp-trimite>Trimite garajul tău</button>'
      : '<button class="btn btn-ghost" type="button" data-gp-x>Închide</button><button class="gp-rap" type="button" data-raport-nume="' + esc(r.nume) + '">Raportează numele</button>';
    const t = ov.querySelector('[data-gp-trimite]');
    if (t) t.addEventListener('click', async () => {
      try { if (navigator.share) { await navigator.share({ title: 'Garajul meu FRQ', url: link }); return; } } catch { return; }
      try { await navigator.clipboard.writeText(link); alerta('Linkul e copiat.'); } catch { alerta(link); }
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-garaj-id]');
    if (!b) return;
    haptic();
    arataGarajul(b.dataset.garajId);
  });
  // venit dintr-un link de garaj
  try {
    const q = new URLSearchParams(location.search), g = q.get('garaj');
    if (g && /^[a-z0-9_.-]{3,40}$/i.test(g)) {
      q.delete('garaj');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
      setTimeout(() => arataGarajul(g), 300);
    }
  } catch { /* fără garaj din link */ }

  // ---------- contul (cont.js, același ca în Setări) ----------
  const cont = FrqCont.monteaza($('c-cont'), { areGaraj: () => stare.garaj.size > 0 });
  if (FrqCloud.codDinLink()) Shared.mergi('#cont');
  const randeazaCont = () => cont.randeaza();

  // ---------- meniul garajului ----------
  // Sus portofelul; dedesubt câte un rând pentru fiecare parte a garajului, cu starea
  // ei. Fiecare parte are pagina ei (#misiuni, #lazi, #colectie, #seturi, #cont).
  const PASI = ['misiuni', 'lazi', 'colectie', 'dubluri', 'seturi', 'cont', 'invita', 'bani'];
  let eu = null;
  // scorul garajului, socotit pe loc din exemplare (serverul îl socotește la fel)
  const scorAcum = () => E.scorGaraj(MD, M.cheieMasina, [...stare.ex].flatMap(([masina, l]) => l.map(e => ({ masina, nivel: e.nivel })))).scor;
  function randeazaMeniuG() {
    const p = stare.portofel, m = stare.misiuni;
    const facute = m ? m.filter(x => x.gata).length : 0;
    const complete = window.Seturi.progres(SETURI, k => stare.garaj.has(k)).filter(x => x.ai === x.chei.length).length;
    const gratis = p ? p.lazi_gratis : 0;
    $('c-meniu').innerHTML = Shared.randuriMeniu([
      { id: 'lazi', icon: 'lazi', titlu: 'Lăzi', sub: gratis ? `${gratis} gratis · de la ${E.mil(E.LAZI[0].pret)}` : `De la ${E.mil(E.LAZI[0].pret)}`, primar: gratis > 0 },
      { id: 'misiuni', icon: 'misiuni', titlu: 'Misiunile zilei', sub: stare.faraServer ? '–' : m && m.length ? `${facute} din ${m.length} făcute` : 'Apar după primul joc online', primar: !gratis && !!m && facute < m.length },
      { id: 'colectie', icon: 'colectie', titlu: 'Colecția', sub: stare.faraServer ? '–' : `${stare.garaj.size} din ${POOL.length} mașini · tuning și Vitrina` },
      { id: 'dubluri', icon: 'dubluri', titlu: 'Dubluri', sub: stare.faraServer ? '–' : nrDubluri() ? (nrDubluri() === 1 ? '1 dublură' : `${nrDubluri()} dubluri`) : 'Niciuna acum' },
      { id: 'seturi', icon: 'seturi', titlu: 'Seturi', sub: stare.faraServer ? '–' : `${complete} din ${SETURI.length} complete` },
      { id: 'scor', icon: 'cls', titlu: 'Scorul garajului', sub: stare.faraServer ? '–' : `${scorAcum().toLocaleString('ro-RO')} · clasamente` },
      { id: 'bani', icon: 'bani', titlu: 'Cum faci bani', sub: stare.dinJocuri != null ? `Azi din jocuri: ${stare.dinJocuri} din ${E.mil(E.CASTIG.plafon)}` : 'Ce plătește și când' },
      { id: 'invita', icon: 'invita', titlu: 'Invită un prieten', sub: `${E.mil(E.INVITATII.premiu)} pentru fiecare prieten care joacă ${E.INVITATII.zile} zile` },
      { id: 'cont', icon: 'cont', titlu: 'Contul', sub: eu && !eu.anonim ? `Legat de ${eu.mail}` : 'Garajul stă doar pe acest telefon: leagă-l de mail' },
    ]);
  }
  // ---------- cum faci bani ----------
  // Toate sursele, cât dă fiecare și când intră; cifrele vin din economie.js.
  function randeazaBani() {
    const M = Object.values(E.MISIUNI).map(x => x.mil), C = E.CASTIG, azi = stare.dinJocuri;
    const rand = (titlu, cat, cand, link) => `<li>${link ? `<a href="${link}">` : '<div>'}<b>${titlu}</b><span class="col-bani-v">${cat}</span><small>${cand}</small>${link ? '</a>' : '</div>'}</li>`;
    const pct = azi == null ? 0 : Math.min(100, Math.round(100 * azi / C.plafon));
    $('c-bani').innerHTML = `
      <p class="label">În fiecare zi</p>
      <ul class="col-bani-l">
        ${rand('Provocarea zilei', `+${E.mil(E.RECOMPENSE.provocare)} fiecare`, 'Sus sau jos, În ordine, Cursa zilei, Duel de cărți și Geamănul. Pe lângă banii partidei, la final, în afara plafonului. Plus 1 mil. pe zi de serie, cel mult 10.', 'index.html')}
        ${rand('Seria de zile', 'Pachet Sport', `La fiecare ${E.RECOMPENSE.pachetSerie} zile la rând cu provocarea zilei, un pachet de 5 mașini gratis.`, 'index.html')}
        ${rand('Misiunile zilei', `${Math.min(...M)}-${Math.max(...M)} mil.`, 'Pe loc, când termini misiunea.', 'colectie.html#misiuni')}
      </ul>
      <p class="label">Din partide · cel mult ${E.mil(C.plafon)} pe zi</p>
      ${azi != null ? `<div class="col-bani-azi"><span>Azi: <b>${azi} din ${C.plafon} mil.</b>${azi >= C.plafon ? ' Acum se umplu lăzile de bonus.' : ''}</span><i style="--p:${pct}%"></i></div>` : ''}
      <ul class="col-bani-l">
        ${rand('Sus sau jos, online', '1 mil. la 2 corecte', `La finalul partidei. De la ${C.bonus['sus-sau-jos'][0]} corecte, încă ${E.mil(C.bonus['sus-sau-jos'][1])}`, 'sus-sau-jos.html?online')}
        ${rand('În ordine, online', '1 mil. pe mașină', `Pe fiecare mașină pusă corect, la final. De la ${C.bonus.ordine[0]}, încă ${E.mil(C.bonus.ordine[1])}`, 'ordine.html?online')}
        ${rand('Cursa', `${E.CURSA.bani.slice(0, 3).join(' / ')} mil.`, 'Locul 1, 2 sau 3 în cursa de cinci tururi. Locurile 4-10 iau și ele ceva.', 'cursa.html')}
        ${rand('Duel de cărți', '2 / 5 / 8 mil.', 'Când bați botul ușor, mediu sau greu. 1 mil. când pierzi.', 'carti.html')}
        ${rand('Geamănul', '2 / 5 / 8 mil.', 'Când bați botul ușor, mediu sau greu. 1 mil. când pierzi.', 'geaman.html')}
        ${rand('Victorie cu un prieten', E.mil(C.victorie), 'Camere și cursa live, când câștigi.', 'index.html#online')}
      </ul>
      <p class="label">Mai mari</p>
      <ul class="col-bani-l">
        ${rand('Dueluri în Startul', 'Miza celuilalt', 'Câștigi potul, minus 10% comision.', 'drag.html?online')}
        ${rand('Cupa de duminică', `${E.CUPA.premii.join(' / ')} mil.`, `Un tur în Cursa. Primii trei; oricine aleargă ia ${E.CUPA.participare} mil. Se plătesc luni.`, 'cursa.html#cupa')}
        ${rand('Turul săptămânii', `${E.CURSA.sapt.premii.join(' / ')} mil.`, 'Primii trei din fiecare clasă, în Cursa. Se plătesc luni.', 'cursa.html#sapt')}
        ${rand('Clasamentul săptămânii', `${E.SAPTAMANA.premii.join(' / ')} mil.`, 'Primii trei la Sus sau jos și În ordine. Se plătesc luni.', null)}
        ${rand('Seturi complete', 'Premiul setului', 'Pe loc, când ai toate mașinile setului.', 'colectie.html#seturi')}
        ${rand('Invită un prieten', E.mil(E.INVITATII.premiu), `După ce joacă ${E.INVITATII.zile} zile.`, 'colectie.html#invita')}
      </ul>
      <p class="col-nota">Jocurile pe un telefon (Local) nu dau bani.</p>`;
  }

  // ---------- invită un prieten ----------
  async function randeazaInvita() {
    const el = $('c-inv');
    el.innerHTML = Shared.schelet(3);
    let r;
    try { r = await FrqCloud.invita(); } catch { el.innerHTML = '<p class="col-nota">Nu se poate încărca acum.</p>'; return; }
    const link = FrqCloud.linkInvitatie(r.id_public || r.cod), pl = r.prieteni.filter(x => x.platit).length;
    el.innerHTML = `
      <ol class="drg-dl-pasi col-inv-pasi">
        <li>Trimiți linkul tău unui prieten.</li>
        <li>El primește ${esc(E.mil(r.bonus))} când intră și joacă prima dată online.</li>
        <li>Tu primești ${esc(E.mil(r.premiu))} după ce a jucat provocările zilei în ${r.zile} zile diferite.</li>
      </ol>
      <div class="col-inv-link"><span>${esc(link.replace(/^https?:\/\//, ''))}</span></div>
      <div class="col-inv-act"><button class="btn btn-primary" type="button" id="c-inv-trimite">Trimite linkul</button></div>
      <p class="label">Prietenii tăi${r.prieteni.length ? ` · ${pl} din ${r.max} premii luate` : ''}</p>
      ${r.prieteni.length ? `<ul class="col-inv-lista">${r.prieteni.map(x => `<li><b>${esc(x.nume)}</b><span>${x.platit ? `<i class="col-noua">+${esc(E.mil(r.premiu))}</i>` : `${Math.min(x.zile, r.zile)} din ${r.zile} zile`}</span></li>`).join('')}</ul>`
        : '<p class="col-nota">Încă nimeni. Primul prieten care intră din linkul tău apare aici.</p>'}`;
    $('c-inv-trimite').addEventListener('click', async () => {
      haptic();
      const text = I18n.t('Hai în FRQ, jocuri cu mașini. Intră din linkul meu și primești {m}:', { m: E.mil(r.bonus) });
      try { if (navigator.share) { await navigator.share({ text, url: link }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${text} ${link}`); alerta('Link copiat'); } catch { window.prompt(I18n.t('Copiază linkul'), link); }
    });
  }

  function pasG() {
    const p = location.hash.slice(1);
    document.body.dataset.pas = PASI.includes(p) ? p : '';
    if (p === 'invita') randeazaInvita();
    if (p === 'bani') randeazaBani();
    if (p === 'colectie' && stare.colVeche) randeazaColectia();
    if (p === 'dubluri') { alegeri.clear(); randeazaDubluri(); }
    randeazaMeniuG();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', pasG);
  $('c-pas-inapoi').addEventListener('click', () => Shared.inapoi('#'));
  $('c-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    if (r.dataset.mj === 'profil') { location.replace('index.html#profil'); return; }
    if (r.dataset.mj === 'cont') { location.href = 'index.html#profil'; return; }
    if (r.dataset.mj === 'scor') { FrqCloud.arataClasament('garaj'); return; }
    Shared.mergi('#' + r.dataset.mj);
  });

  $('c-fara-semnal').addEventListener('click', e => {
    if (!e.target.closest('button')) return;
    e.target.closest('button').disabled = true;
    location.reload();
  });

  // ---------- pornirea ----------
  async function incarca() {
    if (!FrqCloud.poateFaceCont()) {
      randeazaStare(); randeazaLazi(); randeazaColectia(); randeazaCont();
      return;
    }
    // ultima stare de pe telefon, pe loc; cea de la server o înlocuiește
    const salvat = FrqCloud.portofelSalvat();
    if (salvat) {
      aplicaPortofel(salvat);
      stare.faraServer = false;
      randeazaStare(); randeazaLazi(); randeazaMisiuni(); randeazaColectia(); randeazaSeturi(); randeazaMeniuG();
    }
    try {
      const r = await FrqCloud.portofel();
      aplicaPortofel(r);
      anuntaPremii(r.premii);
      stare.faraServer = false;
    } catch {
      // fără semnal: rămâne ce era salvat pe telefon, dacă era
      stare.faraServer = !salvat;
    }
    randeazaStare();
    randeazaLazi();
    randeazaMisiuni();
    randeazaColectia();
    randeazaSeturi();
    randeazaDubluri();
    randeazaCont();
    try { eu = await FrqCloud.cineSunt(); } catch { /* fără server acum */ }
    randeazaMeniuG();
  }

  // lăzile de bază și cele cu temă
  const laClicLada = e => {
    const b = e.target.closest('[data-lada]');
    if (!b || b.disabled || stare.cutie) return;
    const lada = E.LAZI.find(l => l.id === b.dataset.lada);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deschide(lada, b.hasAttribute('data-gratis')); return; }
    b.classList.add('is-scutura');
    haptic();
    setTimeout(() => { b.classList.remove('is-scutura'); deschide(lada, b.hasAttribute('data-gratis')); }, 420);
  };
  $('c-pachete-mari').addEventListener('click', e => {
    const b = e.target.closest('[data-pachet]');
    if (!b || b.disabled || stare.cutie) return;
    deschidePachet(E.PACHETE.find(p => p.id === b.dataset.pachet), b.hasAttribute('data-gratis'));
  });
  $('c-pachete').addEventListener('click', laClicLada);
  $('c-teme').addEventListener('click', laClicLada);
  $('c-sari').addEventListener('click', arata);
  $('c-rev').addEventListener('click', async e => {
    if (e.target.closest('#c-rev-ok')) { inchide(); return; }
    const d = e.target.closest('[data-dubl]');
    if (!d || !stare.cutie || !stare.cutie.r) return;
    if (d.dataset.dubl === 'pastreaza') { inchide(); return; }
    $('c-rev').querySelectorAll('[data-dubl]').forEach(x => { x.disabled = true; });
    try { await schimbaDublura(stare.cutie.r.masina, d.dataset.dubl); }
    catch { alerta('Nu s-a putut acum. Dublura rămâne în garaj; o poți schimba din Colecție.'); }
    inchide();
  });
  $('c-filtre').addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    stare.filtru = +b.dataset.r;
    randeazaColectia();
  });
  $('c-doar').addEventListener('change', e => { stare.doar = e.target.checked; randeazaColectia(); });

  randeazaStare();
  randeazaLazi();
  randeazaColectia();
  randeazaSeturi();
  pasG();
  incarca();
})();
