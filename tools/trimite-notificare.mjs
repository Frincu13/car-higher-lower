// Trimite o notificare pe telefoane, de la noi. Cheia stă în ../.env.frq-supabase
// (FRQ_NOTIF_CHEIE), lângă proiect, nu în el.
//   node tools/trimite-notificare.mjs --titlu "Salut" --text "Un test" [--catre toti|<id jucător>] [--url drag.html?online] [--test]
// Fără --catre se trimite tuturor celor abonați. Cu --test ajunge și la cine a oprit
// noutățile (folosește-l doar pentru telefoanele tale, cu --catre <id>).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const cheie = env.FRQ_NOTIF_CHEIE;
if (!cheie) { console.error('Lipsește FRQ_NOTIF_CHEIE în ../.env.frq-supabase'); process.exit(1); }

const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const titlu = arg('titlu');
if (!titlu) { console.error('Folosire: node tools/trimite-notificare.mjs --titlu "..." --text "..." [--catre toti|<id>] [--url pagina.html] [--test]'); process.exit(1); }

const r = await fetch('https://zndivyygyomkxyeuvytf.supabase.co/functions/v1/notificari', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_VQT1YUz7U7J5g-JVmq-_UQ_pJSAQtXm', 'x-frq-cheie': cheie },
  body: JSON.stringify({ actiune: 'trimite', catre: arg('catre') || 'toti', titlu, text: arg('text') || '', url: arg('url') || '', tip: process.argv.includes('--test') ? 'test' : undefined }),
});
console.log(r.status, await r.text());
