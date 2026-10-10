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
  const FATA = { strada: ['Volkswagen Golf GTI', '1983'], sport: ['BMW M3', '1997'], super: ['Lamborghini Huracán LP 610-4', '2014'], hyper: ['McLaren P1', '2013'] };
  const dupaNume = ([n, y]) => (window.CARS || []).find(c => c.name.normalize('NFC') === n.normalize('NFC') && String(c.years) === y);
  const poza = c => thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, '/330px-') });
  const fara = c => poza(c).replace(/<img[^>]*>/, '');
  const timpCarte = c => `${fmt(TIMP.get(c), 1)} s`;
  const PLURAL_RAR = ['Comune', 'Rare', 'Epice', 'Exotice', 'Legendare'];

  const stare = { portofel: null, garaj: new Map(), filtru: -1, doar: false, cutie: null, deschise: 0, misiuni: null, set: null, toateSeturile: false };
  const SETURI = window.Seturi.creeaza(POOL, { rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_DUBLURA });

  // ---------- starea ----------
  function randeazaStare() {
    const p = stare.portofel;
    $('c-mil').textContent = p ? E.mil(p.mil) : '–';
    $('c-numar').textContent = `${stare.garaj.size} din ${POOL.length}`;
    $('c-serie').textContent = p && p.serie ? (p.serie === 1 ? '1 zi' : `${p.serie} zile`) : '–';
  }

  // ---------- lăzile ----------
  function cardLada(l, { gratis = false } = {}) {
    const p = stare.portofel;
    const ok = !!p && (gratis ? p.lazi_gratis > 0 : p.mil >= l.pret);
    const car = dupaNume(FATA[l.id]);
    const segm = l.sanse.map((s, r) => (s ? `<i class="rar-${r}" style="flex:${s}"></i>` : '')).join('');
    const leg = l.sanse.map((s, r) => (s ? `<span class="rar-${r}">${s}%</span>` : '')).join('');
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
    $('c-pachete').innerHTML = gratis + E.LAZI.map(l => cardLada(l)).join('');
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
      <p class="drg-rev-t">${rez.noua ? `${fmt(TIMP.get(c), 1)} s pe 1/4 milă` : `O aveai deja: vândută cu ${E.mil(rez.valoare)}`}</p>
      <p class="drg-rev-c">Foto: ${esc(c.credit)}, ${esc(c.license)}</p>
      <button class="btn btn-primary" type="button" id="c-rev-ok">Mai departe</button>`;
    wirePhotos($('c-rev'));
    $('c-rev').hidden = false;
    $('c-sari').hidden = true;
    $('c-cutie').classList.add('is-gata');
    haptic(r >= 3 || rez.noua ? 'success' : 'tick');
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
      .sort((a, b) => rar(b) - rar(a) || TIMP.get(a) - TIMP.get(b));
    $('c-grid').innerHTML = lista.length ? lista.map(c => {
      const g = stare.garaj.get(M.cheieMasina(c));
      const f = g ? poza(c).replace(' src="', ' data-src="') : fara(c);
      const niv = g ? g.nivel || 0 : 0;
      return `<button type="button" class="col-c rar-${rar(c)}${g ? ' is-a-mea' : ''}" data-det="${esc(M.cheieMasina(c))}">
        <span class="col-c-f">${f}${g ? '' : '<i class="col-c-q" aria-hidden="true">?</i>'}${g && g.bucati > 1 ? `<i class="col-c-x">×${g.bucati}</i>` : ''}${niv ? `<i class="col-c-niv">Nv ${niv}</i>` : ''}</span>
        <b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))} &middot; ${fmt(M.timpTunat(c, niv), 1)} s</small>
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
    const niv = g.nivel || 0, max = E.TUNING.max;
    const acum = M.timpTunat(c, niv), urm = niv < max ? M.timpTunat(c, niv + 1) : null;
    const clasa = M.clasa(c, niv), clasaUrm = urm != null ? M.clasa(c, niv + 1) : clasa;
    const cost = niv < max ? E.TUNING.pret(rar(c), niv) : 0;
    const bani = stare.portofel ? stare.portofel.mil : 0;
    const motiv = niv >= max ? 'Nivel maxim' : g.blocat ? 'E pusă într-un duel' : bani < cost ? `Îți trebuie ${E.mil(cost)}` : '';
    $('c-det-in').className = `modal col-det-in rar-${clasa}`;
    $('c-det-in').innerHTML = `
      <div class="col-det-f">${poza(c)}</div>
      <p class="col-det-r">${E.RARITATI[rar(c)]}${clasa !== rar(c) ? ` &middot; clasa ${E.RARITATI[clasa].toLowerCase()}` : ''}</p>
      <h2 class="col-det-n" id="c-det-t"><b>${esc(brandOf(c.name))}</b> ${esc(modelOf(c.name) || c.name)}</h2>
      <div class="col-det-niv" aria-label="Nivel ${niv} din ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < niv ? 'is-on' : ''}"></i>`).join('')}<span>Nivel ${niv}/${max}</span></div>
      <table class="col-det-t"><tbody>
        <tr><th>1/4 milă</th><td>${fmt(acum, 2)} s${urm != null ? ` <span class="col-det-urm">&rarr; ${fmt(urm, 2)} s</span>` : ''}</td></tr>
        <tr><th>Clasa în dueluri</th><td>${E.RARITATI[clasa]}${clasaUrm !== clasa ? ` <span class="col-det-urm">&rarr; ${E.RARITATI[clasaUrm]}</span>` : ''}</td></tr>
      </tbody></table>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" id="c-tun"${motiv ? ' disabled' : ''}>${niv >= max ? 'Nivel maxim' : `Tunează: ${E.mil(cost)}`}</button>
        <button class="btn btn-ghost" type="button" data-inchide>Închide</button>
      </div>
      ${motiv && niv < max ? `<p class="col-nota">${esc(motiv)}</p>` : ''}
      <p class="col-nota">Fiecare nivel: cu 1,2% mai rapidă, deci și mai greu de condus perfect.</p>`;
    wirePhotos($('c-det-in'));
    $('c-det').hidden = false;
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
        <tr><th>1/4 milă</th><td>${fmt(M.timpTunat(c, 0), 2)} s</td></tr>
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
    } catch {
      alerta('Nu s-a putut cumpăra acum.');
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
    if (x.motiv === 'bonus economia noua') return `Lăzi mai ieftine și bani din fiecare partidă. Bonus de trecere · ${m}`;
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
  async function incarcaTacit() {
    try {
      const r = await FrqCloud.portofel();
      stare.portofel = r.portofel;
      stare.garaj = new Map((r.garaj || []).map(g => [g.masina, g]));
      stare.misiuni = r.misiuni;
      randeazaStare(); randeazaLazi(); randeazaMisiuni(); randeazaSeturi(); randeazaMeniuG();
      anuntaPremii(r.premii);
    } catch { /* rămâne ce e pe ecran */ }
  }

  async function tuneaza() {
    const b = $('c-tun');
    if (!b || b.disabled) return;
    b.disabled = true;
    try {
      const r = await FrqCloud.tuneaza(detaliu);
      const g = stare.garaj.get(detaliu);
      if (g) g.nivel = r.nivel;
      stare.portofel = { ...stare.portofel, mil: r.mil };
      haptic('success');
      randeazaStare();
      randeazaLazi();
      randeazaColectia();
    } catch {
      alerta('Tuning-ul nu s-a putut face acum.');
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
    if (e.target.closest('#c-tun')) { tuneaza(); return; }
    if (e.target.closest('#c-cumpara')) { cumpara(); return; }
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
  const randeazaCont = () => cont.randeaza();

  // ---------- meniul garajului ----------
  // Sus portofelul; dedesubt câte un rând pentru fiecare parte a garajului, cu starea
  // ei. Fiecare parte are pagina ei (#misiuni, #lazi, #colectie, #seturi, #cont).
  const PASI = ['misiuni', 'lazi', 'colectie', 'seturi', 'cont'];
  let eu = null;
  function randeazaMeniuG() {
    const p = stare.portofel, m = stare.misiuni;
    const facute = m ? m.filter(x => x.gata).length : 0;
    const complete = window.Seturi.progres(SETURI, k => stare.garaj.has(k)).filter(x => x.ai === x.chei.length).length;
    const gratis = p ? p.lazi_gratis : 0;
    $('c-meniu').innerHTML = Shared.randuriMeniu([
      { id: 'lazi', titlu: 'Lăzi', sub: gratis ? `${gratis} gratis · de la ${E.mil(E.LAZI[0].pret)}` : `De la ${E.mil(E.LAZI[0].pret)}`, primar: gratis > 0 },
      { id: 'misiuni', titlu: 'Misiunile zilei', sub: m && m.length ? `${facute} din ${m.length} făcute` : 'Apar după primul joc online', primar: !gratis && !!m && facute < m.length },
      { id: 'colectie', titlu: 'Colecția', sub: `${stare.garaj.size} din ${POOL.length} mașini · tuning și Vitrina` },
      { id: 'seturi', titlu: 'Seturi', sub: `${complete} din ${SETURI.length} complete` },
      { id: 'cont', titlu: 'Contul', sub: eu && !eu.anonim ? `Legat de ${eu.mail}` : 'Garajul stă doar pe acest telefon: leagă-l de mail' },
    ]);
  }
  function pasG() {
    const p = location.hash.slice(1);
    document.body.dataset.pas = PASI.includes(p) ? p : '';
    randeazaMeniuG();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', pasG);
  $('c-pas-inapoi').addEventListener('click', () => history.back());
  $('c-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (!r) return;
    haptic();
    location.hash = r.dataset.mj;
  });

  // ---------- pornirea ----------
  async function incarca() {
    if (!FrqCloud.poateFaceCont()) {
      randeazaStare(); randeazaLazi(); randeazaColectia(); randeazaCont();
      return;
    }
    try {
      const r = await FrqCloud.portofel();
      stare.portofel = r.portofel;
      stare.garaj = new Map((r.garaj || []).map(g => [g.masina, g]));
      stare.misiuni = r.misiuni;
      anuntaPremii(r.premii);
    } catch {
      alerta('Garajul nu se poate încărca acum. Încearcă din nou puțin mai târziu.');
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

  $('c-pachete').addEventListener('click', e => {
    const b = e.target.closest('[data-lada]');
    if (!b || b.disabled || stare.cutie) return;
    const lada = E.LAZI.find(l => l.id === b.dataset.lada);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deschide(lada, b.hasAttribute('data-gratis')); return; }
    b.classList.add('is-scutura');
    haptic();
    setTimeout(() => { b.classList.remove('is-scutura'); deschide(lada, b.hasAttribute('data-gratis')); }, 420);
  });
  $('c-sari').addEventListener('click', arata);
  $('c-rev').addEventListener('click', e => { if (e.target.closest('#c-rev-ok')) inchide(); });
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
