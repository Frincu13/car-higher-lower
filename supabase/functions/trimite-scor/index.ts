// Primește o Provocare a zilei terminată (Sus sau jos, În ordine) și o pune în
// clasament. Clientul trimite doar răspunsurile și timpul de gândire; scorul îl
// socotește serverul, refăcând partida zilei cu același model ca jocul.
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/sus-model.js';
import '../_shared/ordine-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { recompenseZi } from '../_shared/recompense.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const JOCURI: Record<string, { valid: (r: unknown[]) => boolean; refa: (data: string, r: unknown[]) => number }> = {
  'sus-sau-jos': {
    valid: r => r.every(x => x === 'u' || x === 'd' || x === 'x'),
    refa: (data, r) => G.SusModel.refa(CARS, data, r),
  },
  'ordine': {
    valid: r => r.every(x => Number.isInteger(x) && (x as number) >= -1 && (x as number) <= 2000),
    refa: (data, r) => G.OrdineModel.refa(CARS, data, r),
  },
};

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LIMITA = { trimiteri: 30, minute: 10 };
// sub atât pe răspuns nu se poate juca de mână
const MIN_MS_PE_RASPUNS = 150;
const INTERZISE = /(pula|pizd|muie|futu|fut |cacat|curv|nigg|fuck|shit|bitch|hitler|nazi)/;

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const zi = (d: Date) => d.toISOString().slice(0, 10);
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
  // Înlocuită de funcția `partida`: Provocarea zilei se joacă acum cu cronometru, pornit
  // și verificat pe server. Fără ea, cineva ar putea trimite pe aici o partidă fără ceas.
  return raspuns({ eroare: 'inlocuita' }, 410);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cine, error: eroareCont } = await admin.auth.getUser(jwt);
  if (eroareCont || !cine?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  const id = cine.user.id;

  let b: { joc?: string; data?: string; raspunsuri?: unknown[]; timp_ms?: number; nume?: string };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  const joc = JOCURI[b.joc ?? ''];
  if (!joc) return raspuns({ eroare: 'joc' }, 422);
  const acum = Date.now();
  const zile = [zi(new Date(acum - 864e5)), zi(new Date(acum)), zi(new Date(acum + 864e5))];
  if (typeof b.data !== 'string' || !zile.includes(b.data)) return raspuns({ eroare: 'ziua' }, 422);
  const r = b.raspunsuri;
  if (!Array.isArray(r) || r.length < 1 || r.length > 1000 || !joc.valid(r)) return raspuns({ eroare: 'raspunsuri' }, 422);
  const timp = b.timp_ms;
  if (!Number.isInteger(timp) || timp! < 0 || timp! > 86400000) return raspuns({ eroare: 'timp' }, 422);
  if (timp! < MIN_MS_PE_RASPUNS * r.length) return raspuns({ eroare: 'prea repede' }, 422);

  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  const { error: eroareJucator } = await admin.from('jucatori')
    .upsert({ id, nume, actualizat: new Date(acum).toISOString() });
  if (eroareJucator) return raspuns({ eroare: 'jucator' }, 500);

  const deLa = new Date(acum - LIMITA.minute * 60e3).toISOString();
  const { count } = await admin.from('zi_trimiteri').select('id', { count: 'exact', head: true })
    .eq('jucator', id).gte('creat', deLa);
  if ((count ?? 0) >= LIMITA.trimiteri) return raspuns({ eroare: 'prea multe' }, 429);
  await admin.from('zi_trimiteri').insert({ jucator: id });

  const scor = joc.refa(b.data, r);

  const { data: vechi } = await admin.from('scoruri_zi').select('scor, timp_ms')
    .eq('jucator', id).eq('joc', b.joc).eq('data', b.data).maybeSingle();
  const record = !vechi || scor > vechi.scor || (scor === vechi.scor && timp! < vechi.timp_ms);
  if (record) {
    const { error } = await admin.from('scoruri_zi').upsert({
      jucator: id, joc: b.joc, data: b.data, scor, timp_ms: timp, raspunsuri: r, creat: new Date(acum).toISOString(),
    });
    if (error) return raspuns({ eroare: 'salvare' }, 500);
  }
  // recompensele zilei: dacă nu merg acum, partida rămâne oricum în clasament
  let recompense = null;
  try { recompense = await recompenseZi(admin, id, b.joc!, b.data); } catch { /* fără recompense de data asta */ }
  return raspuns({ scor, timp, record, nume, recompense });
});
