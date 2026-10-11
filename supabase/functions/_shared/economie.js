// Economia jocurilor FRQ: moneda (mil.), lăzile din Garajul meu și recompensele.
// Aceleași cifre le folosesc pagina și funcțiile de pe server; banii și mașinile
// le mută doar serverul. Se încarcă și ca script (window.Economie), și ca modul.
//
// Lăzi ieftine, deschise multe (alegerea din 2026-10-11): un jucător ocazional (5
// zile pe săptămână: provocările, misiunile, câteva partide) strânge toate mașinile
// în vreo 2 luni, unul zilnic în vreo o lună. Primele 80% din fiecare raritate vin
// fără dubluri; restul la întâmplare, iar dublurile le vinzi sau le faci puncte de
// upgrade (tuningul se plătește în puncte). Așa a ieșit din simularea colecției.
// De unde vin banii (doar din jocurile online, verificate de server): 30 mil. și două
// lăzi la primul cont; 10 mil. pe fiecare Provocare a zilei (o dată pe zi și joc) și o
// ladă Stradă la prima; seria de zile (+1 mil. pe zi de serie, cel mult 10; o zi
// lipsă nu o rupe); 3 misiuni pe zi (5-15 mil.); partidele cu cronometru și
// victoriile cu un prieten (cel mult 40 mil. pe zi, împreună); premiile săptămânii
// (150 / 100 / 60); seturile complete din colecție.
// Unde se duc: lăzi, tuning, Vitrina (exact mașina care îți lipsește), comisionul
// duelurilor (10%) și cel al Cupei de duminică (10% din pot).
// Între jucători: duelurile și Cupa de duminică (intrare 30 mil., potul la primii 3).
// Un jucător ocazional strânge cam 80 mil. pe zi activă, unul zilnic 110-140.
(() => {
  'use strict';

  const RARITATI = ['Comună', 'Rară', 'Epică', 'Exotică', 'Legendară'];
  // Aceleași lăzi și șanse ca în Startul, la prețuri de garaj (în Startul banii sunt
  // doar ai meciului). O ladă, o mașină. Fără dubluri până ai 80% din raritatea care
  // a ieșit (PROTECTIE); după aceea, la întâmplare din toată raritatea.
  const LAZI = [
    { id: 'strada', nume: 'Stradă', pret: 1, sanse: [55, 35, 10, 0, 0] },
    { id: 'sport', nume: 'Sport', pret: 2, sanse: [20, 40, 30, 9, 1] },
    { id: 'super', nume: 'Supercar', pret: 4, sanse: [0, 15, 40, 35, 10] },
    { id: 'hyper', nume: 'Hypercar', pret: 8, sanse: [0, 0, 25, 45, 30] },
    // Lăzi cu temă: doar mașini din tema lor (TEME). Șansele se împart doar între
    // raritățile pe care tema le are (JDM n-are legendare, deci restul cresc).
    ...[['jdm', 'JDM'], ['sua', 'Americane'], ['italia', 'Italiene'], ['anglia', 'Britanice'], ['germania', 'Nemțești'], ['electrice', 'Electrice']]
      .map(([id, nume]) => ({ id, nume, pret: 3, sanse: [30, 35, 22, 10, 3], tema: id })),
  ];
  // Temele, după marcă (primul cuvânt din nume) sau, la electrice, după motor.
  const marca = c => String(c.name).split(' ')[0].toLowerCase();
  const MARCI = {
    jdm: ['toyota', 'nissan', 'honda', 'mazda', 'mitsubishi', 'subaru', 'acura', 'lexus', 'suzuki'],
    sua: ['ford', 'chevrolet', 'dodge', 'pontiac', 'shelby', 'cadillac', 'chrysler', 'hennessey', 'gmc', 'ram', 'jeep', 'hummer', 'tesla', 'lucid', 'rivian', 'czinger'],
    italia: ['ferrari', 'lamborghini', 'maserati', 'alfa', 'pagani', 'abarth', 'lancia', 'automobili', 'de'],
    anglia: ['aston', 'mclaren', 'jaguar', 'bentley', 'land', 'lotus', 'rolls-royce', 'mini', 'ariel', 'bac', 'tvr', 'gordon', 'mg', 'vauxhall'],
    germania: ['porsche', 'bmw', 'audi', 'mercedes-benz', 'mercedes-amg', 'mercedes-maybach', 'volkswagen', 'opel', 'apollo'],
  };
  const inTema = (tema, c) => (tema === 'electrice' ? globalThis.DragModel.electrica(c) : MARCI[tema].includes(marca(c)));
  // mașinile pe care le poate da o ladă, pe rarități, și șansele ei reale (în %)
  const peRaritateLada = (lada, peRaritate) => (lada.tema ? peRaritate.map(l => l.filter(c => inTema(lada.tema, c))) : peRaritate);
  function sanseLada(lada, peRaritate) {
    const pr = peRaritateLada(lada, peRaritate);
    const s = lada.sanse.map((x, r) => (pr[r].length ? x : 0)), tot = s.reduce((a, b) => a + b, 0);
    return s.map(x => (x * 100) / tot);
  }
  const PROTECTIE = 0.8;
  // O dublură: o vinzi cu atât (după raritate) sau o faci un punct de upgrade. Uneori
  // peste prețul lăzii (o exotică dublă din Supercar, o legendară din Hypercar), dar
  // în medie sub el (0,55 / 1,57 / 3,9 / 6,35 mil. pe ladă), ca lăzile să nu devină o
  // mașină de făcut bani. O comună în plus nu se vinde: e doar un punct.
  const VALOARE_DUBLURA = [0, 1, 2, 5, 12];
  // Recompensa unui set complet se socotește din valorile astea (cele dinainte de
  // ieftinirea lăzilor), ca seturile să rămână o țintă care merită.
  const VALOARE_SET = [1, 2, 4, 8, 20];
  // Vitrina: exact mașina care îți lipsește, după raritate. Mai scump decât o ladă,
  // dar sigur (pentru seturi sau ultimele mașini).
  const VITRINA = [2, 5, 12, 27, 57];
  // Tuning pe piese (Anvelope, Ușurare, Motor, Cutie; ce face fiecare: drag-model.js).
  // Anvelopele, Ușurarea și Cutia: în puncte de aceeași raritate cu mașina (din
  // dubluri); nivelul n costă 2n puncte: 2, 4, 6, 8, 10, deci 30 pe piesă până la 5.
  // Motorul (`peBani`): în mil., după raritate; nivelul n costă n ori pasul, deci
  // până la 5: 45 mil. o comună, 300 o legendară.
  const TUNING = {
    max: 5, puncte: nivel => 2 * (nivel + 1),
    peBani: [2], mil: (raritate, nivel) => [3, 5, 8, 12, 20][raritate] * (nivel + 1),
  };
  const RECOMPENSE = {
    bunVenit: { mil: 30, lazi: 2 },
    provocare: 10,       // pe fiecare Provocare a zilei terminată, o dată pe zi și joc
    primaZi: { lazi: 1 }, // la prima provocare a zilei
    serie: n => Math.min(Math.max(n, 0), 10),   // +1 mil. pe zi de serie, cel mult 10
  };
  // Banii din joc: partidele cu cronometru după scor și victoriile cu un prieten
  // (camere, cursa live). Împreună, cel mult `plafon` pe zi.
  const CASTIG = {
    plafon: 40,
    partida: (joc, scor) => (joc === 'sus-sau-jos' ? Math.floor(scor / 2) : joc === 'ordine' ? scor : 0),
    victorie: 10,
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
    ssj6: { text: 'Fă cel puțin 6 în Sus sau jos, cu cronometru', tip: 'ssj', n: 6, mil: 8, link: 'sus-sau-jos.html?online' },
    ssj10: { text: 'Fă cel puțin 10 în Sus sau jos, cu cronometru', tip: 'ssj', n: 10, mil: 12, link: 'sus-sau-jos.html?online' },
    ord5: { text: 'Pune 5 mașini la locul lor în În ordine, cu cronometru', tip: 'ord', n: 5, mil: 8, link: 'ordine.html?online' },
    ord8: { text: 'Pune 8 mașini la locul lor în În ordine, cu cronometru', tip: 'ord', n: 8, mil: 12, link: 'ordine.html?online' },
    partide3: { text: 'Joacă 3 partide cu cronometru', tip: 'partide', n: 3, mil: 6, link: 'sus-sau-jos.html?online' },
    partide5: { text: 'Joacă 5 partide cu cronometru', tip: 'partide', n: 5, mil: 10, link: 'ordine.html?online' },
    lada: { text: 'Deschide 3 lăzi', tip: 'lazi', n: 3, mil: 5, link: 'colectie.html#lazi' },
    cursa: { text: 'Termină Cursa zilei', tip: 'cursa', n: 1, mil: 8, link: 'drag.html?online' },
    rapid: { text: 'Aleargă un duel rapid', tip: 'rapid', n: 1, mil: 10, link: 'drag.html?online' },
    castig: { text: 'Câștigă un duel rapid', tip: 'castig', n: 1, mil: 15, link: 'drag.html?online' },
  };
  const GRUPE_MISIUNI = [['ssj6', 'ssj10', 'ord5', 'ord8'], ['partide3', 'partide5', 'lada', 'cursa'], ['rapid', 'rapid', 'castig']];
  const misiuniZi = data => GRUPE_MISIUNI.map((g, i) => g[hash(`misiuni|${data}|${i}`) % g.length]);

  // ---------- premiile săptămânii (clasamentele cu cronometru) ----------
  // Sus sau jos pe Mixt; În ordine pe categoria săptămânii. Se plătesc luni, dacă
  // au jucat măcar 5 oameni în săptămâna aceea.
  const SAPTAMANA = {
    premii: [150, 100, 60],
    minim: 5,
    jocuri: ['sus-sau-jos', 'ordine'],
    cat: (joc, lunea) => (joc === 'sus-sau-jos' ? 'mix' : ['hp', 'weight', 'accel'][hash(`saptamana|${lunea}`) % 3]),
  };

  // ---------- Cupa de duminică (Startul) ----------
  // Aceeași mașină pentru toți, trei încercări, contează cel mai bun timp. Fără
  // intrare: oricine aleargă primește `participare`, primii trei `premii`; locul 1 ia
  // și mașina cupei, locul 2 o ladă (`lada`) deschisă pe loc.
  const CUPA = { incercari: 3, participare: 5, premii: [150, 100, 60], lada: 'super' };

  // Rezultatul unei lăzi: raritatea după șanse, apoi o mașină din raritatea aceea.
  // `aleator` e o funcție care dă un număr în [0, 1); pe server e criptografică.
  // Cu `are` (mașina -> o ai deja?), până ai 80% din raritatea ieșită mașina vine
  // dintre cele care îți lipsesc; după aceea, din toată raritatea (poate fi dublură).
  function trage(lada, peRaritate, aleator, are) {
    const pr = peRaritateLada(lada, peRaritate), sanse = sanseLada(lada, peRaritate);
    let x = aleator() * 100, r = 0;
    while (r < 4 && x >= sanse[r]) { x -= sanse[r]; r++; }
    while (!sanse[r]) r--;
    const toata = pr[r];
    const lipsa = are ? toata.filter(c => !are(c)) : [];
    const protejat = lipsa.length && toata.length - lipsa.length < PROTECTIE * toata.length;
    const lista = protejat ? lipsa : toata;
    return { raritate: r, car: lista[Math.floor(aleator() * lista.length)] };
  }

  globalThis.Economie = {
    RARITATI, LAZI, PROTECTIE, VALOARE_DUBLURA, VALOARE_SET, VITRINA, TUNING, RECOMPENSE, CASTIG, JOCURI_ZI, mil, trage, sanseLada, peRaritateLada,
    ziua, laData, ziDinSaptamana, luni, hash, MISIUNI, misiuniZi, SAPTAMANA, CUPA,
  };
})();
