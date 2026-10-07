// Înainte de `supabase functions deploy`: pune lângă funcții modelul cursei și
// mașinile, exact ca în joc. Funcția trimite-zi reface cursele cu ele, deci trebuie
// să fie aceleași fișiere pe care le folosește site-ul.
//   node tools/pregateste-functii.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const R = new URL('..', import.meta.url);
const dest = new URL('supabase/functions/_shared/', R);
mkdirSync(dest, { recursive: true });

writeFileSync(new URL('drag-model.js', dest), readFileSync(new URL('drag-model.js', R)));

// data/cars.js e un script care pune mașinile pe window.CARS
const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('data/cars.js', R), 'utf8'), ctx);
const cars = ctx.window.CARS.map(c => ({
  name: c.name, years: c.years, hp: c.hp, weight: c.weight,
  accel: c.accel ?? null, accelEst: c.accelEst ?? null, engine: c.engine ?? '', image: c.image ? 1 : 0,
}));
writeFileSync(new URL('masini.json', dest), JSON.stringify(cars));
console.log(`model + ${cars.length} mașini în supabase/functions/_shared/`);
