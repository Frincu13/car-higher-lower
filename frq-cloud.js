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

  // ---------- clasamentul zilei pe ecranul de final (Sus sau jos, În ordine) ----------
  // Trimite partida (doar răspunsurile; scorul îl socotește serverul), apoi arată primii
  // zece, locul tău și numele cu care apari, pe care îl poți schimba pe loc.
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function afiseazaZi(el, { joc, data, raspunsuri, timp_ms }) {
    if (!el) return;
    const { fmt } = window.Shared;
    const cap = b => `<p class="drg-cls-h"><span>Clasamentul zilei</span><b>${b}</b></p>`;
    const timp = ms => `${fmt(ms / 1000, 2)} s`;
    const rand = x => `<li class="${x.eu ? 'is-eu' : ''}"><span class="drg-cls-l">${x.loc}</span><span class="drg-cls-n">${esc(x.nume)}</span><span class="drg-cls-t">${x.scor} <small>${timp(x.timp)}</small></span></li>`;
    async function trimite() {
      el.innerHTML = cap('Se încarcă');
      el.hidden = false;
      try {
        const rez = raspunsuri ? await trimiteScor({ joc, data, raspunsuri, timp_ms, nume: numeLocal() }) : null;
        const r = await clasamentJoc(joc, data, 10);
        const eu = r.eu;
        const titlu = eu ? `Locul ${eu.loc} din ${r.total}` : r.total === 1 ? '1 jucător' : `${r.total} jucători`;
        const jos = eu && eu.loc > r.top.length
          ? `<li class="drg-cls-sep" aria-hidden="true">···</li>${rand({ ...eu, nume: (rez && rez.nume) || numeLocal() || '–', eu: true })}`
          : '';
        el.innerHTML = `${cap(titlu)}
          <ol class="drg-cls-lista">${r.top.map(rand).join('')}${jos}</ol>
          ${raspunsuri ? `<form class="drg-cls-nume"><input maxlength="16" autocomplete="nickname" placeholder="Numele tău" aria-label="Numele tău în clasament" value="${esc(numeLocal())}"><button class="btn btn-ghost" type="submit">Salvează</button></form>` : ''}
          <p class="drg-cls-f"><a href="confidentialitate.html">Confidențialitate</a></p>`;
        const f = el.querySelector('.drg-cls-nume');
        if (f) f.addEventListener('submit', e => { e.preventDefault(); seteazaNume(f.querySelector('input').value); trimite(); });
      } catch {
        el.innerHTML = cap('Indisponibil acum');
      }
    }
    if (!raspunsuri && !areCont()) { el.hidden = true; return; }
    trimite();
  }

  return { areCont, numeLocal, seteazaNume, trimiteZi, trimiteScor, clasament, clasamentJoc, stergeCont, afiseazaZi };
})();
// numele vechi, folosit de Startul
window.DragCloud = window.FrqCloud;
