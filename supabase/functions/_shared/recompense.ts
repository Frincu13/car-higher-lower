// Recompensele zilei, comune funcțiilor care primesc provocările (trimite-zi,
// trimite-scor). Cifrele vin din economie.js, aceleași ca pe pagină; banii îi mută
// funcțiile din baza de date, fiecare recompensă o singură dată pe cheie.
import './economie.js';

// deno-lint-ignore no-explicit-any
const E = (globalThis as any).Economie;

// deno-lint-ignore no-explicit-any
type Admin = any;

export async function asiguraPortofel(admin: Admin, jucator: string) {
  const { data, error } = await admin.rpc('asigura_portofel', {
    p_jucator: jucator, p_mil: E.RECOMPENSE.bunVenit.mil, p_lazi: E.RECOMPENSE.bunVenit.lazi,
  });
  if (error) throw error;
  return data;
}

async function da(admin: Admin, jucator: string, mil: number, lazi: number, motiv: string, cheie: string) {
  const { data, error } = await admin.rpc('recompensa', {
    p_jucator: jucator, p_mil: mil, p_lazi: lazi, p_motiv: motiv, p_cheie: cheie, p_detalii: null,
  });
  if (error) throw error;
  return data === true;
}

// O provocare a zilei terminată: 2 mil. (o dată pe zi și joc), o ladă la prima
// provocare a zilei și bonusul de serie. Întoarce ce s-a dat acum.
export async function recompenseZi(admin: Admin, jucator: string, joc: string, data: string) {
  const out = { mil: 0, lazi: 0, serie: 0 };
  await asiguraPortofel(admin, jucator);
  const { data: zi, error } = await admin.rpc('noteaza_zi', { p_jucator: jucator, p_data: data });
  if (error) throw error;
  out.serie = zi?.serie ?? 0;
  if (zi?.prima) {
    if (await da(admin, jucator, 0, E.RECOMPENSE.primaZi.lazi, 'prima provocare a zilei', `prima:${data}`)) out.lazi += E.RECOMPENSE.primaZi.lazi;
    const bonus = E.RECOMPENSE.serie(out.serie);
    if (bonus && await da(admin, jucator, bonus, 0, `serie de ${out.serie} zile`, `serie:${data}`)) out.mil += bonus;
  }
  if (await da(admin, jucator, E.RECOMPENSE.provocare, 0, `provocarea zilei: ${joc}`, `zi:${joc}:${data}`)) out.mil += E.RECOMPENSE.provocare;
  return out;
}

// Misiunile zilei: progresul îl socotește baza de date din ce s-a jucat azi; cele
// terminate se plătesc pe loc, o singură dată. Întoarce lista pentru pagină.
export async function misiuni(admin: Admin, jucator: string) {
  const azi = E.ziua();
  const { data: p, error } = await admin.rpc('misiuni_progres', { p_jucator: jucator, p_data: azi });
  if (error) throw error;
  const out = [];
  for (const k of E.misiuniZi(azi)) {
    const m = E.MISIUNI[k];
    const progres = Math.min(Number(p?.[m.tip] ?? 0), m.n);
    const gata = progres >= m.n;
    const noua = gata && await da(admin, jucator, m.mil, 0, 'misiune', `misiune:${azi}:${k}`);
    out.push({ id: k, text: m.text, n: m.n, mil: m.mil, link: m.link, progres, gata, noua });
  }
  return out;
}

// Plățile care se fac după ce s-a încheiat ceva: premiile săptămânii trecute și
// cupele trecute. Le face primul care trece pe aici (o singură dată, pe cheie).
export async function platesteRestante(admin: Admin) {
  const azi = E.ziua();
  const luniTrecuta = E.laData(E.luni(azi), -7);
  const chei = E.SAPTAMANA.jocuri.map((j: string) => `saptamana:${j}:${luniTrecuta}`);
  const { data: cupe } = await admin.from('cupa_inscrieri').select('data').lt('data', azi).gte('data', E.laData(azi, -21));
  const zileCupa = [...new Set((cupe ?? []).map((x: { data: string }) => x.data))] as string[];
  const toate = [...chei, ...zileCupa.map(z => `cupa:${z}`)];
  const { data: platite } = await admin.from('premii_platite').select('cheie').in('cheie', toate);
  const gata = new Set((platite ?? []).map((x: { cheie: string }) => x.cheie));
  for (const joc of E.SAPTAMANA.jocuri) {
    if (gata.has(`saptamana:${joc}:${luniTrecuta}`)) continue;
    await admin.rpc('plateste_saptamana', {
      p_joc: joc, p_cat: E.SAPTAMANA.cat(joc, luniTrecuta), p_luni: luniTrecuta, p_premii: E.SAPTAMANA.premii, p_minim: E.SAPTAMANA.minim,
    });
  }
  for (const z of zileCupa) {
    if (gata.has(`cupa:${z}`)) continue;
    await admin.rpc('plateste_cupa', {
      p_data: z, p_impartire: E.CUPA.impartire, p_minim: E.CUPA.minim, p_intrare: E.CUPA.intrare, p_comision: E.CUPA.comision,
    });
  }
}
