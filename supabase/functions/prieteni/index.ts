// Prietenii: lista, cererile de prietenie (cu codul de 6 litere, același ca la
// invitații) și invitațiile la joc trimise direct în aplicație.
//   { actiune: 'stare' }                    -> { cod, prieteni, primite, trimise, invitatii }
//   { actiune: 'cere', cod }                -> { cerere | prieteni, nume }
//   { actiune: 'raspunde', cu, accepta }    -> { ok }
//   { actiune: 'sterge', cu }               -> { ok }   (prieten sau cerere, în orice sens)
//   { actiune: 'invita', catre, camera }    -> { ok }   (camera ta, care așteaptă)
//   { actiune: 'refuza', id }               -> { ok }   (o invitație la joc primită)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { inFundal, trimite as notifica } from '../_shared/push.ts';

const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const MAX_PRIETENI = 200;
const LITERE_COD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codNou = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), x => LITERE_COD[x % LITERE_COD.length]).join('');
const UUID = /^[0-9a-f-]{36}$/i;
const NUME_JOC: Record<string, string> = { licitatie: 'Licitația', draft: 'Mașina perfectă', startul: 'Startul live', 'sus-sau-jos': 'Sus sau jos', ordine: 'În ordine' };
const linkJoc = (joc: string, cod: string) => (joc === 'startul' ? `drag.html?online&live=${cod}` : `camera.html?cod=${cod}`);

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
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

  // jucătorul există (numele îl pune primul joc online)
  await admin.from('jucatori').upsert({ id, nume: `Jucător ${id.slice(0, 4).toUpperCase()}` }, { onConflict: 'id', ignoreDuplicates: true });
  const numeDe = async (x: string) => (await admin.from('jucatori').select('nume').eq('id', x).maybeSingle()).data?.nume ?? 'Un prieten';

  if (b.actiune === 'stare') {
    // codul tău (făcut acum, dacă nu există)
    let { data: c } = await admin.from('invitatii_coduri').select('cod').eq('jucator', id).maybeSingle();
    for (let i = 0; !c && i < 5; i++) {
      const { data: nou, error } = await admin.from('invitatii_coduri').insert({ jucator: id, cod: codNou() }).select('cod').maybeSingle();
      if (nou) c = nou;
      else if (error && String(error.code) !== '23505') return raspuns({ eroare: 'cod' }, 500);
      else ({ data: c } = await admin.from('invitatii_coduri').select('cod').eq('jucator', id).maybeSingle());
    }
    const { data: l, error } = await admin.rpc('prietenii_mei', { p_jucator: id });
    if (error) return raspuns({ eroare: 'lista' }, 500);
    return raspuns({ cod: c?.cod ?? null, ...l });
  }

  if (b.actiune === 'cere') {
    if (typeof b.cod !== 'string' || !/^[A-Z0-9]{6}$/i.test(b.cod.trim())) return raspuns({ eroare: 'cod' }, 422);
    const { data: r, error } = await admin.rpc('prieten_cere', { p_jucator: id, p_cod: b.cod, p_max: MAX_PRIETENI });
    if (error) return raspuns({ eroare: 'cerere' }, 500);
    if (r?.eroare) return raspuns({ eroare: r.eroare }, 409);
    const eu = await numeDe(id);
    await inFundal(notifica(admin, [r.id], 'dueluri', r.prieteni
      ? { titlu: `${eu} ți-a acceptat cererea`, text: 'Acum sunteți prieteni în FRQ.', url: 'index.html#prieteni', tag: `frq-prieten-${id}` }
      : { titlu: `${eu} vrea să fiți prieteni`, text: 'Acceptă din Prieteni și vă puteți invita la jocuri.', url: 'index.html#prieteni', tag: `frq-prieten-${id}` }));
    return raspuns(r);
  }

  if (b.actiune === 'raspunde') {
    if (typeof b.cu !== 'string' || !UUID.test(b.cu)) return raspuns({ eroare: 'cerere' }, 422);
    if (b.accepta === true) {
      const { data: r } = await admin.from('prieteni').update({ stare: 'prieteni' }).eq('de', b.cu).eq('catre', id).eq('stare', 'cerere').select('de');
      if (!r?.length) return raspuns({ eroare: 'cerere' }, 409);
      const eu = await numeDe(id);
      await inFundal(notifica(admin, [b.cu], 'dueluri', { titlu: `${eu} ți-a acceptat cererea`, text: 'Acum sunteți prieteni în FRQ.', url: 'index.html#prieteni', tag: `frq-prieten-${id}` }));
    } else {
      await admin.from('prieteni').delete().eq('de', b.cu).eq('catre', id).eq('stare', 'cerere');
    }
    return raspuns({ ok: true });
  }

  if (b.actiune === 'sterge') {
    if (typeof b.cu !== 'string' || !UUID.test(b.cu)) return raspuns({ eroare: 'prieten' }, 422);
    await admin.from('prieteni').delete().or(`and(de.eq.${id},catre.eq.${b.cu}),and(de.eq.${b.cu},catre.eq.${id})`);
    return raspuns({ ok: true });
  }

  if (b.actiune === 'invita') {
    if (typeof b.catre !== 'string' || !UUID.test(b.catre) || typeof b.camera !== 'string' || !UUID.test(b.camera)) return raspuns({ eroare: 'invitatie' }, 422);
    const { data: p } = await admin.from('prieteni').select('stare')
      .or(`and(de.eq.${id},catre.eq.${b.catre}),and(de.eq.${b.catre},catre.eq.${id})`).eq('stare', 'prieteni').maybeSingle();
    if (!p) return raspuns({ eroare: 'nu e prieten' }, 403);
    const { data: c } = await admin.from('camere').select('id, a, b, stare, joc, cod, miza').eq('id', b.camera).maybeSingle();
    if (!c || c.a !== id || c.stare !== 'asteapta' || c.b) return raspuns({ eroare: 'camera' }, 409);
    const { error } = await admin.from('invitatii_joc').upsert({ de: id, catre: b.catre, camera: c.id, joc: c.joc, cod: c.cod, creat: new Date().toISOString() }, { onConflict: 'camera,catre' });
    if (error) return raspuns({ eroare: 'invitatie' }, 500);
    const eu = await numeDe(id);
    await inFundal(notifica(admin, [b.catre], 'dueluri', {
      titlu: `${eu} te invită la ${NUME_JOC[c.joc] ?? 'un joc'}`,
      text: c.miza ? `Pe ${c.miza} mil. Intră acum.` : 'Intră acum.',
      url: linkJoc(c.joc, c.cod), tag: `frq-invitatie-${c.id}`,
    }));
    return raspuns({ ok: true });
  }

  if (b.actiune === 'refuza') {
    if (typeof b.id !== 'string' || !UUID.test(b.id)) return raspuns({ eroare: 'invitatie' }, 422);
    await admin.from('invitatii_joc').delete().eq('id', b.id).eq('catre', id);
    return raspuns({ ok: true });
  }

  return raspuns({ eroare: 'actiune' }, 422);
});
