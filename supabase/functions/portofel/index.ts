// Garajul meu: starea portofelului și a garajului, și deschiderea lăzilor. Mașina din
// ladă o trage serverul, cu numere aleatoare criptografice; pagina doar arată banda.
//   { actiune: 'stare', nume? }            -> { portofel, garaj, misiuni, seturi_noi, premii }
//   { actiune: 'lada', lada, gratis }      -> { masina, raritate, noua, valoare, mil, lazi_gratis }
//   { actiune: 'tuneaza', masina }          -> { nivel, mil }
//   { actiune: 'cumpara', masina }          -> { mil }   (Vitrina: o mașină care îți lipsește)
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/economie.js';
import '../_shared/seturi.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, misiuni, platesteRestante } from '../_shared/recompense.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const M = G.DragModel, E = G.Economie;
const MD = M.creeaza(CARS);
const SETURI = G.Seturi.creeaza(MD.POOL, { rar: MD.rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_DUBLURA });
// ce apare ca noutate pe pagină (premii, seturi, misiuni, cupe)
const MOTIVE_PREMII = ['premiul saptamanii', 'premiu cupa', 'cupa anulata', 'set complet', 'misiune'];

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

  let b: { actiune?: string; nume?: string; lada?: string; gratis?: boolean; masina?: string };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  // jucătorul și portofelul există (numele nu se schimbă aici dacă există deja)
  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
  let portofel;
  try { portofel = await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }

  if (b.actiune === 'stare') {
    const { data: garaj, error } = await admin.from('garaje').select('masina, raritate, nivel, bucati, blocat').eq('jucator', id);
    if (error) return raspuns({ eroare: 'garaj' }, 500);
    // ce s-a încheiat între timp se plătește acum; dacă nu merge, data viitoare
    try { await platesteRestante(admin); } catch { /* data viitoare */ }
    // seturile complete, plătite o singură dată
    const are = new Set((garaj ?? []).map((g: { masina: string }) => g.masina));
    const complete = SETURI.filter((x: { chei: string[] }) => x.chei.every(k => are.has(k)));
    const seturi_noi = [];
    if (complete.length) {
      const { data: luate } = await admin.from('miscari').select('cheie').eq('jucator', id).like('cheie', 'set:%');
      const deja = new Set((luate ?? []).map((x: { cheie: string }) => x.cheie));
      for (const x of complete) {
        if (deja.has(`set:${x.id}`)) continue;
        const { data: dat } = await admin.rpc('recompensa', { p_jucator: id, p_mil: x.premiu, p_lazi: 0, p_motiv: 'set complet', p_cheie: `set:${x.id}`, p_detalii: { set: x.id, nume: x.nume } });
        if (dat === true) seturi_noi.push({ id: x.id, nume: x.nume, premiu: x.premiu });
      }
    }
    let lista = null;
    try { lista = await misiuni(admin, id); } catch { /* fără misiuni acum */ }
    const { data: p } = await admin.from('portofele').select('*').eq('jucator', id).single();
    const { data: premii } = await admin.from('miscari').select('id, mil, motiv, detalii, creat').eq('jucator', id)
      .in('motiv', MOTIVE_PREMII).order('id', { ascending: false }).limit(12);
    return raspuns({ portofel: p ?? portofel, garaj, misiuni: lista, seturi_noi, premii: premii ?? [] });
  }

  if (b.actiune === 'cumpara') {
    const car = typeof b.masina === 'string' ? MD.dupaCheie(b.masina) : null;
    if (!car) return raspuns({ eroare: 'masina' }, 422);
    const raritate = MD.rar(car);
    const { data: r, error } = await admin.rpc('cumpara_masina', {
      p_jucator: id, p_masina: M.cheieMasina(car), p_raritate: raritate, p_pret: E.VITRINA[raritate],
    });
    if (error) return raspuns({ eroare: 'vitrina' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ masina: M.cheieMasina(car), raritate, mil: r.mil });
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

  if (b.actiune === 'tuneaza') {
    const { data: g } = await admin.from('garaje').select('raritate, nivel').eq('jucator', id).eq('masina', b.masina ?? '').maybeSingle();
    if (!g) return raspuns({ eroare: 'masina' }, 404);
    const cost = E.TUNING.pret(g.raritate, g.nivel);
    const { data: r, error } = await admin.rpc('tuneaza', { p_jucator: id, p_masina: b.masina, p_cost: cost, p_max: E.TUNING.max });
    if (error) return raspuns({ eroare: 'tuning' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
