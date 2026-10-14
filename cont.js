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
    let mesaj = '', editezId = false, ceasId = 0;
    async function randeaza() {
      let eu = null;
      try { eu = await FrqCloud.cineSunt(); } catch { /* fără server acum */ }
      const m = mesaj ? `<p class="col-cont-mesaj">${esc(mesaj)}</p>` : '';
      const ast = FrqCloud.codAsteptat();
      // după mail: codul se scrie aici (linkul din mail merge și el, dar în browser)
      const cod = ast ? `<p>Ți-am trimis un link la <b>${esc(ast.mail)}</b>. Apasă-l, apoi întoarce-te aici: te conectezi singur.</p><p class="cont-astept"><i aria-hidden="true"></i>Aștept linkul</p>${m}
        <details class="col-intra"><summary>Ai primit un cod?</summary>${formCod}</details><button class="col-link" type="button" id="c-alt">Alt mail</button>` : '';
      const dinLink = FrqCloud.codDinLink();
      const intra = `<details class="col-intra"><summary>Ai deja un garaj legat de mail?</summary>${formMail('c-intra', 'Trimite codul')}<p class="col-nota">Primești un cod pe mail.${areGaraj() ? ' Garajul de acum de pe telefon se înlocuiește cu cel de pe mail.' : ''}</p></details>`;
      if (dinLink) {
        // linkul deschis în browser, nu în aplicație: codul se mută de mână
        // linkul a ajuns la aplicație prin server: omul doar se întoarce în ea
        const trimis = await FrqCloud.linkTrimisAplicatiei();
        el.innerHTML = trimis
          ? `<p class="cont-gata"><b>Gata.</b> Întoarce-te în aplicația FRQ: te conectează singură.</p><details class="col-intra"><summary>Nu s-a conectat?</summary><p>Pune codul ăsta în aplicație, la Garajul meu &rsaquo; Contul.</p><p class="col-cod">${esc(dinLink)}</p><button class="btn btn-ghost" type="button" id="c-copiaza">Copiază codul</button></details>`
          : `<p><b>Pune codul ăsta în aplicația FRQ</b>, la Garajul meu &rsaquo; Contul.</p><p class="col-cod">${esc(dinLink)}</p><button class="btn btn-primary" type="button" id="c-copiaza">Copiază codul</button>`;
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
        // contul legat: ID-ul unic (după el te găsesc prietenii) și numele care se vede
        let pr = null;
        try { pr = (await FrqCloud.prieteni({ actiune: 'profil' })).eu; } catch { /* fără server acum */ }
        const formId = (id, nume) => `<form class="cont-id" id="c-id">
            <label><span>ID</span><span class="cont-at"><i>@</i><input name="idp" required minlength="3" maxlength="16" autocapitalize="off" autocomplete="username" spellcheck="false" placeholder="ex. frincu" value="${esc(id || '')}"></span></label>
            <small class="cont-id-stare" id="c-id-stare">Unic. Litere mici, cifre, _ și punct.</small>
            <label><span>Nume</span><input name="nume" maxlength="16" autocomplete="nickname" placeholder="cum te văd ceilalți" value="${esc(nume || '')}"></label>
            <button class="btn btn-primary" type="submit">Salvează</button>
          </form>`;
        el.innerHTML = `<p>Garaj legat de <b>${esc(eu.mail)}</b>.</p>${m}
          ${pr && pr.id_public && !editezId
            ? `<p class="cont-id-v"><b>@${esc(pr.id_public)}</b><span>${esc(pr.nume || '')}</span><button class="col-link" type="button" id="c-id-schimba">Schimbă</button></p>`
            : `${pr && !pr.id_public ? '<p><b>Alege-ți ID-ul.</b> După el te găsesc prietenii; numele e cel care se vede în jocuri.</p>' : ''}${formId(pr && pr.id_public, (pr && pr.nume && !/^Jucător /.test(pr.nume)) ? pr.nume : FrqCloud.numeLocal())}`}
          <button class="col-link" type="button" id="c-iesi">Ieși din cont</button>`;
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
    async function salveazaId(f) {
      const b = f.querySelector('button'), st = f.querySelector('#c-id-stare');
      b.disabled = true;
      const id = f.elements.idp.value, nume = f.elements.nume.value.trim();
      try {
        await FrqCloud.prieteni({ actiune: 'seteaza', id_public: id, nume });
        if (nume) FrqCloud.seteazaNume(nume);
        editezId = false;
        await randeaza();
      } catch (e) {
        const k = await FrqCloud.codEroare(e);
        st.textContent = I18n.t({ ocupat: 'ID-ul e deja luat. Încearcă altul.', rezervat: 'ID-ul ăsta e rezervat.', forma: 'Între 3 și 16: litere mici, cifre, _ și punct (nu la început sau la sfârșit).', nume: 'Numele nu se poate folosi.', 'cont nelegat': 'Leagă întâi garajul de mail.' }[k] || 'Nu s-a putut salva acum.');
        st.className = 'cont-id-stare is-rau';
        b.disabled = false;
      }
    }
    async function trimiteCod(form) {
      const b = form.querySelector('button');
      b.disabled = true;
      try { await FrqCloud.confirmaCod(form.querySelector('input').value); location.reload(); return; }
      catch (e) { mesaj = I18n.t(FrqCloud.eroareCont(e)); }
      await randeaza();
    }
    // ID liber? (verificat cât scrii)
    el.addEventListener('input', e => {
      if (e.target.name !== 'idp') return;
      const st = el.querySelector('#c-id-stare'), v = e.target.value.trim().replace(/^@/, '').toLowerCase();
      clearTimeout(ceasId);
      if (!/^[a-z0-9_.]{3,16}$/.test(v)) { st.textContent = I18n.t('Între 3 și 16: litere mici, cifre, _ și punct.'); st.className = 'cont-id-stare'; return; }
      ceasId = setTimeout(async () => {
        try {
          const r = await FrqCloud.prieteni({ actiune: 'liber', id_public: v });
          st.textContent = I18n.t(r.liber ? '@{v} e liber' : r.eroare ? 'Nu se poate folosi.' : '@{v} e luat', { v });
          st.className = `cont-id-stare ${r.liber ? 'is-ok' : 'is-rau'}`;
        } catch { /* verificăm la salvare */ }
      }, 350);
    });
    el.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'c-id') { salveazaId(f); return; }
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
      if (e.target.closest('#c-id-schimba')) { editezId = true; randeaza(); return; }
      if (e.target.closest('#c-alt')) { FrqCloud.asteaptaCod(null); randeaza(); }
      if (e.target.closest('#c-nou')) { FrqCloud.contNou(); location.reload(); }
    });
    return { randeaza };
  }

  return { monteaza };
})();
