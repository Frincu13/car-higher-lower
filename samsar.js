// Cel mai bun samsar.
//
// Două echipe de samsari. În fiecare rundă se bat doi oameni, câte unul din
// fiecare echipă: cumpără de pe un anunț real și cer un preț de la client.
// Clientul ia o singură mașină, pe cea cu nota mai mare, la prețul cerut, iar
// diferența față de cât a dat samsarul pe ea intră în buzunarul echipei.
// Celălalt rămâne cu mașina în curte și nu ia nimic. La final câștigă echipa cu
// mai mulți bani.
//
// Prețul cerut intră în price fit, deci în notă: ceri mult și câștigi mult, dar
// scazi șansa de a lua clientul. Agentul dă doar notele, banii îi face site-ul.
//
// Site-ul nu evaluează nimic: împarte runda, scrie instrucțiunea pentru agent și
// desenează verdictul primit înapoi. O rundă se rulează o dată.
//
// Interfața e scrisă în română și tradusă de i18n.js, ca la celelalte jocuri.
// Instrucțiunea pentru agent nu poate trece pe acolo, fiind un bloc lung dintr-o
// bucată, deci stă în TXT, în ambele limbi.
(() => {
  'use strict';

  const { store, esc, haptic } = window.Shared;
  const S = window.SAMSAR;
  const $ = id => document.getElementById(id);
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));

  // Cât cântărește fiecare criteriu al clientului, după locul din topul lui.
  // Primul contează aproape dublu față de ultimul; surprizele intră cu 1.
  const PONDERI = [1.5, 1.3, 1.15, 1.0, 0.9, 0.8];
  const P_SURPRIZA = 1.0;

  const MARIMI = [1, 2, 3, 4];
  const TURURI = [[1, 'un tur'], [2, 'două tururi'], [3, 'trei tururi']];

  // Regulile din categoria mix. Fiecare taie din ce ai voie să aduci, deci schimbă
  // vânătoarea, nu notele.
  const REGULI = [
    { ro: 'doar mașini cu cutie manuală', en: 'manual gearbox only' },
    { ro: 'doar mașini mai vechi de 15 ani', en: 'only cars older than 15 years' },
    { ro: 'doar mașini sub 150.000 km', en: 'only cars under 150,000 km' },
    { ro: 'doar break, combi sau familială', en: 'estates and people carriers only' },
    { ro: 'doar diesel', en: 'diesel only' },
    { ro: 'doar mașini care nu sunt germane', en: 'no German cars' },
    { ro: 'doar mașini cu tracțiune spate', en: 'rear-wheel drive only' },
    { ro: 'doar anunțuri din afara țării', en: 'only listings from abroad' },
    { ro: 'doar culori tari: nu gri, nu negru, nu alb', en: 'strong colours only: no grey, black or white' },
    { ro: 'doar mașini cu mai mult de doi proprietari', en: 'only cars with more than two owners' },
  ];

  const NUME_ECHIPE = ['Roșii', 'Albii'];

  const state = {
    marime: store.get('sms_marime', 1),
    tururi: store.get('sms_tururi', 1),
    echipe: store.get('sms_echipe', null),
    bani: [0, 0],
    runda: 0,
    total: 1,
    meci: [],
    cat: store.get('sms_cat', 'mix'),
    duel: null,
    intrari: [{ link: '', cumparat: '', cerut: '' }, { link: '', cumparat: '', cerut: '' }],
    promptReal: '',
  };

  const nf = () => (S.en() ? 'en-GB' : 'ro-RO');
  const bani = n => `${new Intl.NumberFormat(nf()).format(Math.round(n))} €`;
  const cuSemn = n => (n > 0 ? '+' : '') + bani(n);
  const km = n => new Intl.NumberFormat(nf()).format(n);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const nota1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const nota2 = n => (Math.round(n * 100) / 100).toFixed(2);
  const categorie = key => S.CATEGORII.find(c => c.key === key) || S.CATEGORII[S.CATEGORII.length - 1];

  // Echipa e[0] joacă mereu împotriva echipei e[1]; în runda r se bat oamenii de
  // pe același loc din listă, iar la al doilea tur se reia de la primul.
  const numeEchipa = t => (state.echipe && state.echipe[t].nume) || NUME_ECHIPE[t];
  const duelistul = (t, r = state.runda) => {
    const l = state.echipe ? state.echipe[t].jucatori : [];
    return l[r % Math.max(1, l.length)] || `Jucător ${t + 1}`;
  };

  // ------------------------------------------------------------- echipele

  function randeazaSetup() {
    $('sms-sizes').innerHTML = MARIMI.map(n => {
      const on = n === state.marime;
      return `<button type="button" role="radio" aria-checked="${on}" class="cat sms-cat${on ? ' is-on' : ''}" data-marime="${n}">
        <span class="cat-name">${n} la ${n}</span>
      </button>`;
    }).join('');

    $('sms-tururi').innerHTML = TURURI.map(([n, et]) => {
      const on = n === state.tururi;
      return `<button type="button" role="radio" aria-checked="${on}" class="cat sms-cat${on ? ' is-on' : ''}" data-tururi="${n}">
        <span class="cat-name">${esc(et)}</span>
        <span class="cat-sub">${n * state.marime} ${n * state.marime === 1 ? 'rundă' : 'runde'}</span>
      </button>`;
    }).join('');

    const vechi = state.echipe;
    $('sms-teams').innerHTML = [0, 1].map(t => `
      <div class="sms-team p${t}">
        <input class="sms-team-name" id="s-team-${t}" maxlength="14" autocomplete="off"
          value="${esc(vechi ? vechi[t].nume : NUME_ECHIPE[t])}" aria-label="Numele echipei ${t + 1}">
        <div class="sms-team-p">
          ${Array.from({ length: state.marime }, (_, i) => `<input class="sms-name" id="s-p-${t}-${i}"
            maxlength="14" autocomplete="off" placeholder="Jucător ${i + 1}"
            value="${esc(vechi && vechi[t].jucatori[i] ? vechi[t].jucatori[i] : '')}"
            aria-label="Jucătorul ${i + 1} din echipa ${t + 1}">`).join('')}
        </div>
      </div>`).join('');
  }

  function citesteEchipe() {
    state.echipe = [0, 1].map(t => ({
      nume: $(`s-team-${t}`).value.trim() || NUME_ECHIPE[t],
      jucatori: Array.from({ length: state.marime }, (_, i) =>
        $(`s-p-${t}-${i}`).value.trim() || `Jucător ${i + 1}`),
    }));
    store.set('sms_echipe', state.echipe);
    store.set('sms_marime', state.marime);
    store.set('sms_tururi', state.tururi);
  }

  function incepeMeci() {
    state.bani = [0, 0];
    state.runda = 0;
    state.total = state.marime * state.tururi;
    state.meci = [];
    state.duel = null;
    tine();
  }

  // ---------------------------------------------------------------- runda

  function randeazaHud() {
    const r = state.runda + 1;
    const html = `<span class="sms-hud-r">Runda ${r} / ${state.total}</span>
      <span class="sms-hud-t p0"><b>${esc(numeEchipa(0))}</b><i>${bani(state.bani[0])}</i></span>
      <span class="sms-hud-t p1"><b>${esc(numeEchipa(1))}</b><i>${bani(state.bani[1])}</i></span>
      <span class="sms-hud-duel"><b class="p0">${esc(duelistul(0))}</b> contra <b class="p1">${esc(duelistul(1))}</b></span>`;
    document.querySelectorAll('[data-hud]').forEach(el => { el.innerHTML = html; });
  }

  function trage(catKey) {
    const lista = S.dinCategorie(catKey);
    if (!lista.length) return false;

    const anterior = state.duel && state.duel.client.nume;
    const alegeri = lista.length > 1 ? lista.filter(c => c.nume !== anterior) : lista;
    const client = rnd(alegeri);

    const pachet = S.surprizeDin(catKey).slice();
    const surprize = [];
    while (surprize.length < 2) {
      surprize.push(S.L(pachet.splice(Math.floor(Math.random() * pachet.length), 1)[0]));
    }

    state.duel = {
      cat: catKey, client,
      criterii: client.criterii,
      buget: client.buget,
      maxim: client.maxim,
      surprize, cand: Date.now(),
      regula: catKey === 'mix' && Math.random() < 0.55 ? S.L(rnd(REGULI)) : null,
    };
    state.intrari = [{ link: '', cumparat: '', cerut: '' }, { link: '', cumparat: '', cerut: '' }];
    tine();
    randeazaDuel();
    return true;
  }

  // Un refresh nu are voie să piardă meciul: schimbarea limbii reîncarcă pagina.
  function tine() {
    store.set('sms_meci', {
      marime: state.marime, tururi: state.tururi, echipe: state.echipe,
      bani: state.bani, runda: state.runda, total: state.total,
      meci: state.meci, cat: state.cat, duel: state.duel, intrari: state.intrari,
    });
  }

  function randeazaDuel() {
    const d = state.duel;
    if (!d) { $('sms-draw').innerHTML = ''; return; }
    const c = d.client, t = S.L(c);
    const crit = d.criterii.map((k, i) => `<li><b>${i + 1}</b><span>${esc(S.label(k))}</span></li>`).join('');

    $('sms-draw').innerHTML = `
      <article class="sms-card">
        <div class="sms-card-main">
          <p class="sms-card-k">Clientul rundei <i>${esc(S.L(categorie(d.cat)).nume)}</i></p>
          <h3 class="sms-card-name" id="s-client-name">${esc(c.nume)}<em>${c.varsta} de ani</em></h3>
          <p class="sms-card-job">${esc(t.ocupatie)}</p>
          <p class="sms-poveste">${esc(t.poveste)}</p>
        </div>
        <div class="sms-card-side">
          <div class="sms-budget">
            <span class="sms-b-k">Buget</span>
            <strong>${bani(d.buget[0])} - ${bani(d.buget[1])}</strong>
            <span class="sms-b-max">maxim absolut ${bani(d.maxim)}</span>
          </div>
          <p class="sms-card-k sms-crit-k">Ce contează pentru ${esc(c.nume)}</p>
          <ol class="sms-crit">${crit}</ol>
          ${d.regula ? `<p class="sms-rule"><span>Regulă</span>${esc(d.regula)}</p>` : ''}
        </div>
      </article>`;

    $('sms-seals').innerHTML = [1, 2].map(i =>
      `<span class="sms-seal"><b>Surpriza ${i}</b><span class="sms-hidden"></span></span>`).join('');
    randeazaHud();
    incape();
  }

  // Poveștile nu au toate aceeași lungime, iar cardul nu are voie nici să iasă din
  // ecran, nici să taie un rând. Așa că micșorăm povestea până intră, jumătate de
  // pixel pe pas, și o lăsăm la loc când e loc destul.
  function incape() {
    const card = $('sms-draw').querySelector('.sms-card');
    const p = card && card.querySelector('.sms-poveste');
    if (!p) return;
    p.style.fontSize = '';
    if (card.scrollHeight <= card.clientHeight + 1) return;
    let px = parseFloat(getComputedStyle(p).fontSize);
    for (let i = 0; i < 20 && px > 9.5 && card.scrollHeight > card.clientHeight + 1; i++) {
      px -= 0.5;
      p.style.fontSize = `${px}px`;
    }
  }

  // Fonturile ajung după primul desen, iar rotirea telefonului schimbă tot.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(incape);
  window.addEventListener('resize', incape);

  function randeazaLinkuri() {
    $('s-links-form').innerHTML = [0, 1].map(t => `
      <label class="sms-link p${t}">
        <span class="sms-link-k">${esc(duelistul(t))} <i>${esc(numeEchipa(t))}</i></span>
        <textarea id="s-link-${t}" rows="2" placeholder="Lipește linkul anunțului" spellcheck="false"
          aria-label="Linkul lui ${esc(duelistul(t))}">${esc(state.intrari[t].link)}</textarea>
        <div class="sms-prices">
          <label class="sms-price"><span>Cât dai pe ea</span>
            <input id="s-buy-${t}" type="text" inputmode="numeric" autocomplete="off" placeholder="0"
              value="${esc(state.intrari[t].cumparat)}" aria-label="Cât plătește ${esc(duelistul(t))}"></label>
          <label class="sms-price"><span>Cât ceri</span>
            <input id="s-ask-${t}" type="text" inputmode="numeric" autocomplete="off" placeholder="0"
              value="${esc(state.intrari[t].cerut)}" aria-label="Cât cere ${esc(duelistul(t))}"></label>
        </div>
      </label>`).join('');
    randeazaHud();
  }

  // ---------------------------------------------------------- instrucțiunea

  const cheiRunda = () => ['price_fit', ...state.duel.criterii, 'surpriza_1', 'surpriza_2'];

  function eticheta(k) {
    const d = state.duel;
    if (k === 'price_fit') return `price fit (${bani(d.buget[0])} - ${bani(d.buget[1])})`;
    if (k === 'surpriza_1') return `${S.en() ? 'surprise' : 'surpriza'} 1: ${d.surprize[0]}`;
    if (k === 'surpriza_2') return `${S.en() ? 'surprise' : 'surpriza'} 2: ${d.surprize[1]}`;
    return S.label(k);
  }

  const TXT = {
    ro: {
      intro: 'Ești arbitru într-un joc care se numește Cel mai bun samsar. Doi samsari au cumpărat câte o mașină de pe un anunț real și i-o oferă aceluiași client, fiecare la prețul lui. Clientul cumpără o singură mașină, pe cea cu nota mai mare, la prețul cerut. Tu dai notele, atât.',
      clientK: 'CLIENTUL', ani: 'de ani', cautaK: 'Caută',
      bugetK: 'Buget țintă', maximK: 'Maxim absolut',
      critK: 'CRITERIILE CLIENTULUI, în ordinea importanței',
      pretK: 'PRICE FIT, scară fixă, socotită pe prețul cerut de samsar, nu pe cel din anunț',
      pretIn: (a, b) => `între ${a} și ${b} → 10`,
      pretPeste: m => `peste țintă, până la ${m} → 7`,
      pretMult: m => `peste maxim, până la ${m} → 4`,
      pretRau: 'peste atât → 1',
      surprizeK: 'CELE DOUĂ SURPRIZE',
      surprizeCum: 'Sunt alese dintre lucrurile care contează pentru un client ca ăsta, dar samsarii nu le știu, deci nu le-au putut căuta dinadins. Dă fiecărei mașini o notă pentru cât de bine stă la fiecare.',
      surprizaN: n => `surpriza ${n}`,
      regulaK: 'REGULA RUNDEI',
      regulaCum: 'O mașină care nu o respectă primește o notă mult mai mică la criteriul cel mai important, și o spui explicit în verdict.',
      oferteK: 'OFERTELE',
      oferta: (p, link, dat, cerut) => `${p}: ${link}\n   a dat ${dat} pe ea și o cere ${cerut}`,
      oferteCum: 'Judeci fiecare mașină la prețul cerut de samsarul ei, nu la prețul din anunț. Cine cere mult trebuie să aducă o mașină pe măsură, altfel pierde la price fit și pierde clientul.',
      cumK: 'CUM LUCREZI',
      pasi: [
        'Deschide ambele anunțuri. Citește prețul, anul, kilometrajul, motorizarea, dotările și descrierea, inclusiv pozele dacă le poți vedea.',
        'Scrie mai întâi faptele extrase din fiecare anunț. Abia după aceea dă note.',
        'Notele au o zecimală. Nu da aceeași notă la amândouă decât dacă sunt chiar egale la criteriul ăla.',
        'Fiecare notă are un motiv de un rând, care citează ceva concret din anunț. Dacă anunțul nu spune nimic despre criteriu, zi asta în motiv și notează prudent.',
        'Totalul nu are voie să fie egal. Dacă iese egal, ajustează la criteriul cel mai puțin important.',
        'Nu inventa dotări care nu apar în anunț.',
      ],
      raspunsK: 'CUM RĂSPUNZI',
      raspunsCum: 'Întâi un bloc de cod cu JSON exact în forma de mai jos, cu numere, nu text. Apoi, sub bloc, explicațiile pe categorii, în cuvintele tale.',
      note: p => [
        `"masini" în ordinea samsarilor, ${p} prima.`,
        '"scoruri" are exact cheile de mai sus, fiecare cu două numere între 1 și 10.',
        '"verdict" e o frază care spune cine ia clientul și de ce.',
      ].join('\n'),
    },
    en: {
      intro: 'You are the referee in a game called Cel mai bun samsar, the best car dealer. Two dealers have each bought a car from a real listing and are offering it to the same client, each at their own price. The client buys one car only, the one with the higher score, at the price asked. You give the scores, nothing else.',
      clientK: 'THE CLIENT', ani: 'years old', cautaK: 'Looking for',
      bugetK: 'Target budget', maximK: 'Absolute maximum',
      critK: 'THE CLIENT CRITERIA, most important first',
      pretK: 'PRICE FIT, a fixed ladder, worked out on the price the dealer asks, not the listing price',
      pretIn: (a, b) => `between ${a} and ${b} → 10`,
      pretPeste: m => `over target, up to ${m} → 7`,
      pretMult: m => `over the maximum, up to ${m} → 4`,
      pretRau: 'above that → 1',
      surprizeK: 'THE TWO SURPRISES',
      surprizeCum: 'They are drawn from the things that matter to a client like this one, but the dealers do not know them, so they could not have hunted for them on purpose. Score each car on how well it does on each one.',
      surprizaN: n => `surprise ${n}`,
      regulaK: 'RULE OF THE ROUND',
      regulaCum: 'A car that breaks it gets a much lower score on the most important criterion, and you say so in the verdict.',
      oferteK: 'THE OFFERS',
      oferta: (p, link, dat, cerut) => `${p}: ${link}\n   paid ${dat} for it and asks ${cerut}`,
      oferteCum: 'Judge each car at the price its dealer asks, not at the listing price. Whoever asks a lot has to bring a car to match, or they lose on price fit and lose the client.',
      cumK: 'HOW YOU WORK',
      pasi: [
        'Open both listings. Read the price, year, mileage, engine, equipment and description, including the photos if you can see them.',
        'Write down the facts from each listing first. Only then give scores.',
        'Scores have one decimal. Do not give both cars the same score unless they really are equal on that criterion.',
        'Every score gets a one-line reason that quotes something concrete from the listing. If the listing says nothing about a criterion, say that in the reason and score cautiously.',
        'The totals must not be equal. If they come out equal, adjust the least important criterion.',
        'Do not invent equipment that does not appear in the listing.',
      ],
      raspunsK: 'HOW YOU ANSWER',
      raspunsCum: 'First a code block with JSON in exactly the shape below, with numbers, not words. Then, under the block, your explanations per category, in your own words.',
      note: p => [
        `"masini" in dealer order, ${p} first.`,
        '"scoruri" has exactly the keys above, each with two numbers between 1 and 10.',
        '"verdict" is one sentence saying who gets the client and why.',
      ].join('\n'),
    },
  };

  // Semne care nu pot apărea în text, ca să scoatem din instrucțiunea afișată
  // exact cele două surprize și nimic altceva.
  const MARCA = ['\u0001s1\u0001', '\u0001s2\u0001'];

  function construiestePrompt() {
    const t = S.en() ? TXT.en : TXT.ro;
    const d = state.duel, c = d.client, q = S.L(c);
    const chei = cheiRunda();

    const masina = '{ "titlu": "", "an": 0, "km": 0, "pret": 0, "cp": 0, "combustibil": "", "tractiune": "", "obs": "" }';
    const schemaScoruri = chei.map(k => `    "${k}": [0, 0]`).join(',\n');
    const schemaMotive = chei.map(k => `    "${k}": ""`).join(',\n');
    const oferte = [0, 1].map(i => t.oferta(duelistul(i), state.intrari[i].link,
      bani(+state.intrari[i].cumparat), bani(+state.intrari[i].cerut))).join('\n');

    return `${t.intro}

${t.clientK}
${c.nume}, ${c.varsta} ${t.ani}, ${q.ocupatie}.
${q.poveste}
${t.cautaK}: ${S.L(categorie(d.cat)).nume.toLowerCase()}.
${t.bugetK}: ${bani(d.buget[0])} - ${bani(d.buget[1])}. ${t.maximK}: ${bani(d.maxim)}.

${t.critK}
${d.criterii.map((k, i) => `${i + 1}. ${S.label(k)}\n   ${S.scala(k)}`).join('\n')}

${t.pretK}
${[t.pretIn(bani(d.buget[0]), bani(d.buget[1])), t.pretPeste(bani(d.maxim)),
    t.pretMult(bani(Math.round(d.maxim * 1.2))), t.pretRau].join('\n')}

${t.surprizeK}
${t.surprizaN(1)}: ${MARCA[0]}
${t.surprizaN(2)}: ${MARCA[1]}
${t.surprizeCum}
${d.regula ? `\n${t.regulaK}\n${d.regula}. ${t.regulaCum}\n` : ''}
${t.oferteK}
${oferte}
${t.oferteCum}

${t.cumK}
${t.pasi.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${t.raspunsK}
${t.raspunsCum}

\`\`\`json
{
  "masini": [
    ${masina},
    ${masina}
  ],
  "scoruri": {
${schemaScoruri}
  },
  "motive": {
${schemaMotive}
  },
  "verdict": ""
}
\`\`\`

${t.note(duelistul(0))}`;
  }

  function pregatestePrompt() {
    const brut = construiestePrompt();
    const s = state.duel.surprize;
    const pune = (x, cu) => x.split(MARCA[0]).join(cu(s[0])).split(MARCA[1]).join(cu(s[1]));
    state.promptReal = pune(brut, w => w);
    const acoperit = w => '•'.repeat(Math.max(8, Math.min(22, w.length)));
    $('s-prompt').textContent = pune(brut, acoperit);
  }

  // ------------------------------------------------------------- răspunsul

  const curata = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const numar = v => {
    if (typeof v === 'number') return v;
    const m = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  // Prețurile scrise de jucători vin cu puncte de mii, spații sau €.
  const suma = v => {
    const m = String(v).replace(/[^\d]/g, '');
    return m ? parseInt(m, 10) : 0;
  };

  function jsonDin(text) {
    const incearca = s => { try { return JSON.parse(s); } catch { return null; } };
    const gard = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (gard) { const o = incearca(gard[1]); if (o) return o; }
    const start = text.indexOf('{');
    if (start < 0) return null;
    for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
      const o = incearca(text.slice(start, end + 1));
      if (o) return o;
    }
    return null;
  }

  // Varianta de rezervă: agentul a dat tabelul frumos în loc de JSON.
  function dinTabel(text) {
    const tinte = cheiRunda().map(k => ({ k, n: curata(eticheta(k)) }));
    const scoruri = {};
    for (const linie of text.split('\n')) {
      if ((linie.match(/\|/g) || []).length < 2) continue;
      const cel = linie.split('|').map(s => s.trim()).filter((s, i, a) => !(i === 0 && !s) && !(i === a.length - 1 && !s));
      if (cel.length < 3 || /^[-: ]+$/.test(cel[1])) continue;
      const nume = curata(cel[0]);
      if (!nume || /^(suma|sum|categorie|category|nota|score|total)/.test(nume)) continue;
      const a = numar(cel[1]), b = numar(cel[2]);
      if (a == null || b == null) continue;
      const tinta = tinte.find(t => t.n === nume)
        || tinte.find(t => t.n.startsWith(nume) || nume.startsWith(t.n))
        || tinte.find(t => t.n.split(' ')[0] === nume.split(' ')[0]);
      if (tinta && !scoruri[tinta.k]) scoruri[tinta.k] = [a, b];
    }
    return Object.keys(scoruri).length >= 3 ? { scoruri, masini: [], motive: {} } : null;
  }

  function citeste(text) {
    const brut = jsonDin(text);
    const obj = brut && brut.scoruri ? brut : dinTabel(text);
    if (!obj) return { eroare: 'Nu am găsit nici blocul de date, nici tabelul. Lipește tot răspunsul agentului, cu tot cu blocul de cod.' };

    const randuri = [], lipsa = [];
    for (const k of cheiRunda()) {
      const pereche = obj.scoruri[k];
      const a = Array.isArray(pereche) ? numar(pereche[0]) : null;
      const b = Array.isArray(pereche) ? numar(pereche[1]) : null;
      if (a == null || b == null) { lipsa.push(eticheta(k)); continue; }
      randuri.push({
        k, eticheta: eticheta(k),
        tip: k === 'price_fit' ? 'pret' : k.startsWith('surpriza_') ? 'surpriza' : 'criteriu',
        rang: k.startsWith('surpriza_') || k === 'price_fit' ? -1 : state.duel.criterii.indexOf(k),
        s: [Math.min(10, Math.max(0, a)), Math.min(10, Math.max(0, b))],
        motiv: (obj.motive || {})[k] || '',
      });
    }
    if (randuri.length < 4) {
      return { eroare: 'Am găsit prea puține note. Cere-i agentului blocul de date din instrucțiune.' };
    }

    return { randuri, masini: (obj.masini || []).slice(0, 2), lipsa, verdict: obj.verdict || '' };
  }

  function socoteste(randuri) {
    const suma2 = [0, 0], pond = [0, 0];
    let greutate = 0;
    for (const r of randuri) {
      suma2[0] += r.s[0]; suma2[1] += r.s[1];
      if (r.tip === 'pret') continue;
      const w = r.tip === 'surpriza' ? P_SURPRIZA : (PONDERI[r.rang] ?? 1);
      pond[0] += r.s[0] * w; pond[1] += r.s[1] * w;
      greutate += w;
    }
    const n = randuri.length;
    return { suma: suma2, simpla: [suma2[0] / n, suma2[1] / n], client: [pond[0] / greutate, pond[1] / greutate] };
  }

  // ------------------------------------------------------------- verdictul

  function randeazaRezultat(rez) {
    const d = state.duel;
    const note = socoteste(rez.randuri);

    const dat = [0, 1].map(i => suma(state.intrari[i].cumparat));
    const cerut = [0, 1].map(i => suma(state.intrari[i].cerut));
    // Clientul cumpără o singură mașină, pe cea cu nota mai mare, și o ia la
    // prețul cerut. Celălalt rămâne cu mașina în curte și nu ia nimic.
    const cast = note.client[0] === note.client[1]
      ? (cerut[0] - dat[0] >= cerut[1] - dat[1] ? 0 : 1)
      : (note.client[0] > note.client[1] ? 0 : 1);
    const profit = [0, 1].map(i => (i === cast ? cerut[i] - dat[i] : 0));

    state.bani = [state.bani[0] + profit[0], state.bani[1] + profit[1]];
    state.meci.push({
      runda: state.runda + 1,
      client: d.client.nume,
      jucatori: [duelistul(0), duelistul(1)],
      masini: [0, 1].map(i => (rez.masini[i] || {}).titlu || ''),
      dat, cerut, profit, cast,
      note: note.client.map(n => +nota2(n)),
    });
    tine();

    const pret = rez.randuri.find(x => x.tip === 'pret');
    const decisive = rez.randuri
      .filter(x => x.tip !== 'pret')
      .map(x => ({ ...x, d: x.s[0] - x.s[1] }))
      .filter(x => Math.abs(x.d) >= 0.2)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 4);
    const maxD = Math.max(1, ...decisive.map(x => Math.abs(x.d)));

    const deal = i => {
      const m = rez.masini[i] || {};
      const fapte = [m.an, m.km ? `${km(m.km)} km` : '', m.cp ? `${m.cp} CP` : '', m.combustibil].filter(Boolean);
      return `<article class="sms-res p${i} ${i === cast ? 'is-win' : ' is-fail'}">
        <p class="sms-res-k">${esc(duelistul(i))}${i === cast ? '<b>ia clientul</b>' : ''}</p>
        <h3 class="sms-res-name">${esc(m.titlu || `Mașina ${i + 1}`)}</h3>
        ${fapte.length ? `<p class="sms-res-facts">${fapte.map(f => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
        <p class="sms-deal"><span>a dat ${bani(dat[i])}</span><span>a cerut ${bani(cerut[i])}</span></p>
        <p class="sms-paid">${i === cast ? 'Clientul îi ia mașina' : 'Rămâne cu ea în curte'}</p>
        <p class="sms-profit ${profit[i] > 0 ? 'is-plus' : profit[i] < 0 ? 'is-minus' : 'is-zero'}">${cuSemn(profit[i])}</p>
        <p class="sms-res-nota">nota clientului ${nota2(note.client[i])}${pret ? ` · price fit ${nota1(pret.s[i])}` : ''}</p>
        <a class="sms-res-link" href="${esc(state.intrari[i].link)}" target="_blank" rel="noopener">Vezi anunțul</a>
      </article>`;
    };

    const bare = decisive.map(x => `<li class="sms-bar ${x.d > 0 ? 'to-0' : 'to-1'}">
        <span class="sms-bar-k">${esc(x.eticheta)}${x.motiv ? `<em>${esc(x.motiv)}</em>` : ''}</span>
        <span class="sms-bar-track"><i style="width:${(Math.abs(x.d) / maxD * 50).toFixed(1)}%"></i></span>
        <span class="sms-bar-d">${x.d > 0 ? '+' : ''}${nota1(x.d)}</span>
      </li>`).join('');

    $('pane-verdict').innerHTML = `
      <div class="sms-verdict-top">
        <p class="sms-brief-k">Runda ${state.runda + 1} / ${state.total} · ${esc(d.client.nume)}</p>
        <h2><span>${esc(numeEchipa(cast))}</span> ia runda</h2>
        ${rez.verdict ? `<p class="sms-verdict">${esc(rez.verdict)}</p>` : ''}
      </div>
      <div class="sms-results">${deal(0)}${deal(1)}</div>
      <div class="sms-pane-scroll">
        <div class="sms-seal-row">
          <span class="sms-seal-k">Surprizele erau</span>
          <div class="sms-seals">${d.surprize.map((s, i) =>
            `<span class="sms-seal is-open"><b>Surpriza ${i + 1}</b><strong>${esc(s)}</strong></span>`).join('')}</div>
        </div>
        ${bare ? `<h3 class="sms-h3">Ce a decis notele</h3><ul class="sms-bars">${bare}</ul>` : ''}
      </div>`;

    const tabel = rez.randuri.map(x => `<tr class="${x.tip === 'surpriza' ? 'is-surpriza' : ''}${x.tip === 'pret' ? ' is-pret' : ''}">
      <th scope="row">${esc(x.eticheta)}</th>
      <td class="${x.s[0] > x.s[1] ? 'is-top' : ''}">${nota1(x.s[0])}</td>
      <td class="${x.s[1] > x.s[0] ? 'is-top' : ''}">${nota1(x.s[1])}</td>
    </tr>`).join('');

    $('pane-tabel').innerHTML = `
      <div class="sms-pane-scroll">
        <table class="sms-table">
          <thead><tr><th scope="col">Categorie</th><th scope="col">${esc(duelistul(0))}</th><th scope="col">${esc(duelistul(1))}</th></tr></thead>
          <tbody>${tabel}</tbody>
          <tfoot>
            <tr><th scope="row">Nota simplă</th><td>${nota2(note.simpla[0])}</td><td>${nota2(note.simpla[1])}</td></tr>
            <tr class="is-final"><th scope="row">Nota clientului</th><td>${nota2(note.client[0])}</td><td>${nota2(note.client[1])}</td></tr>
          </tfoot>
        </table>
        ${rez.lipsa.length ? `<p class="sms-warn">Agentul nu a dat notă la: ${esc(rez.lipsa.join(', '))}. Am socotit fără ele.</p>` : ''}
      </div>`;

    randeazaMeci($('pane-istoric'));

    const ultima = state.runda + 1 >= state.total;
    $('s-next').textContent = ultima ? 'Finalul meciului' : 'Runda următoare';
    $('s-next').dataset.final = ultima ? '1' : '';
    haptic();
  }

  // --------------------------------------------------------------- meciul

  function randeazaMeci(box) {
    const r = state.meci;
    box.innerHTML = `
      <div class="sms-score">
        <span class="p0"><b>${esc(numeEchipa(0))}</b>${bani(state.bani[0])}</span>
        <span class="p1"><b>${esc(numeEchipa(1))}</b>${bani(state.bani[1])}</span>
      </div>
      <div class="sms-pane-scroll">
        ${r.length ? `<ul class="sms-runs">${r.map(x =>
          `<li><b>#${x.runda}</b><span>${esc(x.client)}</span><em class="p${x.cast}">${esc(x.jucatori[x.cast])}</em><i class="${x.profit[x.cast] > 0 ? 'is-plus' : ''}">${cuSemn(x.profit[x.cast])}</i></li>`).join('')}</ul>`
          : '<p class="sms-gol">Nicio rundă jucată încă.</p>'}
      </div>`;
  }

  function randeazaFinal() {
    const c = state.bani[0] === state.bani[1] ? -1 : (state.bani[0] > state.bani[1] ? 0 : 1);
    const rows = state.meci.map(x => `<li><b>#${x.runda}</b><span>${esc(x.client)}</span>
      <em class="p0">${cuSemn(x.profit[0])}</em><em class="p1">${cuSemn(x.profit[1])}</em></li>`).join('');
    $('s-final').innerHTML = `
      <div class="sms-final-top">
        <p class="eyebrow">Final de meci · ${state.total} ${state.total === 1 ? 'rundă' : 'runde'}</p>
        <h2 class="sms-final-h">${c < 0 ? 'Egalitate' : `<span>${esc(numeEchipa(c))}</span> câștigă`}</h2>
      </div>
      <div class="sms-final-score">
        ${[0, 1].map(t => `<div class="sms-fteam p${t} ${t === c ? 'is-win' : ''}">
          <p class="sms-fteam-k">${esc(numeEchipa(t))}</p>
          <p class="sms-fteam-b">${bani(state.bani[t])}</p>
          <p class="sms-fteam-p">${state.echipe[t].jucatori.map(j => esc(j)).join(' · ')}</p>
        </div>`).join('')}
      </div>
      <div class="sms-pane-scroll">
        <h3 class="sms-h3">Rundă cu rundă</h3>
        <ul class="sms-runs sms-runs-2">${rows}</ul>
      </div>`;
  }

  // ------------------------------------------------------------------ legături

  function randeazaCategorii() {
    $('sms-cats').innerHTML = S.CATEGORII.map(c => {
      const t = S.L(c);
      const n = S.dinCategorie(c.key).length;
      const on = c.key === state.cat;
      return `<button type="button" role="radio" aria-checked="${on}" class="cat sms-cat${on ? ' is-on' : ''}" data-cat="${c.key}">
        <span class="cat-name">${esc(t.nume)}</span>
        <span class="cat-sub">${esc(t.tag)}</span>
        <span class="sms-cat-n">${n} ${n === 1 ? 'client' : 'clienți'}</span>
      </button>`;
    }).join('');
  }

  $('sms-sizes').addEventListener('click', e => {
    const b = e.target.closest('[data-marime]');
    if (!b) return;
    citesteEchipe();
    state.marime = +b.dataset.marime;
    randeazaSetup();
    haptic();
  });

  $('sms-tururi').addEventListener('click', e => {
    const b = e.target.closest('[data-tururi]');
    if (!b) return;
    state.tururi = +b.dataset.tururi;
    randeazaSetup();
    haptic();
  });

  $('s-begin').addEventListener('click', () => {
    citesteEchipe();
    incepeMeci();
    randeazaHud();
    show('screen-alege');
    haptic();
  });

  $('sms-cats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    store.set('sms_cat', state.cat);
    randeazaCategorii();
    haptic();
  });

  $('s-start').addEventListener('click', () => {
    if (!trage(state.cat)) return;
    show('screen-client');
    haptic();
  });

  $('s-redraw').addEventListener('click', () => { trage(state.cat); haptic(); });

  $('s-go-links').addEventListener('click', () => { randeazaLinkuri(); show('screen-linkuri'); });

  $('s-make').addEventListener('click', () => {
    state.intrari = [0, 1].map(t => ({
      link: $(`s-link-${t}`).value.trim(),
      cumparat: $(`s-buy-${t}`).value.trim(),
      cerut: $(`s-ask-${t}`).value.trim(),
    }));
    const err = $('s-links-err');
    for (let t = 0; t < 2; t++) {
      const p = state.intrari[t];
      if (!/^https?:\/\/\S+/i.test(p.link)) {
        err.textContent = `Mai lipsește linkul lui ${duelistul(t)}. Trebuie să înceapă cu http.`;
        err.hidden = false; return;
      }
      if (!suma(p.cumparat) || !suma(p.cerut)) {
        err.textContent = `${duelistul(t)} nu a scris și cât dă pe ea, și cât cere.`;
        err.hidden = false; return;
      }
    }
    err.hidden = true;
    tine();
    pregatestePrompt();
    show('screen-prompt');
  });

  $('s-copy').addEventListener('click', async () => {
    const btn = $('s-copy');
    try {
      await navigator.clipboard.writeText(state.promptReal);
      btn.textContent = 'Copiat';
    } catch {
      // fără permisiune pentru clipboard: copiem dintr-o casetă ascunsă, ca să nu
      // ajungă surprizele pe ecran
      const cutie = document.createElement('textarea');
      cutie.value = state.promptReal;
      cutie.setAttribute('readonly', '');
      cutie.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(cutie);
      cutie.select();
      let mers = false;
      try { mers = document.execCommand('copy'); } catch { mers = false; }
      cutie.remove();
      btn.textContent = mers ? 'Copiat' : 'Nu am putut copia';
    }
    haptic();
    setTimeout(() => { btn.textContent = 'Copiază'; }, 2200);
  });

  $('s-go-result').addEventListener('click', () => {
    $('s-out').hidden = true;
    $('s-paste-wrap').hidden = false;
    show('screen-rezultat');
    $('s-paste').focus();
  });

  $('s-show').addEventListener('click', () => {
    const err = $('s-paste-err');
    const rez = citeste($('s-paste').value);
    if (rez.eroare) { err.textContent = rez.eroare; err.hidden = false; return; }
    err.hidden = true;
    randeazaRezultat(rez);
    $('s-paste-wrap').hidden = true;
    $('s-out').hidden = false;
    paneaza('verdict');
  });

  function paneaza(nume) {
    $('s-tabs').querySelectorAll('[data-pane]').forEach(b => {
      const on = b.dataset.pane === nume;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on);
    });
    ['verdict', 'tabel', 'istoric'].forEach(k => {
      const el = $(`pane-${k}`);
      el.hidden = k !== nume;
      el.classList.toggle('is-on', k === nume);
    });
  }

  $('s-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-pane]');
    if (b) { paneaza(b.dataset.pane); haptic(); }
  });

  $('s-next').addEventListener('click', () => {
    if ($('s-next').dataset.final) {
      randeazaFinal();
      show('screen-final');
    } else {
      state.runda++;
      state.duel = null;
      tine();
      randeazaHud();
      show('screen-alege');
    }
    haptic();
  });

  $('s-rematch').addEventListener('click', () => {
    incepeMeci();
    randeazaHud();
    show('screen-alege');
    haptic();
  });

  $('s-newteams').addEventListener('click', () => { randeazaSetup(); show('screen-echipe'); haptic(); });

  document.querySelectorAll('[data-back]').forEach(b =>
    b.addEventListener('click', () => show(b.dataset.back)));

  // Un refresh în timpul meciului îl ține pe loc; peste două ore e o vizită nouă.
  const p = store.get('sms_meci', null);
  const proaspat = p && p.duel && p.duel.cand && Date.now() - p.duel.cand < 2 * 3600e3;
  randeazaCategorii();
  if (proaspat && p.echipe && p.duel.client && p.duel.client.ro) {
    Object.assign(state, {
      marime: p.marime, tururi: p.tururi, echipe: p.echipe, bani: p.bani,
      runda: p.runda, total: p.total, meci: p.meci || [], cat: p.cat, duel: p.duel,
      intrari: p.intrari || state.intrari,
    });
    randeazaSetup();
    randeazaCategorii();
    randeazaDuel();
    show('screen-client');
  } else {
    store.set('sms_meci', null);
    randeazaSetup();
  }
})();
