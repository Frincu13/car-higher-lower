// Meniul de dinainte de joc, la jocurile care aveau un formular (Licitația, Mașina
// perfectă, Turometrul, Garaj sau presă): același ca la celelalte jocuri. Sus poza
// jocului cu Joacă, dedesubt câte un rând pe setare („Adversar · Bot ușor ›"). Un rând
// deschide un pas (#adversar, #jucatori...) cu controalele care erau deja în pagină;
// alegerea dintr-o listă te întoarce singură la meniu. Logica jocurilor rămâne a lor:
// aici doar se mută controalele și se apasă butoanele lor.
(() => {
  'use strict';
  const PAGINI = {
    'licitatie.html': {
      poza: 'img/hub-licitatie-640.webp', eticheta: 'Pe același telefon · 1 la 1', sub: '12 mașini la licitație, 10 mil. fiecare',
      porneste: () => document.getElementById('a-form').requestSubmit(),
      randuri: [
        { id: 'adversar', icon: 'bot', titlu: 'Adversar', pas: ['#a-adv'], val: () => ales('#a-adv') },
        { id: 'jucatori', icon: 'prieten', titlu: 'Jucători', pas: ['#a-form'], val: () => nume('#a-form input') },
      ],
    },
    'draft.html': {
      poza: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/1987-11-15_Fiorano_Ferrari_F40_espo.jpg/960px-1987-11-15_Fiorano_Ferrari_F40_espo.jpg', eticheta: 'Pe același telefon · 2 jucători', sub: 'Opt sloturi, o singură mașină perfectă',
      porneste: () => document.getElementById('setup-form').requestSubmit(),
      randuri: [
        { id: 'adversar', icon: 'bot', titlu: 'Adversar', pas: ['#d-adv'], val: () => ales('#d-adv') },
        { id: 'cronometru', icon: 'ceas', titlu: 'Cronometru', pas: ['#d-timer'], val: () => ales('#d-timer') },
        { id: 'jucatori', icon: 'prieten', titlu: 'Jucători', pas: ['#setup-form'], val: () => nume('#setup-form input') },
      ],
    },
    'turometru.html': {
      poza: 'img/hub-turometru-640.webp', eticheta: 'Un telefon · 2 sau mai mulți', sub: 'Unul pune o mașină pe turometru, restul ghicesc',
      porneste: () => document.getElementById('setup-form').requestSubmit(),
      randuri: [
        { id: 'jucatori', icon: 'prieten', titlu: 'Jucători', pas: ['#setup-form'], val: () => nume('#names input') },
        { id: 'runde', icon: 'cat', titlu: 'Runde', pas: ['#setup-form'], val: () => document.getElementById('rounds').value },
      ],
    },
    'garaj.html': {
      poza: 'img/hub-garaj-640.webp', eticheta: 'Singur sau cu prietenii', sub: 'Una în garaj, una vândută, una la presă',
      porneste: () => document.getElementById('g-start').click(),
      randuri: [
        { id: 'tema', icon: 'cat', titlu: 'Tema', pas: ['#g-themes'], val: () => ales('#g-themes') },
      ],
    },
  };
  const PAGINA = location.pathname.split('/').pop() || 'index.html';
  const cfg = PAGINI[PAGINA];
  if (!cfg || !window.Shared) return;
  const $ = s => document.querySelector(s);
  const start = $('#screen-setup > .start');
  if (!start) return;

  // textul alegerii de acum dintr-o listă de butoane (numele, fără subtitlu)
  function ales(sel) {
    const b = document.querySelector(`${sel} .is-on, ${sel} [aria-checked="true"]`);
    if (!b) return '';
    const n = b.querySelector('.cat-name');
    return (n ? n.textContent : b.textContent).trim();
  }
  // numele jucătorilor (sau cât sunt, dacă sunt mulți)
  function nume(sel) {
    const v = [...document.querySelectorAll(sel)].filter(i => i.offsetParent !== null || i.closest('[data-mf-pas]')).map(i => i.value.trim() || i.placeholder);
    return v.length > 2 ? `${v.length} jucători` : v.join(', ');
  }

  // meniul: pus după titlu; restul paginii (titlu, liste, formular) stă ascuns cât e meniul
  const meniu = document.createElement('nav');
  meniu.className = 'mj';
  meniu.id = 'mf-meniu';
  meniu.setAttribute('aria-label', 'Meniul jocului');
  start.insertBefore(meniu, start.firstChild);
  document.body.classList.add('are-hub', 'are-mf');
  // fiecare element dintr-un pas primește numele pasului (un element poate fi în mai mulți)
  cfg.randuri.forEach(r => r.pas.forEach(s => {
    const el = $(s);
    if (!el) return;
    const pasi = new Set((el.dataset.mfPas || '').split(' ').filter(Boolean));
    pasi.add(r.id);
    el.dataset.mfPas = [...pasi].join(' ');
    // titlul de deasupra listei („Adversar"), dacă e chiar înainte
    const t = el.previousElementSibling;
    if (t && t.matches('h2.label')) t.dataset.mfPas = el.dataset.mfPas;
  }));

  function randeaza() {
    const continua = $('[data-continua]:not([hidden])');
    Shared.monteazaHub(meniu, {
      erou: { id: 'joaca', eticheta: cfg.eticheta, titlu: '', sub: cfg.sub, buton: 'Joacă', poza: `<img src="${cfg.poza}" alt="" decoding="async">` },
      bara: cfg.randuri.map(r => ({ id: r.id, icon: r.icon, titlu: r.titlu, val: r.val() || null })),
      dale: continua ? [{ id: 'continua', titlu: 'Continuă partida', sub: (continua.querySelector('small') || {}).textContent || '', poza: `<img src="${cfg.poza}" alt="">` }] : [],
    });
  }
  function pas() {
    const h = location.hash.slice(1);
    const r = cfg.randuri.find(x => x.id === h);
    document.body.dataset.mf = r ? r.id : '';
    if (!r) randeaza();
  }
  meniu.addEventListener('click', e => {
    const b = e.target.closest('[data-mj]');
    if (!b) return;
    Shared.haptic();
    const id = b.dataset.mj;
    if (id === 'joaca') cfg.porneste();
    else if (id === 'continua') { const c = $('[data-continua]'); if (c) c.click(); }
    else Shared.mergi('#' + id);
  });
  // o alegere dintr-o listă te întoarce la meniu
  start.addEventListener('click', e => {
    const h = document.body.dataset.mf;
    if (!h || h === 'jucatori' || h === 'runde') return;
    if (e.target.closest('[role="radio"], .cat, .gsp-theme')) setTimeout(() => Shared.inapoi('#'), 180);
  });
  // „Start" din formular nu mai e nevoie de el: pornești din meniu (Enter din câmpuri merge)
  window.addEventListener('hashchange', pas);
  pas();
  setTimeout(randeaza, 400);   // după ce jocul și-a desenat listele și „Continuă"
})();
