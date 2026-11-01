// Un eveniment FRQ (mall, festival, salon auto): un cod, un link și imaginea QR de pus
// pe mașină sau la stand. Cine scanează primește premiul o singură dată pe cont, cât
// ține evenimentul.
//   node tools/eveniment.mjs <COD> "<nume>" <de la AAAA-LL-ZZ> <până la AAAA-LL-ZZ> [--pachete 1] [--mil 0] [--lazi 0] [--max N]
//   node tools/eveniment.mjs --lista
// Exemplu: node tools/eveniment.mjs MALLAFI "FRQ la AFI Cotroceni" 2026-11-14 2026-11-16 --pachete 1
// QR-ul se scrie în ../../frq-evenimente/<COD>.png (în afara proiectului).
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
const SITE = 'https://frincu13.github.io/car-higher-lower/';

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

const a = process.argv.slice(2);
if (a[0] === '--lista') {
  const l = await sql(`select e.cod, e.nume, e.de_la::date::text de_la, e.pana_la::date::text pana_la, e.premiu, e.max,
    (select count(*)::int from public.evenimente_luate x where x.cod = e.cod) luate from public.evenimente e order by e.de_la desc`);
  for (const e of l) console.log(`${e.cod.padEnd(12)} ${e.de_la} → ${e.pana_la}  ${String(e.luate).padStart(4)} luate${e.max ? ` din ${e.max}` : ''}  ${JSON.stringify(e.premiu)}  ${e.nume}`);
  process.exit(0);
}
const [cod, nume, deLa, panaLa] = a;
if (!/^[A-Z0-9]{4,12}$/.test(cod || '') || !nume || !/^\d{4}-\d{2}-\d{2}$/.test(deLa || '') || !/^\d{4}-\d{2}-\d{2}$/.test(panaLa || '')) {
  console.error('Folosire: node tools/eveniment.mjs <COD 4-12 litere mari/cifre> "<nume>" <de la AAAA-LL-ZZ> <până la AAAA-LL-ZZ> [--pachete 1] [--mil 0] [--lazi 0] [--max N]');
  process.exit(1);
}
const opt = k => { const i = a.indexOf(`--${k}`); return i >= 0 ? Number(a[i + 1]) : null; };
const premiu = { pachete: opt('pachete') ?? 1, mil: opt('mil') ?? 0, lazi: opt('lazi') ?? 0 };
const max = opt('max');
// de la începutul primei zile până la sfârșitul ultimei, ora României
await sql(`insert into public.evenimente (cod, nume, de_la, pana_la, premiu, max)
  values (${lit(cod)}, ${lit(nume)}, (${lit(deLa)}::date)::timestamp at time zone 'Europe/Bucharest',
    ((${lit(panaLa)}::date + 1)::timestamp at time zone 'Europe/Bucharest'), ${lit(JSON.stringify(premiu))}::jsonb, ${max ?? 'null'})
  on conflict (cod) do update set nume = excluded.nume, de_la = excluded.de_la, pana_la = excluded.pana_la, premiu = excluded.premiu, max = excluded.max`);
const link = `${SITE}?ev=${cod}`;
const dir = fileURLToPath(new URL('../../frq-evenimente/', import.meta.url));
mkdirSync(dir, { recursive: true });
const png = `${dir}${cod}.png`;
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', 'qrcode@1.5.4', '-o', png, '-w', '1024', '-m', '2', link], { stdio: 'inherit', shell: process.platform === 'win32' });
console.log(`Eveniment ${cod}: ${nume}, ${deLa} → ${panaLa}, premiu ${JSON.stringify(premiu)}${max ? `, cel mult ${max}` : ''}`);
console.log(`Link: ${link}`);
console.log(`QR: ${png}`);
