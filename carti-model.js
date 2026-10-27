// Duel de cărți: regulile, fără ecran. Fiecare are un pachet de 20 de mașini și 5 în
// mână. La fiecare rundă e o categorie; amândoi pun câte o carte cu fața în jos, apoi
// se întorc: valoarea mai bună ia runda. Cărțile jucate ies, fiecare trage una nouă.
// Cine pierde runda alege categoria următoare (prima e la întâmplare; la egalitate
// alege tot el), deci alegi unde mâna ta e tare. Câștigă primul la 5 runde. Greutatea
// se câștigă cu mașina mai ușoară: un pachet doar cu hypercar-uri pierde rundele acelea.
// Șase categorii, alese să nu spună toate același lucru: cuplul a ieșit (urma caii
// putere aproape perfect), au intrat viteza maximă, manevrabilitatea și off-road-ul,
// unde un SUV sau o mașină mică și ușoară bat un hypercar. Din simulări: alegerea
// categoriei câștigă 71% din meciuri (63% cu patru), o mașină mult mai slabă bate
// una tare într-un duel din patru, cam 8 runde de meci.
//
// Pachetul are câte 4 cărți din fiecare raritate (Comună, Rară, Epică, Exotică,
// Legendară). Așa intră în joc și mijlocul, iar strategia e ce alegi în fiecare
// raritate: din simulări, câștigă pachetele cu mașini care domină câte o categorie
// (o comună foarte ușoară, un jeep, un hypercar la 0-100), nu cele bune în medie. Și
// nu știi niciodată ce raritate pune celălalt. Locurile pe care nu le umpli din garaj
// se completează cu mașini împrumutate din raritatea lor, din jumătatea mai slabă.
//
// Contra botului, meciul se poate reface pe server din sămânță și din mutările tale
// (botul folosește același generator), ca banii să se dea doar pe meciuri adevărate.
// Cu un prieten, `camera()` e modelul pentru camerele online.
// Se încarcă și ca script obișnuit (window.CartiModel), și ca modul pe server.
(function (root) {
  const PACHET = 20, MANA = 5, LA = 5;
  const COTE = [4, 4, 4, 4, 4];   // câte cărți din fiecare raritate (Comună ... Legendară)
  // `dec`: zecimalele de pe carte; `sus`: valoarea mai mare câștigă. Notele de
  // manevrabilitate și off-road sunt aceleași ca în Mașina perfectă (din 10).
  const CAT = {
    cp: { label: 'Cai putere', unit: 'CP', dec: 0, sus: true, scurt: 'CP', regula: 'Mai mulți cai câștigă' },
    acc: { label: '0-100 km/h', unit: 's', dec: 1, sus: false, scurt: '0-100', regula: 'Mai rapidă câștigă' },
    vm: { label: 'Viteză maximă', unit: 'km/h', dec: 0, sus: true, scurt: 'Viteză', regula: 'Mai rapidă câștigă' },
    kg: { label: 'Greutate', unit: 'kg', dec: 0, sus: false, scurt: 'Greutate', regula: 'Mai ușoară câștigă' },
    man: { label: 'Manevrabilitate', unit: '/10', dec: 1, sus: true, scurt: 'Viraj', regula: 'Nota mai mare câștigă' },
    off: { label: 'Off-road', unit: '/10', dec: 1, sus: true, scurt: 'Off-road', regula: 'Nota mai mare câștigă' },
  };
  const CHEI = Object.keys(CAT);
  const regula = k => CAT[k].regula;
  // Botul pe trepte: [cum pune cartea, cum alege categoria]
  // (al patrulea, 3: Provocarea zilei, botul greu cu aceleași cărți ca tine)
  const NIVELE_BOT = [[0, 0], [1, 0], [2, 2], [2, 2]];
  // Pachetele fixe ale botului (din simulări, scratchpad sim-final.mjs), câte 4 pe nivel;
  // botul ia unul la întâmplare. Cheile sunt separate prin „;".
  const PACHETE_BOT = [
    // ușor: garaje de început (fără lăzi sau 15 lăzi)
    [
      "Opel Insignia OPC|2009;Aston Martin DB5|1964;Toyota 86|2013;BMW M3|1988;Ford Focus ST|2022;Audi TT RS Coupé|2010;Nissan Skyline GT-R V-Spec|1997;Chrysler 300C SRT8|2012;Mercedes-Benz C 63 AMG Coupé Black Series|2012;Mercedes-Benz E 63 AMG|2013;BMW M6 Coupe|2013;Porsche 959|1987;McLaren 12C|2013;Chevrolet Corvette ZR1|2009;Aston Martin Vantage|2024;Porsche 911 R|2016;McLaren F1 GT|1997;Aston Martin Vulcan|2016;Pagani Huayra R|2022;Lamborghini Revuelto|2024",
      "Porsche Boxster S|2000;SUBARU BRZ|2022;Ford Fiesta ST|2014;Vauxhall Corsa VXR|2016;Porsche 911 Turbo|2000;Dodge Challenger SRT8 392|2014;Audi S5 Sportback|2017;Mercedes-Benz E 55 AMG Wagon|2006;Chevrolet Corvette Z06|2002;BMW M4 Competition Coupé|2021;Porsche Panamera Turbo|2017;Mercedes-AMG A 45 S|2019;Maserati MC20 Cielo|2023;Ferrari 599 GTO|2010;MG Cyberster|2023;Audi R8 V10 plus|2016;Brabham BT62|2019;Ferrari LaFerrari|2013;Pagani Zonda R|2009;Lamborghini Essenza SCV12|2020",
      "Opel Kadett GSi|1985;Lamborghini Centenario Roadster|2016;Ferrari Monza SP2|2019;Renault Clio Williams|1993;SUBARU WRX STI|2015;Alpine A110|2017;Lamborghini Huracán Tecnica|2022;Lamborghini Diablo SV|1997;Mitsubishi Lancer Evolution V|1998;Abarth 124 Spider|2017;Audi S3|2020;Volkswagen Golf R32|2003;Mercedes-AMG A 45 S|2019;Audi RS5|2018;Mercedes-AMG SL 63|2021;Chevrolet Corvette ZR1|2019;McLaren 765LT Coupé|2021;Aston Martin Vulcan|2016;McLaren 750S|2023;Lamborghini Essenza SCV12|2020",
      "McLaren Senna|2018;Abarth 695 Biposto|2016;GMC Sierra AT4|2022;McLaren 765LT Coupé|2021;Lamborghini Reventón|2008;Cadillac Escalade-V|2023;BMW XM|2023;Audi SQ5|2017;Ford Mustang Shelby GT350R|2016;Ferrari 512 TR|1992;Ford Focus RS|2009;BMW M6|2005;Skoda Octavia RS|2006;Dodge Viper GTS ACR|1999;Aston Martin DBS Superleggera|2019;Maserati MC20 Cielo|2023;Dodge Charger SRT Hellcat|2015;Mercedes-Benz AMG CLK GTR|1998;McLaren P1|2013;Ferrari LaFerrari|2013",
    ],
    // mediu: garaje mici (15, 30, 60, 100 de lăzi)
    [
      "Koenigsegg One:1|2015;Ram 1500 TRX|2024;Ferrari Dino 246 GT|1969;Hyundai i20 N|2021;BMW X5 M|2011;Subaru Impreza WRX STI|2010;Ferrari F430|2004;Jaguar XKR-S|2012;BMW M3|2008;Volkswagen Passat R36|2008;Audi RS7 Sportback|2022;Skoda Octavia RS|2013;BMW M6 Gran Coupe|2013;Bugatti EB110|1992;McLaren 12C|2013;Maserati MC20|2022;Chevrolet Camaro ZL1|2017;Lamborghini Essenza SCV12|2020;Ferrari SF90 Stradale|2020;Zenvo TSR-S|2019",
      "McLaren Senna|2018;Suzuki Jimny|2018;Honda Civic Type R|2004;Maserati MC20 Cielo|2023;Lamborghini Diablo GTR|1999;Toyota FJ Cruiser|2007;Dodge Challenger SRT Hellcat|2015;Renault Mégane R26.R|2008;Porsche 911 Speedster|2019;Porsche Cayenne Turbo|2003;Aston Martin DB11|2017;Lamborghini Urus|2019;Honda NSX-R|2005;Ferrari California T|2014;Peugeot RCZ R|2014;Dodge Durango SRT|2018;Aston Martin Vantage|2024;Pagani Utopia|2023;Ferrari Daytona SP3|2022;Gordon Murray Automotive T.50|2022",
      "Alpine A110 1600s|1973;Ferrari FXX K|2014;Land Rover Defender 110 V8|2021;Rivian R1T|2022;Ferrari 488 Pista|2019;Lotus Elise SC|2010;McLaren P1 GTR|2015;Mercedes-Benz G 55 AMG|2004;Lamborghini Diablo GTR|1999;Citroën Saxo VTS|1997;Porsche 918 Spyder|2015;Chevrolet Silverado LT Trail Boss|2020;Porsche 911 GT3|2004;Opel Kadett GSi|1985;Lamborghini Centenario Roadster|2016;Ford Mustang Shelby GT350R|2016;Lamborghini Diablo VT|1993;Audi Q7 V12 TDI|2008;MG Cyberster|2023;McLaren Senna|2018",
      "Koenigsegg Agera RS|2017;MINI Cooper S|1965;Dodge Challenger SRT Demon|2018;McLaren 765LT Coupé|2021;Mercedes-AMG G 63|2024;Lamborghini Temerario|2024;Koenigsegg Agera R|2012;Alpine A110 1600s|1973;Ferrari F40 Competizione|1989;Toyota Tacoma TRD Pro|2019;BMW M4 CSL|2023;Koenigsegg CCX|2006;Alfa Romeo 4C|2014;Ferrari F12berlinetta|2013;Land Rover Range Rover P530|2022;Porsche 911 GT3|2021;Jaguar D-Type|1956;Toyota FJ Cruiser|2007;Hyundai IONIQ 5 N|2023;Alpine A110|2017",
    ],
    // greu: pachete de top, găsite prin simulare, fiecare pe alte categorii
    [
      "Porsche 550 Spyder|1955;Mercedes-Benz G 500 4x4²|2016;MINI Cooper S|1965;Ford Bronco Raptor|2022;Ram 1500 TRX|2024;SUBARU Impreza WRX STi|2004;Renault Mégane R.S. Trophy-R|2019;Honda NSX-R|2005;Ford F-150 Raptor R|2023;Porsche 911 GT3 RS 4.0|2012;GMC HUMMER EV Pickup|2022;Aston Martin V12 Vantage S|2013;BAC Mono|2014;Ferrari 599XX|2010;Ariel Nomad|2016;Lotus Evija|2020;Hennessey Venom F5|2021;Rimac Nevera|2021;Koenigsegg Jesko|2020;Dodge Challenger SRT Demon 170|2023",
      "Mercedes-Benz G 500 4x4²|2016;Hummer H1 Alpha|2006;Meyers Manx|1971;MINI Cooper S|1965;Honda S2000|2003;Toyota GR Yaris|2021;Honda NSX-R|2005;Ram 1500 TRX|2024;BMW M4 CSL|2023;Bentley Flying Spur|2020;Ford F-150 Raptor R|2023;Porsche 911 GT3|2021;Ariel Nomad|2016;Dodge Viper ACR|2016;Lotus Evija|2020;Lamborghini Veneno|2013;Dodge Challenger SRT Demon 170|2023;Automobili Pininfarina Battista|2020;Bugatti Bolide|2020;Hennessey Venom F5|2021",
      "Ford Fiesta ST|2014;Peugeot 205 T16|1984;Mercedes-Benz G 500 4x4²|2016;Meyers Manx|1971;Rolls-Royce Cullinan|2018;Mitsubishi Lancer Evolution VI GSR|1999;Mercedes-Maybach GLS 600|2021;Porsche 911 Carrera|2005;BMW M4 CSL|2023;Porsche 911 GT3|2014;Porsche 911 GT3|2021;Porsche 911 GT3 RS 4.0|2012;Porsche 911 GT3 RS|2023;BAC Mono|2014;Ariel Nomad|2016;Lotus Evija|2020;Koenigsegg Agera RS|2017;Hennessey Venom F5|2021;Koenigsegg Jesko|2020;Dodge Challenger SRT Demon 170|2023",
      "Mercedes-Benz G 500 4x4²|2016;Meyers Manx|1971;Ford Escort RS Cosworth|1992;Hummer H1 Alpha|2006;BMW X5 M|2011;Ram 1500 TRX|2024;Renault Mégane R.S. Trophy-R|2019;Honda Civic Type R|2018;Aston Martin DBX707|2022;Ford F-150 Raptor R|2023;Rivian R1T|2022;Porsche 911 GT3|2014;Porsche 911 GT3 RS|2023;BAC Mono|2014;Lotus Evija|2020;Dodge Viper ACR|2016;Hennessey Venom F5|2021;Koenigsegg Jesko|2020;Dodge Challenger SRT Demon 170|2023;Koenigsegg Agera RS|2017",
    ],
  ];

  // un generator de numere din sămânță, ca o partidă să se poată reface. Sămânța e un
  // număr (meciurile de pe telefon) sau patru (pe server: 128 de biți, ca sămânța să nu
  // se poată ghici încercând-o pe toate după cărțile din mână).
  function rng(samanta) {
    if (Array.isArray(samanta)) {
      let [a, b, c, d] = samanta.map(x => x >>> 0);
      if (!(a | b | c | d)) a = 1;
      const rot = (x, k) => (x << k) | (x >>> (32 - k));
      return () => {
        const rez = Math.imul(rot(Math.imul(b, 5), 7), 9) >>> 0, t = b << 9;
        c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rot(d, 11);
        return rez / 4294967296;
      };
    }
    let s = samanta >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function amesteca(l, r) {
    const a = l.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // `M` e DragModel (0-100, cheia), `MD` ce dă M.creeaza(mașini) (lista și raritatea).
  // O carte: { k: cheia mașinii, r: raritatea, cp, nm, acc, kg }.
  function creeaza(M, MD) {
    const g = c => c.grades || {};
    const carte = c => (c && c.hp && c.weight && g(c).kmh && g(c).handling != null && g(c).offroad != null
      ? { k: M.cheieMasina(c), r: MD.rar(c), cp: c.hp, acc: M.t100(c), vm: g(c).kmh, kg: c.weight, man: g(c).handling, off: g(c).offroad } : null);
    const toate = MD.POOL.map(carte).filter(x => x && x.acc);
    const dupaCheie = new Map(toate.map(x => [x.k, x]));
    // percentila fiecărei valori (1 = cea mai bună din joc), pentru bot și pentru pachetul automat
    const sortate = Object.fromEntries(CHEI.map(k => [k, toate.map(x => x[k]).sort((a, b) => a - b)]));
    function procent(k, v) {
      const s = sortate[k];
      let lo = 0, hi = s.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; }
      const p = lo / Math.max(1, s.length - 1);
      return CAT[k].sus ? p : 1 - p;
    }
    const forta = x => CHEI.reduce((s, k) => s + procent(k, x[k]), 0) / CHEI.length;
    // la ce domină o mașină: categoria unde e cea mai bună față de restul jocului
    const rol = x => CHEI.reduce((b, k) => (procent(k, x[k]) > procent(b, x[b]) ? k : b), CHEI[0]);
    const varf = x => { const k = rol(x); return procent(k, x[k]); };
    // mașinile care se pot împrumuta: din fiecare raritate, jumătatea care domină mai
    // puțin, în ordinea cheilor (la fel peste tot)
    const deImprumut = COTE.map((_, q) => {
      const l = toate.filter(x => x.r === q).sort((a, b) => varf(a) - varf(b) || (a.k < b.k ? -1 : 1));
      return l.slice(0, Math.ceil(l.length / 2)).sort((a, b) => (a.k < b.k ? -1 : 1));
    });
    return { carte, toate, dupaCheie, procent, forta, rol, varf, deImprumut };
  }

  const peRaritate = carti => COTE.map((_, q) => carti.filter(x => x.r === q).length);
  // Completează fiecare raritate până la cota ei cu mașini împrumutate, aceleași pentru
  // aceeași sămânță.
  function completeaza(model, carti, samanta) {
    const r = rng(samanta ^ 0x5bd1e995), folosite = new Set(carti.map(x => x.k)), n = peRaritate(carti), out = carti.slice();
    COTE.forEach((c, q) => {
      const extra = amesteca(model.deImprumut[q].filter(x => !folosite.has(x.k)), r).slice(0, Math.max(0, c - n[q]));
      out.push(...extra.map(x => ({ ...x, imprumut: true })));
    });
    return out;
  }
  // Mai încape `x` în pachetul `carti`? (nu e deja acolo și raritatea lui mai are loc)
  const incape = (carti, x) => !!x && COTE[x.r] != null && !carti.some(y => y.k === x.k) && carti.filter(y => y.r === x.r).length < COTE[x.r];
  // Cărțile tale (din garaj) sunt bune pentru un pachet? Fără dubluri, cel mult cota pe raritate.
  function pachetValid(carti) {
    if (!Array.isArray(carti) || carti.length > PACHET) return false;
    if (new Set(carti.map(x => x.k)).size !== carti.length) return false;
    return carti.every(x => COTE[x.r] != null) && peRaritate(carti).every((n, q) => n <= COTE[q]);
  }
  // Din ce ai trimis, ce încape (în ordine): un pachet făcut după regulile vechi nu se
  // respinge, doar se taie.
  function potriveste(carti) {
    const out = [];
    for (const x of Array.isArray(carti) ? carti : []) if (incape(out, x)) out.push(x);
    return out;
  }

  // Pachetul automat: în fiecare raritate, mașinile care domină ceva, dar fără să adune
  // toate vârfurile pe aceeași categorie (fiecare carte în plus pe o categorie deja
  // acoperită contează mai puțin), ca să ai ce pune la oricare dintre ele.
  function pachetAutomat(carti, model) {
    const ales = [], acop = Object.fromEntries(CHEI.map(k => [k, 0]));
    const scor = x => model.varf(x) - 0.06 * acop[model.rol(x)];
    for (;;) {
      let b = null;
      for (const x of carti) if (incape(ales, x) && (!b || scor(x) > scor(b))) b = x;
      if (!b) break;
      ales.push(b);
      acop[model.rol(b)]++;
    }
    return ales;
  }
  // Pachetul tău din garaj: exact mașinile alese (`sel`, cât încap); cât n-ai ales nimic
  // (`sel` null), cel automat. Locurile rămase goale se umplu cu mașini împrumutate.
  function pachetDinGaraj(garaj, sel, model) {
    const carti = sel ? potriveste(garaj.filter(y => sel.has(y.k))) : pachetAutomat(garaj, model);
    const n = peRaritate(carti);
    return { carti, imprumut: PACHET - carti.length, lipsa: COTE.map((c, q) => c - n[q]) };
  }
  // Pachetul botului: unul din cele fixe ale nivelului, la întâmplare. Nu se mai uită la
  // pachetul tău (înainte îl copia), deci un garaj mai bun chiar înseamnă meciuri mai ușoare.
  // Dacă o mașină a dispărut din date, locul ei se umple cu una împrumutată.
  function pachetBot(nivel, model, r) {
    const l = PACHETE_BOT[nivel] || PACHETE_BOT[0], ales = l[Math.floor(r() * l.length)];
    const carti = potriveste(ales.split(';').map(k => model.dupaCheie.get(k)).filter(Boolean));
    return carti.length === PACHET ? carti : completeaza(model, carti, Math.floor(r() * 2 ** 31)).map(({ imprumut, ...x }) => x);
  }

  // Pachetul zilei (Provocarea zilei): același pentru toți, pachetul automat dintr-un garaj
  // tras din dată, cu câte 15 mașini din fiecare raritate.
  function pachetZi(model, samanta) {
    const r = rng(samanta);
    return pachetAutomat(COTE.flatMap((_, q) => amesteca(model.toate.filter(x => x.r === q), r).slice(0, 15)), model);
  }

  // Partida: pachetele (liste de cărți), amestecate cu sămânța.
  function porneste(pachete, samanta) {
    const r = rng(samanta);
    const jucatori = pachete.map(p => {
      const a = amesteca(p, r);
      return { mana: a.slice(0, MANA), pachet: a.slice(MANA), scor: 0 };
    });
    // k: categoria rundei (null cât o alege cineva); alege: cine o alege pe următoarea
    return { j: jucatori, k: CHEI[Math.floor(r() * CHEI.length)], alege: null, runda: 0, istoric: [], gata: false, castigator: null };
  }
  function alegeCategoria(s, p, k) {
    if (s.gata || s.k || s.alege !== p || !CAT[k]) return false;
    s.k = k;
    return true;
  }
  // se compară ce se vede pe carte (0-100 cu o zecimală), ca rezultatul să se înțeleagă
  const afisat = (k, v) => Math.round(v * 10 ** CAT[k].dec);
  const bate = (k, a, b) => {
    const x = afisat(k, a[k]), y = afisat(k, b[k]);
    return x === y ? 0 : (CAT[k].sus ? x > y : x < y) ? 1 : -1;
  };

  // amândoi au ales: index în mână pentru fiecare
  function joaca(s, alegeri) {
    if (s.gata || !s.k) return null;
    if (alegeri.some((i, p) => !Number.isInteger(i) || i < 0 || i >= s.j[p].mana.length)) return null;
    const k = s.k;
    const carti = s.j.map((x, p) => x.mana[alegeri[p]]);
    const rez = bate(k, carti[0], carti[1]);
    const castiga = rez > 0 ? 0 : rez < 0 ? 1 : null;
    if (castiga != null) s.j[castiga].scor++;
    s.j.forEach((x, p) => {
      x.mana.splice(alegeri[p], 1);
      if (x.pachet.length) x.mana.push(x.pachet.shift());
    });
    s.istoric.push({ cat: k, carti, castiga });
    s.runda++;
    const gol = s.j.some(x => !x.mana.length);
    if (s.j.some(x => x.scor >= LA) || gol) {
      s.gata = true;
      s.castigator = s.j[0].scor === s.j[1].scor ? null : s.j[0].scor > s.j[1].scor ? 0 : 1;
    } else {
      if (castiga != null) s.alege = 1 - castiga;
      else if (s.alege == null) s.alege = s.runda % 2;
      s.k = null;
    }
    return { cat: k, carti, castiga };
  }

  // Botul. Cartea: 0 cam la întâmplare; 1 cea mai bună la categoria asta; 2 cea mai
  // bună aici față de cât valorează în rest (păstrează cărțile bune la toate).
  // Categoria: 0 la întâmplare; 2 unde cea mai bună carte iese cel mai mult peste cât
  // valorează mâna lui (din simulări: alegerea categoriei câștigă cam două meciuri din
  // trei față de una la întâmplare). `r` se cere de fiecare dată, ca să se poată reface.
  const P = (model, x, c) => model.procent(c, x[c]);
  function alegeBot(s, p, nivel, model, r) {
    const mana = s.j[p].mana, k = s.k;
    const cea = () => mana.reduce((b, x, i) => (P(model, x, k) > P(model, mana[b], k) ? i : b), 0);
    if (nivel === 0) return r() < 0.55 ? Math.floor(r() * mana.length) : cea();
    if (nivel === 1) return cea();
    const restul = x => CHEI.filter(c => c !== k).reduce((t, c) => t + P(model, x, c), 0) / (CHEI.length - 1);
    const scor = x => P(model, x, k) - 0.25 * restul(x);
    return mana.reduce((b, x, i) => (scor(x) > scor(mana[b]) ? i : b), 0);
  }
  function categorieBot(s, p, nivel, model, r) {
    const mana = s.j[p].mana;
    if (nivel < 2) return CHEI[Math.floor(r() * CHEI.length)];
    const f = k => Math.max(...mana.map(x => P(model, x, k) - 0.3 * model.forta(x)));
    return CHEI.reduce((b, k) => (f(k) > f(b) ? k : b), CHEI[0]);
  }

  // ---------- contra botului ----------
  // Totul din sămânță: pachetul botului, amestecul și deciziile lui, în aceeași ordine
  // pe telefon și pe server (în fiecare rundă: întâi categoria lui, dacă alege el, apoi
  // cartea lui, o singură dată).
  function meciBot(pachet, nivel, samanta, model) {
    const r = rng(samanta);
    const bot = nivel === 3 ? pachet.map(({ imprumut, ...x }) => x) : pachetBot(nivel, model, r);
    const lung = Array.isArray(samanta);
    const s = porneste([pachet, bot], lung ? [0, 0, 0, 0].map(() => (r() * 2 ** 32) >>> 0) : Math.floor(r() * 2 ** 31));
    s.bot = { nivel, r };
    return s;
  }
  const botCategorie = (s, model) => categorieBot(s, 1, NIVELE_BOT[s.bot.nivel][1], model, s.bot.r);
  const botCarte = (s, model) => alegeBot(s, 1, NIVELE_BOT[s.bot.nivel][0], model, s.bot.r);
  // Meciul pe server, din mutările tale: `mutari` = [{ k?, i }] pe runde (k doar când ai
  // ales tu categoria). După fiecare rundă, dacă alege botul, categoria lui e pusă pe loc
  // (aceeași ordine a hazardului ca înainte, deci meciurile se refac la fel).
  // Întoarce { s, ultim } (ultima rundă jucată) sau null la o mutare greșită.
  function pasBot(pachet, nivel, samanta, model, mutari) {
    if (!Array.isArray(mutari) || mutari.length > 40) return null;
    const s = meciBot(pachet, nivel, samanta, model);
    let ultim = null;
    for (const m of mutari) {
      if (s.gata || !m || typeof m !== 'object') return null;
      if (!s.k && !alegeCategoria(s, 0, m.k)) return null;
      const b = botCarte(s, model);
      ultim = joaca(s, [m.i, b]);
      if (!ultim) return null;
      if (!s.gata && !s.k && s.alege === 1) alegeCategoria(s, 1, botCategorie(s, model));
    }
    return { s, ultim };
  }
  const refaBot = (pachet, nivel, samanta, model, mutari) => {
    const x = pasBot(pachet, nivel, samanta, model, mutari);
    return x && x.s.gata ? x.s : null;
  };
  // Ce vede jucătorul din meciul de pe server: mâna lui, câte cărți are botul, categoria.
  function vedereBot(s, kBot) {
    return {
      mana: s.j[0].mana.map(x => x.k), pachet: s.j[0].pachet.length, bot: s.j[1].mana.length,
      scor: s.j.map(x => x.scor), runda: s.runda, alege: s.alege, gata: s.gata, castigator: s.castigator,
      // categoria pusă de bot se arată după ce „se gândește" el, pe telefon
      k: kBot ? null : s.k, kBot: kBot ? s.k : null,
    };
  }

  // ---------- cu un prieten, în cameră ----------
  // Fazele: 'pachete' (fiecare își trimite pachetul), 'cat' (cine a pierdut alege
  // categoria), 'carte' (amândoi pun o carte; fiecare vede doar că celălalt a pus),
  // 'arata' (se întorc), 'final'. Cine nu mută la timp: categoria vine la întâmplare,
  // cartea e prima din mână, iar pachetul e completat cu mașini împrumutate.
  function camera(model) {
    const MS = { pachete: 120000, cat: 20000, carte: 25000, arata: 3200 };
    function noua(rand, acum, primul = 0) {
      return { faza: 'pachete', termen: acum + MS.pachete, primul, seed: Math.floor(rand() * 2 ** 31), pachete: [null, null], m: null, alegeri: [null, null], ultim: null, rezultat: null };
    }
    function incepe(s, acum) {
      const p = s.pachete.map((x, i) => completeaza(model, x || [], s.seed + i));
      s.m = porneste(p, s.seed);
      s.pachete = null;
      urm(s, acum);
    }
    // după o rundă (sau la început): categoria e deja trasă, sau o alege cineva
    function urm(s, acum) {
      if (s.m.gata) {
        s.faza = 'final'; s.termen = null;
        s.rezultat = { win: s.m.castigator, scor: s.m.j.map(x => x.scor) };
        return;
      }
      s.alegeri = [null, null];
      if (s.m.k) { s.faza = 'carte'; s.termen = acum + MS.carte; } else { s.faza = 'cat'; s.termen = acum + MS.cat; }
    }
    function rezolva(s, acum) {
      s.ultim = joaca(s.m, s.alegeri);
      s.faza = 'arata';
      s.termen = acum + MS.arata;
    }
    function avanseaza(s, acum) {
      let schimbat = false;
      for (let pasi = 0; s.termen != null && s.termen <= acum && pasi < 30; pasi++) {
        const t = s.termen;
        schimbat = true;
        if (s.faza === 'pachete') incepe(s, t);
        else if (s.faza === 'cat') { alegeCategoria(s.m, s.m.alege, CHEI[(s.seed + s.m.runda) % CHEI.length]); urm(s, t); }
        else if (s.faza === 'carte') { s.alegeri = s.alegeri.map(i => (i == null ? 0 : i)); rezolva(s, t); }
        else if (s.faza === 'arata') urm(s, t);
        else s.termen = null;
      }
      return schimbat;
    }
    // `m.carti` la pachet: cărțile tale, deja verificate în garaj de server
    function muta(s, p, m, acum) {
      if (!m || typeof m !== 'object') return 'mutare';
      if (m.tip === 'pachet') {
        if (s.faza !== 'pachete' || s.pachete[p]) return 'faza';
        s.pachete[p] = potriveste(m.carti || []).map(x => ({ ...x }));
        if (s.pachete.every(Boolean)) incepe(s, acum);
        return null;
      }
      if (m.tip === 'cat') {
        if (s.faza !== 'cat' || s.m.alege !== p || !alegeCategoria(s.m, p, m.k)) return 'categorie';
        urm(s, acum);
        return null;
      }
      if (m.tip === 'carte') {
        if (s.faza !== 'carte' || s.alegeri[p] != null) return 'faza';
        if (!Number.isInteger(m.i) || m.i < 0 || m.i >= s.m.j[p].mana.length) return 'carte';
        s.alegeri[p] = m.i;
        if (s.alegeri.every(x => x != null)) rezolva(s, acum);
        return null;
      }
      return 'mutare';
    }
    // Ce vede fiecare: mâna lui, nu și pe a celuilalt; cartea pusă de celălalt doar după întoarcere.
    function vedere(s, p) {
      const v = { faza: s.faza, termen: s.termen, primul: s.primul, rezultat: s.rezultat, ultim: s.ultim };
      if (s.faza === 'pachete') { v.gata = s.pachete.map(Boolean); return v; }
      const m = s.m;
      Object.assign(v, {
        k: m.k, alege: m.alege, runda: m.runda, scor: m.j.map(x => x.scor), inMana: m.j.map(x => x.mana.length),
        pus: s.alegeri.map(x => x != null), istoric: s.faza === 'final' ? m.istoric : undefined,
      });
      if (p === 0 || p === 1) { v.mana = m.j[p].mana; v.pusEu = s.alegeri[p]; }
      return v;
    }
    return { MS, noua, avanseaza, muta, vedere };
  }

  const api = {
    PACHET, MANA, LA, COTE, CAT, CHEI, NIVELE_BOT, regula, rng, amesteca, creeaza, peRaritate, completeaza, pachetValid, potriveste,
    pachetAutomat, pachetDinGaraj, incape, PACHETE_BOT, pachetBot, pachetZi, porneste, alegeCategoria, joaca, bate, alegeBot, categorieBot, meciBot, botCategorie, botCarte, pasBot, refaBot, vedereBot, camera,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CartiModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
