// Modelul cursei din Startul, fără nimic de ecran: mașinile, profilul de viteză,
// nota fiecărei apăsări și simularea. Îl folosesc și jocul, și funcția de pe server
// (Supabase) care reface fiecare cursă trimisă la clasament din apăsările ei: același
// cod, deci același timp. Se încarcă și ca script obișnuit (window.DragModel), și ca
// modul (import pentru efect, apoi globalThis.DragModel).
(() => {
  'use strict';

  // ---------- mașinile ----------
  // Ținta: o cursă perfectă dă exact ce măsoară revistele (Car and Driver, Motor Trend,
  // MotorWeek, Road & Track) pentru mașina aceea. Formulele de mai jos sunt potrivite
  // pe media testelor instrumentate a 26 de mașini, de la Mazda MX-5 (14,6 s pe 1/4)
  // la Bugatti Chiron (9,4 s), plus 5 electrice; detaliile sunt în README.

  // O mașină electrică: datele nu spun mereu că e electrică (la Lotus Evija scrie doar
  // „AWD", la Mach-E sau Spectre nu scrie nimic, la Tesla Roadster scrie „1AT"), de
  // aici și lista de nume. iX și Polestar doar scrise exact așa: „Lancer Evolution IX"
  // și Volvo-urile Polestar pe benzină nu sunt electrice.
  const ELECTRICE = /\b(Evija|Mach-E|Rivian|Spectre|Tesla|Taycan|Nevera|Lucid|IONIQ|EV6|e-tron GT|Cyberster|HUMMER EV|Battista|EP9|i4|I-Pace|Enyaq|Macan Turbo Electric)\b/i;
  const electrica = c => /electric|kwh|induction|\b1\s*AT\b/i.test(c.engine || '') || ELECTRICE.test(c.name) || /\biX\b|^Polestar\b/.test(c.name);

  // 0-100 din date: oficial unde există, altfel estimat. La câteva mașini estimarea era
  // departe de realitate (Taycan Turbo S: 4,0 s estimat, 2,8 s oficial și în teste),
  // așa că punem valoarea verificată: la electrice cea oficială, confirmată de teste;
  // la celelalte media testelor (0-60 mph cu rollout + 0,35 s, cât fac în medie
  // primul picior de pistă și ultimii 3 km/h).
  const ACC_VERIFICAT = {
    'Porsche Taycan Turbo S|2020': 2.8, 'Audi RS e-tron GT|2021': 3.3, 'MG Cyberster|2023': 3.2,
    'Lucid Air Sapphire|2023': 2.2, 'Rivian R1T|2022': 3.5, 'GMC HUMMER EV Pickup|2022': 3.6,
    'Toyota GR Supra|2020': 4.15, 'Ford Mustang GT|2018': 4.35, 'Ford Mustang GT|2024': 4.3,
    'Ford F-150 Raptor R|2023': 4.0, 'Audi RS 6 Avant|2021': 3.5, 'Lamborghini Huracán EVO|2020': 2.85,
    'Toyota GR86|2022': 6.4, 'Volkswagen Golf R|2014': 5.15, 'Cadillac Escalade-V|2023': 4.8,
  };
  const t100 = c => ACC_VERIFICAT[`${c.name.normalize('NFC')}|${c.years}`] ?? (c.accel != null ? c.accel : c.accelEst);
  const lbhp = c => (c.weight * 2.2046) / c.hp;

  // Timpul pe 1/4 de milă al unei curse perfecte. Pe benzină: din putere/greutate și
  // 0-100 (care aduce tracțiunea), potrivit prin cele mai mici pătrate: eroare medie
  // 0,31 s față de teste. Electricele pleacă mult mai tare și trag mai slab spre
  // final, deci la ele contează aproape numai 0-100: 0-60 în teste e cam 0-100
  // oficial minus 0,25 s, iar 1/4 vine din 0-60 ca la celelalte, plus 0,15 s.
  const baza = c => (electrica(c)
    ? (t100(c) + 5.424) / 0.784 + 0.15
    : 2.872 + 3.781 * Math.cbrt(lbhp(c)) + 0.367 * t100(c));
  // Pe un sfert de milă nu se ajunge de obicei în ultimele trepte: trepte minus două,
  // între trei și cinci schimbări. Cine nu are cutia în date primește patru. O
  // electrică n-are trepte: are trei Boost-uri, care se joacă la fel.
  function schimbari(c) {
    if (electrica(c)) return 3;
    const m = /(\d+)\s*(MT|AT|DCT|SMG|PDK|DSG|AMT|speed)/i.exec(c.engine || '');
    return m ? Math.max(3, Math.min(5, +m[1] - 2)) : 4;
  }

  // Profilul de viteză al fiecărei mașini, pe timpul unei curse perfecte (u de la 0 la
  // 1). Trece prin puncte reale: 60 mph la timpul din teste (în teste, 0-60 = 0,784 ×
  // 1/4 − 5,674, eroare medie 0,14 s; dar nu sub 2,3 s, cât lasă aderența unei mașini
  // pe benzină, sau 1,8 s la electrice), 30 mph la 40% din timpul acela (o mașină
  // trage mai tare la plecare decât spre 100), viteza la linie (formula lui Hale,
  // calibrată: 231 × ∛(cp/lb) mph, eroare medie 4 km/h; electricele ies cu 6% peste)
  // și distanța totală. Între puncte viteza crește în linie dreaptă, deci accelerația
  // scade pe parcurs, ca la o mașină reală. Viteza de mijloc se alege așa încât
  // suprafața de sub curbă să fie exact sfertul de milă.
  const SFERT = 402.336;
  function profil(c, T) {
    const ev = electrica(c);
    const t60 = Math.min(T * 0.55, Math.max(ev ? 1.8 : 2.3, 0.784 * (T - (ev ? 0.15 : 0)) - 5.674));
    const linie = (ev ? 245 : 231.2) * Math.cbrt(1 / lbhp(c)) * 0.44704;
    const u60 = t60 / T, v60 = (26.8224 * T) / SFERT;
    const U = [0, 0.4 * u60, u60, (u60 + 1) / 2, 1];
    const V = [0, 0.5 * v60, v60, 0, (linie * T) / SFERT];
    const arie = (i, j) => { let s = 0; for (let k = i; k < j; k++) s += ((U[k + 1] - U[k]) * (V[k] + V[k + 1])) / 2; return s; };
    // suprafața e liniară în viteza de mijloc V[3]: ce rămâne după primele două bucăți
    const rest = 1 - arie(0, 2);
    V[3] = (rest - ((U[3] - U[2]) * V[2]) / 2 - ((1 - U[3]) * V[4]) / 2) / ((1 - U[2]) / 2);
    // date care nu se potrivesc între ele: viteza de mijloc rămâne între vecinele ei,
    // iar viteza la linie se ajustează ca distanța să rămână exactă
    if (!(V[3] >= V[2] && V[3] <= V[4])) {
      V[3] = Math.min(Math.max(V[3], V[2]), V[4]);
      V[4] = (2 * (rest - ((U[3] - U[2]) * (V[2] + V[3])) / 2)) / (1 - U[3]) - V[3];
    }
    const G = [0];
    for (let i = 0; i < 4; i++) G.push(G[i] + ((U[i + 1] - U[i]) * (V[i] + V[i + 1])) / 2);
    return { U, V, G };
  }
  const seg = (pr, u) => { let i = 0; while (i < 3 && u >= pr.U[i + 1]) i++; return i; };
  const panta = (pr, i) => (pr.V[i + 1] - pr.V[i]) / (pr.U[i + 1] - pr.U[i]);
  // partea din distanță parcursă la u
  function poz(pr, u) {
    const i = seg(pr, u), d = u - pr.U[i];
    return Math.min(1, pr.G[i] + pr.V[i] * d + (panta(pr, i) * d * d) / 2);
  }
  // viteza la u, ca parte din distanță pe unitatea de timp a cursei
  const vit = (pr, u) => { const i = seg(pr, u); return pr.V[i] + panta(pr, i) * (u - pr.U[i]); };
  // u la care s-a parcurs partea x din distanță
  function inv(pr, x) {
    let i = 0;
    while (i < 3 && x >= pr.G[i + 1]) i++;
    const r = x - pr.G[i], s = panta(pr, i), v = pr.V[i];
    const d = Math.abs(s) < 1e-9 ? r / v : (-v + Math.sqrt(Math.max(0, v * v + 2 * s * r))) / s;
    return Math.min(1, pr.U[i] + d);
  }

  // ---------- cât valorează mâna ----------
  // Fiecare schimbare primește o notă, iar nota dă ritmul treptei care urmează: totul
  // perfect înseamnă exact timpii din teste, totul ok ×1,14, totul prost ×1,5, iar
  // o schimbare în roșul de după verde (târziu, ~) ×1,3.
  // Raportul de 1,5 dintre perfect și prost e cel cerut: o mașină de 15 s condusă
  // perfect egalează una de 10 s condusă prost, dar un Chiron condus oricât de prost
  // rămâne în fața celei mai lente mașini condusă perfect.
  const RITM = { '+': 1, '0': 1 / 0.88, '-': 1.5, '~': 1.3 };
  // Acul pornește fiecare treaptă de jos (R0) și urcă spre capăt. Verdele e centrat pe
  // 0,915, ok e de la 0,80 până la verde, sub 0,80 e prea devreme, după verde e roșul
  // (târziu), iar la 1 e limitatorul.
  const R0 = 0.55, RTINTA = 0.915, OK_DE_LA = 0.80;
  // O mașină rapidă e mai greu de condus perfect, deci tragerea bună din pachet nu mai
  // câștigă singură. Mai ales prin ac: la una de 14,5 s și peste urcă liniar, la un
  // Chiron urcă tot mai iute, ca o turație care explodează, și trece prin verde de
  // 1,8 ori mai repede (acul e r = R0 + (RTINTA - R0) · (t / D)^p, cu p de la 1 la
  // 1,8; ajunge în mijlocul verdelui tot la D, doar că în viteză). Verdele se
  // îngustează și el, cât să se vadă diferența: de la 0,08 la 0,055. În simulări,
  // un jucător obișnuit pierde cam 0,6 s cu o legendară, 0,35 s cu o exotică și
  // aproape nimic cu una comună.
  const VERDE_LAT = [0.055, 0.08], ACCEL_MAX = 1.8, RAPID_T = [9.5, 14.5];
  const rapiditate = T => 1 - Math.min(1, Math.max(0, (T - RAPID_T[0]) / (RAPID_T[1] - RAPID_T[0])));
  function verde(T) {
    const l = VERDE_LAT[1] - (VERDE_LAT[1] - VERDE_LAT[0]) * rapiditate(T);
    return [RTINTA - l / 2, RTINTA + l / 2];
  }
  const accel = T => 1 + (ACCEL_MAX - 1) * rapiditate(T);
  // Pe limitator mașina aproape nu mai trage, iar după o jumătate de secundă cutia
  // schimbă singură, cu nota cea proastă, ca nimeni să nu rămână blocat.
  const RITM_LIMITATOR = 1.6 / 0.88, LIMITATOR_MAX = 450;
  // Plecarea, ca la launch control: cât se aprind luminile, ții apăsat ca să turezi.
  // Acul urcă cât ții și rămâne unde e când dai drumul; dacă ajunge în limitator,
  // cade jos și o iei de la capăt. La a cincea lumină turația se blochează. La
  // stingere apeși (sau dai drumul, dacă încă țineai) și pleci cu turația blocată.
  // Start fals e doar o apăsare între a cincea lumină și stingere; ridicatul
  // degetului nu e niciodată (prima variantă, cu transbrake, îl socotea start fals,
  // iar degetul se ridică de la sine). Ținta e același verde ca la schimbări, deci la
  // mașinile rapide plecarea e mai grea, ca în realitate: în verde e perfectă, peste
  // el patinezi, sub el pleci moale. Nota plecării dă ritmul primei trepte; reacția
  // costă doar timpul ei.
  const URCA = 0.5;                     // cât din bară pe secundă, cât ții apăsat
  const CADE = 0.25;                    // cât din bară pe secundă, cât nu ții
  const PLECARE_MAX = 2000;            // cine n-a pornit în 2 s pleacă oricum
  function notaLansare(r, V) {
    if (r >= V[0] && r <= V[1]) return '+';
    if (r > V[1]) return '~';
    return r >= OK_DE_LA ? '0' : '-';
  }

  // Reperele bonului de la final, ca la pistele adevărate: 60, 330 și 1000 de
  // picioare, o optime și un sfert de milă. Fiecare mașină ajunge la ele la un u
  // anume, din profilul ei. Viteza, în m/s, vine tot din profil.
  const PUNCTE = [18.288, 100.584, 201.168, 304.8, SFERT];
  // `ritm` include și factorul treptei din upgrade-uri (c.F)
  const vitezaLa = (c, u, ritm) => (SFERT * vit(c.pr, u)) / ((c.T0 || c.T) * ritm);
  // 0-100 se măsoară de pe loc, iar cronometrul de pe pistă pornește abia după primul
  // picior (rollout): pe bon, 0-100 primește înapoi timpul acelui picior. 0,2 s e cât
  // dă, în medie, diferența dintre 0-60 din testele americane și 0-100 oficial.
  const ROLLOUT = 200;

  function nota(r, limitator, V) {
    if (limitator) return '-';
    if (r >= V[0] && r <= V[1]) return '+';
    if (r > V[1]) return '~';
    return r >= OK_DE_LA ? '0' : '-';
  }

  // Treptele: prima scurtă, apoi tot mai lungi, ca la o cutie reală. Durata unei
  // trepte e timpul în care acul ajunge în mijlocul verdelui la un joc normal. O
  // mașină rapidă are trepte mai scurte, deci acul trece mai iute prin verde: cu
  // ea nimerești mai greu; în plus, verdele ei e mai îngust (vezi verde()).
  // Tuning pe piese (Garajul meu), câte 0-5 niveluri, fiecare pe alt moment al cursei:
  //   Anvelope (a): prima treaptă mai rapidă (-2% pe nivel) și plecarea peste verde
  //                 (patinajul) pierde mai puțin;
  //   Ușurare  (u): toate treptele mai rapide (-0,5% pe nivel);
  //   Motor    (m): ultimele două trepte mai rapide (-1% pe nivel), deci și viteza la linie;
  //   Cutie    (c): verdele de la schimbări mai lat (+10% pe nivel) și o schimbare „ok"
  //                 pierde mai puțin; cursa perfectă nu se schimbă.
  // Cu toate la maxim, mașina e cu vreo 6% mai rapidă pe sfertul de milă. Cele patru
  // niveluri stau într-un singur număr (`nivel`, cifre în baza 6: a + 6u + 36m + 216c),
  // același care circulă deja prin garaj, dueluri și cursa live.
  const TUNING_MAX = 5, PIESE = ['Anvelope', 'Ușurare', 'Motor', 'Cutie'];
  const piese = nivel => {
    const n = Math.max(0, Math.floor(Number(nivel) || 0));
    return [n % 6, Math.floor(n / 6) % 6, Math.floor(n / 36) % 6, Math.floor(n / 216) % 6].map(x => Math.min(TUNING_MAX, x));
  };
  const codPiese = p => p[0] + 6 * p[1] + 36 * p[2] + 216 * p[3];
  const nivelTotal = nivel => piese(nivel).reduce((a, b) => a + b, 0);
  const greutati = G => Array.from({ length: G }, (_, k) => 1 + 0.35 * k);
  // Cât răspunde o mașină la tuning, ca în realitate: icoanele tunerilor (JDM, muscle
  // car, hot hatch, M-urile BMW) cel mai mult, motoarele supraalimentate mai mult decât
  // cele atmosferice, electricele cel mai puțin. Înmulțește efectul Anvelopelor,
  // Ușurării și Motorului (Cutia nu schimbă timpul).
  const ICONE_TUNING = /Supra|Skyline|GT-R|Silvia|180SX|240SX|Fairlady|\b350Z|\b370Z|RX-7|Lancer Evolution|Impreza|WRX|Civic Type R|Integra|S2000|Golf (GTI|R)\b|Focus (RS|ST)|Mustang|Camaro|Challenger|Charger|Corvette|\bM[234]\b|Celica|MR2|Eclipse|3000GT|MX-5|Miata|AE86|GR86|\bBRZ\b|\bGT86\b|GR Yaris|Corolla/i;
  const SUPRAALIMENTAT = /turbo|supercharg|kompressor|\bTFSI|\bTSI|\bTBi|\bTT\b|twin.?charg/i;
  const tunabil = c => (electrica(c) ? 0.7 : ICONE_TUNING.test(c.name) ? 1.5 : SUPRAALIMENTAT.test(c.engine || '') || /\bTurbo\b/.test(c.name) ? 1.25 : 1);
  // cât de repede merge fiecare treaptă, față de mașina netunată (sub 1 = mai repede)
  function factori(G, p, k = 1) {
    const [a, u, m] = p;
    return Array.from({ length: G }, (_, i) => (1 - 0.005 * k * u) * (i === 0 ? 1 - 0.02 * k * a : 1) * (i >= G - 2 ? 1 - 0.01 * k * m : 1));
  }
  // timpul cursei perfecte cu upgrade-urile (din el vin scorul și clasa)
  function timpTunat(c, nivel = 0) {
    const G = schimbari(c) + 1, w = greutati(G), F = factori(G, piese(nivel), tunabil(c));
    return (baza(c) * w.reduce((s, x, k) => s + x * F[k], 0)) / w.reduce((s, x) => s + x, 0);
  }
  function pregateste(c, nivel = 0) {
    const p = piese(nivel), T0 = baza(c), T = timpTunat(c, nivel), G = schimbari(c) + 1;
    // profilul (pozițiile, vitezele) e al mașinii netunate; upgrade-urile comprimă
    // timpul fiecărei trepte cu factorul ei
    const pr = profil(c, T0), w = greutati(G), F = factori(G, p, tunabil(c));
    const s = w.reduce((a, b) => a + b, 0);
    const V0 = verde(T), lat = (V0[1] - V0[0]) * (1 + 0.1 * p[3]);
    const V = [Math.max(OK_DE_LA + 0.01, RTINTA - lat / 2), Math.min(0.985, RTINTA + lat / 2)];
    return {
      car: c, nivel: codPiese(p), piese: p, T, T0, G, F, ev: electrica(c), pr, V, P: accel(T),
      PR: PUNCTE.map(m => inv(pr, m / SFERT)), D: w.map((x, k) => (x / s) * T0 * 1000 * F[k]),
      ritmOk: 1 + (1 / 0.88 - 1) * (1 - 0.1 * p[3]), ritmPatinaj: 1.3 - 0.04 * p[0],
    };
  }

  function pilot(p, plan) {
    return {
      p, ...plan, faza: 'arm', gear: 0, r: R0, tg: 0, ritm: 1, u: 0, t: 0, lim: null,
      note: [], start: null, reactie: null, fin: null, fals: false,
      rep: 0, repere: [], vit: [], t100: null, g0: null, apasari: [], tur: [], auto: null, lc: null, blocat: false,
    };
  }

  // Simularea merge pe timpul real, în pași mici, până la o clipă dată. Atingerile
  // se evaluează la ora exactă a evenimentului, nu la cadrul următor, deci nimeni nu
  // e dezavantajat de un telefon care desenează mai rar. `verde` e ora stingerii
  // luminilor; `pe.schimba(c, nota)` anunță ecranul de fiecare schimbare.
  function avanseaza(c, acum, verde, pe) {
    if (c.start == null || c.fin != null) return;
    while (c.t < acum && c.fin == null) {
      const dt = Math.min(4, acum - c.t);
      const ultima = c.gear >= c.G - 1;
      // În ultima treaptă acul urcă mai încet și nu atinge limitatorul: acolo se
      // ajunge la linie, nu se mai schimbă.
      const durata = c.D[c.gear] * (ultima ? 1.5 : 1);
      if (c.r < 1) {
        c.tg += dt;
        c.r = Math.min(ultima ? 0.985 : 1, R0 + (RTINTA - R0) * Math.pow(c.tg / durata, c.P));
        if (c.r >= 1 && c.lim == null) c.lim = c.t + dt;
      }
      const ritm = (c.lim != null ? RITM_LIMITATOR : c.ritm) * (c.F ? c.F[c.gear] : 1);
      const du = dt / ((c.T0 || c.T) * 1000 * ritm);
      // pentru bon: ora fiecărui reper, viteza în dreptul lui și momentul 0-100 km/h
      const u1 = Math.min(1, c.u + du);
      while (c.rep < c.PR.length && u1 >= c.PR[c.rep]) {
        c.repere.push(c.t + (dt * (c.PR[c.rep] - c.u)) / du);
        c.vit.push(vitezaLa(c, c.PR[c.rep], ritm));
        c.rep++;
      }
      if (c.t100 == null && vitezaLa(c, u1, ritm) >= 100 / 3.6) c.t100 = c.t + dt;
      if (c.u + du >= 1) { c.fin = c.t + (dt * (1 - c.u)) / du; c.u = 1; break; }
      c.u += du;
      c.t += dt;
      if (c.lim != null && c.t - c.lim > LIMITATOR_MAX) schimba(c, c.t, verde, true, pe);
    }
  }

  function schimba(c, la, verde, fortat = false, pe = null) {
    if (c.gear >= c.G - 1 || c.fin != null) return null;
    avanseaza(c, la, verde, pe);
    if (c.fin != null) return null;
    const n = nota(c.r, fortat || c.lim != null, c.V);
    c.motiv = fortat || c.lim != null ? 'Limitator' : n === '+' ? 'Perfect' : n === '0' ? 'Bine' : n === '~' ? 'Târziu' : 'Devreme';
    c.note.push(n);
    c.ritm = n === '0' && c.ritmOk ? c.ritmOk : RITM[n];
    c.gear++;
    c.r = R0;
    c.tg = 0;
    c.lim = null;
    c.g0 = la;
    c.apasari.push(Math.round(la - verde));
    if (pe && pe.schimba) pe.schimba(c, n);
    return n;
  }

  // Plecarea: nota vine din turația din clipa plecării (c.lc; în formatul vechi, cea
  // blocată la a cincea lumină).
  function pleaca(c, la, verde) {
    c.reactie = Math.max(0, la - verde);
    if (c.lc == null) c.lc = (c.V[0] + c.V[1]) / 2;
    const n = notaLansare(c.lc, c.V);
    c.motiv = n === '+' ? 'Lansare perfectă' : n === '~' ? 'Patinaj' : n === '0' ? 'Moale' : 'Fără turație';
    c.note.push(n);
    c.ritm = n === '0' && c.ritmOk ? c.ritmOk : n === '~' && c.ritmPatinaj ? c.ritmPatinaj : RITM[n];
    c.start = la;
    c.t = la;
    c.g0 = la;
    // de aici acul arată treptele: pornește de jos
    c.r = R0;
    c.tg = 0;
    c.lim = null;
    c.blocat = false;
    c.apasari.push(Math.round(c.reactie));
    c.faza = 'run';
    return n;
  }

  // ---------- turația de la start ----------
  // Luminile se aprind la 600 ms de la Gata și apoi la fiecare 850 ms; la a cincea
  // (4000 ms) turația se blochează. `ev` sunt orele apăsărilor și ridicărilor
  // degetului, în ms de la începutul luminilor: apăsat, ridicat, apăsat... Cât e
  // apăsat, acul urcă cu URCA pe secundă; cât nu, cade cu CADE până la R0. În
  // limitator (sus de tot) cade la R0 și urcă iar. Ca să fie în verde la a cincea
  // lumină, ori îl ții acolo dozând (apeși, dai drumul), ori apeși la momentul bun.
  const LUMINA_0 = 600, LUMINA_PAS = 850, BLOCARE = LUMINA_0 + 4 * LUMINA_PAS;
  // `sus`: cu ambreiajul (formatul nou), acul ajuns în limitator rămâne acolo cât ții
  // accelerația; înainte cădea jos și urca iar.
  // `mod`: 0 formatul vechi (urcă și cade liniar, limitatorul îl aruncă jos); 1 cu
  // ambreiaj, liniar, în limitator rămâne sus; 2 ca un motor: cât ții, urcă repede și
  // apoi tot mai încet spre limitator; când dai drumul, cade repede și apoi lin spre
  // ralanti. O apăsare scurtă e un „vroom" care urcă și coboară, nu o treaptă în plus,
  // iar în verde îl ții apăsat cam două treimi din timp. (`true` înseamnă 1.)
  const MOTOR = { sus: 1.36, jos: 1.2, tinta: 1.1 };   // pe secundă; ținta e peste limitator
  function acul(ev, t, mod = 0) {
    mod = mod === true ? 1 : mod || 0;
    let r = R0, lim = 0, la = 0, inLim = false;
    for (let i = 0; i <= ev.length && la < t; i++) {
      const pana = Math.min(t, i < ev.length ? ev[i] : Infinity);
      const dt = Math.max(0, pana - la) / 1000;
      if (i % 2) {
        // ținut apăsat de la ev[i-1] până la ev[i]
        r = mod === 2 ? MOTOR.tinta - (MOTOR.tinta - r) * Math.exp(-MOTOR.sus * dt) : r + URCA * dt;
        if (mod) { if (r >= 1) { if (!inLim) lim++; inLim = true; r = 1; } }
        else while (r >= 1) { r -= 1 - R0; lim++; }
      } else {
        r = mod === 2 ? R0 + (r - R0) * Math.exp(-MOTOR.jos * dt) : Math.max(R0, r - CADE * dt);
        if (dt > 0) inLim = false;
      }
      la = Math.max(la, pana);
    }
    return { r, lim };
  }
  const turatieLa = (ev, t, mod = 0) => acul(ev, t, mod).r;
  // de câte ori a dat în limitator până la t (pentru sunet și vibrație)
  const limitatoare = (ev, t, mod = 0) => acul(ev, t, mod).lim;
  // Plecarea cu ambreiaj: ții Start (ambreiajul), turezi cu Accelerația, iar când se
  // sting luminile dai drumul la Start. Turația contează în clipa plecării, nu la a
  // cincea lumină. În `tur` (orele degetului pe Accelerație, de la începutul
  // luminilor) ultima valoare e atunci negativă: -(ora plecării). Fără ea, e formatul
  // vechi (turația blocată la a cincea lumină), cu care se refac cursele de dinainte.
  // Acul ca un motor (mod 2) are înainte de ora plecării un semn: VERSIUNE_MOTOR.
  const cuAmbreiaj = tur => Array.isArray(tur) && tur.length > 0 && tur[tur.length - 1] < 0;
  const VERSIUNE_MOTOR = -3;
  const formatTur = tur => (!cuAmbreiaj(tur) ? { ev: tur || [], T: BLOCARE, mod: 0 }
    : tur.length > 1 && tur[tur.length - 2] === VERSIUNE_MOTOR ? { ev: tur.slice(0, -2), T: -tur[tur.length - 1], mod: 2 }
    : { ev: tur.slice(0, -1), T: -tur[tur.length - 1], mod: 1 });
  function lcDin(tur) {
    const f = formatTur(tur);
    return turatieLa(f.ev, f.T, f.mod);
  }
  // `tur` trimis de un telefon e în regulă? `tine`: pauza de după a cincea lumină, când
  // o știe serverul (cursa live); altfel doar intervalul ei (0,5-2,8 s).
  function turValid(tur, apasari, tine = null) {
    if (!Array.isArray(tur) || tur.length > 401 || !tur.every(x => Number.isInteger(x) && Math.abs(x) <= 60000)) return false;
    const amb = cuAmbreiaj(tur), { ev, T } = formatTur(tur);
    if (!ev.every((x, i) => x >= 0 && (i === 0 || x >= ev[i - 1]))) return false;
    if (!amb) return ev.every(x => x <= BLOCARE);
    const r0 = Array.isArray(apasari) ? apasari[0] : null;
    if (!Number.isInteger(r0) || ev.some(x => x > T)) return false;
    const stinse = T - r0;   // ora stingerii, după ceasul telefonului
    return tine != null ? Math.abs(stinse - tine) <= 150
      : stinse >= BLOCARE + 400 && stinse <= BLOCARE + 2900;
  }

  // ---------- refacerea unei curse ----------
  // Din turație (orele degetului la start) și apăsări (reacția, apoi ora fiecărei
  // schimbări, în ms de la stingerea luminilor) iese cursa întreagă. Schimbările
  // forțate de limitator sunt și ele în apăsări; dacă simularea le face singură
  // înainte, le sare.
  function refa(car, apasari, tur, nivel = 0) {
    const c = pilot(0, pregateste(car, nivel));
    c.lc = lcDin(tur);
    pleaca(c, apasari[0], 0);
    for (let pasi = 0; c.fin == null && pasi < 1000; pasi++) {
      const k = c.note.length;
      const tinta = c.gear < c.G - 1 && apasari[k] != null ? apasari[k] : null;
      if (tinta == null) { avanseaza(c, c.t + 60000, 0); break; }
      avanseaza(c, tinta, 0);
      if (c.fin != null || c.note.length !== k) continue;
      schimba(c, Math.max(tinta, c.t), 0);
    }
    return c;
  }

  // ---------- mașinile din joc și mașina zilei ----------
  const RARITATE = T => (T > 13.6 ? 0 : T > 12.3 ? 1 : T > 11.2 ? 2 : T > 10 ? 3 : 4);
  // Scorul de performanță, ca în Forza: clasa (D, C, B, A, S, aceleași praguri ca mai
  // sus) și un număr din timpul pe 1/4 după tuning. Pagina arată scorul, nu secundele:
  // timpii îi descoperă jucătorul, alergând. Benzile sunt fixe (19,5 s și 7,5 s la
  // capete), ca scorul unei mașini să nu se schimbe când se adaugă mașini noi.
  const CLASE = ['D', 'C', 'B', 'A', 'S'];
  const BENZI = [[19.5, 13.6, 100, 500], [13.6, 12.3, 501, 600], [12.3, 11.2, 601, 700], [11.2, 10, 701, 800], [10, 7.5, 801, 999]];
  function scorTimp(T) {
    const k = RARITATE(T), [a, b, s0, s1] = BENZI[k];
    const f = Math.min(1, Math.max(0, (a - T) / (a - b)));
    return { k, clasa: CLASE[k], v: Math.round(s0 + f * (s1 - s0)) };
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Cursa zilei: aceeași mașină pentru toți, aleasă de un generator pornit de la dată.
  const ZI_SANSE = [10, 25, 30, 25, 10];
  const cheieMasina = c => `${c.name.normalize('NFC')}|${c.years}`;
  function creeaza(cars) {
    const POOL = (cars || []).filter(c => c.image && c.hp && c.weight && t100(c));
    const TIMP = new Map(POOL.map(c => [c, baza(c)]));
    const rar = c => RARITATE(TIMP.get(c));
    const PE_RARITATE = [0, 1, 2, 3, 4].map(r => POOL.filter(c => rar(c) === r));
    function masinaZilei(data) {
      const rnd = mulberry32(hashStr(`startul|${data}`));
      let x = rnd() * 100, r = 0;
      while (r < 4 && x >= ZI_SANSE[r]) { x -= ZI_SANSE[r]; r++; }
      const lista = PE_RARITATE[r];
      return lista[Math.floor(rnd() * lista.length)];
    }
    const dupaCheie = k => POOL.find(c => cheieMasina(c) === String(k).normalize('NFC'));
    return { POOL, TIMP, rar, PE_RARITATE, masinaZilei, dupaCheie };
  }

  globalThis.DragModel = {
    electrica, tunabil, t100, baza, schimbari, SFERT, profil, poz, vit, inv,
    RITM, R0, RTINTA, OK_DE_LA, verde, accel, RITM_LIMITATOR, LIMITATOR_MAX,
    URCA, PLECARE_MAX, notaLansare, PUNCTE, vitezaLa, ROLLOUT, nota,
    pregateste, pilot, avanseaza, schimba, pleaca,
    LUMINA_0, LUMINA_PAS, BLOCARE, turatieLa, limitatoare, refa, lcDin, turValid, cuAmbreiaj, VERSIUNE_MOTOR,
    raritate: RARITATE, cheieMasina, creeaza,
    TUNING_MAX, PIESE, piese, codPiese, nivelTotal, timpTunat,
    // clasa unei mașini cu tuning: aceleași praguri ca raritățile, din timpul tunat
    clasa: (c, nivel = 0) => RARITATE(timpTunat(c, nivel)),
    CLASE, scorTimp,
    scor: (c, nivel = 0) => scorTimp(timpTunat(c, nivel)),
  };
})();
