// Garajul meu: starea portofelului și a garajului, și deschiderea lăzilor. Mașina din
// ladă o trage serverul, cu numere aleatoare criptografice; pagina doar arată banda.
//   { actiune: 'stare', nume? }            -> { portofel, garaj, misiuni, seturi_noi, premii }
//   { actiune: 'lada', lada, gratis }      -> { masina, raritate, noua, bucati, valoare, mil, lazi_gratis, puncte }
//   { actiune: 'dublura', masina, alegere } -> { mil, puncte, bucati }  (alegere: 'vinde' sau 'puncte')
//   { actiune: 'tuneaza', masina, piesa }   -> { nivel, mil, puncte }  (piesa: 0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie)
//   { actiune: 'cumpara', masina }          -> { mil }   (Vitrina: o mașină care îți lipsește)
//   { actiune: 'echipa', clasa, masina }    -> { echipa } (Startul: mașina pentru o clasă; masina null o scoate)
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
const SETURI = G.Seturi.creeaza(MD.POOL, { rar: MD.rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_SET });
// ce apare ca noutate pe pagină (premii, seturi, misiuni, cupe)
const MOTIVE_PREMII = ['premiul saptamanii', 'premiu cupa', 'cupa anulata', 'set complet', 'misiune', 'bonus economia noua', 'invitat', 'prieten invitat'];
// codurile de invitație: fără litere care se confundă (0/O, 1/I/L)
const LITERE_COD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codNou = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), x => LITERE_COD[x % LITERE_COD.length]).join('');

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

  let b: { actiune?: string; nume?: string; lada?: string; gratis?: boolean; masina?: string | null; clasa?: number; alegere?: string; piesa?: number; invitat?: string };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  // jucătorul și portofelul există (numele nu se schimbă aici dacă există deja)
  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
  let portofel;
  try { portofel = await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }

  // a venit dintr-un link de invitație (o singură dată, doar pe un cont nou)
  let invitatie = null;
  if (typeof b.invitat === 'string' && /^[A-Z0-9]{4,10}$/i.test(b.invitat)) {
    const I = E.INVITATII;
    const { data: r } = await admin.rpc('inregistreaza_invitatie', { p_jucator: id, p_cod: b.invitat, p_bonus: I.bonus, p_zile_cont: I.zileCont });
    invitatie = r ?? { eroare: 'invitatie' };
  }

  if (b.actiune === 'stare') {
    const { data: garaj, error } = await admin.from('garaje').select('masina, raritate, nivel, bucati, blocat').eq('jucator', id);
    // prietenii invitați care au jucat destul îți aduc premiul acum
    try { const I = E.INVITATII; await admin.rpc('plateste_invitatii', { p_jucator: id, p_suma: I.premiu, p_zile: I.zile, p_max: I.max }); } catch { /* data viitoare */ }
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
    const { data: echipa } = await admin.from('echipe').select('clasa, masina').eq('jucator', id);
    // ce ai făcut azi, pentru ecranul „Azi" de pe prima pagină
    const zi = E.ziua();
    const [{ data: ziQuiz }, { data: ziStartul }, { data: inscris }, { data: extra }] = await Promise.all([
      admin.from('scoruri_zi').select('joc').eq('jucator', id).eq('data', zi),
      admin.from('zi_rezultate').select('data').eq('jucator', id).eq('data', zi).maybeSingle(),
      admin.from('cupa_inscrieri').select('folosite').eq('jucator', id).eq('data', zi).maybeSingle(),
      admin.from('cupe_extra').select('data').eq('data', zi).maybeSingle(),
    ]);
    const jucate = new Set((ziQuiz ?? []).map((x: { joc: string }) => x.joc));
    const azi = {
      data: zi,
      provocari: { 'sus-sau-jos': jucate.has('sus-sau-jos'), ordine: jucate.has('ordine'), startul: !!ziStartul },
      cupa: { azi: E.ziDinSaptamana(zi) === 0 || !!extra, inscris: !!inscris },
    };
    // numele de pe server e cel adevărat; telefonul își ia copia de aici
    const { data: j } = await admin.from('jucatori').select('nume').eq('id', id).maybeSingle();
    return raspuns({ portofel: p ?? portofel, garaj, misiuni: lista, seturi_noi, premii: premii ?? [], echipa: echipa ?? [], azi, invitatie, nume: j?.nume ?? null });
  }

  // Invită un prieten: codul tău (făcut acum, dacă nu există) și cum stau prietenii
  if (b.actiune === 'invita') {
    let { data: c } = await admin.from('invitatii_coduri').select('cod').eq('jucator', id).maybeSingle();
    for (let i = 0; !c && i < 5; i++) {
      const { data: nou, error } = await admin.from('invitatii_coduri').insert({ jucator: id, cod: codNou() }).select('cod').maybeSingle();
      if (nou) c = nou;
      else if (error && String(error.code) !== '23505') return raspuns({ eroare: 'cod' }, 500);
      else ({ data: c } = await admin.from('invitatii_coduri').select('cod').eq('jucator', id).maybeSingle());
    }
    if (!c) return raspuns({ eroare: 'cod' }, 500);
    const { data: prieteni } = await admin.rpc('invitatiile_mele', { p_jucator: id });
    return raspuns({ cod: c.cod, prieteni: prieteni ?? [], ...E.INVITATII, invitatie });
  }

  if (b.actiune === 'echipa') {
    const clasa = b.clasa;
    if (!Number.isInteger(clasa) || clasa! < 0 || clasa! > 4) return raspuns({ eroare: 'clasa' }, 422);
    if (b.masina == null) {
      await admin.from('echipe').delete().eq('jucator', id).eq('clasa', clasa);
    } else {
      const car = MD.dupaCheie(b.masina);
      if (!car) return raspuns({ eroare: 'masina' }, 422);
      const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', b.masina).maybeSingle();
      if (!g) return raspuns({ eroare: 'masina' }, 409);
      // clasa vine din timpul după tuning
      if (M.clasa(car, g.nivel) !== clasa) return raspuns({ eroare: 'clasa' }, 409);
      const { error } = await admin.from('echipe').upsert({ jucator: id, clasa, masina: b.masina });
      if (error) return raspuns({ eroare: 'echipa' }, 500);
    }
    const { data: echipa } = await admin.from('echipe').select('clasa, masina').eq('jucator', id);
    return raspuns({ echipa: echipa ?? [] });
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
    const { data: ale } = await admin.from('garaje').select('masina').eq('jucator', id);
    const are = new Set((ale ?? []).map((g: { masina: string }) => g.masina));
    const { raritate, car } = E.trage(lada, MD.PE_RARITATE, aleator, (c: unknown) => are.has(M.cheieMasina(c)));
    const masina = M.cheieMasina(car);
    const valoare = E.VALOARE_DUBLURA[raritate];
    const { data: r, error } = await admin.rpc('deschide_lada', {
      p_jucator: id, p_lada: lada.id, p_pret: lada.pret, p_gratis: gratis,
      p_masina: masina, p_raritate: raritate, p_valoare_dublura: valoare,
    });
    if (error) return raspuns({ eroare: 'lada' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ masina, raritate, noua: r.noua, bucati: r.bucati, valoare, mil: r.mil, lazi_gratis: r.lazi_gratis, puncte: r.puncte });
  }

  // o dublură: pe bani sau pe un punct de upgrade (raritatea și valoarea de aici, nu din pagină)
  if (b.actiune === 'dublura') {
    const car = MD.dupaCheie(b.masina ?? '');
    if (!car || (b.alegere !== 'vinde' && b.alegere !== 'puncte')) return raspuns({ eroare: 'dublura' }, 422);
    const raritate = MD.rar(car);
    const { data: r, error } = await admin.rpc('dublura_schimba', {
      p_jucator: id, p_masina: b.masina, p_alegere: b.alegere, p_raritate: raritate, p_valoare: E.VALOARE_DUBLURA[raritate],
    });
    if (error) return raspuns({ eroare: 'dublura' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  // o piesă (0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie) urcă un nivel, pe puncte
  if (b.actiune === 'tuneaza') {
    const car = MD.dupaCheie(b.masina ?? '');
    const piesa = b.piesa;
    if (!Number.isInteger(piesa) || piesa! < 0 || piesa! > 3) return raspuns({ eroare: 'piesa' }, 422);
    const { data: g } = await admin.from('garaje').select('nivel').eq('jucator', id).eq('masina', b.masina ?? '').maybeSingle();
    if (!g || !car) return raspuns({ eroare: 'masina' }, 404);
    const acum = M.piese(g.nivel)[piesa!];
    if (acum >= E.TUNING.max) return raspuns({ eroare: 'maxim' }, 409);
    const { data: r, error } = E.TUNING.peBani.includes(piesa)
      ? await admin.rpc('tuneaza_piesa_mil', { p_jucator: id, p_masina: b.masina, p_piesa: piesa, p_cost: E.TUNING.mil(MD.rar(car), acum) })
      : await admin.rpc('tuneaza_piesa', {
        p_jucator: id, p_masina: b.masina, p_piesa: piesa, p_raritate: MD.rar(car), p_cost: E.TUNING.puncte(acum),
      });
    if (error) return raspuns({ eroare: 'tuning' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
