// Cine revine: conturile noi pe zile și câte dintre ele au jucat, au deschis o ladă, au
// revenit a doua zi și în săptămâna de după. „A revenit" = o vizită (orice pagină care
// cere portofelul, din 2026-11-03) sau orice activitate (partidă, duel, ladă...) în ziua
// aceea. Doar cifre adunate, fără nume.
//   node tools/revenire.mjs [zile]        (implicit 30)
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
const ZILE = Math.max(7, Math.min(90, Number(process.argv[2]) || 30));

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/zndivyygyomkxyeuvytf/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const ZI = c => `(${c} at time zone 'Europe/Bucharest')::date`;
const rows = await sql(`
  with zile as (
    select jucator, zi from public.vizite
    union select jucator, ${ZI('inceput')} from public.partide
    union select jucator, ${ZI('creat')} from public.miscari
    union select a, ${ZI('creat')} from public.dueluri
    union select jucator, ${ZI('creat')} from public.zi_rezultate
  ), c as (
    select j.id, ${ZI('j.creat')} zi from public.jucatori j where j.creat > now() - interval '${ZILE} days'
  ), a as (
    select c.zi,
      exists (select 1 from public.partide p where p.jucator = c.id and p.scor is not null) a_jucat,
      exists (select 1 from public.miscari m where m.jucator = c.id and m.motiv in ('lada', 'lada gratis')) lada,
      exists (select 1 from zile z where z.jucator = c.id and z.zi = c.zi + 1) z1,
      exists (select 1 from zile z where z.jucator = c.id and z.zi between c.zi + 2 and c.zi + 7) z7,
      c.zi + 1 <= ${ZI('now()')} poate1, c.zi + 7 <= ${ZI('now()')} poate7
    from c
  )
  select zi::text, count(*)::int conturi, count(*) filter (where a_jucat)::int au_jucat, count(*) filter (where lada)::int lada,
    case when bool_and(poate1) then count(*) filter (where z1)::int end a_doua_zi,
    case when bool_and(poate7) then count(*) filter (where z7)::int end saptamana
  from a group by zi order by zi`);

const pct = (n, t) => (n == null ? '–' : t ? `${n} (${Math.round((100 * n) / t)}%)` : '0');
console.log(`Conturi noi în ultimele ${ZILE} zile (multe conturi anonime se fac doar deschizând Garajul).\n`);
console.log('zi'.padEnd(12) + 'conturi'.padStart(8) + 'au jucat'.padStart(12) + 'ladă'.padStart(12) + 'a doua zi'.padStart(13) + 'zilele 2-7'.padStart(13));
let t = { conturi: 0, au_jucat: 0, lada: 0 };
for (const r of rows) {
  t.conturi += r.conturi; t.au_jucat += r.au_jucat; t.lada += r.lada;
  console.log(r.zi.padEnd(12) + String(r.conturi).padStart(8) + pct(r.au_jucat, r.conturi).padStart(12) + pct(r.lada, r.conturi).padStart(12)
    + pct(r.a_doua_zi, r.au_jucat).padStart(13) + pct(r.saptamana, r.au_jucat).padStart(13));
}
console.log(`\nTotal: ${t.conturi} conturi, ${pct(t.au_jucat, t.conturi)} au jucat, ${pct(t.lada, t.conturi)} au deschis o ladă.`);
console.log('Revenirea (a doua zi, zilele 2-7) e socotită din cei care au jucat; „–" = încă n-au trecut zilele.');
