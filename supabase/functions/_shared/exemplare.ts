// Exemplarul cu care alergi sau pe care îl tunezi: cel cerut (dacă e al tău și e
// mașina asta) sau, fără unul anume, cel mai rapid neblocat (pagini vechi, echipa
// fără exemplar). Întoarce null dacă nu ai mașina.
import './drag-model.js';

// deno-lint-ignore no-explicit-any
const M = (globalThis as any).DragModel;

// deno-lint-ignore no-explicit-any
type Admin = any;
export type Exemplar = { id: number; masina: string; nivel: number; blocat: boolean };

// deno-lint-ignore no-explicit-any
export async function exemplarul(admin: Admin, jucator: string, masina: string, car: any, exemplar?: unknown): Promise<Exemplar | null> {
  const { data } = await admin.from('exemplare').select('id, masina, nivel, blocat').eq('jucator', jucator).eq('masina', masina);
  const lista = (data ?? []) as Exemplar[];
  if (!lista.length) return null;
  if (exemplar != null) return lista.find(e => e.id === Number(exemplar)) ?? null;
  const timp = (e: Exemplar) => M.timpTunat(car, e.nivel) + (e.blocat ? 1e6 : 0);
  return lista.slice().sort((a, b) => timp(a) - timp(b))[0];
}

// Toate rândurile unei cereri, pe bucăți: serverul dă cel mult 1.000 de rânduri o dată,
// iar un garaj mare are mai multe exemplare. `fa(de, pana)`: cererea, cu .range(de, pana)
// și o ordine fixă.
export async function toate<T>(fa: (de: number, pana: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pas = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += pas) {
    const { data, error } = await fa(de, de + pas - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < pas) return out;
  }
}
