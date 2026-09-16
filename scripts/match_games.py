"""Match game rosters (game_cars.json) to spec records (parsed.json).

Output: data-src/lists/matched.json, one entry per distinct car with the chosen
spec record id, plus unmatched.json for review.

Matching is deliberately strict: every meaningful word of the game's model name
must appear in the spec record's model/engine text, and the production years
must fit. A missed car is better than a car with someone else's numbers.
"""
import json, os, re
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data-src')
games = json.load(open(os.path.join(ROOT, 'lists', 'game_cars.json'), encoding='utf-8'))
specs = json.load(open(os.path.join(ROOT, 'parsed.json'), encoding='utf-8'))

norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower().replace('ë', 'e').replace('é', 'e').replace('ö', 'o').replace('ü', 'u'))

# Game brand prefix -> dataset brand(s)
BRAND_ALIAS = {
    'abarth': ['FIAT'], 'citroen': ['CITROEN'], 'shelby': ['FORD'], 'srt': ['DODGE'], 'dmc': ['DeLorean'],
    'ram': ['RAM Trucks', 'DODGE'], 'amg': ['Mercedes-AMG', 'MERCEDES BENZ'], 'lucid': ['Lucid Motors'],
    'mercedesamg': ['Mercedes-AMG', 'MERCEDES BENZ'], 'mercedesbenz': ['MERCEDES BENZ', 'Mercedes-AMG'],
    'mercedes': ['MERCEDES BENZ', 'Mercedes-AMG'], 'vw': ['VOLKSWAGEN'], 'rangerover': ['LAND ROVER'],
    'chevy': ['CHEVROLET'], 'lynkco': [], 'mini': ['MINI'], 'gmc': ['GMC'], 'ds': ['DS AUTOMOBILES'],
}
by_brand = defaultdict(list)
for r in specs:
    by_brand[r['brand'].upper()].append(r)
brand_keys = sorted({norm(b): b for b in by_brand}.items(), key=lambda kv: -len(kv[0]))

# Words that describe body style or marketing, often absent from spec model names.
OPTIONAL = {'coupe', 'sedan', 'saloon', 'hatchback', 'hatch', 'wagon', 'estate', 'touring', 'edition', 'the',
            'launch', 'special', 'series', 'forza', 'door', 'doors', '2door', '4door', '3door', '5door', 'car',
            'de', 'and', 'with', 'package', 'pack', 'version', 'limited', 'standard', 'base', 'new', 'mk',
            'facelift', 'lci', 'phase', 'restyling', 'ii', 'iii', 'iv', 'miata', 'convertible', 'cabrio',
            'cabriolet', 'spider', 'spyder', 'roadster', 'targa', 'volante', 'lb', 'hb'}
# Brand-like prefixes that are really a trim of another make: the word must also
# appear in the spec record ("Abarth 500" is not a plain Fiat 500).
KEEP_PREFIX = {'abarth', 'shelby', 'srt', 'amg'}
# Technical words in engine strings that are not trims.
TECH = set('l i mt at amt cvt dct dsg pdk smg awd rwd fwd 4wd 4x4 2wd 4matic 4motion quattro xdrive sdrive '
           'turbo biturbo twin tt supercharged sc v6 v8 v10 v12 w12 w16 i4 i6 h4 h6 b6 b12 tfsi tsi tdi fsi tfsi '
           'gdi t gdi crdi dci hdi cdi vtec ivtec vvt vvti dohc sohc valve v gasoline diesel hybrid phev electric '
           'kwh kw hp ps bhp manual automatic auto tiptronic steptronic speedshift powershift sequential ecoboost '
           'hemi rotary boxer flat cyl cylinder engine motor motors dual tri single long range lr ev e mpi fi efi '
           'rs r s'.split())


def split_brand(name):
    n = norm(name)
    words = name.split()
    for k, alias in BRAND_ALIAS.items():
        if n.startswith(k):
            # consume as many words as the alias key covers
            acc, i = '', 0
            while i < len(words) and len(acc) < len(k):
                acc += norm(words[i]); i += 1
            if acc == k:
                rest = ' '.join(words[i:])
                return [b.upper() for b in alias], (f'{k} {rest}' if k in KEEP_PREFIX else rest)
    for k, b in brand_keys:
        acc, i = '', 0
        while i < len(words) and len(acc) < len(k):
            acc += norm(words[i]); i += 1
        if acc == k:
            return [b.upper()], ' '.join(words[i:])
    return [], name


def tokens(s):
    return [t for t in re.split(r'[^a-z0-9]+', s.lower().replace('ë', 'e').replace('é', 'e')) if t]


def covers(game_toks, rec):
    text = f"{rec['model']} {rec['engine']}"
    toks = set(tokens(text))
    flat = norm(text)
    missing = []
    for t in game_toks:
        if t in OPTIONAL: continue
        ok = t in toks if t.isdigit() else (t in toks or (len(t) >= 2 and t in flat))
        if not ok: missing.append(t)
    return missing


def year_fit(rec, year):
    a = rec['yearFrom']; b = rec['yearTo'] or a
    if a is None: return 99
    if a - 1 <= year <= b + 1: return 0
    return min(abs(year - a), abs(year - b))


# Distinct cars across games
distinct = {}
for g in games:
    key = (norm(g['name']), g['year'])
    e = distinct.setdefault(key, {'name': g['name'], 'year': g['year'], 'games': []})
    if g['game'] not in e['games']: e['games'].append(g['game'])

matched, unmatched = [], []
for (key, year), car in distinct.items():
    brands, model = split_brand(car['name'])
    if not brands or not model:
        unmatched.append({**car, 'why': 'brand'}); continue
    gt = tokens(model)
    pool = [r for b in brands for r in by_brand.get(b, [])]
    cands = []
    for r in pool:
        if covers(gt, r): continue
        yf = year_fit(r, year)
        if yf > 2: continue
        # Prefer records whose own model name has few words the game name lacks
        # ("911 Turbo" should not land on "911 Turbo S").
        extra = [t for t in tokens(re.sub(r'\([^)]*\)', '', r['model'])) if t not in gt and t not in OPTIONAL and t not in norm(model)]
        if extra: continue
        # Trim words in the engine string the game name doesn't mention (CSL, GTS,
        # Competition): prefer the plain version when the game names the plain car.
        eng_extra = [t for t in tokens(re.sub(r'\([^)]*\)', '', r['engine']))
                     if not re.search(r'\d', t) and t not in TECH and t not in OPTIONAL and t not in gt and t not in norm(model)]
        complete = sum(1 for f in ('hp', 'torque', 'accel', 'topSpeed', 'weight') if r[f])
        cands.append((yf, len(eng_extra), -complete, -(r['hp'] or 0), r, eng_extra))
    if not cands:
        unmatched.append({**car, 'why': 'no spec'}); continue
    cands.sort(key=lambda c: c[:4])
    yf, _, _, _, r, eng_extra = cands[0]
    matched.append({**car, 'specId': r['id'], 'specModel': r['model'], 'specEngine': r['engine'],
                    'specYears': [r['yearFrom'], r['yearTo']], 'yearGap': yf, 'trimWords': eng_extra})

json.dump(matched, open(os.path.join(ROOT, 'lists', 'matched.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(unmatched, open(os.path.join(ROOT, 'lists', 'unmatched.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('distinct', len(distinct), 'matched', len(matched), 'unmatched', len(unmatched))
