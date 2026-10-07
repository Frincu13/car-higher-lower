// Garajul meu: starea portofelului și a garajului, și deschiderea lăzilor. Mașina din
// ladă o trage serverul, cu numere aleatoare criptografice; pagina doar arată banda.
//   { actiune: 'stare', nume? }            -> { portofel, garaj }
//   { actiune: 'lada', lada, gratis }      -> { masina, raritate, noua, valoare, mil, lazi_gratis }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/economie.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel } from '../_shared/recompense.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const M = G.DragModel, E = G.Economie;
const MD = M.creeaza(CARS);

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
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
// un număr în [0, 1), din generatorul criptografic
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
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cine, error: eroareCont } = await admin.auth.getUser(jwt);
  if (eroareCont || !cine?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  const id = cine.user.id;

  let b: { actiune?: string; nume?: string; lada?: string; gratis?: boolean };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  // jucătorul și portofelul există (numele nu se schimbă aici dacă există deja)
  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
  let portofel;
  try { portofel = await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }

  if (b.actiune === 'stare') {
    const { data: garaj, error } = await admin.from('garaje').select('masina, raritate, nivel, bucati, blocat').eq('jucator', id);
    if (error) return raspuns({ eroare: 'garaj' }, 500);
    return raspuns({ portofel, garaj });
  }

  if (b.actiune === 'lada') {
    const gratis = b.gratis === true;
    // lada gratis e mereu una de Stradă
    const lada = E.LAZI.find((l: { id: string }) => l.id === (gratis ? 'strada' : b.lada));
    if (!lada) return raspuns({ eroare: 'lada' }, 422);
    const { raritate, car } = E.trage(lada, MD.PE_RARITATE, aleator);
    const masina = M.cheieMasina(car);
    const valoare = E.VALOARE_DUBLURA[raritate];
    const { data: r, error } = await admin.rpc('deschide_lada', {
      p_jucator: id, p_lada: lada.id, p_pret: lada.pret, p_gratis: gratis,
      p_masina: masina, p_raritate: raritate, p_valoare_dublura: valoare,
    });
    if (error) return raspuns({ eroare: 'lada' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ masina, raritate, noua: r.noua, valoare: r.noua ? 0 : valoare, mil: r.mil, lazi_gratis: r.lazi_gratis });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
