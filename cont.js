// Contul FRQ, la fel în Setări și în Garajul meu. Anonim: garajul stă doar pe telefonul
// ăsta, deci îl legi de mail. Legat: ești același jucător pe orice telefon. Pe alt
// telefon intri cu un link primit pe mail.
window.FrqCont = (() => {
  'use strict';

  const { esc } = window.Shared;
  const formMail = (id, buton) => `<form class="col-mail" id="${id}"><input type="email" required autocomplete="email" placeholder="mailul tău" aria-label="Mailul tău"><button class="btn btn-primary" type="submit">${buton}</button></form>`;

  // `areGaraj()`: dacă pe telefonul ăsta e deja un garaj (se înlocuiește la intrare).
  function monteaza(el, { areGaraj = () => false } = {}) {
    let mesaj = '';
    async function randeaza() {
      let eu = null;
      try { eu = await FrqCloud.cineSunt(); } catch { /* fără server acum */ }
      const m = mesaj ? `<p class="col-cont-mesaj">${esc(mesaj)}</p>` : '';
      const intra = `<details class="col-intra"><summary>Ai deja un garaj legat de mail?</summary>${formMail('c-intra', 'Trimite linkul')}<p class="col-nota">Primești un link pe mail; deschide-l pe telefonul ăsta.${areGaraj() ? ' Garajul de acum de pe telefon se înlocuiește cu cel de pe mail.' : ''}</p></details>`;
      if (!eu && !FrqCloud.areCont() && FrqCloud.poateFaceCont()) {
        el.innerHTML = `<p>Nu ai încă un cont: se face singur când joci prima dată online.</p>${m}${intra}`;
      } else if (!eu) {
        el.innerHTML = `<p><b>Ai ieșit din cont.</b></p>${m}${formMail('c-intra', 'Trimite linkul')}<button class="col-link" type="button" id="c-nou">Garaj nou pe acest telefon</button>`;
      } else if (eu.anonim && eu.mailNou) {
        el.innerHTML = `<p><b>Mai ai un pas:</b> deschide linkul trimis la ${esc(eu.mailNou)} ca să-ți legi garajul.</p>${m}`;
      } else if (eu.anonim) {
        el.innerHTML = `<p><b>Garajul stă doar pe acest telefon.</b> Leagă-l de mail ca să nu-l pierzi și să-l ai pe orice telefon.</p>${m}${formMail('c-leaga', 'Leagă')}${intra}`;
      } else {
        el.innerHTML = `<p>Garaj legat de <b>${esc(eu.mail)}</b>.</p>${m}<button class="col-link" type="button" id="c-iesi">Ieși din cont</button>`;
      }
      el.hidden = false;
      mesaj = '';
    }
    async function trimiteMail(form, fn, ok) {
      const mail = form.querySelector('input').value.trim();
      const b = form.querySelector('button');
      b.disabled = true;
      try { await fn(mail); mesaj = I18n.t(ok, { mail }); }
      catch (e) { mesaj = I18n.t(FrqCloud.eroareCont(e)); }
      await randeaza();
    }
    el.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'c-leaga') trimiteMail(f, FrqCloud.leagaMail, 'Ți-am trimis un link la {mail}. Deschide-l ca să-ți legi garajul.');
      if (f.id === 'c-intra') trimiteMail(f, FrqCloud.intraCuMail, 'Ți-am trimis un link la {mail}. Deschide-l pe telefonul ăsta.');
    });
    el.addEventListener('click', async e => {
      if (e.target.closest('#c-iesi')) {
        if (!(await Shared.intreaba(I18n.t('Ieși din cont pe acest telefon? Garajul rămâne legat de mail.'), { da: 'Ieși', nu: 'Rămân' }))) return;
        await FrqCloud.iesi();
        location.reload();
      }
      if (e.target.closest('#c-nou')) { FrqCloud.contNou(); location.reload(); }
    });
    return { randeaza };
  }

  return { monteaza };
})();
