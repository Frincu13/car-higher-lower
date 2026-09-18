"""Hand-picked cars that are not in the game rosters (scripts/extra_cars.csv) ->
spec records from the autoevolution dump -> data-src/lists/extra_matched.json.

A row names the brand(s), a regex on the model name, the year and the power of the
version meant. A record matches when brand and model match, the production years
cover the year (±2) and its power is within 7% of the target. Closest power wins,
then the record with the most figures filled in.
"""
import json, os, re

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', 'data-src')
specs = json.load(open(os.path.join(SRC, 'parsed.json'), encoding='utf-8'))


def rec_hp(r):
    # Same rule as build.py: the power field, unless the engine name (combined output
    # of hybrids/EVs) disagrees by more than 8%.
    m = re.search(r'\(?([\d,]+)\s*HP\)?', r['engine'] or '', re.I)
    ehp = float(m.group(1).replace(',', '')) if m else None
    if r['hp'] and (not ehp or abs(ehp - r['hp']) / ehp <= 0.08): return r['hp']
    return ehp


BODY = re.compile(r'Convertible|Cabrio|Roadster|Spyder|Spider|Volante|GTC|Touring|Combi|Wagon|T-Modell|Estate|Sportwagon|Cross Turismo|Shooting Brake|\bST\b|\bSW\b', re.I)

rows = open(os.path.join(HERE, 'extra_cars.csv'), encoding='utf-8').read().splitlines()[1:]
out, misses = [], []
for row in rows:
    if not row.strip(): continue
    name, year, brands, model_re, hp = row.split(';')
    year, hp = int(year), float(hp)
    brands = [b.strip().upper() for b in brands.split('|')]
    rx = re.compile(model_re, re.I)
    cands = []
    for r in specs:
        if not any(b in r['brand'].upper() for b in brands): continue
        if not rx.search(r['model']): continue
        a = r['yearFrom']; b = r['yearTo'] or a
        if a is None or not (a - 2 <= year <= b + 2): continue
        rhp = rec_hp(r)
        if not rhp or abs(rhp - hp) / hp > 0.07: continue
        filled = sum(1 for f in ('hp', 'torque', 'weight', 'accel', 'topSpeed') if r[f])
        # Prefer the plain body (coupe/saloon) unless the row asks for another one.
        body = bool(BODY.search(r['model'])) and not BODY.search(model_re + ' ' + name)
        cands.append((body, abs(rhp - hp) / hp, -filled, abs(a - year), r, rhp))
    if not cands:
        misses.append(name + f' {year}'); continue
    cands.sort(key=lambda c: c[:4])
    r, rhp = cands[0][4], cands[0][5]
    out.append({'name': name, 'year': year, 'specId': r['id'], 'model': r['model'], 'engine': r['engine'],
                'hp': rhp, 'torque': r['torque'], 'weight': r['weight'], 'accel': r['accel'], 'topSpeed': r['topSpeed']})

json.dump(out, open(os.path.join(SRC, 'lists', 'extra_matched.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('matched', len(out), 'missed', len(misses))
for m in misses: print('  miss:', m)
