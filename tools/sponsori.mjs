// Sponsorii FRQ: lista, adăugare sau schimbare, și raportul pentru ei.
//   node tools/sponsori.mjs --lista
//   node tools/sponsori.mjs <id> "<nume>" <nivel 1|2|3> --logo img/sponsori/x.svg [--culoare #ff0000] [--link https://...]
//        [--lazi sport,hyper] [--jocuri startul,sus-sau-jos] [--descriere "..."] [--de-la AAAA-LL-ZZ] [--pana-la AAAA-LL-ZZ] [--ordine 0]
//   node tools/sponsori.mjs --opreste <id>          (de acum nu mai apare)
//   node tools/sponsori.mjs --raport [luna AAAA-LL] (de câte ori a fost văzut și atins fiecare, pe locuri)
// Nivelurile: 1 principal („powered by", Cupa, de obicei lada Hypercar), 2 partener (o ladă,
// jocurile lui: finalul și clasamentul, premiile pe rând), 3 susținător (pagina Partenerii FRQ).
// Jocurile: startul, sus-sau-jos, ordine, licitatie, draft (Mașina perfectă), carti, geaman, garaj
// (scorul garajului). Un joc fără sponsor ia partenerul zilei. Logo-ul se pune în
// img/sponsori/ (SVG sau PNG transparent) și se publică odată cu site-ul.
// Sponsorii demo (inventați) se văd doar cu ?sponsori=demo; cei adăugați de aici sunt reali.
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync, existsSync } from 'node:fs';

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
const lit = s => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : null; };
const NIVEL = ['', 'principal', 'partener', 'susținător'];
const JOCURI = ['startul', 'sus-sau-jos', 'ordine', 'licitatie', 'draft', 'carti', 'geaman', 'garaj'];

if (a[0] === '--lista') {
  const l = await sql(`select id, nume, nivel, culoare, logo, link, lazi, jocuri, demo, de_la::date::text de_la, pana_la::date::text pana_la,
    (de_la <= now() and (pana_la is null or pana_la > now())) activ from public.sponsori order by nivel, ordine, nume`);
  for (const s of l) console.log(`${s.id.padEnd(12)} ${NIVEL[s.nivel].padEnd(11)} ${s.activ ? 'activ  ' : 'oprit  '}${s.demo ? 'demo ' : '     '}${s.nume}  lăzi: ${(s.lazi || []).join(',') || '–'}  jocuri: ${(s.jocuri || []).join(',') || '–'}  ${s.de_la}${s.pana_la ? ` → ${s.pana_la}` : ''}`);
  process.exit(0);
}
if (a[0] === '--opreste') {
  const r = await sql(`update public.sponsori set pana_la = now() where id = ${lit(a[1])} returning id`);
  console.log(r.length ? `${a[1]}: oprit de acum.` : `Nu există ${a[1]}.`);
  process.exit(0);
}
if (a[0] === '--raport') {
  const luna = /^\d{4}-\d{2}$/.test(a[1] || '') ? a[1] : new Date().toISOString().slice(0, 7);
  const r = await sql(`select s.nume, c.loc, sum(c.afisari)::int afisari, sum(c.clicuri)::int clicuri
    from public.sponsori_cifre c join public.sponsori s on s.id = c.sponsor
    where to_char(c.zi, 'YYYY-MM') = ${lit(luna)} group by s.nume, c.loc order by s.nume, afisari desc`);
  const ev = await sql(`select coalesce(s.nume, '–') nume, e.cod, (select count(*)::int from public.evenimente_luate x where x.cod = e.cod) luate
    from public.evenimente e left join public.sponsori s on s.id = e.sponsor where to_char(e.de_la, 'YYYY-MM') = ${lit(luna)} order by e.de_la`);
  console.log(`Raport ${luna} (doar cifre adunate, fără nimic despre jucători)\n`);
  let cine = null;
  for (const x of r) {
    if (x.nume !== cine) { cine = x.nume; console.log(`\n${cine}`); }
    console.log(`  ${x.loc.padEnd(12)} ${String(x.afisari).padStart(7)} afișări  ${String(x.clicuri).padStart(5)} atingeri`);
  }
  if (!r.length) console.log('Nicio afișare luna asta.');
  if (ev.length) { console.log('\nEvenimente (QR):'); for (const e of ev) console.log(`  ${e.cod.padEnd(12)} ${String(e.luate).padStart(5)} premii luate   sponsor: ${e.nume}`); }
  process.exit(0);
}

const [id, nume, nivel] = a;
if (!/^[a-z0-9-]{2,30}$/.test(id || '') || !nume || !['1', '2', '3'].includes(nivel) || !opt('logo')) {
  console.error('Folosire: node tools/sponsori.mjs <id> "<nume>" <nivel 1|2|3> --logo img/sponsori/x.svg [--culoare #rrggbb] [--link https://...] [--lazi sport,hyper] [--descriere "..."] [--de-la AAAA-LL-ZZ] [--pana-la AAAA-LL-ZZ]');
  process.exit(1);
}
const logo = opt('logo');
if (!existsSync(new URL(`../${logo}`, import.meta.url))) console.warn(`Atenție: ${logo} nu e în proiect. Pune fișierul acolo și publică site-ul.`);
const lazi = (opt('lazi') || '').split(',').map(x => x.trim()).filter(Boolean);
const jocuri = (opt('jocuri') || '').split(',').map(x => x.trim()).filter(Boolean);
const strain = jocuri.filter(j => !JOCURI.includes(j));
if (strain.length) { console.error(`Jocuri necunoscute: ${strain.join(', ')}. Sunt: ${JOCURI.join(', ')}`); process.exit(1); }
const deLa = opt('de-la'), panaLa = opt('pana-la');
await sql(`insert into public.sponsori (id, nume, nivel, descriere, culoare, logo, link, lazi, jocuri, de_la, pana_la, demo, ordine)
  values (${lit(id)}, ${lit(nume)}, ${nivel}, ${lit(opt('descriere'))}, ${lit(opt('culoare') || '#ed1b2f')}, ${lit(logo)}, ${lit(opt('link'))},
    ${lit(`{${lazi.join(',')}}`)}::text[], ${lit(`{${jocuri.join(',')}}`)}::text[], ${deLa ? `(${lit(deLa)}::date)::timestamp at time zone 'Europe/Bucharest'` : 'now()'},
    ${panaLa ? `((${lit(panaLa)}::date + 1)::timestamp at time zone 'Europe/Bucharest')` : 'null'}, false, ${Number(opt('ordine')) || 0})
  on conflict (id) do update set nume = excluded.nume, nivel = excluded.nivel, descriere = excluded.descriere, culoare = excluded.culoare,
    logo = excluded.logo, link = excluded.link, lazi = excluded.lazi, jocuri = excluded.jocuri, de_la = excluded.de_la, pana_la = excluded.pana_la, demo = false, ordine = excluded.ordine`);
// o ladă are un singur sponsor: cine o primește acum o ia de la ceilalți
if (lazi.length) await sql(`update public.sponsori set lazi = array(select unnest(lazi) except select unnest(${lit(`{${lazi.join(',')}}`)}::text[])) where id <> ${lit(id)}`);
// la fel un joc
if (jocuri.length) await sql(`update public.sponsori set jocuri = array(select unnest(jocuri) except select unnest(${lit(`{${jocuri.join(',')}}`)}::text[])) where id <> ${lit(id)}`);
console.log(`${nume} (${NIVEL[nivel]}) salvat. Apare pe telefoane în cel mult 6 ore (sau la prima pornire).`);
