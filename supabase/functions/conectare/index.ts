// Intrarea în cont din aplicația de pe ecranul principal, cu linkul din mail deschis
// în alt browser (pe iPhone, Safari și aplicația nu-și împart datele).
//   { actiune: 'cere' }                -> { id, secret }   (aplicația, înainte de mail)
//   { actiune: 'aproba', id, cod }     -> { ok }           (Safari, cu codul din link)
//   { actiune: 'stare', id, secret }   -> { cod } | { asteapta: true }  (aplicația)
// Fără cont: cine se conectează poate să nu aibă încă unul pe telefonul ăsta.
// Codul din link (PKCE) nu se poate schimba pe sesiune fără verificatorul care stă
// doar în aplicație, deci trecerea lui pe aici nu dă nimănui acces.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { adresa, permis } from '../_shared/limita.ts';

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const UUID = /^[0-9a-f-]{36}$/i;
const VALABIL_MS = 30 * 60 * 1000;

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');

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
  // fără cont, deci limita e pe adresă: cereri noi puține, verificarea stării (la câteva
  // secunde, cât aștepți mailul) mai larg
  if (!(await permis(admin, `conectare:${b.actiune}:${adresa(req)}`, b.actiune === 'stare' ? [120, 60] : [10, 600]))) return raspuns({ eroare: 'prea multe' }, 429);
  const prag = new Date(Date.now() - VALABIL_MS).toISOString();

  if (b.actiune === 'cere') {
    // ce a expirat se strânge aici, fără ceas separat
    await admin.from('conectari').delete().lt('creat', prag);
    const secret = hex(24);
    const { data, error } = await admin.from('conectari').insert({ secret_hash: await sha256(secret) }).select('id').single();
    if (error || !data) return raspuns({ eroare: 'cerere' }, 500);
    return raspuns({ id: data.id, secret });
  }

  if (b.actiune === 'aproba') {
    if (typeof b.id !== 'string' || !UUID.test(b.id) || typeof b.cod !== 'string' || b.cod.length < 8 || b.cod.length > 200) return raspuns({ eroare: 'date' }, 422);
    const { data } = await admin.from('conectari').update({ cod: b.cod }).eq('id', b.id).is('cod', null).gt('creat', prag).select('id');
    if (!data?.length) return raspuns({ eroare: 'expirat' }, 409);
    return raspuns({ ok: true });
  }

  if (b.actiune === 'stare') {
    if (typeof b.id !== 'string' || !UUID.test(b.id) || typeof b.secret !== 'string' || b.secret.length !== 48) return raspuns({ eroare: 'date' }, 422);
    const { data: c } = await admin.from('conectari').select('secret_hash, cod, creat').eq('id', b.id).maybeSingle();
    if (!c || c.secret_hash !== await sha256(b.secret) || new Date(c.creat).getTime() < Date.now() - VALABIL_MS) return raspuns({ eroare: 'expirat' }, 409);
    if (!c.cod) return raspuns({ asteapta: true });
    // o singură dată
    await admin.from('conectari').delete().eq('id', b.id);
    return raspuns({ cod: c.cod });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
