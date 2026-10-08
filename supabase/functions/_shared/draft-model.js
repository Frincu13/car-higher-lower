// Mașina perfectă online, fără nimic de ecran: aceleași reguli ca jocul de pe un
// telefon (draft.js), ca stare care se schimbă doar prin mutări și termene. Opt runde,
// câte două mașini pe masă: cine alege (pe rând) ia una și o pune într-un slot,
// celălalt pune mașina rămasă la el. Perechile le trage serverul de la început și le
// ține ascunse; fiecare vede doar perechea de acum. O alegere care nu vine în 20 de
// secunde se face singură (prima mașină, primul slot liber). Se încarcă și ca script
// (window.DraftModel), și ca modul. Are nevoie de Grades, încărcat înainte.
(() => {
  'use strict';

  const MS = { alege: 20000, pune: 20000, intro: 4000 };

  function creeaza(carsToate) {
    const { ATTRS, points, complete } = globalThis.Grades;
    const CARS = carsToate.filter(c => c.image && complete(c));
    const DUPA_ID = new Map(CARS.map(c => [c.id, c]));
    const RUNDE = ATTRS.length;

    // Cea mai mare sumă la care puteau ajunge aceleași opt mașini (ca în draft.js).
    function maxPosibil(cars) {
      const n = ATTRS.length, size = 1 << n;
      const dp = new Array(size).fill(-1); dp[0] = 0;
      const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
      for (let mask = 0; mask < size; mask++) {
        if (dp[mask] < 0) continue;
        const i = pop(mask);
        if (i >= cars.length) continue;
        for (let s = 0; s < n; s++) {
          if (mask & (1 << s)) continue;
          const v = dp[mask] + points(ATTRS[s], cars[i]);
          if (v > dp[mask | (1 << s)]) dp[mask | (1 << s)] = v;
        }
      }
      return dp[size - 1];
    }

    // `primul`: cine alege primul (la revanșă, celălalt)
    function noua(rng, acum, primul = 0) {
      const libere = CARS.slice();
      const ia = () => libere.splice(Math.floor(rng() * libere.length), 1)[0].id;
      const perechi = Array.from({ length: RUNDE }, () => [ia(), ia()]);
      return { faza: 'intro', termen: acum + MS.intro, runda: 0, primul, perechi, boards: [{}, {}], luata: null, ultim: null, rezultat: null };
    }
    const alegator = s => (s.runda + (s.primul || 0)) % 2;
    const randul = s => (s.faza === 'alege' ? alegator(s) : 1 - alegator(s));

    function pune(s, p, car, slot, t) {
      const id = s.perechi[s.runda][car];
      s.boards[p][slot] = id;
      s.ultim = { p, slot, id, pts: points(ATTRS.find(a => a.key === slot), DUPA_ID.get(id)) };
      if (s.faza === 'alege') {
        s.luata = car;
        s.faza = 'pune';
        s.termen = t + MS.pune;
        return;
      }
      s.runda++;
      s.luata = null;
      if (s.runda >= RUNDE) { final(s); return; }
      s.faza = 'alege';
      s.termen = t + MS.alege;
    }
    function final(s) {
      const tot = [0, 1].map(p => ATTRS.reduce((sum, a) => sum + points(a, DUPA_ID.get(s.boards[p][a.key])), 0));
      const max = [0, 1].map(p => maxPosibil(ATTRS.map(a => DUPA_ID.get(s.boards[p][a.key]))));
      // ca pe un telefon: se compară notele așa cum se văd, cu o zecimală
      const nota = tot.map(x => Math.round(x / ATTRS.length));
      s.rezultat = { tot, max, nota, win: nota[0] === nota[1] ? -1 : nota[0] > nota[1] ? 0 : 1 };
      s.faza = 'final';
      s.termen = null;
    }
    const primulLiber = (s, p) => ATTRS.find(a => s.boards[p][a.key] == null).key;

    function avanseaza(s, acum) {
      let schimbat = false;
      for (let pasi = 0; s.termen != null && s.termen <= acum && pasi < 100; pasi++) {
        const t = s.termen;
        schimbat = true;
        if (s.faza === 'intro') { s.faza = 'alege'; s.termen = t + MS.alege; }
        else if (s.faza === 'alege') pune(s, alegator(s), 0, primulLiber(s, alegator(s)), t);
        else if (s.faza === 'pune') pune(s, 1 - alegator(s), 1 - s.luata, primulLiber(s, 1 - alegator(s)), t);
        else s.termen = null;
      }
      return schimbat;
    }

    function muta(s, p, m, acum) {
      if (m.tip !== 'pune') return 'mutare';
      if ((s.faza !== 'alege' && s.faza !== 'pune') || randul(s) !== p) return 'tura';
      if (!ATTRS.some(a => a.key === m.slot) || s.boards[p][m.slot] != null) return 'slot';
      const car = s.faza === 'alege' ? m.car : 1 - s.luata;
      if (car !== 0 && car !== 1) return 'masina';
      pune(s, p, car, m.slot, acum);
      return null;
    }

    function vedere(s) {
      const v = JSON.parse(JSON.stringify(s));
      v.pereche = s.faza === 'final' ? null : s.perechi[Math.min(s.runda, RUNDE - 1)];
      delete v.perechi;
      v.runde = RUNDE;
      v.randul = s.faza === 'alege' || s.faza === 'pune' ? randul(s) : null;
      return v;
    }

    return { CARS, DUPA_ID, RUNDE, MS, noua, avanseaza, muta, vedere, maxPosibil };
  }

  globalThis.DraftModel = { MS, creeaza };
})();
