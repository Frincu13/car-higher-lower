// Partenerii FRQ: toți sponsorii de acum, pe niveluri, cu ce fac și unde apar în joc.
(() => {
  'use strict';
  const SP = window.Sponsori, $ = id => document.getElementById(id);
  const NIVELE = [[1, 'Sponsor principal'], [2, 'Parteneri'], [3, 'Susținători']];
  const LAZI = { strada: 'Stradă', sport: 'Sport', super: 'Supercar', hyper: 'Hypercar', jdm: 'JDM', sua: 'Americane', italia: 'Italiene', anglia: 'Britanice', germania: 'Nemțești', electrice: 'Electrice' };
  function unde(s) {
    const l = (s.lazi || []).map(k => `lada ${LAZI[k] || k}`);
    if (s.nivel === 1) return ['„powered by" în toată aplicația', 'Cupa de duminică', ...l].join(' · ');
    if (s.nivel === 2) return [...l, 'premiile și clasamentele săptămânii, pe rând'].join(' · ');
    return 'Pagina partenerilor';
  }
  function randeaza() {
    const l = SP ? SP.lista() : [];
    $('p-lista').innerHTML = l.length ? NIVELE.map(([n, titlu]) => {
      const din = l.filter(s => s.nivel === n);
      if (!din.length) return '';
      return `<h2>${titlu}</h2><ul class="part-l part-${n}">${din.map(s => {
        SP.vazut(s.id, 'parteneri');
        const corp = `${SP.logo(s, 'part-logo')}<span><b>${SP.esc(s.nume)}${s.demo ? ' <i class="part-demo">demo</i>' : ''}</b>${s.descriere ? `<small>${SP.esc(s.descriere)}</small>` : ''}<em>${SP.esc(unde(s))}</em></span>`;
        return `<li style="--sp:${SP.esc(s.culoare)}">${s.link ? `<a href="${SP.esc(s.link)}" target="_blank" rel="sponsored noopener" data-sp="${SP.esc(s.id)}" data-sp-loc="parteneri">${corp}</a>` : `<div>${corp}</div>`}</li>`;
      }).join('')}</ul>`;
    }).join('') : '<p>FRQ caută parteneri. Mașina FRQ și jocurile ajung la evenimente auto, în malluri și la festivaluri.</p>';
  }
  randeaza();
  document.addEventListener('frq-sponsori', randeaza);
  if (SP) SP.gata.then(randeaza);
})();
