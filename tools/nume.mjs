// Numele raportate din clasamente și cele ascunse.
//   node tools/nume.mjs                    rapoartele din ultimele 30 de zile și numele ascunse
//   node tools/nume.mjs --ascunde "Nume"   îl ascunde acum (toți cei care îl poartă revin la „Jucător ABCD")
//   node tools/nume.mjs --permite "Nume"   îl scoate din lista celor ascunse (cine îl purta nu îl primește înapoi)
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/zndivyygyomkxyeuvytf/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const lit = s => `'${String(s).replace(/'/g, "''")}'`;

const i = process.argv.findIndex(a => a === '--ascunde' || a === '--permite');
if (i >= 0) {
  const nume = process.argv[i + 1];
  if (!nume) { console.error('Lipsește numele.'); process.exit(1); }
  if (process.argv[i] === '--ascunde') {
    const [{ n }] = await sql(`select public.interzice_nume(${lit(nume)}, 'de mână') n`);
    console.log(`„${nume}" e ascuns. ${n === 1 ? 'Un jucător îl purta' : `${n} jucători îl purtau`}; acum au numele de început.`);
  } else {
    const r = await sql(`delete from public.nume_interzise where nume = lower(btrim(${lit(nume)})) returning nume`);
    console.log(r.length ? `„${nume}" se poate folosi din nou.` : `„${nume}" nu era ascuns.`);
  }
  process.exit(0);
}

const rap = await sql(`select r.nume, count(*)::int n, count(*) filter (where r.legat)::int legate, max(r.creat) ultima,
    (select count(*)::int from public.jucatori j where j.nume = r.nume) il_poarta,
    exists (select 1 from public.nume_interzise z where z.nume = lower(btrim(r.nume))) ascuns
  from public.nume_raportari r where r.creat > now() - interval '30 days' group by r.nume order by legate desc, n desc limit 50`);
const asc = await sql(`select nume, motiv, creat from public.nume_interzise order by creat desc limit 50`);
if (!rap.length) console.log('Niciun nume raportat în ultimele 30 de zile.');
else {
  console.log('Raportate (30 de zile):\n');
  for (const r of rap) console.log(`  ${r.ascuns ? '[ascuns] ' : ''}„${r.nume}"  ${r.n} ${r.n === 1 ? 'raport' : 'rapoarte'} (${r.legate} din conturi legate) · îl poartă ${r.il_poarta} · ultimul ${String(r.ultima).slice(0, 16)}`);
}
console.log(`\nAscunse: ${asc.length ? asc.map(a => `„${a.nume}" (${a.motiv})`).join(', ') : 'niciunul'}`);
console.log('\nAscunzi unul: node tools/nume.mjs --ascunde "Nume"');
