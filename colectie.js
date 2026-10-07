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

  const stare = { portofel: null, garaj: new Map(), filtru: -1, doar: false, cutie: null, deschise: 0 };

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
    try {
      r = await FrqCloud.deschideLada(lada.id, gratis);
    } catch {
      stare.cutie = null;
      $('c-cutie').hidden = true;
      alerta('Lada nu s-a putut deschide acum. Banii nu s-au luat.');
      return;
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
    const lista = POOL
      .filter(c => stare.filtru < 0 || rar(c) === stare.filtru)
      .filter(c => !stare.doar || stare.garaj.has(M.cheieMasina(c)))
      .sort((a, b) => rar(b) - rar(a) || TIMP.get(a) - TIMP.get(b));
    $('c-grid').innerHTML = lista.length ? lista.map(c => {
      const g = stare.garaj.get(M.cheieMasina(c));
      const f = g ? poza(c).replace(' src="', ' data-src="') : fara(c);
      return `<div class="col-c rar-${rar(c)}${g ? ' is-a-mea' : ''}">
        <span class="col-c-f">${f}${g ? '' : '<i class="col-c-q" aria-hidden="true">?</i>'}${g && g.bucati > 1 ? `<i class="col-c-x">×${g.bucati}</i>` : ''}</span>
        <b>${esc(modelOf(c.name) || c.name)}</b><small>${esc(brandOf(c.name))} &middot; ${timpCarte(c)}</small>
      </div>`;
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

  function alerta(text) {
    const el = document.createElement('p');
    el.className = 'col-alerta';
    el.setAttribute('role', 'status');
    el.textContent = I18n.t(text);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- pornirea ----------
  async function incarca() {
    try {
      const r = await FrqCloud.portofel();
      stare.portofel = r.portofel;
      stare.garaj = new Map((r.garaj || []).map(g => [g.masina, g]));
    } catch {
      alerta('Garajul nu se poate încărca acum. Încearcă din nou puțin mai târziu.');
    }
    randeazaStare();
    randeazaLazi();
    randeazaColectia();
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
  incarca();
})();
