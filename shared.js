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
      ? `<img class="art-photo" src="${esc(car.image)}" alt="${esc(car.name)}" decoding="async" referrerpolicy="no-referrer">` : '';
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
        <img class="art-photo" src="${esc(car.image)}" alt="" decoding="async" referrerpolicy="no-referrer">
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
    if (car && car.image) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.src = car.image; }
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
        const tinta = new URL(venit).hash.length > 1 ? '#' : parintePagina();
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
    'index.html': null, 'colectie.html': 'index.html', 'confidentialitate.html': 'index.html#setari',
    'carti.html': 'index.html#online', 'camera.html': 'index.html#online',
    'drag.html': LISTA, 'sus-sau-jos.html': LISTA, 'ordine.html': LISTA,
    'draft.html': 'index.html#local', 'licitatie.html': 'index.html#local', 'turometru.html': 'index.html#local',
    'garaj.html': 'index.html#local', 'samsar.html': 'index.html#local',
  };
  const NUME_TINTA = { 'index.html': 'Meniu', 'index.html#online': 'Online', 'index.html#local': 'Local', 'index.html#setari': 'Setări' };
  const parintePagina = () => (PAGINA in PARINTI ? PARINTI[PAGINA] : 'index.html');
  const laRadacina = () => PAGINA === 'index.html' && location.hash.length <= 1;
  const parinteAcum = () => (location.hash.length > 1 ? '#' : parintePagina());
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
  window.addEventListener('hashchange', () => { urlSus = location.href; });
  const deUnde = () => null;
  // săgeata de sus a fiecărei pagini: spre părintele ei, cu numele lui
  function eticheteInapoi() {
    const p = parintePagina();
    if (!p) return;
    const t = NUME_TINTA[p] || 'Înapoi';
    document.querySelectorAll('a.back-btn[href]').forEach(a => {
      a.setAttribute('href', p);
      a.textContent = `← ${window.I18n ? I18n.t(t) : t}`;
    });
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
  const gata = () => { document.body.classList.remove('se-incarca'); ecranUtil(); addEventListener('resize', ecranUtil); construiesteIntrebarea(); wireHow(); wireInstal(); wireRotate(); wirePanouri(); wireInapoi(); eticheteInapoi(); };
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
      ${r.poza ? `<span class="mj-f">${r.poza}</span>` : ''}
      <span class="mj-t"><b>${esc(r.titlu)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
      <i class="mj-s" aria-hidden="true">&rsaquo;</i>
    </button>`).join('');

  // Meniul unui joc ca ecran de joc, nu ca listă: sus, mic, ce e mereu la îndemână
  // (`bara`); apoi lucrul principal, mare, cu poză și un singur buton (`erou`); apoi
  // celelalte moduri ca dale cu poză (`dale`). Toate au `data-mj`, ca rândurile.
  const lacatHub = '<svg class="hub-lacat" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z" fill="currentColor"/></svg>';
  const hub = ({ bara = [], erou = null, dale = [] }) => `
    ${bara.length ? `<div class="hub-bara">${bara.map(b => `<button type="button" class="hub-b" data-mj="${esc(b.id)}"${b.dezactivat ? ' disabled' : ''}>
      <b>${esc(b.titlu)}</b>${b.val != null ? `<small>${esc(b.val)}</small>` : ''}${b.insigna ? `<i class="hub-ins">${esc(b.insigna)}</i>` : ''}</button>`).join('')}</div>` : ''}
    ${erou ? `<button type="button" class="hub-erou" data-mj="${esc(erou.id)}">
      <span class="hub-foto">${erou.poza || ''}</span>
      <span class="hub-erou-t">${erou.eticheta ? `<small>${esc(erou.eticheta)}</small>` : ''}<b>${esc(erou.titlu)}</b>${erou.sub ? `<span>${esc(erou.sub)}</span>` : ''}</span>
      <span class="hub-go">${esc(erou.buton || 'Joacă')}</span>
    </button>` : ''}
    ${dale.length ? `<div class="hub-dale">${dale.map(d => `<button type="button" class="hub-d${d.lat ? ' is-lat' : ''}${d.accent ? ' is-accent' : ''}" data-mj="${esc(d.id)}"${d.dezactivat ? ' disabled' : ''}>
      <span class="hub-foto">${d.poza || ''}</span>${d.insigna ? `<i class="hub-ins">${esc(d.insigna)}</i>` : ''}
      <span class="hub-d-t">${d.dezactivat ? lacatHub : ''}<b>${esc(d.titlu)}</b>${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</span>
    </button>`).join('')}</div>` : ''}`;

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

  return { store, mulberry32, hashStr, fmt, brandOf, modelOf, esc, artHTML, thumbHTML, wirePhotos, intreaba, partida, reintrare, preload, haptic, shuffle, makeTimer, randuriMeniu, hub, pozaDin, monteazaHub, indiciu, schelet, bateMa, inapoi, deUnde, parinteAcum, mergi };
})();
