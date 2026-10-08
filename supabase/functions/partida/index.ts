// Partidele cu cronometru din Sus sau jos și În ordine, pentru clasamentul general.
//   { actiune: 'start', joc, cat, nume }  -> { id, seed }
//   { actiune: 'gata', id, raspunsuri, timp_ms } -> { scor, timp, record, valid }
//   { actiune: 'nume', nume } -> { nume }
// Serverul dă seed-ul și ține ora de start; la final reface partida din răspunsuri
// și verifică pe ceasul lui că a încăput în secundele date pe fiecare mașină. Așa nu
// se poate juca o partidă aleasă dinainte și nici căuta răspunsurile pe îndelete.
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/sus-model.js';
import '../_shared/ordine-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
// `secunde`: cronometrul de pe fiecare mașină; `pauza`: cât ține animația dintre două
// mașini (aceeași ca în joc), plus o marjă pentru telefoane lente.
const JOCURI: Record<string, {
  cat: string[]; secunde: number; pauza: number;
  valid: (r: unknown[]) => boolean; refa: (seed: number, cat: string, r: unknown[]) => number;
}> = {
  'sus-sau-jos': {
    cat: ['mix', 'hp', 'weight', 'accel'], secunde: 10, pauza: 4,
    valid: r => r.every(x => x === 'u' || x === 'd' || x === 'x'),
    refa: (seed, cat, r) => G.SusModel.refaPartida(CARS, seed, cat, r),
  },
  'ordine': {
    cat: ['hp', 'weight', 'accel'], secunde: 15, pauza: 3,
    valid: r => r.every(x => Number.isInteger(x) && (x as number) >= -1 && (x as number) <= 2000),
    refa: (seed, cat, r) => G.OrdineModel.refaPartida(CARS, seed, cat, r),
  },
};

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LIMITA = { partide: 40, minute: 10 };
const MARJA_MS = 30_000;            // încărcare, rețea, o poză care vine greu
const MIN_MS_PE_RASPUNS = 150;      // sub atât nu se poate juca de mână
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

  let b: { actiune?: string; joc?: string; cat?: string; nume?: string; id?: string; raspunsuri?: unknown[]; timp_ms?: number };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }
  const acum = Date.now();

  if (b.actiune === 'start') {
    const joc = JOCURI[b.joc ?? ''];
    if (!joc) return raspuns({ eroare: 'joc' }, 422);
    if (!joc.cat.includes(b.cat ?? '')) return raspuns({ eroare: 'categorie' }, 422);

    const deLa = new Date(acum - LIMITA.minute * 60e3).toISOString();
    const { count } = await admin.from('partide').select('id', { count: 'exact', head: true })
      .eq('jucator', id).gte('inceput', deLa);
    if ((count ?? 0) >= LIMITA.partide) return raspuns({ eroare: 'prea multe' }, 429);

    const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
    const { error: eroareJucator } = await admin.from('jucatori')
      .upsert({ id, nume, actualizat: new Date(acum).toISOString() });
    if (eroareJucator) return raspuns({ eroare: 'jucator' }, 500);

    // partidele neterminate de ieri încolo nu mai pot intra: le strângem
    await admin.from('partide').delete().eq('jucator', id).is('terminat', null)
      .lt('inceput', new Date(acum - 864e5).toISOString());

    const seed = crypto.getRandomValues(new Int32Array(1))[0];
    const { data: p, error } = await admin.from('partide')
      .insert({ jucator: id, joc: b.joc, cat: b.cat, seed }).select('id').single();
    if (error || !p) return raspuns({ eroare: 'salvare' }, 500);
    return raspuns({ id: p.id, seed });
  }

  if (b.actiune === 'gata') {
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return raspuns({ eroare: 'partida' }, 422);
    const { data: p } = await admin.from('partide').select('*').eq('id', b.id).eq('jucator', id).maybeSingle();
    if (!p) return raspuns({ eroare: 'partida' }, 404);
    if (p.terminat) return raspuns({ eroare: 'terminata' }, 409);
    const joc = JOCURI[p.joc];
    const r = b.raspunsuri;
    if (!Array.isArray(r) || r.length < 1 || r.length > 1000 || !joc.valid(r)) return raspuns({ eroare: 'raspunsuri' }, 422);
    const timp = b.timp_ms;
    if (!Number.isInteger(timp) || timp! < 0 || timp! > 86400000) return raspuns({ eroare: 'timp' }, 422);

    const scor = joc.refa(p.seed, p.cat, r);
    // Ceasul serverului: de la start până acum, cel mult secundele de pe fiecare mașină
    // jucată plus pauzele dintre ele. Timpul de gândire trimis nu poate fi mai mare
    // decât cronometrul, nici decât a trecut de fapt.
    const trecut = acum - new Date(p.inceput).getTime();
    const n = r.length;
    const valid = trecut <= n * (joc.secunde + joc.pauza) * 1000 + MARJA_MS
      && timp! <= n * joc.secunde * 1000 + 500
      && timp! <= trecut + 2000
      && timp! >= MIN_MS_PE_RASPUNS * n;

    const { data: inchisa } = await admin.from('partide')
      .update({ terminat: new Date(acum).toISOString(), scor: valid ? scor : null, timp_ms: valid ? timp : null })
      .eq('id', p.id).is('terminat', null).select('id');
    if (!inchisa?.length) return raspuns({ eroare: 'terminata' }, 409);
    if (!valid) return raspuns({ scor, timp, record: false, valid: false });

    const { data: vechi } = await admin.from('scoruri_general').select('scor, timp_ms')
      .eq('jucator', id).eq('joc', p.joc).eq('cat', p.cat).maybeSingle();
    const record = scor > 0 && (!vechi || scor > vechi.scor || (scor === vechi.scor && timp! < vechi.timp_ms));
    if (record) {
      const { error } = await admin.from('scoruri_general').upsert({
        jucator: id, joc: p.joc, cat: p.cat, scor, timp_ms: timp, partida: p.id, creat: new Date(acum).toISOString(),
      });
      if (error) return raspuns({ eroare: 'salvare' }, 500);
    }
    return raspuns({ scor, timp, record, valid: true });
  }

  // numele din clasamente, schimbat de pe ecranul de final
  if (b.actiune === 'nume') {
    const nume = numeCurat(b.nume);
    if (!nume) return raspuns({ eroare: 'nume' }, 422);
    const { error } = await admin.from('jucatori').upsert({ id, nume, actualizat: new Date(acum).toISOString() });
    if (error) return raspuns({ eroare: 'jucator' }, 500);
    return raspuns({ nume });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
