// Licitația online, fără nimic de ecran: aceleași reguli ca jocul de pe un telefon
// (licitatie.js), scrise ca o stare care se schimbă doar prin mutări și termene.
// Starea întreagă o ține serverul (funcția `camera`); fiecare jucător primește
// `vedere(...)`, fără loturile care urmează, fără categoriile încă ascunse și fără
// așezarea celuilalt. Un termen trecut (tura de 10 secunde, privirea dinainte de
// licitare) se aplică la prima cerere care vine după el, deci jocul merge și dacă
// unul pleacă. Se încarcă și ca script (window.LicitatieModel), și ca modul.
// Are nevoie de Grades (note) și Kinds (tipuri de mașini), încărcate înainte.
(() => {
  'use strict';

  const START_CASH = 10e6, PRIZE = 5e6, LOTS = 12, PER_PLAYER = 4;
  const MS = { intro: 7000, previz: 5000, tura: 10000, rezultat: 2400, categorii: 6000, asezare: 75000 };
  const INCS = [250e3, 500e3, 1e6];

  function creeaza(carsToate) {
    const { ATTRS, points, complete } = globalThis.Grades;
    const { kindOf, KINDS } = globalThis.Kinds;
    const CARS = carsToate.filter(c => c.image && complete(c));
    const DUPA_ID = new Map(CARS.map(c => [c.id, c]));
    const attrOf = k => ATTRS.find(a => a.key === k);

    // Prețul de pornire: aceleași trepte ca pe un telefon (licitatie.js).
    const PRETURI = [400e3, 500e3, 600e3, 700e3, 800e3, 900e3, 1e6, 1.1e6, 1.2e6];
    const comb = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
    const PONDERI = ATTRS.map((_, i) => comb(ATTRS.length - i - 1, 3) / comb(ATTRS.length, 4));
    const valoare = c => ATTRS.map(a => points(a, c)).sort((x, y) => y - x).reduce((s, n, i) => s + PONDERI[i] * n, 0);
    const toate = CARS.map(valoare).sort((a, b) => a - b);
    const PRAGURI = PRETURI.slice(1).map((_, i) => toate[Math.round(((i + 1) / PRETURI.length) * (toate.length - 1))]);
    function pretDe(car) {
      const v = valoare(car);
      const i = PRAGURI.findIndex(prag => v < prag);
      return i === -1 ? PRETURI[PRETURI.length - 1] : PRETURI[i];
    }

    // ---------- o partidă nouă: loturile și categoriile, cu un generator dat ----------
    function amesteca(a, rng) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    // `primul`: cine licitează primul la lotul 1 (la revanșă, celălalt)
    function noua(rng, acum, primul = 0) {
      const tipuri = KINDS.map(([k]) => k);
      const folosite = new Set();
      const lots = amesteca([...tipuri, ...amesteca(tipuri.slice(), rng).slice(0, LOTS - tipuri.length)].map(k => {
        const pool = CARS.filter(c => kindOf(c) === k && !folosite.has(c));
        const c = pool[Math.floor(rng() * pool.length)];
        if (c) folosite.add(c);
        return c;
      }).filter(Boolean), rng).slice(0, LOTS).map(c => c.id);
      const cats = amesteca(ATTRS.map(a => a.key), rng).slice(0, 4);
      return {
        faza: 'intro', termen: acum + MS.intro, lots, cats, known: 2, lot: 0, primul,
        cash: [START_CASH, START_CASH], owned: [[], []], bid: null, ultim: null,
        place: [null, null], prizes: [0, 0], rezultat: null,
      };
    }

    const need = (s, p) => PER_PLAYER - s.owned[p].length;
    const left = s => LOTS - s.lot;
    const forced = s => left(s) <= need(s, 0) + need(s, 1);

    // ---------- loturile ----------
    function startLot(s, t) {
      const car = DUPA_ID.get(s.lots[s.lot]);
      const pornire = pretDe(car);
      s.bid = { price: pornire, start: pornire, pas: 0, holder: null, turn: (s.lot + (s.primul || 0)) % 2, refused: null, solo: false, full: null };
      const full = [0, 1].find(p => need(s, p) === 0);
      const solo = full !== undefined && !forced(s);
      if (full !== undefined) s.bid.full = full;
      if (solo) { s.bid.turn = 1 - full; s.bid.solo = true; }
      // unul are deja patru mașini, iar celălalt trebuie să le ia pe toate cele rămase
      if (full !== undefined && !solo) { vandut(s, 1 - full, pornire, t); return; }
      s.faza = 'previz';
      s.termen = t + MS.previz;
    }
    function vandut(s, w, price, t) {
      s.cash[w] -= price;
      s.owned[w].push({ id: s.lots[s.lot], price });
      s.ultim = { tip: 'vandut', p: w, price, id: s.lots[s.lot] };
      s.faza = 'rezultat';
      s.termen = t + MS.rezultat;
    }
    function nevandut(s, t) {
      s.ultim = { tip: 'nevandut', id: s.lots[s.lot] };
      s.faza = 'rezultat';
      s.termen = t + MS.rezultat;
    }
    function renunta(s, t) {
      const b = s.bid;
      if (b.holder !== null) { vandut(s, b.holder, b.price, t); return; }
      if (b.solo) { nevandut(s, t); return; }
      if (b.refused === null) { b.refused = b.turn; b.turn = 1 - b.turn; s.termen = t + MS.tura; return; }
      if (!forced(s)) { nevandut(s, t); return; }
      vandut(s, need(s, 0) === need(s, 1) ? b.refused : need(s, 0) > need(s, 1) ? 0 : 1, b.start, t);
    }

    // ---------- finalul: categoriile, așezarea, dezvăluirea ----------
    // Așezarea care lipsește la termen: mașinile în ordinea în care au fost cumpărate.
    const completeaza = (s, p) => s.place[p] || Object.fromEntries(s.cats.map((k, i) => [k, i]));
    function dezvaluie(s) {
      s.place = [completeaza(s, 0), completeaza(s, 1)];
      const cats = s.cats.map(k => {
        const a = attrOf(k);
        const pts = [0, 1].map(p => points(a, DUPA_ID.get(s.owned[p][s.place[p][k]].id)));
        const win = pts[0] === pts[1] ? -1 : pts[0] > pts[1] ? 0 : 1;
        if (win === -1) { s.prizes[0] += PRIZE / 2; s.prizes[1] += PRIZE / 2; } else s.prizes[win] += PRIZE;
        return { k, pts, win };
      });
      const tot = [0, 1].map(p => s.cash[p] + s.prizes[p]);
      s.rezultat = { cats, tot, win: tot[0] === tot[1] ? -1 : tot[0] > tot[1] ? 0 : 1 };
      s.faza = 'final';
      s.termen = null;
    }

    // Termenele trecute, unul după altul, fiecare de la ora lui (nu de la acum), ca
    // o cameră lăsată singură să ajungă exact unde ar fi ajuns jucată.
    function avanseaza(s, acum) {
      let schimbat = false;
      for (let pasi = 0; s.termen != null && s.termen <= acum && pasi < 200; pasi++) {
        const t = s.termen;
        schimbat = true;
        if (s.faza === 'intro') startLot(s, t);
        else if (s.faza === 'previz') { s.faza = 'licitatie'; s.termen = t + MS.tura; }
        else if (s.faza === 'licitatie') renunta(s, t);
        else if (s.faza === 'rezultat') {
          s.lot++;
          if (need(s, 0) + need(s, 1) > 0 && s.lot < LOTS) startLot(s, t);
          else { s.bid = null; s.known = 4; s.faza = 'categorii'; s.termen = t + MS.categorii; }
        } else if (s.faza === 'categorii') { s.faza = 'asezare'; s.termen = t + MS.asezare; }
        else if (s.faza === 'asezare') dezvaluie(s);
        else s.termen = null;
      }
      return schimbat;
    }

    // O mutare a jucătorului p. Întoarce null dacă e bună, altfel codul erorii.
    function muta(s, p, m, acum) {
      if (m.tip === 'ofer') {
        const b = s.bid, inc = m.inc;
        if (s.faza !== 'licitatie' || !b || b.turn !== p) return 'tura';
        if (!(inc === 0 || INCS.includes(inc))) return 'pas';
        if (b.price + inc > s.cash[p]) return 'bani';
        if (inc > 0 && inc < b.pas) return 'pas';
        if (b.solo) { vandut(s, p, b.price, acum); return null; }
        b.price += inc; b.holder = p; b.turn = 1 - p;
        if (inc > 0) b.pas = inc;
        s.termen = acum + MS.tura;
        return null;
      }
      if (m.tip === 'renunt') {
        if (s.faza !== 'licitatie' || !s.bid || s.bid.turn !== p) return 'tura';
        renunta(s, acum);
        return null;
      }
      if (m.tip === 'asez') {
        if (s.faza !== 'asezare') return 'faza';
        const pl = m.place;
        if (!pl || typeof pl !== 'object') return 'asezare';
        const vals = s.cats.map(k => pl[k]);
        if (vals.some(v => !Number.isInteger(v) || v < 0 || v >= s.owned[p].length) || new Set(vals).size !== s.cats.length) return 'asezare';
        s.place[p] = Object.fromEntries(s.cats.map(k => [k, pl[k]]));
        if (s.place[0] && s.place[1]) dezvaluie(s);
        return null;
      }
      return 'mutare';
    }

    // Ce vede jucătorul p: loturile de până acum, categoriile știute, doar așezarea lui.
    function vedere(s, p) {
      const v = JSON.parse(JSON.stringify(s));
      v.lots = s.lots.slice(0, Math.min(s.lot + 1, s.lots.length));
      v.totalLoturi = s.lots.length;
      v.cats = s.cats.map((k, i) => (i < s.known ? k : null));
      if (s.faza !== 'final') v.place = [0, 1].map(q => (q === p ? s.place[q] : !!s.place[q]));
      // la final, și ce a rămas neatins în sală
      if (s.faza === 'final') v.ramase = s.lots.slice(s.lot);
      return v;
    }

    return { CARS, DUPA_ID, attrOf, pretDe, noua, avanseaza, muta, vedere, need: (s, p) => need(s, p) };
  }

  globalThis.LicitatieModel = { START_CASH, PRIZE, LOTS, PER_PLAYER, MS, INCS, creeaza };
})();
