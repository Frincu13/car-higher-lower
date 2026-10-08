// Seturile din Garajul meu: grupe de mașini (o marcă, o epocă, electricele) care,
// strânse toate, aduc o recompensă o singură dată. Le folosesc pagina și funcția
// `portofel` de pe server, din aceeași listă de mașini, deci ies identice.
// Se încarcă și ca script (window.Seturi), și ca modul (globalThis).
(() => {
  'use strict';

  // aceeași listă ca în shared.js (mărcile din mai multe cuvinte)
  const MARCI_LUNGI = ['Mercedes-Benz', 'Mercedes-AMG', 'Aston Martin', 'Alfa Romeo', 'Land Rover',
    'Range Rover', 'Rolls-Royce', 'De Tomaso'];
  const marca = n => MARCI_LUNGI.find(b => n.startsWith(b + ' ')) || n.split(' ')[0];
  const an = c => parseInt(String(c.years), 10) || 0;
  const JDM = ['toyota', 'nissan', 'honda', 'mazda', 'mitsubishi', 'subaru', 'acura', 'lexus', 'suzuki'];
  // mărcile mari se împart pe epoci, ca un set să fie o țintă, nu o colecție întreagă
  const MARE = 21;
  const EPOCI = [[0, 1999, 'până în 2000'], [2000, 2014, '2000-2014'], [2015, 9999, 'din 2015']];

  // `POOL`: mașinile din Startul; `rar(c)`: raritatea; `cheie(c)`: cheia din garaj;
  // `electrica(c)`; `dublura`: valoarea unei dubluri pe raritate.
  function creeaza(POOL, { rar, cheie, electrica, dublura }) {
    const seturi = [];
    const adauga = (id, nume, masini) => {
      if (masini.length < 4) return;
      const valoare = masini.reduce((s, c) => s + dublura[rar(c)], 0);
      seturi.push({
        id, nume,
        chei: masini.map(cheie),
        premiu: Math.max(10, Math.ceil((2 * valoare) / 5) * 5),
      });
    };
    // mărcile (SUBARU și Subaru sunt aceeași)
    const peMarca = new Map();
    for (const c of POOL) {
      const k = marca(c.name).toLowerCase();
      if (!peMarca.has(k)) peMarca.set(k, { nume: marca(c.name), masini: [] });
      peMarca.get(k).masini.push(c);
    }
    for (const [k, { nume, masini }] of [...peMarca].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (masini.length < MARE) { adauga(`marca:${k}`, nume, masini); continue; }
      for (const [de, pana, eticheta] of EPOCI) {
        adauga(`marca:${k}:${de}`, `${nume} ${eticheta}`, masini.filter(c => an(c) >= de && an(c) <= pana));
      }
    }
    // teme
    adauga('tema:electrice', 'Electrice', POOL.filter(electrica));
    adauga('tema:50-60', 'Anii ’50 și ’60', POOL.filter(c => an(c) >= 1950 && an(c) < 1970));
    adauga('tema:70', 'Anii ’70', POOL.filter(c => an(c) >= 1970 && an(c) < 1980));
    adauga('tema:80', 'Anii ’80', POOL.filter(c => an(c) >= 1980 && an(c) < 1990));
    adauga('tema:jdm90', 'JDM anii ’90', POOL.filter(c => an(c) >= 1990 && an(c) < 2000 && JDM.includes(marca(c.name).toLowerCase())));
    return seturi;
  }

  // Câte mașini din fiecare set ai; `are(cheie)` spune dacă e în garaj.
  const progres = (seturi, are) => seturi.map(s => ({ ...s, ai: s.chei.filter(are).length }));

  globalThis.Seturi = { creeaza, progres, marca };
})();
