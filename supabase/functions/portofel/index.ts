// Garajul meu: starea portofelului și a garajului, și deschiderea lăzilor. Mașina din
// ladă o trage serverul, cu numere aleatoare criptografice; pagina doar arată banda.
//   { actiune: 'stare', nume?, eveniment? } -> { portofel, garaj, exemplare, bonus, primii_pasi, eveniment, misiuni, seturi_noi, premii }  (premii: doar cele nevăzute)
//   { actiune: 'vazut', ids }              -> { ok }    (premiile arătate acum, ca să nu mai apară pe alt telefon)
//   { actiune: 'lada', lada, gratis }      -> { masina, raritate, noua, bucati, exemplar, valoare, mil, lazi_gratis, puncte }
//   { actiune: 'dublura', masina, alegere } -> { mil, puncte, bucati }  (alegere: 'vinde' sau 'puncte'; un exemplar netunat)
//   { actiune: 'vinde', exemplar }          -> { mil, bucati, valoare }  (un exemplar anume, și ultimul)
//   { actiune: 'dubluri', dubluri: [{ masina, alegere, n }] } -> { mil, puncte, vandute, mil_primit, puncte_primite, facute }
//   { actiune: 'tuneaza', masina, exemplar, piesa } -> { exemplar, nivel, mil, puncte }  (piesa: 0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie)
//   { actiune: 'cumpara', masina }          -> { mil }   (Vitrina: o mașină care îți lipsește)
//   { actiune: 'bonus' }                    -> { treapta, nume, premiu, mil, puncte, ... }  (următoarea ladă de bonus)
//   { actiune: 'echipa', clasa, masina, exemplar } -> { echipa } (Startul: mașina pentru o clasă; masina null o scoate)
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/drag-model.js';
import '../_shared/economie.js';
import '../_shared/seturi.js';
import CARS from '../_shared/masini.json' with { type: 'json' };
import { asiguraPortofel, misiuni, platesteRestante } from '../_shared/recompense.ts';
import { permis } from '../_shared/limita.ts';
import { exemplarul, toate } from '../_shared/exemplare.ts';
import { trimite as notifica } from '../_shared/push.ts';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const M = G.DragModel, E = G.Economie;
const MD = M.creeaza(CARS);
// prețul fiecărei mașini (o dublură vândută; un exemplar tunat ia și jumătate din tuning)
const VALORI = E.valori(MD, M.cheieMasina);
const SETURI = G.Seturi.creeaza(MD.POOL, { rar: MD.rar, cheie: M.cheieMasina, electrica: M.electrica, dublura: E.VALOARE_SET });
// ce apare ca noutate pe pagină (premii, seturi, misiuni, cupe)
const MOTIVE_PREMII = ['bun venit', 'premiul saptamanii', 'pachet gratis', 'premiu cupa', 'cupa', 'cupa anulata', 'set complet', 'misiune', 'bonus economia noua', 'invitat', 'prieten invitat', 'compensatie', 'eveniment'];
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

  let b: { actiune?: string; pachet?: string; nume?: string; lada?: string; gratis?: boolean; masina?: string | null; clasa?: number; alegere?: string; piesa?: number; invitat?: string; ids?: number[]; exemplar?: number | null; eveniment?: string; dubluri?: { masina?: string; alegere?: string; n?: number }[] };
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }
  // limita de cereri: pe tot ce scrie (lăzile și pachetele, mai strâns)
  if (b.actiune !== 'stare' && !(await permis(admin, `portofel:${b.actiune}:${id}`, ['lada', 'pachet'].includes(b.actiune ?? '') ? [30, 60] : [60, 60]))) return raspuns({ eroare: 'prea multe' }, 429);

  // jucătorul și portofelul există (numele nu se schimbă aici dacă există deja)
  const nume = numeCurat(b.nume) ?? `Jucător ${id.slice(0, 4).toUpperCase()}`;
  await admin.from('jucatori').upsert({ id, nume }, { onConflict: 'id', ignoreDuplicates: true });
  let portofel;
  try { portofel = await asiguraPortofel(admin, id); } catch { return raspuns({ eroare: 'portofel' }, 500); }

  // Scorul garajului (clasamentele lui): după fiecare schimbare din garaj, în fundal,
  // ca răspunsul să nu aștepte. `lista`: exemplarele, dacă sunt deja citite.
  const noteazaScor = async (lista?: { masina: string; nivel: number }[]) => {
    if (!lista) lista = await toate<{ masina: string; nivel: number }>((de, pana) => admin.from('exemplare').select('masina, nivel').eq('jucator', id).order('id').range(de, pana));
    const { scor, masini } = E.scorGaraj(MD, M.cheieMasina, lista ?? []);
    const { data: depasiti } = await admin.rpc('noteaza_scor_garaj', { p_jucator: id, p_scor: scor, p_masini: masini, p_luni: E.luni(E.ziua()), p_zi: E.ziua() });
    // cine a fost depășit acum și n-a mai primit azi una (baza de date ține socoteala):
    // o notificare, oricâți l-ar depăși în ziua aceea
    const ids = (depasiti ?? []).map((x: string | { noteaza_scor_garaj: string }) => (typeof x === 'string' ? x : x.noteaza_scor_garaj)).filter(Boolean);
    if (ids.length) {
      const { data: j } = await admin.from('jucatori').select('nume').eq('id', id).maybeSingle();
      await notifica(admin, ids, 'clasament', {
        titlu: `${j?.nume ?? 'Cineva'} te-a depășit`, text: 'În clasamentul garajului. Mai ai lăzi și tuning de făcut.',
        url: 'https://frincu13.github.io/car-higher-lower/colectie.html', tag: 'frq-clasament',
      });
    }
  };
  // în fundal, după răspuns; orice eroare de aici nu strică cererea
  const inFundal = (p: Promise<unknown>) => { const x = Promise.resolve(p).catch(() => {}); try { G.EdgeRuntime?.waitUntil(x); } catch { /* rulează oricum */ } };
  const SCHIMBA_GARAJUL = ['lada', 'pachet', 'cumpara', 'tuneaza', 'vinde', 'bonus'];

  // a venit dintr-un link de invitație (o singură dată, doar pe un cont nou)
  let invitatie = null;
  if (typeof b.invitat === 'string' && /^@?[a-z0-9_.]{3,16}$/i.test(b.invitat)) {
    const I = E.INVITATII;
    const { data: r } = await admin.rpc('inregistreaza_invitatie', { p_jucator: id, p_cod: b.invitat, p_bonus: I.bonus, p_zile_cont: I.zileCont });
    invitatie = r ?? { eroare: 'invitatie' };
  }

  if (b.actiune === 'stare') {
    // o zi de vizită (pentru câți revin a doua zi și după o săptămână)
    inFundal((async () => { await admin.from('vizite').upsert({ jucator: id, zi: E.ziua() }, { onConflict: 'jucator,zi', ignoreDuplicates: true }); })());
    // un cod de la un eveniment FRQ (din QR): premiul, o singură dată pe cont
    let eveniment = null;
    if (typeof b.eveniment === 'string' && /^[A-Za-z0-9]{4,12}$/.test(b.eveniment)) {
      const { data: r } = await admin.rpc('eveniment_ia', { p_jucator: id, p_cod: b.eveniment });
      eveniment = r ?? { eroare: 'cod' };
    }
    // Cererea de la fiecare pagină: ce nu depinde una de alta pleacă deodată. Plățile
    // restante (premiile săptămânii, cupele trecute) sunt ale tuturor și se fac în
    // fundal, după răspuns; dacă nu merg acum, data viitoare.
    const restante = platesteRestante(admin).catch(() => {});
    try { G.EdgeRuntime?.waitUntil(restante); } catch { /* rulează oricum */ }
    // prietenii invitați care au jucat destul îți aduc premiul acum
    const I = E.INVITATII;
    // pe bucăți: un garaj mare are peste 1.000 de exemplare (cât dă serverul o dată)
    const [{ data: garaj, error }, exemplare] = await Promise.all([
      toate<Record<string, unknown>>((de, pana) => admin.from('garaje').select('masina, raritate, nivel, bucati, blocat').eq('jucator', id).order('masina').range(de, pana)).then(data => ({ data, error: null }), error => ({ data: null, error })),
      toate<{ id: number; masina: string; nivel: number; blocat: boolean }>((de, pana) => admin.from('exemplare').select('id, masina, nivel, blocat').eq('jucator', id).order('id').range(de, pana)).catch(() => null),
      admin.rpc('plateste_invitatii', { p_jucator: id, p_suma: I.premiu, p_zile: I.zile, p_max: I.max }).then(() => null, () => null),
    ]);
    if (error) return raspuns({ eroare: 'garaj' }, 500);
    // seturile complete, plătite o singură dată (odată cu misiunile)
    const are = new Set((garaj ?? []).map((g: { masina: string }) => g.masina));
    const complete = SETURI.filter((x: { chei: string[] }) => x.chei.every(k => are.has(k)));
    const platesteSeturi = async () => {
      if (!complete.length) return [];
      const { data: luate } = await admin.from('miscari').select('cheie').eq('jucator', id).like('cheie', 'set:%');
      const deja = new Set((luate ?? []).map((x: { cheie: string }) => x.cheie));
      const noi = await Promise.all(complete.filter((x: { id: string }) => !deja.has(`set:${x.id}`)).map(async (x: { id: string; nume: string; premiu: number }) => {
        const { data: dat } = await admin.rpc('recompensa', { p_jucator: id, p_mil: x.premiu, p_lazi: 0, p_motiv: 'set complet', p_cheie: `set:${x.id}`, p_detalii: { set: x.id, nume: x.nume } });
        return dat === true ? { id: x.id, nume: x.nume, premiu: x.premiu } : null;
      }));
      return noi.filter(Boolean);
    };
    const [seturi_noi, lista] = await Promise.all([
      platesteSeturi().catch(() => []),
      misiuni(admin, id, !!cine.user.is_anonymous).catch(() => null),
    ]);
    // ce ai făcut azi, pentru ecranul „Azi" de pe prima pagină
    const zi = E.ziua();
    const [{ data: p }, { data: premii }, { data: echipa }, { data: j }, { data: ziQuiz }, { data: ziStartul }, { data: inscris }, { data: extra }, { data: ziBani }, { data: bonusuri }] = await Promise.all([
      admin.from('portofele').select('*').eq('jucator', id).single(),
      admin.from('miscari').select('id, mil, lazi, motiv, detalii, creat').eq('jucator', id)
        .in('motiv', MOTIVE_PREMII).eq('vazut', false).order('id', { ascending: false }).limit(12),
      admin.from('echipe').select('clasa, masina, exemplar').eq('jucator', id),
      // numele de pe server e cel adevărat; telefonul își ia copia de aici
      admin.from('jucatori').select('nume').eq('id', id).maybeSingle(),
      admin.from('scoruri_zi').select('joc').eq('jucator', id).eq('data', zi),
      admin.from('zi_rezultate').select('data').eq('jucator', id).eq('data', zi).maybeSingle(),
      admin.from('cupa_inscrieri').select('folosite').eq('jucator', id).eq('data', zi).maybeSingle(),
      admin.from('cupe_extra').select('data').eq('data', zi).maybeSingle(),
      admin.from('miscari').select('mil').eq('jucator', id).in('motiv', ['partida', 'victorie']).filter('detalii->>zi', 'eq', zi),
      // un rând pe zi jucată după plafon: ultimele 60 ajung (o ladă mai veche nedeschisă e rară)
      admin.from('bonus_zi').select('data, strans, castigate, deschise').eq('jucator', id).order('data', { ascending: false }).limit(60),
    ]);
    const jucate = new Set((ziQuiz ?? []).map((x: { joc: string }) => x.joc));
    const azi = {
      data: zi,
      provocari: { 'sus-sau-jos': jucate.has('sus-sau-jos'), ordine: jucate.has('ordine'), startul: !!ziStartul, carti: jucate.has('carti'), geaman: jucate.has('geaman') },
      cupa: { azi: E.ziDinSaptamana(zi) === 0 || !!extra, inscris: !!inscris },
      // banii din partide și victorii azi (au plafon pe zi)
      din_jocuri: (ziBani ?? []).reduce((s: number, x: { mil: number }) => s + x.mil, 0),
    };
    inFundal(noteazaScor(exemplare ?? []));
    // Primii pași (conturile noi): trei lucruri o dată, apoi un Pachet Sport, plătit aici
    let primii_pasi = null;
    const { data: cont } = await admin.from('jucatori').select('creat').eq('id', id).maybeSingle();
    if (cont && E.ziua(new Date(cont.creat).getTime()) >= E.PRIMII_PASI.din) {
      const { data: platit } = await admin.from('miscari').select('id').eq('jucator', id).eq('cheie', 'primii-pasi').maybeSingle();
      if (!platit) {
        const [{ count: np }, { count: nl }, { count: nr }, { count: nz }] = await Promise.all([
          admin.from('partide').select('id', { count: 'exact', head: true }).eq('jucator', id).not('scor', 'is', null),
          admin.from('miscari').select('id', { count: 'exact', head: true }).eq('jucator', id).in('motiv', ['lada', 'lada gratis']),
          admin.from('recorduri').select('masina', { count: 'exact', head: true }).eq('jucator', id),
          admin.from('zi_rezultate').select('data', { count: 'exact', head: true }).eq('jucator', id),
        ]);
        const gata: Record<string, boolean> = { partida: (np ?? 0) > 0, lada: (nl ?? 0) > 0, startul: (nr ?? 0) + (nz ?? 0) > 0 };
        const pasi = E.PRIMII_PASI.pasi.map((x: { id: string; text: string; link: string }) => ({ ...x, gata: gata[x.id] }));
        let platitAcum = false;
        if (pasi.every((x: { gata: boolean }) => x.gata)) {
          const { data: dat } = await admin.rpc('da_pachet_gratis', { p_jucator: id, p_motiv: 'pachet gratis', p_cheie: 'primii-pasi', p_detalii: { primii_pasi: true } });
          platitAcum = dat === true;
        }
        primii_pasi = { pasi, platit: platitAcum };
      }
    }
    // lăzile de bonus: bara de azi și câte așteaptă să fie deschise (și din zilele trecute)
    const bz = (bonusuri ?? []) as { data: string; strans: number; castigate: number; deschise: number }[];
    const bAzi = bz.find(x => x.data === zi);
    const bonus = { strans: Number(bAzi?.strans ?? 0), castigate: bAzi?.castigate ?? 0, deschise: bAzi?.deschise ?? 0, nedeschise: bz.reduce((s, x) => s + Math.max(0, x.castigate - x.deschise), 0) };
    return raspuns({ portofel: p ?? portofel, garaj, exemplare: exemplare ?? [], bonus, primii_pasi, eveniment, misiuni: lista, seturi_noi, premii: premii ?? [], echipa: echipa ?? [], azi, invitatie, nume: j?.nume ?? null });
  }

  if (SCHIMBA_GARAJUL.includes(b.actiune ?? '')) inFundal(new Promise(g => setTimeout(g, 1500)).then(() => noteazaScor()));

  // Premiile din ecranul „Ai primit": văzute, pe toate telefoanele contului
  if (b.actiune === 'vazut') {
    const ids = Array.isArray(b.ids) ? b.ids.filter(x => Number.isInteger(x) && x > 0).slice(0, 20) : [];
    if (ids.length) await admin.from('miscari').update({ vazut: true }).eq('jucator', id).in('id', ids);
    return raspuns({ ok: true });
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
    // linkul poartă ID-ul, dacă există (mai frumos decât codul)
    const { data: j } = await admin.from('jucatori').select('id_public').eq('id', id).maybeSingle();
    return raspuns({ cod: c.cod, id_public: j?.id_public ?? null, prieteni: prieteni ?? [], ...E.INVITATII, invitatie });
  }

  if (b.actiune === 'echipa') {
    const clasa = b.clasa;
    if (!Number.isInteger(clasa) || clasa! < 0 || clasa! > 4) return raspuns({ eroare: 'clasa' }, 422);
    if (b.masina == null) {
      await admin.from('echipe').delete().eq('jucator', id).eq('clasa', clasa);
    } else {
      const car = MD.dupaCheie(b.masina);
      if (!car) return raspuns({ eroare: 'masina' }, 422);
      const g = await exemplarul(admin, id, b.masina, car, b.exemplar);
      if (!g) return raspuns({ eroare: 'masina' }, 409);
      // clasa vine din timpul după tuning
      if (M.clasa(car, g.nivel) !== clasa) return raspuns({ eroare: 'clasa' }, 409);
      const { error } = await admin.from('echipe').upsert({ jucator: id, clasa, masina: b.masina, exemplar: g.id });
      if (error) return raspuns({ eroare: 'echipa' }, 500);
    }
    const { data: echipa } = await admin.from('echipe').select('clasa, masina, exemplar').eq('jucator', id);
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
    // prima mașină din garaj: garantat Epică sau mai bună (șansele lăzii, de la Epică în sus)
    const ladaAcum = are.size ? lada : { ...lada, sanse: lada.sanse.map((x: number, r: number) => (r >= 2 ? x || 1 : 0)) };
    const { raritate, car } = E.trage(ladaAcum, MD.PE_RARITATE, aleator, (c: unknown) => are.has(M.cheieMasina(c)));
    const masina = M.cheieMasina(car);
    const valoare = VALORI.get(masina);
    const { data: r, error } = await admin.rpc('deschide_lada', {
      p_jucator: id, p_lada: lada.id, p_pret: lada.pret, p_gratis: gratis,
      p_masina: masina, p_raritate: raritate, p_valoare_dublura: 0,
    });
    if (error) return raspuns({ eroare: 'lada' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ masina, raritate, noua: r.noua, bucati: r.bucati, exemplar: r.exemplar, valoare, mil: r.mil, lazi_gratis: r.lazi_gratis, puncte: r.puncte });
  }

  // un pachet: cinci mașini, plătite o dată; dacă răspunsul se pierde, pagina le
  // găsește în garaj (ca la ladă)
  if (b.actiune === 'pachet') {
    const pk = E.PACHETE.find((x: { id: string }) => x.id === b.pachet);
    if (!pk) return raspuns({ eroare: 'pachet' }, 422);
    // pachetele gratis (din seria de zile) sunt doar Sport
    const gratis = b.gratis === true;
    if (gratis && pk.id !== 'p-sport') return raspuns({ eroare: 'pachet' }, 422);
    const { data: ale } = await admin.from('garaje').select('masina').eq('jucator', id);
    const are = new Set((ale ?? []).map((g: { masina: string }) => g.masina));
    const carti = E.tragePachet(pk, MD.PE_RARITATE, aleator, (c: unknown) => are.has(M.cheieMasina(c)), M.cheieMasina);
    const masini = carti.map((x: { car: unknown }) => M.cheieMasina(x.car)), raritati = carti.map((x: { raritate: number }) => x.raritate);
    const { data: r, error } = await admin.rpc('deschide_pachet', { p_jucator: id, p_pachet: pk.id, p_pret: gratis ? 0 : pk.pret, p_masini: masini, p_raritati: raritati, p_gratis: gratis });
    if (error) return raspuns({ eroare: 'pachet' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({
      carti: masini.map((m: string, i: number) => ({ masina: m, raritate: raritati[i], noua: r.carti[i].noua, bucati: r.carti[i].bucati, exemplar: r.carti[i].exemplar, valoare: VALORI.get(m) })),
      mil: r.mil, lazi_gratis: r.lazi_gratis, pachete_gratis: r.pachete_gratis, puncte: r.puncte,
    });
  }

  // Următoarea ladă de bonus (cea mai veche nedeschisă): premiul îl trage serverul după
  // treaptă (Economie.BONUS), baza de date verifică treapta și îl dă, o singură dată.
  if (b.actiune === 'bonus') {
    const { data: rows } = await admin.from('bonus_zi').select('data, castigate, deschise').eq('jucator', id).order('data');
    const r0 = ((rows ?? []) as { data: string; castigate: number; deschise: number }[]).find(x => x.deschise < x.castigate);
    if (!r0) return raspuns({ eroare: 'fara lada' }, 409);
    const treapta = r0.deschise, pr = E.BONUS.premiu(treapta, aleator);
    let raritate: number | null = null, n: number | null = null, masina: string | null = null;
    if (pr.tip === 'puncte') { raritate = E.BONUS.raritate(aleator); n = pr.n; }
    if (pr.tip === 'masina') {
      const { data: ale } = await admin.from('garaje').select('masina').eq('jucator', id);
      const are = new Set((ale ?? []).map((g: { masina: string }) => g.masina));
      const t = E.trage(E.LAZI.find((l: { id: string }) => l.id === pr.lada), MD.PE_RARITATE, aleator, (c: unknown) => are.has(M.cheieMasina(c)));
      masina = M.cheieMasina(t.car); raritate = t.raritate;
    }
    const { data: r, error } = await admin.rpc('bonus_deschide', { p_jucator: id, p_data: r0.data, p_treapta: treapta, p_tip: pr.tip, p_raritate: raritate, p_n: n, p_masina: masina });
    if (error) return raspuns({ eroare: 'bonus' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ...r, treapta, nume: E.BONUS.nume[treapta], premiu: { tip: pr.tip, n, raritate, masina, lada: pr.lada ?? null, valoare: masina ? VALORI.get(masina) : null } });
  }

  // o dublură (un exemplar netunat): pe bani sau pe un punct de upgrade (raritatea și
  // valoarea de aici, nu din pagină)
  if (b.actiune === 'dublura') {
    const car = MD.dupaCheie(b.masina ?? '');
    if (!car || (b.alegere !== 'vinde' && b.alegere !== 'puncte')) return raspuns({ eroare: 'dublura' }, 422);
    const raritate = MD.rar(car);
    const { data: r, error } = await admin.rpc('dublura_schimba', {
      p_jucator: id, p_masina: b.masina, p_alegere: b.alegere, p_raritate: raritate, p_valoare: VALORI.get(M.cheieMasina(car)),
    });
    if (error) return raspuns({ eroare: 'dublura' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  // Un exemplar anume, vândut: prețul mașinii plus jumătate din ce s-a băgat în tuningul
  // lui. Poate fi și ultimul (pagina întreabă înainte).
  if (b.actiune === 'vinde') {
    const { data: e } = await admin.from('exemplare').select('id, masina, nivel').eq('jucator', id).eq('id', Number(b.exemplar)).maybeSingle();
    const car = e && MD.dupaCheie(e.masina);
    if (!e || !car) return raspuns({ eroare: 'exemplar' }, 404);
    const valoare = E.valoareExemplar(VALORI.get(M.cheieMasina(car)), MD.rar(car), e.nivel);
    const { data: r, error } = await admin.rpc('vinde_exemplar', { p_jucator: id, p_exemplar: e.id, p_nivel: e.nivel, p_valoare: valoare });
    if (error) return raspuns({ eroare: 'vinde' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns({ ...r, valoare });
  }

  // Ecranul Dubluri: pentru fiecare mașină aleasă, câte dubluri și ce faci cu ele. Fiecare
  // bucată trece prin aceeași funcție ca una singură; ce nu merge (mașină pusă într-un
  // duel între timp) se sare. Întoarce ce s-a făcut, pentru rezumat.
  if (b.actiune === 'dubluri') {
    const lista = Array.isArray(b.dubluri) ? b.dubluri.slice(0, 100) : [];
    const puncte_primite = [0, 0, 0, 0, 0], facute: { masina: string; bucati: number }[] = [];
    let vandute = 0, mil_primit = 0, pasi = 0;
    for (const x of lista) {
      const car = MD.dupaCheie(x?.masina ?? '');
      const n = Number.isInteger(x?.n) ? Math.min(x.n!, 50) : 0;
      if (!car || n < 1 || (x.alegere !== 'vinde' && x.alegere !== 'puncte')) continue;
      const raritate = MD.rar(car), valoare = VALORI.get(M.cheieMasina(car));
      let bucati: number | null = null;
      for (let i = 0; i < n && pasi < 200; i++, pasi++) {
        const { data: r, error } = await admin.rpc('dublura_schimba', {
          p_jucator: id, p_masina: x.masina, p_alegere: x.alegere, p_raritate: raritate, p_valoare: valoare,
        });
        if (error || r?.eroare) break;
        bucati = r.bucati;
        if (x.alegere === 'vinde') { vandute++; mil_primit = E.rotunjeste(mil_primit + valoare); } else puncte_primite[raritate]++;
      }
      if (bucati != null) facute.push({ masina: x.masina!, bucati });
    }
    const { data: p } = await admin.from('portofele').select('mil, puncte').eq('jucator', id).single();
    return raspuns({ mil: p?.mil, puncte: p?.puncte, vandute, mil_primit, puncte_primite, facute });
  }

  // o piesă (0 Anvelope, 1 Ușurare, 2 Motor, 3 Cutie) a unui exemplar urcă un nivel
  if (b.actiune === 'tuneaza') {
    const car = MD.dupaCheie(b.masina ?? '');
    const piesa = b.piesa;
    if (!Number.isInteger(piesa) || piesa! < 0 || piesa! > 3) return raspuns({ eroare: 'piesa' }, 422);
    const g = car && await exemplarul(admin, id, b.masina!, car, b.exemplar);
    if (!g || !car) return raspuns({ eroare: 'masina' }, 404);
    const acum = M.piese(g.nivel)[piesa!];
    if (acum >= E.TUNING.max) return raspuns({ eroare: 'maxim' }, 409);
    const { data: r, error } = E.TUNING.peBani.includes(piesa)
      ? await admin.rpc('tuneaza_piesa_mil', { p_jucator: id, p_exemplar: g.id, p_piesa: piesa, p_cost: E.TUNING.mil(MD.rar(car), acum) })
      : await admin.rpc('tuneaza_piesa', {
        p_jucator: id, p_exemplar: g.id, p_piesa: piesa, p_raritate: MD.rar(car), p_cost: E.TUNING.puncte(acum),
      });
    if (error) return raspuns({ eroare: 'tuning' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    return raspuns(r);
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
