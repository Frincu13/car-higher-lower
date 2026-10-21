// Cupa de duminică, în Startul: aceeași mașină pentru toți, fără intrare, trei
// încercări, contează cel mai bun timp. Premiile (economie.js, CUPA) se dau luni
// (la primul care trece pe aici). Timpul îl socotește serverul din apăsări, ca la
// Cursa zilei; o încercare se consumă de la start.
//   { actiune: 'stare' }               -> cupa de azi sau următoarea, cu clasamentul
//   { actiune: 'porneste' }            -> te înscrie (prima dată) și o încercare începe
//   { actiune: 'cursa', apasari, tur } | { actiune: 'cursa', fals: true }
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/economie.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, masinaCupei, platesteRestante } from '../_shared/recompense.ts';
import { permis } from '../_shared/limita.ts';

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
  if (b.actiune !== 'stare' && !(await permis(admin, `cupa:${b.actiune}:${id}`, [20, 60]))) return raspuns({ eroare: 'prea multe' }, 429);
  // o cursă respinsă se notează, cu ce a trimis telefonul (erori_curse), ca să se
  // poată înțelege după; jurnalele Supabase nu se pot citi
  const respinsa = async (eroare: string) => {
    try { await admin.from('erori_curse').insert({ jucator: id, functie: 'cupa', eroare, corp: b }); } catch { /* nu strică răspunsul */ }
    return raspuns({ eroare }, 422);
  };

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
      deschisa, data, masina: M.cheieMasina(car), incercari: E.CUPA.incercari,
      inscrisi: inscrisi.length, participare: E.CUPA.participare, premii: E.CUPA.premii,
      eu: eu ? { folosite: eu.folosite, timp: eu.timp_ms, loc } : null,
    });
  }

  if (!deschisa) return raspuns({ eroare: 'inchisa' }, 409);

  if (b.actiune === 'porneste') {
    // fără intrare: prima încercare te înscrie (și îți face portofelul, pentru premii)
    try { await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }
    const { error: eInscriere } = await admin.rpc('cupa_intra', { p_jucator: id, p_data: data, p_intrare: 0 });
    if (eInscriere) return raspuns({ eroare: 'cupa' }, 500);
    const { data: r, error } = await admin.rpc('cupa_porneste', { p_jucator: id, p_data: data, p_max: E.CUPA.incercari });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ...r, masina: M.cheieMasina(car) });
  }

  if (b.actiune === 'cursa') {
    let timp: number | null = null, apasari = null, tur = null;
    if (b.fals !== true) {
      apasari = b.apasari; tur = b.tur ?? [];
      if (!intregi(apasari, 8) || apasari.length < 2 || !crescator(apasari, true)) return await respinsa('apasari');
      if (!M.turValid(tur, apasari)) return await respinsa('turatie');
      if (apasari[0] < 100) return await respinsa('reactie');
      const c = M.refa(car, apasari, tur, 0);
      if (c.fin == null || !Number.isFinite(c.fin)) return await respinsa('cursa');
      timp = Math.round(c.fin);
    }
    const { data: r, error } = await admin.rpc('cupa_cursa', { p_jucator: id, p_data: data, p_timp: timp, p_apasari: apasari, p_tur: tur });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    if (timp != null) { try { await admin.rpc('noteaza_record', { p_jucator: id, p_masina: M.cheieMasina(car), p_timp: timp }); } catch { /* fără record */ } }
    return raspuns({ timp, ...r });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
