// Dueluri cu miză în Startul, pe bani sau „pe acte". Fiecare aleargă pe telefonul
// lui, o singură dată; timpul îl socotește serverul din apăsări (același model ca
// jocul), iar banii și mașinile le mută funcțiile din baza de date.
//   { actiune: 'creeaza', tip, miza, masina }  -> { id, cod, raritate }        (A, apoi aleargă)
//   { actiune: 'rapid', miza, masina }         -> A: { rol: 'a', id, cod } | B: { rol: 'b', id, ...fantoma }
//   { actiune: 'cursa', id, apasari, tur }     -> A: { deschis, cod } | B: rezultatul
//   { actiune: 'vezi', cod }                   -> ce se vede înainte de acceptare
//   { actiune: 'accepta', id, masina }         -> fantoma lui A, ca B să alerge contra ei
//   { actiune: 'anuleaza', id }
//   { actiune: 'ale-mele' }                    -> ultimele dueluri ale tale
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { inFundal, trimite as notifica } from '../_shared/push.ts';

// deno-lint-ignore no-explicit-any
const M = (globalThis as any).DragModel;
const MD = M.creeaza(CARS);

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const MIZA_MAX = 100;
// duelul rapid are câteva mize fixe, ca să se găsească ușor adversari
const MIZE_RAPID = [2, 5, 10, 25, 50];
const LITERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function codNou() {
  const b = new Uint32Array(6);
  crypto.getRandomValues(b);
  return [...b].map(x => LITERE[x % LITERE.length]).join('');
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
  // Cu miză se joacă doar din conturi legate de mail: altfel oricine și-ar face
  // conturi noi ca să-și treacă bani sau mașini dintr-unul în altul.
  const legat = !cine.user.is_anonymous;

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }
  await admin.rpc('duel_expira');

  const nume = async (ids: (string | null)[]) => {
    const { data } = await admin.from('jucatori').select('id, nume').in('id', ids.filter(Boolean));
    return new Map((data ?? []).map((j: { id: string; nume: string }) => [j.id, j.nume]));
  };

  if (b.actiune === 'creeaza') {
    if (!legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    const tip = b.tip === 'acte' ? 'acte' : b.tip === 'bani' ? 'bani' : null;
    if (!tip) return raspuns({ eroare: 'tip' }, 422);
    const miza = tip === 'bani' ? b.miza : 0;
    if (tip === 'bani' && !(Number.isInteger(miza) && miza >= 1 && miza <= MIZA_MAX)) return raspuns({ eroare: 'miza' }, 422);
    if (typeof b.masina !== 'string' || !MD.dupaCheie(b.masina)) return raspuns({ eroare: 'masina' }, 422);
    // clasa vine din timpul după tuning, cu nivelul de acum al mașinii
    const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', b.masina).maybeSingle();
    if (!g) return raspuns({ eroare: 'masina' }, 409);
    const clasa = M.clasa(MD.dupaCheie(b.masina), g.nivel);
    for (let i = 0; i < 4; i++) {
      const { data, error } = await admin.rpc('duel_creeaza', { p_jucator: id, p_tip: tip, p_miza: miza, p_masina: b.masina, p_cod: codNou(), p_clasa: clasa, p_nivel: g.nivel });
      if (error) { if (String(error.code) === '23505') continue; return raspuns({ eroare: 'duel' }, 500); }
      if (data?.eroare) return raspuns({ eroare: data.eroare }, 409);
      return raspuns(data);
    }
    return raspuns({ eroare: 'cod' }, 500);
  }

  if (b.actiune === 'cursa') {
    const { data: d } = await admin.from('dueluri').select('*').eq('id', b.id).maybeSingle();
    if (!d) return raspuns({ eroare: 'duel' }, 404);
    const masina = d.a === id ? d.masina_a : d.b === id ? d.masina_b : null;
    if (!masina) return raspuns({ eroare: 'duel' }, 403);
    const nivel = d.a === id ? d.nivel_a : (d.nivel_b ?? 0);
    // Start fals: A își pierde duelul cu taxa de abandon; B pierde duelul.
    if (b.fals === true) {
      if (d.a === id) {
        const { data: r } = await admin.rpc('duel_anuleaza', { p_duel: d.id, p_jucator: id });
        return raspuns({ fals: true, anulat: !r?.eroare });
      }
      const { data: r } = await admin.rpc('duel_cursa', { p_duel: d.id, p_jucator: id, p_timp: null, p_apasari: null, p_tur: null });
      return raspuns({ fals: true, castigat: false, egal: false, tip: d.tip, miza: d.miza, masina_a: d.masina_a, masina_b: d.masina_b, eroare: r?.eroare });
    }
    const apasari = b.apasari, tur = b.tur ?? [];
    if (!intregi(apasari, 8) || apasari.length < 2 || !crescator(apasari, true)) return raspuns({ eroare: 'apasari' }, 422);
    if (!intregi(tur, 400) || !crescator(tur, false) || tur.some((x: number) => x > M.BLOCARE)) return raspuns({ eroare: 'turatie' }, 422);
    if (apasari[0] < 100) return raspuns({ eroare: 'reactie' }, 422);
    const c = M.refa(MD.dupaCheie(masina), apasari, tur, nivel);
    if (c.fin == null || !Number.isFinite(c.fin)) return raspuns({ eroare: 'cursa' }, 422);
    const timp = Math.round(c.fin);
    const { data: r, error } = await admin.rpc('duel_cursa', { p_duel: d.id, p_jucator: id, p_timp: timp, p_apasari: apasari, p_tur: tur });
    if (error) return raspuns({ eroare: 'duel' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    if (r?.deschis) return raspuns({ deschis: true, cod: d.cod, timp });
    const { data: dupa } = await admin.from('dueluri').select('*').eq('id', d.id).single();
    const n = await nume([dupa.a, dupa.b]);
    // A a alergat demult: află rezultatul pe telefon
    if (dupa.a && dupa.a !== id) {
      const castigaA = dupa.castigator === dupa.a, egal = !!r?.egal;
      await inFundal(notifica(admin, [dupa.a], 'dueluri', {
        titlu: egal ? `Egal cu ${n.get(id) ?? 'adversarul'}` : castigaA ? `Ai câștigat duelul cu ${n.get(id) ?? 'adversarul'}` : `${n.get(id) ?? 'Adversarul'} a câștigat duelul`,
        text: `${(dupa.timp_a / 1000).toFixed(3).replace('.', ',')} s contra ${(dupa.timp_b / 1000).toFixed(3).replace('.', ',')} s.`,
        url: 'drag.html?online', tag: `frq-duel-${d.id}`,
      }));
    }
    return raspuns({
      timp, timp_a: dupa.timp_a, timp_b: dupa.timp_b, egal: !!r?.egal, castigat: dupa.castigator === id,
      tip: dupa.tip, miza: dupa.miza, masina_a: dupa.masina_a, masina_b: dupa.masina_b, nume_a: n.get(dupa.a), nume_b: n.get(dupa.b),
    });
  }

  if (b.actiune === 'vezi') {
    const cod = String(b.cod ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const { data: d } = await admin.from('dueluri').select('id, cod, tip, miza, raritate, stare, a, masina_a, nivel_a, termen, rapid').eq('cod', cod).maybeSingle();
    if (!d || d.rapid) return raspuns({ eroare: 'duel' }, 404);
    const n = await nume([d.a]);
    return raspuns({ id: d.id, cod: d.cod, tip: d.tip, miza: d.miza, clasa: d.raritate, raritate: d.raritate, stare: d.stare, al_meu: d.a === id, nume_a: n.get(d.a), masina_a: d.masina_a, nivel_a: d.nivel_a, termen: d.termen, legat });
  }

  // abia după ce B și-a blocat miza vede fantoma lui A
  const fantoma = async (duel: string, nivelB: number) => {
    const { data: d } = await admin.from('dueluri').select('masina_a, nivel_a, apasari_a, tur_a, a, miza').eq('id', duel).single();
    const n = await nume([d.a]);
    return { masina_a: d.masina_a, nivel_a: d.nivel_a, apasari_a: d.apasari_a, tur_a: d.tur_a, nume_a: n.get(d.a), nivel_b: nivelB, miza: d.miza };
  };

  if (b.actiune === 'accepta') {
    if (!legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    if (typeof b.masina !== 'string' || !MD.dupaCheie(b.masina)) return raspuns({ eroare: 'masina' }, 422);
    // un duel rapid nu se ia după cod: adversarul îl alege serverul
    const { data: dd } = await admin.from('dueluri').select('rapid').eq('id', b.id).maybeSingle();
    if (!dd || dd.rapid) return raspuns({ eroare: 'duel' }, 404);
    const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', b.masina).maybeSingle();
    if (!g) return raspuns({ eroare: 'masina' }, 409);
    const clasa = M.clasa(MD.dupaCheie(b.masina), g.nivel);
    const { data: r, error } = await admin.rpc('duel_accepta', { p_duel: b.id, p_jucator: id, p_masina: b.masina, p_clasa: clasa, p_nivel: g.nivel });
    if (error) return raspuns({ eroare: 'duel' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(await fantoma(b.id, g.nivel));
  }

  if (b.actiune === 'rapid') {
    if (!legat) return raspuns({ eroare: 'cont nelegat' }, 403);
    if (!MIZE_RAPID.includes(b.miza)) return raspuns({ eroare: 'miza' }, 422);
    if (typeof b.masina !== 'string' || !MD.dupaCheie(b.masina)) return raspuns({ eroare: 'masina' }, 422);
    const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', b.masina).maybeSingle();
    if (!g) return raspuns({ eroare: 'masina' }, 409);
    const clasa = M.clasa(MD.dupaCheie(b.masina), g.nivel);
    for (let i = 0; i < 4; i++) {
      const { data: r, error } = await admin.rpc('duel_rapid', { p_jucator: id, p_miza: b.miza, p_masina: b.masina, p_clasa: clasa, p_nivel: g.nivel, p_cod: codNou() });
      if (error) { if (String(error.code) === '23505') continue; return raspuns({ eroare: 'duel' }, 500); }
      if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
      if (r.rol === 'a') return raspuns({ rol: 'a', id: r.id, cod: r.cod, clasa });
      return raspuns({ rol: 'b', id: r.id, clasa, ...(await fantoma(r.id, g.nivel)) });
    }
    return raspuns({ eroare: 'cod' }, 500);
  }

  if (b.actiune === 'anuleaza') {
    const { data: r, error } = await admin.rpc('duel_anuleaza', { p_duel: b.id, p_jucator: id });
    if (error) return raspuns({ eroare: 'duel' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ok: true });
  }

  if (b.actiune === 'ale-mele') {
    const { data: lista } = await admin.from('dueluri')
      .select('id, cod, tip, miza, raritate, stare, a, b, masina_a, masina_b, timp_a, timp_b, castigator, termen, creat, rapid')
      .or(`a.eq.${id},b.eq.${id}`).order('creat', { ascending: false }).limit(20);
    const n = await nume((lista ?? []).flatMap((d: { a: string; b: string | null }) => [d.a, d.b]));
    return raspuns({
      // deno-lint-ignore no-explicit-any
      dueluri: (lista ?? []).map((d: any) => ({
        id: d.id, cod: d.cod, tip: d.tip, miza: d.miza, raritate: d.raritate, stare: d.stare, eu_a: d.a === id, rapid: d.rapid,
        masina_mea: d.a === id ? d.masina_a : d.masina_b, masina_lui: d.a === id ? d.masina_b : d.masina_a,
        lui: n.get(d.a === id ? d.b : d.a) ?? null,
        timp_meu: d.a === id ? d.timp_a : d.timp_b, timp_lui: d.stare === 'incheiat' ? (d.a === id ? d.timp_b : d.timp_a) : null,
        castigat: d.castigator === id, pierdut: !!d.castigator && d.castigator !== id, termen: d.termen,
      })),
      legat,
    });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
