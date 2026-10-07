// Șterge contul jucătorului care cere, cu tot ce ține de el: numele din clasament,
// timpii și trimiterile pleacă odată cu contul (on delete cascade).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];

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

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  const { error: eroare } = await admin.auth.admin.deleteUser(data.user.id);
  if (eroare) return raspuns({ eroare: 'stergere' }, 500);
  return raspuns({ sters: true });
});
