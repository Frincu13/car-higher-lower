// Economia jocurilor FRQ: moneda (mil.), lăzile din Garajul meu și recompensele.
// Aceleași cifre le folosesc pagina și funcțiile de pe server; banii și mașinile
// le mută doar serverul. Se încarcă și ca script (window.Economie), și ca modul.
//
// Ce câștigi: 10 mil. și o ladă gratis la primul cont; la fiecare Provocare a zilei
// terminată 2 mil. (o dată pe zi și joc); la prima provocare a zilei o ladă Stradă
// gratis; pentru serie (zile la rând cu măcar o provocare) 3 mil. la 3 zile, 10 la 7,
// apoi 10 la fiecare săptămână în plus și 50 la 30. Așa, cineva care joacă zilnic
// toate trei strânge cam 6-8 mil. pe zi: o ladă Supercar la două zile, una Hypercar
// la patru, iar garajul întreg (685 de mașini) e o treabă de luni, nu de o seară.
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
  const RECOMPENSE = {
    bunVenit: { mil: 10, lazi: 1 },
    provocare: 2,        // pe fiecare Provocare a zilei terminată, o dată pe zi și joc
    primaZi: { lazi: 1 }, // la prima provocare a zilei
    serie: n => (n === 30 ? 50 : n === 3 ? 3 : n >= 7 && n % 7 === 0 ? 10 : 0),
  };
  const JOCURI_ZI = ['startul', 'sus-sau-jos', 'ordine'];
  const mil = n => `${n} mil.`;

  // Rezultatul unei lăzi: raritatea după șanse, apoi o mașină din raritatea aceea.
  // `aleator` e o funcție care dă un număr în [0, 1); pe server e criptografică.
  function trage(lada, peRaritate, aleator) {
    let x = aleator() * 100, r = 0;
    while (r < 4 && x >= lada.sanse[r]) { x -= lada.sanse[r]; r++; }
    while (!lada.sanse[r]) r--;
    const lista = peRaritate[r];
    return { raritate: r, car: lista[Math.floor(aleator() * lista.length)] };
  }

  globalThis.Economie = { RARITATI, LAZI, VALOARE_DUBLURA, RECOMPENSE, JOCURI_ZI, mil, trage };
})();
