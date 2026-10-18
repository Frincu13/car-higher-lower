// Duel de cărți: regulile, fără ecran. Fiecare are un pachet de 20 de mașini și 5 în
// mână. La fiecare rundă e o categorie; amândoi pun câte o carte cu fața în jos, apoi
// se întorc: valoarea mai bună ia runda. Cărțile jucate ies, fiecare trage una nouă.
// Cine pierde runda alege categoria următoare (prima e la întâmplare; la egalitate
// alege tot el), deci alegi unde mâna ta e tare. Câștigă primul la 5 runde. Greutatea
// se câștigă cu mașina mai ușoară: un pachet doar cu hypercar-uri pierde rundele acelea.
// Din simulări: cam 8 runde de meci, cel mult 12.
//
// Pachetul are un buget: fiecare carte costă după raritate (Comună 1 ... Legendară 5),
// în total cel mult 50 pentru 20 de cărți. Fără buget, pachetul mai puternic câștiga
// aproape mereu; așa contează și cum îți faci pachetul, nu doar ce lăzi ai prins.
// Ce lipsește din garaj se completează cu mașini comune împrumutate (costă 1).
//
// Contra botului, meciul se poate reface pe server din sămânță și din mutările tale
// (botul folosește același generator), ca banii să se dea doar pe meciuri adevărate.
// Cu un prieten, `camera()` e modelul pentru camerele online.
// Se încarcă și ca script obișnuit (window.CartiModel), și ca modul pe server.
(function (root) {
  const PACHET = 20, MANA = 5, LA = 5, BUGET = 50;
  const COST = [1, 2, 3, 4, 5];
  const CAT = {
    cp: { label: 'Cai putere', unit: 'CP', dec: 0, sus: true, scurt: 'CP' },
    nm: { label: 'Cuplu', unit: 'Nm', dec: 0, sus: true, scurt: 'Nm' },
    acc: { label: '0-100 km/h', unit: 's', dec: 1, sus: false, scurt: '0-100' },
    kg: { label: 'Greutate', unit: 'kg', dec: 0, sus: false, scurt: 'kg' },
  };
  const CHEI = Object.keys(CAT);
  const regula = k => (CAT[k].sus ? 'Mai mult câștigă' : k === 'kg' ? 'Mai ușoară câștigă' : 'Mai rapidă câștigă');
  // Botul pe trepte: [cum pune cartea, cum alege categoria]
  const NIVELE_BOT = [[0, 0], [1, 0], [2, 2]];

  // un generator de numere din sămânță, ca o partidă să se poată reface
  function rng(samanta) {
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
    const carte = c => (c && c.hp && c.torque && c.weight ? { k: M.cheieMasina(c), r: MD.rar(c), cp: c.hp, nm: c.torque, acc: M.t100(c), kg: c.weight } : null);
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
    // mașinile care se pot împrumuta: comune, în ordinea cheilor (la fel peste tot)
    const comune = toate.filter(x => x.r === 0).sort((a, b) => (a.k < b.k ? -1 : 1));
    return { carte, toate, dupaCheie, procent, forta, comune };
  }

  const cost = x => (x.imprumut ? 1 : COST[x.r] || 1);
  const costPachet = p => p.reduce((s, x) => s + cost(x), 0);

  // Completează pachetul cu mașini comune împrumutate, aceleași pentru aceeași sămânță.
  function completeaza(model, carti, samanta) {
    const lipsa = PACHET - carti.length;
    if (lipsa <= 0) return carti.slice(0, PACHET);
    const folosite = new Set(carti.map(x => x.k));
    const extra = amesteca(model.comune.filter(x => !folosite.has(x.k)), rng(samanta ^ 0x5bd1e995)).slice(0, lipsa);
    return carti.concat(extra.map(x => ({ ...x, imprumut: true })));
  }
  // Cărțile tale (din garaj) sunt bune pentru un pachet? Cel mult 20, fără dubluri, în
  // buget (cu împrumuturile care le completează).
  function pachetValid(carti) {
    if (!Array.isArray(carti) || carti.length > PACHET) return false;
    if (new Set(carti.map(x => x.k)).size !== carti.length) return false;
    return costPachet(carti) + (PACHET - carti.length) <= BUGET;
  }

  // Pachetul automat: pe rând câte o categorie, cea mai bună carte care încape în buget
  // (lăsând loc pentru restul, la cel puțin 1 punct fiecare). Iese un pachet amestecat:
  // câteva vârfuri și multe mașini ieftine, dar bune la ceva.
  function pachetAutomat(carti, model, { loc = PACHET, buget = BUGET } = {}) {
    const ramase = carti.slice(), ales = [];
    let ramas = buget, i = 0;
    while (ales.length < loc && ramase.length) {
      const k = CHEI[i++ % CHEI.length], dupa = loc - ales.length - 1;
      const bune = ramase.filter(x => ramas - cost(x) >= dupa);
      if (!bune.length) break;
      bune.sort((a, b) => model.procent(k, b[k]) + model.forta(b) - (model.procent(k, a[k]) + model.forta(a)));
      const x = bune[0];
      ales.push(x);
      ramase.splice(ramase.indexOf(x), 1);
      ramas -= cost(x);
    }
    return ales;
  }
  // Pachetul tău din garaj: cele alese de tine (`sel`, cât încap în buget), completate
  // automat din restul garajului în bugetul rămas, fără cele scoase de tine (`afara`).
  // Ce lipsește până la 20 vine împrumutat (comune, 1 punct).
  function pachetDinGaraj(garaj, sel, afara, model) {
    const tale = [];
    for (const x of garaj.filter(y => sel.has(y.k))) {
      if (tale.length < PACHET && costPachet(tale) + cost(x) + (PACHET - tale.length - 1) <= BUGET) tale.push(x);
    }
    const auto = pachetAutomat(garaj.filter(x => !sel.has(x.k) && !afara.has(x.k)), model, { loc: PACHET - tale.length, buget: BUGET - costPachet(tale) });
    const carti = tale.concat(auto);
    return { carti, auto: new Set(auto.map(x => x.k)), imprumut: PACHET - carti.length, cost: costPachet(carti) + (PACHET - carti.length) };
  }
  // Pachetul botului: pentru fiecare carte a ta, una de forță apropiată din tot jocul.
  function pachetPereche(pachet, model, r) {
    const dupaForta = model.toate.map(x => [model.forta(x), x]).sort((a, b) => a[0] - b[0] || (a[1].k < b[1].k ? -1 : 1));
    const folosite = new Set(pachet.map(x => x.k));
    return pachet.map(x => {
      const f = model.forta(x);
      const apr = dupaForta.filter(([g, y]) => Math.abs(g - f) < 0.05 && !folosite.has(y.k));
      const pick = apr.length ? apr[Math.floor(r() * apr.length)][1] : dupaForta[Math.floor(r() * dupaForta.length)][1];
      folosite.add(pick.k);
      return pick;
    });
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
    const bot = pachetPereche(pachet, model, r);
    const s = porneste([pachet, bot], Math.floor(r() * 2 ** 31));
    s.bot = { nivel, r };
    return s;
  }
  const botCategorie = (s, model) => categorieBot(s, 1, NIVELE_BOT[s.bot.nivel][1], model, s.bot.r);
  const botCarte = (s, model) => alegeBot(s, 1, NIVELE_BOT[s.bot.nivel][0], model, s.bot.r);
  // Refacerea pe server: `mutari` = [{ k?, i }] pe runde (k doar când ai ales tu categoria).
  function refaBot(pachet, nivel, samanta, model, mutari) {
    if (!Array.isArray(mutari) || mutari.length > 40) return null;
    const s = meciBot(pachet, nivel, samanta, model);
    for (const m of mutari) {
      if (s.gata || !m || typeof m !== 'object') return null;
      if (!s.k) {
        if (s.alege === 1) alegeCategoria(s, 1, botCategorie(s, model));
        else if (!alegeCategoria(s, 0, m.k)) return null;
      }
      const b = botCarte(s, model);
      if (!joaca(s, [m.i, b])) return null;
    }
    return s.gata ? s : null;
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
        if (!pachetValid(m.carti || [])) return 'pachet';
        s.pachete[p] = m.carti.map(x => ({ ...x }));
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
    PACHET, MANA, LA, BUGET, COST, CAT, CHEI, NIVELE_BOT, regula, rng, amesteca, creeaza, cost, costPachet, completeaza, pachetValid,
    pachetAutomat, pachetDinGaraj, pachetPereche, porneste, alegeCategoria, joaca, bate, alegeBot, categorieBot, meciBot, botCategorie, botCarte, refaBot, camera,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CartiModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
