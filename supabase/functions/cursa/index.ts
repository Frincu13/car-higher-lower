// Cursa, jocul principal: tot ce trece prin server.
// Turul lansat se reface aici din apăsări (cursa-model.js, același ca pe telefon): Cupa de
// duminică (mașina cupei, aceeași pentru toți, trei încercări) și Turul săptămânii (mașina ta,
// cu tuningul ei, clasament pe clase, premii luni). Cursa cu boții plătește după loc, în
// plafonul zilei, și ține misiunile.
//   { actiune: 'stare' }                                  -> { cupa, sapt: { luni } }
//   { actiune: 'cupa-start' }                             -> { folosite, masina }
//   { actiune: 'cupa-tur', intrari, nume? }               -> { timp, record, cel_mai_bun }
//   { actiune: 'sapt-tur', masina, exemplar?, intrari, nume? } -> { timp, clasa, loc, cel_mai_bun }
//   { actiune: 'sapt', clasa, luni? }                     -> { luni, clasa, total, top, eu }
//   { actiune: 'start', mod }                             -> { id }
//   { actiune: 'final', id, loc, perfecte }               -> { bani, misiuni }
//   { actiune: 'camera-noua', tip, mod, masina?, ore, nume? } -> { cod }  (tip: live | clasament)
//   { actiune: 'camera', cod }                            -> { cod, id, mod, masina, pana, gazda, top, eu }
//   { actiune: 'camera-tur', cod, intrari, masina?, exemplar?, nume? } -> { timp, loc, total, cel_mai_bun }
// intrari: { f: [[pas, cheie, e], ...], n: [pas, ...] } (frânările și apăsările de nitro)
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/cursa-model.js';
import '../_shared/economie.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, bonusZi, masinaCupei, misiuni } from '../_shared/recompense.ts';
import { exemplarul } from '../_shared/exemplare.ts';
import { permis } from '../_shared/limita.ts';
import { clasamentSapt } from '../_shared/cursa-clasament.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const M = G.DragModel, CM = G.CursaModel, E = G.Economie;
const MD = M.creeaza(CARS);
const REF = MD.dupaCheie('BMW M3|1997');
const P = CM.pista(REF);
const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const INTERZISE = /(pula|pizd|muie|futu|fut |cacat|curv|nigg|fuck|shit|bitch|hitler|nazi)/;
// cât de departe poate fi o frânare de trecerea reală pe lângă panou (pe telefon: sub 0,02 s)
const ABATERE_MAX = .25;

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
  if (typeof b?.actiune !== 'string') return raspuns({ eroare: 'actiune' }, 422);
  if (!(await permis(admin, `cursa:${b.actiune}:${id}`, b.actiune === 'stare' || b.actiune === 'sapt' ? [60, 60] : [20, 60]))) return raspuns({ eroare: 'prea multe' }, 429);
  const respinsa = async (eroare: string) => {
    try { await admin.from('erori_curse').insert({ jucator: id, functie: 'cursa', eroare, corp: b }); } catch { /* nu strică răspunsul */ }
    return raspuns({ eroare }, 422);
  };
  const cuNume = async () => {
    const nume = numeCurat(b.nume) ?? `Pilot ${id.slice(0, 4).toUpperCase()}`;
    await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
  };
  // turul lansat, refăcut din apăsări; null dacă nu se poate reface sau frânările nu se potrivesc
  const refa = (car: unknown, nivel: number) => {
    const r = CM.pista(REF).refaTur(car, nivel, b.intrari);
    return r && Number.isFinite(r.timp) && r.timp > 20 && r.abatere <= ABATERE_MAX ? r : null;
  };

  const azi = E.ziua();
  // Cupa: azi dacă e duminică (sau o cupă în plus), altfel duminica viitoare
  const { data: extra } = await admin.from('cupe_extra').select('data').eq('data', azi).maybeSingle();
  const cupaDeschisa = E.ziDinSaptamana(azi) === 0 || !!extra;
  const dataCupa = cupaDeschisa ? azi : E.laData(azi, 7 - E.ziDinSaptamana(azi));
  const carCupa = masinaCupei(dataCupa);

  if (b.actiune === 'stare') {
    const { data: lista } = await admin.from('cupa_inscrieri').select('jucator, folosite, timp_ms, actualizat').eq('data', dataCupa);
    const inscrisi = lista ?? [];
    const eu = inscrisi.find((x: { jucator: string }) => x.jucator === id) ?? null;
    const timpi = inscrisi.filter((x: { timp_ms: number | null }) => x.timp_ms != null)
      .sort((x: { timp_ms: number; actualizat: string }, y: { timp_ms: number; actualizat: string }) => x.timp_ms - y.timp_ms || x.actualizat.localeCompare(y.actualizat));
    const loc = eu && eu.timp_ms != null ? timpi.findIndex((x: { jucator: string }) => x.jucator === id) + 1 : null;
    return raspuns({
      cupa: {
        deschisa: cupaDeschisa, data: dataCupa, masina: M.cheieMasina(carCupa), incercari: E.CUPA.incercari,
        inscrisi: inscrisi.length, participare: E.CUPA.participare, premii: E.CUPA.premii,
        eu: eu ? { folosite: eu.folosite, timp: eu.timp_ms, loc } : null,
      },
      sapt: { luni: E.luni(azi), premii: E.CURSA.sapt.premii, minim: E.CURSA.sapt.minim },
    });
  }

  if (b.actiune === 'cupa-start') {
    if (!cupaDeschisa) return raspuns({ eroare: 'inchisa' }, 409);
    try { await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }
    const { error: eInscriere } = await admin.rpc('cupa_intra', { p_jucator: id, p_data: dataCupa, p_intrare: 0 });
    if (eInscriere) return raspuns({ eroare: 'cupa' }, 500);
    const { data: r, error } = await admin.rpc('cupa_porneste', { p_jucator: id, p_data: dataCupa, p_max: E.CUPA.incercari });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ...r, masina: M.cheieMasina(carCupa) });
  }

  if (b.actiune === 'cupa-tur') {
    if (!cupaDeschisa) return raspuns({ eroare: 'inchisa' }, 409);
    const r = refa(carCupa, 0);
    if (!r) return await respinsa('tur');
    const timp = Math.round(r.timp * 1000);
    const { data: x, error } = await admin.rpc('cupa_cursa', { p_jucator: id, p_data: dataCupa, p_timp: timp, p_apasari: null, p_tur: null });
    if (error) return raspuns({ eroare: 'cupa' }, 500);
    if (x?.eroare) return raspuns({ eroare: x.eroare }, 409);
    await cuNume();
    await admin.from('cursa_tururi').insert({ jucator: id, tip: 'cupa', cheie: dataCupa, masina: M.cheieMasina(carCupa), nivel: 0, clasa: CM.scor(carCupa, 0).clasa, timp_ms: timp, intrari: b.intrari });
    return raspuns({ timp, ...x });
  }

  if (b.actiune === 'sapt-tur') {
    const car = typeof b.masina === 'string' && b.masina.length < 120 ? MD.dupaCheie(b.masina) : null;
    if (!car) return raspuns({ eroare: 'masina' }, 422);
    const ex = await exemplarul(admin, id, M.cheieMasina(car), car, b.exemplar ?? undefined);
    if (!ex) return raspuns({ eroare: 'nu e a ta' }, 403);
    const r = refa(car, ex.nivel);
    if (!r) return await respinsa('tur');
    const timp = Math.round(r.timp * 1000), clasa = CM.scor(car, ex.nivel).clasa, luni = E.luni(azi);
    await cuNume();
    const { error } = await admin.from('cursa_tururi').insert({ jucator: id, tip: 'sapt', cheie: luni, masina: M.cheieMasina(car), nivel: ex.nivel, clasa, timp_ms: timp, intrari: b.intrari });
    if (error) return raspuns({ eroare: 'salvare' }, 500);
    const cl = await clasamentSapt(admin, luni, clasa, id, 3);
    return raspuns({ timp, clasa, loc: cl.eu?.loc ?? null, cel_mai_bun: cl.eu?.timp ?? timp, record: cl.eu?.timp === timp, total: cl.total });
  }

  if (b.actiune === 'sapt') {
    const clasa = String(b.clasa ?? '');
    if (!['S', 'A', 'B', 'C', 'D'].includes(clasa)) return raspuns({ eroare: 'clasa' }, 422);
    const luni = typeof b.luni === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.luni) ? E.luni(b.luni) : E.luni(azi);
    const { lista: _, ...cl } = await clasamentSapt(admin, luni, clasa, id);
    return raspuns(cl);
  }

  if (b.actiune === 'start') {
    const mod = ['complet', 'scurta', 'lunga'].includes(b.mod) ? b.mod : 'complet';
    const { count } = await admin.from('partide').select('id', { count: 'exact', head: true }).eq('jucator', id).eq('joc', 'cursa').gte('inceput', new Date(Date.now() - 10 * 60e3).toISOString());
    if ((count ?? 0) >= 12) return raspuns({ eroare: 'prea multe' }, 429);
    await cuNume();
    const { data: p, error } = await admin.from('partide').insert({ jucator: id, joc: 'cursa', cat: mod, seed: 0, date: {} }).select('id').single();
    if (error || !p) return raspuns({ eroare: 'salvare' }, 500);
    return raspuns({ id: p.id });
  }

  if (b.actiune === 'final') {
    const loc = b.loc, perfecte = b.perfecte;
    if (!Number.isInteger(loc) || loc < 1 || loc > 10) return raspuns({ eroare: 'loc' }, 422);
    if (!Number.isInteger(perfecte) || perfecte < 0 || perfecte > P.GRUPURI.length * E.CURSA.ture) return raspuns({ eroare: 'perfecte' }, 422);
    const { data: p } = await admin.from('partide').select('id, inceput, terminat').eq('id', b.id).eq('jucator', id).eq('joc', 'cursa').maybeSingle();
    if (!p) return raspuns({ eroare: 'partida' }, 404);
    if (p.terminat) return raspuns({ eroare: 'terminata' }, 409);
    const trecut = Date.now() - new Date(p.inceput).getTime();
    // o cursă de 5 tururi ține aproape trei minute; sub un minut nu se poate
    const valid = trecut >= E.CURSA.minSec * 1000;
    const { data: inchisa } = await admin.from('partide')
      .update({ terminat: new Date().toISOString(), scor: valid ? 11 - loc : null, timp_ms: Math.min(trecut, 2e9), date: { loc, perfecte } })
      .eq('id', p.id).is('terminat', null).select('id');
    if (!inchisa?.length) return raspuns({ eroare: 'terminata' }, 409);
    if (!valid) return raspuns({ valid: false });
    const ar_fi = E.CASTIG.cursa(loc);
    let castig = 0, ziAzi = 0;
    try {
      await asiguraPortofel(admin, id);
      const { data: c } = await admin.rpc('castig_joc', {
        p_jucator: id, p_mil: ar_fi, p_plafon: E.CASTIG.plafon, p_praguri: E.BONUS.praguri,
        p_motiv: loc === 1 ? 'victorie' : 'partida', p_cheie: `cursa:${p.id}`, p_data: azi,
      });
      castig = c ?? 0;
    } catch { /* fără bani de data asta */ }
    try {
      const { data: m } = await admin.from('miscari').select('mil').eq('jucator', id).in('motiv', ['partida', 'victorie']).filter('detalii->>zi', 'eq', azi);
      ziAzi = (m ?? []).reduce((t: number, x: { mil: number }) => t + Number(x.mil), 0);
    } catch { /* fără total */ }
    let mis = null;
    try { mis = (await misiuni(admin, id, !!cine.user.is_anonymous)).filter((m: { noua?: boolean }) => m.noua); } catch { /* fără misiuni acum */ }
    const bonus_zi = castig < ar_fi ? await bonusZi(admin, id).catch(() => null) : null;
    return raspuns({ valid: true, bani: { castig, ar_fi, bonus: 0, azi: ziAzi, plafon: E.CASTIG.plafon, bonus_zi }, misiuni: mis });
  }

  // ---------- camerele cu prietenii ----------
  const camera = async () => {
    const cod = String(b.cod ?? '').toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(cod)) return null;
    const { data } = await admin.from('cursa_camere').select('id, cod, gazda, tip, mod, masina, pana, creat').eq('cod', cod).maybeSingle();
    return data;
  };
  // cel mai bun tur al fiecăruia din cameră
  const clasamentCamera = async (cod: string) => {
    const { data } = await admin.from('cursa_tururi').select('jucator, masina, nivel, timp_ms, creat').eq('tip', 'camera').eq('cheie', cod)
      .order('timp_ms', { ascending: true }).order('creat', { ascending: true }).limit(1000);
    const vazut = new Set<string>(), lista: { jucator: string; masina: string; nivel: number; timp_ms: number }[] = [];
    for (const x of data ?? []) if (!vazut.has(x.jucator)) { vazut.add(x.jucator); lista.push(x); }
    const { data: j } = lista.length ? await admin.from('jucatori').select('id, nume').in('id', lista.map(x => x.jucator)) : { data: [] };
    const nume = new Map((j ?? []).map((x: { id: string; nume: string }) => [x.id, x.nume]));
    return lista.map((x, i) => ({ loc: i + 1, id: x.jucator.slice(0, 8), nume: nume.get(x.jucator) ?? 'Pilot', masina: x.masina, nivel: x.nivel, timp: x.timp_ms, eu: x.jucator === id }));
  };

  if (b.actiune === 'camera-noua') {
    // o cameră live ține 3 ore (lobby-ul și cursele); una de clasament, o oră sau o zi
    const tip = b.tip === 'live' ? 'live' : 'clasament', mod = b.mod === 'aceeasi' ? 'aceeasi' : 'a mea', ore = tip === 'live' ? 3 : b.ore === 24 ? 24 : 1;
    let masina = null;
    if (mod === 'aceeasi') {
      const car = typeof b.masina === 'string' && b.masina.length < 120 ? MD.dupaCheie(b.masina) : null;
      if (!car) return raspuns({ eroare: 'masina' }, 422);
      masina = M.cheieMasina(car);
    }
    const { count } = await admin.from('cursa_camere').select('id', { count: 'exact', head: true }).eq('gazda', id).gte('creat', new Date(Date.now() - 3600e3).toISOString());
    if ((count ?? 0) >= 10) return raspuns({ eroare: 'prea multe' }, 429);
    await cuNume();
    const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let k = 0; k < 6; k++) {
      const cod = [...crypto.getRandomValues(new Uint8Array(5))].map(x => ALF[x % ALF.length]).join('');
      const { error } = await admin.from('cursa_camere').insert({ cod, gazda: id, tip, mod, masina, pana: new Date(Date.now() + ore * 3600e3).toISOString() });
      if (!error) return raspuns({ cod });
    }
    return raspuns({ eroare: 'salvare' }, 500);
  }

  if (b.actiune === 'camera') {
    const c = await camera();
    if (!c) return raspuns({ eroare: 'nu exista' }, 404);
    const top = await clasamentCamera(c.cod);
    return raspuns({ cod: c.cod, id: c.id, tip: c.tip, mod: c.mod, masina: c.masina, pana: c.pana, acum: new Date().toISOString(), gazda: c.gazda === id, eu_id: id.slice(0, 8), top: top.slice(0, 10), eu: top.find(x => x.eu) ?? null, piloti: top.length });
  }

  if (b.actiune === 'camera-tur') {
    const c = await camera();
    if (!c) return raspuns({ eroare: 'nu exista' }, 404);
    if (new Date(c.pana).getTime() < Date.now()) return raspuns({ eroare: 'inchisa' }, 409);
    let car, nivel = 0;
    if (c.mod === 'aceeasi') car = MD.dupaCheie(c.masina);
    else {
      car = typeof b.masina === 'string' && b.masina.length < 120 ? MD.dupaCheie(b.masina) : null;
      if (!car) return raspuns({ eroare: 'masina' }, 422);
      const ex = await exemplarul(admin, id, M.cheieMasina(car), car, b.exemplar ?? undefined);
      // fără mașina în garaj: mașina de împrumut, stoc
      if (ex) nivel = ex.nivel; else if (M.cheieMasina(car) !== M.cheieMasina(REF)) return raspuns({ eroare: 'nu e a ta' }, 403);
    }
    const top0 = await clasamentCamera(c.cod);
    if (top0.length >= 10 && !top0.some(x => x.eu)) return raspuns({ eroare: 'plina' }, 409);
    const r = refa(car, nivel);
    if (!r) return await respinsa('tur');
    const timp = Math.round(r.timp * 1000);
    await cuNume();
    const { error } = await admin.from('cursa_tururi').insert({ jucator: id, tip: 'camera', cheie: c.cod, masina: M.cheieMasina(car), nivel, clasa: CM.scor(car, nivel).clasa, timp_ms: timp, intrari: b.intrari });
    if (error) return raspuns({ eroare: 'salvare' }, 500);
    const top = await clasamentCamera(c.cod), eu = top.find(x => x.eu);
    return raspuns({ timp, loc: eu?.loc ?? null, total: top.length, cel_mai_bun: eu?.timp ?? timp, record: eu?.timp === timp });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});

