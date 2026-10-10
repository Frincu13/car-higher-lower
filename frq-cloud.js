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
          auth: { persistSession: true, autoRefreshToken: true, storageKey: CHEIE_SESIUNE },
        });
        gata(client);
      };
      s.onerror = () => { incarcare = null; nu(new Error('biblioteca')); };
      document.head.appendChild(s);
    });
    return incarcare;
  }

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
    return c;
  }

  async function invoca(functie, corp) {
    const c = await cont();
    const { data, error } = await c.functions.invoke(functie, { body: corp });
    if (error) throw error;
    return data;
  }

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // Numele din clasamente, același în toate jocurile (pe telefon).
  const numeLocal = () => { try { return localStorage.getItem(CHEIE_NUME) || ''; } catch { return ''; } };
  const seteazaNume = n => { try { localStorage.setItem(CHEIE_NUME, String(n || '').trim().slice(0, 16)); } catch { /* fără stocare */ } };

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
  const portofel = () => invoca('portofel', { actiune: 'stare', nume: numeLocal() });
  // -> { masina, raritate, noua, valoare, mil, lazi_gratis }
  const deschideLada = (lada, gratis = false) => invoca('portofel', { actiune: 'lada', lada, gratis });
  // Dueluri cu miză (Startul): { actiune, ... } -> răspunsul funcției `duel`
  const duel = corp => invoca('duel', corp);
  // Tuning: un nivel în plus pentru o mașină din garaj -> { nivel, mil }
  const tuneaza = masina => invoca('portofel', { actiune: 'tuneaza', masina });
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
  const randRecompense = r => {
    const t = textRecompense(r);
    return t ? `<p class="drg-cls-rec"><a href="colectie.html">${esc(t)} &rarr; Garajul meu</a></p>` : '';
  };

  // ---------- contul: anonim (doar pe telefonul ăsta) sau legat de un mail ----------
  // Legarea trimite un link de confirmare (fără parolă); după confirmare contul e
  // același, doar că nu se mai pierde. Pe alt telefon intri cu un link primit pe mail.
  const IESIT = 'frq_iesit';
  const aIesit = () => { try { return localStorage.getItem(IESIT) === '1'; } catch { return false; } };
  const marcheazaIesit = v => { try { if (v) localStorage.setItem(IESIT, '1'); else localStorage.removeItem(IESIT); } catch { /* fără stocare */ } };
  const intoarcere = () => new URL('colectie.html', location.href).href;
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
    const { error } = await c.auth.updateUser({ email: mail }, { emailRedirectTo: intoarcere() });
    if (error) throw error;
  }
  async function intraCuMail(mail) {
    const c = await incarca();
    const { error } = await c.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false, emailRedirectTo: intoarcere() } });
    if (error) throw error;
  }
  async function iesi() {
    if (areCont()) { const c = await incarca(); await c.auth.signOut({ scope: 'local' }); }
    marcheazaIesit(true);
  }
  // Ce înseamnă o eroare de la serviciul de conturi, pe înțelesul jucătorului.
  function eroareCont(e) {
    const m = String((e && (e.message || e.msg)) || '').toLowerCase();
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
  function afiseazaFinal(el, eticheta, trimiteO, incarcaR) {
    const cap = b => `<p class="drg-cls-h"><span>${eticheta}</span><b>${b}</b></p>`;
    let rez = null, trimis = false;
    async function arata() {
      el.innerHTML = cap('Se încarcă');
      el.hidden = false;
      try {
        if (!trimis) { trimis = true; rez = await trimiteO(); }
        const nota = !rez ? '<p class="drg-cls-rec">Partida n-a pornit pe server (fără rețea), deci nu intră.</p>'
          : rez.valid === false ? '<p class="drg-cls-rec">Partida a ieșit din timp pe ceasul serverului și nu intră.</p>'
          : rez.prima === false ? '<p class="drg-cls-rec">În clasament intră doar prima ta partidă de azi.</p>' : '';
        const r = await incarcaR();
        el.innerHTML = `${cap(locText(r))}${nota}${lista(r, rez && rez.nume)}
          ${rez ? randRecompense(rez.recompense) : ''}
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
      () => clasamentJoc(joc, data, 10));
  }
  // O partidă cu cronometru, în clasamentul general al categoriei ei.
  function afiseazaGeneral(el, { joc, cat, id, raspunsuri, timp_ms }) {
    if (!el) return;
    const nume = (CLASAMENTE[joc].categorii.find(c => c[0] === cat) || [])[1] || '';
    afiseazaFinal(el, `General · ${esc(nume)}`,
      () => terminaPartida(id, raspunsuri, timp_ms),
      () => clasamentGeneral(joc, cat, 10));
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
            q('.cls-nota').textContent = `Cupa din ${data}: ${r.inscrisi === 1 ? '1 înscris' : `${r.inscrisi} înscriși`}, pot ${E.potCupa(r.inscrisi)} mil.${r.platit ? ' Premiile s-au dat.' : ''}`;
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
      el.innerHTML = '<p class="drg-cls-h"><span>Se încarcă</span><b>&nbsp;</b></p>';
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
    areCont, numeLocal, seteazaNume, trimiteZi, trimiteScor, clasament, clasamentJoc, stergeCont, afiseazaZi,
    pornestePartida, clasamentGeneral, afiseazaGeneral, arataClasament, cumpara, cupa, clasamentCupa, echipa, schimbaNume,
    camera, ascultaCamera, canalLive, notificari,
    portofel, deschideLada, duel, tuneaza, codEroare, randRecompense, cineSunt, leagaMail, intraCuMail, iesi, eroareCont, poateFaceCont, contNou,
  };
})();
// numele vechi, folosit de Startul
window.DragCloud = window.FrqCloud;
