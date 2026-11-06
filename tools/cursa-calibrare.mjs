// Calibrarea Cursei: timpul pe tur al fiecărei mașini (stoc și tunată la maxim) pe circuitul de
// referință, distribuția, clasele, și cât valorează tuningul. Rulează: node tools/cursa-calibrare.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const M = require('../cursa-model.js');
// aceleași mașini ca paginile și serverul: data/cars.js
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const ctxCars = { window: {} };
vm.runInNewContext(readFileSync(new URL('../data/cars.js', import.meta.url), 'utf8'), ctxCars);
const cars = ctxCars.window.CARS;
const C = M.circuit(M.REFERINTA);
const t0 = Date.now();
const rez = cars.map(c => ({ c, t: M.timpTur(M.parametri(c, 0), C), tMax: M.timpTur(M.parametri(c, 5 + 6 * 5 + 36 * 5 + 216 * 5), C) }));
console.log('mașini:', rez.length, 'timp calcul:', Date.now() - t0, 'ms', '| tur:', Math.round(C.L), 'm');
const ts = rez.map(r => r.t).sort((a, b) => a - b), q = f => ts[Math.floor(f * (ts.length - 1))];
console.log('timp tur stoc: min', q(0).toFixed(1), 'p5', q(.05).toFixed(1), 'p25', q(.25).toFixed(1), 'median', q(.5).toFixed(1), 'p75', q(.75).toFixed(1), 'p95', q(.95).toFixed(1), 'max', q(1).toFixed(1));
const castig = rez.map(r => 1 - r.tMax / r.t).sort((a, b) => a - b);
console.log('câștig tuning maxim: min', (castig[0] * 100).toFixed(1) + '%', 'median', (castig[castig.length >> 1] * 100).toFixed(1) + '%', 'max', (castig[castig.length - 1] * 100).toFixed(1) + '%');
// 999 = cea mai rapidă mașină tunată la maxim (ca orice upgrade, la orice mașină, să mute scorul);
// capătul de jos rămâne 83,2 s (mașinile mai lente stau la 100)
const rep = Math.floor(Math.min(...rez.map(r => r.tMax)) * 100) / 100, inc = 83.2;
M.seteazaReper(rep, inc);
console.log('reper: T_REPEDE', rep.toFixed(2), 'T_INCET', inc.toFixed(2));
const nr = {}; for (const r of rez) { r.s = M.scorDinTimp(r.t); const k = M.clasa(r.s); nr[k] = (nr[k] || 0) + 1; }
console.log('mașini pe clasă (stoc):', JSON.stringify(nr));
const arata = re => rez.filter(r => re.test(r.c.name)).slice(0, 3).forEach(r => { const p = M.parametri(r.c, 0); console.log(`  ${r.c.name} ${r.c.years}: tur ${r.t.toFixed(1)}s scor ${r.s} ${M.clasa(r.s)} | vmax ${Math.round(p.vmax * 3.6)} km/h, ${r.c.hp} CP, ${p.kg} kg, 0-100 ${p.baza.t100}s, ținută ${p.baza.tinere}, frână ${p.baza.frana} | tunată maxim ${r.tMax.toFixed(1)}s scor ${M.scorDinTimp(r.tMax)}`); });
for (const re of [/^BMW M3$/, /^Toyota Supra/, /Civic Type R/, /^Volkswagen Golf R$/, /Porsche 718 Cayman GTS/, /^Dacia Logan/, /^Bugatti Chiron/, /^Mazda MX-5/, /^Ferrari F40/]) arata(re);
const sc = rez.map(r => r.s).sort((a, b) => a - b), qs = f => sc[Math.floor(f * (sc.length - 1))];
console.log('praguri pe cincimi (scor stoc): D<', qs(.2), 'C<', qs(.4), 'B<', qs(.6), 'A<', qs(.8), 'S');
console.log('urcare cu tuning maxim, în puncte de scor: median', (() => { const d = rez.map(r => M.scorDinTimp(r.tMax) - r.s).sort((a, b) => a - b); return d[d.length >> 1]; })());
// tabelul cu scorurile mașinilor stoc, pentru pagini (Garajul, Cursa)
const tab = {}; for (const r of rez) tab[`${r.c.name}|${r.c.years}`] = r.s;
writeFileSync(new URL('../data/cursa-scoruri.js', import.meta.url), '// Scorul de circuit (100-999) al fiecărei mașini stoc, din cursa-model.js. Generat de tools/cursa-calibrare.mjs; nu-l edita de mână.\nwindow.CURSA_SCORURI = ' + JSON.stringify(tab) + ';\n');
console.log('scris data/cursa-scoruri.js:', Object.keys(tab).length, 'mașini');
