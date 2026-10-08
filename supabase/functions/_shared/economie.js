// Economia jocurilor FRQ: moneda (mil.), lăzile din Garajul meu și recompensele.
// Aceleași cifre le folosesc pagina și funcțiile de pe server; banii și mașinile
// le mută doar serverul. Se încarcă și ca script (window.Economie), și ca modul.
//
// De unde vin banii (doar din joc, cu limite pe zi): 10 mil. și o ladă la primul
// cont; 2 mil. pe fiecare Provocare a zilei (o dată pe zi și joc); o ladă Stradă la
// prima provocare a zilei; seria de zile (3 mil. la 3 zile, 10 la fiecare 7, 50 la
// 30); 3 misiuni pe zi (1-3 mil. fiecare); premiile săptămânale din clasamentele cu
// cronometru (25 / 15 / 10 mil.); seturile complete din colecție.
// Unde se duc: lăzi, tuning, Vitrina (exact mașina care îți lipsește), comisionul
// duelurilor (10%) și cel al Cupei de duminică (10% din pot).
// Între jucători: duelurile și Cupa de duminică (intrare 10 mil., potul la primii 3).
// Ținta: cine joacă zilnic tot strânge cam 13 mil. pe zi.
(() => {
  'use strict';

  const RARITATI = ['Comună', 'Rară', 'Epică', 'Exotică', 'Legendară'];
  // Aceleași lăzi și șanse ca în Startul, la prețuri de garaj (în Startul banii sunt
  // doar ai meciului).
  const LAZI = [
    { id: 'strada', nume: 'Stradă', pret: 2, sanse: [55, 35, 10, 0, 0] },
    { id: 'sport', nume: 'Sport', pret: 5, sanse: [20, 40, 30, 9, 1] },
    { id: 'super', nume: 'Supercar', pret: 12, sanse: [0, 15, 40, 35, 10] },
    { id: 'hyper', nume: 'Hypercar', pret: 25, sanse: [0, 0, 25, 45, 30] },
  ];
  // O mașină pe care o ai deja se vinde pe loc cu atât, după raritate.
  const VALOARE_DUBLURA = [1, 2, 4, 8, 20];
  // Vitrina: exact mașina care îți lipsește, după raritate. Mai scump decât o ladă,
  // dar sigur: o legendară anume te costă cel mult 160 mil.
  const VITRINA = [5, 12, 30, 70, 160];
  // Tuning: nivelul următor costă cât baza rarității înmulțită cu nivelul la care
  // ajungi. Până la nivelul 5: 30 mil. o comună, 180 o legendară.
  const TUNING = { max: 5, baza: [2, 3, 5, 8, 12], pret: (raritate, nivel) => [2, 3, 5, 8, 12][raritate] * (nivel + 1) };
  const RECOMPENSE = {
    bunVenit: { mil: 10, lazi: 1 },
    provocare: 2,        // pe fiecare Provocare a zilei terminată, o dată pe zi și joc
    primaZi: { lazi: 1 }, // la prima provocare a zilei
    serie: n => (n === 30 ? 50 : n === 3 ? 3 : n >= 7 && n % 7 === 0 ? 10 : 0),
  };
  const JOCURI_ZI = ['startul', 'sus-sau-jos', 'ordine'];
  const mil = n => `${n} mil.`;

  // ---------- ziua și săptămâna, pe ora României (la fel pe telefon și pe server) ----------
  const FORMAT_ZI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' });
  const ziua = (ms = Date.now()) => FORMAT_ZI.format(new Date(ms));
  const laData = (data, zile) => { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + zile); return d.toISOString().slice(0, 10); };
  const ziDinSaptamana = data => new Date(`${data}T12:00:00Z`).getUTCDay();   // 0 = duminică
  const luni = data => laData(data, -((ziDinSaptamana(data) + 6) % 7));
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---------- misiunile zilei ----------
  // Trei pe zi, aceleași pentru toți: una de joc (Sus sau jos / În ordine), una de
  // rutină și una de duel. Progresul îl socotește serverul din ce s-a jucat azi.
  const MISIUNI = {
    ssj6: { text: 'Fă cel puțin 6 în Sus sau jos, cu cronometru', tip: 'ssj', n: 6, mil: 2, link: 'sus-sau-jos.html?online' },
    ssj10: { text: 'Fă cel puțin 10 în Sus sau jos, cu cronometru', tip: 'ssj', n: 10, mil: 3, link: 'sus-sau-jos.html?online' },
    ord5: { text: 'Pune 5 mașini la locul lor în În ordine, cu cronometru', tip: 'ord', n: 5, mil: 2, link: 'ordine.html?online' },
    ord8: { text: 'Pune 8 mașini la locul lor în În ordine, cu cronometru', tip: 'ord', n: 8, mil: 3, link: 'ordine.html?online' },
    partide3: { text: 'Joacă 3 partide cu cronometru', tip: 'partide', n: 3, mil: 1, link: 'sus-sau-jos.html?online' },
    partide5: { text: 'Joacă 5 partide cu cronometru', tip: 'partide', n: 5, mil: 2, link: 'ordine.html?online' },
    lada: { text: 'Deschide o ladă', tip: 'lazi', n: 1, mil: 1, link: 'colectie.html' },
    cursa: { text: 'Termină Cursa zilei', tip: 'cursa', n: 1, mil: 1, link: 'drag.html?online' },
    rapid: { text: 'Aleargă un duel rapid', tip: 'rapid', n: 1, mil: 2, link: 'drag.html?online' },
    castig: { text: 'Câștigă un duel rapid', tip: 'castig', n: 1, mil: 3, link: 'drag.html?online' },
  };
  const GRUPE_MISIUNI = [['ssj6', 'ssj10', 'ord5', 'ord8'], ['partide3', 'partide5', 'lada', 'cursa'], ['rapid', 'rapid', 'castig']];
  const misiuniZi = data => GRUPE_MISIUNI.map((g, i) => g[hash(`misiuni|${data}|${i}`) % g.length]);

  // ---------- premiile săptămânii (clasamentele cu cronometru) ----------
  // Sus sau jos pe Mixt; În ordine pe categoria săptămânii. Se plătesc luni, dacă
  // au jucat măcar 5 oameni în săptămâna aceea.
  const SAPTAMANA = {
    premii: [25, 15, 10],
    minim: 5,
    jocuri: ['sus-sau-jos', 'ordine'],
    cat: (joc, lunea) => (joc === 'sus-sau-jos' ? 'mix' : ['hp', 'weight', 'accel'][hash(`saptamana|${lunea}`) % 3]),
  };

  // ---------- Cupa de duminică (Startul) ----------
  // Aceeași mașină pentru toți, trei încercări, contează cel mai bun timp. Potul
  // (intrările minus 10%) se împarte primilor trei; sub 4 jucători, intrarea se
  // întoarce la toți.
  const CUPA = { intrare: 10, incercari: 3, impartire: [50, 30, 20], minim: 4, comision: 0.1 };
  const potCupa = inscrisi => Math.floor(inscrisi * CUPA.intrare * (1 - CUPA.comision));

  // Rezultatul unei lăzi: raritatea după șanse, apoi o mașină din raritatea aceea.
  // `aleator` e o funcție care dă un număr în [0, 1); pe server e criptografică.
  function trage(lada, peRaritate, aleator) {
    let x = aleator() * 100, r = 0;
    while (r < 4 && x >= lada.sanse[r]) { x -= lada.sanse[r]; r++; }
    while (!lada.sanse[r]) r--;
    const lista = peRaritate[r];
    return { raritate: r, car: lista[Math.floor(aleator() * lista.length)] };
  }

  globalThis.Economie = {
    RARITATI, LAZI, VALOARE_DUBLURA, VITRINA, TUNING, RECOMPENSE, JOCURI_ZI, mil, trage,
    ziua, laData, ziDinSaptamana, luni, hash, MISIUNI, misiuniZi, SAPTAMANA, CUPA, potCupa,
  };
})();
