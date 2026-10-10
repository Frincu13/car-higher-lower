// Primește o cursă terminată la Cursa zilei și o pune în clasament. Clientul trimite
// doar ce a făcut degetul: orele de la start (tur) și apăsările (reacția, apoi
// fiecare schimbare). Timpul îl socotește serverul, refăcând cursa cu același model
// ca jocul (drag-model.js), deci nu se poate trimite un timp inventat.
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { recompenseZi } from '../_shared/recompense.ts';

// deno-lint-ignore no-explicit-any
const M = (globalThis as any).DragModel;
const MD = M.creeaza(CARS);

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const LIMITA = { trimiteri: 30, minute: 10 };
// Nume care nu apar în clasament (fără diacritice, litere mici).
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
const intregi = (a: unknown, max: number) =>
  Array.isArray(a) && a.length <= max && a.every(x => Number.isInteger(x) && x >= 0 && x <= 60000);
const crescator = (a: number[], strict: boolean) => a.every((x, i) => i === 0 || (strict ? x > a[i - 1] : x >= a[i - 1]));

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

  let b: { data?: string; apasari?: number[]; tur?: number[]; nume?: string };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  // ziua: a jucătorului, deci se acceptă ieri, azi și mâine față de ora serverului
  const acum = Date.now();
  const zile = [zi(new Date(acum - 864e5)), zi(new Date(acum)), zi(new Date(acum + 864e5))];
  if (typeof b.data !== 'string' || !zile.includes(b.data)) return raspuns({ eroare: 'ziua' }, 422);
  const apasari = b.apasari, tur = b.tur ?? [];
  if (!intregi(apasari, 8) || apasari!.length < 2 || !crescator(apasari!, true)) return raspuns({ eroare: 'apasari' }, 422);
  if (!intregi(tur, 400) || !crescator(tur, false) || tur.some(x => x > M.BLOCARE)) return raspuns({ eroare: 'turatie' }, 422);
  // sub 0,1 s nu reacționează nimeni: e ghicit sau trimis de un program
  if (apasari![0] < 100) return raspuns({ eroare: 'reactie' }, 422);

  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  const { error: eroareJucator } = await admin.from('jucatori')
    .upsert({ id, nume, actualizat: new Date(acum).toISOString() });
  if (eroareJucator) return raspuns({ eroare: 'jucator' }, 500);

  const deLa = new Date(acum - LIMITA.minute * 60e3).toISOString();
  const { count } = await admin.from('zi_trimiteri').select('id', { count: 'exact', head: true })
    .eq('jucator', id).gte('creat', deLa);
  if ((count ?? 0) >= LIMITA.trimiteri) return raspuns({ eroare: 'prea multe' }, 429);
  await admin.from('zi_trimiteri').insert({ jucator: id });

  const car = MD.masinaZilei(b.data);
  const c = M.refa(car, apasari, tur);
  if (c.fin == null || !Number.isFinite(c.fin)) return raspuns({ eroare: 'cursa' }, 422);
  const timp = Math.round(c.fin);

  const { data: vechi } = await admin.from('zi_rezultate').select('timp_ms')
    .eq('jucator', id).eq('data', b.data).maybeSingle();
  const record = !vechi || timp < vechi.timp_ms;
  if (record) {
    const { error } = await admin.from('zi_rezultate').upsert({
      jucator: id, data: b.data, masina: M.cheieMasina(car), timp_ms: timp,
      reactie_ms: apasari![0], apasari, tur, creat: new Date(acum).toISOString(),
    });
    if (error) return raspuns({ eroare: 'salvare' }, 500);
  }
  try { await admin.rpc('noteaza_record', { p_jucator: id, p_masina: M.cheieMasina(car), p_timp: timp }); } catch { /* fără record */ }
  // recompensele zilei: dacă nu merg acum, cursa rămâne oricum în clasament
  let recompense = null;
  try { recompense = await recompenseZi(admin, id, 'startul', b.data); } catch { /* fără recompense de data asta */ }
  return raspuns({ timp, record, nume, cel_mai_bun: record ? timp : vechi!.timp_ms, recompense });
});
