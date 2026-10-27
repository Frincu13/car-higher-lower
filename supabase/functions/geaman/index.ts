// Geamănul contra botului, cu bani. Meciul stă pe server: mașinile date și alegerile
// botului ies dintr-o sămânță care nu pleacă de aici. Telefonul primește mașina rundei,
// trimite cele trei alegeri și primește rezultatul (cu ale botului); la ultima rundă,
// serverul plătește după rezultat, în plafonul zilei (ca la Duel de cărți).
//   { actiune: 'start', nivel, nume } -> { id, din, tinta }
//   { actiune: 'start', zi: true, nume } -> Provocarea zilei: aceleași cinci mașini pentru
//     toți, contra botului mediu; o dată pe zi (una începută se reia) -> { id, din, tinta, n, scor, zi }
//   { actiune: 'muta', id, n, masini: [cp, kg, 0-100] } -> { runda, scor, urm, final? }
//     runda: { tinta, masini: [[3], [3]], puncte: [[3], [3]], total: [a, b], best: [3] }
//     final: { valid, castigat, scor, bani, misiuni }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/geaman-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, misiuni, recompenseZi } from '../_shared/recompense.ts';
import { permis } from '../_shared/limita.ts';
import '../_shared/economie.js';

// deno-lint-ignore no-explicit-any
const Gl = globalThis as any;
const E = Gl.Economie, GM = Gl.GeamanModel;
const G = GM.creeaza(CARS);

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LIMITA = { partide: 30, minute: 10 };
const MIN_MS_PE_RUNDA = 3000;       // trei mașini căutate și alese nu se fac mai repede
const INTERZISE = /(pula|pizd|muie|futu|fut |cacat|curv|nigg|fuck|shit|bitch|hitler|nazi)/;

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function numeCurat(n: unknown) {
  const s = String(n ?? '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  const simplu = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return s && !INTERZISE.test(simplu + ' ') ? s : null;
}
// botul, pe runda `r`: un generator din sămânța meciului (aceleași alegeri la o cerere repetată)
const rngBot = (sem: number[], r: number) => GM.rngDin((sem[1] ^ Math.imul(r + 1, 0x9e3779b9)) >>> 0);

// sămânța Provocării zilei: din dată, aceeași pentru toți
const semZi = (data: string) => [0, 1].map(i => E.hash(`geaman-zi|${data}|${i}`) >>> 0);

// Banii meciului (victoria sau meciul jucat), în plafonul zilei, ca la orice meci contra
// botului; la Provocarea zilei vin pe lângă premiul provocării.
// deno-lint-ignore no-explicit-any
async function baniMeci(admin: any, id: string, partida: string, ar_fi: number, castigat: boolean) {
  let castig = 0, azi = 0;
  try {
    await asiguraPortofel(admin, id);
    const { data: c } = await admin.rpc('castig_joc', {
      p_jucator: id, p_mil: ar_fi, p_plafon: E.CASTIG.plafon,
      p_motiv: castigat ? 'victorie' : 'partida', p_cheie: `geaman:${partida}`, p_data: E.ziua(),
    });
    castig = c ?? 0;
  } catch { /* fără bani de data asta */ }
  try {
    const { data: m } = await admin.from('miscari').select('mil').eq('jucator', id).in('motiv', ['partida', 'victorie']).filter('detalii->>zi', 'eq', E.ziua());
    azi = (m ?? []).reduce((t: number, x: { mil: number }) => t + x.mil, 0);
  } catch { /* fără total */ }
  return { castig, ar_fi, bonus: 0, azi, plafon: E.CASTIG.plafon };
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
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cine, error: eroareCont } = await admin.auth.getUser(jwt);
  if (eroareCont || !cine?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  const id = cine.user.id;

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }
  const acum = Date.now();

  if (b.actiune === 'start' && b.zi === true) {
    const data = E.ziua();
    const { data: facuta } = await admin.from('scoruri_zi').select('scor').eq('jucator', id).eq('joc', 'geaman').eq('data', data).maybeSingle();
    if (facuta) return raspuns({ eroare: 'deja', scor: facuta.scor }, 409);
    const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
    await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
    const sem = semZi(data);
    const tinte = G.tinte(GM.rngDin(sem[0])).map((c: { id: number }) => c.id);
    // una începută azi se reia de unde ai rămas (aceleași mașini pentru toți)
    const { data: veche } = await admin.from('partide').select('id, date').eq('jucator', id).eq('joc', 'geaman').is('terminat', null)
      .filter('date->>zi', 'eq', data).order('inceput', { ascending: false }).limit(1).maybeSingle();
    if (veche) {
      const alegeri: (number | null)[][] = Array.isArray(veche.date?.alegeri) ? veche.date.alegeri : [];
      if (alegeri.length < tinte.length) {
        const scor = [0, 1].map(k => alegeri.reduce((t, m, r) => {
          const tr = G.dupaId.get(tinte[r]);
          const ales = k ? G.alegeBot(tr, 1, rngBot(sem, r)) : m.map(x => (x == null ? null : G.dupaId.get(x)));
          return t + G.puncteAlegere(tr, ales).reduce((a: number, y: number) => a + y, 0);
        }, 0));
        return raspuns({ id: veche.id, din: tinte.length, tinta: tinte[alegeri.length], n: alegeri.length, scor, zi: true });
      }
    }
    const { data: p, error } = await admin.from('partide')
      .insert({ jucator: id, joc: 'geaman', cat: 'bot1', seed: 0, date: { sem, zi: data, tinte, alegeri: [], n: 0 } })
      .select('id').single();
    if (error || !p) return raspuns({ eroare: 'salvare' }, 500);
    return raspuns({ id: p.id, din: tinte.length, tinta: tinte[0], n: 0, scor: [0, 0], zi: true });
  }

  if (b.actiune === 'start') {
    const nivel = b.nivel;
    if (![0, 1, 2].includes(nivel)) return raspuns({ eroare: 'nivel' }, 422);
    const deLa = new Date(acum - LIMITA.minute * 60e3).toISOString();
    const { count } = await admin.from('partide').select('id', { count: 'exact', head: true }).eq('jucator', id).gte('inceput', deLa);
    if ((count ?? 0) >= LIMITA.partide) return raspuns({ eroare: 'prea multe' }, 429);
    const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
    await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
    const sem = [...crypto.getRandomValues(new Uint32Array(2))];
    const tinte = G.tinte(GM.rngDin(sem[0])).map((c: { id: number }) => c.id);
    const { data: p, error } = await admin.from('partide')
      .insert({ jucator: id, joc: 'geaman', cat: `bot${nivel}`, seed: 0, date: { sem, tinte, alegeri: [], n: 0 } })
      .select('id').single();
    if (error || !p) return raspuns({ eroare: 'salvare' }, 500);
    return raspuns({ id: p.id, din: tinte.length, tinta: tinte[0] });
  }

  if (b.actiune === 'muta') {
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return raspuns({ eroare: 'partida' }, 422);
    if (!Number.isInteger(b.n) || !Array.isArray(b.masini) || b.masini.length !== 3) return raspuns({ eroare: 'mutare' }, 422);
    if (!(await permis(admin, `geaman:muta:${id}`, [60, 60]))) return raspuns({ eroare: 'prea multe' }, 429);
    const { data: p } = await admin.from('partide').select('*').eq('id', b.id).eq('jucator', id).eq('joc', 'geaman').maybeSingle();
    if (!p) return raspuns({ eroare: 'partida' }, 404);
    const d = p.date ?? {};
    const sem: number[] = d.sem, tinte: number[] = d.tinte ?? [], vechi: (number | null)[][] = Array.isArray(d.alegeri) ? d.alegeri : [];
    if (!Array.isArray(sem) || tinte.length !== GM.RUNDE) return raspuns({ eroare: 'partida' }, 409);
    const nivel = Number(String(p.cat).slice(3));
    // aceeași mutare trimisă din nou (răspunsul s-a pierdut): același rezultat, fără dublură
    const mutare = b.masini.map((x: unknown) => (Number.isInteger(x) ? x as number : null));
    const repetata = b.n === vechi.length - 1 && JSON.stringify(vechi[b.n]) === JSON.stringify(mutare);
    if (!repetata && (p.terminat || b.n !== vechi.length || b.n >= tinte.length)) return raspuns({ eroare: p.terminat ? 'terminata' : 'mutare' }, 409);
    const t = G.dupaId.get(tinte[b.n]);
    const trei = mutare.map((x: number | null) => (x == null ? null : G.dupaId.get(x)));
    if (trei.some((c: unknown, i: number) => mutare[i] != null && !G.ePosibila(t, c))) return raspuns({ eroare: 'masina' }, 422);
    const alegeri = repetata ? vechi : [...vechi, mutare];

    // toate rundele de până acum (scorul), cu botul refăcut din sămânță
    const runde = alegeri.map((m, r) => {
      const tr = G.dupaId.get(tinte[r]);
      const bot = G.alegeBot(tr, nivel, rngBot(sem, r));
      const eu = m.map(x => (x == null ? null : G.dupaId.get(x)));
      const puncte = [G.puncteAlegere(tr, eu), G.puncteAlegere(tr, bot)];
      return { tinta: tr.id, masini: [m, bot.map((c: { id: number }) => c.id)], puncte, total: puncte.map((x: number[]) => x.reduce((s, y) => s + y, 0)), best: G.celeMaiBune(tr).map((c: { id: number }) => c.id) };
    });
    const scor = [0, 1].map(k => runde.reduce((s, r) => s + r.total[k], 0));
    const runda = runde[b.n];
    const gata = alegeri.length >= tinte.length;
    const urm = gata ? null : tinte[alegeri.length];

    if (!repetata) {
      const { data: scrisa } = await admin.from('partide')
        .update({ date: { ...d, alegeri, n: alegeri.length } })
        .eq('id', p.id).is('terminat', null).filter('date->>n', 'eq', String(vechi.length)).select('id');
      if (!scrisa?.length) return raspuns({ eroare: 'mutare' }, 409);
    }
    if (!gata) return raspuns({ runda, scor, urm });
    if (p.terminat) return raspuns({ runda, scor, urm, final: { valid: null } });

    const trecut = acum - new Date(p.inceput).getTime();
    const valid = trecut >= tinte.length * MIN_MS_PE_RUNDA;
    const castigat = scor[0] > scor[1];
    const { data: inchisa } = await admin.from('partide')
      .update({ terminat: new Date(acum).toISOString(), scor: valid ? scor[0] : null, timp_ms: Math.min(trecut, 2e9), date: { ...d, alegeri, n: alegeri.length, castigat } })
      .eq('id', p.id).is('terminat', null).select('id');
    if (!inchisa?.length) return raspuns({ runda, scor, urm, final: { valid: null } });
    if (!valid) return raspuns({ runda, scor, urm, final: { valid: false } });

    // Provocarea zilei: punctele tale în clasamentul zilei și premiul provocării, în locul banilor de meci
    if (d.zi) {
      const bani = await baniMeci(admin, id, p.id, E.CASTIG.geaman(1, castigat), castigat);
      let recompense = null;
      try {
        await admin.from('scoruri_zi').upsert({ jucator: id, joc: 'geaman', data: d.zi, scor: scor[0], timp_ms: Math.min(trecut, 86400000), raspunsuri: alegeri }, { onConflict: 'jucator,joc,data', ignoreDuplicates: true });
        recompense = await recompenseZi(admin, id, 'geaman', d.zi);
      } catch { /* fără recompense de data asta */ }
      let mis = null;
      try { mis = (await misiuni(admin, id, !!cine.user.is_anonymous)).filter((m: { noua?: boolean }) => m.noua); } catch { /* fără misiuni acum */ }
      return raspuns({ runda, scor, urm, final: { valid: true, castigat, scor, zi: { scor: scor[0] }, bani, recompense, misiuni: mis } });
    }
    const ar_fi = E.CASTIG.geaman(nivel, castigat);
    let castig = 0;
    try {
      await asiguraPortofel(admin, id);
      const { data: c } = await admin.rpc('castig_joc', {
        p_jucator: id, p_mil: ar_fi, p_plafon: E.CASTIG.plafon,
        p_motiv: castigat ? 'victorie' : 'partida', p_cheie: `geaman:${p.id}`, p_data: E.ziua(),
      });
      castig = c ?? 0;
    } catch { /* fără bani de data asta */ }
    let azi = 0;
    try {
      const { data: m } = await admin.from('miscari').select('mil').eq('jucator', id).in('motiv', ['partida', 'victorie']).filter('detalii->>zi', 'eq', E.ziua());
      azi = (m ?? []).reduce((s: number, x: { mil: number }) => s + x.mil, 0);
    } catch { /* fără total */ }
    let mis = null;
    try { mis = (await misiuni(admin, id, !!cine.user.is_anonymous)).filter((m: { noua?: boolean }) => m.noua); } catch { /* fără misiuni acum */ }
    return raspuns({ runda, scor, urm, final: { valid: true, castigat, scor, bani: { castig, ar_fi, bonus: 0, azi, plafon: E.CASTIG.plafon }, misiuni: mis } });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
