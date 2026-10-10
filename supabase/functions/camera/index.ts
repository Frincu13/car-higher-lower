// Camere private: doi prieteni, fiecare pe telefonul lui. Serverul ține jocul întreg
// și verifică fiecare mutare cu același model ca pagina (licitatie-model.js);
// telefoanele primesc doar ce au voie să vadă și află de mutarea celuilalt prin
// Realtime (rândul din `camere`).
//   { actiune: 'creeaza', joc, miza, nume } -> { id, cod }
//   { actiune: 'intra', cod, nume }         -> { id }
//   { actiune: 'stare', id }                -> { camera, joc, eu, acum }
//   { actiune: 'muta', id, mutare }         -> la fel ca 'stare'
//   { actiune: 'anuleaza', id }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/fereastra.js';
import '../_shared/grades.js';
import '../_shared/kinds.js';
import '../_shared/licitatie-model.js';
import '../_shared/draft-model.js';
import '../_shared/drag-model.js';
import '../_shared/startul-live-model.js';
import '../_shared/sus-model.js';
import '../_shared/ordine-model.js';
import '../_shared/rand-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { platesteRestante } from '../_shared/recompense.ts';
import { inFundal, trimite as notifica } from '../_shared/push.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const JOCURI: Record<string, any> = {
  licitatie: G.LicitatieModel.creeaza(CARS), draft: G.DraftModel.creeaza(CARS), startul: G.StartulLive.creeaza(CARS),
  'sus-sau-jos': G.RandModel.sus(CARS), ordine: G.RandModel.ordine(CARS),
};
const MIZE = [0, 5, 10, 25];
const NUME_JOC: Record<string, string> = { licitatie: 'Licitația', draft: 'Mașina perfectă', startul: 'Startul', 'sus-sau-jos': 'Sus sau jos', ordine: 'În ordine' };
const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LITERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INTERZISE = /(pula|pizd|muie|futu|fut |cacat|curv|nigg|fuck|shit|bitch|hitler|nazi)/;

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function codNou() {
  const b = new Uint32Array(6);
  crypto.getRandomValues(b);
  return [...b].map(x => LITERE[x % LITERE.length]).join('');
}
function numeCurat(n: unknown) {
  const s = String(n ?? '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const simplu = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return s && !INTERZISE.test(simplu + ' ') ? s : null;
}
// numere aleatoare criptografice, pentru loturi și categorii
function aleator() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 4294967296;
}

