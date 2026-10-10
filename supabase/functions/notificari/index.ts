// Notificările pe telefon: abonarea telefonului, ce tipuri vrea jucătorul și
// trimiterile de pe server.
//   Jucătorul (cu contul lui):
//   { actiune: 'aboneaza', abonament, tipuri } -> { ok, tipuri }
//   { actiune: 'stare', endpoint }             -> { abonat, tipuri }
//   { actiune: 'tipuri', endpoint, tipuri }    -> { ok, tipuri }
//   { actiune: 'dezaboneaza', endpoint }       -> { ok }
//   { actiune: 'test', endpoint }              -> { ok }  o notificare doar pe telefonul acesta
//   Noi și ceasul din baza de date (antetul x-frq-cheie = NOTIF_CHEIE):
//   { actiune: 'trimite', catre: 'toti' | id | [id], titlu, text, url, tip } -> { trimise, ... }
//   { actiune: 'cupa' }   duminica dimineața (sau în zilele cu cupă în plus)
//   { actiune: 'serie' }  seara: cine are o serie de cel puțin 2 zile și n-a jucat azi
import { createClient } from 'npm:@supabase/supabase-js@2';
import '../_shared/economie.js';
import { endpointBun, trimite, trimiteUnul, type Tip } from '../_shared/push.ts';

// deno-lint-ignore no-explicit-any
const E = (globalThis as any).Economie;
const ORIGINI = ['https://frincu13.github.io', 'http://localhost:3470'];
const TIPURI = ['dueluri', 'cupa', 'serie', 'noutati'];
const URL_SITE = 'https://frincu13.github.io/car-higher-lower/';
const MAX_TELEFOANE = 6;

