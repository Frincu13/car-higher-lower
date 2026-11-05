// Ecranele mari. Site-ul e desenat în pixeli, deci pe un 4K la 100% totul ieșea
// cât un timbru într-un ecran gol. Aici îl mărim întreg, la fel cum face Windows
// când pui scalare de 150%: pagina se vede ca pe un ecran de cel puțin 1440x900,
// doar mai clară. Sub mărimea asta (laptopuri, tablete, telefoane) nu se schimbă
// nimic. Pe ultrawide mărirea o dă înălțimea, deci rămâne pagina lată, iar fiecare
// ecran își ține conținutul la mijloc.
//
// Unitățile de ecran (vh, vw) se măresc și ele, deci în CSS stau împărțite la
// --z: altfel un ecran de joc de 100vh ar ieși de două ori mai înalt decât fereastra.
// Stă în <head>, ca pagina să apară direct la mărimea ei, fără să sară.
(() => {
  'use strict';
  const LAT = 1440, INALT = 900, MAX = 3;
  const html = document.documentElement;
  let merge = true;
  function aplica() {
    const z = merge ? Math.round(Math.max(1, Math.min(innerWidth / LAT, innerHeight / INALT, MAX)) * 100) / 100 : 1;
    if (z === window.FRQ_Z) return;
    window.FRQ_Z = z;
    html.style.zoom = z === 1 ? '' : z;
    html.style.setProperty('--z', z);
    if (z === 1) return;
    // Un browser care mărește altfel unitățile de ecran ar strica toate ecranele de
    // joc. Măsurăm o dată și, dacă nu iese fix fereastra, rămânem la mărimea normală.
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:calc(100vh / var(--z));visibility:hidden;pointer-events:none';
    html.appendChild(p);
    const h = p.getBoundingClientRect().height;
    p.remove();
    if (Math.abs(h - innerHeight) > 2) { merge = false; aplica(); }
  }
  aplica();
  addEventListener('resize', aplica);
  // pentru codul care pune pe ecran poziții citite cu getBoundingClientRect
  window.FRQ_ecran = { z: () => window.FRQ_Z || 1, lat: () => innerWidth / (window.FRQ_Z || 1), inalt: () => innerHeight / (window.FRQ_Z || 1) };
})();
