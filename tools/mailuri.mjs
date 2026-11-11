// Mailurile contului: trimise prin Brevo (SMTP), în română, cu codul de 6 cifre mare, sus
// (îl scrii în aplicație, la Profil) și linkul dedesubt, ca rezervă. Trei mailuri: cont nou,
// intrare pe alt telefon, mail legat de un garaj care stătea doar pe telefon.
//   node tools/mailuri.mjs           -> arată ce e acum pe server
//   node tools/mailuri.mjs --scrie   -> leagă Brevo și pune textele (setare de producție: doar la „publică")
// Totul vine din ../.env.frq-supabase, lângă proiect, nu în el:
//   SUPABASE_ACCESS_TOKEN  tokenul Supabase
//   SMTP_USER              loginul SMTP din Brevo (SMTP & API -> SMTP, de forma ...@smtp-brevo.com)
//   SMTP_PAROLA            cheia SMTP generată în Brevo
//   SMTP_EXPEDITOR         adresa de la care pleacă mailurile (confirmată în Brevo la Senders)
// Când apare domeniul: confirmi domeniul în Brevo, schimbi doar SMTP_EXPEDITOR și rulezi din nou --scrie.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
const URL_AUTH = 'https://api.supabase.com/v1/projects/zndivyygyomkxyeuvytf/config/auth';
const antet = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

const SMTP = {
  smtp_host: env.SMTP_HOST || 'smtp-relay.brevo.com',
  smtp_port: env.SMTP_PORT || '587',
  smtp_user: env.SMTP_USER,
  smtp_pass: env.SMTP_PAROLA,
  smtp_admin_email: env.SMTP_EXPEDITOR,
  smtp_sender_name: 'FRQ',
  smtp_max_frequency: 30,      // secunde între două mailuri către aceeași adresă („Trimite din nou")
  rate_limit_email_sent: 60,   // mailuri pe oră, pe tot proiectul (Brevo gratuit: 300 pe zi)
};

const mail = (titlu, text, buton) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<p style="margin:0 0 4px;font-size:13px;font-weight:bold;letter-spacing:.1em;color:#d81528">FRQ</p>
<h2 style="margin:0 0 12px;font-size:22px">${titlu}</h2>
<p style="margin:0 0 16px;font-size:15px;line-height:1.4">${text}</p>
<p style="margin:0 0 20px;font-size:36px;font-weight:bold;letter-spacing:.3em">{{ .Token }}</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.4;color:#555">Codul merge o oră. Sau apasă aici, pe telefonul pe care joci:<br><a href="{{ .ConfirmationURL }}" style="color:#d81528;font-weight:bold">${buton}</a></p>
<p style="margin:0;font-size:12px;color:#888">Dacă nu tu ai cerut mailul ăsta, îl poți ignora.</p>
</div>`;

const TEXTE = {
  mailer_otp_exp: 3600,
  mailer_subjects_confirmation: 'Codul tău FRQ: {{ .Token }}',
  mailer_templates_confirmation_content: mail('Bun venit în FRQ', 'Scrie codul ăsta în aplicație, la Profil, ca să-ți faci contul.', 'Fă-mi contul'),
  mailer_subjects_magic_link: 'Codul tău FRQ: {{ .Token }}',
  mailer_templates_magic_link_content: mail('Intră în FRQ', 'Scrie codul ăsta în aplicație, la Profil, ca să intri în garajul tău.', 'Intră în garaj'),
  mailer_subjects_email_change: 'Codul tău FRQ: {{ .Token }}',
  mailer_templates_email_change_content: mail('Leagă-ți garajul', 'Scrie codul ăsta în aplicație, la Profil, ca să legi garajul de {{ .NewEmail }}.', 'Leagă garajul'),
};

const scrie = async (ce, corp) => {
  const r = await fetch(URL_AUTH, { method: 'PATCH', headers: antet, body: JSON.stringify(corp) });
  if (!r.ok) { console.error(`Nu s-a putut scrie ${ce}:`, r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  console.log(`${ce}: pus.`);
};

if (process.argv.includes('--scrie')) {
  const lipsa = ['SMTP_USER', 'SMTP_PAROLA', 'SMTP_EXPEDITOR'].filter(k => !env[k]);
  if (lipsa.length) { console.error('Lipsește în ../.env.frq-supabase:', lipsa.join(', ')); process.exit(1); }
  await scrie('Brevo (SMTP)', SMTP);   // întâi SMTP: fără el, Supabase nu lasă mailurile să fie schimbate
  await scrie('Mailurile în română', TEXTE);
}
const c = await (await fetch(URL_AUTH, { headers: antet })).json();
for (const k of Object.keys(TEXTE)) console.log(k, '=', String(c[k]).length > 90 ? `${String(c[k]).length} car., cod: ${c[k].includes('{{ .Token }}')}` : c[k]);
console.log('SMTP:', c.smtp_host ? `${c.smtp_host}:${c.smtp_port}, expeditor ${c.smtp_sender_name} <${c.smtp_admin_email}>` : 'nu (trimițătorul de test Supabase)',
  '· mailuri pe oră:', c.rate_limit_email_sent, '· pauză între mailuri:', c.smtp_max_frequency, 's');