function cors(origine: string) {
  return {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
// tipurile cunoscute, ca true/false; ce lipsește rămâne pornit
function tipuriCurate(t: unknown) {
  const out: Record<string, boolean> = {};
  for (const k of TIPURI) out[k] = !(t && typeof t === 'object' && (t as Record<string, unknown>)[k] === false);
  return out;
}
const textScurt = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// doar pagini de pe site, ca o notificare să nu poată trimite pe altundeva
function urlSite(u: unknown) {
  const s = String(u ?? '');
  if (!s) return URL_SITE;
  try {
    const x = new URL(s, URL_SITE);
    return x.href.startsWith(URL_SITE) ? x.href : URL_SITE;
  } catch { return URL_SITE; }
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
  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return raspuns({ eroare: 'json' }, 400); }

  // ---------- noi și ceasul din baza de date ----------
  const cheie = Deno.env.get('NOTIF_CHEIE');
  if (b.actiune === 'trimite' || b.actiune === 'cupa' || b.actiune === 'serie') {
    if (!cheie || req.headers.get('x-frq-cheie') !== cheie) return raspuns({ eroare: 'interzis' }, 403);

    if (b.actiune === 'trimite') {
      const titlu = textScurt(b.titlu, 60), text = textScurt(b.text, 180);
      if (!titlu) return raspuns({ eroare: 'titlu' }, 422);
      const tip: Tip = b.tip === 'test' ? 'test' : 'noutati';
      const catre = b.catre === 'toti' ? null : (Array.isArray(b.catre) ? b.catre : [b.catre]).map(String).slice(0, 500);
      // fără tip: noutăți, deci ajunge doar la cine nu le-a oprit; „test" ajunge oricum
      const rez = await trimite(admin, catre, tip, { titlu, text, url: urlSite(b.url), tag: 'frq-anunt' });
      return raspuns(rez);
    }

    const azi = E.ziua();
    if (b.actiune === 'cupa') {
      const { data: extra } = await admin.from('cupe_extra').select('data').eq('data', azi).maybeSingle();
      if (E.ziDinSaptamana(azi) !== 0 && !extra) return raspuns({ azi: 'fara cupa' });
      return raspuns(await trimite(admin, null, 'cupa', {
        titlu: 'Cupa a început', text: 'Aceeași mașină pentru toți, trei încercări. Potul se împarte la primii trei.',
        url: urlSite('drag.html?online'), tag: `frq-cupa-${azi}`,
      }));
    }

    // seria: au jucat ieri provocarea, azi încă nu; o singură amintire pe zi
    const ieri = E.laData(azi, -1);
    const { data: p } = await admin.from('portofele').select('jucator, serie').eq('ultima_zi', ieri).gte('serie', 2).limit(5000);
    let trimise = 0;
    for (const x of p ?? []) {
      const r = await trimite(admin, [x.jucator], 'serie', {
        titlu: `Seria ta de ${x.serie} zile`, text: 'O provocare a zilei până la miezul nopții și seria merge mai departe.',
        url: urlSite('sus-sau-jos.html?online'), tag: `frq-serie-${azi}`,
      });
      trimise += r.trimise;
    }
    return raspuns({ jucatori: (p ?? []).length, trimise });
  }

  // ---------- jucătorul ----------
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cine, error: eroareCont } = await admin.auth.getUser(jwt);
  if (eroareCont || !cine?.user) return raspuns({ eroare: 'neautentificat' }, 401);
  const id = cine.user.id;

  if (b.actiune === 'aboneaza') {
    const a = b.abonament;
    const p256dh = a?.keys?.p256dh, auth = a?.keys?.auth;
    if (!endpointBun(a?.endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string'
      || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,30}$/.test(auth)) return raspuns({ eroare: 'abonament' }, 422);
    const tipuri = tipuriCurate(b.tipuri);
    // același telefon cu alt cont: abonamentul trece la contul de acum
    const { error } = await admin.from('notificari').upsert({ endpoint: a.endpoint, jucator: id, p256dh, auth, tipuri, folosit: new Date().toISOString() });
    if (error) return raspuns({ eroare: 'abonament' }, 500);
    // cel mult câteva telefoane pe cont: cele vechi pleacă
    const { data: ale } = await admin.from('notificari').select('endpoint').eq('jucator', id).order('folosit', { ascending: false });
    const vechi = (ale ?? []).slice(MAX_TELEFOANE).map((x: { endpoint: string }) => x.endpoint);
    if (vechi.length) await admin.from('notificari').delete().in('endpoint', vechi);
    return raspuns({ ok: true, tipuri });
  }

  if (!endpointBun(b.endpoint)) return raspuns({ eroare: 'abonament' }, 422);
  const { data: al } = await admin.from('notificari').select('*').eq('endpoint', b.endpoint).eq('jucator', id).maybeSingle();

  if (b.actiune === 'stare') return raspuns({ abonat: !!al, tipuri: al ? tipuriCurate(al.tipuri) : tipuriCurate(null) });

  if (!al) return raspuns({ eroare: 'neabonat' }, 404);

  if (b.actiune === 'tipuri') {
    const tipuri = tipuriCurate(b.tipuri);
    await admin.from('notificari').update({ tipuri }).eq('endpoint', b.endpoint);
    return raspuns({ ok: true, tipuri });
  }

  if (b.actiune === 'dezaboneaza') {
    await admin.from('notificari').delete().eq('endpoint', b.endpoint);
    return raspuns({ ok: true });
  }

  if (b.actiune === 'test') {
    // o dată la 20 de secunde, ca butonul să nu devină un trimițător de spam
    if (al.ultimul_test && Date.now() - Date.parse(al.ultimul_test) < 20000) return raspuns({ eroare: 'prea des' }, 429);
    await admin.from('notificari').update({ ultimul_test: new Date().toISOString() }).eq('endpoint', b.endpoint);
    let s = 0;
    try {
      s = await trimiteUnul(al, { titlu: 'Notificările merg', text: 'Așa arată o notificare FRQ. Atinge-o ca să te întorci în Setări.', url: urlSite('index.html#setari'), tag: 'frq-test' }, 120);
    } catch { return raspuns({ eroare: 'trimitere' }, 502); }
    if (s === 404 || s === 410) {
      await admin.from('notificari').delete().eq('endpoint', b.endpoint);
      return raspuns({ eroare: 'expirat' }, 410);
    }
    return s >= 200 && s < 300 ? raspuns({ ok: true }) : raspuns({ eroare: 'trimitere', cod: s }, 502);
  }

  return raspuns({ eroare: 'actiune' }, 400);
});
