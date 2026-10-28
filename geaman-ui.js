// Geamănul: ce se vede, la fel contra botului (geaman.js) și în camere (camera.js):
// mașina dată, cele trei locuri (cai putere, greutate, 0-100), lista din care le umpli
// (cu căutare) și rezultatul rundei.
(() => {
  'use strict';

  const { fmt, brandOf, modelOf, esc, thumbHTML } = window.Shared;
  const GM = window.GeamanModel;
  const G = GM.creeaza(window.CARS || []);

  const poza = (c, w = 500, lenes = false) => {
    const h = thumbHTML({ ...c, image: String(c.image || '').replace(/\/\d+px-/, `/${w}px-`) });
    return lenes ? h.replace('<img ', '<img loading="lazy" ') : h;
  };
  // în ordinea din GM.CAT
  // `d`: o diferență în unitatea categoriei (cu semn)
  const VAL = [
    { k: 'hp', n: 'CP', f: c => fmt(c.hp, 0), d: x => `${fmt(x, 0)} CP` },
    { k: 'weight', n: 'kg', f: c => fmt(c.weight, 0), d: x => `${fmt(x, 0)} kg` },
    { k: 'accel', n: '0-100', f: c => `${fmt(c.accel, 1)} s`, d: x => `${fmt(x, 1)} s` },
  ];

  const valori = c => `<span class="gm-val">${VAL.map(v => `<span><small>${v.n}</small><b>${v.f(c)}</b></span>`).join('')}</span>`;
  const scurt = c => modelOf(c.name) || c.name;

  function tinta(c, eticheta = 'Găsește-i câte un geamăn') {
    return `<div class="gm-tinta">
      <span class="gm-tinta-f">${poza(c, 500)}</span>
      <span class="gm-tinta-t"><small>${esc(eticheta)}</small><b>${esc(scurt(c))}</b><span>${esc(brandOf(c.name))} · ${esc(c.years)}</span></span>
      ${valori(c)}
    </div>`;
  }

  // Cele trei locuri sus, lista dedesubt. Atingi un loc, apoi o mașină: intră acolo și
  // trece la următorul loc gol. Lista e în ordine alfabetică, fără marca mașinii date;
  // căutarea ascunde rânduri (nu redesenează), deci nimic nu sare.
  const fara = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  function lista(el, t, { laTrimitere, buton = 'Trimite' } = {}) {
    const cand = G.candidati(t).slice().sort((a, b) => a.name.localeCompare(b.name) || String(a.years).localeCompare(String(b.years)));
    const ales = [null, null, null];
    let activ = 0, oprit = false;
    el.innerHTML = `<div class="gm-locuri" role="radiogroup" aria-label="Categoriile">${VAL.map((v, i) => `<button type="button" class="gm-loc" role="radio" data-loc="${i}">
        <small>${v.n} <b>${v.f(t)}</b></small><span>Alege</span></button>`).join('')}</div>
      <p class="gm-trepte">Fiecare: <b>100</b> minus diferența în procente, <b>+${GM.BONUS}</b> la valoare exactă</p>
      <div class="gm-cauta"><input type="search" placeholder="Caută o mașină" aria-label="Caută o mașină" autocomplete="off" spellcheck="false"><small class="gm-nr">${cand.length} mașini · fără ${esc(brandOf(t.name))}</small></div>
      <div class="gm-lista" role="listbox" aria-label="Mașinile">${cand.map(c => `<button type="button" class="gm-r" role="option" data-id="${c.id}" data-c="${esc(fara(`${c.name} ${c.years}`))}">
        <span class="gm-r-f">${poza(c, 330, true)}</span><span class="gm-r-t"><b>${esc(scurt(c))}</b><small>${esc(brandOf(c.name))} · ${esc(c.years)}</small></span><i class="gm-r-in" aria-hidden="true"></i></button>`).join('')}
        <p class="gm-gol" hidden>Nicio mașină cu numele ăsta.</p></div>
      <div class="gm-act"><button class="btn btn-primary" type="button" data-gm-trimite disabled>${esc(buton)}</button></div>`;
    window.Shared.wirePhotos(el);
    const inp = el.querySelector('input'), rows = [...el.querySelectorAll('.gm-r')], gol = el.querySelector('.gm-gol'), b = el.querySelector('[data-gm-trimite]');
    const locuri = [...el.querySelectorAll('.gm-loc')];
    function arata() {
      locuri.forEach((x, i) => {
        x.classList.toggle('is-activ', i === activ);
        x.classList.toggle('is-plin', !!ales[i]);
        x.setAttribute('aria-checked', i === activ);
        x.querySelector('span').textContent = ales[i] ? scurt(ales[i]) : 'Alege';
      });
      // pe fiecare rând, în ce categorie e deja pusă mașina
      rows.forEach(r => {
        const id = +r.dataset.id, unde = VAL.filter((v, i) => ales[i] && ales[i].id === id).map(v => v.n);
        r.classList.toggle('is-on', unde.length > 0);
        r.querySelector('.gm-r-in').textContent = unde.join(' · ');
      });
      const n = ales.filter(Boolean).length;
      b.disabled = oprit || n < 3;
      b.textContent = n < 3 ? `${buton} · ${n} din 3` : buton;
    }
    inp.addEventListener('input', () => {
      const cuv = fara(inp.value).split(/\s+/).filter(Boolean);
      let n = 0;
      for (const r of rows) { const ok = cuv.every(w => r.dataset.c.includes(w)); r.hidden = !ok; if (ok) n++; }
      gol.hidden = n > 0;
    });
    // Enter în căutare: prima mașină găsită intră în locul activ (pe calculator, fără mouse)
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const r = rows.find(x => !x.hidden);
      if (r) { r.click(); inp.select(); }
    });
    el.querySelector('.gm-locuri').addEventListener('click', e => {
      const x = e.target.closest('.gm-loc');
      if (!x || oprit) return;
      activ = +x.dataset.loc;
      arata();
    });
    el.querySelector('.gm-lista').addEventListener('click', e => {
      const r = e.target.closest('.gm-r');
      if (!r || oprit) return;
      ales[activ] = G.dupaId.get(+r.dataset.id);
      // următorul loc gol (sau rămâi, dacă sunt toate pline)
      const urm = [1, 2, 3].map(d => (activ + d) % 3).find(i => !ales[i]);
      if (urm != null) activ = urm;
      if (window.Shared.haptic) window.Shared.haptic();
      arata();
    });
    b.addEventListener('click', () => { if (!b.disabled) { oprit = true; arata(); laTrimitere(ales.slice()); } });
    arata();
    return { opreste: () => { oprit = true; inp.disabled = true; arata(); }, alegeri: () => ales.slice() };
  }

  // Rezultatul rundei: pentru fiecare jucător, cele trei alegeri: mașina și valoarea ei,
  // cu cât e mai mult sau mai puțin decât mașina dată (în CP, kg, secunde, apoi în
  // procente) și punctele (100 minus procentele); la un geamăn perfect, în locul
  // procentelor, bonusul. Jos, câte o poză pe categorie: geamănul perfect (cu câți sunt)
  // sau, dacă nu există, cel mai apropiat.
  function rezultat(t, jucatori, best) {
    const rand = (c, i) => {
      const v = VAL[i];
      if (!c) return `<li class="gm-cat is-gol"><small>${v.n}</small><span class="gm-cat-n">Nimic ales</span><span class="gm-cat-d"></span><strong>0</strong></li>`;
      const x = c[v.k] - t[v.k], p = G.procent(t, c, v.k), pct = G.puncte(t, c, v.k), b = G.bonus(t, c, v.k);
      const dif = Math.abs(x) < 1e-9 || b ? 'la fel' : `${x > 0 ? '+' : '–'}${v.d(Math.abs(x))}`;
      const cls = p <= 3 ? ' is-aproape' : p <= 10 ? ' is-mediu' : '';
      return `<li class="gm-cat${cls}"><small>${v.n}</small><span class="gm-cat-n"><b>${esc(scurt(c))}</b> ${v.f(c)}</span><span class="gm-cat-d">${dif}${b ? `<span class="gm-bonus">+${b} bonus</span>` : `<em>${p}%</em>`}</span><strong>${pct}</strong></li>`;
    };
    const bloc = j => `<div class="gm-jucator${j.castiga ? ' is-win' : ''}">
        <p class="gm-jucator-c"><span>${esc(j.cine)}</span><strong>${j.pct.reduce((a, b) => a + b, 0)}</strong></p>
        <ol class="gm-cats">${j.trei.map((c, i) => rand(c, i)).join('')}</ol></div>`;
    // la perfect, întâi geamănul ales de unul dintre jucători
    const alese = new Set(jucatori.flatMap(j => j.trei.filter(Boolean).map(c => c.id)));
    const gemeni = VAL.map((v, i) => {
      const per = G.perfecti(t, v.k), c = per.find(x => alese.has(x.id)) || per[0] || (best && best[i]) || G.celeMaiBune(t)[i];
      const cat = per.length > 1 ? ` · ${per.length} perfecte` : per.length ? ' · perfect' : '';
      return `<div class="gm-geaman${per.length ? ' is-perfect' : ''}"><span class="gm-geaman-f">${poza(c, 330)}</span><small>${v.n}${cat}</small><b>${esc(scurt(c))}${per.length ? '' : ` <span>${v.f(c)}</span>`}</b></div>`;
    }).join('');
    return `<div class="gm-rez">
      <div class="gm-rez-tinta"><small>Mașina dată</small><b>${esc(t.name)}</b>${valori(t)}</div>
      ${jucatori.map(bloc).join('')}
      <div class="gm-gemeni">${gemeni}</div>
    </div>`;
  }

  window.GeamanUI = { G, VAL, poza, valori, tinta, lista, rezultat };
})();
