// Prima pagină: meniul, ecranele lui (Online, Local, Setări, Profil, Prieteni), Azi și
// caruselul cu jocuri. Stătea în index.html; e separat ca pagina să nu aibă cod în ea
// (protecția CSP interzice codul scris direct în pagini).
(() => {
  const { store, fmt } = window.Shared;
  const keys = ['mix', 'hp', 'weight', 'accel'];
  const best = Math.max(0, ...keys.map(k => store.get(`hl_best_${k}`, 0)));
  document.getElementById('higher-best').textContent = best ? `Recordul tău: ${best}` : 'Mixt sau o categorie, cu sau fără cronometru';

  const ob = Math.max(0, ...['hp', 'weight', 'accel'].map(k => store.get(`ord_best_${k}`, 0)));
  if (ob) document.getElementById('ordine-best').textContent = `Recordul tău: ${ob}`;

  // The games sit in a row that scrolls sideways (swipe, arrows or the dots). The
  // switch next to the title picks which kind of game the row shows.
  const row = document.querySelector('.hub-games');
  const all = [...row.children];
  const dotsBox = document.getElementById('hub-dots');
  let cards = all, dots = [], last = -1;
  // Jocurile ca rânduri mari, cu o poză mică (din cardul fiecăruia).
  function lista(tip) {
    document.getElementById('j-lista').innerHTML = all.filter(c => c.dataset.tip === tip).map(c => {
      const src = (c.querySelector('source') || {}).srcset || '';
      const poza = src.split(' ')[0];
      const titlu = c.querySelector('.game-title').textContent;
      const sub = (c.querySelector('.game-meta') || {}).textContent || '';
      const href = c.querySelector('.game-cta').getAttribute('href');
      return `<a class="mj-r" href="${href}">
        ${poza ? `<span class="mj-f"><img src="${poza}" alt="" loading="lazy" decoding="async"></span>` : ''}
        <span class="mj-t"><b>${titlu}</b><small>${sub}</small></span><i class="mj-s" aria-hidden="true">&rsaquo;</i></a>`;
    }).join('');
  }
  function arataTip(tip) {
    lista(tip);
    all.forEach(c => { c.hidden = c.dataset.tip !== tip; });
    cards = all.filter(c => !c.hidden);
    document.querySelectorAll('.hub-tip [data-tip]').forEach(b => {
      const on = b.dataset.tip === tip;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    dotsBox.innerHTML = cards.map(() => '<span></span>').join('');
    dots = [...dotsBox.children];
    row.scrollLeft = 0;
    last = -1;
  }
  const step = () => cards[0].offsetWidth + parseFloat(getComputedStyle(row).columnGap || 0);
  const sync = () => {
    const i = Math.round(row.scrollLeft / step());
    const visible = Math.max(1, Math.round(row.clientWidth / step()));
    dots.forEach((d, j) => d.classList.toggle('is-on', j >= i && j < i + visible));
    document.querySelector('.hub-prev').disabled = row.scrollLeft < 4;
    document.querySelector('.hub-next').disabled = row.scrollLeft > row.scrollWidth - row.clientWidth - 4;
    if (i !== last && last !== -1) Shared.haptic();
    last = i;
  };
  row.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  document.querySelector('.hub-prev').addEventListener('click', () => row.scrollBy({ left: -step(), behavior: 'smooth' }));
  document.querySelector('.hub-next').addEventListener('click', () => row.scrollBy({ left: step(), behavior: 'smooth' }));
  // Online sau Local, lângă titlu (bara de jos ține minte ce ai ales)
  document.querySelector('.hub-tip').addEventListener('click', e => {
    const b = e.target.closest('[data-tip]');
    if (!b) return;
    store.set('frq_tip', b.dataset.tip);
    Shared.mergi('#' + b.dataset.tip);
  });
  // ---------- meniul principal, jocurile, Profilul, după # ----------
  // Fiecare ecran are adresa lui, deci butonul Înapoi al telefonului urcă un nivel.
  const ECRANE = { meniu: 'ecran-meniu', jocuri: 'ecran-jocuri', setari: 'ecran-setari', profil: 'ecran-profil', prieteni: 'ecran-prieteni', recorduri: 'ecran-recorduri' };
  function ecran() {
    const h = location.hash.slice(1);
    const e = ['online', 'local'].includes(h) ? 'jocuri' : ECRANE[h] && h !== 'jocuri' ? h : 'meniu';
    Object.entries(ECRANE).forEach(([k, id]) => { document.getElementById(id).hidden = k !== e; });
    if (e === 'jocuri') {
      store.set('frq_tip', h);
      arataTip(h);
      sync();
    }
    if (e === 'setari') randeazaSetari();
    if (e === 'profil') randeazaProfil();
    if (e === 'recorduri') randeazaRecorduri();
    if (e === 'prieteni') randeazaPrieteni();
    if (e === 'meniu') randeazaAzi();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', ecran);
  // „‹ Profil": Setările, Prietenii și Recordurile stau în Profil
  document.querySelectorAll('[data-inapoi]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    Shared.inapoi();
  }));

  // ---------- Azi: ce te așteaptă astăzi ----------
  // Provocările zilei, misiunile, lăzile gratis, Cupa și seria, într-un loc, plus
  // „Joacă acum": primul lucru nefăcut. Fără cont se arată ce există (nu facem un
  // cont la simpla vizită); cu cont, ce ai făcut deja e bifat.
  const PROVOCARI = [
    ['sus-sau-jos', 'Sus sau jos', 'sus-sau-jos.html?online&provocare'],
    ['ordine', 'În ordine', 'ordine.html?online&provocare'],
    ['startul', 'Cursa zilei', 'drag.html?online&provocare'],
    ['carti', 'Duel de cărți', 'carti.html?provocare'],
    ['geaman', 'Geamănul', 'geaman.html?provocare'],
  ];
  // un rând din Azi: iconița, ce e, cât ai făcut; bifat verde când e gata
  const BIFA = '<svg class="azi-ok" viewBox="0 0 24 24" aria-label="Gata"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const SAG = '<svg class="azi-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const rand = (ic, gata, href, text, extra = '') => `<li><a class="azi-r${gata ? ' is-gata' : ''}" href="${href}"><span class="azi-i">${Shared.icon(ic)}</span><span class="azi-r-t"><b>${text}</b>${extra ? `<small>${extra}</small>` : ''}</span>${gata ? BIFA : SAG}</a></li>`;
  // poza mare de sus, după jocul spre care duce
  const POZA_AZI = [['sus-sau-jos', 'sus-sau-jos'], ['ordine', 'ordine'], ['drag', 'drag'], ['colectie', 'garaj'], ['carti', 'carti'], ['geaman', 'masina-perfecta']];
  function randeazaAziCu(r) {
    const azi = r && r.azi, p = r && r.portofel;
    const ziFacuta = k => !!(azi && azi.provocari && azi.provocari[k]);
    const misiuni = (r && r.misiuni) || [];
    const facute = misiuni.filter(m => m.gata).length;
    const gratis = p ? p.lazi_gratis : 0;
    // „Joacă acum": prima provocare nefăcută, apoi o misiune, o ladă gratis, Cupa
    // sus, prima provocare nefăcută, pornind în fiecare zi de la alt joc
    const zi = Math.floor(Date.now() / 864e5) % PROVOCARI.length;
    const prov = [...PROVOCARI.slice(zi), ...PROVOCARI.slice(0, zi)].find(([k]) => !ziFacuta(k));
    const mis = misiuni.find(m => !m.gata);
    const cupa = azi && azi.cupa && azi.cupa.azi && !azi.cupa.inscris;
    const [k, titlu, href, sub] = prov ? ['Provocarea zilei', prov[1], prov[2], 'Aceleași mașini pentru toți']
      : mis ? ['Misiunea zilei', mis.text, mis.link, 'Pe loc, când o termini']
        : gratis ? ['Garajul meu', gratis === 1 ? 'Lada gratis' : `${gratis} lăzi gratis`, 'colectie.html#lazi', 'Te așteaptă']
          : cupa ? ['E deschisă azi', 'Cupa de duminică', 'drag.html?online', 'În Startul']
            : ['Pentru clasament', 'Sus sau jos', 'sus-sau-jos.html?online', 'Bate-ți recordul'];
    // cine n-are încă cont (n-a jucat online): un singur pas clar, provocarea zilei
    const nou = !(window.FrqCloud && FrqCloud.areCont());
    document.getElementById('azi-joaca-k').textContent = nou ? `Începe aici · ${k}` : k;
    document.getElementById('azi-joaca-t').textContent = titlu;
    document.getElementById('azi-joaca-s').textContent = sub;
    document.getElementById('azi-joaca').href = href;
    const poza = `img/hub-${(POZA_AZI.find(([x]) => href.startsWith(x)) || [, 'drag'])[1]}-640.webp`;
    const f = document.getElementById('azi-foto');
    if (!f.src.endsWith(poza)) f.src = poza;
    const provFacute = PROVOCARI.filter(([k]) => ziFacuta(k)).length;
    const lista = [
      `<li class="azi-prov"><p class="azi-prov-t">Provocările zilei<small>${provFacute} din ${PROVOCARI.length}</small></p><div>${PROVOCARI.map(([k, n, h]) => `<a class="azi-chip${ziFacuta(k) ? ' is-gata' : ''}" href="${h}">${ziFacuta(k) ? BIFA : ''}${n}</a>`).join('')}</div></li>`,
      r ? rand('misiuni', misiuni.length && facute === misiuni.length, 'colectie.html#misiuni', 'Misiunile zilei', `${facute} din ${misiuni.length || 3}`)
        : rand('misiuni', false, 'colectie.html#misiuni', 'Misiunile zilei', '3 pe zi, cu bani'),
      r ? (gratis ? rand('lada', false, 'colectie.html#lazi', gratis === 1 ? 'O ladă gratis' : `${gratis} lăzi gratis`, 'Te așteaptă în Garaj')
        : rand('lada', false, 'colectie.html#lazi', 'Lăzi', p ? `${p.mil} mil. în portofel` : 'Lăzi și pachete'))
        : rand('lada', false, 'colectie.html#lazi', 'Lăzi', 'Primele lăzi sunt gratis'),
      azi && azi.cupa && azi.cupa.azi
        ? rand('cupa', azi.cupa.inscris, 'drag.html?online', 'Cupa de duminică', azi.cupa.inscris ? 'Ești înscris' : 'E deschisă azi')
        : rand('cupa', false, 'drag.html?online', 'Cupa de duminică', 'Duminică, în Startul'),
    ];
    document.getElementById('azi-lista').innerHTML = lista.join('');
    // seria de zile (o zi lipsă nu o rupe)
    const serie = document.getElementById('azi-serie');
    const zile = p && p.serie && p.ultima_zi && azi && (Date.parse(azi.data) - Date.parse(p.ultima_zi)) / 864e5 <= 2 ? p.serie : 0;
    serie.hidden = zile < 2;
    serie.textContent = `Seria: ${zile} zile`;
  }
  async function randeazaAzi() {
    document.getElementById('azi-data').textContent = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' }).format(new Date());
    randeazaAziCu(null);
    if (!window.FrqCloud || !FrqCloud.areCont()) return;
    incarcaPrieteni().then(arataInvitatiiAzi);
    // la a doua deschidere a aplicației (nu la prima), întrebăm de notificări
    try {
      if (!sessionStorage.getItem('frq_sesiune')) { sessionStorage.setItem('frq_sesiune', '1'); localStorage.setItem('frq_vizite', String((Number(localStorage.getItem('frq_vizite')) || 0) + 1)); }
      if (Number(localStorage.getItem('frq_vizite')) >= 2 && window.FrqNotif) setTimeout(() => { if (!document.getElementById('ecran-meniu').hidden) FrqNotif.propune('inceput'); }, 4000);
    } catch { /* fără stocare */ }
    const salvat = FrqCloud.portofelSalvat();
    if (salvat) randeazaAziCu(salvat);
    try {
      const r = await FrqCloud.portofel();
      randeazaAziCu(r);
      // ce a venit cât ai lipsit (Cupa, premiul săptămânii, seturi): doar pe meniu, nu peste alt ecran
      if (!document.getElementById('ecran-meniu').hidden) FrqCloud.arataPremiiNoi(r.premii);
    } catch { /* rămâne lista de bază */ }
    arataInvitatiiAzi();
  }

  // ---------- Prietenii ----------
  // Lista, cererile și invitațiile la joc (funcția `prieteni`). Bulina din antet:
  // cereri primite și invitații la joc care încă așteaptă.
  const esc = Shared.esc;
  const NUME_JOC = { licitatie: 'Licitația', draft: 'Mașina perfectă', startul: 'Startul live', 'sus-sau-jos': 'Sus sau jos', ordine: 'În ordine', carti: 'Duel de cărți' };
  const linkJoc = (joc, cod) => (joc === 'startul' ? `drag.html?online&live=${cod}` : `camera.html?cod=${cod}`);
  const linkNou = (joc, id) => (joc === 'startul' ? `drag.html?online&invita=${id}` : `camera.html?joc=${joc}&invita=${id}`);
  let pr = null, mesajPrieteni = '';
  // Linkul unui prieten (?inv=…): „Adaugi pe X?" și sunteți prieteni pe loc. Fără
  // cont legat: o dată „leagă-ți garajul", apoi rămâne în Prieteni până îl legi.
  async function prietenDinLink() {
    const v = window.FrqCloud && FrqCloud.prietenDinLink();
    if (!v || !FrqCloud.areCont()) return;
    let c;
    try { c = await FrqCloud.prieteni({ actiune: 'cine', cod: v.cod }); } catch { return; }
    if (c.eroare || c.propriu || c.deja) { FrqCloud.tinePrietenDinLink(null); return; }
    if (!c.legat) {
      if (v.aratat) return;
      FrqCloud.tinePrietenDinLink({ ...v, nume: c.nume, aratat: true });
      if (await Shared.intreaba(I18n.t('Ca să fii prieten cu {n}, leagă-ți garajul de mail.', { n: c.nume }), { titlu: I18n.t('Prieteni'), da: 'Leagă garajul', nu: 'Mai târziu', primar: 'da' })) location.replace('colectie.html#cont');
      return;
    }
    const da = await Shared.intreaba(I18n.t('Adaugi pe {n} la prieteni?', { n: c.id_public ? `${c.nume} (@${c.id_public})` : c.nume }), { titlu: I18n.t('Prieteni'), da: 'Adaugă', nu: 'Nu', primar: 'da' });
    FrqCloud.tinePrietenDinLink(null);
    if (!da) return;
    let r;
    try { r = await FrqCloud.prieteni({ actiune: 'link', cod: v.cod }); } catch { r = { eroare: 'retea' }; }
    mesajPrieteni = r.prieteni ? I18n.t('Acum ești prieten cu {n}.', { n: r.nume })
      : r.eroare === 'el nelegat' ? I18n.t('{n} nu are încă garajul legat de mail.', { n: r.nume || c.nume })
      : r.eroare === 'prea multi' ? I18n.t('Unul dintre voi a atins numărul maxim de prieteni.')
      : I18n.t('Nu s-a putut adăuga acum.');
    if (location.hash === '#prieteni') randeazaPrieteni(); else Shared.mergi('#prieteni');
  }
  setTimeout(prietenDinLink, 800);
  async function incarcaPrieteni() {
    if (!window.FrqCloud || !FrqCloud.areCont()) return null;
    try { pr = await FrqCloud.prieteni({ actiune: 'stare' }); } catch { return null; }
    const n = pr.primite.length + pr.invitatii.length, b = document.getElementById('pr-bula');
    b.hidden = !n; b.textContent = n;
    return pr;
  }
  // invitațiile la joc, sus în Azi (cine te așteaptă acum)
  function arataInvitatiiAzi() {
    const ul = document.getElementById('azi-lista');
    ul.querySelectorAll('.azi-inv').forEach(x => x.remove());
    if (!pr || !pr.invitatii.length) return;
    ul.insertAdjacentHTML('afterbegin', pr.invitatii.slice(0, 2).map(i => `<li class="azi-inv"><a href="${linkJoc(i.joc, i.cod)}"><b>${esc(i.de)}</b> te invită la ${NUME_JOC[i.joc] || 'un joc'}${i.miza ? ` · ${i.miza} mil.` : ''}<span>Intră &rsaquo;</span></a></li>`).join(''));
  }
  async function randeazaPrieteni() {
    const el = document.getElementById('pr-in');
    // prietenii sunt pentru garajele legate de mail (un cont anonim se poate pierde)
    const dinLink = FrqCloud && FrqCloud.prietenDinLink();
    const faraCont = `<div class="pr-legat"><p><b>${dinLink && dinLink.nume ? I18n.t('Ca să fii prieten cu {n}, leagă-ți garajul de mail.', { n: esc(dinLink.nume) }) : I18n.t('Prietenii sunt pentru garajele legate de mail.')}</b> Așa nu-i pierzi dacă schimbi telefonul.</p>
      <a class="btn btn-primary" href="colectie.html#cont">Leagă garajul</a><a class="col-link" href="colectie.html#invita">Invită un prieten</a></div>`;
    if (!window.FrqCloud || !FrqCloud.areCont()) { el.innerHTML = faraCont; return; }
    el.innerHTML = Shared.schelet(4);
    if (!(await incarcaPrieteni())) { el.innerHTML = '<p class="col-nota">Nu se poate încărca acum.</p>'; return; }
    if (pr.legat === false) { el.innerHTML = faraCont; return; }
    const jocuri = Object.keys(NUME_JOC);
    el.innerHTML = `<div class="pr-col">
      ${pr.invitatii.length ? `<p class="label">Te așteaptă</p><ul class="pr-lista">${pr.invitatii.map(i => `<li class="pr-inv"><span><b>${esc(i.de)}</b> te invită la ${NUME_JOC[i.joc] || 'un joc'}${i.miza ? ` · ${i.miza} mil.` : ''}</span>
        <span class="pr-act"><a class="btn btn-primary" href="${linkJoc(i.joc, i.cod)}">Intră</a><button class="btn btn-ghost" type="button" data-refuza="${esc(i.id)}" aria-label="Refuză">&times;</button></span></li>`).join('')}</ul>` : ''}
      ${pr.primite.length ? `<p class="label">Vor să fiți prieteni</p><ul class="pr-lista">${pr.primite.map(x => `<li><span><b>${esc(x.nume)}</b>${x.id_public ? ` <small>@${esc(x.id_public)}</small>` : ''}</span>
        <span class="pr-act"><button class="btn btn-primary" type="button" data-accepta="${esc(x.id)}">Acceptă</button><button class="btn btn-ghost" type="button" data-refuz="${esc(x.id)}" aria-label="Refuză">&times;</button></span></li>`).join('')}</ul>` : ''}
      <p class="label">Prieteni${pr.prieteni.length ? ` · ${pr.prieteni.length}` : ''}</p>
      ${pr.prieteni.length ? `<ul class="pr-lista">${pr.prieteni.map(x => `<li class="pr-p"><span><b>${esc(x.nume)}</b>${x.id_public ? ` <small>@${esc(x.id_public)}</small>` : ''}</span>
        <span class="pr-act"><button class="btn btn-primary" type="button" data-joaca="${esc(x.id)}">Joacă</button><button class="btn btn-ghost" type="button" data-sterge="${esc(x.id)}" data-nume="${esc(x.nume)}" aria-label="Șterge">&times;</button></span>
        <div class="pr-jocuri" hidden>${jocuri.map(j => `<a class="azi-chip" href="${linkNou(j, x.id)}">${NUME_JOC[j]}</a>`).join('')}</div></li>`).join('')}</ul>`
        : '<p class="col-nota">Încă niciunul. Dă-le codul tău sau scrie codul lor mai jos.</p>'}
      ${pr.trimise.length ? `<ul class="pr-lista pr-trimise">${pr.trimise.map(x => `<li><span><b>${esc(x.nume)}</b> · cerere trimisă</span><button class="btn btn-ghost" type="button" data-sterge="${esc(x.id)}" aria-label="Anulează">&times;</button></li>`).join('')}</ul>` : ''}
      </div><div class="pr-col">
      <div class="pr-cod">
        <p class="label">Adaugă prieteni</p>
        ${pr.eu && pr.eu.id_public ? `<p class="pr-cod-v"><b class="pr-id">@${esc(pr.eu.id_public)}</b></p>` : '<p class="col-nota">Alege-ți un ID (ex. @frincu), ca să te găsească ușor: <a href="colectie.html#cont">Contul</a>.</p>'}
        <button class="btn btn-primary pr-link" type="button" id="pr-link">Trimite linkul tău</button>
        <p class="col-nota">Cine intră din el devine prietenul tău.</p>
      </div>
      <form class="col-mail pr-adauga" id="pr-adauga"><input type="text" required maxlength="17" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="@id-ul unui prieten" aria-label="ID-ul unui prieten"><button class="btn btn-ghost" type="submit">Caută</button></form>
      <p class="cam-err${mesajPrieteni ? ' is-ok' : ''}" id="pr-err" role="alert"${mesajPrieteni ? '' : ' hidden'}>${esc(mesajPrieteni)}</p></div>`;
    mesajPrieteni = '';
  }
  document.getElementById('pr-in').addEventListener('click', async e => {
    // doar butoanele listei (Adaugă trimite formularul, îl prinde `submit`)
    const t = e.target.closest('button:not([type=submit])');
    if (!t) return;
    const d = t.dataset;
    if (d.joaca) { const j = t.closest('li').querySelector('.pr-jocuri'); j.hidden = !j.hidden; return; }
    if (t.id === 'pr-link') {
      const link = FrqCloud.linkInvitatie((pr.eu && pr.eu.id_public) || pr.cod);
      const text = I18n.t('Hai să fim prieteni în FRQ:');
      try { if (navigator.share) { await navigator.share({ text, url: link }); return; } } catch (x) { if (x && x.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${text} ${link}`); t.textContent = I18n.t('Link copiat'); } catch { window.prompt(I18n.t('Copiază linkul'), link); }
      return;
    }
    t.disabled = true;
    try {
      if (d.accepta) await FrqCloud.prieteni({ actiune: 'raspunde', cu: d.accepta, accepta: true });
      if (d.refuz) await FrqCloud.prieteni({ actiune: 'raspunde', cu: d.refuz, accepta: false });
      if (d.refuza) await FrqCloud.prieteni({ actiune: 'refuza', id: d.refuza });
      if (d.sterge) {
        if (d.nume && !(await Shared.intreaba(I18n.t('Îl ștergi pe {n} din prieteni?', { n: d.nume }), { da: 'Șterge', nu: 'Nu' }))) { t.disabled = false; return; }
        await FrqCloud.prieteni({ actiune: 'sterge', cu: d.sterge });
      }
    } catch { /* lista arată starea reală */ }
    randeazaPrieteni();
  });
  document.getElementById('pr-in').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, cod = f.querySelector('input').value.trim(), err = document.getElementById('pr-err');
    f.querySelector('button').disabled = true;
    const ERORI = { cod: 'Niciun jucător cu ID-ul ăsta.', propriu: 'E codul tău.', deja: 'Sunteți deja prieteni.', trimisa: 'I-ai trimis deja o cerere.', 'prea multi': 'Ai atins numărul maxim de prieteni.', 'prea multe': 'Prea multe cereri într-o oră. Mai încearcă.', 'el nelegat': 'Jucătorul ăsta nu are încă garajul legat de mail.', 'cont nelegat': 'Leagă-ți garajul de mail ca să ai prieteni.' };
    try {
      const r = await FrqCloud.prieteni({ actiune: 'cere', cod });
      if (window.FrqNotif) setTimeout(() => FrqNotif.propune('prieten'), 1200);
      await randeazaPrieteni();
      const e2 = document.getElementById('pr-err');
      e2.hidden = false; e2.classList.add('is-ok');
      e2.textContent = I18n.t(r.prieteni ? 'Acum ești prieten cu {n}.' : 'Cerere trimisă lui {n}.', { n: r.nume });
    } catch (x) {
      const k = await FrqCloud.codEroare(x);
      err.hidden = false; err.textContent = I18n.t(ERORI[k] || 'Nu s-a putut trimite acum.');
      f.querySelector('button').disabled = false;
    }
  });

  // ---------- Profilul ----------
  // Statisticile vin din profil_meu (o singură cerere), realizările se socotesc aici
  // din ele, fiecare cu progresul spre țintă: aproape de țintă, omul trage mai tare.
  const CAT_N = { mix: 'Mixt', hp: 'Cai putere', weight: 'Greutate', accel: '0-100 km/h' };
  const REALIZARI = [
    ['Prima provocare', 'Termină o Provocare a zilei', p => p.provocari, 1],
    ['O săptămână', 'Joacă provocări în 7 zile diferite', p => p.zile, 7],
    ['O lună pe pistă', 'Joacă provocări în 30 de zile diferite', p => p.zile, 30],
    ['Colecționar', 'Strânge 50 de mașini', p => p.garaj.masini, 50],
    ['Garaj plin', 'Strânge 200 de mașini', p => p.garaj.masini, 200],
    ['Toate', 'Strânge toate cele 685 de mașini', p => p.garaj.masini, 685],
    ['Legendar', 'Scoate o mașină legendară', p => p.garaj.legendare, 1],
    ['Primul set', 'Completează un set', p => p.seturi, 1],
    ['Zece seturi', 'Completează 10 seturi', p => p.seturi, 10],
    ['Ochi de expert', 'Fă 15 în Sus sau jos, cu cronometru', p => bestJoc(p, 'sus-sau-jos'), 15],
    ['Enciclopedie', 'Fă 25 în Sus sau jos, cu cronometru', p => bestJoc(p, 'sus-sau-jos'), 25],
    ['Ordine perfectă', 'Pune 10 mașini la locul lor în În ordine', p => bestJoc(p, 'ordine'), 10],
    ['Primul duel', 'Câștigă un duel în Startul', p => p.dueluri.castigate, 1],
    ['Pilot de duel', 'Câștigă 25 de dueluri', p => p.dueluri.castigate, 25],
    ['Pe acte', 'Câștigă o mașină într-un duel pe acte', p => p.dueluri.acte, 1],
    ['Cu gașca', 'Câștigă 10 partide cu prietenii', p => (p.stat.camere_castigate || 0) + (p.stat.live_castigate || 0), 10],
    ['Mecanic', 'Duce o piesă a unei mașini la nivelul 5', p => p.garaj.nivel5, 1],
    ['Pilot de test', 'Fă un record cu 25 de mașini', p => p.recorduri, 25],
    ['Om de încredere', 'Termină 50 de misiuni', p => p.misiuni, 50],
    ['Pe podium', 'Un loc 1-3 la premiile săptămânii sau la Cupă', p => p.podium_saptamana + p.podium_cupa, 1],
  ];
  function bestJoc(p, joc) { return Math.max(0, ...(p.general || []).filter(x => x.joc === joc).map(x => x.scor)); }
  // Profilul: cine ești, sus, apoi locurile lui (Prieteni, Recorduri, Setări)
  let profilCache = null;
  async function incarcaProfil() {
    if (!window.FrqCloud || !FrqCloud.areCont()) return null;
    try { profilCache = await FrqCloud.profil(); } catch { return profilCache; }
    const p = profilCache;
    if (!p) return null;
    p.garaj = p.garaj || { masini: 0, legendare: 0, nivel5: 0 };
    p.dueluri = p.dueluri || { jucate: 0, castigate: 0, acte: 0 };
    p.stat = p.stat || {};
    return p;
  }
  function randeazaMeniuProfil(p) {
    const facute = p ? REALIZARI.filter(([, , v, t]) => v(p) >= t).length : 0;
    const cereri = pr ? pr.primite.length + pr.invitatii.length : 0;
    document.getElementById('pf-meniu').innerHTML = Shared.randuriMeniu([
      { id: 'prieteni', icon: 'prieten', titlu: 'Prieteni', sub: pr && pr.prieteni ? `${pr.prieteni.length} ${pr.prieteni.length === 1 ? 'prieten' : 'prieteni'}` : 'Codul tău, cereri, invitații', insigna: cereri ? String(cereri) : '' },
      { id: 'recorduri', icon: 'recorduri', titlu: 'Recorduri și realizări', sub: p ? `${facute} din ${REALIZARI.length} realizări` : 'Apar după prima partidă online' },
      { id: 'setari', icon: 'setari', titlu: 'Setări', sub: 'Nume, limbă, sunet, notificări, cont' },
    ]);
  }
  document.getElementById('pf-meniu').addEventListener('click', e => {
    const r = e.target.closest('[data-mj]');
    if (r) { Shared.haptic(); Shared.mergi('#' + r.dataset.mj); }
  });
  async function randeazaProfil() {
    const el = document.getElementById('pf-in');
    randeazaMeniuProfil(profilCache);
    if (!window.FrqCloud || !FrqCloud.areCont()) {
      el.innerHTML = `<div class="pf-cap"><span class="pf-av" aria-hidden="true">?</span><div><p class="pf-nume">${Shared.esc((window.FrqCloud && FrqCloud.numeLocal()) || 'Profilul tău')}</p><p class="pf-din">Se face la prima ta partidă online</p></div></div>
        <a class="btn btn-primary pf-start" href="sus-sau-jos.html?online&amp;provocare">Joacă Provocarea zilei</a>`;
      return;
    }
    if (!profilCache) el.innerHTML = Shared.schelet(2);
    incarcaPrieteni().then(() => randeazaMeniuProfil(profilCache));
    const p = await incarcaProfil();
    if (location.hash !== '#profil') return;
    if (!p) { el.innerHTML = '<p class="pf-gol">Profilul nu se poate încărca acum.</p>'; return; }
    const e = Shared.esc, nume = p.nume || FrqCloud.numeLocal() || 'Jucător';
    const din = p.din ? new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(p.din)) : '';
    el.innerHTML = `
      <div class="pf-cap"><span class="pf-av" aria-hidden="true">${e(nume.trim().charAt(0).toUpperCase())}</span><div><p class="pf-nume">${e(nume)}</p>${din ? `<p class="pf-din">Pe FRQ din ${e(din)}</p>` : ''}</div></div>
      <div class="col-stare pf-stare">
        <div class="col-bani"><small>Portofel</small><b>${p.portofel ? p.portofel.mil : 0} mil.</b></div>
        <div class="col-bani"><small>Mașini</small><b>${p.garaj.masini}</b></div>
        <div class="col-bani"><small>Dueluri</small><b>${p.dueluri.castigate}</b></div>
      </div>`;
    randeazaMeniuProfil(p);
  }
  async function randeazaRecorduri() {
    const el = document.getElementById('rec-in');
    if (!window.FrqCloud || !FrqCloud.areCont()) {
      el.innerHTML = `<p class="pf-gol">Recordurile, duelurile și realizările apar aici după prima ta partidă online.</p>
        <a class="btn btn-primary" href="sus-sau-jos.html?online&amp;provocare">Joacă Provocarea zilei</a>`;
      return;
    }
    if (!profilCache) el.innerHTML = Shared.schelet(6);
    const p = await incarcaProfil();
    if (location.hash !== '#recorduri') return;
    if (!p) { el.innerHTML = '<p class="pf-gol">Profilul nu se poate încărca acum.</p>'; return; }
    const e = Shared.esc, f = Shared.fmt;
    const rec = (joc, cats) => cats.map(k => {
      const r = (p.general || []).find(x => x.joc === joc && x.cat === k);
      return `<li><span>${CAT_N[k]}</span><b>${r ? r.scor : '–'}</b></li>`;
    }).join('');
    const facute = REALIZARI.filter(([, , v, t]) => v(p) >= t).length;
    const prieteni = (p.stat.camere_castigate || 0) + (p.stat.live_castigate || 0);
    el.innerHTML = `
      <div class="pf-grila">
        <section class="pf-bloc"><h3>Sus sau jos</h3><ul>${rec('sus-sau-jos', ['mix', 'hp', 'weight', 'accel'])}</ul></section>
        <section class="pf-bloc"><h3>În ordine</h3><ul>${rec('ordine', ['hp', 'weight', 'accel'])}</ul></section>
        <section class="pf-bloc"><h3>Startul</h3><ul>
          <li><span>Cursa zilei</span><b>${p.cursa_zilei ? `${f(p.cursa_zilei / 1000, 3)} s` : '–'}</b></li>
          <li><span>Mașini cu record</span><b>${p.recorduri}</b></li>
        </ul></section>
      </div>
      <h2 class="label">Întreceri</h2>
      <div class="pf-grila">
        <section class="pf-bloc"><ul>
          <li><span>Dueluri câștigate</span><b>${p.dueluri.castigate} din ${p.dueluri.jucate}</b></li>
          <li><span>Mașini luate pe acte</span><b>${p.dueluri.acte}</b></li>
          <li><span>Partide câștigate cu prietenii</span><b>${prieteni}${p.stat.camere_jucate ? ` din ${p.stat.camere_jucate}` : ''}</b></li>
          <li><span>Podiumuri (săptămâna, Cupa)</span><b>${p.podium_saptamana + p.podium_cupa}</b></li>
        </ul></section>
        <section class="pf-bloc"><ul>
          <li><span>Provocări ale zilei</span><b>${p.provocari}</b></li>
          <li><span>Zile jucate</span><b>${p.zile}</b></li>
          <li><span>Misiuni terminate</span><b>${p.misiuni}</b></li>
          <li><span>Lăzi deschise</span><b>${p.lazi}</b></li>
        </ul></section>
      </div>
      <h2 class="label">Realizări · ${facute} din ${REALIZARI.length}</h2>
      <ul class="pf-real">${REALIZARI.map(([t, d, v, tinta]) => {
        const x = Math.min(v(p) || 0, tinta), gata = x >= tinta;
        return `<li class="${gata ? 'is-gata' : ''}"><b>${e(t)}</b><small>${e(d)}</small>
          <span class="pf-bara" aria-hidden="true"><i style="width:${Math.round((100 * x) / tinta)}%"></i></span>
          <em>${gata ? 'Gata' : `${x} din ${tinta}`}</em></li>`;
      }).join('')}</ul>`;
  }

  // ---------- Setări ----------
  const cont = window.FrqCont ? FrqCont.monteaza(document.getElementById('c-cont')) : null;
  function randeazaSetari() {
    const inNume = document.querySelector('#st-nume input');
    inNume.value = window.FrqCloud ? FrqCloud.numeLocal() : '';
    if (window.FrqCloud) FrqCloud.numeDeLaServer().then(n => { if (document.activeElement !== inNume && n) inNume.value = n; });
    document.getElementById('st-sunet').checked = store.get('drg_sunet', true) !== false;
    document.getElementById('st-sunete').checked = store.get('frq_sunete', true) !== false;
    document.getElementById('st-volum').value = Math.round(100 * Number(store.get('frq_volum', 1)));
    document.getElementById('st-vibratii').checked = store.get('frq_vibratii', true) !== false;
    if (cont) cont.randeaza();
  }
  document.getElementById('st-nume').addEventListener('submit', async e => {
    e.preventDefault();
    const v = e.target.querySelector('input').value.trim();
    if (!v || !window.FrqCloud) return;
    FrqCloud.seteazaNume(v);
    const nota = document.getElementById('st-nume-n');
    // cu cont, numele se schimbă și în clasamente; fără, la primul joc online
    if (FrqCloud.areCont()) {
      try { await FrqCloud.schimbaNume(); nota.textContent = I18n.t('Salvat. Așa apari de acum în clasamente.'); }
      catch {
        nota.textContent = I18n.t('Numele nu e acceptat. Încearcă altul.');
        // rămâne cel de pe server (și în colțul de sus)
        FrqCloud.seteazaNume('');
        FrqCloud.numeDeLaServer();
        return;
      }
    } else nota.textContent = I18n.t('Salvat. Așa o să apari în clasamente.');
    Shared.haptic('success');
  });
  document.getElementById('st-sunet').addEventListener('change', e => store.set('drg_sunet', e.target.checked));
  document.getElementById('st-sunete').addEventListener('change', e => { store.set('frq_sunete', e.target.checked); if (e.target.checked && window.Sunete) Sunete.corect(); });
  document.getElementById('st-volum').addEventListener('input', e => store.set('frq_volum', Math.round(+e.target.value) / 100));
  document.getElementById('st-vibratii').addEventListener('change', e => { store.set('frq_vibratii', e.target.checked); Shared.haptic(); });
  FrqNotif.monteaza(document.getElementById('st-notif'));

  ecran();
})();
