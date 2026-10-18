// Garajul meu: portofelul (mil.), lăzile și colecția de mașini. Totul vine de pe
// server: banii și mașinile le mută doar funcția `portofel`, care trage și mașina din
// ladă; aici banda doar arată rezultatul, ca în Startul.
(() => {
  'use strict';

  const { fmt, brandOf, modelOf, esc, wirePhotos, haptic, thumbHTML } = window.Shared;
  const E = window.Economie, M = window.DragModel;
  const MD = M.creeaza(window.CARS || []);
  const { POOL, TIMP, rar, PE_RARITATE } = MD;
  const $ = id => document.getElementById(id);

  // fața fiecărei lăzi, ca în Startul: Golf GTI, M3, Huracán, P1
  const FATA = {
    strada: ['Volkswagen Golf GTI', '1983'], sport: ['BMW M3', '1997'], super: ['Lamborghini Huracán LP 610-4', '2014'], hyper: ['McLaren P1', '2013'],
    jdm: ['Nissan Skyline GT-R V-Spec', '1999'], sua: ['Dodge Challenger SRT Hellcat', '2015'], italia: ['Ferrari F40', '1987'],
    anglia: ['McLaren F1', '1993'], germania: ['Porsche 911 GT3 RS', '2019'], electrice: ['Rimac Nevera', '2021'],
  };
  const dupaNume = ([n, y]) => (window.CARS || []).find(c => c.name.normalize('NFC') === n.normalize('NFC') && String(c.years) === y);
  const poza = c => thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
  const fara = c => poza(c).replace(/<img[^>]*>/, '');
  // Scorul de performanță (clasa și numărul, după tuning), ca în Startul. Secundele nu
  // se arată: sunt recordurile tale, din cursele tale.
  const pi = (c, nivel = 0) => { const s = M.scor(c, nivel); return `<span class="pi pi-${s.k}"><b>${s.clasa}</b>${s.v}</span>`; };
  const timpCarte = c => pi(c);
  const recordTau = k => { const t = stare.recorduri && stare.recorduri.get(k); return t ? `${fmt(t / 1000, 3)} s` : 'Neîncercată'; };
  const PLURAL_RAR = ['Comune', 'Rare', 'Epice', 'Exotice', 'Legendare'];
  // „1 punct rar", „3 puncte rare"
  const PUNCT_SG = ['comun', 'rar', 'epic', 'exotic', 'legendar'];
  const puncteText = (n, r) => `${n} ${n === 1 ? `punct ${PUNCT_SG[r]}` : `puncte ${PLURAL_RAR[r].toLowerCase()}`}`;

  const stare = { recorduri: null, portofel: null, garaj: new Map(), filtru: -1, doar: false, cutie: null, deschise: 0, misiuni: null, set: null, toateSeturile: false };
  const SETURI = window.Seturi.creeaza(POOL, { rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_SET });

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
    $('c-puncte').innerHTML = `<span>Puncte de upgrade</span>${pc.map((n, r) => `<b class="rar-${r}" title="${E.RARITATI[r]}">${PLURAL_RAR[r]} ${n}</b>`).join('')}`;
  }
  // o dublură: bani sau un punct de raritatea ei (serverul hotărăște cât)
  async function schimbaDublura(masina, alegere) {
    const r = await FrqCloud.dublura(masina, alegere);
    stare.portofel = { ...stare.portofel, mil: r.mil, puncte: r.puncte };
    const g = stare.garaj.get(masina);
    if (g) g.bucati = r.bucati;
    haptic('success');
    window.Sunete && Sunete[alegere === 'vinde' ? 'oferta' : 'pune']();
    randeazaStare();
    return r;
  }
  const butoaneDublura = (c, cls = '') => {
    const r = rar(c), v = E.VALOARE_DUBLURA[r];
    return `<div class="col-dubl ${cls}">${v ? `<button class="btn btn-ghost" type="button" data-dubl="vinde">Vinde · +${E.mil(v)}</button>` : ''}
      <button class="btn btn-primary" type="button" data-dubl="puncte">Păstrează · +1 punct ${PUNCT_SG[r]}</button></div>`;
  };

  // ---------- lăzile ----------
  function cardLada(l, { gratis = false } = {}) {
    const p = stare.portofel;
    const ok = !!p && (gratis ? p.lazi_gratis > 0 : p.mil >= l.pret);
    const car = dupaNume(FATA[l.id]);
    // la lăzile cu temă, șansele reale (doar raritățile pe care tema le are)
    const sanse = E.sanseLada(l, PE_RARITATE).map(x => Math.round(x));
    const segm = sanse.map((s, r) => (s ? `<i class="rar-${r}" style="flex:${s}"></i>` : '')).join('');
    const leg = sanse.map((s, r) => (s ? `<span class="rar-${r}">${s}%</span>` : '')).join('');
    const img = car ? `<img src="${esc(car.image.replace(/\/\d+px-/, '/500px-'))}" alt="" decoding="async" referrerpolicy="no-referrer">` : '';
    const pret = gratis ? `${p ? p.lazi_gratis : 0} × gratis` : E.mil(l.pret);
    return `<div class="drg-pk-w"><button class="drg-pk pk-${l.id}${gratis ? ' is-gratis' : ''}" type="button" data-lada="${l.id}"${gratis ? ' data-gratis' : ''}${ok ? '' : ' disabled'} aria-label="${esc(l.nume)}, ${esc(pret)}">
      <span class="drg-lada" aria-hidden="true">
        <span class="drg-lada-foto">${img}</span>
        <span class="drg-lada-capac"><i class="drg-lada-maner"></i></span>
        <span class="drg-lada-et"><small>${gratis ? 'Gratis' : 'Ladă'}</small>${esc(l.nume)}</span>
        <span class="drg-lada-pret">${esc(pret)}</span>
        <i class="drg-lada-luciu"></i>
      </span>
      <span class="drg-pk-bar" aria-hidden="true">${segm}</span>
      <span class="drg-pk-s">${leg}</span>
    </button></div>`;
  }
  function randeazaLazi() {
    const p = stare.portofel;
    const gratis = p && p.lazi_gratis > 0 ? cardLada(E.LAZI[0], { gratis: true }) : '';
    $('c-pachete').innerHTML = gratis + E.LAZI.filter(l => !l.tema).map(l => cardLada(l)).join('');
    // ce-ți mai lipsește din fiecare temă
    $('c-teme').innerHTML = E.LAZI.filter(l => l.tema).map(l => {
      const toate = E.peRaritateLada(l, PE_RARITATE).flat();
      const ai = toate.filter(c => stare.garaj.has(M.cheieMasina(c))).length;
      return cardLada(l).replace('</button></div>', `<span class="col-tema-ai">${ai} din ${toate.length}</span></button></div>`);
    }).join('');
    $('c-pachete').classList.toggle('are-gratis', !!gratis);
  }

  // ---------- deschiderea ----------
  const NR_CARTI = 46, CASTIG = 40;
  const carte = (c, cuPoza) => `<div class="drg-carte rar-${rar(c)}"><span class="drg-carte-f">${cuPoza ? poza(c) : fara(c)}</span><span class="drg-carte-m">${esc(brandOf(c.name))}</span><b>${esc(modelOf(c.name) || c.name)}</b><small>${timpCarte(c)}</small></div>`;
  const cuPoza = i => i >= CASTIG - 9 && i <= CASTIG + 3;

  async function deschide(lada, gratis) {
    if (stare.cutie) return;
    stare.cutie = { gata: false };
    const cutie = stare.cutie;
    $('c-cutie-t').innerHTML = `<small>${gratis ? 'Ladă gratis' : E.mil(lada.pret)}</small>${esc(lada.nume)}`;
    $('c-banda').innerHTML = '';
    $('c-rev').hidden = true;
    $('c-sari').hidden = true;
    $('c-cutie').hidden = false;
    $('c-cutie').classList.remove('is-gata');
    haptic();
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
    const lent = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durata = !lent ? 700 : stare.deschise <= 2 ? 5600 : 3600;
    const banda = $('c-banda');
    banda.innerHTML = Array.from({ length: NR_CARTI }, (_, i) => carte(i === CASTIG ? car : E.trage(lada, PE_RARITATE, Math.random).car, cuPoza(i))).join('');
    wirePhotos(banda);
    banda.style.transition = 'none';
    banda.style.transform = 'translateX(0)';
    $('c-sari').hidden = stare.deschise < 3;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tinta = banda.children[CASTIG], fer = $('c-fereastra');
      const abatere = (Math.random() - 0.5) * tinta.offsetWidth * 0.7;
      cutie.x = tinta.offsetLeft + tinta.offsetWidth / 2 - fer.clientWidth / 2 + abatere;
      banda.style.transition = `transform ${durata}ms cubic-bezier(.06, .62, .12, 1)`;
      banda.style.transform = `translateX(${-cutie.x}px)`;
      cutie.ceas = setTimeout(arata, durata + 120);
    }));
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
      return { masina: g.masina, raritate: g.raritate, noua, valoare: noua ? 0 : E.VALOARE_DUBLURA[g.raritate], mil: p.portofel.mil, lazi_gratis: p.portofel.lazi_gratis };
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
      <div class="drg-rev-foto"><img class="art-photo" src="${esc(c.image)}" alt="" decoding="async" referrerpolicy="no-referrer"></div>
      <p class="drg-rev-n"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</p>
      <p class="drg-rev-t">${rez.noua ? pi(c) : 'O aveai deja. O vinzi sau o faci punct de upgrade?'}</p>
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
    if (rez.noua) stare.garaj.set(rez.masina, { masina: rez.masina, raritate: r, nivel: 0, bucati: 1 });
    else { const g = stare.garaj.get(rez.masina); if (g) g.bucati++; }
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

  // ---------- colecția ----------
  let vazator = null;
  function randeazaFiltre() {
    const ale = r => [...stare.garaj.values()].filter(g => r < 0 || g.raritate === r).length;
    const tot = r => (r < 0 ? POOL.length : PE_RARITATE[r].length);
    const buton = (r, eticheta) => `<button type="button" role="radio" class="col-f${r >= 0 ? ` rar-${r}` : ''}${stare.filtru === r ? ' is-on' : ''}" aria-checked="${stare.filtru === r}" data-r="${r}"><span>${eticheta}</span><small>${ale(r)}/${tot(r)}</small></button>`;
    $('c-filtre').innerHTML = buton(-1, 'Toate') + PLURAL_RAR.map((n, r) => buton(r, n)).reverse().join('');
  }
  function randeazaColectia() {
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
        <b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))}</small><span class="col-c-pi">${pi(c, niv)}</span>
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
  // Fiecare nivel o face cu 1,2% mai rapidă pe sfertul de milă; clasa (pentru dueluri)
  // vine din timpul după tuning. Costul crește cu raritatea și cu nivelul.
  let detaliu = null;
  function randeazaDetaliu() {
    const g = stare.garaj.get(detaliu);
    if (!g) { randeazaVitrina(); return; }
    const c = MD.dupaCheie(g.masina);
    if (!c) { $('c-det').hidden = true; return; }
    const niv = g.nivel || 0, max = E.TUNING.max, p = M.piese(niv);
    const clasa = M.clasa(c, niv);
    const ai = ((stare.portofel && stare.portofel.puncte) || [0, 0, 0, 0, 0])[rar(c)];
    // cele patru piese: nivelul, ce face, cât costă următorul și unde ajunge scorul
    // cât câștigă mașina din piese (drag-model.js, tunabil), ca în realitate
    const TUNABIL = { 1.5: 'Câștigă mult', 1.25: 'Câștigă bine', 1: 'Normal', 0.7: 'Câștigă puțin' };
    const randPiesa = (i, ce) => {
      const n = p[i], bani = E.TUNING.peBani.includes(i);
      const cost = n >= max ? 0 : bani ? E.TUNING.mil(rar(c), n) : E.TUNING.puncte(n);
      const urm = n < max ? M.codPiese(p.map((x, j) => (j === i ? x + 1 : x))) : null;
      const efect = n >= max ? 'Maxim' : i === 3 ? 'verde mai lat' : `&rarr; ${pi(c, urm)}${M.clasa(c, urm) !== clasa ? ` clasa ${M.CLASE[M.clasa(c, urm)]}` : ''}`;
      const poate = n < max && !g.blocat && (bani ? ((stare.portofel && stare.portofel.mil) || 0) : ai) >= cost;
      return `<li class="col-piesa">
        <span class="col-piesa-t"><b>${M.PIESE[i]}</b><small>${ce}</small></span>
        <span class="col-piesa-n" aria-label="Nivel ${n} din ${max}">${Array.from({ length: max }, (_, k) => `<i class="${k < n ? 'is-on' : ''}"></i>`).join('')}</span>
        <span class="col-piesa-e">${efect}</span>
        <button class="btn ${poate ? 'btn-primary' : 'btn-ghost'}" type="button" data-piesa="${i}"${poate ? '' : ' disabled'}>${n >= max ? '5/5' : `+1 · ${bani ? E.mil(cost) : `${cost} p`}`}</button>
      </li>`;
    };
    $('c-det-in').className = `modal col-det-in rar-${clasa}`;
    $('c-det-in').innerHTML = `
      <div class="col-det-f">${poza(c)}</div>
      <p class="col-det-r">${E.RARITATI[rar(c)]}</p>
      <h2 class="col-det-n" id="c-det-t"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</h2>
      <p class="col-det-spec">${[c.hp ? `${c.hp} CP` : '', c.weight ? `${c.weight} kg` : '', c.engine ? esc(c.engine) : ''].filter(Boolean).join(' &middot; ')}</p>
      <table class="col-det-t"><tbody>
        <tr><th>Scor</th><td>${pi(c, niv)}</td></tr>
        <tr><th>La tuning</th><td>${TUNABIL[M.tunabil(c)] || 'Normal'}</td></tr>
        <tr><th>Recordul tău</th><td>${recordTau(g.masina)}</td></tr>
        <tr><th>Cel mai bun pe FRQ</th><td class="col-det-frq">…</td></tr>
      </tbody></table>
      <p class="label col-piese-t">Tuning · ai ${puncteText(ai, rar(c))} și ${E.mil((stare.portofel && stare.portofel.mil) || 0)}</p>
      <ul class="col-piese">
        ${randPiesa(0, 'Plecarea și prima treaptă')}
        ${randPiesa(1, 'Toată cursa')}
        ${randPiesa(2, 'Finalul și viteza la linie')}
        ${randPiesa(3, 'Schimbări mai ușor de nimerit')}
      </ul>
      ${g.blocat ? '<p class="col-nota">E pusă într-un duel: o tunezi după.</p>' : ai < 2 ? `<p class="col-nota">Punctele ${PLURAL_RAR[rar(c)].toLowerCase()} le iei din dubluri.</p>` : ''}
      ${g.bucati > 1 && !g.blocat ? `<p class="col-nota">Ai ${g.bucati - 1 === 1 ? 'o dublură' : `${g.bucati - 1} dubluri`} cu mașina asta.</p>${butoaneDublura(c)}` : ''}
      <div class="modal-actions"><button class="btn btn-ghost" type="button" data-inchide>Închide</button></div>`;
    wirePhotos($('c-det-in'));
    $('c-det').hidden = false;
    recordFrq(g.masina);
  }
  // cel mai bun timp de pe FRQ cu mașina asta și cine l-a scos
  function recordFrq(k) {
    FrqCloud.recordMasina(k).then(r => {
      const td = detaliu === k && $('c-det-in').querySelector('.col-det-frq');
      if (td) td.textContent = r && r.timp ? `${fmt(r.timp / 1000, 3)} s · ${r.nume}` : 'Nimeni încă';
    }).catch(() => {
      const td = $('c-det-in').querySelector('.col-det-frq');
      if (td) td.textContent = '–';
    });
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
      <table class="col-det-t"><tbody>
        <tr><th>Scor</th><td>${pi(c)}</td></tr>
        <tr><th>Cel mai bun pe FRQ</th><td class="col-det-frq">…</td></tr>
        ${seturi.length ? `<tr><th>În seturile</th><td class="col-det-set">${seturi.map(esc).join(', ')}</td></tr>` : ''}
      </tbody></table>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" id="c-cumpara"${stare.portofel && bani >= pret ? '' : ' disabled'}>Cumpără: ${E.mil(pret)}</button>
        <button class="btn btn-ghost" type="button" data-inchide>Închide</button>
      </div>
      ${stare.portofel && bani < pret ? `<p class="col-nota">Îți trebuie ${E.mil(pret)}</p>` : ''}
      <p class="col-nota">Din Vitrina iei exact mașina asta. O ladă e mai ieftină, dar e la noroc.</p>`;
    wirePhotos($('c-det-in'));
    $('c-det').hidden = false;
    recordFrq(detaliu);
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
      stare.garaj.set(r.masina, { masina: r.masina, raritate: r.raritate, nivel: 0, bucati: 1, blocat: false });
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
    if (stare.set) location.hash = 'colectie';
  });
  $('c-set-tot').addEventListener('click', () => { stare.toateSeturile = !stare.toateSeturile; randeazaSeturi(); });
  $('c-set-activ').addEventListener('click', e => {
    if (!e.target.closest('[data-set-x]')) return;
    stare.set = null;
    randeazaSeturi();
    randeazaColectia();
  });

  // ---------- premiile primite (săptămâna, cupa, seturi, misiuni) ----------
  const VAZUTE = 'frq_premii_vazute';
  function textPremiu(x) {
    const d = x.detalii || {}, m = `+${E.mil(x.mil)}`;
    if (x.motiv === 'premiul saptamanii') return `Premiul săptămânii: locul ${d.loc} în ${d.joc === 'ordine' ? 'În ordine' : 'Sus sau jos'} · ${m}`;
    if (x.motiv === 'premiu cupa') return `Cupa de duminică: locul ${d.loc} · ${m}`;
    if (x.motiv === 'cupa anulata') return `Cupa n-a avut destui jucători, îți iei intrarea înapoi · ${m}`;
    if (x.motiv === 'set complet') return `Set complet: ${d.nume} · ${m}`;
    if (x.motiv === 'invitat') return `Bun venit de la ${d.de || 'un prieten'} · ${m}`;
    if (x.motiv === 'prieten invitat') return `${d.nume || 'Un prieten'} a jucat ${E.INVITATII.zile} zile. Premiul tău de invitație · ${m}`;
    if (x.motiv === 'bonus economia noua') return `Bani din fiecare partidă și lăzi fără dubluri. Bonus de trecere · ${m}`;
    return `Misiune îndeplinită · ${m}`;
  }
  function anuntaPremii(premii) {
    if (!premii || !premii.length) return;
    let vazut = null;
    try { vazut = Number(localStorage.getItem(VAZUTE)) || null; } catch { /* fără stocare */ }
    const noi = premii.filter(x => (vazut != null ? x.id > vazut : Date.now() - new Date(x.creat).getTime() < 864e5)).reverse();
    try { localStorage.setItem(VAZUTE, String(Math.max(...premii.map(x => x.id)))); } catch { /* fără stocare */ }
    noi.slice(-4).forEach((x, i) => setTimeout(() => alerta(textPremiu(x)), i * 3400));
    if (noi.length) haptic('success');
  }
  const incarcaRecorduri = () => FrqCloud.recorduri().then(m => { stare.recorduri = m; }).catch(() => {});
  function aplicaPortofel(r) {
    stare.portofel = r.portofel;
    stare.garaj = new Map((r.garaj || []).map(g => [g.masina, g]));
    stare.misiuni = r.misiuni;
    stare.dinJocuri = r.azi ? r.azi.din_jocuri || 0 : null;
  }
  async function incarcaTacit() {
    incarcaRecorduri();
    try {
      aplicaPortofel(await FrqCloud.portofel());
      randeazaStare(); randeazaLazi(); randeazaMisiuni(); randeazaSeturi(); randeazaMeniuG();
      anuntaPremii(r.premii);
    } catch { /* rămâne ce e pe ecran */ }
  }

  async function tuneaza(piesa) {
    const b = $('c-det-in').querySelector(`[data-piesa="${piesa}"]`);
    if (!b || b.disabled) return;
    b.disabled = true;
    try {
      const r = await FrqCloud.tuneaza(detaliu, piesa);
      const g = stare.garaj.get(detaliu);
      if (g) g.nivel = r.nivel;
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
    haptic();
    randeazaDetaliu();
  });
  $('c-det').addEventListener('click', e => {
    const tp = e.target.closest('[data-piesa]');
    if (tp) { tuneaza(+tp.dataset.piesa); return; }
    if (e.target.closest('#c-cumpara')) { cumpara(); return; }
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

  // ---------- contul (cont.js, același ca în Setări) ----------
  const cont = FrqCont.monteaza($('c-cont'), { areGaraj: () => stare.garaj.size > 0 });
  if (FrqCloud.codDinLink()) location.hash = 'cont';
  const randeazaCont = () => cont.randeaza();

  // ---------- meniul garajului ----------
  // Sus portofelul; dedesubt câte un rând pentru fiecare parte a garajului, cu starea
  // ei. Fiecare parte are pagina ei (#misiuni, #lazi, #colectie, #seturi, #cont).
  const PASI = ['misiuni', 'lazi', 'colectie', 'seturi', 'cont', 'invita', 'bani'];
  let eu = null;
  function randeazaMeniuG() {
    const p = stare.portofel, m = stare.misiuni;
    const facute = m ? m.filter(x => x.gata).length : 0;
    const complete = window.Seturi.progres(SETURI, k => stare.garaj.has(k)).filter(x => x.ai === x.chei.length).length;
    const gratis = p ? p.lazi_gratis : 0;
    $('c-meniu').innerHTML = Shared.randuriMeniu([
      { id: 'lazi', titlu: 'Lăzi', sub: gratis ? `${gratis} gratis · de la ${E.mil(E.LAZI[0].pret)}` : `De la ${E.mil(E.LAZI[0].pret)}`, primar: gratis > 0 },
      { id: 'misiuni', titlu: 'Misiunile zilei', sub: stare.faraServer ? '–' : m && m.length ? `${facute} din ${m.length} făcute` : 'Apar după primul joc online', primar: !gratis && !!m && facute < m.length },
      { id: 'colectie', titlu: 'Colecția', sub: stare.faraServer ? '–' : `${stare.garaj.size} din ${POOL.length} mașini · tuning și Vitrina` },
      { id: 'seturi', titlu: 'Seturi', sub: stare.faraServer ? '–' : `${complete} din ${SETURI.length} complete` },
      { id: 'bani', titlu: 'Cum faci bani', sub: stare.dinJocuri != null ? `Azi din jocuri: ${stare.dinJocuri} din ${E.mil(E.CASTIG.plafon)}` : 'Ce plătește și când' },
      { id: 'invita', titlu: 'Invită un prieten', sub: `${E.mil(E.INVITATII.premiu)} pentru fiecare prieten care joacă ${E.INVITATII.zile} zile` },
      { id: 'profil', titlu: 'Profilul tău', sub: 'Recorduri, dueluri, realizări' },
      { id: 'cont', titlu: 'Contul', sub: eu && !eu.anonim ? `Legat de ${eu.mail}` : 'Garajul stă doar pe acest telefon: leagă-l de mail' },
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
        ${rand('Provocarea zilei', `${E.mil(E.RECOMPENSE.provocare)} fiecare`, 'Sus sau jos, În ordine și Cursa zilei. Pe loc, la final. Plus 1 mil. pe zi de serie, cel mult 10.', 'index.html')}
        ${rand('Misiunile zilei', `${Math.min(...M)}-${Math.max(...M)} mil.`, 'Pe loc, când termini misiunea.', 'colectie.html#misiuni')}
      </ul>
      <p class="label">Din partide · cel mult ${E.mil(C.plafon)} pe zi</p>
      ${azi != null ? `<div class="col-bani-azi"><span>Azi: <b>${azi} din ${C.plafon} mil.</b>${azi >= C.plafon ? ' Mâine se reia.' : ''}</span><i style="--p:${pct}%"></i></div>` : ''}
      <ul class="col-bani-l">
        ${rand('Sus sau jos, online', '1 mil. la 2 corecte', `La finalul partidei. De la ${C.bonus['sus-sau-jos'][0]} corecte, încă ${E.mil(C.bonus['sus-sau-jos'][1])}.`, 'sus-sau-jos.html?online')}
        ${rand('În ordine, online', '1 mil. pe mașină', `Pe fiecare mașină pusă corect, la final. De la ${C.bonus.ordine[0]}, încă ${E.mil(C.bonus.ordine[1])}.`, 'ordine.html?online')}
        ${rand('Victorie cu un prieten', E.mil(C.victorie), 'Camere și cursa live, când câștigi.', 'index.html#online')}
      </ul>
      <p class="label">Mai mari</p>
      <ul class="col-bani-l">
        ${rand('Dueluri în Startul', 'Miza celuilalt', 'Câștigi potul, minus 10% comision.', 'drag.html?online')}
        ${rand('Cupa de duminică', `${E.CUPA.premii.join(' / ')} mil.`, `Primii trei; oricine aleargă ia ${E.CUPA.participare} mil. Se plătesc luni.`, 'drag.html?online')}
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
    randeazaMeniuG();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', pasG);
  $('c-pas-inapoi').addEventListener('click', () => Shared.inapoi('#'));
  $('c-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    if (r.dataset.mj === 'profil') { location.href = 'index.html#profil'; return; }
    location.hash = r.dataset.mj;
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
    incarcaRecorduri();
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
  $('c-pachete').addEventListener('click', laClicLada);
  $('c-teme').addEventListener('click', laClicLada);
  $('c-sari').addEventListener('click', arata);
  $('c-rev').addEventListener('click', async e => {
    if (e.target.closest('#c-rev-ok')) { inchide(); return; }
    const d = e.target.closest('[data-dubl]');
    if (!d || !stare.cutie || !stare.cutie.r) return;
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
