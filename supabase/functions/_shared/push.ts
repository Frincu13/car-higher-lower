// Notificări pe telefon (Web Push), fără biblioteci: criptarea mesajului (RFC 8291,
// aes128gcm) și semnătura serverului (VAPID, RFC 8292) le face WebCrypto. Cheile stau
// în secretele funcțiilor: VAPID_PUBLIC (punctul P-256 necomprimat, base64url),
// VAPID_PRIVATE (scalarul d, base64url) și VAPID_SUBIECT (o adresă de contact).
//
// Abonamentele stau în tabelul `notificari`, unul pe telefon. Un abonament pe care
// serviciul de push îl respinge ca expirat (404 sau 410) se șterge pe loc.

// deno-lint-ignore no-explicit-any
type Admin = any;
export type Tip = 'dueluri' | 'cupa' | 'serie' | 'noutati' | 'test';
export type Mesaj = { titlu: string; text: string; url?: string; tag?: string };
type Abonament = { endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dinB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const lipeste = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) { out.set(x, i); i += x.length; }
  return out;
};
async function hmac(cheie: Uint8Array, date: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', cheie, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, date));
}

// Doar serviciile de push ale browserelor: un abonament e o adresă primită de la
// telefon, deci altfel serverul ar putea fi pus să trimită cereri oriunde.
const GAZDE = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
export function endpointBun(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try {
    const u = new URL(e);
    return u.protocol === 'https:' && GAZDE.some(r => r.test(u.hostname));
  } catch { return false; }
}

// Semnătura VAPID: un JWT ES256 pentru serviciul de push al abonamentului.
let cheiePrivata: CryptoKey | null = null;
async function vapid(endpoint: string) {
  const pub = dinB64u(Deno.env.get('VAPID_PUBLIC')!);
  if (!cheiePrivata) {
    cheiePrivata = await crypto.subtle.importKey('jwk', {
      kty: 'EC', crv: 'P-256', d: Deno.env.get('VAPID_PRIVATE')!,
      x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true,
    }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const antet = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corp = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: Deno.env.get('VAPID_SUBIECT') || 'https://frincu13.github.io/car-higher-lower/',
  })));
  const semn = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cheiePrivata, enc.encode(`${antet}.${corp}`)));
  return `vapid t=${antet}.${corp}.${b64u(semn)}, k=${Deno.env.get('VAPID_PUBLIC')}`;
}

// Criptarea mesajului pentru un singur telefon (RFC 8291 + RFC 8188, o singură înregistrare).
async function cripteaza(a: Abonament, text: Uint8Array) {
  const uaPub = dinB64u(a.p256dh), secret = dinB64u(a.auth);
  const pereche = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', pereche.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pereche.privateKey, 256));
  const prkCheie = await hmac(secret, ecdh);
  const ikm = await hmac(prkCheie, lipeste(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const sare = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sare, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrat = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, lipeste(text, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return lipeste(sare, rs, new Uint8Array([asPub.length]), asPub, cifrat);
}

// Trimite un mesaj unui abonament. Întoarce codul HTTP al serviciului de push.
export async function trimiteUnul(a: Abonament, m: Mesaj, ttl = 3600) {
  const corp = await cripteaza(a, enc.encode(JSON.stringify(m)));
  const r = await fetch(a.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapid(a.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body: corp,
  });
  await r.body?.cancel();
  return r.status;
}

// Trimiterea după răspuns: jucătorul nu așteaptă serviciul de push. Pe Supabase
// funcția mai trăiește cât timp are de lucru (EdgeRuntime.waitUntil); altundeva, se așteaptă.
export function inFundal(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) { er.waitUntil(p); return Promise.resolve(); }
  return p;
}

// Trimite tuturor telefoanelor unor jucători (sau tuturor, cu `jucatori` null) care
// au tipul acesta pornit. Abonamentele expirate se șterg. Nu aruncă niciodată: o
// notificare care nu pleacă nu are voie să strice mutarea sau duelul de dinainte.
export async function trimite(admin: Admin, jucatori: string[] | null, tip: Tip, m: Mesaj) {
  const rez = { trimise: 0, esuate: 0, sterse: 0 };
  try {
    if (!Deno.env.get('VAPID_PRIVATE')) return rez;
    let q = admin.from('notificari').select('endpoint, p256dh, auth, tipuri');
    if (jucatori) {
      const ids = jucatori.filter(Boolean);
      if (!ids.length) return rez;
      q = q.in('jucator', ids);
    }
    const { data } = await q.limit(5000);
    const lista = (data ?? []).filter((a: { tipuri: Record<string, boolean> }) => tip === 'test' || a.tipuri?.[tip] !== false);
    const expirate: string[] = [];
    for (let i = 0; i < lista.length; i += 20) {
      await Promise.all(lista.slice(i, i + 20).map(async (a: Abonament) => {
        try {
          const s = await trimiteUnul(a, m);
          if (s === 404 || s === 410) { expirate.push(a.endpoint); rez.sterse++; }
          else if (s >= 200 && s < 300) rez.trimise++;
          else rez.esuate++;
        } catch { rez.esuate++; }
      }));
    }
    if (expirate.length) await admin.from('notificari').delete().in('endpoint', expirate);
  } catch { /* fără notificare, restul merge */ }
  return rez;
}
