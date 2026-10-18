// Legătura jocurilor FRQ cu serverul (Supabase): cont anonim, trimiterea partidelor
// zilei și clasamentele. Biblioteca Supabase se încarcă doar când e nevoie de ea
// (după prima partidă a zilei), iar contul anonim se face tot atunci: cine doar intră
// pe pagină nu primește cont. Cheia de aici e cea publică; ce poate citi sau scrie
// fiecare hotărăsc regulile din baza de date, iar scorurile le scriu doar funcțiile
// de pe server, după ce refac partida din răspunsuri.
window.FrqCloud = (() => {
  'use strict';

  const URL_SUPABASE = 'https://zndivyygyomkxyeuvytf.supabase.co';
  const CHEIE = 'sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm';
  const CHEIE_SESIUNE = 'frq-auth';
  const CHEIE_NUME = 'frq_nume';
  // versiune fixă, cu amprentă: dacă fișierul de pe CDN s-ar schimba, nu se încarcă
  const LIB = {
    src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
    integrity: 'sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R',
  };

  // Linkul din mail se întoarce cu ?code=... (PKCE). Pe telefonul de pe care s-a cerut,
  // biblioteca îl schimbă singură pe sesiune. Deschis în alt loc (pe iPhone, aplicația
  // de pe ecranul principal și Safari nu-și văd datele), codul nu merge aici: îl scoatem
  // din adresă și îl arătăm, ca să fie pus în aplicație (Contul).
  //
  // Mai mult: aplicația care a cerut linkul a pus în el `conectare=ID`. Codul pleacă
  // atunci la server (funcția `conectare`), iar aplicația îl ia de acolo singură, cu o
  // cheie pe care o știe doar ea: nimic de copiat. Codul nu folosește fără verificatorul
  // PKCE, care stă doar în aplicație.
  const URL_CONECTARE = `${URL_SUPABASE}/functions/v1/conectare`;
  const conectare = corp => fetch(URL_CONECTARE, { method: 'POST', headers: { 'content-type': 'application/json', apikey: CHEIE }, body: JSON.stringify(corp) })
    .then(r => r.json());
  let codLink = null, linkTrimis = null;
  try {
    const q = new URLSearchParams(location.search), k = q.get('code'), id = q.get('conectare');
    if (k && !localStorage.getItem(CHEIE_SESIUNE + '-code-verifier')) {
      codLink = k;
      if (id && /^[0-9a-f-]{36}$/i.test(id)) linkTrimis = conectare({ actiune: 'aproba', id, cod: k }).then(r => !!r.ok).catch(() => false);
      q.delete('code');
      q.delete('conectare');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    } else if (k) {
      // același browser care a cerut linkul: biblioteca te conectează direct, deci
      // nu mai e nimic de așteptat de la server
      localStorage.removeItem('frq_conectare');
    }
  } catch { /* fără stocare */ }
  const codDinLink = () => codLink;
  // true dacă aplicația care a cerut linkul primește codul singură
  const linkTrimisAplicatiei = () => linkTrimis || Promise.resolve(false);

  // Aplicația, după ce a cerut mailul: așteaptă codul de la server și se conectează.
  const CONECTARE = 'frq_conectare';
  const conectareAsteptata = () => { try { const v = JSON.parse(localStorage.getItem(CONECTARE) || 'null'); return v && Date.now() - v.la < 30 * 60e3 ? v : null; } catch { return null; } };
  let ceasConectare = 0;
  async function verificaConectarea() {
    const v = conectareAsteptata();
    if (!v || document.hidden) return;
    let r;
    try { r = await conectare({ actiune: 'stare', id: v.id, secret: v.secret }); } catch { return; }
    if (r.eroare) { try { localStorage.removeItem(CONECTARE); } catch { /* */ } return; }
    if (!r.cod) return;
    try { localStorage.removeItem(CONECTARE); } catch { /* */ }
    const c = await incarca();
    const { error } = await c.auth.exchangeCodeForSession(r.cod);
    if (error) return;
    asteaptaCod(null);
    marcheazaIesit(false);
    location.reload();
  }
  function pornesteConectarea() {
    clearInterval(ceasConectare);
    if (!conectareAsteptata()) return;
    ceasConectare = setInterval(() => { if (!conectareAsteptata()) clearInterval(ceasConectare); else verificaConectarea(); }, 2500);
    verificaConectarea();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && conectareAsteptata()) verificaConectarea(); });
  // o cerere de dinainte (aplicația închisă și redeschisă după ce s-a apăsat linkul)
  setTimeout(pornesteConectarea, 0);
  // înainte de mail: o cerere nouă, al cărei id merge în link
  async function cerereConectare() {
    try {
      const r = await conectare({ actiune: 'cere' });
      if (!r.id) return null;
      localStorage.setItem(CONECTARE, JSON.stringify({ id: r.id, secret: r.secret, la: Date.now() }));
      return r.id;
    } catch { return null; }
  }

  // Linkul unui prieten (?inv=frincu, ID-ul lui, sau codul vechi): se ține pe telefon
  // până îl vede serverul. E și invitație cu bonus (la prima stare a portofelului, doar
  // pe un cont nou) și cerere de prietenie (pagina îl întreabă pe cel care a intrat).
  const INVITAT = 'frq_invitat', PRIETEN_LINK = 'frq_prieten_link';
  try {
    const q = new URLSearchParams(location.search), k = q.get('inv');
    if (k && /^@?[a-z0-9_.]{3,16}$/i.test(k)) {
      localStorage.setItem(INVITAT, k);
      localStorage.setItem(PRIETEN_LINK, JSON.stringify({ cod: k, la: Date.now() }));
      q.delete('inv');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch { /* fără stocare */ }
  const invitatAstept = () => { try { return localStorage.getItem(INVITAT); } catch { return null; } };
  // prietenul din link, încă neadăugat (o lună, apoi se uită)
  const prietenDinLink = () => { try { const v = JSON.parse(localStorage.getItem(PRIETEN_LINK) || 'null'); return v && Date.now() - v.la < 30 * 864e5 ? v : null; } catch { return null; } };
  const tinePrietenDinLink = v => { try { if (v) localStorage.setItem(PRIETEN_LINK, JSON.stringify(v)); else localStorage.removeItem(PRIETEN_LINK); } catch { /* */ } };

  let client = null, incarcare = null;
  function incarca() {
    if (client) return Promise.resolve(client);
    if (incarcare) return incarcare;
    incarcare = new Promise((gata, nu) => {
      const s = document.createElement('script');
      s.src = LIB.src;
      s.integrity = LIB.integrity;
      s.crossOrigin = 'anonymous';
      s.onload = () => {
        client = window.supabase.createClient(URL_SUPABASE, CHEIE, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: CHEIE_SESIUNE, flowType: 'pkce' },
        });
        gata(client);
      };
      s.onerror = () => { incarcare = null; nu(new Error('biblioteca')); };
      document.head.appendChild(s);
    });
    return incarcare;
  }

  // Cu un cont pe telefon, biblioteca pornește de cum se încarcă pagina: altfel
  // prima cerere a paginii o aștepta întâi pe ea și abia apoi pleca.
  try { if (localStorage.getItem(CHEIE_SESIUNE)) setTimeout(() => incarca().catch(() => {}), 0); } catch { /* fără stocare */ }

  // Are deja cont pe telefonul ăsta? (fără să încarce nimic)
  function areCont() {
    try { return !!localStorage.getItem(CHEIE_SESIUNE); } catch { return false; }
  }

  async function cont() {
    const c = await incarca();
    const { data } = await c.auth.getSession();
    if (data.session) return c;
    const r = await c.auth.signInAnonymously();
    if (r.error) throw r.error;
    // venit dintr-o invitație: codul pleacă la server imediat ce există contul
    if (invitatAstept()) setTimeout(() => portofel().catch(() => {}), 0);
    return c;
  }

  // Cu semnal slab, o cerere poate să nu se mai întoarcă: după 20 s o dăm drept
  // pierdută, ca ecranul să arate o eroare în loc să aștepte la nesfârșit. (Lada își
  // verifică singură dacă s-a deschis totuși, din garaj.)
  const TIMP_CERERE = 20000;
  async function invoca(functie, corp) {
    const c = await cont();
    let ceas;
    const r = await Promise.race([
      c.functions.invoke(functie, { body: corp }),
      new Promise((_, nu) => { ceas = setTimeout(() => nu(new Error('timp')), TIMP_CERERE); }),
    ]).finally(() => clearTimeout(ceas));
    if (r.error) throw r.error;
    return r.data;
  }

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // Numele din clasamente, același în toate jocurile (pe telefon).
  const numeLocal = () => { try { return localStorage.getItem(CHEIE_NUME) || ''; } catch { return ''; } };
  const seteazaNume = n => {
    const v = String(n || '').trim().slice(0, 16);
    try { localStorage.setItem(CHEIE_NUME, v); } catch { /* fără stocare */ }
    if (v) document.querySelectorAll('[data-nume-eu]').forEach(x => { x.textContent = v; });
  };

  // Startul: { data, apasari, tur, nume } -> { timp, record, nume, cel_mai_bun }
  const trimiteZi = cursa => invoca('trimite-zi', cursa);
  // Celelalte jocuri: { joc, data, raspunsuri, timp_ms, nume } -> { scor, timp, record, nume }
  const trimiteScor = partida => invoca('trimite-scor', partida);

  // Startul -> { total, top: [{ loc, nume, timp, eu }], eu: { loc, timp } | null }
  async function clasament(data, limita = 10) {
    const c = await incarca();
    const { data: r, error } = await c.rpc('clasament_zi', { p_data: data, p_limita: limita });
    if (error) throw error;
    return r;
  }
  // Celelalte jocuri -> { total, top: [{ loc, nume, scor, timp, eu }], eu: { loc, scor, timp } | null }
  async function clasamentJoc(joc, data, limita = 10) {
    const c = await incarca();
    const { data: r, error } = await c.rpc('clasament_joc', { p_joc: joc, p_data: data, p_limita: limita });
    if (error) throw error;
    return r;
  }

  // Garajul meu: { portofel: { mil, lazi_gratis, serie, ... }, garaj: [{ masina, raritate, nivel, bucati }] }
  // Mai multe părți ale paginii îl cer deodată: pleacă o singură cerere.
  let portofelInZbor = null;
  function portofel() {
    if (!portofelInZbor) portofelInZbor = portofelDeLaServer().finally(() => { portofelInZbor = null; });
    return portofelInZbor;
  }
  async function portofelDeLaServer() {
    const invitat = invitatAstept();
    const r = await invoca('portofel', { actiune: 'stare', nume: numeLocal(), ...(invitat ? { invitat } : {}) });
    // răspunsul la cod e definitiv (primit sau refuzat): nu-l mai trimitem
    if (invitat && r && r.invitatie) { try { localStorage.removeItem(INVITAT); } catch { /* fără stocare */ } }
    if (r && r.nume) potrivesteNume(r.nume);
    if (r) { anuntaMisiuni(r.misiuni); salveazaPortofel(r); }
    return r;
  }
  // Ultimul portofel primit, ținut pe telefon: paginile îl arată pe loc și îl
  // înlocuiesc când vine cel nou (cererea durează cam o secundă). Doar al contului de
  // acum; ce ține de ziua de azi (provocări, misiuni) doar dacă e tot din ziua asta.
  const PORTOFEL_SALVAT = 'frq_portofel';
  const idCont = () => { try { const s = JSON.parse(localStorage.getItem(CHEIE_SESIUNE) || 'null'); return (s && s.user && s.user.id) || null; } catch { return null; } };
  const ziAici = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' }).format(new Date());
  function salveazaPortofel(r) {
    const { portofel: p, garaj, echipa, azi, misiuni: m } = r;
    try { localStorage.setItem(PORTOFEL_SALVAT, JSON.stringify({ cont: idCont(), r: { portofel: p, garaj, echipa, azi, misiuni: m } })); } catch { /* fără stocare */ }
  }
  function portofelSalvat() {
    if (!areCont()) return null;
    try {
      const v = JSON.parse(localStorage.getItem(PORTOFEL_SALVAT) || 'null');
      if (!v || !v.r || !v.cont || v.cont !== idCont()) return null;
      const r = { ...v.r, premii: [], salvat: true };
      if (!r.azi || r.azi.data !== ziAici()) { r.azi = null; r.misiuni = null; }
      return r;
    } catch { return null; }
  }
  // Numele e unul singur, pe server; telefonul ține doar o copie. Dacă serverul are
  // încă numele implicit și aici s-a ales unul, îl trimitem; altfel îl luăm de acolo.
  function potrivesteNume(deLaServer) {
    const local = numeLocal();
    if (/^Jucător [0-9A-F]{4}$/.test(deLaServer)) { if (local) schimbaNume().catch(() => {}); return; }
    if (deLaServer === local) return;
    seteazaNume(deLaServer);
  }
  // pentru Setări: numele de pe server, fără tot portofelul
  async function numeDeLaServer() {
    if (!areCont()) return numeLocal();
    try { const r = await invoca('prieteni', { actiune: 'profil' }); if (r && r.eu && r.eu.nume) potrivesteNume(r.eu.nume); } catch { /* rămâne copia */ }
    return numeLocal();
  }
  // Prietenii: { actiune: 'stare' | 'cere' | 'raspunde' | 'sterge' | 'invita' | 'refuza', ... }
  const prieteni = corp => invoca('prieteni', corp);
  // Lista de prieteni în sala de așteptare a unei camere: „Invită" trimite invitația
  // în aplicație (și notificare). `auto`: un prieten de invitat imediat (venit din
  // pagina Prieteni). Lista se ține un minut, ca să nu se ceară la fiecare desen.
  let prieteniCache = null;
  async function panouPrieteni(el, camera, auto) {
    if (!el) return;
    const trimise = panouPrieteni.trimise || (panouPrieteni.trimise = new Set());
    const cheie = id => `${camera}:${id}`;
    async function invitaPe(id) {
      try {
        await prieteni({ actiune: 'invita', catre: id, camera }); trimise.add(cheie(id));
        if (window.FrqNotif) setTimeout(() => window.FrqNotif.propune('prieten'), 1200);
        return true;
      } catch { return false; }
    }
    let autoOk = true;
    if (auto && !trimise.has(cheie(auto))) autoOk = await invitaPe(auto);
    let l;
    try { l = (await starePrieteni()).prieteni || []; } catch { return autoOk; }
    if (!l.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<p class="label">Invită din prieteni</p><ul class="pr-mini">${l.map(x => `<li><b>${esc(x.nume)}</b>${trimise.has(cheie(x.id))
      ? '<span class="pr-ok">Invitat</span>' : `<button class="btn btn-ghost" type="button" data-invita="${esc(x.id)}">Invită</button>`}</li>`).join('')}</ul>`;
    if (!el.dataset.legat) {
      el.dataset.legat = '1';
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-invita]');
        if (!b) return;
        b.disabled = true;
        const ok = await invitaPe(b.dataset.invita);
        b.replaceWith(Object.assign(document.createElement('span'), { className: 'pr-ok', textContent: window.I18n ? I18n.t(ok ? 'Invitat' : 'Nu s-a putut') : (ok ? 'Invitat' : 'Nu s-a putut') }));
      });
    }
    return autoOk;
  }
  // starea Prietenilor, ținută un minut (lista apare în mai multe locuri pe pagină)
  async function starePrieteni() {
    const api = window.FrqCloud || { areCont, prieteni };   // prin API-ul public, ca restul paginii
    if (!api.areCont()) return { legat: false, prieteni: [] };
    if (!prieteniCache || Date.now() - prieteniCache.la > 60000) prieteniCache = { la: Date.now(), r: await api.prieteni({ actiune: 'stare' }) };
    return prieteniCache.r;
  }
  // „Provoacă un prieten", în meniul „Cu un prieten" al fiecărui joc: un tap face
  // camera și îi trimite provocarea în aplicație (`laAlegere({ id, nume })`). Întoarce
  // câți prieteni sunt în listă.
  async function panouProvoaca(el, laAlegere) {
    if (!el) return 0;
    let r;
    try { r = await starePrieteni(); } catch { el.innerHTML = ''; return 0; }
    const l = r.prieteni || [];
    if (!l.length) {
      el.innerHTML = `<p class="pr-gol">${r.legat ? 'Adaugă-ți prietenii și îi provoci direct de aici.' : 'Cu garajul legat de mail îți provoci prietenii direct de aici.'} <a href="${r.legat ? 'index.html#prieteni' : 'colectie.html#cont'}">${r.legat ? 'Prieteni' : 'Leagă garajul'}</a></p>`;
      return 0;
    }
    el.innerHTML = `<p class="label">Provoacă un prieten</p><ul class="pr-mini pr-provoaca">${l.map(x => `<li><span><b>${esc(x.nume)}</b>${x.id_public ? ` <small>@${esc(x.id_public)}</small>` : ''}</span>`
      + `<button class="btn btn-primary" type="button" data-provoaca="${esc(x.id)}" data-nume="${esc(x.nume)}">Provoacă</button></li>`).join('')}</ul>`;
    el.onclick = e => {
      const b = e.target.closest('[data-provoaca]');
      if (!b) return;
      el.querySelectorAll('[data-provoaca]').forEach(x => { x.disabled = true; });
      laAlegere({ id: b.dataset.provoaca, nume: b.dataset.nume });
    };
    return l.length;
  }

  // Invită un prieten: { cod, prieteni: [{ nume, zile, platit }], bonus, premiu, zile, max }
  const invita = () => invoca('portofel', { actiune: 'invita' });
  // linkul pe care îl trimiți: prima pagină, cu codul tău
  const linkInvitatie = cod => new URL(`index.html?inv=${encodeURIComponent(cod)}`, location.href).href;
  // -> { masina, raritate, noua, valoare, mil, lazi_gratis }
  const deschideLada = (lada, gratis = false) => invoca('portofel', { actiune: 'lada', lada, gratis });
  // o dublură: 'vinde' (bani) sau 'puncte' (un punct de upgrade de raritatea ei)
  const dublura = (masina, alegere) => invoca('portofel', { actiune: 'dublura', masina, alegere });
  // Dueluri cu miză (Startul): { actiune, ... } -> răspunsul funcției `duel`
  const duel = corp => invoca('duel', corp);
  // Tuning: un nivel în plus pentru o mașină din garaj -> { nivel, mil }
  // o piesă: 0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie
  const tuneaza = (masina, piesa) => invoca('portofel', { actiune: 'tuneaza', masina, piesa });
  // Vitrina: exact mașina care îți lipsește
  const cumpara = masina => invoca('portofel', { actiune: 'cumpara', masina });
  // Echipa din Startul online: mașina pentru o clasă (null o scoate)
  const echipa = (clasa, masina) => invoca('portofel', { actiune: 'echipa', clasa, masina });
  // Cupa de duminică (Startul)
  const cupa = corp => invoca('cupa', corp);
  // Camerele online (Licitația cu un prieten): mutările trec prin server, iar
  // schimbările vin prin Realtime pe rândul camerei.
  const camera = corp => invoca('camera', { nume: numeLocal(), ...corp });
  // Startul live: apăsările fiecăruia ajung pe loc la celălalt (doar ca să-i vezi
  // mașina pe pistă; rezultatul îl socotește serverul).
  async function canalLive(id, laMesaj) {
    const c = await cont();
    const canal = c.channel(`live-${id}`, { config: { broadcast: { self: false } } });
    canal.on('broadcast', { event: 'p' }, m => laMesaj(m.payload)).subscribe();
    return {
      trimite: payload => { try { canal.send({ type: 'broadcast', event: 'p', payload }); } catch { /* fără rețea */ } },
      opreste: () => { try { c.removeChannel(canal); } catch { /* deja închis */ } },
    };
  }
  async function ascultaCamera(id, laSchimbare) {
    const c = await cont();
    const canal = c.channel(`camera-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'camere', filter: `id=eq.${id}` }, p => laSchimbare(p.new))
      .subscribe();
    return () => { try { c.removeChannel(canal); } catch { /* deja închis */ } };
  }
  // codul de eroare trimis de o funcție de pe server ('bani', 'blocata', ...), dacă e
  // Recordurile tale pe mașini (Map cheie -> ms) și cel mai bun timp de pe FRQ al unei mașini
  async function recorduri() {
    if (!areCont()) return new Map();
    const c = await cont();
    const { data, error } = await c.from('recorduri').select('masina, timp_ms');
    if (error) throw error;
    return new Map((data || []).map(r => [r.masina, r.timp_ms]));
  }
  const recordMasina = masina => rpc('record_masina', { p_masina: masina });
  // Profilul tău (statistici și ce trebuie pentru realizări), doar dacă ai deja cont
  async function profil() {
    if (!areCont()) return null;
    const c = await cont();
    const { data, error } = await c.rpc('profil_meu');
    if (error) throw error;
    return data;
  }

  // Pe paginile online, biblioteca se încarcă din timp (fără să facă un cont), ca
  // prima partidă să pornească repede.
  const pregateste = () => { incarca().catch(() => {}); };

  // notificările pe telefon (abonarea, tipurile, testul): vezi notificari.js
  const notificari = corp => invoca('notificari', corp);

  async function codEroare(e) {
    try { const j = await e.context.json(); return j && j.eroare; } catch { return null; }
  }

  // Ce ai primit pentru o provocare a zilei, într-un rând (gol dacă nimic).
  function textRecompense(r) {
    if (!r) return '';
    const bucati = [];
    if (r.mil) bucati.push(`+${r.mil} mil.`);
    if (r.lazi) bucati.push(r.lazi === 1 ? '+1 ladă gratis' : `+${r.lazi} lăzi gratis`);
    if (!bucati.length) return '';
    if (r.serie > 1) bucati.push(`serie de ${r.serie} zile`);
    return bucati.join(' · ');
  }
  // misiunile pe care le-a mișcat partida: cât mai e, sau „îndeplinită" cu banii ei
  const randMisiuni = lista => (lista || []).map(m => `<p class="drg-cls-mis${m.gata ? ' is-gata' : ''}"><a href="colectie.html#misiuni">${m.gata
    ? `Misiune îndeplinită${m.noua ? ` · +${m.mil} mil.` : ''}`
    : `Misiune: ${m.progres} din ${m.n}`}<small>${esc(m.text)}</small></a></p>`).join('');
  // ---------- premiile de după rundă ----------
  // Un ecran peste final, înainte de clasament: fiecare premiu pe rândul lui (partida,
  // bonusul, provocarea zilei, seria, lada gratis, misiunile), totalul care urcă și,
  // dacă e o ladă cadou, drumul spre ea. `rez`: răspunsul serverului la finalul rundei.
  function randuriPremii(rez, joc) {
    if (!rez) return [];
    const rows = [], b = rez.bani;
    if (b && b.castig > 0) {
      const bonus = Math.min(b.bonus || 0, b.castig), baza = b.castig - bonus;
      const ce = joc === 'ordine' ? `${rez.scor} ${rez.scor === 1 ? 'mașină pusă' : 'mașini puse'} corect` : `${rez.scor} răspunsuri corecte`;
      if (baza > 0) rows.push({ text: 'Partida', sub: ce, mil: baza });
      if (bonus > 0) rows.push({ text: 'Bonus pentru scor mare', mil: bonus, accent: true });
      if (b.castig < b.ar_fi) rows.push({ text: 'Plafonul zilei atins', sub: `${b.plafon} mil. din jocuri. Mâine se reia.`, mil: 0 });
    }
    ((rez.recompense && rez.recompense.detalii) || []).forEach(d => rows.push({ text: d.text, mil: d.mil, lazi: d.lazi }));
    // fără `detalii` (server vechi): totalul recompenselor, pe un rând
    if (rez.recompense && !rez.recompense.detalii && (rez.recompense.mil || rez.recompense.lazi)) rows.push({ text: 'Provocarea zilei', mil: rez.recompense.mil, lazi: rez.recompense.lazi });
    (rez.misiuni || []).filter(m => m.noua).forEach(m => rows.push({ text: 'Misiune îndeplinită', sub: m.text, mil: m.mil, misiune: true }));
    return rows.filter(r => r.mil > 0 || r.lazi > 0 || r.mil === 0 && r.sub);
  }
  function ecranPremii(rows, { titlu = 'Premii' } = {}) {
    if (!rows.length) return Promise.resolve();
    document.querySelectorAll('.premii').forEach(x => x.remove());
    const total = rows.reduce((s, r) => s + (r.mil || 0), 0), lazi = rows.reduce((s, r) => s + (r.lazi || 0), 0);
    const el = document.createElement('div');
    el.className = 'premii';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', titlu);
    el.innerHTML = `<div class="premii-in">
      <p class="eyebrow">${esc(titlu)}</p>
      <p class="premii-total">${total ? `<span>+<b data-pana="${total}">0</b> mil.</span>` : ''}${lazi ? `<span class="premii-lada">+${lazi === 1 ? '1 ladă gratis' : `${lazi} lăzi gratis`}</span>` : ''}</p>
      <ul class="premii-l">${rows.map((r, i) => `<li class="${r.misiune ? 'is-mis' : ''}${r.accent ? ' is-accent' : ''}" style="--i:${i}">
        <span><b>${esc(r.text)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
        <em>${r.lazi ? `+${r.lazi === 1 ? '1 ladă' : `${r.lazi} lăzi`}` : r.mil ? `+${r.mil} mil.` : '–'}</em></li>`).join('')}</ul>
      <div class="premii-act">${lazi ? '<a class="btn btn-ghost" href="colectie.html#lazi">Deschide lada</a>' : ''}<button class="btn btn-primary" type="button" data-gata>Continuă</button></div>
    </div>`;
    document.body.appendChild(el);
    if (window.Shared) window.Shared.haptic('success');
    // totalul urcă în timp ce apar rândurile
    const b = el.querySelector('[data-pana]');
    if (b) {
      const t0 = performance.now(), dur = 500 + rows.length * 140;
      const pas = t => { const k = Math.min(1, (t - t0) / dur); b.textContent = Math.round(total * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(pas); };
      requestAnimationFrame(pas);
    }
    return new Promise(gata => {
      const inchide = () => { document.removeEventListener('keydown', tasta); el.classList.add('is-iese'); setTimeout(() => el.remove(), 200); gata(); };
      const tasta = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); inchide(); } };
      el.querySelector('[data-gata]').addEventListener('click', inchide);
      document.addEventListener('keydown', tasta);
      setTimeout(() => el.querySelector('[data-gata]').focus(), 50);
    });
  }

  // Misiune îndeplinită în altă parte (lăzi, dueluri...): un banner sus, câteva secunde.
  // Atinge-l și te duce la misiuni.
  const coadaBanner = [];
  const banner = b => { coadaBanner.push(b); if (coadaBanner.length === 1) urmatorulBanner(); };
  const bannerMisiune = m => banner({ eticheta: 'Misiune îndeplinită', titlu: m.text, dreapta: `+${m.mil} mil.`, url: 'colectie.html#misiuni' });
  // un mesaj venit cât ai aplicația deschisă (în loc de notificare pe telefon)
  const bannerMesaj = m => banner({ eticheta: 'FRQ', titlu: m.titlu || '', text: m.text || '', url: m.url || 'index.html', cls: 'is-mesaj', ms: 6000 });
  function urmatorulBanner() {
    const m = coadaBanner[0];
    if (!m) return;
    const el = document.createElement('a');
    el.className = `banner-mis ${m.cls || ''}`;
    el.href = m.url;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span><small>${esc(m.eticheta)}</small><b>${esc(m.titlu)}</b>${m.text ? `<i>${esc(m.text)}</i>` : ''}</span>${m.dreapta ? `<em>${esc(m.dreapta)}</em>` : ''}`;
    document.body.appendChild(el);
    if (window.Shared) window.Shared.haptic('success');
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => { el.remove(); coadaBanner.shift(); urmatorulBanner(); }, 300);
    }, m.ms || 4000);
  }

  // Cât aplicația e deschisă și vizibilă, serverul știe (la ~30 s) și nu-ți mai trimite
  // notificări pe telefon: mesajele vin aici, pe canalul tău, ca banner sus. Doar cu
  // notificările pornite (altfel nu e nimic de oprit).
  let ceasActiv = 0, canalMesaje = null;
  async function inAplicatie() {
    if (!areCont() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let c, id;
    try { c = await cont(); const { data } = await c.auth.getSession(); id = data && data.session && data.session.user.id; } catch { return; }
    if (!id) return;
    if (!canalMesaje) canalMesaje = c.channel(`frq-u-${id}`).on('broadcast', { event: 'n' }, ({ payload }) => bannerMesaj(payload || {})).subscribe();
    const anunta = vizibil => invoca('notificari', { actiune: 'activ', vizibil }).catch(() => {});
    const bate = () => { if (!document.hidden) anunta(true); };
    bate();
    clearInterval(ceasActiv);
    ceasActiv = setInterval(bate, 30000);
    document.addEventListener('visibilitychange', () => anunta(!document.hidden));
  }
  setTimeout(inAplicatie, 1500);
  const anuntaMisiuni = lista => (lista || []).filter(m => m.noua).forEach(bannerMisiune);

  // Banii din partidă, sus pe ecranul de final: cât ai luat acum, cât azi din jocuri
  // (cu plafon) și, când e zero, de ce.
  const REGULA_BANI = { 'sus-sau-jos': '1 mil. la 2 răspunsuri corecte, plus 5 de la 10.', ordine: '1 mil. pe fiecare mașină pusă corect, plus 5 de la 5.' };
  function randBani(b, joc) {
    if (!b) return '';
    const plin = b.azi >= b.plafon;
    const pct = Math.min(100, Math.round(100 * b.azi / b.plafon));
    const de = b.castig ? (b.castig < b.ar_fi ? 'din partidă · ai atins plafonul zilei' : b.bonus ? `din partidă, cu bonusul de ${b.bonus} pentru scor mare` : 'din partidă')
      : plin ? 'azi ai luat tot ce dau partidele. Mâine se reia.'
      : `de data asta. ${REGULA_BANI[joc] || ''}`;
    return `<a class="cls-bani${b.castig ? ' is-plus' : ''}" href="colectie.html#bani">
      <span class="cls-bani-s"><b>+${b.castig} mil.</b> ${esc(de)}</span>
      <span class="cls-bani-z">Azi din jocuri: ${b.azi} din ${b.plafon} mil.<i style="--p:${pct}%"></i></span></a>`;
  }
  const randRecompense = r => {
    const t = textRecompense(r);
    return t ? `<p class="drg-cls-rec"><a href="colectie.html">${esc(t)} &rarr; Garajul meu</a></p>` : '';
  };

  // ---------- contul: anonim (doar pe telefonul ăsta) sau legat de un mail ----------
  // Legarea trimite pe mail un cod și un link de confirmare (fără parolă); după
  // confirmare contul e același, doar că nu se mai pierde. Pe alt telefon intri la fel.
  // Codul contează în aplicația de pe ecranul principal: linkul s-ar deschide în
  // browser, iar sesiunea ar rămâne acolo, nu în aplicație.
  const IESIT = 'frq_iesit';
  const aIesit = () => { try { return localStorage.getItem(IESIT) === '1'; } catch { return false; } };
  const marcheazaIesit = v => { try { if (v) localStorage.setItem(IESIT, '1'); else localStorage.removeItem(IESIT); } catch { /* fără stocare */ } };
  const intoarcere = id => new URL(`colectie.html${id ? `?conectare=${id}` : ''}`, location.href).href;
  // -> null (fără cont) sau { anonim, mail, mailNou }
  async function cineSunt() {
    if (!areCont()) return null;
    const c = await incarca();
    const { data } = await c.auth.getUser();
    const u = data && data.user;
    return u ? { anonim: !!u.is_anonymous, mail: u.email || null, mailNou: u.new_email || null } : null;
  }
  async function leagaMail(mail) {
    const c = await cont();
    const id = await cerereConectare();
    const { error } = await c.auth.updateUser({ email: mail }, { emailRedirectTo: intoarcere(id) });
    if (error) throw error;
    pornesteConectarea();
  }
  async function intraCuMail(mail) {
    const c = await incarca();
    const id = await cerereConectare();
    const { error } = await c.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false, emailRedirectTo: intoarcere(id) } });
    if (error) throw error;
    pornesteConectarea();
  }
  // Codul așteptat după un mail trimis: { tip: 'leaga' | 'intra', mail, la } (o oră)
  const COD = 'frq_cod';
  function codAsteptat() {
    try {
      const v = JSON.parse(localStorage.getItem(COD) || 'null');
      return v && Date.now() - v.la < 3600e3 ? v : null;
    } catch { return null; }
  }
  const asteaptaCod = v => { try { if (v) localStorage.setItem(COD, JSON.stringify({ ...v, la: Date.now() })); else localStorage.removeItem(COD); } catch { /* fără stocare */ } };
  // `cod`: cele 6 cifre din mail sau codul arătat de browser după link
  async function confirmaCod(cod) {
    const v = codAsteptat(), k = String(cod).trim(), cifre = k.replace(/\s/g, '');
    const c = await incarca();
    const { error } = /^\d{6,8}$/.test(cifre)
      ? await c.auth.verifyOtp({ email: v ? v.mail : '', token: cifre, type: v && v.tip === 'leaga' ? 'email_change' : 'email' })
      : await c.auth.exchangeCodeForSession(k);
    if (error) throw error;
    asteaptaCod(null);
    marcheazaIesit(false);
  }
  async function iesi() {
    if (areCont()) { const c = await incarca(); await c.auth.signOut({ scope: 'local' }); }
    marcheazaIesit(true);
  }
  // Ce înseamnă o eroare de la serviciul de conturi, pe înțelesul jucătorului.
  function eroareCont(e) {
    const m = String((e && (e.message || e.msg)) || '').toLowerCase();
    if (m.includes('token') || m.includes('expired') || m.includes('code') || m.includes('flow')) return 'Codul nu e bun sau a expirat. Verifică ultimul mail sau cere altul.';
    if (e && e.status === 429 || m.includes('rate limit')) return 'S-au trimis prea multe mailuri în ultima oră. Încearcă puțin mai târziu.';
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) return 'Mailul ăsta are deja un garaj. Intră cu el mai jos.';
    if (m.includes('signups not allowed') || m.includes('not found') || m.includes('otp')) return 'Niciun garaj nu e legat de mailul ăsta.';
    if (m.includes('invalid') && m.includes('email')) return 'Mailul nu pare scris corect.';
    return 'Nu s-a putut trimite acum. Încearcă din nou.';
  }

  async function stergeCont() {
    if (!areCont()) return { sters: true };
    const c = await incarca();
    const { data } = await c.auth.getSession();
    if (!data.session) return { sters: true };
    const { data: r, error } = await c.functions.invoke('sterge-cont', { body: {} });
    if (error) throw error;
    await c.auth.signOut({ scope: 'local' });
    return r;
  }
  // Prima intrare pe o pagină cu cont: după „Ieși", nu se face singur un cont nou.
  const poateFaceCont = () => areCont() || !aIesit();
  const contNou = () => marcheazaIesit(false);

  // ---------- clasamentul general (partidele cu cronometru) ----------
  // Partida o pornește serverul: dă seed-ul și ține ora de start. Fără rețea (sau dacă
  // durează prea mult) se joacă oricum, doar că nu intră în clasament.
  // `zi`: data Provocării zilei (atunci `cat` nu contează).
  async function pornestePartida(joc, cat, asteapta = 4000, zi = null) {
    // prima partidă online face și contul: așteptăm mai mult, altfel ar ieși din clasament
    if (!areCont()) asteapta = Math.max(asteapta, 12000);
    try {
      return await Promise.race([
        invoca('partida', zi ? { actiune: 'start', joc, zi, nume: numeLocal() } : { actiune: 'start', joc, cat, nume: numeLocal() }),
        new Promise(gata => setTimeout(() => gata(null), asteapta)),
      ]);
    } catch { return null; }
  }
  const terminaPartida = (id, raspunsuri, timp_ms) => invoca('partida', { actiune: 'gata', id, raspunsuri, timp_ms });
  const schimbaNume = () => invoca('partida', { actiune: 'nume', nume: numeLocal() });
  async function clasamentGeneral(joc, cat, limita = 20) {
    const c = await incarca();
    const { data: r, error } = await c.rpc('clasament_general', { p_joc: joc, p_cat: cat, p_limita: limita });
    if (error) throw error;
    return r;
  }

  // ---------- liste de clasament ----------
  // Cu numere întregi, ca pe ecranul de final: sutimile (sau miimile, la Startul)
  // rotunjite la fel peste tot.
  function timpText(ms, zecimale = 2) {
    const u = 10 ** (3 - zecimale), x = Math.round(ms / u), f = 10 ** zecimale;
    const sep = window.I18n && I18n.lang === 'en' ? '.' : ',';
    return `${Math.floor(x / f)}${sep}${String(x % f).padStart(zecimale, '0')} s`;
  }
  // Un rând: scor și timp (Sus sau jos, În ordine), câștigul din dueluri sau doar
  // timpul (Startul).
  const valoare = x => (x.net != null ? `${x.net > 0 ? '+' : ''}${x.net} mil. <small>${x.dueluri === 1 ? '1 duel' : `${x.dueluri} dueluri`}</small>`
    : x.scor != null ? `${x.scor} <small>${timpText(x.timp)}</small>` : timpText(x.timp, 3));
  const rand = x => `<li class="${x.eu ? 'is-eu' : ''}"><span class="drg-cls-l">${x.loc}</span><span class="drg-cls-n">${esc(x.nume)}</span>`
    + `<span class="drg-cls-t">${valoare(x)}</span></li>`;
  // Primii din listă și, dacă ești mai jos, rândul tău după trei puncte.
  function lista(r, numeEu) {
    const eu = r.eu;
    const jos = eu && eu.loc > r.top.length
      ? `<li class="drg-cls-sep" aria-hidden="true">···</li>${rand({ ...eu, nume: numeEu || numeLocal() || '–', eu: true })}`
      : '';
    return r.top.length || jos ? `<ol class="drg-cls-lista">${r.top.map(rand).join('')}${jos}</ol>` : '<p class="cls-gol">Nimeni încă. Primul loc e liber.</p>';
  }
  const locText = r => (r.eu ? `Locul ${r.eu.loc} din ${r.total}` : r.total === 1 ? '1 jucător' : `${r.total} jucători`);

  // Pe ecranul de final: trimite partida (doar răspunsurile; scorul îl socotește
  // serverul), apoi arată primii zece, locul tău și numele, pe care îl poți schimba.
  // câți din clasament pe ecranul de final: pe un telefon, cât să încapă tot
  const TOP_FINAL = () => (innerHeight < 900 ? 5 : 10);
  function afiseazaFinal(el, eticheta, trimiteO, incarcaR, joc) {
    const cap = b => `<p class="drg-cls-h"><span>${eticheta}</span><b>${b}</b></p>`;
    let rez = null, trimis = false;
    async function arata() {
      el.innerHTML = cap('&nbsp;') + Shared.schelet(5);
      el.hidden = false;
      try {
        if (!trimis) { trimis = true; rez = await trimiteO(); if (rez) ecranPremii(randuriPremii(rez, joc)); }
        const nota = !rez ? '<p class="drg-cls-rec">Partida n-a pornit pe server (fără rețea), deci nu intră.</p>'
          : rez.valid === false ? '<p class="drg-cls-rec">Partida a ieșit din timp pe ceasul serverului și nu intră.</p>'
          : rez.prima === false ? '<p class="drg-cls-rec">În clasament intră doar prima ta partidă de azi.</p>' : '';
        const r = await incarcaR();
        el.innerHTML = `${cap(locText(r))}${nota}${rez ? randBani(rez.bani, joc) : ''}${lista(r, rez && rez.nume)}
          ${rez ? randRecompense(rez.recompense) : ''}
          ${rez ? randMisiuni(rez.misiuni) : ''}
          <p class="drg-cls-f">Apari ca <b>${esc((rez && rez.nume) || numeLocal() || 'Jucător')}</b> &middot; <a href="index.html#setari">schimbă</a></p>`;
      } catch {
        el.innerHTML = cap('Indisponibil acum');
      }
    }
    arata();
  }

  // Provocarea zilei (Sus sau jos, În ordine).
  function afiseazaZi(el, { joc, data, id, raspunsuri, timp_ms }) {
    if (!el) return;
    afiseazaFinal(el, 'Clasamentul zilei',
      async () => (id ? terminaPartida(id, raspunsuri, timp_ms) : null),
      () => clasamentJoc(joc, data, TOP_FINAL()), joc);
  }
  // O partidă cu cronometru, în clasamentul general al categoriei ei.
  function afiseazaGeneral(el, { joc, cat, id, raspunsuri, timp_ms }) {
    if (!el) return;
    const nume = (CLASAMENTE[joc].categorii.find(c => c[0] === cat) || [])[1] || '';
    afiseazaFinal(el, `General · ${esc(nume)}`,
      () => terminaPartida(id, raspunsuri, timp_ms),
      () => clasamentGeneral(joc, cat, TOP_FINAL()), joc);
  }

  // ---------- fereastra Clasament (butonul din antetul fiecărui joc) ----------
  const CATEGORII = [['hp', 'Cai putere'], ['weight', 'Greutate'], ['accel', '0-100 km/h']];
  const CLASAMENTE = {
    'sus-sau-jos': { titlu: 'Sus sau jos', categorii: [['mix', 'Mixt'], ...CATEGORII] },
    'ordine': { titlu: 'În ordine', categorii: CATEGORII },
    'startul': { titlu: 'Startul', categorii: null, zile: true },
  };
  const ziua = (minus = 0) => {
    const d = new Date(Date.now() - minus * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  async function rpc(nume, args) {
    const c = await incarca();
    const { data: r, error } = await c.rpc(nume, args);
    if (error) throw error;
    return r;
  }
  const clasamentSaptamana = (joc, cat, luni, limita = 20) => rpc('clasament_saptamana', { p_joc: joc, p_cat: cat, p_luni: luni, p_limita: limita });
  const clasamentCupa = (data, limita = 20) => rpc('clasament_cupa', { p_data: data, p_limita: limita });
  const ultimaCupa = () => rpc('ultima_cupa', {});
  async function clasamentBani(data, limita = 20) {
    const c = await incarca();
    const { data: r, error } = await c.rpc('clasament_bani', { p_data: data, p_limita: limita });
    if (error) throw error;
    return r;
  }

  // Sus sau jos și În ordine: general (pe categorii) și Provocarea zilei.
  // Startul: câștigul din duelurile rapide și Cursa zilei, azi sau ieri.
  function arataClasament(joc, catInitiala) {
    const def = CLASAMENTE[joc];
    if (!def) return;
    const E = window.Economie;
    const file = def.categorii
      ? [['general', 'General'], ['sapt', 'Săptămâna'], ['zi', 'Provocarea zilei']]
      : [['bani', 'Dueluri rapide'], ['cupa', 'Cupa'], ['cursa', 'Cursa zilei']];
    const ZILE = [['0', 'Azi'], ['1', 'Ieri']];
    const SAPT = [['0', 'Săptămâna asta'], ['1', 'Trecută']];
    const st = {
      fila: file[0][0],
      zi: '0',
      sapt: '0',
      cat: def.categorii && (def.categorii.some(c => c[0] === catInitiala) ? catInitiala : def.categorii[0][0]),
    };
    const numeCat = k => ((def.categorii || []).find(c => c[0] === k) || [])[1] || '';
    const anterior = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay cls-ov';
    ov.innerHTML = `<div class="modal cls-mod" role="dialog" aria-modal="true" aria-labelledby="cls-t">
      <div class="cls-cap"><div><p class="cls-k">${esc(def.titlu)}</p><h2 class="cls-t" id="cls-t">Clasament</h2></div>
        <button class="cls-x" type="button" aria-label="Închide">&times;</button></div>
      <div class="hub-tip cls-file" role="tablist">${file.map(([k, n]) => `<button type="button" role="tab" data-fila="${k}">${n}</button>`).join('')}</div>
      <div class="cls-cat" role="radiogroup" aria-label="Alege"></div>
      <p class="cls-nota"></p>
      <div class="drg-cls cls-lista"></div>
    </div>`;
    document.body.appendChild(ov);
    const q = sel => ov.querySelector(sel);
    let cerere = 0;
    // Fiecare filă: rândul de sub ea (categorii, zile, săptămâni), nota și lista.
    function fila() {
      const zi = ziua(+st.zi);
      if (st.fila === 'general') {
        return { chips: def.categorii, ales: st.cat, cheie: 'cat', nota: 'Doar partidele cu cronometru, de oricând.', lista: () => clasamentGeneral(joc, st.cat, 20) };
      }
      if (st.fila === 'sapt') {
        const luni = E.laData(E.luni(E.ziua()), -7 * +st.sapt), cat = E.SAPTAMANA.cat(joc, luni);
        const [p1, p2, p3] = E.SAPTAMANA.premii;
        return {
          chips: SAPT, ales: st.sapt, cheie: 'sapt',
          nota: `${numeCat(cat)} · cu cronometru, săptămâna de la ${luni}. Primii 3 primesc ${p1}, ${p2} și ${p3} mil. luni, dacă au jucat măcar ${E.SAPTAMANA.minim}.`,
          lista: () => clasamentSaptamana(joc, cat, luni, 20),
        };
      }
      if (st.fila === 'zi') return { nota: `Azi, ${ziua()}. Aceleași mașini pentru toți.`, lista: () => clasamentJoc(joc, ziua(), 20) };
      if (st.fila === 'bani') return { chips: ZILE, ales: st.zi, cheie: 'zi', nota: `Câștigul net din duelurile rapide, ${zi}.`, lista: () => clasamentBani(zi, 20) };
      if (st.fila === 'cupa') {
        return {
          nota: '', lista: async () => {
            const azi = E.ziua(), dow = E.ziDinSaptamana(azi);
            const data = dow === 0 ? azi : (await ultimaCupa()) || E.laData(azi, 7 - dow);
            const r = await clasamentCupa(data, 20);
            q('.cls-nota').textContent = `Cupa din ${data}: ${r.inscrisi === 1 ? '1 înscris' : `${r.inscrisi} înscriși`}.${r.platit ? ' Premiile s-au dat.' : ''}`;
            return r;
          },
        };
      }
      return { chips: ZILE, ales: st.zi, cheie: 'zi', nota: `Cursa zilei, ${zi}.`, lista: () => clasament(zi, 20) };
    }
    async function arata() {
      ov.querySelectorAll('[data-fila]').forEach(b => {
        const on = b.dataset.fila === st.fila;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on);
      });
      const f = fila();
      q('.cls-cat').hidden = !f.chips;
      if (f.chips) {
        q('.cls-cat').innerHTML = f.chips.map(([k, n]) =>
          `<button type="button" role="radio" aria-checked="${k === f.ales}" class="${k === f.ales ? 'is-on' : ''}" data-cat="${k}" data-cheie="${f.cheie}">${n}</button>`).join('');
      }
      q('.cls-nota').textContent = f.nota;
      const el = q('.cls-lista');
      const nr = ++cerere;
      el.innerHTML = Shared.schelet(6);
      try {
        const r = await f.lista();
        if (nr !== cerere) return;
        el.innerHTML = `<p class="drg-cls-h"><span>${r.eu ? 'Tu' : '&nbsp;'}</span><b>${locText(r)}</b></p>${lista(r)}`;
      } catch {
        if (nr === cerere) el.innerHTML = '<p class="drg-cls-h"><span>&nbsp;</span><b>Indisponibil acum</b></p>';
      }
    }
    function inchide() {
      ov.remove();
      document.removeEventListener('keydown', taste, true);
      if (anterior && anterior.focus) anterior.focus({ preventScroll: true });
    }
    function taste(e) { if (e.key === 'Escape') { e.stopPropagation(); inchide(); } }
    document.addEventListener('keydown', taste, true);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('.cls-x')) { inchide(); return; }
      const f = e.target.closest('[data-fila]');
      if (f && f.dataset.fila !== st.fila) { st.fila = f.dataset.fila; arata(); return; }
      const c = e.target.closest('[data-cat]');
      if (c && st[c.dataset.cheie] !== c.dataset.cat) { st[c.dataset.cheie] = c.dataset.cat; arata(); }
    });
    q('.cls-x').focus({ preventScroll: true });
    arata();
  }

  return {
    areCont, numeLocal, seteazaNume, numeDeLaServer, trimiteZi, trimiteScor, clasament, clasamentJoc, stergeCont, afiseazaZi,
    pornestePartida, clasamentGeneral, afiseazaGeneral, arataClasament, cumpara, cupa, clasamentCupa, echipa, schimbaNume,
    camera, ascultaCamera, canalLive, notificari, recorduri, recordMasina, pregateste, profil,
    portofel, portofelSalvat, deschideLada, dublura, duel, tuneaza, codEroare, randRecompense, randuriPremii, ecranPremii, anuntaMisiuni, cineSunt, leagaMail, intraCuMail, codAsteptat, asteaptaCod, confirmaCod, codDinLink, linkTrimisAplicatiei, invita, linkInvitatie, prieteni, panouProvoaca, prietenDinLink, tinePrietenDinLink, panouPrieteni, iesi, eroareCont, poateFaceCont, contNou,
  };
})();
// numele vechi, folosit de Startul
window.DragCloud = window.FrqCloud;
