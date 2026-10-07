// Legătura Startului cu serverul (Supabase): cont anonim, trimiterea Cursei zilei și
// clasamentul. Biblioteca Supabase se încarcă doar când e nevoie de ea (după prima
// cursă a zilei), iar contul anonim se face tot atunci: cine doar intră pe pagină nu
// primește cont. Cheia de aici e cea publică; ce poate citi sau scrie fiecare hotărăsc
// regulile din baza de date, iar timpii îi scrie doar funcția de pe server.
window.DragCloud = (() => {
  'use strict';

  const URL_SUPABASE = 'https://zndivyygyomkxyeuvytf.supabase.co';
  const CHEIE = 'sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm';
  const CHEIE_SESIUNE = 'frq-auth';
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

  // { data, apasari, tur, nume } -> { timp, record, nume, cel_mai_bun }
  async function trimiteZi(cursa) {
    const c = await cont();
    const { data, error } = await c.functions.invoke('trimite-zi', { body: cursa });
    if (error) throw error;
    return data;
  }

  // -> { total, top: [{ loc, nume, timp, eu }], eu: { loc, timp } | null }
  async function clasament(data, limita = 10) {
    const c = await incarca();
    const { data: r, error } = await c.rpc('clasament_zi', { p_data: data, p_limita: limita });
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

  return { areCont, trimiteZi, clasament, stergeCont };
})();
