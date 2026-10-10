// Notificările pe telefon, partea din pagină: abonarea (cu permisiunea cerută doar
// după un clic), tipurile pe care le vrea jucătorul și butonul de test din Setări.
// Mesajele le trimite serverul (funcția `notificari`); le afișează sw.js.
window.FrqNotif = (() => {
  'use strict';
  const PUB = 'BNpbXrFflLlMEq1hOIY42e_XgVg6GPDf5VlTmmsd6fz_8CJ_PpwReiu-B_mSX9FVaTv_bi3jZfHfnoKW5MxpNwE';
  const PORNITE = 'frq_notif';   // a pornit notificările pe telefonul ăsta
  const TIPURI = [
    ['dueluri', 'Dueluri și camere', 'Când intră un prieten, cere revanșa sau se termină un duel'],
    ['cupa', 'Cupa de duminică', 'Când începe'],
    ['serie', 'Seria de zile', 'Seara, dacă n-ai jucat încă provocarea zilei'],
    ['noutati', 'Noutăți FRQ', 'Jocuri și funcții noi, rar'],
  ];
  const { store } = window.Shared;

  const suport = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // pe iPhone, doar din aplicația pusă pe ecranul principal
  const trebuieInstalat = () => ios() && !standalone();

  const dinB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  async function inregistrare() {
    const r = await Promise.race([navigator.serviceWorker.ready, new Promise((_, nu) => setTimeout(() => nu(new Error('sw')), 8000))]);
    return r;
  }
  async function abonamentul() {
    if (!suport()) return null;
    // fără așteptare: dacă service worker-ul nu e încă înregistrat, nu e nici abonament
    try { const r = await navigator.serviceWorker.getRegistration(); return r ? await r.pushManager.getSubscription() : null; } catch { return null; }
  }

  // Ce știm acum: { suport, instalare, permisiune, abonat, tipuri }
  async function stare() {
    const s = { suport: suport(), instalare: trebuieInstalat(), permisiune: suport() ? Notification.permission : 'denied', abonat: false, tipuri: null };
    if (!s.suport || s.permisiune !== 'granted') return s;
    const ab = await abonamentul();
    if (!ab || !window.FrqCloud.areCont()) return s;
    try {
      const r = await window.FrqCloud.notificari({ actiune: 'stare', endpoint: ab.endpoint });
      s.abonat = !!r.abonat;
      s.tipuri = r.tipuri;
      // telefonul are abonament, serverul nu (cont nou, șters): îl punem la loc
      if (!s.abonat && store.get(PORNITE, false)) {
        const r2 = await window.FrqCloud.notificari({ actiune: 'aboneaza', abonament: ab.toJSON(), tipuri: null });
        s.abonat = !!r2.ok; s.tipuri = r2.tipuri;
      }
    } catch { /* fără rețea: rămâne ce știe telefonul */ }
    return s;
  }

  // Pornește: permisiunea (doar după un clic), abonamentul telefonului, apoi serverul.
  async function porneste(tipuri) {
    if (!suport()) throw new Error('suport');
    if (trebuieInstalat()) throw new Error('instalare');
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error(p === 'denied' ? 'blocat' : 'refuzat');
    const reg = await inregistrare();
    let ab = await reg.pushManager.getSubscription();
    if (!ab) ab = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: dinB64u(PUB) });
    const r = await window.FrqCloud.notificari({ actiune: 'aboneaza', abonament: ab.toJSON(), tipuri: tipuri || null });
    store.set(PORNITE, true);
    return r.tipuri;
  }
  async function opreste() {
    store.set(PORNITE, false);
    const ab = await abonamentul();
    if (!ab) return;
    try { await window.FrqCloud.notificari({ actiune: 'dezaboneaza', endpoint: ab.endpoint }); } catch { /* serverul îl șterge la prima trimitere */ }
    try { await ab.unsubscribe(); } catch { /* deja dezabonat */ }
  }
  async function seteazaTipuri(tipuri) {
    const ab = await abonamentul();
    if (!ab) return null;
    return (await window.FrqCloud.notificari({ actiune: 'tipuri', endpoint: ab.endpoint, tipuri })).tipuri;
  }
  async function test() {
    const ab = await abonamentul();
    if (!ab) throw new Error('neabonat');
    return window.FrqCloud.notificari({ actiune: 'test', endpoint: ab.endpoint });
  }

  // ---------- secțiunea din Setări ----------
  function monteaza(el) {
    if (!el) return;
    const t = s => window.I18n ? I18n.t(s) : s;
    async function arata(nota = '') {
      const s = await stare();
      if (!s.suport) {
        el.innerHTML = `<p class="st-nota">${t('Browserul ăsta nu poate primi notificări.')}</p>`;
        return;
      }
      if (s.instalare) {
        el.innerHTML = `<p class="st-nota">${t('Pe iPhone, notificările merg din aplicație: pune FRQ pe ecranul principal (Distribuie, apoi Adaugă la ecranul principal) și deschide-l de acolo.')}</p>`;
        return;
      }
      const tipuri = s.tipuri || {};
      el.innerHTML = `
        <label class="st-rand"><span>${t('Notificări pe telefon')}</span><input type="checkbox" id="nt-on"${s.abonat ? ' checked' : ''}${s.permisiune === 'denied' ? ' disabled' : ''}></label>
        ${s.abonat ? `<div class="nt-tipuri">${TIPURI.map(([k, n, sub]) => `
          <label class="st-rand nt-tip"><span>${t(n)}<small>${t(sub)}</small></span><input type="checkbox" data-nt="${k}"${tipuri[k] !== false ? ' checked' : ''}></label>`).join('')}</div>
          <button class="btn btn-ghost nt-test" type="button" id="nt-test">${t('Trimite-mi o notificare de test')}</button>` : ''}
        <p class="st-nota" id="nt-nota" role="status">${s.permisiune === 'denied' ? t('Notificările sunt blocate pentru FRQ din setările browserului.') : nota}</p>`;
    }
    const nota = m => { const n = el.querySelector('#nt-nota'); if (n) n.textContent = t(m); };
    el.addEventListener('change', async e => {
      if (e.target.id === 'nt-on') {
        e.target.disabled = true;
        try {
          if (e.target.checked) { await porneste(); await arata('Gata. Încearcă butonul de test.'); }
          else { await opreste(); await arata(); }
        } catch (err) {
          const m = err.message === 'blocat' ? 'Notificările sunt blocate pentru FRQ din setările browserului.'
            : err.message === 'refuzat' ? 'Fără permisiune nu putem trimite notificări.'
              : 'N-a mers. Mai încearcă o dată.';
          await arata(m);
        }
        return;
      }
      const k = e.target.dataset.nt;
      if (!k) return;
      const tipuri = Object.fromEntries([...el.querySelectorAll('[data-nt]')].map(x => [x.dataset.nt, x.checked]));
      try { await seteazaTipuri(tipuri); } catch { e.target.checked = !e.target.checked; nota('N-a mers. Mai încearcă o dată.'); }
    });
    el.addEventListener('click', async e => {
      if (e.target.id !== 'nt-test') return;
      e.target.disabled = true;
      try { await test(); nota('Trimisă. Ar trebui să apară în câteva secunde.'); }
      catch (err) {
        const cod = window.FrqCloud.codEroare ? await window.FrqCloud.codEroare(err) : '';
        nota(cod === 'prea des' ? 'Încă puțin: o notificare de test la 20 de secunde.' : cod === 'expirat' ? 'Abonamentul a expirat. Oprește și pornește din nou notificările.' : 'N-a mers. Mai încearcă o dată.');
      }
      setTimeout(() => { e.target.disabled = false; }, 3000);
    });
    arata();
  }

  // Un buton mic „Anunță-mă" pus lângă ceva ce așteaptă (camera, de exemplu). Nu apare
  // dacă notificările nu merg aici sau sunt deja pornite.
  async function butonAnunta(el, eticheta) {
    if (!el) return;
    const s = await stare();
    if (!s.suport || s.instalare || s.permisiune === 'denied' || s.abonat) return;
    el.innerHTML = `<button class="btn btn-ghost nt-anunta" type="button">${eticheta}</button>`;
    el.querySelector('button').addEventListener('click', async ev => {
      const b = ev.currentTarget;
      b.disabled = true;
      try { await porneste(); b.textContent = window.I18n ? I18n.t('Te anunțăm') : 'Te anunțăm'; }
      catch { b.disabled = false; }
    });
  }

  return { suport, stare, porneste, opreste, seteazaTipuri, test, monteaza, butonAnunta };
})();