Deno.serve(async req => {
  const h = cors(req.headers.get('origin') ?? '');
  const raspuns = (corp: unknown, status = 200) =>
    new Response(JSON.stringify(corp), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return raspuns({ eroare: 'metoda' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }
  const acum = Date.now();
  // cine cere (lipsește doar la curățenia de pe server, care nu ține de un jucător)
  let id = '';
  let legat = false;

  async function asiguraJucator() {
    const nume = numeCurat(b.nume);
    if (nume) await admin.from('jucatori').upsert({ id, nume, actualizat: new Date(acum).toISOString() });
    else await admin.from('jucatori').upsert({ id, nume: `Jucător ${id.slice(0, 4).toUpperCase()}` }, { onConflict: 'id', ignoreDuplicates: true });
  }
  const numeDe = async (ids: (string | null)[]) => {
    const { data } = await admin.from('jucatori').select('id, nume').in('id', ids.filter(Boolean));
    return new Map((data ?? []).map((j: { id: string; nume: string }) => [j.id, j.nume]));
  };

  // Aduce camera la zi (termenele trecute), o salvează și plătește la final.
  // Întoarce camera și jocul, sau null.
  // deno-lint-ignore no-explicit-any
  async function laZi(idCamera: string, mutare?: (s: any, p: number, M: any) => string | null, sistem = false): Promise<any> {
    for (let incercare = 0; incercare < 4; incercare++) {
      const { data: c } = await admin.from('camere').select('*').eq('id', idCamera).maybeSingle();
      if (!c) return { eroare: 'camera' };
      const p = sistem ? 0 : c.a === id ? 0 : c.b === id ? 1 : -1;
      if (p < 0) return { eroare: 'camera' };
      if (c.stare !== 'joc' && c.stare !== 'gata') return { c, p, s: null };
      const { data: sec } = await admin.from('camere_secret').select('joc').eq('id', c.id).maybeSingle();
      if (!sec) return { eroare: 'camera' };
      const M = JOCURI[c.joc];
      const s = sec.joc;
      let schimbat = M.avanseaza(s, acum);
      if (mutare) {
        const err = mutare(s, p, M);
        if (err) return { eroare: err };
        schimbat = true;
      }
      if (!schimbat) return { c, p, s, M };
      const stare = s.faza === 'final' ? 'gata' : 'joc';
      const nume = await numeDe([c.a, c.b]);
      const pub = { ...M.vedere(s, -1), nume: [nume.get(c.a) ?? 'Jucător 1', nume.get(c.b) ?? 'Jucător 2'], miza: c.miza };
      const { data: v } = await admin.rpc('camera_salveaza', { p_camera: c.id, p_v: c.v, p_public: pub, p_joc: s, p_stare: stare });
      if (v == null) continue;   // celălalt a mutat între timp: o luăm de la capăt
      if (stare === 'gata' && !c.platit) {
        const w = s.rezultat?.win;
        await admin.rpc('camera_incheie', { p_camera: c.id, p_castigator: w === 0 ? c.a : w === 1 ? c.b : null });
      }
      return { c: { ...c, v, stare, public: pub }, p, s, M };
    }
    return { eroare: 'ocupat' };
  }
  // deno-lint-ignore no-explicit-any
  async function trimite(r: any) {
    if (r.eroare) return raspuns({ eroare: r.eroare }, r.eroare === 'camera' ? 404 : 409);
    const { c, p, s, M } = r;
    const nume = await numeDe([c.a, c.b]);
    return raspuns({
      camera: { id: c.id, cod: c.cod, joc: c.joc, miza: c.miza, stare: c.stare, v: c.v, nume: [nume.get(c.a) ?? null, nume.get(c.b) ?? null], revansa: [!!c.revansa_a, !!c.revansa_b], optiuni: c.optiuni || {} },
      joc: s ? { ...M.vedere(s, p), nume: [nume.get(c.a) ?? 'Jucător 1', nume.get(c.b) ?? 'Jucător 2'], miza: c.miza } : null,
      eu: p, acum,
    });
  }

  // Curățenia, o dată pe minut (pg_cron): camerele în joc cu termenul trecut se duc la
  // capăt (dacă amândoi au plecat, partida se termină singură și miza se plătește),
  // camerele în care n-a intrat nimeni în 30 de minute se închid cu miza înapoi,
  // duelurile expirate se închid și se plătesc premiile restante. Fără cont: nu face
  // decât ce ar fi făcut oricum prima cerere a unui jucător.
  if (b.actiune === 'curata') {
    // doar ceasul din baza de date (pg_cron) o pornește, cu cheia lui
    const cheie = Deno.env.get('CURATENIE_CHEIE');
    if (!cheie || req.headers.get('x-curatenie') !== cheie) return raspuns({ eroare: 'interzis' }, 403);
    const rez = { camere: 0, inchise: 0 };
    const { data: inJoc } = await admin.from('camere').select('id, public').eq('stare', 'joc').limit(50);
    for (const c of inJoc ?? []) {
      const termen = Number(c.public?.termen);
      if (Number.isFinite(termen) && termen <= acum) { await laZi(c.id, undefined, true); rez.camere++; }
    }
    const { data: vechi } = await admin.from('camere').select('id, a').eq('stare', 'asteapta')
      .lt('creat', new Date(acum - 30 * 60e3).toISOString()).limit(50);
    for (const c of vechi ?? []) { await admin.rpc('camera_anuleaza', { p_camera: c.id, p_jucator: c.a }); rez.inchise++; }
    try { await admin.rpc('duel_expira'); } catch { /* data viitoare */ }
    try { await platesteRestante(admin); } catch { /* data viitoare */ }
    // ce nu mai trebuie: partidele cu cronometru de peste 3 săptămâni (recordurile stau
    // separat, în scoruri_general) și camerele terminate de peste o săptămână
    try {
      await admin.from('partide').delete().lt('inceput', new Date(acum - 21 * 864e5).toISOString());
      await admin.from('camere').delete().in('stare', ['gata', 'anulata']).lt('actualizat', new Date(acum - 7 * 864e5).toISOString());
    } catch { /* data viitoare */ }
    return raspuns(rez);
  }

  // de aici încolo, doar un jucător cu cont
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cine, error: eroareCont } = await admin.auth.getUser(jwt);
  if (eroareCont || !cine?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  id = cine.user.id;
  // cu miză se joacă doar din conturi legate de mail, ca la dueluri
  legat = !cine.user.is_anonymous;

  if (b.actiune === 'creeaza') {
    if (!JOCURI[b.joc]) return raspuns({ eroare: 'joc' }, 422);
    if (!MIZE.includes(b.miza)) return raspuns({ eroare: 'miza' }, 422);
    if (b.miza > 0 && !legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    await asiguraJucator();
    // camerele mele lăsate în joc se duc la capăt (termenele trecute), ca miza să nu rămână blocată
    const { data: inJoc } = await admin.from('camere').select('id').or(`a.eq.${id},b.eq.${id}`).eq('stare', 'joc').limit(5);
    for (const x of inJoc ?? []) await laZi(x.id);
    // camerele mele care încă așteaptă se închid (miza înapoi): una singură deodată
    const { data: vechi } = await admin.from('camere').select('id').eq('a', id).eq('stare', 'asteapta');
    for (const x of vechi ?? []) await admin.rpc('camera_anuleaza', { p_camera: x.id, p_jucator: id });
    for (let i = 0; i < 4; i++) {
      const { data, error } = await admin.rpc('camera_creeaza', { p_jucator: id, p_joc: b.joc, p_miza: b.miza, p_cod: codNou() });
      if (error) { if (String(error.code) === '23505') continue; return raspuns({ eroare: 'camera' }, 500); }
      if (data?.eroare) return raspuns({ eroare: data.eroare }, 409);
      if (b.joc === 'startul') {
        const clasa = Number.isInteger(b.clasa) && b.clasa >= 0 && b.clasa <= 4 ? b.clasa : 0;
        await admin.from('camere').update({ optiuni: { clasa } }).eq('id', data.id);
        data.clasa = clasa;
      }
      // Sus sau jos: modul (mixt sau o categorie); În ordine: categoria
      if (b.joc === 'sus-sau-jos' || b.joc === 'ordine') {
        const ok = b.joc === 'sus-sau-jos' ? ['mix', 'hp', 'weight', 'accel'] : ['hp', 'weight', 'accel'];
        const o = b.joc === 'sus-sau-jos' ? { mod: ok.includes(b.mod) ? b.mod : 'mix' } : { cat: ok.includes(b.cat) ? b.cat : null };
        await admin.from('camere').update({ optiuni: o }).eq('id', data.id);
      }
      return raspuns(data);
    }
    return raspuns({ eroare: 'cod' }, 500);
  }

  if (b.actiune === 'intra') {
    const cod = String(b.cod ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const { data: c } = await admin.from('camere').select('id, a, b, miza, joc, stare, optiuni').eq('cod', cod).maybeSingle();
    if (!c) return raspuns({ eroare: 'camera' }, 404);
    if (c.a === id || c.b === id) return raspuns({ id: c.id });   // e deja a ta: doar o deschizi
    if (c.miza > 0 && !legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    await asiguraJucator();
    const { data: r, error } = await admin.rpc('camera_intra', { p_camera: c.id, p_jucator: id });
    if (error) return raspuns({ eroare: 'camera' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    // jocul începe: loturile și categoriile le trage serverul
    const M = JOCURI[c.joc];
    const s = M.noua(aleator, acum, 0, c.optiuni || {});
    const nume = await numeDe([c.a, id]);
    const pub = { ...M.vedere(s, -1), nume: [nume.get(c.a) ?? 'Jucător 1', nume.get(id) ?? 'Jucător 2'], miza: c.miza };
    const { data: cv } = await admin.from('camere').select('v').eq('id', c.id).single();
    await admin.rpc('camera_salveaza', { p_camera: c.id, p_v: cv.v, p_public: pub, p_joc: s, p_stare: 'joc' });
    // cine a făcut camera poate să nu mai fie pe ecran: îl chemăm
    await inFundal(notifica(admin, [c.a], 'dueluri', {
      titlu: `${nume.get(id) ?? 'Prietenul tău'} a intrat în cameră`, text: `${NUME_JOC[c.joc] ?? 'Jocul'} a început. Te așteaptă.`,
      url: `camera.html?cod=${cod}`, tag: `frq-camera-${c.id}`,
    }));
    return raspuns({ id: c.id });
  }

  if (b.actiune === 'stare') {
    if (typeof b.id !== 'string') return raspuns({ eroare: 'camera' }, 422);
    return trimite(await laZi(b.id));
  }

  if (b.actiune === 'muta') {
    if (typeof b.id !== 'string' || !b.mutare || typeof b.mutare !== 'object') return raspuns({ eroare: 'mutare' }, 422);
    if (b.mutare.tip === 'masina') {
      // mașina trebuie să fie în garajul tău; nivelul de tuning îl ia serverul de acolo
      const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', String(b.mutare.masina ?? '')).maybeSingle();
      if (!g) return raspuns({ eroare: 'masina' }, 409);
      b.mutare = { tip: 'masina', masina: b.mutare.masina, nivel: g.nivel };
    }
    // deno-lint-ignore no-explicit-any
    return trimite(await laZi(b.id, (s: any, p: number, M: any) => M.muta(s, p, b.mutare, acum)));
  }

  // Revanșa: o cere (sau o acceptă) fiecare; la a doua, partida nouă pornește aici.
  if (b.actiune === 'revansa') {
    if (typeof b.id !== 'string') return raspuns({ eroare: 'camera' }, 422);
    const { data: r, error } = await admin.rpc('camera_revansa', { p_camera: b.id, p_jucator: id });
    if (error) return raspuns({ eroare: 'camera' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    if (r?.porneste) {
      const { data: c } = await admin.from('camere').select('*').eq('id', b.id).single();
      const M = JOCURI[c.joc];
      // la fiecare revanșă începe celălalt
      const s = M.noua(aleator, acum, (c.runda - 1) % 2, c.optiuni || {});
      const nume = await numeDe([c.a, c.b]);
      const pub = { ...M.vedere(s, -1), nume: [nume.get(c.a) ?? 'Jucător 1', nume.get(c.b) ?? 'Jucător 2'], miza: c.miza };
      await admin.rpc('camera_salveaza', { p_camera: c.id, p_v: c.v, p_public: pub, p_joc: s, p_stare: 'joc' });
    } else {
      // prima cerere: celălalt află și dacă a închis pagina
      const { data: c } = await admin.from('camere').select('id, cod, joc, a, b').eq('id', b.id).single();
      const altul = c?.a === id ? c?.b : c?.a;
      if (altul) {
        const n = await numeDe([id]);
        await inFundal(notifica(admin, [altul], 'dueluri', {
          titlu: `${n.get(id) ?? 'Prietenul tău'} vrea revanșa`, text: `${NUME_JOC[c.joc] ?? 'Jocul'}, încă o dată. Intră și acceptă.`,
          url: `camera.html?cod=${c.cod}`, tag: `frq-camera-${c.id}`,
        }));
      }
    }
    return trimite(await laZi(b.id));
  }

  if (b.actiune === 'anuleaza') {
    const { data: r, error } = await admin.rpc('camera_anuleaza', { p_camera: b.id, p_jucator: id });
    if (error) return raspuns({ eroare: 'camera' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ok: true });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
