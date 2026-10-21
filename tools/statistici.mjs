// Panoul tău de statistici: jucători pe zi, jocuri jucate, bani câștigați și cheltuiți.
// Scrie o pagină în ../../frq-statistici/index.html (în afara proiectului, deci niciodată
// în GitHub) și o deschide. Doar cifre adunate, fără nume de jucători.
//   node tools/statistici.mjs [zile]        (implicit 14)
// Tokenul stă în ../.env.frq-supabase (SUPABASE_ACCESS_TOKEN), lângă proiect, nu în el.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const env = Object.fromEntries(readFileSync(new URL('../../.env.frq-supabase', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
if (!env.SUPABASE_ACCESS_TOKEN) { console.error('Lipsește SUPABASE_ACCESS_TOKEN în ../.env.frq-supabase'); process.exit(1); }
const ZILE = Math.max(7, Math.min(60, Number(process.argv[2]) || 14));

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/zndivyygyomkxyeuvytf/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

// ziua, la ora României
const ZI = c => `(${c} at time zone 'Europe/Bucharest')::date`;
const DE_LA = `(now() - interval '${ZILE} days')`;
// tot ce înseamnă „a jucat sau a făcut ceva": partide, dueluri, camere, bani, provocarea zilei, cupa
const ACTIVITATE = `
  select jucator, inceput t from partide
  union all select a, creat from dueluri union all select b, creat from dueluri where b is not null
  union all select a, creat from camere union all select b, creat from camere where b is not null
  union all select jucator, creat from miscari
  union all select jucator, creat from zi_rezultate
  union all select jucator, creat from scoruri_zi
  union all select jucator, creat from cupa_inscrieri`;

const [[conturi], [activi], peZi, jocuri, [bani], motive, [alte]] = await Promise.all([
  sql(`select count(*)::int total, count(*) filter (where is_anonymous)::int anonime,
    count(*) filter (where created_at > now() - interval '1 day')::int noi_24h,
    count(*) filter (where created_at > now() - interval '7 days')::int noi_7z from auth.users`),
  sql(`with a as (${ACTIVITATE}) select
    count(distinct jucator) filter (where ${ZI('t')} = ${ZI('now()')})::int azi,
    count(distinct jucator) filter (where t > now() - interval '7 days')::int z7,
    count(distinct jucator) filter (where t > now() - interval '30 days')::int z30 from a`),
  sql(`with a as (${ACTIVITATE}), zile as (select generate_series(${ZI(DE_LA)} + 1, ${ZI('now()')}, interval '1 day')::date zi)
    select zile.zi::text zi,
      (select count(distinct jucator)::int from a where ${ZI('a.t')} = zile.zi) jucatori,
      (select count(*)::int from auth.users u where ${ZI('u.created_at')} = zile.zi) conturi_noi,
      (select count(*)::int from partide p where ${ZI('p.inceput')} = zile.zi) partide,
      (select count(*)::int from dueluri d where ${ZI('d.creat')} = zile.zi) dueluri,
      (select count(*)::int from camere c where ${ZI('c.creat')} = zile.zi) camere,
      (select coalesce(sum(mil) filter (where mil > 0), 0)::int from miscari m where ${ZI('m.creat')} = zile.zi) castigati,
      (select coalesce(-sum(mil) filter (where mil < 0), 0)::int from miscari m where ${ZI('m.creat')} = zile.zi) cheltuiti
    from zile order by zile.zi`),
  sql(`select joc, n::int, jucatori::int from (
      select joc, count(*) n, count(distinct jucator) jucatori from partide where inceput > ${DE_LA} group by joc
      union all select 'startul: duel', count(*), count(distinct a) from dueluri where creat > ${DE_LA}
      union all select 'cameră: ' || joc, count(*), count(distinct a) from camere where creat > ${DE_LA} group by joc
      union all select 'startul: provocarea zilei', count(*), count(distinct jucator) from zi_rezultate where creat > ${DE_LA}
      union all select 'startul: cupa', count(*), count(distinct jucator) from cupa_inscrieri where creat > ${DE_LA}
    ) x where n > 0 order by n desc`),
  sql(`select (select coalesce(sum(mil), 0)::int from portofele) in_portofele,
    (select count(*)::int from portofele where mil > 0) cu_bani,
    coalesce(sum(mil) filter (where mil > 0), 0)::int castigati, coalesce(-sum(mil) filter (where mil < 0), 0)::int cheltuiti,
    count(*) filter (where motiv in ('lada', 'lada gratis', 'pachet'))::int lazi_deschise
    from miscari where creat > ${DE_LA}`),
  sql(`select motiv, count(*)::int n, sum(mil)::int mil from miscari where creat > ${DE_LA} group by motiv having sum(mil) <> 0 order by abs(sum(mil)) desc limit 14`),
  sql(`select (select count(*)::int from erori_client where creat > now() - interval '7 days') erori_7z,
    (select count(distinct jucator)::int from notificari) cu_notificari,
    (select count(*)::int from prieteni where stare = 'acceptat') prietenii,
    (select count(*)::int from garaje) masini_in_garaje,
    (select count(distinct jucator)::int from garaje) garaje`),
]);

