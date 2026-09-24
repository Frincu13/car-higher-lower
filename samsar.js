// Cel mai bun samsar.
//
// Site-ul nu evaluează nimic: împarte runda, scrie instrucțiunea pentru agent și
// desenează verdictul primit înapoi. Tot ce ține de note vine din textul lipit,
// iar singurul lucru la care site-ul nu cedează e că o rundă se rulează o dată.
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

  const MODURI = [
    ['client', 'Client cu poveste', 'Un om, un buget, șase criterii ale lui'],
    ['categorie', 'Categorie', 'Cea mai bună din clasă, fără client'],
    ['mix', 'Mix', 'Tras la sorți, uneori cu o regulă în plus'],
  ];

  // Regulile din modul mix. Fiecare taie din ce ai voie să aduci, deci schimbă
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

  const state = {
    mod: store.get('sms_mod', 'client'),
    runda: null,
    nume: store.get('sms_nume', ['', '']),
    linkuri: ['', ''],
    rezultat: null,
  };

  const numeJucator = i => state.nume[i] || `Jucător ${i + 1}`;
  const nf = () => (S.en() ? 'en-GB' : 'ro-RO');
  const bani = n => `${new Intl.NumberFormat(nf()).format(n)} €`;
  const km = n => new Intl.NumberFormat(nf()).format(n);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const nota1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const nota2 = n => (Math.round(n * 100) / 100).toFixed(2);

  // Clientul își ține numele afară, categoria îl are în limba aleasă.
  const numeSursa = c => c.nume || S.L(c).nume;

  // ---------------------------------------------------------------- runda

  function trage() {
    const nr = store.get('sms_nr', 0) + 1;
    store.set('sms_nr', nr);

    const mod = state.mod === 'mix' ? rnd(['client', 'categorie']) : state.mod;
    const sursa = mod === 'client' ? rnd(S.CLIENTI) : rnd(S.CATEGORII);

    const pachet = S.SURPRIZE.slice();
    const surprize = [];
    while (surprize.length < 2) {
      const clar = S.L(pachet.splice(Math.floor(Math.random() * pachet.length), 1)[0]);
      surprize.push({ clar, cod: S.codeaza(clar) });
    }

    state.runda = {
      nr, mod, sursa,
      criterii: sursa.criterii,
      buget: sursa.buget,
      maxim: sursa.maxim,
      surprize,
      regula: state.mod === 'mix' && Math.random() < 0.55 ? S.L(rnd(REGULI)) : null,
    };
    state.rezultat = null;
    state.linkuri = ['', ''];
    tine();
    randeazaRunda();
  }

  // Un refresh nu are voie să piardă runda: schimbarea limbii reîncarcă pagina,
  // iar clientul și surprizele trase o dată rămân trase.
  function tine() {
    store.set('sms_runda', state.runda);
    store.set('sms_linkuri', state.linkuri);
  }

  function randeazaRunda() {
    const r = state.runda;
    const c = r.sursa;
    const d = S.L(c);
    const crit = r.criterii.map((k, i) => `<li><b>${i + 1}</b><span>${esc(S.label(k))}</span></li>`).join('');
    const buget = `<div class="sms-budget">
            <span class="sms-b-k">Buget</span>
            <strong>${bani(r.buget[0])} - ${bani(r.buget[1])}</strong>
            <span class="sms-b-max">maxim absolut ${bani(r.maxim)}</span>
          </div>`;
    const regula = r.regula ? `<p class="sms-rule"><span>Regulă</span>${esc(r.regula)}</p>` : '';

    $('sms-draw').innerHTML = r.mod === 'client' ? `
      <article class="sms-card">
        <div class="sms-card-main">
          <p class="sms-card-k">Clientul rundei <span class="sms-nr">#${r.nr}</span></p>
          <h3 class="sms-card-name">${esc(c.nume)}<em>${c.varsta} de ani</em></h3>
          <p class="sms-card-job">${esc(d.ocupatie)}</p>
          <p class="sms-card-ctx">${esc(d.context)}</p>
          <ul class="sms-uz">${d.uz.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
          <p class="sms-card-vrea">${esc(d.vrea)}</p>
        </div>
        <div class="sms-card-side">
          ${buget}
          <p class="sms-card-k sms-crit-k">Ce contează pentru ${esc(c.nume)}</p>
          <ol class="sms-crit">${crit}</ol>
          ${regula}
        </div>
      </article>` : `
      <article class="sms-card sms-card-cat">
        <div class="sms-card-main">
          <p class="sms-card-k">Categoria rundei <span class="sms-nr">#${r.nr}</span></p>
          <h3 class="sms-card-name">${esc(d.nume)}<em>${esc(d.tag)}</em></h3>
          <p class="sms-card-ctx">${esc(d.desc)}</p>
        </div>
        <div class="sms-card-side">
          ${buget}
          <p class="sms-card-k sms-crit-k">Pe ce se dau notele</p>
          <ol class="sms-crit">${crit}</ol>
          ${regula}
        </div>
      </article>`;

    $('sms-seals').innerHTML = r.surprize.map((s, i) =>
      `<span class="sms-seal"><b>Surpriza ${i + 1}</b><code>${esc(s.cod)}</code></span>`).join('');

    $('s-brief-links').innerHTML = `<span class="sms-brief-k">Runda #${r.nr}</span>
      <strong>${esc(numeSursa(c))}</strong>
      <span>${bani(r.buget[0])} - ${bani(r.buget[1])}</span>
      ${r.regula ? `<span class="sms-brief-rule">${esc(r.regula)}</span>` : ''}`;
  }

  // ---------------------------------------------------------- instrucțiunea

  // Cheile din JSON sunt cele pe care le știe site-ul, în ordinea din rundă, ca
  // să nu depindă randarea de cum decide agentul să numească rândurile.
  const cheiRunda = () => ['price_fit', ...state.runda.criterii, 'surpriza_1', 'surpriza_2'];

  function eticheta(k) {
    const r = state.runda;
    if (k === 'price_fit') return `price fit (${bani(r.buget[0])} - ${bani(r.buget[1])})`;
    if (k === 'surpriza_1') return `${S.en() ? 'surprise' : 'surpriza'} 1: ${r.surprize[0].clar}`;
    if (k === 'surpriza_2') return `${S.en() ? 'surprise' : 'surpriza'} 2: ${r.surprize[1].clar}`;
    return S.label(k);
  }

  // Instrucțiunea merge la agent, nu la om, deci nu trece prin i18n.js.
  const TXT = {
    ro: {
      intro: 'Ești arbitru într-un joc care se numește Cel mai bun samsar. Doi jucători au adus câte un anunț real de mașină pentru aceeași cerere. Tu dai note de la 1 la 10, unde 10 e cel mai bun, și spui cine a ales mai bine.',
      clientK: 'CLIENTUL', catK: 'CATEGORIA', ani: 'de ani',
      uzK: 'Cum folosește mașina', vreaK: 'Ce vrea',
      bugetK: 'Buget țintă', maximK: 'Maxim absolut',
      critClient: 'CRITERIILE CLIENTULUI, în ordinea importanței',
      critCat: 'CRITERIILE CATEGORIEI, în ordinea importanței',
      pretK: 'PRICE FIT, scară fixă',
      pretIn: (a, b) => `între ${a} și ${b} → 10`,
      pretPeste: m => `peste țintă, până la ${m} → 7`,
      pretMult: m => `peste maxim, până la ${m} → 4`,
      pretRau: 'peste atât → 1',
      surprizeK: 'CELE DOUĂ SURPRIZE, codate',
      surprizeCod: rot => `Fiecare literă a fost mutată cu ${rot} poziții în față în alfabetul englez. Scade ${rot} din fiecare literă ca să afli cuvântul.`,
      surprizaN: n => `surpriza ${n}`,
      surprizeApoi: 'Decodează-le întâi, apoi dă fiecărei mașini o notă pentru cât de bine stă la surpriza aia.',
      regulaK: 'REGULA RUNDEI',
      regulaCum: 'O mașină care nu o respectă primește o notă mult mai mică la criteriul cel mai important, și o spui explicit în verdict.',
      anunturiK: 'ANUNȚURILE',
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
        `"masini" în ordinea jucătorilor, ${p} prima.`,
        '"surprize" sunt cele două cuvinte decodate, în clar.',
        '"scoruri" are exact cheile de mai sus, fiecare cu două numere între 1 și 10, în ordinea jucătorilor.',
        '"verdict" e o frază care spune cine câștigă și din ce a câștigat.',
      ].join('\n'),
    },
    en: {
      intro: 'You are the referee in a game called Cel mai bun samsar, the best car dealer. Two players have each brought a real car listing for the same brief. You score from 1 to 10, where 10 is best, and say who chose better.',
      clientK: 'THE CLIENT', catK: 'THE CATEGORY', ani: 'years old',
      uzK: 'How the car gets used', vreaK: 'What they want',
      bugetK: 'Target budget', maximK: 'Absolute maximum',
      critClient: 'THE CLIENT CRITERIA, most important first',
      critCat: 'THE CATEGORY CRITERIA, most important first',
      pretK: 'PRICE FIT, a fixed ladder',
      pretIn: (a, b) => `between ${a} and ${b} → 10`,
      pretPeste: m => `over target, up to ${m} → 7`,
      pretMult: m => `over the maximum, up to ${m} → 4`,
      pretRau: 'above that → 1',
      surprizeK: 'THE TWO SURPRISES, encoded',
      surprizeCod: rot => `Every letter has been moved ${rot} places forward in the English alphabet. Subtract ${rot} from each letter to read the word.`,
      surprizaN: n => `surprise ${n}`,
      surprizeApoi: 'Decode them first, then score each car on how well it does on that surprise.',
      regulaK: 'RULE OF THE ROUND',
      regulaCum: 'A car that breaks it gets a much lower score on the most important criterion, and you say so in the verdict.',
      anunturiK: 'THE LISTINGS',
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
        `"masini" in player order, ${p} first.`,
        '"surprize" are the two decoded words, in the clear.',
        '"scoruri" has exactly the keys above, each with two numbers between 1 and 10, in player order.',
        '"verdict" is one sentence saying who wins and what won it.',
      ].join('\n'),
    },
  };

  function construiestePrompt() {
    const t = S.en() ? TXT.en : TXT.ro;
    const r = state.runda, c = r.sursa, d = S.L(c);
    const chei = cheiRunda();
    const bugetLinie = `${t.bugetK}: ${bani(r.buget[0])} - ${bani(r.buget[1])}. ${t.maximK}: ${bani(r.maxim)}.`;

    const cine = r.mod === 'client'
      ? `${t.clientK}
${c.nume}, ${c.varsta} ${t.ani}, ${d.ocupatie}.
${d.context}
${t.uzK}: ${d.uz.join('; ')}.
${t.vreaK}: ${d.vrea}
${bugetLinie}`
      : `${t.catK}
${d.nume}, ${d.tag}.
${d.desc}
${bugetLinie}`;

    const criterii = r.criterii.map((k, i) => `${i + 1}. ${S.label(k)}\n   ${S.scala(k)}`).join('\n');
    const scara = [
      t.pretIn(bani(r.buget[0]), bani(r.buget[1])),
      t.pretPeste(bani(r.maxim)),
      t.pretMult(bani(Math.round(r.maxim * 1.2))),
      t.pretRau,
    ].join('\n');

    const masina = '{ "titlu": "", "an": 0, "km": 0, "pret": 0, "cp": 0, "combustibil": "", "tractiune": "", "obs": "" }';
    const schemaScoruri = chei.map(k => `    "${k}": [0, 0]`).join(',\n');
    const schemaMotive = chei.map(k => `    "${k}": ""`).join(',\n');

    return `${t.intro}

${cine}

${r.mod === 'client' ? t.critClient : t.critCat}
${criterii}

${t.pretK}
${scara}

${t.surprizeK}
${t.surprizeCod(S.ROT)}
${t.surprizaN(1)}: ${r.surprize[0].cod}
${t.surprizaN(2)}: ${r.surprize[1].cod}
${t.surprizeApoi}
${r.regula ? `\n${t.regulaK}\n${r.regula}. ${t.regulaCum}\n` : ''}
${t.anunturiK}
${numeJucator(0)}: ${state.linkuri[0]}
${numeJucator(1)}: ${state.linkuri[1]}

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
  "surprize": ["", ""],
  "scoruri": {
${schemaScoruri}
  },
  "motive": {
${schemaMotive}
  },
  "verdict": ""
}
\`\`\`

${t.note(numeJucator(0))}`;
  }

  // ------------------------------------------------------------- răspunsul

  const curata = s => String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const numar = v => {
    if (typeof v === 'number') return v;
    const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  function jsonDin(text) {
    const incearca = s => { try { return JSON.parse(s); } catch { return null; } };
    const gard = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (gard) { const o = incearca(gard[1]); if (o) return o; }
    const start = text.indexOf('{');
    if (start < 0) return null;
    // de la ultima acoladă spre stânga: prinde obiectul complet chiar dacă
    // agentul a mai scris ceva după el
    for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
      const o = incearca(text.slice(start, end + 1));
      if (o) return o;
    }
    return null;
  }

  // Varianta de rezervă: agentul a dat tabelul frumos în loc de JSON. Potrivim
  // rândurile după cum arată eticheta, nu după poziție, pentru că ordinea sare.
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
        rang: k.startsWith('surpriza_') || k === 'price_fit' ? -1 : state.runda.criterii.indexOf(k),
        s: [Math.min(10, Math.max(0, a)), Math.min(10, Math.max(0, b))],
        motiv: (obj.motive || {})[k] || '',
      });
    }
    if (randuri.length < 4) {
      return { eroare: 'Am găsit prea puține note. Cere-i agentului blocul de date din instrucțiune.' };
    }

    const decodat = (obj.surprize || []).map(curata);
    const asteptat = state.runda.surprize.map(s => curata(s.clar));
    const gresit = asteptat.map((a, i) => (decodat[i] && decodat[i] !== a ? { a, b: obj.surprize[i] } : null)).filter(Boolean);

    return { randuri, masini: (obj.masini || []).slice(0, 2), lipsa, gresit, verdict: obj.verdict || '' };
  }

  // Două note: una simplă, media tuturor rândurilor, ca să se potrivească cu
  // socoteala de pe hârtie; una a clientului, care scoate price fit din medie
  // și cântărește criteriile după locul lor în topul din brief.
  function socoteste(randuri) {
    const suma = [0, 0], pond = [0, 0];
    let greutate = 0;
    for (const r of randuri) {
      suma[0] += r.s[0]; suma[1] += r.s[1];
      if (r.tip === 'pret') continue;
      const w = r.tip === 'surpriza' ? P_SURPRIZA : (PONDERI[r.rang] ?? 1);
      pond[0] += r.s[0] * w; pond[1] += r.s[1] * w;
      greutate += w;
    }
    const n = randuri.length;
    return { suma, simpla: [suma[0] / n, suma[1] / n], client: [pond[0] / greutate, pond[1] / greutate] };
  }

  // ------------------------------------------------------------- verdictul

  function randeazaRezultat(rez) {
    const r = state.runda;
    const note = socoteste(rez.randuri);
    const cast = note.client[0] === note.client[1]
      ? (note.simpla[0] >= note.simpla[1] ? 0 : 1)
      : (note.client[0] > note.client[1] ? 0 : 1);
    const altfel = (note.simpla[0] > note.simpla[1] ? 0 : 1) !== cast;
    const notaK = r.mod === 'client' ? 'nota clientului' : 'nota categoriei';

    const pret = rez.randuri.find(x => x.tip === 'pret');
    const decisive = rez.randuri
      .filter(x => x.tip !== 'pret')
      .map(x => ({ ...x, d: x.s[0] - x.s[1] }))
      .filter(x => Math.abs(x.d) >= 0.2)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 4);
    const maxD = Math.max(1, ...decisive.map(x => Math.abs(x.d)));

    const masina = i => {
      const m = rez.masini[i] || {};
      const fapte = [m.an, m.km ? `${km(m.km)} km` : '', m.cp ? `${m.cp} CP` : '', m.combustibil, m.tractiune].filter(Boolean);
      const fit = pret ? (pret.s[i] >= 10 ? ['is-in', 'În buget'] : pret.s[i] >= 7 ? ['is-over', 'Peste țintă'] : ['is-out', 'Peste maxim']) : null;
      return `<article class="sms-res ${i === cast ? 'is-win' : ''}">
        <p class="sms-res-k">${esc(numeJucator(i))}${i === cast ? '<b>câștigă</b>' : ''}</p>
        <h3 class="sms-res-name">${esc(m.titlu || `Mașina ${i + 1}`)}</h3>
        ${m.pret ? `<p class="sms-res-price">${bani(m.pret)}</p>` : ''}
        ${fapte.length ? `<p class="sms-res-facts">${fapte.map(f => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
        <div class="sms-res-notes">
          <span class="sms-note"><b>${nota2(note.client[i])}</b><em>${notaK}</em></span>
          <span class="sms-note sms-note-2"><b>${nota2(note.simpla[i])}</b><em>nota simplă</em></span>
        </div>
        ${fit ? `<p class="sms-fit ${fit[0]}">${fit[1]} · price fit ${nota1(pret.s[i])}</p>` : ''}
        <a class="sms-res-link" href="${esc(state.linkuri[i])}" target="_blank" rel="noopener">Vezi anunțul</a>
      </article>`;
    };

    const bare = decisive.map(x => `<li class="sms-bar ${x.d > 0 ? 'to-0' : 'to-1'}">
        <span class="sms-bar-k">${esc(x.eticheta)}</span>
        <span class="sms-bar-track"><i style="width:${(Math.abs(x.d) / maxD * 50).toFixed(1)}%"></i></span>
        <span class="sms-bar-d">${x.d > 0 ? '+' : ''}${nota1(x.d)}</span>
      </li>`).join('');

    const tabel = rez.randuri.map(x => `<tr class="${x.tip === 'surpriza' ? 'is-surpriza' : ''}${x.tip === 'pret' ? ' is-pret' : ''}">
      <th scope="row">${esc(x.eticheta)}${x.motiv ? `<em>${esc(x.motiv)}</em>` : ''}</th>
      <td class="${x.s[0] > x.s[1] ? 'is-top' : ''}">${nota1(x.s[0])}</td>
      <td class="${x.s[1] > x.s[0] ? 'is-top' : ''}">${nota1(x.s[1])}</td>
    </tr>`).join('');

    $('s-out').innerHTML = `
      <div class="sms-wrap">
        <p class="sms-brief-k">Runda #${r.nr} · ${esc(numeSursa(r.sursa))}</p>
        <h2 class="sms-h">${esc(numeJucator(cast))} a găsit mașina</h2>
        ${rez.verdict ? `<p class="sms-verdict">${esc(rez.verdict)}</p>` : ''}

        <div class="sms-results">${masina(0)}${masina(1)}</div>

        ${altfel ? `<p class="sms-flip">La sumă simplă ar fi câștigat ${esc(numeJucator(cast === 0 ? 1 : 0))}. Topul clientului a întors runda.</p>` : ''}

        <div class="sms-reveal">
          <h3 class="sms-h3">Surprizele erau</h3>
          <div class="sms-seals">${r.surprize.map((s, i) =>
            `<span class="sms-seal is-open"><b>Surpriza ${i + 1}</b><code>${esc(s.cod)}</code><strong>${esc(s.clar)}</strong></span>`).join('')}</div>
          ${rez.gresit.length ? `<p class="sms-warn">Agentul a decodat altfel: a scris ${esc(rez.gresit[0].b)} în loc de ${esc(rez.gresit[0].a)}. Notele de la surpriza aia sunt de luat cu rezervă.</p>` : ''}
        </div>

        ${bare ? `<div class="sms-decisive">
          <h3 class="sms-h3">Ce a decis runda</h3>
          <ul class="sms-bars">${bare}</ul>
        </div>` : ''}

        <div class="sms-table-wrap">
          <h3 class="sms-h3">Tabelul complet</h3>
          <table class="sms-table">
            <thead><tr><th scope="col">Categorie</th><th scope="col">${esc(numeJucator(0))}</th><th scope="col">${esc(numeJucator(1))}</th></tr></thead>
            <tbody>${tabel}</tbody>
            <tfoot>
              <tr><th scope="row">Sumă</th><td>${nota1(note.suma[0])}</td><td>${nota1(note.suma[1])}</td></tr>
              <tr><th scope="row">Nota simplă</th><td>${nota2(note.simpla[0])}</td><td>${nota2(note.simpla[1])}</td></tr>
              <tr class="is-final"><th scope="row">${notaK}</th><td>${nota2(note.client[0])}</td><td>${nota2(note.client[1])}</td></tr>
            </tfoot>
          </table>
        </div>

        ${rez.lipsa.length ? `<p class="sms-warn">Agentul nu a dat notă la: ${esc(rez.lipsa.join(', '))}. Am socotit fără ele.</p>` : ''}

        <div class="start-actions sms-actions">
          <button class="btn btn-primary" id="s-new" type="button">Rundă nouă</button>
          <a class="btn btn-ghost" href="index.html">Jocuri</a>
        </div>
        <div class="sms-history" id="s-history"></div>
      </div>`;

    $('s-new').addEventListener('click', () => { trage(); show('screen-runda'); window.scrollTo(0, 0); });
    salveaza(cast, note);
    randeazaIstoric($('s-history'));
    haptic();
  }

  // ------------------------------------------------------------- istoricul

  function salveaza(cast, note) {
    const ist = store.get('sms_istoric', []);
    ist.unshift({
      nr: state.runda.nr,
      cine: numeSursa(state.runda.sursa),
      nume: [numeJucator(0), numeJucator(1)],
      cast,
      note: note.client.map(n => +nota2(n)),
      cand: Date.now(),
    });
    store.set('sms_istoric', ist.slice(0, 40));
  }

  function randeazaIstoric(box) {
    if (!box) return;
    const ist = store.get('sms_istoric', []);
    if (!ist.length) { box.innerHTML = ''; return; }
    const scor = {};
    for (const r of ist) { const n = r.nume[r.cast]; scor[n] = (scor[n] || 0) + 1; }
    const clasament = Object.entries(scor).sort((a, b) => b[1] - a[1])
      .map(([n, v]) => `<span><b>${esc(n)}</b>${v}</span>`).join('');
    box.innerHTML = `<h3 class="sms-h3">Runde jucate</h3>
      <div class="sms-score">${clasament}</div>
      <ul class="sms-runs">${ist.slice(0, 8).map(r =>
        `<li><b>#${r.nr}</b><span>${esc(r.cine)}</span><em>${esc(r.nume[r.cast])}</em><i>${nota2(r.note[r.cast])}</i></li>`).join('')}</ul>`;
  }

  // ------------------------------------------------------------------ legături

  function randeazaModuri() {
    $('sms-modes').innerHTML = MODURI.map(([k, nume, sub]) =>
      `<button type="button" class="cat${k === state.mod ? ' is-on' : ''}" role="radio" aria-checked="${k === state.mod}" data-mod="${k}">
        <span class="cat-name">${esc(nume)}</span>
        <span class="cat-sub">${esc(sub)}</span>
      </button>`).join('');
  }

  $('sms-modes').addEventListener('click', e => {
    const b = e.target.closest('[data-mod]');
    if (!b) return;
    state.mod = b.dataset.mod;
    store.set('sms_mod', state.mod);
    randeazaModuri();
    trage();
    haptic();
  });

  $('s-redraw').addEventListener('click', () => { trage(); haptic(); });

  $('s-go-links').addEventListener('click', () => {
    $('s-name-0').value = state.nume[0];
    $('s-name-1').value = state.nume[1];
    $('s-link-0').value = state.linkuri[0];
    $('s-link-1').value = state.linkuri[1];
    show('screen-linkuri');
    window.scrollTo(0, 0);
  });

  $('s-links-form').addEventListener('submit', e => {
    e.preventDefault();
    state.nume = [$('s-name-0').value.trim(), $('s-name-1').value.trim()];
    store.set('sms_nume', state.nume);
    state.linkuri = [$('s-link-0').value.trim(), $('s-link-1').value.trim()];
    const err = $('s-links-err');
    const lipsa = state.linkuri.findIndex(l => !/^https?:\/\/\S+/i.test(l));
    if (lipsa >= 0) {
      err.textContent = `Mai lipsește linkul lui ${numeJucator(lipsa)}. Trebuie să înceapă cu http.`;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    tine();
    $('s-prompt').textContent = construiestePrompt();
    show('screen-prompt');
    window.scrollTo(0, 0);
  });

  $('s-copy').addEventListener('click', async () => {
    const btn = $('s-copy');
    try {
      await navigator.clipboard.writeText($('s-prompt').textContent);
      btn.textContent = 'Copiat';
    } catch {
      // fără permisiune pentru clipboard: selectăm textul și lăsăm omul să apese
      const sel = window.getSelection(), rg = document.createRange();
      rg.selectNodeContents($('s-prompt')); sel.removeAllRanges(); sel.addRange(rg);
      btn.textContent = 'Selectat, copiază';
    }
    haptic();
    setTimeout(() => { btn.textContent = 'Copiază'; }, 2200);
  });

  $('s-back-links').addEventListener('click', () => { show('screen-linkuri'); window.scrollTo(0, 0); });

  $('s-go-result').addEventListener('click', () => {
    $('s-out').hidden = true;
    $('s-paste-wrap').hidden = false;
    show('screen-rezultat');
    window.scrollTo(0, 0);
    $('s-paste').focus();
  });

  $('s-show').addEventListener('click', () => {
    const err = $('s-paste-err');
    const rez = citeste($('s-paste').value);
    if (rez.eroare) { err.textContent = rez.eroare; err.hidden = false; return; }
    err.hidden = true;
    state.rezultat = rez;
    randeazaRezultat(rez);
    $('s-paste-wrap').hidden = true;
    $('s-out').hidden = false;
    window.scrollTo(0, 0);
  });

  document.querySelectorAll('[data-back]').forEach(b =>
    b.addEventListener('click', () => { show(b.dataset.back); window.scrollTo(0, 0); }));

  randeazaModuri();
  // O rundă salvată înainte ca datele să fie bilingve nu mai poate fi desenată.
  const pastrata = store.get('sms_runda', null);
  if (pastrata && pastrata.criterii && pastrata.surprize && pastrata.sursa && pastrata.sursa.ro) {
    state.runda = pastrata;
    state.linkuri = store.get('sms_linkuri', ['', '']);
    randeazaRunda();
  } else {
    trage();
  }
})();
