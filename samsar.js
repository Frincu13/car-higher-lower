// Cel mai bun samsar.
//
// Site-ul nu evaluează nimic: împarte runda, scrie instrucțiunea pentru agent și
// desenează verdictul primit înapoi. Tot ce ține de note vine din textul lipit,
// iar singurul lucru la care site-ul nu cedează e că o rundă se rulează o dată.
//
// Alegi o categorie de client, dai Start, și abia atunci se vede clientul. Cele
// două surprize nu se arată nicăieri, nici în instrucțiunea afișată pe ecran, dar
// intră în clar în textul copiat, pentru că agentul are nevoie de ele.
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

  const state = {
    cat: store.get('sms_cat', 'mix'),
    runda: null,
    nume: store.get('sms_nume', ['', '']),
    linkuri: ['', ''],
    promptReal: '',
  };

  const numeJucator = i => state.nume[i] || `Jucător ${i + 1}`;
  const nf = () => (S.en() ? 'en-GB' : 'ro-RO');
  const bani = n => `${new Intl.NumberFormat(nf()).format(n)} €`;
  const km = n => new Intl.NumberFormat(nf()).format(n);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const nota1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const nota2 = n => (Math.round(n * 100) / 100).toFixed(2);
  const categorie = key => S.CATEGORII.find(c => c.key === key) || S.CATEGORII[S.CATEGORII.length - 1];

  // ---------------------------------------------------------------- runda

  function trage(catKey) {
    const lista = S.dinCategorie(catKey);
    if (!lista.length) return false;
    const nr = store.get('sms_nr', 0) + 1;
    store.set('sms_nr', nr);

    // nu repetăm clientul din runda trecută dacă mai are cu cine fi schimbat
    const anterior = state.runda && state.runda.client.nume;
    const alegeri = lista.length > 1 ? lista.filter(c => c.nume !== anterior) : lista;
    const client = rnd(alegeri);

    const pachet = S.SURPRIZE.slice();
    const surprize = [];
    while (surprize.length < 2) {
      surprize.push(S.L(pachet.splice(Math.floor(Math.random() * pachet.length), 1)[0]));
    }

    state.runda = {
      nr, cat: catKey, client,
      criterii: client.criterii,
      buget: client.buget,
      maxim: client.maxim,
      surprize, cand: Date.now(),
      regula: catKey === 'mix' && Math.random() < 0.55 ? S.L(rnd(REGULI)) : null,
    };
    state.linkuri = ['', ''];
    tine();
    randeazaRunda();
    return true;
  }

  // Un refresh nu are voie să piardă runda: schimbarea limbii reîncarcă pagina,
  // iar clientul și surprizele trase o dată rămân trase.
  function tine() {
    store.set('sms_runda', state.runda);
    store.set('sms_linkuri', state.linkuri);
  }

  function randeazaRunda() {
    const r = state.runda;
    if (!r) { $('sms-draw').innerHTML = ''; return; }
    const c = r.client, d = S.L(c);
    const crit = r.criterii.map((k, i) => `<li><b>${i + 1}</b><span>${esc(S.label(k))}</span></li>`).join('');

    $('sms-draw').innerHTML = `
      <article class="sms-card">
        <div class="sms-card-main">
          <p class="sms-card-k">Clientul rundei <span class="sms-nr">#${r.nr}</span> <i>${esc(S.L(categorie(r.cat)).nume)}</i></p>
          <h3 class="sms-card-name" id="s-client-name">${esc(c.nume)}<em>${c.varsta} de ani</em></h3>
          <p class="sms-card-job">${esc(d.ocupatie)}</p>
          <p class="sms-card-ctx">${esc(d.context)}</p>
          <ul class="sms-uz">${d.uz.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
          <p class="sms-card-vrea">${esc(d.vrea)}</p>
        </div>
        <div class="sms-card-side">
          <div class="sms-budget">
            <span class="sms-b-k">Buget</span>
            <strong>${bani(r.buget[0])} - ${bani(r.buget[1])}</strong>
            <span class="sms-b-max">maxim absolut ${bani(r.maxim)}</span>
          </div>
          <p class="sms-card-k sms-crit-k">Ce contează pentru ${esc(c.nume)}</p>
          <ol class="sms-crit">${crit}</ol>
          ${r.regula ? `<p class="sms-rule"><span>Regulă</span>${esc(r.regula)}</p>` : ''}
        </div>
      </article>`;

    $('sms-seals').innerHTML = [1, 2].map(i =>
      `<span class="sms-seal"><b>Surpriza ${i}</b><span class="sms-hidden"></span></span>`).join('');

    $('s-brief-links').innerHTML = `<span class="sms-brief-k">Runda #${r.nr}</span>
      <strong>${esc(c.nume)}</strong>
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
    if (k === 'surpriza_1') return `${S.en() ? 'surprise' : 'surpriza'} 1: ${r.surprize[0]}`;
    if (k === 'surpriza_2') return `${S.en() ? 'surprise' : 'surpriza'} 2: ${r.surprize[1]}`;
    return S.label(k);
  }

  // Instrucțiunea merge la agent, nu la om, deci nu trece prin i18n.js.
  const TXT = {
    ro: {
      intro: 'Ești arbitru într-un joc care se numește Cel mai bun samsar. Doi jucători au adus câte un anunț real de mașină pentru același client. Tu dai note de la 1 la 10, unde 10 e cel mai bun, și spui cine a ales mai bine.',
      clientK: 'CLIENTUL', ani: 'de ani', cautaK: 'Caută',
      uzK: 'Cum folosește mașina', vreaK: 'Ce vrea',
      bugetK: 'Buget țintă', maximK: 'Maxim absolut',
      critK: 'CRITERIILE CLIENTULUI, în ordinea importanței',
      pretK: 'PRICE FIT, scară fixă',
      pretIn: (a, b) => `între ${a} și ${b} → 10`,
      pretPeste: m => `peste țintă, până la ${m} → 7`,
      pretMult: m => `peste maxim, până la ${m} → 4`,
      pretRau: 'peste atât → 1',
      surprizeK: 'CELE DOUĂ SURPRIZE',
      surprizeCum: 'Jucătorii nu le știu, așa că nu le-au putut căuta dinadins. Dă fiecărei mașini o notă pentru cât de bine stă la fiecare.',
      surprizaN: n => `surpriza ${n}`,
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
        '"scoruri" are exact cheile de mai sus, fiecare cu două numere între 1 și 10, în ordinea jucătorilor.',
        '"verdict" e o frază care spune cine câștigă și din ce a câștigat.',
      ].join('\n'),
    },
    en: {
      intro: 'You are the referee in a game called Cel mai bun samsar, the best car dealer. Two players have each brought a real car listing for the same client. You score from 1 to 10, where 10 is best, and say who chose better.',
      clientK: 'THE CLIENT', ani: 'years old', cautaK: 'Looking for',
      uzK: 'How the car gets used', vreaK: 'What they want',
      bugetK: 'Target budget', maximK: 'Absolute maximum',
      critK: 'THE CLIENT CRITERIA, most important first',
      pretK: 'PRICE FIT, a fixed ladder',
      pretIn: (a, b) => `between ${a} and ${b} → 10`,
      pretPeste: m => `over target, up to ${m} → 7`,
      pretMult: m => `over the maximum, up to ${m} → 4`,
      pretRau: 'above that → 1',
      surprizeK: 'THE TWO SURPRISES',
      surprizeCum: 'The players do not know them, so they could not have hunted for them on purpose. Score each car on how well it does on each one.',
      surprizaN: n => `surprise ${n}`,
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
        '"scoruri" has exactly the keys above, each with two numbers between 1 and 10, in player order.',
        '"verdict" is one sentence saying who wins and what won it.',
      ].join('\n'),
    },
  };

  // Semne care nu pot apărea în text, ca să putem scoate din instrucțiunea afișată
  // exact cele două surprize și nimic altceva.
  const MARCA = ['\u0001s1\u0001', '\u0001s2\u0001'];

  function construiestePrompt() {
    const t = S.en() ? TXT.en : TXT.ro;
    const r = state.runda, c = r.client, d = S.L(c);
    const chei = cheiRunda();

    const masina = '{ "titlu": "", "an": 0, "km": 0, "pret": 0, "cp": 0, "combustibil": "", "tractiune": "", "obs": "" }';
    const schemaScoruri = chei.map(k => `    "${k}": [0, 0]`).join(',\n');
    const schemaMotive = chei.map(k => `    "${k}": ""`).join(',\n');

    return `${t.intro}

${t.clientK}
${c.nume}, ${c.varsta} ${t.ani}, ${d.ocupatie}.
${d.context}
${t.cautaK}: ${S.L(categorie(r.cat)).nume.toLowerCase()}.
${t.uzK}: ${d.uz.join('; ')}.
${t.vreaK}: ${d.vrea}
${t.bugetK}: ${bani(r.buget[0])} - ${bani(r.buget[1])}. ${t.maximK}: ${bani(r.maxim)}.

${t.critK}
${r.criterii.map((k, i) => `${i + 1}. ${S.label(k)}\n   ${S.scala(k)}`).join('\n')}

${t.pretK}
${[t.pretIn(bani(r.buget[0]), bani(r.buget[1])), t.pretPeste(bani(r.maxim)),
    t.pretMult(bani(Math.round(r.maxim * 1.2))), t.pretRau].join('\n')}

${t.surprizeK}
${t.surprizaN(1)}: ${MARCA[0]}
${t.surprizaN(2)}: ${MARCA[1]}
${t.surprizeCum}
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

  // Textul copiat le are în clar; cel de pe ecran le are acoperite, ca să rămână
  // surpriză și pentru cel care lipește instrucțiunea în chat.
  function pregatestePrompt() {
    const brut = construiestePrompt();
    const s = state.runda.surprize;
    const pune = (t, cu) => t.split(MARCA[0]).join(cu(s[0])).split(MARCA[1]).join(cu(s[1]));
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
    return { randuri, masini: (obj.masini || []).slice(0, 2), lipsa, verdict: obj.verdict || '' };
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
          <span class="sms-note"><b>${nota2(note.client[i])}</b><em>nota clientului</em></span>
          <span class="sms-note sms-note-2"><b>${nota2(note.simpla[i])}</b><em>nota simplă</em></span>
        </div>
        ${fit ? `<p class="sms-fit ${fit[0]}">${fit[1]} · price fit ${nota1(pret.s[i])}</p>` : ''}
        <a class="sms-res-link" href="${esc(state.linkuri[i])}" target="_blank" rel="noopener">Vezi anunțul</a>
      </article>`;
    };

    const bare = decisive.map(x => `<li class="sms-bar ${x.d > 0 ? 'to-0' : 'to-1'}">
        <span class="sms-bar-k">${esc(x.eticheta)}${x.motiv ? `<em>${esc(x.motiv)}</em>` : ''}</span>
        <span class="sms-bar-track"><i style="width:${(Math.abs(x.d) / maxD * 50).toFixed(1)}%"></i></span>
        <span class="sms-bar-d">${x.d > 0 ? '+' : ''}${nota1(x.d)}</span>
      </li>`).join('');

    $('pane-verdict').innerHTML = `
      <div class="sms-verdict-top">
        <p class="sms-brief-k">Runda #${r.nr} · ${esc(r.client.nume)}</p>
        <h2>${esc(numeJucator(cast))} a găsit mașina</h2>
        ${rez.verdict ? `<p class="sms-verdict">${esc(rez.verdict)}</p>` : ''}
      </div>
      <div class="sms-results">${masina(0)}${masina(1)}</div>
      <div class="sms-pane-scroll">
        <div class="sms-seal-row">
          <span class="sms-seal-k">Surprizele erau</span>
          <div class="sms-seals">${r.surprize.map((s, i) =>
            `<span class="sms-seal is-open"><b>Surpriza ${i + 1}</b><strong>${esc(s)}</strong></span>`).join('')}</div>
        </div>
        ${altfel ? `<p class="sms-flip">La sumă simplă ar fi câștigat ${esc(numeJucator(cast === 0 ? 1 : 0))}. Topul clientului a întors runda.</p>` : ''}
        ${bare ? `<h3 class="sms-h3">Ce a decis runda</h3><ul class="sms-bars">${bare}</ul>` : ''}
      </div>`;

    const tabel = rez.randuri.map(x => `<tr class="${x.tip === 'surpriza' ? 'is-surpriza' : ''}${x.tip === 'pret' ? ' is-pret' : ''}">
      <th scope="row">${esc(x.eticheta)}</th>
      <td class="${x.s[0] > x.s[1] ? 'is-top' : ''}">${nota1(x.s[0])}</td>
      <td class="${x.s[1] > x.s[0] ? 'is-top' : ''}">${nota1(x.s[1])}</td>
    </tr>`).join('');

    $('pane-tabel').innerHTML = `
      <div class="sms-pane-scroll">
        <table class="sms-table">
          <thead><tr><th scope="col">Categorie</th><th scope="col">${esc(numeJucator(0))}</th><th scope="col">${esc(numeJucator(1))}</th></tr></thead>
          <tbody>${tabel}</tbody>
          <tfoot>
            <tr><th scope="row">Sumă</th><td>${nota1(note.suma[0])}</td><td>${nota1(note.suma[1])}</td></tr>
            <tr><th scope="row">Nota simplă</th><td>${nota2(note.simpla[0])}</td><td>${nota2(note.simpla[1])}</td></tr>
            <tr class="is-final"><th scope="row">Nota clientului</th><td>${nota2(note.client[0])}</td><td>${nota2(note.client[1])}</td></tr>
          </tfoot>
        </table>
        ${rez.lipsa.length ? `<p class="sms-warn">Agentul nu a dat notă la: ${esc(rez.lipsa.join(', '))}. Am socotit fără ele.</p>` : ''}
      </div>`;

    salveaza(cast, note);
    randeazaIstoric();
    haptic();
  }

  // ------------------------------------------------------------- istoricul

  function salveaza(cast, note) {
    const ist = store.get('sms_istoric', []);
    ist.unshift({
      nr: state.runda.nr,
      cine: state.runda.client.nume,
      nume: [numeJucator(0), numeJucator(1)],
      cast,
      note: note.client.map(n => +nota2(n)),
      cand: Date.now(),
    });
    store.set('sms_istoric', ist.slice(0, 40));
  }

  function randeazaIstoric() {
    const ist = store.get('sms_istoric', []);
    if (!ist.length) {
      $('pane-istoric').innerHTML = '<p class="sms-gol">Nicio rundă jucată încă.</p>';
      return;
    }
    const scor = {};
    for (const r of ist) { const n = r.nume[r.cast]; scor[n] = (scor[n] || 0) + 1; }
    const clasament = Object.entries(scor).sort((a, b) => b[1] - a[1])
      .map(([n, v]) => `<span><b>${esc(n)}</b>${v}</span>`).join('');
    $('pane-istoric').innerHTML = `
      <div class="sms-score">${clasament}</div>
      <div class="sms-pane-scroll">
        <ul class="sms-runs">${ist.map(r =>
          `<li><b>#${r.nr}</b><span>${esc(r.cine)}</span><em>${esc(r.nume[r.cast])}</em><i>${nota2(r.note[r.cast])}</i></li>`).join('')}</ul>
      </div>`;
  }

  // ------------------------------------------------------------------ legături

  function randeazaCategorii() {
    $('sms-cats').innerHTML = S.CATEGORII.map(c => {
      const d = S.L(c);
      const n = S.dinCategorie(c.key).length;
      const on = c.key === state.cat;
      return `<button type="button" role="radio" aria-checked="${on}" class="cat sms-cat${on ? ' is-on' : ''}" data-cat="${c.key}">
        <span class="cat-name">${esc(d.nume)}</span>
        <span class="cat-sub">${esc(d.tag)}</span>
        <span class="sms-cat-n">${n} ${n === 1 ? 'client' : 'clienți'}</span>
      </button>`;
    }).join('');
  }

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

  $('s-go-links').addEventListener('click', () => {
    $('s-name-0').value = state.nume[0];
    $('s-name-1').value = state.nume[1];
    $('s-link-0').value = state.linkuri[0];
    $('s-link-1').value = state.linkuri[1];
    show('screen-linkuri');
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

  $('s-new').addEventListener('click', () => { show('screen-alege'); haptic(); });

  document.querySelectorAll('[data-back]').forEach(b =>
    b.addEventListener('click', () => show(b.dataset.back)));

  randeazaCategorii();
  // Un refresh în timpul rundei o ține pe loc; peste două ore e o vizită nouă și
  // începem tot de la categorii. O rundă dintr-o versiune mai veche a datelor nu
  // mai poate fi desenată.
  const pastrata = store.get('sms_runda', null);
  const proaspata = pastrata && pastrata.cand && Date.now() - pastrata.cand < 2 * 3600e3;
  if (proaspata && pastrata.client && pastrata.client.ro && Array.isArray(pastrata.surprize)
      && typeof pastrata.surprize[0] === 'string') {
    state.runda = pastrata;
    state.cat = pastrata.cat;
    state.linkuri = store.get('sms_linkuri', ['', '']);
    randeazaCategorii();
    randeazaRunda();
    show('screen-client');
  } else {
    store.set('sms_runda', null);
  }
})();
