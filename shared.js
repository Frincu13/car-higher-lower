// Helpers shared by the games (Sus sau jos, Mașina perfectă, Turometrul).
window.Shared = (() => {
  'use strict';

  const MULTIWORD_BRANDS = ['Mercedes-Benz', 'Mercedes-AMG', 'Aston Martin', 'Alfa Romeo', 'Land Rover',
    'Range Rover', 'Rolls-Royce', 'De Tomaso'];

  // Best-effort storage: never required for the game to work.
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const fmtCache = {};
  function fmt(value, decimals) {
    const loc = window.I18n && I18n.lang === 'en' ? 'en-GB' : 'ro-RO';
    const key = `${loc}|${decimals}`;
    fmtCache[key] = fmtCache[key] || new Intl.NumberFormat(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return fmtCache[key].format(value);
  }

  function brandOf(name) {
    return MULTIWORD_BRANDS.find(b => name.startsWith(b + ' ')) || name.split(' ')[0];
  }
  const modelOf = name => name.slice(brandOf(name).length).trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The car under every photo: one silhouette, used big on the cards and small in lists.
  const CAR_SVG = `<svg class="art-car" viewBox="0 0 240 80" aria-hidden="true">
          <path d="M14 58c0-7 3-11 11-13l36-8c11-11 25-19 45-21 24-2 48 3 67 16l33 6c12 2 20 8 20 18v6c0 3-2 5-5 5h-15a21 21 0 0 0-41 0H79a21 21 0 0 0-41 0H20c-4 0-6-2-6-6z"/>
          <circle cx="58" cy="66" r="13"/><circle cx="192" cy="66" r="13"/>
        </svg>`;

  function artHTML(car) {
    const brand = brandOf(car.name);
    const hue = hashStr(brand) % 360;
    // The placeholder sits underneath the photo, so a photo that fails to load
    // (removed in wirePhotos) still leaves a finished-looking card.
    const photo = car.image
      ? `<img class="art-photo" src="${esc(car.image)}" alt="${esc(car.name)}" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">` : '';
    // Photo licenses (CC BY / BY-SA) require attribution: a quiet caption under the photo.
    const credit = car.image
      ? `<figcaption class="art-credit"><a href="${esc(car.source)}" target="_blank" rel="noopener">Foto: ${esc(car.credit)}, ${esc(car.license)}</a></figcaption>` : '';
    return `<figure class="art-fig">
      <div class="art art-placeholder" style="--hue:${hue}" role="img" aria-label="${esc(car.name)}">
        <span class="art-brand">${esc(brand)}</span>
        ${CAR_SVG}${photo}
      </div>${credit}
    </figure>`;
  }

  // A small photo for lists and slots: the same brand-tinted placeholder underneath,
  // so a photo that is slow or gone still leaves a finished box instead of a grey hole.
  function thumbHTML(car) {
    const brand = brandOf(car.name);
    return `<span class="art art-mini art-placeholder" style="--hue:${hashStr(brand) % 360}" role="img" aria-label="${esc(car.name)}">
        ${CAR_SVG}
        <img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer">
      </span>`;
  }

  function wirePhotos(root) {
    root.querySelectorAll('.art-photo').forEach(img => {
      if (img.dataset.legat) return;                 // a second wiring must not double the listeners
      img.dataset.legat = '1';
      const drop = () => { img.closest('.art-fig')?.querySelector('.art-credit')?.remove(); img.remove(); };
      // Photos fade in over the placeholder instead of popping in.
      const shown = () => img.classList.add('is-loaded');
      // One more try before giving up. The photos come from Wikimedia over whatever
      // signal the phone has, and a single hiccup used to cost the picture for the
      // whole round, with no way back short of a new deal.
      const sursa = img.src;
      let reincercat = false;
      const esuat = () => {
        if (reincercat) { drop(); return; }
        reincercat = true;
        setTimeout(() => { img.removeAttribute('src'); img.src = sursa; }, 700);
      };
      if (img.complete) { if (img.naturalWidth === 0) esuat(); else shown(); } // settled before we listened
      else {
        img.addEventListener('error', esuat);
        img.addEventListener('load', shown);
      }
    });
  }

  function preload(car) {
    if (car && car.image) { const i = new Image(); i.crossOrigin = 'anonymous'; i.referrerPolicy = 'no-referrer'; i.src = car.image; }
  }

  // A short buzz on taps. Android and desktop Chrome support this; iPhones do not,
  // because Safari has no Vibration API, so there a tap simply stays silent.
  // Vibrațiile se pot opri din Setări (frq_vibratii).
  function haptic(kind = 'tick') {
    try {
      if (!navigator.vibrate || store.get('frq_vibratii', true) === false) return;
      navigator.vibrate(kind === 'error' ? [24, 70, 24] : kind === 'success' ? 16 : 7);
    } catch { /* blocked, nothing to do */ }
  }

  // A turn clock the games share: a bar that drains under the top bar, plus the seconds
  // left. It pauses while the tab is hidden, so switching apps costs nobody their turn.
  // `pauseWhenHidden` is the honest bit: casual runs pause when you switch away, timed
  // runs do not, or leaving the page would be a way to buy thinking time. Either way the
  // time spent away is counted, so a run can be judged later.
  function makeTimer({ box, bar, num, onEnd, pauseWhenHidden = true }) {
    let total = 0, elapsed = 0, raf = 0, running = false, last = 0, shown = -1;
    let hiddenMs = 0, awayCount = 0, hiddenAt = 0;
    const api = { pauseWhenHidden };

    function paint() {
      if (!total) return;                     // stopwatch: there is nothing to draw
      const left = Math.max(0, total - elapsed);
      const frac = left / total;
      if (bar) bar.style.transform = `scaleX(${frac})`;
      const s = Math.max(0, Math.ceil(left / 1000));
      if (num && s !== shown) {
        num.textContent = s;
        if (shown >= 0 && s > 0 && s <= 3) haptic();
        shown = s;
      }
      if (box) box.classList.toggle('is-late', frac < .3);
    }

    function expired() {
      if (!total || elapsed < total) return false;
      elapsed = total; running = false; paint();
      if (onEnd) onEnd();
      return true;
    }

    function settle() {
      if (!running) return;
      const now = performance.now();
      if (!document.hidden) elapsed += now - last;
      last = now;
    }

    function tick(now) {
      if (!running) return;
      if (document.hidden) { last = now; raf = requestAnimationFrame(tick); return; }
      elapsed += now - last; last = now;
      paint();
      if (expired()) return;
      raf = requestAnimationFrame(tick);
    }

    // Frames stop while the page is in the background, so the time away is added by hand.
    document.addEventListener('visibilitychange', () => {
      if (!running) return;
      if (document.hidden) { settle(); hiddenAt = performance.now(); return; }
      const gone = performance.now() - hiddenAt;
      hiddenMs += gone; awayCount++;
      last = performance.now();
      if (!api.pauseWhenHidden) { elapsed += gone; if (expired()) return; }
      paint();
    });

    Object.assign(api, {
      // seconds > 0 counts down and shows the bar; 0 just measures the turn
      start(seconds = 0) {
        total = seconds * 1000; elapsed = 0; shown = -1;
        hiddenMs = 0; awayCount = 0;
        running = true; last = performance.now();
        if (box) box.hidden = !total;
        if (bar) bar.style.transform = 'scaleX(1)';
        paint();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      },
      // stops and hands back how long the turn took, in ms
      stop() { settle(); running = false; cancelAnimationFrame(raf); return elapsed; },
      used() { settle(); return elapsed; },
      away() { return { hiddenMs, awayCount }; },
      hide() { this.stop(); if (box) box.hidden = true; if (bar) bar.style.transform = 'scaleX(0)'; },
    });
    return api;
  }

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Peisajul pe telefon: cerem întoarcerea, o singură dată, din același loc
  // pentru toate paginile. CSS-ul decide când se vede.
  // Un panou peste ecran trebuie să ia și tastatura, nu doar ecranul. Fără asta,
  // Tab pleacă pe sub el, la butoanele pe care nu le vezi, iar cititoarele de
  // ecran citesc mai departe pagina de dedesubt. Toate panourile se deschid și se
  // închid prin atributul hidden, deci le urmărim pe toate dintr-un singur loc.
  function wirePanouri() {
    const panouri = [...document.querySelectorAll('.overlay, .auc-drawer')];
    if (!panouri.length) return;
    const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const radacina = el => { let n = el; while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; return n; };
    // Unde ne întoarcem după închidere: ultimul lucru focusat din afara panourilor.
    // Nu îl putem citi la deschidere, fiindcă între timp focusul a intrat deja în panou.
    let ultim = null;
    document.addEventListener('focusin', e => { if (!e.target.closest('.overlay, .auc-drawer')) ultim = e.target; });
    let inainte = null;

    const comuta = (panou, deschis) => {
      const meu = radacina(panou);
      if (deschis && !inainte) inainte = (document.activeElement && !document.activeElement.closest('.overlay, .auc-drawer')) ? document.activeElement : ultim;
      // un panou deschis peste altul (o întrebare peste o fereastră) fusese blocat de primul
      if (deschis) meu.inert = false;
      for (const n of document.body.children) {
        if (n === meu || n.tagName === 'SCRIPT') continue;
        n.inert = deschis;
      }
      // s-a închis cel de deasupra: cel de dedesubt rămâne singurul activ
      if (!deschis) {
        const altul = panouri.find(p => p !== panou && !p.hidden && p.isConnected);
        if (altul) { comuta(altul, true); return; }
      }
      if (deschis) {
        if (!panou.contains(document.activeElement)) {
          const f = [...panou.querySelectorAll(SELECTOR)].find(x => x.getClientRects().length);
          if (f) f.focus();
        }
      } else if (inainte && inainte.isConnected) {
        if (inainte.getClientRects().length) inainte.focus();
        inainte = null;
      }
    };

    const obs = new MutationObserver(ms => { for (const m of ms) comuta(m.target, !m.target.hidden); });
    for (const p of panouri) {
      obs.observe(p, { attributes: true, attributeFilter: ['hidden'] });
      if (!p.hidden) comuta(p, true);
    }
  }

  function wireRotate() {
    if (document.querySelector('.rotate')) return;
    const el = document.createElement('div');
    el.className = 'rotate';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="rotate-in">'
      + '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/>'
      + '<path d="M3 15a9 9 0 0 0 3 5"/><path d="M21 9a9 9 0 0 0-3-5"/></svg>'
      + '<p class="rotate-t">Întoarce telefonul</p>'
      + '<p class="rotate-s">Jocurile FRQ se joacă pe lung.</p></div>';
    document.body.appendChild(el);
  }

  // Instalarea: funcția exista de mult, dar nimeni nu avea de unde să știe.
  // Butonul apare doar dacă are rost, adică dacă browserul chiar poate instala
  // sau dacă ești pe iPhone, unde nu există prompt și trebuie arătați pașii.
  // Dacă jocul rulează deja instalat, butonul nu există deloc.
  function wireInstal() {
    const btn = document.querySelector('[data-install]');
    const panou = document.getElementById('install');
    if (!btn || !panou) return;
    const instalat = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (instalat()) return;

    // iPhone și iPad: nu există beforeinstallprompt, dar instalarea se poate face
    // de mână. iPad-urile noi se dau drept Mac, de unde și verificarea cu touch.
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent)
      || (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document);
    if (ios) { panou.classList.add('e-ios'); btn.hidden = false; }

    let cerere = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();          // vrem butonul nostru, nu bara browserului
      cerere = e;
      panou.classList.add('are-prompt');
      document.getElementById('inst-go').hidden = false;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => { btn.hidden = true; panou.hidden = true; });

    const arata = v => { panou.hidden = !v; };
    document.addEventListener('click', async e => {
      if (e.target.closest('[data-install]')) { arata(true); return; }
      if (e.target.closest('[data-install-close]') || e.target === panou) { arata(false); return; }
      if (e.target.closest('#inst-go') && cerere) {
        const c = cerere; cerere = null;
        document.getElementById('inst-go').hidden = true;
        arata(false);
        c.prompt();
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panou.hidden) arata(false); });
  }

  // ---------- partida salvată ----------
  // O partidă începută trebuie să supraviețuiască telefonului. iOS închide fără să
  // întrebe aplicațiile din fundal ca să elibereze memorie, deci cine ieșea o
  // clipă să răspundă la un mesaj se întorcea la o pagină goală. Fiecare joc își
  // scrie aici starea la fiecare pas încheiat, iar la întoarcere o reia de acolo.
  //
  // Două feluri de întoarcere. Dacă pagina s-a reîncărcat singură, fiindcă
  // telefonul a aruncat-o din memorie, partida se reia direct: erai în ea. Dacă
  // intri de pe meniu, e o vizită nouă: rămâi pe ecranul de start, dar cu
  // „Continuă partida" la vedere și „Joc nou" lângă, ca să alegi tu. Nu te mai
  // trezești în mijlocul unei runde de acum o oră, dar nici nu o pierzi.
  const PARTIDA_MAX = 2 * 3600e3;
  const reintrare = () => {
    if (document.wasDiscarded) return true;
    const n = performance.getEntriesByType('navigation')[0];
    return !!n && (n.type === 'reload' || n.type === 'back_forward');
  };
  function partida({ cheie, rezumat, reia }) {
    const k = `frq_partida_${cheie}`;
    const citeste = () => {
      const p = store.get(k, null);
      return p && p.stare && Date.now() - p.t < PARTIDA_MAX ? p.stare : null;
    };
    const btn = document.querySelector('[data-continua]');
    const start = btn && btn.closest('.start-actions').querySelector('[type="submit"]');
    const textStart = start ? start.textContent : '';
    function sincron() {
      if (!btn) return;
      const s = citeste();
      btn.hidden = !s;
      if (s) btn.querySelector('small').textContent = rezumat(s);
      if (start) {
        start.textContent = s ? 'Joc nou' : textStart;
        start.classList.toggle('btn-primary', !s);
        start.classList.toggle('btn-ghost', !!s);
      }
    }
    const api = {
      scrie(stare) { store.set(k, { t: Date.now(), stare }); },
      sterge() { try { localStorage.removeItem(k); } catch { /* fără stocare, nimic de șters */ } sincron(); },
    };
    if (btn) {
      btn.addEventListener('click', () => {
        const s = citeste();
        if (!s) { sincron(); return; }
        haptic();
        reia(s);
      });
      // Ecranul de start se pune la zi de fiecare dată când reapare.
      const ecran = btn.closest('.screen');
      if (ecran) {
        new MutationObserver(() => { if (ecran.classList.contains('is-active')) sincron(); })
          .observe(ecran, { attributes: true, attributeFilter: ['class'] });
      }
    }
    const s = citeste();
    if (s && reintrare()) setTimeout(() => reia(s), 0);
    else sincron();
    return api;
  }

  // ---------- partida salvată: sfârșit ----------

  // Întrebarea „Sigur?" desenată de noi, nu fereastra browserului. confirm()
  // pune adresa site-ului deasupra și butoanele sistemului, deci în aplicația
  // instalată se simte ca o pagină web scăpată pe ecran. Asta e un panou ca
  // toate celelalte: primește tastatura, iar butonul Înapoi al telefonului îl
  // închide spunând „nu". Butonul sigur, „Rămân", e primul, deci un Enter
  // grăbit te ține în joc, nu te scoate.
  let intrebare = null, raspuns = null;
  function construiesteIntrebarea() {
    if (intrebare) return;
    intrebare = document.createElement('div');
    intrebare.className = 'overlay';
    intrebare.id = 'frq-confirm';
    intrebare.hidden = true;
    intrebare.innerHTML = '<div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="frq-confirm-t">'
      + '<p class="eyebrow">Sigur?</p>'
      + '<p class="confirm-t" id="frq-confirm-t"></p>'
      + '<div class="modal-actions">'
      + '<button class="btn btn-primary" type="button" data-confirm="nu">Rămân</button>'
      + '<button class="btn btn-ghost" type="button" data-confirm="da">Ies</button>'
      + '</div></div>';
    document.body.appendChild(intrebare);
    const termina = v => {
      if (!raspuns) return;
      const r = raspuns; raspuns = null;
      intrebare.hidden = true;
      // răspunsul vine după ce fereastra și-a scos pasul din istoric (butonul Înapoi
      // al telefonului): altfel o navigare făcută imediat după era dusă înapoi
      setTimeout(() => istoricLinistit().then(() => r(v)), 0);
    };
    intrebare.addEventListener('click', e => {
      const b = e.target.closest('[data-confirm]');
      if (b) termina(b.dataset.confirm === 'da');
      else if (e.target === intrebare) termina(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !intrebare.hidden) termina(false); });
  }
  // Etichetele implicite sunt pentru ieșirea dintr-un joc; altă întrebare își dă
  // etichetele ei, de pildă { da: 'Șterge', nu: 'Anulează' }.
  // `titlu`: rândul mic de sus; `primar: 'da'` face din „da" butonul principal (pentru o
  // propunere, nu pentru o ieșire); `text` lung se scrie mărunt, nu cu majuscule mari.
  function intreaba(text, { da = 'Ies', nu = 'Rămân', titlu = 'Sigur?', primar = 'nu' } = {}) {
    construiesteIntrebarea();
    document.querySelectorAll('.indiciu').forEach(x => x.remove());   // bulele de ajutor nu stau peste întrebare
    if (raspuns) { const r = raspuns; raspuns = null; r(false); }   // una nouă o înlocuiește pe cea veche
    intrebare.querySelector('.eyebrow').textContent = I18n.t(titlu);
    const bDa = intrebare.querySelector('[data-confirm="da"]'), bNu = intrebare.querySelector('[data-confirm="nu"]');
    bDa.className = `btn ${primar === 'da' ? 'btn-primary' : 'btn-ghost'}`;
    bNu.className = `btn ${primar === 'da' ? 'btn-ghost' : 'btn-primary'}`;
    if (primar === 'da') bDa.parentNode.insertBefore(bDa, bNu); else bNu.parentNode.insertBefore(bNu, bDa);
    intrebare.querySelector('.confirm-modal').classList.toggle('is-propunere', primar === 'da');
    intrebare.querySelector('.confirm-t').textContent = text;
    intrebare.querySelector('[data-confirm="da"]').textContent = I18n.t(da);
    intrebare.querySelector('[data-confirm="nu"]').textContent = I18n.t(nu);
    intrebare.querySelector('[data-confirm="nu"]').hidden = !nu;   // fără „nu”, e doar o înștiințare
    intrebare.hidden = false;
    return new Promise(res => { raspuns = res; });
  }

  // Ecranul rămâne aprins cât ține partida. La un joc de petrecere se vorbește
  // mult între ture, iar telefonul se stingea exact când trebuia dat mai departe.
  // Browserul eliberează singur blocajul când aplicația trece în fundal, deci îl
  // cerem din nou la întoarcere. Unde nu există, ecranul se stinge ca înainte.
  let lacat = null, vreauAprins = false, cer = false;
  async function aprinde() {
    if (!('wakeLock' in navigator) || lacat || cer || !vreauAprins || document.visibilityState !== 'visible') return;
    cer = true;
    try {
      lacat = await navigator.wakeLock.request('screen');
      lacat.addEventListener('release', () => { lacat = null; });
    } catch { /* refuzat, de pildă cu bateria pe economie: nimic de făcut */ }
    cer = false;
    if (!vreauAprins && lacat) { lacat.release().catch(() => {}); lacat = null; }
  }
  function tineAprins(on) {
    vreauAprins = on;
    if (on) aprinde();
    else if (lacat) { lacat.release().catch(() => {}); lacat = null; }
  }
  document.addEventListener('visibilitychange', aprinde);

  // Butonul Înapoi al telefonului. Pentru browser, un joc e o singură pagină,
  // deci un gest de înapoi în mijlocul partidei te scotea de tot, iar în
  // aplicația instalată putea chiar s-o închidă. Ținem în istoric câte un pas
  // pentru fiecare strat deschis, partida și panoul de deasupra ei, iar Înapoi
  // închide stratul de sus exact cum ar face butonul lui din pagină: panoul se
  // închide, partida întreabă „Ieși?", iar la Cel mai bun samsar se dă un ecran
  // înapoi. Nimic nu se reconstruiește aici, se apasă butoanele care există deja,
  // deci fiecare joc își face singur curățenia, ca la o apăsare normală.
  // Pașii scoși din istoric care încă n-au ajuns (history.go e asincron).
  let deIgnorat = 0;
  const asteptLinistea = [];
  const istoricLinistit = () => new Promise(res => {
    if (!deIgnorat) { res(); return; }
    asteptLinistea.push(res);
    setTimeout(res, 600);   // dacă pasul nu mai vine
  });
  function wireInapoi() {
    const START = /^screen-(start|setup|echipe|col)$/;   // ecranele de pornire (și Garajul), nu un meci
    const ecrane = [...document.querySelectorAll('.screen')];
    const panouri = [...document.querySelectorAll('.overlay, .auc-drawer')];
    const inMeci = () => { const a = document.querySelector('.screen.is-active'); return !!a && !START.test(a.id); };
    const panouDeschis = () => panouri.find(p => !p.hidden);
    // un pas pentru locul de acum (dacă nu e meniul principal), unul pentru partidă și unul
    // pentru panoul de deasupra
    const dorit = () => (laRadacina() ? 0 : 1) + (inMeci() ? 1 : 0) + (panouDeschis() ? 1 : 0);
    let pusi = (history.state && history.state.frq) || 0;
    // pasul de jos e marcat, ca o navigare pe „#..." venită din afară (scrisă în adresă) să
    // nu fie luată drept Înapoi: pașii noștri au `frq` sau `frqBaza`, ai ei nu
    if (!pusi) try { history.replaceState({ ...(history.state || {}), frqBaza: 1 }, ''); } catch { /* */ }
    let urlDupa = null;   // după ce scoatem pași de-ai noștri, adresa rămâne cea de acum

    const potriveste = () => {
      const d = dorit();
      while (pusi < d) { history.pushState({ frq: pusi + 1 }, ''); pusi++; }
      if (pusi > d) { deIgnorat++; urlDupa = location.href; const n = pusi - d; pusi = d; history.go(-n); }
      tineAprins(inMeci());
    };

    const INCHIDE = '[data-confirm="nu"], [data-how-close], [data-install-close], [data-inchide], #s-help-close, #a-close, #btn-menu, #o-menu';
    const IESI = '#btn-quit, #g-quit, #a-quit, [data-back]';
    window.addEventListener('popstate', () => {
      if (deIgnorat) {
        deIgnorat--;
        if (urlDupa && location.href !== urlDupa) history.replaceState(history.state, '', urlDupa);
        if (!deIgnorat) setTimeout(() => asteptLinistea.splice(0).forEach(f => f()), 0);
        return;
      }
      const st = history.state;
      if (!st || (st.frq == null && !st.frqBaza)) {
        // nu e Înapoi, ci o schimbare de ecran din afară: pasul nou devine al nostru
        try { history.replaceState({ ...(st || {}), frq: pusi || undefined, frqBaza: pusi ? undefined : 1 }, ''); } catch { /* */ }
        urlSus = location.href;
        return;
      }
      if (pusi === 0) return;              // nu e pasul nostru: îl lăsăm browserului
      const venit = urlSus;                // locul de pe care ai apăsat Înapoi
      pusi--;
      const p = panouDeschis();
      if (p) { const t = p.querySelector(INCHIDE); if (t) t.click(); }
      else if (inMeci()) { const t = document.querySelector(`.screen.is-active :is(${IESI})`) || document.querySelector(IESI); if (t) t.click(); }
      else {
        // locul de pe care ai plecat: un ecran din pagină duce la meniul ei, pagina la părintele ei
        const h = new URL(venit).hash, tinta = h.length > 1 ? parinteEcran(h) : parintePagina();
        if (!tinta) { potriveste(); return; }
        if (tinta !== '#') { location.replace(tinta); return; }
        mergi('#');
      }
      potriveste();                        // pune la loc pașii pentru ce a rămas deschis
    });
    window.addEventListener('hashchange', () => setTimeout(potriveste, 0));

    const obs = new MutationObserver(potriveste);
    ecrane.forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    panouri.forEach(p => obs.observe(p, { attributes: true, attributeFilter: ['hidden'] }));
    potriveste();
  }

  // "Cum se joacă": regulile stau într-un panou, nu pe ecranul de pregătire, ca
  // acolo să rămână numai ce ai de făcut. Orice pagină care are #how îl primește.
  function wireHow() {
    const box = document.getElementById('how');
    if (!box) return;
    const arata = v => { box.hidden = !v; };
    document.addEventListener('click', e => {
      if (e.target.closest('[data-how]')) arata(true);
      else if (e.target.closest('[data-how-close]') || e.target === box) arata(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) arata(false); });
  }
  // Săgeata „←" din pagină duce unde ai fost înainte, dacă ai venit din FRQ (din
  // Prieteni într-un joc, din Startul la Cont...), altfel la „părintele" paginii (deschisă
  // dintr-o notificare, un link primit sau din aplicație). Fiecare pas din istoric își
  // ține originea în `history.state.frqDe`: 'pagina' (altă pagină FRQ), 'hash:<x>'
  // (ecranul #x din aceeași pagină) sau null (de nicăieri: duce la părinte).
  // ---------- jurnalul de erori ----------
  // O eroare din pagină pleacă la server (funcția `erori`), ca s-o vedem și noi înainte
  // să ne-o spună cineva. Cel mult 5 pe deschidere de pagină, aceeași o singură dată; nu
  // și cele din extensii sau din scripturile altora, nici lipsa de semnal. Pe calculatorul
  // de lucru (localhost) doar dacă e pornit anume (frq_erori_local), ca testele să nu umple jurnalul.
  (() => {
    const local = location.hostname === 'localhost';
    try { if (!/^https?:$/.test(location.protocol) || (local && !localStorage.getItem('frq_erori_local'))) return; } catch { return; }
    const vazute = new Set();
    let trimise = 0;
    const versiune = ((document.querySelector('script[src*="shared.js"]') || {}).src || '').replace(/.*[?&]v=(\d+).*/, '$1');
    function trimite(mesaj, sursa, stiva) {
      if (trimise >= 5 || !mesaj) return;
      const cheie = `${mesaj}|${sursa}`;
      if (vazute.has(cheie)) return;
      vazute.add(cheie);
      trimise++;
      let tok = null;
      try { const s = JSON.parse(localStorage.getItem('frq-auth') || 'null'); tok = s && s.access_token; } catch { /* fără cont */ }
      fetch('https://zndivyygyomkxyeuvytf.supabase.co/functions/v1/erori', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', apikey: 'sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ pagina: (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash, mesaj: String(mesaj).slice(0, 500), sursa, stiva: stiva ? String(stiva).slice(0, 2000) : null, versiune }),
      }).catch(() => {});
    }
    addEventListener('error', e => {
      if (!e.filename || !e.filename.startsWith(location.origin)) return;   // extensii, scripturi străine
      trimite(e.message, `${e.filename.split('/').pop().split('?')[0]}:${e.lineno}:${e.colno}`, e.error && e.error.stack);
    });
    addEventListener('unhandledrejection', e => {
      const r = e.reason, m = r && (r.message || String(r));
      if (!m || /Failed to fetch|NetworkError|Load failed|network|^timp$|^retea$|biblioteca|AbortError/i.test(m)) return;   // fără semnal: nu e o greșeală a noastră
      trimite(`promise: ${m}`, null, r && r.stack);
    });
  })();

  // ---------- Înapoi: mereu în același loc ----------
  // Fiecare pagină are un părinte fix, nu „pagina de dinainte" ca în browser: jocurile
  // online duc la lista Online, cele de pe un telefon la Local, Garajul la meniu.
  // Ecranele din interiorul unei pagini (#bot, #pachet, #lazi, #online...) duc la meniul
  // paginii. Trecerea de la o pagină la alta înlocuiește pagina în istoric (nu se adună
  // pași), iar butonul Înapoi al telefonului face același lucru ca săgeata din pagină;
  // din meniul principal iese din aplicație.
  const PAGINA = location.pathname.split('/').pop() || 'index.html';
  const LISTA = new URLSearchParams(location.search).has('online') ? 'index.html#online' : 'index.html#local';
  const PARINTI = {
    'index.html': null, 'colectie.html': 'index.html', 'confidentialitate.html': 'index.html#setari', 'termeni.html': 'index.html#setari',
    'carti.html': 'index.html#online',
    // camerele de la Duel de cărți (cu un prieten, ?joc=carti, sau cu un necunoscut, ?cauta)
    // vin din pagina jocului și se întorc acolo
    'camera.html': { carti: 'carti.html', geaman: 'geaman.html' }[new URLSearchParams(location.search).get('joc')] || 'index.html#online',
    'geaman.html': 'index.html#online',
    'drag.html': LISTA, 'sus-sau-jos.html': LISTA, 'ordine.html': LISTA,
    'draft.html': 'index.html#local', 'licitatie.html': 'index.html#local', 'turometru.html': 'index.html#local',
    'garaj.html': 'index.html#local', 'samsar.html': 'index.html#local',
  };
  const NUME_TINTA = { 'index.html': 'Acasă', 'index.html#online': 'Jocuri', 'index.html#local': 'Jocuri', 'index.html#setari': 'Setări', 'carti.html': 'Duel de cărți', 'geaman.html': 'Geamănul' };
  // ecranele din pagină care nu stau direct sub meniul ei: Setările, Prietenii și
  // Recordurile sunt în Profil
  const PARINTI_ECRAN = { 'index.html': { setari: '#profil', prieteni: '#profil', recorduri: '#profil' } };
  const parinteEcran = hash => (PARINTI_ECRAN[PAGINA] || {})[hash.slice(1)] || '#';
  const parintePagina = () => (PAGINA in PARINTI ? PARINTI[PAGINA] : 'index.html');
  const laRadacina = () => PAGINA === 'index.html' && location.hash.length <= 1;
  const parinteAcum = () => (location.hash.length > 1 ? parinteEcran(location.hash) : parintePagina());
  // Ecranele din pagină se schimbă fără navigare: adresa se rescrie pe loc (fără un pas
  // nou în istoric) și se anunță ca un hashchange. O navigare pe „#..." ar porni și un
  // popstate, pe care butonul Înapoi l-ar lua drept apăsare.
  let urlSus = location.href;   // unde ești acum (pentru Înapoi: de aici se pleacă)
  function mergi(url) {
    if (!url) return;
    if (!url.startsWith('#')) { location.replace(url); return; }
    const vechi = location.href;
    try { history.replaceState(history.state, '', url.length > 1 ? url : location.pathname + location.search); }
    catch { location.replace(url); return; }
    urlSus = location.href;
    if (location.href !== vechi) window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: vechi, newURL: location.href }));
  }
  // `parinte`: '#' (meniul paginii) sau o adresă; fără el, părintele locului de acum
  function inapoi(parinte) { mergi(parinte || parinteAcum()); }

  // Se rezolvă după cel puțin `min` ms, la primele două cadre la rând desenate la timp
  // (sub 34 ms). Banda lăzii pornește abia atunci: prima desenare a ferestrei ei ține
  // 100-200 ms pe telefon, iar o animație pornită înainte sare dintr-odată în timpul ăsta.
  // (performance.now, nu timpul primit de requestAnimationFrame: acela e momentul planificat
  // al cadrului, și un cadru întârziat pare la timp)
  const cadruLinistit = (min = 0) => new Promise(gata => {
    const t0 = performance.now();
    let prev = 0, bune = 0, n = 0;
    const f = () => {
      const now = performance.now();
      bune = prev && now - prev < 34 ? bune + 1 : 0;
      if ((bune >= 2 && now - t0 >= min) || ++n > 40) return gata();
      prev = now; requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  window.addEventListener('hashchange', () => { urlSus = location.href; eticheteInapoi(); });
  const deUnde = () => null;
  // Înapoi arată la fel peste tot: o săgeată și numele locului în care ajungi
  const SAGEATA = '<svg class="inapoi-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  function cuSageata(el, text) {
    const t = String(text).replace(/^\s*←\s*/, '');
    el.innerHTML = `${SAGEATA}<span>${esc(window.I18n ? I18n.t(t) : t)}</span>`;
  }
  // săgeata de sus a fiecărei pagini: spre părintele ei, cu numele lui
  // Într-un pas din joc (#bot, #pachet...), săgeata de sus duce la meniul jocului, ca să
  // nu fie două „înapoi" pe ecran; din meniul jocului, la părintele paginii.
  function eticheteInapoi() {
    const p = parintePagina(), inPas = location.hash.length > 1 && PAGINA !== 'index.html' && PAGINA !== 'colectie.html';
    document.body.classList.toggle('in-pas', inPas);
    if (p) {
      const t = inPas ? numeJoc() : NUME_TINTA[p] || 'Înapoi';
      document.querySelectorAll('.brand-bar a.back-btn[href]').forEach(a => { a.setAttribute('href', inPas ? '#' : p); cuSageata(a, t); });
    }
    // și săgețile din pagină (spre meniul paginii)
    document.querySelectorAll('.mj-inapoi, .mp-inapoi, .brand-bar .back-btn:not([href])').forEach(b => { if (!b.querySelector('.inapoi-s')) cuSageata(b, b.textContent); });
  }

  // ---------- bara de jos ----------
  // Patru locuri, mereu aceleași: Acasă, Jocuri, Garaj, Profil. Stă pe meniuri, nu în
  // partide (acolo ecranul e al jocului). Locul de acum e cel aprins.
  const TABURI = [
    ['acasa', 'Acasă', () => 'index.html', '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'],
    ['jocuri', 'Jocuri', () => `index.html#${store.get('frq_tip', 'online') === 'local' ? 'local' : 'online'}`, '<rect x="2.5" y="7" width="19" height="11" rx="3"/><path d="M7 10.5v4M5 12.5h4"/><path d="M15.5 11h.01M17.5 14h.01"/>'],
    ['garaj', 'Garaj', () => 'colectie.html', '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-6h10v6M7 17h10"/>'],
    ['profil', 'Profil', () => 'index.html#profil', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'],
  ];
  const CU_BARA = ['index.html', 'colectie.html', 'carti.html', 'drag.html', 'sus-sau-jos.html', 'ordine.html', 'geaman.html', 'licitatie.html', 'draft.html', 'turometru.html', 'garaj.html'];
  function tabActiv() {
    const h = location.hash.slice(1);
    if (PAGINA === 'colectie.html') return 'garaj';
    if (PAGINA === 'index.html') return ['online', 'local'].includes(h) ? 'jocuri' : ['profil', 'setari', 'prieteni', 'recorduri'].includes(h) ? 'profil' : 'acasa';
    return 'jocuri';
  }
  function wireTabbar() {
    if (!CU_BARA.includes(PAGINA)) return;
    const nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', 'FRQ');
    nav.innerHTML = TABURI.map(([k, n, , d]) => `<a data-tab="${k}" href="#"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg><span>${esc(window.I18n ? I18n.t(n) : n)}</span></a>`).join('');
    document.body.appendChild(nav);
    // adresa se socotește la apăsare (Jocuri ține minte Online sau Local)
    nav.addEventListener('click', e => {
      const a = e.target.closest('[data-tab]');
      if (a) a.href = TABURI.find(t => t[0] === a.dataset.tab)[2]();
    }, true);
    const START = /^screen-(start|setup|echipe|col)$/;
    const potriveste = () => {
      const activ = document.querySelector('.screen.is-active');
      const vizibila = !activ || START.test(activ.id);
      nav.hidden = !vizibila;
      document.body.classList.toggle('are-tabbar', vizibila);
      const t = tabActiv();
      nav.querySelectorAll('[data-tab]').forEach(a => {
        a.classList.toggle('is-on', a.dataset.tab === t);
        if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    };
    window.addEventListener('hashchange', () => setTimeout(potriveste, 0));
    const obs = new MutationObserver(potriveste);
    document.querySelectorAll('.screen').forEach(s => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    potriveste();
  }
  // Legăturile din aplicație înlocuiesc pagina (sau ecranul din pagină) în loc să adauge
  // un pas în istoric, ca Înapoi să nu ducă la ce ai vizitat înainte.
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    if (/^(mailto:|tel:|javascript:)/i.test(a.getAttribute('href'))) return;
    let u;
    try { u = new URL(a.href, location.href); } catch { return; }
    if (u.origin !== location.origin) return;
    e.preventDefault();
    if (u.pathname === location.pathname && u.search === location.search) mergi(u.hash || '#');
    else location.replace(u.href);
  });

  // Ecranele scurte: regulile CSS „(max-height: 800px)" și „(max-height: 700px)" se
  // uită la înălțimea ferestrei, dar pe un iPhone cu decupaj (aplicația instalată)
  // decupajul de sus și bara de gesturi mănâncă ~80 px din ea. Măsurăm cât rămâne
  // de fapt și, dacă e sub prag, pornim aceleași reguli și aici.
  let stilScurt = null;
  function ecranUtil() {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--sa-sus);padding-bottom:var(--sa-jos)';
    document.body.appendChild(p);
    const cs = getComputedStyle(p), util = innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    p.remove();
    let css = '';
    const reguli = [];
    for (const sh of document.styleSheets) { try { reguli.push(...sh.cssRules); } catch { /* foaie străină */ } }
    for (const r of reguli) {
      if (!(r instanceof CSSMediaRule)) continue;
      const m = /max-height:\s*(\d+)px/.exec(r.conditionText || r.media.mediaText);
      if (!m || ![700, 800].includes(+m[1]) || matchMedia(r.media.mediaText).matches) continue;
      if (util > +m[1]) continue;
      if (/max-width:\s*759px/.test(r.media.mediaText) && innerWidth > 759) continue;
      css += [...r.cssRules].map(x => x.cssText).join(' ');
    }
    if (!stilScurt) { stilScurt = document.createElement('style'); stilScurt.id = 'frq-ecran-util'; document.head.appendChild(stilScurt); }
    if (stilScurt.textContent !== css) stilScurt.textContent = css;
  }
  // paginile care își desenează opțiunile din script stau ascunse până atunci (fără salt)
  const gata = () => { document.body.classList.remove('se-incarca'); ecranUtil(); addEventListener('resize', ecranUtil); construiesteIntrebarea(); wireHow(); wireInstal(); wireRotate(); wirePanouri(); wireInapoi(); eticheteInapoi(); wireTabbar(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gata);
  else gata();

  // Installable and playable offline: the service worker caches the game files.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* fine without it */ }));

    // Un deploy proaspat poate prinde pagina cu HTML nou si cod vechi: scripturile
    // vin din cache-ul versiunii trecute pana cand preia service worker-ul nou.
    // Cand preia, reincarcam o data. Dar numai daca nu esti in mijlocul unei
    // partide: o reincarcare in timpul jocului ar sterge scorul tuturor, iar
    // oricum urmatoarea deschidere porneste curata.
    const eraControlata = !!navigator.serviceWorker.controller;
    const START = /^screen-(start|setup|echipe|col)$/;   // ecranele de pornire (și Garajul), nu un meci
    const inMeci = () => {
      const activ = document.querySelector('.screen.is-active');
      return !!activ && !START.test(activ.id);
    };
    let reincarcat = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!eraControlata || reincarcat || inMeci()) return;
      reincarcat = true;
      location.reload();
    });
  }

  // Rândurile unui meniu de joc: mari, pe toată lățimea, fiecare duce undeva.
  // [{ id, titlu, sub, primar, poza, dezactivat }] -> HTML; clicul îl prinde pagina (data-mj).
  const randuriMeniu = randuri => randuri.map(r => `<button type="button" class="mj-r${r.primar ? ' is-primar' : ''}" data-mj="${esc(r.id)}"${r.dezactivat ? ' disabled' : ''}>
      ${r.poza ? `<span class="mj-f">${r.poza}</span>` : r.icon ? `<span class="mj-i">${icon(r.icon)}</span>` : ''}
      <span class="mj-t"><b>${esc(r.titlu)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
      ${r.insigna ? `<i class="hub-ins">${esc(r.insigna)}</i>` : ''}<i class="mj-s" aria-hidden="true">&rsaquo;</i>
    </button>`).join('');

  // Meniul unui joc ca ecran de joc, nu ca listă: sus, mic, ce e mereu la îndemână
  // (`bara`); apoi lucrul principal, mare, cu poză și un singur buton (`erou`); apoi
  // celelalte moduri ca dale cu poză (`dale`). Toate au `data-mj`, ca rândurile.
  // Pozele de pe Wikimedia vin în trei mărimi; telefonul o ia pe cea potrivită locului
  // (o dală pe jumătate de ecran nu are nevoie de poza de 960px, de trei ori mai grea).
  // La dale mărimea e spusă mai mică decât e (34vw, nu 50vw): pe ecranele dese iese
  // 500px în loc de 960px, iar sub degradeul dalei diferența nu se vede.
  // Dalele de jos se încarcă abia când ajungi la ele; poza mare, înaintea lor.
  const LATIMI = [330, 500, 960];
  const MARIME_LAT = '(min-width: 760px) 680px, 100vw', MARIME_DALA = '(min-width: 760px) 340px, 34vw';
  function marimi(html, sizes, lenes) {
    return String(html || '').replace(/<img class="art-photo" src="(https:\/\/thumb\.wikimedia\.org\/[^"]*?\/)\d+px-([^"]+)"/, (_, a, b) =>
      `<img class="art-photo" src="${a}500px-${b}" srcset="${LATIMI.map(w => `${a}${w}px-${b} ${w}w`).join(', ')}" sizes="${sizes}"${lenes ? ' loading="lazy"' : ' fetchpriority="high"'}`);
  }
  const lacatHub = '<svg class="hub-lacat" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z" fill="currentColor"/></svg>';
  // Iconițele rândurilor, după ce face rândul (același fel de linie ca în bara de jos)
  const ICON = {
    bot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9.5 13h.01M14.5 13h.01M9.5 16h5"/>',
    cat: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    ceas: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 3h4"/>',
    cls: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20h8"/>',
    cum: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4M12 17h.01"/>',
    prieten: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.6c2.6.1 4.6 1.8 5.5 4.9"/>',
    online: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    pachet: '<rect x="4" y="6" width="11" height="15" rx="1.5"/><path d="M9 3h9.5A1.5 1.5 0 0 1 20 4.5V18"/>',
    zi: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    bani: '<path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1z"/><path d="M4 7l11-3v3M16 13h2"/>',
    ale: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    rapid: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    cod: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    garaj: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-6h10v6M7 17h10"/>',
    echipa: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>',
    misiuni: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
    lada: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3-5-3.2-5-1.2S12 7 12 7s5-.8 5-1.2S13.5 4 12 7"/>',
    recorduri: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z"/>',
    setari: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    cont: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/>',
    colectie: '<path d="M5 17h14l-1.5-5.5A2 2 0 0 0 15.6 10H8.4a2 2 0 0 0-1.9 1.5z"/><circle cx="8" cy="17.5" r="1.8"/><circle cx="16" cy="17.5" r="1.8"/>',
    seturi: '<path d="M9 4h6v4a3 3 0 1 1 0 2v4h-4a3 3 0 1 0-2 0H5V8h4a3 3 0 1 0 0-2z"/>',
    invita: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c1-3.6 3.6-5.5 6.5-5.5 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6"/>',
  };
  Object.assign(ICON, { ai: ICON.bot, timp: ICON.ceas, cupa: ICON.cls, prieteni: ICON.prieten, duo: ICON.prieten, live: ICON.prieten, continua: '<path d="M8 5v14l11-7z"/>', antr: ICON.ceas, lazi: ICON.lada, bani: ICON.bani });
  const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || '<circle cx="12" cy="12" r="3"/>'}</svg>`;
  // numele jocului din titlul paginii („Duel de cărți: pachetul tău... | FRQ")
  const numeJoc = () => document.title.split(/[:|]/)[0].trim();
  // Meniul unui joc: sus poza jocului cu numele lui și Joacă (`erou`), dedesubt
  // setările ca rânduri (`bara`: Botul · Ușor) și celelalte moduri ca rânduri cu o
  // poză mică (`dale`). Toate au `data-mj`, ca înainte.
  const rand = (r, poza) => `<button type="button" class="hub-r${r.accent ? ' is-accent' : ''}" data-mj="${esc(r.id)}"${r.dezactivat ? ' disabled' : ''}>
      <span class="hub-r-i">${poza ? marimi(poza, '64px', true) : icon(r.id)}</span>
      <span class="hub-r-t"><b>${r.dezactivat ? lacatHub : ''}${esc(r.titlu)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
      ${r.val != null ? `<span class="hub-r-v">${esc(r.val)}</span>` : ''}${r.insigna ? `<i class="hub-ins">${esc(r.insigna)}</i>` : ''}
      <svg class="hub-r-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </button>`;
  const hub = ({ bara = [], erou = null, dale = [] }) => {
    const nume = numeJoc();
    const sub = erou && [erou.titlu !== nume ? erou.titlu : '', erou.sub].filter(Boolean).join(' · ');
    return `
    ${erou ? `<button type="button" class="hub-erou" data-mj="${esc(erou.id)}">
      <span class="hub-foto">${marimi(erou.poza, MARIME_LAT)}</span>
      <span class="hub-erou-t">${erou.eticheta ? `<small>${esc(erou.eticheta)}</small>` : ''}<b>${esc(nume || erou.titlu)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>
      <span class="hub-go">${esc(erou.buton || 'Joacă')}</span>
    </button>` : ''}
    ${bara.length ? `<div class="hub-grup">${bara.map(b => rand(b)).join('')}</div>` : ''}
    ${dale.length ? `<div class="hub-grup">${dale.map(d => rand(d, d.poza)).join('')}</div>` : ''}`;
  };

  // O poză mare de mașină pentru o dală, aleasă după `cheie` și zi (alta în fiecare zi).
  function pozaDin(cheie) {
    const L = (window.CARS || []).filter(c => c.image);
    if (!L.length) return '';
    const c = L[hashStr(`${cheie}-${new Date().toISOString().slice(0, 10)}`) % L.length];
    return thumbHTML({ ...c, image: String(c.image).replace(/\/\d+px-/, '/960px-') });
  }
  // Pune meniul-hub în `el` (și pagina pe lat, cât se vede meniul).
  function monteazaHub(el, date) {
    el.classList.add('hub');
    document.body.classList.add('are-hub');
    el.innerHTML = hub(date);
    wirePhotos(el);
    const st = el.closest('.start');
    if (st) requestAnimationFrame(() => st.classList.toggle('is-hub-larg', !!el.offsetParent));
  }

  // Un indiciu scurt pentru cine joacă prima dată: o bulă deasupra unui element, de
  // cel mult `ori` ori pe joc (de două ori, ca omul să facă gestul de două ori), care
  // dispare la prima atingere sau după câteva secunde. Fără ecrane de tutorial.
  function indiciu(tinta, text, cheie, ori = 2) {
    if (!tinta || !tinta.getClientRects().length) return;
    if (intrebare && !intrebare.hidden) return;   // nu peste o întrebare deschisă
    const k = `frq_ind_${cheie}`, n = store.get(k, 0);
    if (n >= ori) return;
    store.set(k, n + 1);
    document.querySelectorAll('.indiciu').forEach(x => x.remove());
    const b = document.createElement('div');
    b.className = 'indiciu';
    b.setAttribute('role', 'status');
    b.textContent = window.I18n ? I18n.t(text) : text;
    document.body.appendChild(b);
    const r = tinta.getBoundingClientRect();
    const sus = r.top - b.offsetHeight - 12;
    b.style.left = `${Math.max(12, Math.min(innerWidth - b.offsetWidth - 12, r.left + r.width / 2 - b.offsetWidth / 2))}px`;
    b.style.top = `${sus > 8 ? sus : r.bottom + 12}px`;
    b.classList.toggle('is-jos', sus <= 8);
    b.style.setProperty('--x', `${Math.round(r.left + r.width / 2 - parseFloat(b.style.left))}px`);
    // dispare la prima atingere sau tastă (pe calculator jocurile merg și din tastatură)
    const gata = () => { b.remove(); document.removeEventListener('pointerdown', gata, true); document.removeEventListener('keydown', gata, true); };
    setTimeout(() => { document.addEventListener('pointerdown', gata, true); document.addEventListener('keydown', gata, true); }, 60);
    setTimeout(gata, 7000);
  }

  // „Bate-mi scorul": pe telefon, fereastra de distribuire a sistemului (WhatsApp,
  // mesaje); altfel textul cu link merge în clipboard și butonul scrie „Copiat".
  async function bateMa(buton, text, url) {
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      if (buton) buton.textContent = window.I18n ? I18n.t('Copiat') : 'Copiat';
    } catch { if (buton) buton.textContent = url; }
  }

  // Cât vine ceva de pe server: rânduri gri care pulsează, în forma listei care urmează
  const schelet = (n = 4, cls = '') => `<div class="schelet ${cls}" aria-label="Se încarcă" role="status">${Array.from({ length: n }, () => '<i></i>').join('')}</div>`;

  return { store, mulberry32, hashStr, fmt, brandOf, modelOf, esc, artHTML, thumbHTML, wirePhotos, intreaba, partida, reintrare, preload, haptic, shuffle, makeTimer, randuriMeniu, hub, pozaDin, monteazaHub, indiciu, schelet, bateMa, inapoi, deUnde, parinteAcum, mergi, cadruLinistit, cuSageata, icon };
})();
