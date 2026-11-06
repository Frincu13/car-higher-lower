// Clasamentul Turului săptămânii (Cursa), folosit de funcția cursa și de plata premiilor de luni.
// deno-lint-ignore no-explicit-any
type Admin = any;

// Clasamentul Turului săptămânii într-o clasă: cel mai bun tur al fiecăruia.
export async function clasamentSapt(admin: Admin, luni: string, clasa: string, eu: string | null, limita = 20) {
  const { data } = await admin.from('cursa_tururi').select('jucator, masina, nivel, timp_ms, creat')
    .eq('tip', 'sapt').eq('cheie', luni).eq('clasa', clasa).order('timp_ms', { ascending: true }).order('creat', { ascending: true }).limit(2000);
  const vazut = new Set<string>(), lista: { jucator: string; masina: string; nivel: number; timp_ms: number }[] = [];
  for (const r of data ?? []) if (!vazut.has(r.jucator)) { vazut.add(r.jucator); lista.push(r); }
  const top = lista.slice(0, limita), ids = [...new Set([...top.map(x => x.jucator), ...(eu ? [eu] : [])])];
  const { data: j } = ids.length ? await admin.from('jucatori').select('id, nume').in('id', ids) : { data: [] };
  const nume = new Map((j ?? []).map((x: { id: string; nume: string }) => [x.id, x.nume]));
  const rand = (x: { jucator: string; masina: string; nivel: number; timp_ms: number }, i: number) =>
    ({ loc: i + 1, nume: nume.get(x.jucator) ?? 'Pilot', masina: x.masina, nivel: x.nivel, timp: x.timp_ms, eu: x.jucator === eu });
  const k = eu ? lista.findIndex(x => x.jucator === eu) : -1;
  return { luni, clasa, total: lista.length, top: top.map(rand), eu: k >= 0 ? rand(lista[k], k) : null, lista };
}
