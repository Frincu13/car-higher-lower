// Primește erorile din pagini: { pagina, mesaj, sursa, stiva, versiune }. Fără cont
// obligatoriu (eroarea poate veni înainte de cont); dacă vine cu token, se notează și
// jucătorul. Limită pe adresă, câmpuri tăiate la o lungime sigură.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { adresa, permis } from '../_shared/limita.ts';

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const taie = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);

Deno.serve(async req => {
  const origine = req.headers.get('origin') ?? '';
  const h = {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const raspuns = (corp: unknown, status = 200) =>
    new Response(JSON.stringify(corp), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return raspuns({ eroare: 'metoda' }, 405);
  // doar de pe site-ul nostru
  if (!ORIGINI.includes(origine)) return raspuns({ eroare: 'origine' }, 403);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!(await permis(admin, `erori:${adresa(req)}`, [30, 600]))) return raspuns({ eroare: 'prea multe' }, 429);
  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = JSON.parse(await req.text()); } catch { return raspuns({ eroare: 'json' }, 400); }
  const mesaj = taie(b.mesaj, 500);
  if (!mesaj) return raspuns({ eroare: 'mesaj' }, 422);

  let jucator: string | null = null;
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (jwt && jwt.split('.').length === 3) {
    try { const { data } = await admin.auth.getUser(jwt); jucator = data?.user?.id ?? null; } catch { /* fără jucător */ }
  }
  const { error } = await admin.from('erori_client').insert({
    jucator, pagina: taie(b.pagina, 200) ?? '?', mesaj, sursa: taie(b.sursa, 300), stiva: taie(b.stiva, 2000),
    versiune: taie(b.versiune, 20), dispozitiv: taie(req.headers.get('user-agent'), 300),
  });
  if (error) return raspuns({ eroare: 'salvare' }, 500);
  return raspuns({ ok: true });
});
