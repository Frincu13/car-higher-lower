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
