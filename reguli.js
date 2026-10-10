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

  const BANI = 'Fiecare partidă cu cronometru aduce bani în Garajul meu; partidele și victoriile cu prietenii aduc împreună cel mult 40 mil. pe zi.';
  const CAMERA = [
    ['Miza', 'Opțională. O pun amândoi; câștigătorul ia potul minus 10%, la egal fiecare își ia miza înapoi. Victoria aduce oricum 10 mil.'],
    ['Dacă pleacă cineva', 'Jocul merge mai departe singur, cu timpul: cine nu mută la timp pierde tura.'],
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
      ['Cum conduci', 'Ține apăsat cât se aprind luminile, ca să turezi. Ridică degetul când se sting, apoi apasă de fiecare dată când acul e în verde. Un start fals pierde cursa.'],
      ['Clasa și scorul', 'Fiecare mașină are o clasă (D, C, B, A, S) și un scor, din cât de rapidă e. Tuningul din Garajul meu urcă scorul și o poate muta în clasa de sus. Duelurile sunt între mașini din aceeași clasă.'],
      ['Cursa zilei', 'Aceeași mașină pentru toți. Contează cel mai bun timp al zilei; prima cursă aduce 10 mil.'],
      ['Duel rapid', 'Alegi miza, iar serverul îți găsește un adversar din clasa ta. Câștigătorul ia ambele mize minus 10%.'],
      ['Cu un prieten', 'Cursă live: amândoi în același moment. Duel cu cod: alergi acum, el când are timp, pe bani sau pe acte (cine pierde își pierde mașina).'],
      ['Cupa de duminică', 'Aceeași mașină pentru toți, intrare 30 mil., trei încercări, contează cel mai bun timp. Potul merge la primii trei (50 / 30 / 20%); sub 4 înscriși, intrarea se întoarce.'],
      ['Echipa', 'O mașină pentru fiecare clasă: cu ea alergi în duelurile rapide.'],
      ['Antrenament', 'Fără miză, contra lui FRQ Bot. Așa îți afli timpii: recordul tău cu fiecare mașină apare în Garajul meu.'],
    ],
    licitatie: [
      ['Cum se joacă', 'Fiecare are 10 mil. Se licitează 12 mașini, pe rând, câte 10 secunde pe tură. Fiecare ia 4.'],
      ['Licitația', 'Prima ofertă e prețul de pornire. Apoi ridici cu +250k, +500k sau +1 mil.; cât ridici tu, atât trebuie să ridice și celălalt, cel puțin. Dacă nimeni nu vrea mașina, iese din joc.'],
      ['La final', 'Îți așezi mașinile pe ascuns pe 4 categorii: două știute de la început, două trase după. Fiecare categorie câștigată aduce 5 mil.'],
      ['Câștigă', 'Cine are mai mulți bani la final. Dacă ești obligat să iei o mașină fără bani, intri pe minus.'],
    ],
    garaj: [
      ['Cum se joacă', 'Trei mașini. Una intră în garaj, una o vinzi, una merge la presă. Nu există răspuns corect: doar alegeri grele, de discutat cu gașca.'],
      ['Tema', 'Alegi din ce fel de mașini să fie cele trei, sau Amestec.'],
    ],
    colectie: [
      ['Banii', 'Milioanele vin doar din jocurile online: provocările zilei (10 mil.), misiuni, partide cu cronometru și victorii cu prietenii (cel mult 40 mil. pe zi), seria de zile și premiile săptămânii. Nu se cumpără cu bani reali.'],
      ['La ce folosesc mașinile', 'Aleargă în Startul online: dueluri, cursa live, Cupa de duminică și Echipa ta.'],
      ['Lăzile', 'O mașină pe ladă, cu procentele scrise pe ea. Nu primești dubluri cât timp îți lipsesc mașini din raritatea care iese; după aceea, dublura se vinde singură.'],
      ['Raritatea', 'Comună, Rară, Epică, Exotică, Legendară: cât de greu o scoți dintr-o ladă. Nu se schimbă.'],
      ['Clasa și scorul', 'D, C, B, A, S și un număr până la 999: cât de rapidă e. Tuningul urcă scorul, în 5 niveluri.'],
      ['Recordul tău', 'Cel mai bun timp al tău cu mașina, din cursele tale. Secundele nu le vezi pe mașină: le descoperi alergând.'],
      ['Vitrina și seturile', 'Din Vitrină cumperi exact mașina care îți lipsește. Un set complet (o marcă, o epocă) se plătește o dată.'],
    ],
    'camera-licitatie': [
      ['Cum se joacă', 'Fiecare are 10 mil., pe telefonul lui. Se licitează 12 mașini, pe rând, câte 10 secunde pe tură; fiecare ia 4.'],
      ['Licitația', 'Prima ofertă e prețul de pornire; apoi +250k, +500k sau +1 mil., iar celălalt trebuie să ridice cel puțin cât tine.'],
      ['La final', 'Îți așezi mașinile pe ascuns pe 4 categorii; fiecare categorie câștigată aduce 5 mil. Câștigă cine are mai mulți bani.'],
      ...CAMERA,
    ],
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
        panou.querySelector('.reg-body').innerHTML = s.map(([t, p]) => `<section class="reg-s"><h3>${t}</h3><p>${p}</p></section>`).join('');
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