// ---------- pagina ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nr = n => Number(n || 0).toLocaleString('ro-RO');
const JOCURI = { 'sus-sau-jos': 'Sus sau jos', ordine: 'În ordine', carti: 'Duel de cărți', startul: 'Startul', licitatie: 'Licitația', draft: 'Mașina perfectă' };
const numeJoc = j => j.replace(/[a-z-]+/g, k => JOCURI[k] || k).replace(/^cameră: /, 'Cameră: ');
const ziScurta = z => { const [, l, d] = z.split('-'); return `${Number(d)}.${l}`; };
function bare(rand, cheie, cls) {
  const max = Math.max(1, ...rand.map(r => r[cheie]));
  return `<div class="bare">${rand.map(r => `<div class="bara ${cls}" title="${esc(r.zi)}: ${nr(r[cheie])}">
      <i style="height:${Math.round((r[cheie] / max) * 100)}%"></i><b>${r[cheie] ? nr(r[cheie]) : ''}</b><small>${ziScurta(r.zi)}</small></div>`).join('')}</div>`;
}
const cifra = (v, t, sub = '') => `<div class="cifra"><b>${v}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
const acum = new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'long', timeStyle: 'short' });

const html = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statistici FRQ</title>
<style>
  :root { --bg: #0a0a0c; --card: #141519; --line: #26282f; --text: #f2f2f4; --muted: #8b8e98; --red: #e01e37; --go: #2fd27a; --gold: #f5b83d; --blue: #5aa7ff; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1080px; margin: 0 auto; padding: 28px 16px 60px; }
  h1 { margin: 0; font-size: 28px; letter-spacing: .02em; }
  .sub { color: var(--muted); margin: 4px 0 26px; }
  h2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 34px 0 12px; }
  .cifre { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .cifra { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 2px; }
  .cifra b { font-size: 26px; font-variant-numeric: tabular-nums; }
  .cifra span { font-size: 13px; }
  .cifra small { color: var(--muted); font-size: 12px; }
  .panou { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; overflow-x: auto; }
  .panou h3 { margin: 0 0 10px; font-size: 14px; }
  .bare { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(30px, 1fr); gap: 4px; height: 150px; align-items: end; min-width: ${ZILE * 34}px; }
  .bara { position: relative; height: 100%; display: grid; grid-template-rows: 1fr auto; align-items: end; text-align: center; }
  .bara i { display: block; width: 100%; min-height: 2px; border-radius: 4px 4px 0 0; background: var(--red); }
  .bara.go i { background: var(--go); } .bara.gold i { background: var(--gold); } .bara.blue i { background: var(--blue); }
  .bara b { position: absolute; left: 0; right: 0; bottom: 22px; font-size: 11px; font-weight: 600; color: var(--text); pointer-events: none; }
  .bara small { font-size: 10px; color: var(--muted); padding-top: 4px; }
  .doua { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  td, th { padding: 7px 4px; border-bottom: 1px solid var(--line); text-align: left; }
  th { font-size: 12px; color: var(--muted); font-weight: 600; }
  td.n, th.n { text-align: right; }
  .plus { color: var(--go); } .minus { color: var(--red); }
</style>
</head>
<body>
<main>
  <h1>Statistici FRQ</h1>
  <p class="sub">Cifrele reale, ${esc(acum)}. Ultimele ${ZILE} zile, ora României.</p>

  <div class="cifre">
    ${cifra(nr(activi.azi), 'jucători azi')}
    ${cifra(nr(activi.z7), 'în 7 zile')}
    ${cifra(nr(activi.z30), 'în 30 de zile')}
    ${cifra(nr(conturi.total), 'conturi', `${nr(conturi.total - conturi.anonime)} cu mail, ${nr(conturi.anonime)} fără`)}
    ${cifra(nr(conturi.noi_7z), 'conturi noi în 7 zile', `${nr(conturi.noi_24h)} în ultimele 24 de ore`)}
    ${cifra(nr(alte.erori_7z), 'erori în pagini, 7 zile', 'detalii: node tools/erori.mjs')}
  </div>

  <h2>Jucători pe zi</h2>
  <div class="panou">${bare(peZi, 'jucatori', '')}</div>

  <h2>Jocuri pe zi</h2>
  <div class="doua">
    <div class="panou"><h3>Partide (Sus sau jos, În ordine, Duel de cărți)</h3>${bare(peZi, 'partide', 'blue')}</div>
    <div class="panou"><h3>Dueluri și camere cu prieteni</h3>${bare(peZi.map(r => ({ ...r, prieteni: r.dueluri + r.camere })), 'prieteni', 'blue')}</div>
  </div>

  <h2>Ce s-a jucat, ${ZILE} zile</h2>
  <div class="panou"><table>
    <tr><th>Joc</th><th class="n">Partide</th><th class="n">Jucători</th></tr>
    ${jocuri.map(j => `<tr><td>${esc(numeJoc(j.joc))}</td><td class="n">${nr(j.n)}</td><td class="n">${nr(j.jucatori)}</td></tr>`).join('') || '<tr><td colspan="3">Nimic încă.</td></tr>'}
  </table></div>

  <h2>Bani (mil.)</h2>
  <div class="cifre">
    ${cifra(nr(bani.castigati), `câștigați în ${ZILE} zile`)}
    ${cifra(nr(bani.cheltuiti), `cheltuiți în ${ZILE} zile`)}
    ${cifra(nr(bani.in_portofele), 'în portofele acum', `${nr(bani.cu_bani)} portofele cu bani`)}
    ${cifra(nr(bani.lazi_deschise), 'lăzi și pachete deschise')}
    ${cifra(nr(alte.masini_in_garaje), 'mașini în garaje', `${nr(alte.garaje)} garaje`)}
  </div>
  <div class="doua" style="margin-top:10px">
    <div class="panou"><h3>Câștigați pe zi</h3>${bare(peZi, 'castigati', 'go')}</div>
    <div class="panou"><h3>Cheltuiți pe zi</h3>${bare(peZi, 'cheltuiti', 'gold')}</div>
  </div>
  <div class="panou" style="margin-top:10px"><h3>De unde vin și unde se duc</h3><table>
    <tr><th>Motiv</th><th class="n">De câte ori</th><th class="n">Mil.</th></tr>
    ${motive.map(m => `<tr><td>${esc(m.motiv)}</td><td class="n">${nr(m.n)}</td><td class="n ${m.mil > 0 ? 'plus' : 'minus'}">${m.mil > 0 ? '+' : ''}${nr(m.mil)}</td></tr>`).join('')}
  </table></div>

  <h2>Comunitate</h2>
  <div class="cifre">
    ${cifra(nr(alte.prietenii), 'prietenii')}
    ${cifra(nr(alte.cu_notificari), 'jucători cu notificări')}
    ${cifra(nr(peZi.reduce((s, r) => s + r.conturi_noi, 0)), `conturi noi în ${ZILE} zile`)}
  </div>
</main>
</body>
</html>
`;

const dir = new URL('../../frq-statistici/', import.meta.url);
mkdirSync(dir, { recursive: true });
const fisier = new URL('index.html', dir);
writeFileSync(fisier, html);
const cale = fileURLToPath(fisier);
console.log(`Azi: ${activi.azi} jucători · 7 zile: ${activi.z7} · conturi: ${conturi.total} · bani câștigați/cheltuiți (${ZILE} zile): ${bani.castigati}/${bani.cheltuiti} mil.`);
console.log(`Pagina: ${cale}`);
if (!process.argv.includes('--fara-deschidere')) exec(process.platform === 'win32' ? `start "" "${cale}"` : `open "${cale}"`);
