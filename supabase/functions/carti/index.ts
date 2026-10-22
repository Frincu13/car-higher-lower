// Duel de cărți contra botului, cu bani. Meciul stă pe server: sămânța (amestecul,
// pachetul și deciziile botului) nu pleacă de aici, deci mutările botului și cărțile
// care urmează nu se pot afla dinainte. Telefonul trimite câte o mutare pe rundă și
// primește rezultatul; la ultima, serverul plătește după rezultat, în plafonul zilei.
//   { actiune: 'start', v: 2, nivel, pachet: [chei din garaj], nume } -> { id, imprumut: [chei], vedere }
//   { actiune: 'muta', id, n, k?, i } -> { runda: { cat, carti: [cheie, cheie], castiga }, vedere, final? }
//     final: { valid, castigat, scor, bani, misiuni }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/carti-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, misiuni } from '../_shared/recompense.ts';
import { permis } from '../_shared/limita.ts';
import '../_shared/economie.js';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const E = G.Economie, K = G.CartiModel, M = G.DragModel;
const MOD = K.creeaza(M, M.creeaza(CARS));

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LIMITA = { partide: 30, minute: 10 };
const MIN_MS_PE_RUNDA = 1200;       // categoria, cartea și întoarcerea nu se fac mai repede
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

  if (b.actiune === 'start') {
    // telefoanele cu versiunea veche (care cereau sămânța) joacă fără bani până se actualizează
    if (b.v !== 2) return raspuns({ eroare: 'versiune' }, 426);
    const nivel = b.nivel;
    if (![0, 1, 2].includes(nivel)) return raspuns({ eroare: 'nivel' }, 422);
    const chei = b.pachet;
    if (!Array.isArray(chei) || chei.length > K.PACHET || !chei.every((k: unknown) => typeof k === 'string' && k.length < 120)) return raspuns({ eroare: 'pachet' }, 422);
    const deLa = new Date(acum - LIMITA.minute * 60e3).toISOString();
    const { count } = await admin.from('partide').select('id', { count: 'exact', head: true }).eq('jucator', id).gte('inceput', deLa);
    if ((count ?? 0) >= LIMITA.partide) return raspuns({ eroare: 'prea multe' }, 429);
    // cărțile tale trebuie să fie în garaj; restul se împrumută
    let carti = [];
    if (chei.length) {
      const { data: g } = await admin.from('garaje').select('masina').eq('jucator', id).in('masina', chei);
      const are = new Set((g ?? []).map((x: { masina: string }) => x.masina));
      carti = chei.filter((k: string) => are.has(k)).map((k: string) => MOD.dupaCheie.get(k)).filter(Boolean);
    }
    if (!K.pachetValid(carti)) return raspuns({ eroare: 'buget' }, 422);
    const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
    await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
    // două semințe: împrumuturile (se văd) și meciul (128 de biți, rămâne aici)
    const [seed, ...sem] = [...crypto.getRandomValues(new Uint32Array(5))];
    const pachet = K.completeaza(MOD, carti, seed >>> 1);
    const { data: p, error } = await admin.from('partide')
      .insert({ jucator: id, joc: 'carti', cat: `bot${nivel}`, seed: 0, date: { sem, pachet: pachet.map((x: { k: string }) => x.k), imprumut: pachet.filter((x: { imprumut?: boolean }) => x.imprumut).map((x: { k: string }) => x.k), mutari: [], n: 0 } })
      .select('id').single();
    if (error || !p) return raspuns({ eroare: 'salvare' }, 500);
    const { s } = K.pasBot(pachet, nivel, sem, MOD, []);
    return raspuns({ id: p.id, imprumut: pachet.filter((x: { imprumut?: boolean }) => x.imprumut).map((x: { k: string }) => x.k), vedere: K.vedereBot(s, false) });
  }

  if (b.actiune === 'muta') {
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return raspuns({ eroare: 'partida' }, 422);
    if (!Number.isInteger(b.n) || !Number.isInteger(b.i) || (b.k != null && typeof b.k !== 'string')) return raspuns({ eroare: 'mutare' }, 422);
    if (!(await permis(admin, `carti:muta:${id}`, [120, 60]))) return raspuns({ eroare: 'prea multe' }, 429);
    const { data: p } = await admin.from('partide').select('*').eq('id', b.id).eq('jucator', id).eq('joc', 'carti').maybeSingle();
    if (!p) return raspuns({ eroare: 'partida' }, 404);
    const nivel = Number(String(p.cat).slice(3));
    const imp = new Set(p.date?.imprumut ?? []);
    const pachet = (p.date?.pachet ?? []).map((k: string) => {
      const x = MOD.dupaCheie.get(k);
      return x && (imp.has(k) ? { ...x, imprumut: true } : x);
    });
    if (pachet.length !== K.PACHET || pachet.some((x: unknown) => !x)) return raspuns({ eroare: 'pachet' }, 409);
    // `n` = a câta mutare e. Aceeași mutare trimisă din nou (răspunsul s-a pierdut pe drum)
    // primește același rezultat, fără să se joace de două ori.
    const vechi = Array.isArray(p.date?.mutari) ? p.date.mutari : [];
    const mutare = b.k ? { k: b.k, i: b.i } : { i: b.i };
    const repetata = b.n === vechi.length - 1 && vechi[b.n]?.i === mutare.i && (vechi[b.n]?.k ?? null) === (mutare.k ?? null);
    if (!repetata && (p.terminat || b.n !== vechi.length)) return raspuns({ eroare: p.terminat ? 'terminata' : 'mutare' }, 409);
    const mutari = repetata ? vechi : [...vechi, mutare];
    const x = Array.isArray(p.date?.sem) && p.date.sem.length === 4 && K.pasBot(pachet, nivel, p.date.sem, MOD, mutari);
    if (!x) return raspuns({ eroare: 'mutare' }, 422);
    const { s, ultim } = x;
    const runda = { cat: ultim.cat, carti: ultim.carti.map((c: { k: string }) => c.k), castiga: ultim.castiga };
    const vedere = K.vedereBot(s, !s.gata && s.alege === 1);
    // banii s-au dat la prima cerere; aici doar rezultatul rundei (dacă meciul s-a încheiat
    // fără să se închidă, de exemplu o cădere între cele două scrieri, se închide acum)
    if (repetata && (!s.gata || p.terminat)) return raspuns({ runda, vedere, ...(s.gata ? { final: { valid: null } } : {}) });
    if (!repetata) {
      // o singură mutare pe rundă: dacă două cereri vin deodată, doar prima se scrie
      const { data: scrisa } = await admin.from('partide')
        .update({ date: { ...p.date, mutari, n: mutari.length } })
        .eq('id', p.id).is('terminat', null).filter('date->>n', 'eq', String(vechi.length)).select('id');
      if (!scrisa?.length) return raspuns({ eroare: 'mutare' }, 409);
    }
    if (!s.gata) return raspuns({ runda, vedere });

    const trecut = acum - new Date(p.inceput).getTime();
    const valid = trecut >= s.runda * MIN_MS_PE_RUNDA;
    const { data: inchisa } = await admin.from('partide')
      .update({ terminat: new Date(acum).toISOString(), scor: valid ? s.j[0].scor : null, timp_ms: Math.min(trecut, 2e9), date: { ...p.date, mutari, n: mutari.length, castigat: s.castigator === 0 } })
      .eq('id', p.id).is('terminat', null).select('id');
    if (!inchisa?.length) return raspuns({ eroare: 'terminata' }, 409);
    if (!valid) return raspuns({ runda, vedere, final: { valid: false } });

    const castigat = s.castigator === 0;
    const ar_fi = E.CASTIG.carti(nivel, castigat);
    let castig = 0;
    try {
      await asiguraPortofel(admin, id);
      const { data: c } = await admin.rpc('castig_joc', {
        p_jucator: id, p_mil: ar_fi, p_plafon: E.CASTIG.plafon,
        p_motiv: castigat ? 'victorie' : 'partida', p_cheie: `carti:${p.id}`, p_data: E.ziua(),
      });
      castig = c ?? 0;
    } catch { /* fără bani de data asta */ }
    let azi = 0;
    try {
      const { data: m } = await admin.from('miscari').select('mil').eq('jucator', id).in('motiv', ['partida', 'victorie']).filter('detalii->>zi', 'eq', E.ziua());
      azi = (m ?? []).reduce((t: number, x: { mil: number }) => t + x.mil, 0);
    } catch { /* fără total */ }
    let mis = null;
    try { mis = (await misiuni(admin, id, !!cine.user.is_anonymous)).filter((m: { noua?: boolean }) => m.noua); } catch { /* fără misiuni acum */ }
    return raspuns({ runda, vedere, final: { valid: true, castigat, scor: s.j.map((x: { scor: number }) => x.scor), bani: { castig, ar_fi, bonus: 0, azi, plafon: E.CASTIG.plafon }, misiuni: mis } });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
