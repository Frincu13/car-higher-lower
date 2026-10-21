// Backup al bazei FRQ: toate tabelele din `public` și conturile (auth.users, fără parole;
// intrarea e prin link pe mail), într-un fișier JSON comprimat, în ../../frq-backup (în
// afara proiectului, deci niciodată în GitHub). Structura tabelelor e în
// supabase/migrations; aici sunt datele. Păstrează ultimele 8 copii.
//   node tools/backup.mjs
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

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

const tabele = (await sql("select tablename from pg_tables where schemaname = 'public' order by tablename")).map(x => x.tablename);
const date = { creat: new Date().toISOString(), proiect: 'zndivyygyomkxyeuvytf', tabele: {} };
for (const t of tabele) {
  // ce se poate reface sau nu contează: contoarele limitei de cereri
  if (t === 'limite_cereri') continue;
  const [{ randuri }] = await sql(`select coalesce(json_agg(x), '[]'::json) randuri from public."${t.replace(/"/g, '')}" x`);
  date.tabele[t] = randuri;
}
const [{ conturi }] = await sql(`select coalesce(json_agg(json_build_object('id', id, 'email', email, 'creat', created_at,
  'ultima', last_sign_in_at, 'anonim', is_anonymous, 'meta', raw_user_meta_data)), '[]'::json) conturi from auth.users`);
date.conturi = conturi;

const dir = new URL('../../frq-backup/', import.meta.url);
mkdirSync(dir, { recursive: true });
const nume = `frq-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json.gz`;
const z = gzipSync(Buffer.from(JSON.stringify(date)));
writeFileSync(new URL(nume, dir), z);

// verificarea: fișierul se poate citi înapoi și are tot
const inapoi = JSON.parse(gunzipSync(readFileSync(new URL(nume, dir))).toString());
const n = Object.values(inapoi.tabele).reduce((s, r) => s + r.length, 0);
if (Object.keys(inapoi.tabele).length !== Object.keys(date.tabele).length || n !== Object.values(date.tabele).reduce((s, r) => s + r.length, 0)) {
  console.error('Backup-ul nu se citește înapoi la fel.'); process.exit(1);
}
// ultimele 8
const toate = readdirSync(dir).filter(f => /^frq-.*\.json\.gz$/.test(f)).sort();
for (const f of toate.slice(0, Math.max(0, toate.length - 8))) unlinkSync(new URL(f, dir));
console.log(`Backup: frq-backup/${nume} (${(statSync(new URL(nume, dir)).size / 1024).toFixed(0)} KB) · ${Object.keys(date.tabele).length} tabele, ${n} rânduri, ${conturi.length} conturi`);
