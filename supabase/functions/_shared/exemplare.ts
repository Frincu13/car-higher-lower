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
