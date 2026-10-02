// Machetele mașinilor, văzute din spate, ca dintr-o cameră care le urmărește pe
// pistă: roțile, bara, stopurile, luneta. Fiecare tip de mașină are silueta lui,
// iar caroseria ia culoarea jucătorului (--pc), cu umbre și lumini puse peste ea,
// deci aceeași machetă arată bine și roșie, și albă.
//
// Coordonatele: lățimea e în jur de 100, originea e jos la mijloc, pe asfalt, iar
// în sus e negativ. Cine o folosește o mută și o scalează cu un transform.
window.Machete = (() => {
  'use strict';

  const PICKUP = /\b(Silverado|F-1[05]0|F-[23]50|Raptor|Ram|Tundra|Hilux|Tacoma|Ranger|Gladiator|Colorado|Canyon|Sierra|Titan|Amarok|R1T|Cybertruck|Lightning|Pickup|Truck|Hoonitruck)\b/i;
  const TEREN = /\b(Wrangler|Defender|G ?\d{2,3}|G-Class|Bronco|Jimny|Samurai|FJ40|FJ Cruiser|Land Cruiser|Grenadier|Hummer|Patrol|4Runner|Scout|Unimog|Baja|Buggy|Class 1|Ultra4|Trophy)\b/;

  // Tipul machetei pornește de la categoriile din kinds.js și le mai desparte unde
  // silueta din spate chiar diferă: un Jimny nu arată ca un Cayenne, iar o Miura nu
  // arată ca un Mini din anii '60.
  function tip(c) {
    const K = window.Kinds;
    const k = K ? K.kindOf(c) : 'sport';
    if (k === 'suv') return TEREN.test(c.name) ? 'teren' : PICKUP.test(c.name) ? 'pickup' : 'suv';
    if (k === 'classic') {
      const seg = K.segOf(c);
      return seg === 'super' || seg === 'hyper' || (c.hp || 0) >= 280 ? 'clasicaSport' : 'clasica';
    }
    return k;
  }

  const R = (x, y, w, h, cls, rx) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}/>`;
  const C = (x, y, r, cls) => `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
  const P = (d, cls) => `<path class="${cls}" d="${d}"/>`;
  // ce e desenat în stânga se oglindește în dreapta
  const oglinda = s => `<g>${s}</g><g transform="scale(-1 1)">${s}</g>`;
  const numar = (x, y, w = 18, h = 5) => R(x, y, w, h, 'numar') + R(x, y, 2.4, h, 'numar-b');

  const M = {
    // Supercar: joasă și lată, cabina îngustă, bara de stopuri pe toată lățimea,
    // difuzor și evacuările în mijloc.
    super: {
      og: 'M-26 -34L-34 -35.5L-34 -31.5L-26 -31Z',
      l: 100, roti: [[-50, 15, 19], [35, 15, 19]],
      corp: 'M-47 -6L-50 -19Q-50 -27 -43 -29L-26 -31Q-19 -41 -10 -42L10 -42Q19 -41 26 -31L43 -29Q50 -27 50 -19L47 -6Z',
      det: P('M-17 -39L17 -39L22 -32L-22 -32Z', 'geam')
        + R(-15, -37, 30, 0.9, 'negru') + R(-17, -34.8, 34, 0.9, 'negru')
        + P('M-44 -27L44 -27L45 -20L-45 -20Z', 'negru') + R(-42, -25, 84, 2.2, 'stop')
        + oglinda(P('M-45 -18L-34 -18L-33 -12L-44 -11Z', 'negru'))
        + P('M-30 -6L30 -6L34 -16L-34 -16Z', 'negru')
        + [-20, -10, 10, 20].map(x => R(x - 0.6, -15, 1.2, 9, 'fin')).join('')
        + numar(-9, -19.6, 18, 4.4),
      evac: [[-6, -11, 3.4], [6, -11, 3.4]],
    },
    // Hypercar: aripa mare pe stâlpi, aripile roților și mai late, difuzor uriaș.
    hyper: {
      og: 'M-27 -34L-35 -35.5L-35 -31.5L-27 -31Z',
      l: 102, roti: [[-51, 16, 19], [35, 16, 19]],
      corp: 'M-46 -6L-50 -17Q-51 -27 -44 -30L-27 -31Q-20 -40 -9 -41L9 -41Q20 -40 27 -31L44 -30Q51 -27 50 -17L46 -6Z',
      det: P('M-16 -38L16 -38L21 -32L-21 -32Z', 'geam')
        + P('M-1 -41L1 -41L0.6 -50L-0.6 -50Z', 'corp')
        + oglinda(R(-16, -50, 2.4, 12, 'negru') + R(-47, -57, 3, 11, 'negru'))
        + P('M-45 -54L45 -54L46 -48L-46 -48Z', 'negru') + R(-44, -53.2, 88, 1, 'aripa')
        + P('M-45 -28L45 -28L46 -21L-46 -21Z', 'negru')
        + oglinda(R(-43, -26, 26, 2.6, 'stop'))
        + P('M-37 -6L37 -6L41 -18L-41 -18Z', 'negru')
        + [-27, -18, -9, 9, 18, 27].map(x => R(x - 0.6, -17, 1.2, 11, 'fin')).join(''),
      evac: [[0, -12, 4.6]],
    },
    // Sport (911, M2, R8 V8): coupé cu lunetă înclinată, eleron mic, stopuri
    // legate de o bandă subțire, patru evacuări.
    sport: {
      og: 'M-29 -37L-37 -38.5L-37 -34.5L-29 -34Z',
      l: 92, roti: [[-46, 13, 19], [33, 13, 19]],
      corp: 'M-43 -7L-46 -21Q-46 -30 -39 -32L-29 -33Q-23 -46 -12 -48L12 -48Q23 -46 29 -33L39 -32Q46 -30 46 -21L43 -7Z',
      det: P('M-20 -45L20 -45L25 -35L-25 -35Z', 'geam')
        + P('M-30 -34L30 -34L31 -31.5L-31 -31.5Z', 'negru')
        + oglinda(P('M-43 -29L-20 -29L-20 -24L-44 -24Z', 'negru') + R(-42, -28, 20, 3, 'stop'))
        + R(-20, -27.2, 40, 1, 'stop')
        + numar(-9, -21)
        + P('M-38 -7L38 -7L40 -13L-40 -13Z', 'negru'),
      evac: [[-31, -10.5, 2.6], [-25, -10.5, 2.6], [25, -10.5, 2.6], [31, -10.5, 2.6]],
    },
    // Sport de zi cu zi: hatchback sau berlină înaltă, eleron pe plafon, stopuri pe
    // colțuri.
    hot: {
      og: 'M-31 -40L-39 -41.5L-39 -37L-31 -36.5Z',
      l: 88, roti: [[-44, 12, 18], [32, 12, 18]],
      corp: 'M-41 -8L-44 -24Q-44 -32 -37 -34L-31 -35Q-28 -53 -19 -55L19 -55Q28 -53 31 -35L37 -34Q44 -32 44 -24L41 -8Z',
      det: P('M-24 -51L24 -51L28 -37L-28 -37Z', 'geam')
        + P('M-23 -57L23 -57L25 -52L-25 -52Z', 'negru') + R(-6, -56, 12, 1.2, 'stop')
        + oglinda(P('M-43 -34L-30 -35L-31 -27L-44 -26Z', 'negru') + P('M-42 -33L-32 -34L-32.6 -29L-42.6 -28Z', 'stop'))
        + numar(-9, -27)
        + P('M-37 -8L37 -8L39 -14L-39 -14Z', 'negru'),
      evac: [[-28, -11, 2.6], [28, -11, 2.6]],
    },
    // Lux & GT: portbagaj lung, bară de lumini pe toată lățimea, crom, evacuări late.
    lux: {
      og: 'M-30 -39L-38 -40.5L-38 -36.5L-30 -36Z',
      l: 96, roti: [[-47, 13, 18], [34, 13, 18]],
      corp: 'M-44 -8L-47 -23Q-47 -32 -39 -34L-30 -35Q-25 -50 -14 -52L14 -52Q25 -50 30 -35L39 -34Q47 -32 47 -23L44 -8Z',
      det: P('M-21 -49L21 -49L26 -37L-26 -37Z', 'geam')
        + P('M-44 -31L44 -31L45 -26L-45 -26Z', 'negru') + R(-43, -29.4, 86, 1.6, 'stop')
        + oglinda(R(-43, -30.2, 15, 3.4, 'stop'))
        + R(-30, -22.4, 60, 1.3, 'crom')
        + numar(-10, -20)
        + P('M-40 -8L40 -8L41 -13L-41 -13Z', 'negru') + R(-36, -9.6, 72, 1.1, 'crom'),
      evac: [[-31, -11.5, 3.6], [31, -11.5, 3.6]],
    },
    // SUV: înalt, garda la sol mare, roți mari, stopuri verticale, scut sub bară.
    suv: {
      og: 'M-38 -54L-47 -55.5L-47 -50.5L-38 -50Z',
      l: 96, roti: [[-48, 15, 25], [33, 15, 25]],
      corp: 'M-45 -15L-47 -38Q-47 -46 -40 -47L-38 -48Q-37 -70 -29 -72L29 -72Q37 -70 38 -48L40 -47Q47 -46 47 -38L45 -15Z',
      det: P('M-29 -68L29 -68L33 -51L-33 -51Z', 'geam')
        + P('M-30 -74L30 -74L31 -69L-31 -69Z', 'negru')
        + oglinda(R(-31, -76.5, 5, 2.2, 'negru') + P('M-46 -46L-36 -47L-36 -35L-46 -34Z', 'negru') + P('M-45 -45L-37 -46L-37 -37L-45 -36Z', 'stop'))
        + R(-36, -43, 72, 1.2, 'stop')
        + numar(-10, -36)
        + P('M-44 -15L44 -15L45 -25L-45 -25Z', 'negru') + P('M-22 -15L22 -15L20 -19.5L-20 -19.5Z', 'crom'),
      evac: [[-30, -17.5, 2.8], [30, -17.5, 2.8]],
    },
    // De teren (G-Class, Defender, Jimny): cutie, roata de rezervă pe ușă, portbagaj
    // pe plafon, stopuri mici jos, pe colțuri.
    teren: {
      og: 'M-37 -57L-47 -58L-47 -53L-37 -52.5Z',
      l: 94, roti: [[-47, 15, 26], [32, 15, 26]],
      corp: 'M-44 -15L-45 -48L-43 -50L-37 -51L-35 -74L35 -74L37 -51L43 -50L45 -48L44 -15Z',
      det: P('M-30 -71L30 -71L31 -54L-31 -54Z', 'geam')
        + R(-34, -78, 68, 3, 'negru') + oglinda(R(-30, -75, 2, 2, 'negru'))
        + C(0, -40, 12.5, 'anvelopa') + C(0, -40, 7, 'janta') + C(0, -40, 2.4, 'negru')
        + oglinda(R(-44, -34, 5, 12, 'negru') + R(-43.4, -33.2, 3.8, 10.4, 'stop'))
        + numar(-9, -26.5)
        + P('M-44 -15L44 -15L44 -21L-44 -21Z', 'negru'),
      evac: [[-28, -17.5, 2.6]],
    },
    // Pickup: oblonul jos și lat, cabina în spatele lui, mai sus și mai îngustă.
    pickup: {
      og: 'M-33 -55L-45 -56.5L-45 -50.5L-33 -50Z',
      l: 98, roti: [[-49, 15, 25], [34, 15, 25]],
      corp: 'M-46 -15L-47 -46L-34 -46L-33 -66Q-32 -71 -26 -72L26 -72Q32 -71 33 -66L34 -46L47 -46L46 -15Z',
      det: P('M-26 -68L26 -68L28 -54L-28 -54Z', 'geam') + R(-6, -71.2, 12, 1.2, 'stop')
        + oglinda(R(-47.5, -48, 14, 2.6, 'negru') + R(-47, -46, 5, 17, 'negru') + R(-46.4, -45.2, 3.8, 15.4, 'stop'))
        + R(-40, -41, 80, 0.8, 'negru') + R(-5, -38.5, 10, 2, 'negru')
        + numar(-9, -28)
        + P('M-46 -15L46 -15L46 -22L-46 -22Z', 'crom') + R(-12, -22, 24, 2.4, 'negru'),
      evac: [[-35, -13.5, 3]],
    },
    // Americană: lată și lungă, ducktail, stopul ca un inel pe toată lățimea și,
    // obligatoriu, dungile de curse.
    muscle: {
      og: 'M-30 -36L-38 -37.5L-38 -33.5L-30 -33Z',
      l: 100, roti: [[-50, 16, 19], [34, 16, 19]],
      corp: 'M-46 -7L-49 -22Q-49 -30 -42 -31L-30 -32Q-25 -45 -14 -46L14 -46Q25 -45 30 -32L42 -31Q49 -30 49 -22L46 -7Z',
      det: P('M-11 -46L-4 -46L-4 -7L-11 -7ZM4 -46L11 -46L11 -7L4 -7Z', 'dunga')
        + P('M-20 -43L20 -43L26 -34L-26 -34Z', 'geam')
        + P('M-33 -33.5L33 -33.5L34 -30.5L-34 -30.5Z', 'negru')
        + P('M-43 -29L43 -29L44 -21L-44 -21Z', 'negru')
        + R(-42, -28, 84, 1.6, 'stop') + R(-42, -23.6, 84, 1.6, 'stop') + oglinda(R(-42, -28, 1.6, 6, 'stop'))
        + R(-4, -26, 8, 2, 'crom')
        + numar(-9, -18.5)
        + P('M-40 -7L40 -7L42 -12L-42 -12Z', 'negru'),
      evac: [[-37, -10, 3.4], [37, -10, 3.4]],
    },
    // Clasică: forme rotunde, luneta curbată, stopuri rotunde, bară cromată.
    clasica: {
      og: 'M-29 -38L-34 -39L-34 -36L-29 -35.5Z',
      l: 88, roti: [[-43, 11, 18], [32, 11, 18]],
      corp: 'M-40 -11L-43 -22Q-44 -31 -36 -33L-29 -34Q-26 -50 -15 -52L15 -52Q26 -50 29 -34L36 -33Q44 -31 43 -22L40 -11Z',
      det: P('M-20 -48Q0 -50 20 -48L24 -37Q0 -35.5 -24 -37Z', 'geam')
        + R(-24, -31, 48, 0.8, 'negru')
        + oglinda(C(-36, -26, 4.2, 'negru') + C(-36, -26, 3.1, 'stop') + C(-27.5, -26, 3.4, 'negru') + C(-27.5, -26, 2.4, 'stop'))
        + numar(-9, -21.5)
        + P('M-44 -9L44 -9Q46.5 -12 44 -15L-44 -15Q-46.5 -12 -44 -9Z', 'crom'),
      evac: [[-26, -7.5, 2.4]],
    },
    // Sportivă clasică (Miura, Pantera, Stratos): joasă, lamele pe lunetă, patru
    // stopuri rotunde, bară subțire.
    clasicaSport: {
      og: 'M-27 -34L-33 -35L-33 -32L-27 -31.5Z',
      l: 94, roti: [[-47, 14, 18], [33, 14, 18]],
      corp: 'M-43 -8L-46 -19Q-47 -28 -39 -30L-27 -31Q-21 -42 -11 -43L11 -43Q21 -42 27 -31L39 -30Q47 -28 46 -19L43 -8Z',
      det: P('M-17 -40L17 -40L22 -32L-22 -32Z', 'geam')
        + [-38.4, -36.2, -34, -31.8].map(y => R(-19, y, 38, 0.9, 'corp')).join('')
        + P('M-42 -28L42 -28L43 -18L-43 -18Z', 'negru')
        + oglinda(C(-36, -23, 3.4, 'stop') + C(-27, -23, 3.4, 'stop'))
        + numar(-9, -25.5)
        + R(-44, -12.5, 88, 2, 'crom'),
      evac: [[-12, -10, 2.8], [-5, -10, 2.8], [5, -10, 2.8], [12, -10, 2.8]],
    },
  };

  // Gradientele comune: umbra și lumina peste caroseria colorată, sticla, cromul,
  // cauciucul. Intră o dată în <defs>-ul desenului care le folosește.
  const DEFS = `
    <linearGradient id="mch-sh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </linearGradient>
    <linearGradient id="mch-lat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".18" stop-color="#000" stop-opacity="0"/>
      <stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/>
    </linearGradient>
    <linearGradient id="mch-geam" x1="0" y1="0" x2=".35" y2="1">
      <stop offset="0" stop-color="#3a4558"/><stop offset=".45" stop-color="#121722"/><stop offset="1" stop-color="#050608"/>
    </linearGradient>
    <linearGradient id="mch-crom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6f6f6"/><stop offset=".5" stop-color="#83868d"/><stop offset="1" stop-color="#d9dadd"/>
    </linearGradient>
    <linearGradient id="mch-anv" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#2b2b30"/><stop offset="1" stop-color="#000"/>
    </linearGradient>`;

  function svg(t) {
    const m = M[t] || M.sport;
    return `<ellipse class="mch-umbra" cx="0" cy="-1" rx="${m.l * 0.56}" ry="5"/>`
      + m.roti.map(([x, w, h]) => R(x, -h, w, h, 'anvelopa', 2.5) + R(x + 1, -h + 2, w - 2, 1.2, 'calc')).join('')
      // oglinzile sunt mai în față, deci stau în spatele caroseriei
      + (m.og ? oglinda(P(m.og, 'corp') + P(m.og, 'corp-sh')) : '')
      + P(m.corp, 'corp') + P(m.corp, 'corp-sh') + P(m.corp, 'corp-lat')
      + m.det
      + m.evac.map(([x, y, r]) => `<ellipse class="evac" cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.72).toFixed(2)}"/>`).join('')
      + m.evac.map(([x, y, r]) => `<g class="flama"><ellipse cx="${x}" cy="${y}" rx="${r * 1.9}" ry="${r * 1.5}"/><ellipse class="miez" cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}"/></g>`).join('');
  }

  return { tip, svg, DEFS, TIPURI: Object.keys(M) };
})();
