// Duel de cărți: regulile, fără ecran. Fiecare are un pachet de 20 de mașini și 5 în
// mână. La fiecare rundă e o categorie; amândoi pun câte o carte cu fața în jos, apoi
// se întorc: valoarea mai bună ia runda. Cărțile jucate ies, fiecare trage una nouă.
// Cine pierde runda alege categoria următoare (prima e la întâmplare; la egalitate
// alege tot el), deci alegi unde mâna ta e tare. Câștigă primul la 5 runde. Greutatea
// se câștigă cu mașina mai ușoară: un pachet doar cu hypercar-uri pierde rundele acelea.
// Din simulări: cam 8 runde de meci, cel mult 12.
// Se încarcă și ca script obișnuit (window.CartiModel), și ca modul pe server.
(function (root) {
  const PACHET = 20, MANA = 5, LA = 5;
  const CAT = {
    cp: { label: 'Cai putere', unit: 'CP', dec: 0, sus: true, scurt: 'CP' },
    nm: { label: 'Cuplu', unit: 'Nm', dec: 0, sus: true, scurt: 'Nm' },
    acc: { label: '0-100 km/h', unit: 's', dec: 1, sus: false, scurt: '0-100' },
    kg: { label: 'Greutate', unit: 'kg', dec: 0, sus: false, scurt: 'kg' },
  };
  const CHEI = Object.keys(CAT);
  const regula = k => (CAT[k].sus ? 'Mai mult câștigă' : k === 'kg' ? 'Mai ușoară câștigă' : 'Mai rapidă câștigă');

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

  // `M` e DragModel (pentru 0-100). O carte: { k: cheia mașinii, cp, nm, acc, kg }.
  function creeaza(M, pool) {
    const carte = c => (c && c.hp && c.torque && c.weight ? { k: M.cheieMasina(c), cp: c.hp, nm: c.torque, acc: M.t100(c), kg: c.weight } : null);
    const toate = pool.map(carte).filter(x => x && x.acc);
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
    return { carte, toate, procent, forta };
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
      else if (s.alege == null) s.alege = Math.floor(rng(s.runda * 7919 + carti[0].cp)() * 2);
      s.k = null;
    }
    return { cat: k, carti, castiga };
  }

  // Botul. Cartea: 0 cam la întâmplare; 1 cea mai bună la categoria asta; 2 cea mai
  // bună aici față de cât valorează în rest (păstrează cărțile bune la toate).
  // Categoria: 0 la întâmplare; 1 unde are cea mai bună carte; 2 unde cea mai bună
  // carte iese cel mai mult peste cât valorează mâna lui (din simulări: alegerea
  // categoriei câștigă cam două meciuri din trei față de una la întâmplare).
  const P = (model, x, c) => model.procent(c, x[c]);
  function alegeBot(s, p, nivel, model, r = Math.random) {
    const mana = s.j[p].mana, k = s.k;
    const cea = () => mana.reduce((b, x, i) => (P(model, x, k) > P(model, mana[b], k) ? i : b), 0);
    if (nivel === 0) return r() < 0.55 ? Math.floor(r() * mana.length) : cea();
    if (nivel === 1) return cea();
    const restul = x => CHEI.filter(c => c !== k).reduce((t, c) => t + P(model, x, c), 0) / (CHEI.length - 1);
    const scor = x => P(model, x, k) - 0.25 * restul(x);
    return mana.reduce((b, x, i) => (scor(x) > scor(mana[b]) ? i : b), 0);
  }
  function categorieBot(s, p, nivel, model, r = Math.random) {
    const mana = s.j[p].mana;
    if (nivel === 0) return CHEI[Math.floor(r() * CHEI.length)];
    const f = k => Math.max(...mana.map(x => P(model, x, k) - (nivel >= 2 ? 0.3 * model.forta(x) : 0)));
    return CHEI.reduce((b, k) => (f(k) > f(b) ? k : b), CHEI[0]);
  }

  // Pachetul automat: cele mai bune 20, dar amestecate pe categorii (nu doar cele mai
  // puternice; un pachet bun are și câteva mașini ușoare).
  function pachetAutomat(carti, model) {
    if (carti.length <= PACHET) return carti.slice();
    const ramase = carti.slice(), ales = [];
    let i = 0;
    while (ales.length < PACHET) {
      const k = CHEI[i++ % CHEI.length];
      ramase.sort((a, b) => model.procent(k, b[k]) + model.forta(b) - (model.procent(k, a[k]) + model.forta(a)));
      ales.push(ramase.shift());
    }
    return ales;
  }
  // Pachetul botului: pentru fiecare carte a ta, una de forță apropiată din tot jocul.
  function pachetPereche(pachet, model, r = Math.random) {
    const dupaForta = model.toate.map(x => [model.forta(x), x]).sort((a, b) => a[0] - b[0]);
    const folosite = new Set(pachet.map(x => x.k));
    return pachet.map(x => {
      const f = model.forta(x);
      const apr = dupaForta.filter(([g, y]) => Math.abs(g - f) < 0.05 && !folosite.has(y.k));
      const pick = apr.length ? apr[Math.floor(r() * apr.length)][1] : dupaForta[Math.floor(r() * dupaForta.length)][1];
      folosite.add(pick.k);
      return pick;
    });
  }

  const api = { PACHET, MANA, LA, CAT, CHEI, regula, rng, amesteca, creeaza, porneste, alegeCategoria, joaca, bate, alegeBot, categorieBot, pachetAutomat, pachetPereche };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CartiModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
