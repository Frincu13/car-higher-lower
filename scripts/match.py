"""Match curated list against parsed data -> data-src/matched.json + report."""
import json, re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from curated import CARS
ROOT = os.path.join(os.path.dirname(__file__), '..', 'data-src')
d = json.load(open(os.path.join(ROOT, 'parsed.json'), encoding='utf-8'))
F = ['hp', 'torque', 'accel', 'topSpeed', 'weight']
ALIAS = {'Mercedes-AMG': ['Mercedes-AMG', 'MERCEDES BENZ'], 'MERCEDES BENZ': ['MERCEDES BENZ', 'Mercedes-AMG']}
out, miss = [], []
for disp, brand, mre, year, ere in CARS:
    brands = [b.upper() for b in ALIAS.get(brand, [brand])]
    c = [r for r in d if r['brand'].upper() in brands and re.search(mre, r['model'], re.I)]
    if ere: c = [r for r in c if re.search(ere, r['engine'])]
    if not c: miss.append(disp); continue
    def key(r):
        comp = sum(1 for f in F if r[f])
        return (abs((r['yearFrom'] or 1900) - year), -comp, -(r['hp'] or 0))
    best = min(c, key=key)
    out.append({'name': disp, 'src': best})
    s = best
    print(f"{disp:36} <= {s['brand']} {s['model']} {s['yearFrom']}-{s['yearTo']} | {s['engine'][:34]:34} | hp={s['hp']} nm={s['torque']} 0-100={s['accel']} vmax={s['topSpeed']} kg={s['weight']}")
json.dump(out, open(os.path.join(ROOT, 'matched.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\nMATCHED', len(out), 'MISSING', len(miss)); print(miss)
