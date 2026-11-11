// Contul FRQ, în Profil (și în Garajul meu, unde te întoarce linkul din mail). Trei pași:
// mailul, codul de 6 cifre primit pe mail, apoi ID-ul și numele cu care apari. Fără cont
// se joacă oricum (contul fără mail se face singur la primul joc online) și îți poți
// alege doar numele. Pe alt telefon intri la fel: mailul, codul.
window.FrqCont = (() => {
  'use strict';

  const { esc } = window.Shared;
  const formMail = (id, buton, mail = '') => `<form class="col-mail" id="${id}"><input type="email" required autocomplete="email" placeholder="mailul tău" aria-label="Mailul tău" value="${esc(mail)}"><button class="btn btn-primary" type="submit">${buton}</button></form>`;
  // cele 6 cifre: un singur câmp (ca lipirea și completarea din mail să meargă), arătat ca 6 căsuțe
  const formCod = `<form class="cont-cod" id="c-cod"><label class="cont-casute"><input name="cod" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required aria-label="Codul din mail"><span aria-hidden="true">${'<i></i>'.repeat(6)}</span></label><button class="btn btn-primary" type="submit">Confirmă</button></form>`;
  // codul lung pe care îl arată browserul după link (când linkul s-a deschis în browser, nu în aplicație)
  const formCodLung = `<form class="col-mail" id="c-cod-lung"><input type="text" required autocapitalize="off" spellcheck="false" maxlength="80" placeholder="codul din browser" aria-label="Codul din browser"><button class="btn btn-ghost" type="submit">Confirmă</button></form>`;
  const formNume = nume => `<form class="col-mail" id="c-nume"><input name="nume" required maxlength="16" autocomplete="nickname" placeholder="numele tău" aria-label="Numele tău" value="${esc(nume)}"><button class="btn btn-ghost" type="submit">Salvează</button></form>`;
  const pas = n => `<p class="cont-pas">Pasul ${n} din 3</p>`;
  // ID-ul propus din nume (Alex Frîncu -> alexfrincu); îl poți schimba
  const idDinNume = n => { const v = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').replace(/^[._]+|[._]+$/g, '').slice(0, 16); return v.length >= 3 ? v : ''; };
  const numeAles = n => (n && !/^Jucător /.test(n) ? n : '');

  // `areGaraj()`: dacă pe telefonul ăsta e deja un garaj (se înlocuiește la intrare).
  // `laSchimbare()`: după ce s-a schimbat numele sau ID-ul (pagina își reface antetul).
  function monteaza(el, { areGaraj = () => false, laSchimbare = () => {} } = {}) {
    let mesaj = '', editezId = false, ceasId = 0, idAtins = false, ocupat = null;
    async function randeaza() {
      let eu = null;
      try { eu = await FrqCloud.cineSunt(); } catch { /* fără server acum */ }
      const m = mesaj ? `<p class="col-cont-mesaj">${esc(mesaj)}</p>` : '';
      const ast = FrqCloud.codAsteptat(), dinLink = FrqCloud.codDinLink(), legat = !!(eu && !eu.anonim);
      if (dinLink) {
        // linkul deschis în browser, nu în aplicație: codul se mută de mână
        // linkul a ajuns la aplicație prin server: omul doar se întoarce în ea
        const trimis = await FrqCloud.linkTrimisAplicatiei();
        el.innerHTML = trimis
          ? `<p class="cont-gata"><b>Gata.</b> Întoarce-te în aplicația FRQ: te conectează singură.</p><details class="col-intra"><summary>Nu s-a conectat?</summary><p>Pune codul ăsta în aplicație, la Profil.</p><p class="col-cod">${esc(dinLink)}</p><button class="btn btn-ghost" type="button" id="c-copiaza">Copiază codul</button></details>`
          : `<p><b>Pune codul ăsta în aplicația FRQ</b>, la Profil.</p><p class="col-cod">${esc(dinLink)}</p><button class="btn btn-primary" type="button" id="c-copiaza">Copiază codul</button>`;
      } else if (ast && !legat) {
        // pasul 2: codul din mail
        el.innerHTML = `${pas(2)}<p>Ți-am trimis un cod la <b>${esc(ast.mail)}</b>.</p>${m}${formCod}
          <p class="col-nota">Merge și linkul din mail.${ast.tip === 'intra' && areGaraj() ? ' Garajul de acum de pe telefon se înlocuiește cu cel de pe mail.' : ''}</p>
          <p class="cont-linkuri"><button class="col-link" type="button" id="c-retrimite">Trimite din nou</button><button class="col-link" type="button" id="c-alt">Alt mail</button></p>
          <details class="col-intra"><summary>Ai deschis linkul în browser?</summary>${formCodLung}</details>`;
      } else if (!legat) {
        // pasul 1: mailul (și, pentru cine joacă fără cont, doar numele)
        const iesit = !eu && !FrqCloud.poateFaceCont();
        const sus = iesit ? '<p><b>Ai ieșit din cont.</b> Intră din nou cu mailul.</p>'
          : eu ? '<p><b>Garajul stă doar pe acest telefon.</b> Pune-ți mailul ca să nu-l pierzi și să-l ai pe orice telefon.</p>'
          : '<p><b>Fă-ți cont cu mailul.</b> Garajul e al tău pe orice telefon, iar prietenii te găsesc după ID.</p>';
        const conflict = ocupat ? `<div class="cont-ocupat"><p>Mailul <b>${esc(ocupat)}</b> are deja un garaj.</p><button class="btn btn-primary" type="button" id="c-intra-acum">Intră în el</button>${areGaraj() ? '<p class="col-nota">Garajul de acum de pe telefon se înlocuiește cu cel de pe mail.</p>' : ''}</div>` : '';
        el.innerHTML = `${iesit ? '' : pas(1)}${sus}${m}${conflict}${formMail('c-mail', 'Trimite codul', ocupat || (eu && eu.mailNou) || '')}
          ${iesit ? '<button class="col-link" type="button" id="c-nou">Garaj nou pe acest telefon</button>' : `<details class="col-intra"><summary>Joci fără cont? Alege-ți numele</summary>${formNume(FrqCloud.numeLocal())}</details>`}`;
      } else {
        // contul legat: ID-ul unic (după el te găsesc prietenii) și numele care se vede
        let pr = null;
        try { pr = (await FrqCloud.prieteni({ actiune: 'profil' })).eu; } catch { /* fără server acum */ }
        const nume = numeAles(pr && pr.nume) || FrqCloud.numeLocal(), id = (pr && pr.id_public) || '';
        const formId = `<form class="cont-id" id="c-id">
            <label><span>Nume</span><input name="nume" required maxlength="16" autocomplete="nickname" placeholder="cum te văd ceilalți" value="${esc(nume)}"></label>
            <label><span>ID</span><span class="cont-at"><i>@</i><input name="idp" required minlength="3" maxlength="16" autocapitalize="off" autocomplete="username" spellcheck="false" placeholder="ex. frincu" value="${esc(id || idDinNume(nume))}"></span></label>
            <small class="cont-id-stare" id="c-id-stare">Unic. Litere mici, cifre, _ și punct.</small>
            <button class="btn btn-primary" type="submit">${id ? 'Salvează' : 'Gata'}</button>
          </form>`;
        idAtins = !!id;
        el.innerHTML = pr && !id
          ? `${pas(3)}<p><b>Cum vrei să apari?</b> Numele se vede în jocuri; după ID te găsesc prietenii.</p>${m}${formId}<p class="col-nota">Garaj legat de ${esc(eu.mail)}.</p>`
          : `<p>Garaj legat de <b>${esc(eu.mail)}</b>.</p>${m}
          ${id && !editezId ? `<p class="cont-id-v"><b>@${esc(id)}</b><span>${esc(nume)}</span><button class="col-link" type="button" id="c-id-schimba">Schimbă</button></p>` : formId}
          <button class="col-link" type="button" id="c-iesi">Ieși din cont</button>`;
        const i = el.querySelector('#c-id input[name=idp]');
        if (i && i.value && !id) verificaId(i.value);
      }
      el.hidden = false;
      mesaj = '';
      const c = el.querySelector('#c-cod input');
      if (c) arataCasute(c);
    }
    // Trimite codul: fără cont se face contul cu mailul (sau intri în cel care există);
    // cu un cont fără mail, mailul se leagă de garajul de acum.
    async function trimiteMail(mail, tip) {
      if (tip === 'intra') await FrqCloud.intraSauCont(mail);
      else await FrqCloud.leagaMail(mail);
      FrqCloud.asteaptaCod({ tip, mail });
    }
    async function laMail(f) {
      const mail = f.querySelector('input').value.trim(), b = f.querySelector('button');
      b.disabled = true;
      ocupat = null;
      try { await trimiteMail(mail, FrqCloud.areCont() && FrqCloud.poateFaceCont() ? 'leaga' : 'intra'); }
      catch (e) {
        const t = String((e && (e.message || e.code)) || '').toLowerCase();
        if (/already|registered|exists/.test(t)) ocupat = mail; else mesaj = I18n.t(FrqCloud.eroareCont(e));
      }
      await randeaza();
      const i = el.querySelector('#c-cod input');
      if (i) i.focus();
    }
    async function salveazaNume(f) {
      const b = f.querySelector('button'), nume = f.elements.nume.value.trim(), vechi = FrqCloud.numeLocal();
      if (!nume) return;
      b.disabled = true;
      FrqCloud.seteazaNume(nume);
      // cu cont, numele se schimbă și în clasamente; fără, pleacă la primul joc online
      if (FrqCloud.areCont()) {
        try { await FrqCloud.schimbaNume(); mesaj = I18n.t('Salvat.'); }
        catch { FrqCloud.seteazaNume(vechi); mesaj = I18n.t('Numele nu e acceptat. Încearcă altul.'); }
      } else mesaj = I18n.t('Salvat. Așa o să apari în clasamente.');
      await randeaza();
      const d = el.querySelector('.col-intra'); if (d) d.open = true;
      laSchimbare();
    }
    async function salveazaId(f) {
      const b = f.querySelector('button'), st = f.querySelector('#c-id-stare');
      b.disabled = true;
      const id = f.elements.idp.value, nume = f.elements.nume.value.trim();
      try {
        await FrqCloud.prieteni({ actiune: 'seteaza', id_public: id, nume });
        if (nume) FrqCloud.seteazaNume(nume);
        editezId = false;
        Shared.haptic('success');
        await randeaza();
        laSchimbare();
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
    // cifrele, în căsuțe; la a șasea se trimite singur
    function arataCasute(i) {
      const v = i.value.replace(/\D/g, '').slice(0, 6);
      if (v !== i.value) i.value = v;
      i.parentElement.querySelectorAll('i').forEach((c, k) => { c.textContent = v[k] || ''; c.classList.toggle('is-aici', k === v.length || (k === 5 && v.length === 6)); });
    }
    // ID liber? (verificat cât scrii)
    function verificaId(val) {
      const st = el.querySelector('#c-id-stare'), v = String(val).trim().replace(/^@/, '').toLowerCase();
      clearTimeout(ceasId);
      if (!st) return;
      if (!/^[a-z0-9_.]{3,16}$/.test(v)) { st.textContent = I18n.t('Între 3 și 16: litere mici, cifre, _ și punct.'); st.className = 'cont-id-stare'; return; }
      ceasId = setTimeout(async () => {
        try {
          const r = await FrqCloud.prieteni({ actiune: 'liber', id_public: v });
          st.textContent = I18n.t(r.liber ? '@{v} e liber' : r.eroare ? 'Nu se poate folosi.' : '@{v} e luat', { v });
          st.className = `cont-id-stare ${r.liber ? 'is-ok' : 'is-rau'}`;
        } catch { /* verificăm la salvare */ }
      }, 350);
    }
    el.addEventListener('input', e => {
      const t = e.target;
      if (t.closest('#c-cod')) { arataCasute(t); if (t.value.length === 6) t.form.requestSubmit(); return; }
      if (t.name === 'idp') { idAtins = true; verificaId(t.value); return; }
      // ID-ul urmează numele până îl schimbi tu
      if (t.name === 'nume' && t.closest('#c-id') && !idAtins) {
        const i = el.querySelector('#c-id input[name=idp]');
        i.value = idDinNume(t.value);
        verificaId(i.value);
      }
    });
    el.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'c-id') salveazaId(f);
      if (f.id === 'c-mail') laMail(f);
      if (f.id === 'c-nume') salveazaNume(f);
      if (f.id === 'c-cod' || f.id === 'c-cod-lung') trimiteCod(f);
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
      const intra = e.target.closest('#c-intra-acum');
      if (intra) {
        intra.disabled = true;
        const mail = ocupat;
        ocupat = null;
        try { await trimiteMail(mail, 'intra'); } catch (x) { mesaj = I18n.t(FrqCloud.eroareCont(x)); }
        randeaza();
      }
      const din = e.target.closest('#c-retrimite');
      if (din) {
        din.disabled = true;
        const v = FrqCloud.codAsteptat();
        try { if (v) await trimiteMail(v.mail, v.tip); mesaj = I18n.t('Ți-am trimis un cod nou.'); } catch (x) { mesaj = I18n.t(FrqCloud.eroareCont(x)); }
        randeaza();
      }
      if (e.target.closest('#c-id-schimba')) { editezId = true; randeaza(); return; }
      if (e.target.closest('#c-alt')) { FrqCloud.asteaptaCod(null); randeaza(); }
      if (e.target.closest('#c-nou')) { FrqCloud.contNou(); location.reload(); }
    });
    return { randeaza };
  }

  return { monteaza };
})();
