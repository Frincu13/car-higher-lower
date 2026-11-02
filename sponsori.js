// Sponsorii FRQ în aplicație. Lista vine de pe server (sponsori_activi), ținută pe
// telefon câteva ore; paginile îi pun în locurile nivelului lor:
//   1 principal: „powered by" lângă logo-ul FRQ, lada Hypercar, Cupa de duminică
//   2 partener: lada lui, ecranul de premii, clasamentul săptămânii (pe rând, pe zile)
//   3 susținător: pagina Partenerii FRQ
// Niciodată în timpul unui joc. Se numără doar de câte ori a fost văzut și atins fiecare,
// pe loc și pe zi, fără nimic despre cine. Cu ?sponsori=demo (o dată, pe telefonul tău)
// apar și sponsorii inventați, ca să se vadă locurile; ?sponsori=off îi scoate.
(() => {
  'use strict';
  const URL_SUPABASE = 'https://zndivyygyomkxyeuvytf.supabase.co';
  const CHEIE = 'sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm';
  const PASTRARE = 'frq_sponsori', DEMO = 'frq_sponsori_demo', ORE = 6;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  try {
    const q = new URLSearchParams(location.search), v = q.get('sponsori');
    if (v === 'demo') localStorage.setItem(DEMO, '1');
    if (v === 'off') localStorage.removeItem(DEMO);
    if (v) {
      q.delete('sponsori');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch { /* fără stocare */ }
  const demo = (() => { try { return localStorage.getItem(DEMO) === '1'; } catch { return false; } })();

  let lista = [];
  try {
    const v = JSON.parse(localStorage.getItem(PASTRARE) || 'null');
    if (v && v.demo === demo && Array.isArray(v.lista)) lista = v.lista;
  } catch { /* nimic salvat */ }
  // de pe server, dacă ce e pe telefon e vechi; paginile redesenează la `frq-sponsori`
  const gata = (async () => {
    try {
      const v = JSON.parse(localStorage.getItem(PASTRARE) || 'null');
      if (v && v.demo === demo && Date.now() - v.la < ORE * 36e5) return lista;
    } catch { /* cerem */ }
    try {
      const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/sponsori_activi`, {
        method: 'POST', headers: { apikey: CHEIE, Authorization: `Bearer ${CHEIE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_demo: demo }),
      });
      if (!r.ok) return lista;
      const nou = await r.json();
      if (!Array.isArray(nou)) return lista;
      const schimbat = JSON.stringify(nou) !== JSON.stringify(lista);
      lista = nou;
      try { localStorage.setItem(PASTRARE, JSON.stringify({ la: Date.now(), demo, lista })); } catch { /* fără stocare */ }
      if (schimbat) document.dispatchEvent(new CustomEvent('frq-sponsori'));
    } catch { /* fără semnal: rămâne ce era */ }
    return lista;
  })();

  const principal = () => lista.find(s => s.nivel === 1) || null;
  const pentruLada = id => lista.find(s => (s.lazi || []).includes(id)) || null;
  // locurile „pe rând": principalul și partenerii, câte unul pe zi (același toată ziua)
  const peRand = () => lista.filter(s => s.nivel <= 2);
  const zi = () => Math.floor((Date.now() + 2 * 36e5) / 864e5);
  const rotatie = (loc = '') => { const l = peRand(); return l.length ? l[(zi() + loc.length) % l.length] : null; };

  // ---------- cifrele: văzut și atins, strânse și trimise la plecare ----------
  const cifre = new Map(), vazute = new Set();
  const adauga = (id, loc, cheie) => {
    const k = `${id}|${loc}`, x = cifre.get(k) || { s: id, l: loc, a: 0, c: 0 };
    x[cheie]++;
    cifre.set(k, x);
  };
  // o afișare pe pagină și loc, oricâte redesenări
  function vazut(id, loc) {
    if (!id || vazute.has(`${id}|${loc}`)) return;
    vazute.add(`${id}|${loc}`);
    adauga(id, loc, 'a');
  }
  function trimite() {
    if (!cifre.size) return;
    const p = [...cifre.values()].slice(0, 40);
    cifre.clear();
    try {
      fetch(`${URL_SUPABASE}/rest/v1/rpc/noteaza_sponsori`, {
        method: 'POST', keepalive: true,
        headers: { apikey: CHEIE, Authorization: `Bearer ${CHEIE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_cifre: p }),
      }).catch(() => {});
    } catch { /* data viitoare */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') trimite(); });
  addEventListener('pagehide', trimite);
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-sp]');
    if (a) adauga(a.dataset.sp, a.dataset.spLoc || 'alt', 'c');
  }, true);

  // ---------- bucăți de pagină ----------
  const logo = (s, cls = '') => `<img class="sp-logo ${cls}" src="${esc(s.logo)}" alt="${esc(s.nume)}" decoding="async">`;
  // „powered by X", un link spre pagina partenerilor
  const powered = (s, loc, cls = '') => (s ? `<a class="sp-powered ${cls}" href="parteneri.html" data-sp="${esc(s.id)}" data-sp-loc="${esc(loc)}" style="--sp:${esc(s.culoare)}"><small>powered by</small>${logo(s)}</a>` : '');
  const cuSprijin = (s, loc, text = 'cu sprijinul') => (s ? `<a class="sp-sprijin" href="parteneri.html" data-sp="${esc(s.id)}" data-sp-loc="${esc(loc)}"><small>${esc(text)}</small>${logo(s)}</a>` : '');

  // „powered by" lângă logo-ul FRQ din bara de sus, pe toate paginile cu bara FRQ
  function barele() {
    const s = principal();
    document.querySelectorAll('.brand-bar .brand-logo').forEach(a => {
      const urm = a.nextElementSibling;
      if (urm && urm.classList.contains('sp-powered')) urm.remove();
      if (s) a.insertAdjacentHTML('afterend', powered(s, 'powered', 'sp-bara'));
    });
    if (s) vazut(s.id, 'powered');
  }
  const porneste = () => { barele(); document.addEventListener('frq-sponsori', barele); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', porneste); else porneste();

  window.Sponsori = { gata, demo, lista: () => lista, principal, pentruLada, rotatie, vazut, logo, powered, cuSprijin, esc };
})();
