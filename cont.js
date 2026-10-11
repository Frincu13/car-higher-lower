// Contul FRQ, la fel în Setări și în Garajul meu. Anonim: garajul stă doar pe telefonul
// ăsta, deci îl legi de mail. Legat: ești același jucător pe orice telefon. Pe alt
// telefon intri cu un cod (sau un link) primit pe mail.
window.FrqCont = (() => {
  'use strict';

  const { esc } = window.Shared;
  const formCod = `<form class="col-mail" id="c-cod"><input type="text" required autocomplete="one-time-code" autocapitalize="off" spellcheck="false" maxlength="80" placeholder="codul" aria-label="Codul"><button class="btn btn-primary" type="submit">Confirmă</button></form>`;
  const formMail = (id, buton) => `<form class="col-mail" id="${id}"><input type="email" required autocomplete="email" placeholder="mailul tău" aria-label="Mailul tău"><button class="btn btn-primary" type="submit">${buton}</button></form>`;

  // `areGaraj()`: dacă pe telefonul ăsta e deja un garaj (se înlocuiește la intrare).
  function monteaza(el, { areGaraj = () => false } = {}) {
    let mesaj = '';
    async function randeaza() {
      let eu = null;
      try { eu = await FrqCloud.cineSunt(); } catch { /* fără server acum */ }
      const m = mesaj ? `<p class="col-cont-mesaj">${esc(mesaj)}</p>` : '';
      const ast = FrqCloud.codAsteptat();
      // după mail: codul se scrie aici (linkul din mail merge și el, dar în browser)
      const cod = ast ? `<p>Ți-am trimis un link la <b>${esc(ast.mail)}</b>. Dacă se deschide în browser, copiază codul de acolo aici.</p>${m}${formCod}<button class="col-link" type="button" id="c-alt">Alt mail</button>` : '';
      const dinLink = FrqCloud.codDinLink();
      const intra = `<details class="col-intra"><summary>Ai deja un garaj legat de mail?</summary>${formMail('c-intra', 'Trimite codul')}<p class="col-nota">Primești un cod pe mail.${areGaraj() ? ' Garajul de acum de pe telefon se înlocuiește cu cel de pe mail.' : ''}</p></details>`;
      if (dinLink) {
        // linkul deschis în browser, nu în aplicație: codul se mută de mână
        el.innerHTML = `<p><b>Pune codul ăsta în aplicația FRQ</b>, la Garajul meu &rsaquo; Contul.</p><p class="col-cod">${esc(dinLink)}</p><button class="btn btn-primary" type="button" id="c-copiaza">Copiază codul</button>`;
      } else if (ast && !(eu && !eu.anonim)) {
        el.innerHTML = cod;
      } else if (!eu && !FrqCloud.areCont() && FrqCloud.poateFaceCont()) {
        el.innerHTML = `<p>Nu ai încă un cont: se face singur când joci prima dată online.</p>${m}${intra}`;
      } else if (!eu) {
        el.innerHTML = `<p><b>Ai ieșit din cont.</b></p>${m}${formMail('c-intra', 'Trimite codul')}<button class="col-link" type="button" id="c-nou">Garaj nou pe acest telefon</button>`;
      } else if (eu.anonim && eu.mailNou) {
        el.innerHTML = `<p><b>Mai ai un pas:</b> cere un cod nou la ${esc(eu.mailNou)} ca să-ți legi garajul.</p>${m}${formMail('c-leaga', 'Trimite codul')}`;
      } else if (eu.anonim) {
        el.innerHTML = `<p><b>Garajul stă doar pe acest telefon.</b> Leagă-l de mail ca să nu-l pierzi și să-l ai pe orice telefon.</p>${m}${formMail('c-leaga', 'Leagă')}${intra}`;
      } else {
        el.innerHTML = `<p>Garaj legat de <b>${esc(eu.mail)}</b>.</p>${m}<button class="col-link" type="button" id="c-iesi">Ieși din cont</button>`;
      }
      el.hidden = false;
      mesaj = '';
    }
    async function trimiteMail(form, fn, tip) {
      const mail = form.querySelector('input').value.trim();
      const b = form.querySelector('button');
      b.disabled = true;
      try { await fn(mail); FrqCloud.asteaptaCod({ tip, mail }); }
      catch (e) { mesaj = I18n.t(FrqCloud.eroareCont(e)); }
      await randeaza();
      const i = el.querySelector('#c-cod input');
      if (i) i.focus();
    }
    async function trimiteCod(form) {
      const b = form.querySelector('button');
      b.disabled = true;
      try { await FrqCloud.confirmaCod(form.querySelector('input').value); location.reload(); return; }
      catch (e) { mesaj = I18n.t(FrqCloud.eroareCont(e)); }
      await randeaza();
    }
    el.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'c-leaga') trimiteMail(f, FrqCloud.leagaMail, 'leaga');
      if (f.id === 'c-intra') trimiteMail(f, FrqCloud.intraCuMail, 'intra');
      if (f.id === 'c-cod') trimiteCod(f);
    });
    el.addEventListener('click', async e => {
      if (e.target.closest('#c-iesi')) {
        if (!(await Shared.intreaba(I18n.t('Ieși din cont pe acest telefon? Garajul rămâne legat de mail.'), { da: 'Ieși', nu: 'Rămân' }))) return;
        await FrqCloud.iesi();
        location.reload();
      }
      const cp = e.target.closest('#c-copiaza');
      if (cp) {
        try { await navigator.clipboard.writeText(FrqCloud.codDinLink()); cp.textContent = I18n.t('Copiat'); }
        catch { getSelection().selectAllChildren(el.querySelector('.col-cod')); }
      }
      if (e.target.closest('#c-alt')) { FrqCloud.asteaptaCod(null); randeaza(); }
      if (e.target.closest('#c-nou')) { FrqCloud.contNou(); location.reload(); }
    });
    return { randeaza };
  }

  return { monteaza };
})();
