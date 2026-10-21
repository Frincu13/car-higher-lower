// Limita de cereri, comună funcțiilor (tabelul limite_cereri, funcția cerere_permisa):
// câte cereri pe o cheie într-o fereastră de timp. Se pune doar pe acțiunile care scriu
// ceva; citirile dese (starea unei camere la câteva secunde) rămân fără ea. Dacă baza nu
// răspunde, cererea trece: mai bine un abuz scurt decât un joc blocat pentru toți.
// deno-lint-ignore no-explicit-any
type Admin = { rpc: (f: string, a: Record<string, unknown>) => any };

// [câte, în câte secunde], pe acțiune; restul acțiunilor care scriu: IMPLICIT
export const IMPLICIT: [number, number] = [60, 60];

export async function permis(admin: Admin, cheie: string, [max, secunde]: [number, number] = IMPLICIT): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('cerere_permisa', { p_cheie: cheie.slice(0, 200), p_max: max, p_secunde: secunde });
    return error ? true : data !== false;
  } catch { return true; }
}

// adresa celui care cere (pentru funcțiile fără cont)
export const adresa = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'necunoscuta';
