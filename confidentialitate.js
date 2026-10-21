// Pagina de confidențialitate: ce rulează pe ea. Separat de pagină pentru protecția CSP.
(() => {
  const b = document.getElementById('c-sterge'), st = document.getElementById('c-stare');
  if (!window.FrqCloud.areCont()) { b.disabled = true; st.textContent = 'Pe acest telefon nu e niciun cont.'; return; }
  b.addEventListener('click', async () => {
    if (!(await Shared.intreaba(I18n.t('Ștergi contul, cu numele, timpii, portofelul și garajul?'), { da: 'Șterge', nu: 'Anulează' }))) return;
    b.disabled = true;
    st.textContent = 'Se șterge';
    try { await window.FrqCloud.stergeCont(); st.textContent = 'Gata: contul și datele lui au fost șterse.'; }
    catch { b.disabled = false; st.textContent = 'Nu s-a putut șterge acum. Încearcă din nou.'; }
  });
})();
