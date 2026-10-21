// Ce s-a stricat în pagini: erorile din jurnal (erori_client), grupate după mesaj.
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
//   node tools/erori.mjs [zile]        (implicit 7)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
const zile = Math.max(1, Math.min(30, Number(process.argv[2]) || 7));

const sql = `select mesaj, sursa, count(*)::int n, count(distinct coalesce(jucator::text, dispozitiv))::int cine,
  max(creat) ultima, string_agg(distinct pagina, ', ') pagini, string_agg(distinct versiune, ', ') versiuni,
  (array_agg(stiva order by creat desc))[1] stiva
  from public.erori_client where creat > now() - interval '${zile} days'
  group by mesaj, sursa order by n desc limit 40`;
const r = await fetch('https://api.supabase.com/v1/projects/zndivyygyomkxyeuvytf/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const rand = await r.json();
if (!r.ok) { console.error(r.status, rand); process.exit(1); }
if (!rand.length) { console.log(`Nicio eroare în ultimele ${zile} zile.`); process.exit(0); }
console.log(`Erori în ultimele ${zile} zile (${rand.length} feluri):\n`);
for (const e of rand) {
  console.log(`${String(e.n).padStart(4)}× (${e.cine} ${e.cine === 1 ? 'jucător' : 'jucători'})  ${e.mesaj}`);
  console.log(`       ${e.sursa || '-'} · pagini: ${e.pagini} · versiuni: ${e.versiuni || '?'} · ultima: ${String(e.ultima).slice(0, 16)}`);
  if (e.stiva) console.log(`       ${e.stiva.split('\n').slice(0, 3).join('\n       ')}`);
  console.log('');
}
