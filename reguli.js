// Butonul „?" din antetul fiecărui joc: regulile pe scurt, pentru modul în care ești.
// Acolo unde pagina are deja fereastra „Cum se joacă" (#how), „?" o deschide pe aceea;
// altfel face una, cu aceleași clase, deci se închide la fel (Închide, Înapoi, Escape).
// Panoul se pune în pagină înainte de DOMContentLoaded, ca shared.js să-l prindă la
// panouri (focus, inert, butonul Înapoi al telefonului).
(() => {
  'use strict';
  const pag = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  const q = new URLSearchParams(location.search);
  const online = ['online', 'zi', 'duel', 'live'].some(k => q.has(k));

  const BANI = 'Fiecare partidă cu cronometru aduce bani în Garajul meu; o partidă bună are bonus, iar partidele și victoriile cu prietenii aduc împreună cel mult 60 mil. pe zi.';
  const CAMERA = [
    ['Miza', 'Opțională. O pun amândoi; câștigătorul ia potul minus 10%, la egal fiecare își ia miza înapoi. Victoria aduce oricum 10 mil.'],
    ['Dacă pleacă cineva', 'Jocul merge mai departe singur, cu timpul: cine nu mută la timp pierde tura.'],
  ];
  // Licitația, pe larg și cu exemple (aceleași reguli pe un telefon și în camere). Notele
  // din exemple sunt cele reale (grades.js): 300 CP = 5,3, 700 CP = 7,8, 1.200 kg = 6,9...
  const LICITATIE = [
    ['Pe scurt', `<ol class="reg-pasi">
      <li><b>Licitați</b> 12 mașini, pe rând. Fiecare are 10 mil. și trebuie să termine cu 4 mașini.</li>
      <li><b>Așezați</b> pe ascuns cele 4 mașini pe 4 categorii, câte una pe fiecare.</li>
      <li><b>Pe fiecare categorie</b>, mașina cu nota mai mare câștigă 5 mil.</li>
    </ol><p>Câștigă cine are mai mulți bani la final: ce i-a rămas, plus premiile din categorii.</p>`],
    ['Categoriile', `<p>Fiecare mașină are o notă de la 0 la 10 pe fiecare dintre cele 8 categorii de mai jos. La fiecare partidă se trag 4 dintre ele: <b>două le vezi de la început</b>, celelalte <b>două apar abia după licitație</b>.</p>
      <ul class="reg-cat">
        <li><b>Putere</b><span>Caii putere. 300 CP = 5,3 · 500 CP = 6,8 · 700 CP = 7,8 · 1.000 CP = 8,8</span></li>
        <li><b>Cuplu</b><span>Forța la plecare. 400 Nm = 5,8 · 600 Nm = 7,0 · 900 Nm = 8,2</span></li>
        <li><b>Greutate</b><span>Mai ușoară, notă mai mare. 900 kg = 9,1 · 1.200 kg = 6,9 · 1.500 kg = 5,2 · 2.000 kg = 3,1</span></li>
        <li><b>Viteză maximă</b><span>250 km/h = 5,0 · 300 km/h = 6,5 · 350 km/h = 7,9</span></li>
        <li><b>Accelerație</b><span>Timpul 0-100 km/h; mai mic, notă mai mare. 3 s = 9,3 · 4 s = 8,2 · 6 s = 6,2 · 9 s = 3,1</span></li>
        <li><b>Manevrabilitate</b><span>Cum ține virajele. Notă dată de noi, de la 0 la 10.</span></li>
        <li><b>Frânare</b><span>Cât de scurt oprește. Notă de la 0 la 10.</span></li>
        <li><b>Off-road</b><span>Pe pământ, nisip și iarbă. Un SUV sau un jeep stă bine aici, un supercar nu.</span></li>
      </ul>`],
    ['Licitația, pas cu pas', `<p>Fiecare mașină pornește de la un preț (între 400.000 și 1,2 mil., după cât de bună e). Cine e la rând are 10 secunde: <b>ia la prețul ăsta</b>, <b>ridică</b> cu +250k, +500k sau +1 mil., sau <b>renunță</b>. Cât ai ridicat tu, atât trebuie să ridice cel puțin și celălalt.</p>
      <div class="reg-ex"><b>Exemplu</b>
        <ol>
          <li>Un Porsche pornește de la 800.000. Tu îl iei la 800.000.</li>
          <li>Adversarul ridică cu +500k: 1,3 mil.</li>
          <li>Acum tu poți ridica doar cu +500k sau +1 mil. (nu cu +250k). Ridici cu +500k: 1,8 mil.</li>
          <li>Adversarul renunță. Porsche-ul e al tău, cu 1,8 mil.</li>
        </ol></div>
      <p>Dacă niciunul nu vrea mașina, iese din joc. Dacă ai deja 4 mașini, celălalt o poate lua singur, la prețul de pornire. Iar când au rămas exact câte mașini vă mai trebuie, ești obligat să le iei la prețul de pornire, chiar dacă intri pe minus.</p>`],
    ['La final: așezarea', `<p>După licitație apar și ultimele două categorii. Fiecare își pune mașinile pe ascuns: o mașină pe fiecare categorie, fiecare mașină o singură dată. Apoi se compară, categorie cu categorie.</p>
      <div class="reg-ex"><b>Exemplu</b>
        <p>Pe <b>Putere</b> ai pus un Mustang cu 450 CP (6,5), adversarul un Golf GTI cu 245 CP (4,7): +5 mil. pentru tine. Pe <b>Greutate</b> el are o mașină de 1.250 kg (6,6), tu una de 1.700 kg (4,3): +5 mil. pentru el. La notă egală, fiecare ia 2,5 mil.</p>
      </div>
      <p>Așa că nu pune mereu mașina cea mai bună pe categoria cea mai grea. Uneori e mai bine să câștigi sigur trei categorii decât să pierzi două ca să o câștigi pe una.</p>`],
    ['Cine câștigă', `<div class="reg-ex"><b>Exemplu</b>
        <p><b>Tu</b> ai dat 7,5 mil. pe cele 4 mașini, deci ți-au rămas 2,5 mil. Câștigi 3 categorii: +15 mil. Total: <b>17,5 mil.</b></p>
        <p><b>Adversarul</b> a dat doar 4 mil., deci i-au rămas 6 mil. Câștigă o categorie: +5 mil. Total: <b>11 mil.</b></p>
        <p>Câștigi tu, deși ai cheltuit mai mult.</p>
      </div>
      <p>O categorie câștigată valorează 5 mil., deci o mașină care costă mai mult de atât trebuie să-ți aducă mai mult de o categorie. Și ține minte categoriile ascunse: o mașină bună la mai multe lucruri te salvează când apar.</p>`],
  ];
  const R = {
    'sus-sau-jos': [
      ['Cum se joacă', 'Vezi o mașină cu valoarea ei. Ghicești dacă următoarea are mai mult sau mai puțin la categoria aleasă. O greșeală și s-a terminat. Cu cât mergi mai departe, cu atât valorile sunt mai apropiate.'],
      ['Categoria', 'Cai putere, greutate, 0-100 km/h sau Mixt (alta la fiecare mașină).'],
      ['1 la 1', 'Pe rând, pe același telefon, pe același șir de mașini. Cine greșește primul pierde.'],
      ['Cronometrul', 'Opțional: 10 secunde pe mașină.'],
    ],
    'sus-sau-jos-online': [
      ['Cum se joacă', 'Ghicești dacă următoarea mașină are mai mult sau mai puțin la categoria aleasă. 10 secunde pe mașină, o greșeală și s-a terminat.'],
      ['Provocarea zilei', 'Aceleași mașini pentru toți, azi. Contează doar prima încercare și aduce 10 mil.'],
      ['Clasament', 'General (cel mai bun scor pe fiecare categorie) și pe săptămână: primii trei pe Mixt primesc 150 / 100 / 60 mil. lunea.'],
      ['Bani', `1 mil. la fiecare 2 răspunsuri corecte. ${BANI}`],
      ['Cu un prieten', 'Fiecare pe telefonul lui, pe rând, pe același șir. Cine greșește primul pierde.'],
    ],
    ordine: [
      ['Cum se joacă', 'Apare o mașină nouă. O pui în listă acolo unde crezi că îi e locul, după categorie. Dacă e bine, lista crește; o greșeală și s-a terminat.'],
      ['1 la 1', 'Pe rând, pe același telefon. Cine greșește primul pierde.'],
      ['Cronometrul', 'Opțional: 15 secunde pe mașină.'],
    ],
    'ordine-online': [
      ['Cum se joacă', 'Pui fiecare mașină nouă la locul ei în listă, după categorie. 10 secunde pe mașină, o greșeală și s-a terminat.'],
      ['Provocarea zilei', 'Aceleași mașini pentru toți, azi. Contează doar prima încercare și aduce 10 mil.'],
      ['Clasament', 'General pe fiecare categorie și pe săptămână, pe categoria săptămânii: primii trei primesc 150 / 100 / 60 mil.'],
      ['Bani', `1 mil. pe fiecare mașină pusă corect. ${BANI}`],
      ['Cu un prieten', 'Fiecare pe telefonul lui, pe rând, pe aceeași listă. Cine greșește primul pierde.'],
    ],
    'drag-online': [
      ['Cum conduci', 'Ține apăsat Gata (ambreiajul). Cu Gaz turezi: acul urcă cât ții și cade când dai drumul; sus de tot rămâne în limitator și patinezi. Când se sting luminile, dă drumul la Start: pleci cu turația din clipa aceea, perfect în verde. Dacă îi dai drumul înainte, e start fals. Apoi apasă Schimbă când acul e în verde.'],
      ['Clasa și scorul', 'Fiecare mașină are o clasă (D, C, B, A, S) și un scor, din cât de rapidă e. Tuningul din Garajul meu urcă scorul și o poate muta în clasa de sus. Duelurile sunt între mașini din aceeași clasă.'],
      ['Cursa zilei', 'Aceeași mașină pentru toți. Contează cel mai bun timp al zilei; prima cursă aduce 10 mil.'],
      ['Duel rapid', 'Alegi miza, iar serverul îți găsește un adversar din clasa ta. Câștigătorul ia ambele mize minus 10%.'],
      ['Cu un prieten', 'Cursă live: amândoi în același moment. Duel cu cod: alergi acum, el când are timp, pe bani sau pe acte (cine pierde își pierde mașina).'],
      ['Cupa de duminică', 'Aceeași mașină pentru toți, fără intrare, trei încercări; contează cel mai bun timp. Oricine aleargă primește 5 mil. Locul 1: 150 mil. și mașina cupei. Locul 2: 100 mil. și o ladă Supercar. Locul 3: 60 mil. Premiile se dau luni.'],
      ['Echipa', 'O mașină pentru fiecare clasă: cu ea alergi în duelurile rapide.'],
      ['Antrenament', 'Fără miză, contra lui FRQ Bot. Așa îți afli timpii: recordul tău cu fiecare mașină apare în Garajul meu.'],
    ],
    licitatie: LICITATIE,
    garaj: [
      ['Cum se joacă', 'Trei mașini. Una intră în garaj, una o vinzi, una merge la presă. Nu există răspuns corect: doar alegeri grele, de discutat cu gașca.'],
      ['Tema', 'Alegi din ce fel de mașini să fie cele trei, sau Amestec.'],
    ],
    colectie: [
      ['Banii', 'Milioanele vin doar din jocurile online: provocările zilei (10 mil.), misiuni, partide cu cronometru și victorii cu prietenii (cel mult 40 mil. pe zi), seria de zile și premiile săptămânii. Nu se cumpără cu bani reali.'],
      ['La ce folosesc mașinile', 'Aleargă în Startul online: dueluri, cursa live, Cupa de duminică și Echipa ta.'],
      ['Lăzile', 'O mașină pe ladă, de la 1 mil., cu procentele scrise pe ea. Până ai 80% din mașinile unei rarități, nu primești dubluri din ea; după aceea pot veni și dubluri.'],
      ['Dublurile', 'O dublură o vinzi pe bani (uneori pe mai mult decât ladă) sau o păstrezi ca punct de upgrade de raritatea ei. Dacă nu alegi pe loc, o găsești la mașină, în Colecție.'],
      ['Raritatea', 'Comună, Rară, Epică, Exotică, Legendară: cât de greu o scoți dintr-o ladă. Nu se schimbă.'],
      ['Clasa și scorul', 'D, C, B, A, S și un număr până la 999: cât de rapidă e.'],
      ['Tuningul', 'Patru piese, câte cinci niveluri. Anvelope: plecarea și prima treaptă. Ușurare: toată cursa. Motor: finalul și viteza la linie. Cutie: verdele de la schimbări mai lat, fără să schimbe scorul. Anvelopele, Ușurarea și Cutia se plătesc în puncte de aceeași raritate cu mașina (2, 4, 6, 8, 10); Motorul în mil. Mașinile care se tunează bine și în realitate (JDM, muscle car, motoare turbo) câștigă mai mult din piese; electricele, mai puțin.'],
      ['Recordul tău', 'Cel mai bun timp al tău cu mașina, din cursele tale. Secundele nu le vezi pe mașină: le descoperi alergând.'],
      ['Vitrina și seturile', 'Din Vitrină cumperi exact mașina care îți lipsește. Un set complet (o marcă, o epocă) se plătește o dată.'],
    ],
    'camera-licitatie': [...LICITATIE, ...CAMERA],
    'camera-draft': [
      ['Cum se joacă', 'La fiecare rundă apar două mașini. Cine e la rând ia una și o pune într-un slot din 8 categorii; cealaltă îi rămâne celuilalt. 20 de secunde pe alegere.'],
      ['Câștigă', 'Media mai mare a notelor din sloturi.'],
      ...CAMERA,
    ],
    'camera-sus-sau-jos': [
      ['Cum se joacă', 'Pe rând, pe același șir de mașini: ghicești dacă următoarea are mai mult sau mai puțin. 10 secunde pe tură. Cine greșește primul pierde.'],
      ...CAMERA,
    ],
    'camera-ordine': [
      ['Cum se joacă', 'Pe rând, pe aceeași listă: pui mașina nouă la locul ei. 10 secunde pe tură. Cine greșește primul pierde.'],
      ...CAMERA,
    ],
  };

  const cheie = () => {
    if (pag === 'camera') return `camera-${document.body.dataset.joc || q.get('joc') || 'licitatie'}`;
    if ((pag === 'sus-sau-jos' || pag === 'ordine' || pag === 'drag') && online) return `${pag}-online`;
    return pag;
  };
  const areHow = () => !!document.getElementById('how') && !R[cheie()];
  if (!R[cheie()] && !document.getElementById('how')) return;

  // panoul nostru (doar unde nu e deja „Cum se joacă")
  let panou = null;
  if (R[cheie()]) {
    panou = document.createElement('div');
    panou.className = 'overlay how reg';
    panou.id = 'reguli';
    panou.hidden = true;
    panou.innerHTML = `<div class="modal how-modal" role="dialog" aria-modal="true" aria-labelledby="reg-t">
      <p class="eyebrow" id="reg-t">Reguli</p>
      <div class="how-body reg-body"></div>
      <div class="modal-actions"><button class="btn btn-primary" type="button" data-how-close>Am înțeles</button></div>
    </div>`;
    document.body.appendChild(panou);
    const arata = v => { panou.hidden = !v; };
    document.addEventListener('click', e => {
      if (e.target.closest('[data-reguli]')) {
        const s = R[cheie()] || [];
        panou.querySelector('.reg-body').innerHTML = s.map(([t, p]) => `<section class="reg-s"><h3>${t}</h3>${p.trim().startsWith('<') ? p : `<p>${p}</p>`}</section>`).join('');
        panou.querySelector('.reg-body').scrollTop = 0;
        arata(true);
      } else if (!panou.hidden && (e.target.closest('#reguli [data-how-close]') || e.target === panou)) arata(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panou.hidden) arata(false); });
  }

  // butonul „?" în antetul primului ecran (lângă „Clasament", dacă există)
  const bar = document.querySelector('.brand-bar');
  if (!bar) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'brand-reg';
  b.textContent = '?';
  b.setAttribute('aria-label', 'Reguli');
  if (areHow()) b.setAttribute('data-how', ''); else b.setAttribute('data-reguli', '');
  const cls = bar.querySelector('.brand-cls');
  const dreapta = document.createElement('div');
  dreapta.className = 'brand-dr';
  if (cls) { cls.replaceWith(dreapta); dreapta.append(b, cls); } else { dreapta.append(b); bar.appendChild(dreapta); }
})();
