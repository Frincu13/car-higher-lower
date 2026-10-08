// Cupa de duminică, în Startul: aceeași mașină pentru toți, intrare 10 mil., trei
// încercări, contează cel mai bun timp. Potul (intrările minus 10%) merge la primii
// trei luni dimineață (la primul care trece pe aici). Timpul îl socotește serverul
// din apăsări, ca la Cursa zilei; o încercare se consumă de la start.
//   { actiune: 'stare' }               -> cupa de azi sau următoarea, cu clasamentul
//   { actiune: 'intra' }               -> plătești intrarea
//   { actiune: 'porneste' }            -> o încercare începe
//   { actiune: 'cursa', apasari, tur } | { actiune: 'cursa', fals: true }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/economie.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, platesteRestante } from '../_shared/recompense.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const M = G.DragModel, E = G.Economie;
const MD = M.creeaza(CARS);
const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const intregi = (a: unknown, max: number) =>
  Array.isArray(a) && a.length <= max && a.every(x => Number.isInteger(x) && x >= 0 && x <= 60000);
const crescator = (a: number[], strict: boolean) => a.every((x, i) => i === 0 || (strict ? x > a[i - 1] : x >= a[i - 1]));
// mașina cupei: din dată, ca la Cursa zilei, dar alt șir
const masinaCupei = (data: string) => MD.masinaZilei(`cupa-${data}`);

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
  // cu miză se joacă doar din conturi legate de mail, ca la dueluri
  const legat = !cine.user.is_anonymous;

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  const azi = E.ziua();
  const { data: extra } = await admin.from('cupe_extra').select('data').eq('data', azi).maybeSingle();
  const deschisa = E.ziDinSaptamana(azi) === 0 || !!extra;
  // următoarea cupă: azi, dacă e deschisă, altfel duminica viitoare
  const data = deschisa ? azi : E.laData(azi, 7 - E.ziDinSaptamana(azi));
  const car = masinaCupei(data);

  if (b.actiune === 'stare') {
    try { await platesteRestante(admin); } catch { /* data viitoare */ }
    const { data: lista } = await admin.from('cupa_inscrieri').select('jucator, folosite, timp_ms, actualizat').eq('data', data);
    const inscrisi = lista ?? [];
    const eu = inscrisi.find((x: { jucator: string }) => x.jucator === id) ?? null;
    const timpi = inscrisi.filter((x: { timp_ms: number | null }) => x.timp_ms != null)
      .sort((x: { timp_ms: number; actualizat: string }, y: { timp_ms: number; actualizat: string }) => x.timp_ms - y.timp_ms || x.actualizat.localeCompare(y.actualizat));
    const loc = eu && eu.timp_ms != null ? timpi.findIndex((x: { jucator: string }) => x.jucator === id) + 1 : null;
    return raspuns({
      deschisa, data, masina: M.cheieMasina(car), intrare: E.CUPA.intrare, incercari: E.CUPA.incercari,
      inscrisi: inscrisi.length, pot: E.potCupa(inscrisi.length), legat,
      eu: eu ? { folosite: eu.folosite, timp: eu.timp_ms, loc } : null,
    });
  }

  if (!deschisa) return raspuns({ eroare: 'inchisa' }, 409);

  if (b.actiune === 'intra') {
    if (!legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    try { await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }
    const { data: r, error } = await admin.rpc('cupa_intra', { p_jucator: id, p_data: data, p_intrare: E.CUPA.intrare });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  if (b.actiune === 'porneste') {
    const { data: r, error } = await admin.rpc('cupa_porneste', { p_jucator: id, p_data: data, p_max: E.CUPA.incercari });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ...r, masina: M.cheieMasina(car) });
  }

  if (b.actiune === 'cursa') {
    let timp: number | null = null, apasari = null, tur = null;
    if (b.fals !== true) {
      apasari = b.apasari; tur = b.tur ?? [];
      if (!intregi(apasari, 8) || apasari.length < 2 || !crescator(apasari, true)) return raspuns({ eroare: 'apasari' }, 422);
      if (!intregi(tur, 400) || !crescator(tur, false) || tur.some((x: number) => x > M.BLOCARE)) return raspuns({ eroare: 'turatie' }, 422);
      if (apasari[0] < 100) return raspuns({ eroare: 'reactie' }, 422);
      const c = M.refa(car, apasari, tur, 0);
      if (c.fin == null || !Number.isFinite(c.fin)) return raspuns({ eroare: 'cursa' }, 422);
      timp = Math.round(c.fin);
    }
    const { data: r, error } = await admin.rpc('cupa_cursa', { p_jucator: id, p_data: data, p_timp: timp, p_apasari: apasari, p_tur: tur });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ timp, ...r });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
