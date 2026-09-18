"""Game rosters + specs -> data/cars.js + data/cars.json (game data).

Pipeline (see README):
  collect_games.py  rosters of FH5, FH6, NFS Heat, NFS Unbound, Motorfest
  fetch_forza.py    Forza wiki infobox specs (hp, torque, weight) for those cars
  parse.py          autoevolution dump (0-100, top speed, and specs for non-Forza cars)
  match_games.py    roster car -> autoevolution record (strict)
  build.py          merge, validate, write
"""
import json, math, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from divisions import offroad_kind, offroad_grade_override  # noqa: E402

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', 'data-src')
LISTS = os.path.join(SRC, 'lists')
F = ['hp', 'torque', 'accel', 'topSpeed', 'weight']

roster = json.load(open(os.path.join(LISTS, 'game_cars.json'), encoding='utf-8'))
forza = json.load(open(os.path.join(LISTS, 'forza_specs.json'), encoding='utf-8'))
matched = {(m['name'], m['year']): m for m in json.load(open(os.path.join(LISTS, 'matched.json'), encoding='utf-8'))}
specs = {r['id']: r for r in json.load(open(os.path.join(SRC, 'parsed.json'), encoding='utf-8'))}
# FH5 in-game ratings (0-10): speed, handling, acceleration, launch, braking, off-road.
# Used by the draft mode for qualities that have no real-world number.
fh5_wt = json.load(open(os.path.join(LISTS, 'fh5.json'), encoding='utf-8'))['parse']['wikitext']['*']
ratings = {}
for m in re.finditer(r'\{\{CarListStatsFH5\|([^|]+)\|[^|]*\|(\d{4})\|(?:[^|]*\|){3}' + r'\|'.join([r'([\d.]+)'] * 6), fh5_wt):
    ratings[(re.sub(r'\s*\(\d{4}\)\s*$', '', m.group(1)).strip(), int(m.group(2)))] = [float(x) for x in m.groups()[2:]]
images = {}
if os.path.exists(os.path.join(LISTS, 'images.json')):
    images = json.load(open(os.path.join(LISTS, 'images.json'), encoding='utf-8'))

# Plausible ranges; values outside are dropped as data errors.
RANGE = {'hp': (3, 2100), 'torque': (5, 5000), 'accel': (1.5, 40), 'topSpeed': (40, 500), 'weight': (100, 8000)}
# Game-specific builds, liveries and movie tie-ins: their numbers are not a real
# production car, and there is no real-world photo of them.
NOT_REAL = re.compile(r"Forza Edition|Hoonigan|Formula Drift|DeBerti|Hot Wheels|Universal Studios|Fast X|"
                      r"Welcome Pack|Top Gear|Halo|Warthog|Extreme E|Donut Media|Motorfest Edition|Custom|"
                      r"#\d|'[^']+'|\"", re.I)
# Card details are shown before answering; a category loses a car whose name or
# engine text already contains the answer (McLaren 720S, Hennessey Mammoth 1000).
LEAK_FIELDS = ['hp', 'torque', 'topSpeed', 'weight']
ASPIRATION = {'t': 'Turbo', 'tt': 'Twin-Turbo', 's': 'Supercharged', 'ts': 'Turbo + Supercharged', 'e': 'Electric',
              'h': 'Hybrid', 'n': ''}


def clean_engine(text):
    # Power is spelled out in most autoevolution engine names ("6.0 V12 7AT (730 HP)", "294 Kw").
    t = re.sub(r'\(?\s*[\d.,]+\s*(HP|BHP|PS|KW)\b(/\d+)?\s*\)?', ' ', text, flags=re.I)
    t = re.sub(r'\(\s*\)', ' ', t)
    return re.sub(r'\s+', ' ', t).strip(' -')


def leaks(value, text):
    for tok in re.findall(r'\d+(?:[.,]\d+)?', text):
        n = float(tok.replace(',', '.'))
        if n >= 50 and abs(n - value) / value <= 0.02:
            return True
    return False


def forza_engine(box):
    parts = []
    if box.get('disp') and re.fullmatch(r'[\d.]+', box['disp']): parts.append(f"{box['disp']}L")
    if box.get('engine') and re.fullmatch(r'[A-Za-z]{1,3}\d{1,2}', box['engine']): parts.append(box['engine'].upper())
    asp = ASPIRATION.get((box.get('aspiration') or '').lower())
    if asp: parts.append(asp)
    return ' '.join(parts)


def estimate_0_100(hp, kg):
    # Fitted on the cars that have a real 0-100 time: t = e^0.618 * (kg/hp)^0.678.
    # Median error about 0.4 s (8%). Clamped to a plausible range.
    return max(1.8, min(30.0, math.exp(0.618) * (kg / hp) ** 0.678))


def ae_hp(rec):
    # Combined system output is in the engine name for hybrids/EVs ("(1063 HP)").
    m = re.search(r'\(([\d,]+)\s*HP\)', rec['engine'], re.I)
    hp = rec['hp']
    if m:
        nhp = float(m.group(1).replace(',', ''))
        if hp is None or abs(nhp - hp) / nhp > 0.08: hp = nhp
    return hp


# Distinct cars, keeping every game they appear in.
distinct = {}
for c in roster:
    key = (re.sub(r'[^a-z0-9]', '', c['name'].lower()), c['year'])
    e = distinct.setdefault(key, {'name': c['name'], 'year': c['year'], 'games': []})
    if c['game'] not in e['games']: e['games'].append(c['game'])

cars, log = [], {'not_real': 0, 'no_specs': 0, 'ae_rejected': [], 'range': [], 'leak': []}
for e in distinct.values():
    name, year = e['name'], e['year']
    if NOT_REAL.search(name):
        log['not_real'] += 1; continue
    v = dict.fromkeys(F)
    engine = ''
    box = forza.get(f'{name}|{year}')
    if box and box.get('year') and abs(box['year'] - year) > 2: box = None
    if box and (box.get('type') or '').startswith(('c', 'f', 'l')): box = None  # concepts, fictional, lore
    if box:
        v['hp'] = box['hp']
        v['torque'] = box['torqueLbft'] * 1.35582 if box.get('torqueLbft') else None
        v['weight'] = box['weightLb'] * 0.453592 if box.get('weightLb') else None
        engine = forza_engine(box)

    m = matched.get((name, year))
    if m:
        rec = specs[m['specId']]
        rhp = ae_hp(rec)
        # Same car? If Forza gives power, the autoevolution record must agree,
        # otherwise it is another trim and its 0-100 / top speed would be wrong.
        same = rhp and (not v['hp'] or abs(rhp - v['hp']) / v['hp'] <= 0.07)
        if same:
            v['accel'], v['topSpeed'] = rec['accel'], rec['topSpeed']
            if not box:
                v['hp'], v['torque'], v['weight'] = rhp, rec['torque'], rec['weight']
                engine = clean_engine(rec['engine'])
        elif v['hp']:
            log['ae_rejected'].append(f"{name} {year}: forza {v['hp']:.0f} hp vs {rec['model']} {rec['engine']}")

    for f, (lo, hi) in RANGE.items():
        if v[f] is not None and not lo <= v[f] <= hi:
            log['range'].append(f'{name} {year}: {f}={v[f]}'); v[f] = None
    # 0-100 far below what power-to-weight allows means a mismatched record.
    if v['accel'] and v['hp'] and v['weight'] and v['accel'] < 0.5 * (0.95 * (v['weight'] / v['hp']) ** 0.75 + 0.9):
        log['range'].append(f"{name} {year}: accel={v['accel']} implausible"); v['accel'] = None
    for f in LEAK_FIELDS:
        if v[f] and leaks(v[f], f'{name} {engine}'):
            log['leak'].append(f'{name}: {f}'); v[f] = None
    if sum(1 for f in F if v[f] is not None) < 2:
        log['no_specs'] += 1; continue

    rnd = lambda x, n=0: None if x is None else (round(x, n) if n else int(round(x)))
    img = images.get(f'{name}|{year}')
    rt = ratings.get((name, year))
    cars.append({
        'name': name, 'years': str(year), 'engine': engine, 'games': e['games'],
        'hp': rnd(v['hp']), 'torque': rnd(v['torque']), 'accel': rnd(v['accel'], 1),
        # Draft-only: estimated 0-100 when the real time is missing (Sus sau jos never uses it).
        **({'accelEst': rnd(estimate_0_100(v['hp'], v['weight']), 1)} if v['accel'] is None and v['hp'] and v['weight'] else {}),
        'topSpeed': rnd(v['topSpeed']), 'weight': rnd(v['weight']),
        **({'ratings': dict(zip(['speed', 'handling', 'accel', 'launch', 'braking', 'offroad'], rt))} if rt else {}),
        # Car type band for the draft's off-road grade (supercar, sport, suvSport, offroad4x4...).
        # Unknown type (rare): guess from power.
        **({'offroadKind': offroad_kind(name, year) or ('supercar' if (v['hp'] or 0) >= 550 else 'sport')} if rt else {}),
        **({'offroadGrade': offroad_grade_override(name, year)} if rt and offroad_grade_override(name, year) is not None else {}),
        **({'image': img['thumb'], 'credit': img['credit'], 'license': img['license'], 'source': img['page']} if img else {}),
    })

# Same car listed under slightly different names in different games
# ("Acura RSX Type-S" 2002 vs "Acura RSX-S" 2004): merge when brand word, power and weight agree.
cars.sort(key=lambda c: (-len(c['games']), c['name']))
kept = []
for c in cars:
    dup = next((k for k in kept if k['name'].split()[0] == c['name'].split()[0] and k['hp'] and k['hp'] == c['hp']
                and abs(int(k['years']) - int(c['years'])) <= 3 and k['weight'] and c['weight']
                and abs(k['weight'] - c['weight']) <= 25), None)
    if dup:
        dup['games'] = sorted(set(dup['games']) | set(c['games']))
        for f in F:
            if dup[f] is None: dup[f] = c[f]
        for k in ('ratings', 'offroadKind', 'offroadGrade', 'image', 'credit', 'license', 'source'):
            if k not in dup and k in c: dup[k] = c[k]
    else:
        kept.append(c)
merged = len(cars) - len(kept)
# Only cars with a photo go on the site: a placeholder card feels unfinished.
no_photo = sum(1 for c in kept if not c.get('image'))
kept = [c for c in kept if c.get('image')]
kept.sort(key=lambda c: c['name'])
for i, c in enumerate(kept):
    c['id'] = i + 1
    del c['games']  # sourcing detail, only used for merging; not part of the public data

# Hand-set grades (0-10) and top speed for the draft cars: handling, braking and off-road
# have no public measurement for every car, so they are judged per car on a fixed scale.
# scripts/grades.csv is meant to be edited by hand.
grades = {}
for row in open(os.path.join(HERE, 'grades.csv'), encoding='utf-8').read().splitlines()[1:]:
    gname, gyears, kmh, han, brk, off = row.split(';')
    grades[(gname, gyears)] = {'kmh': int(kmh), 'handling': float(han), 'braking': float(brk), 'offroad': float(off)}
for c in kept:
    if (c['name'], c['years']) in grades:
        c['grades'] = grades.pop((c['name'], c['years']))
if grades:
    print('grades.csv rows with no matching car:', sorted(grades))

out = os.path.join(HERE, '..', 'data'); os.makedirs(out, exist_ok=True)
js = json.dumps(kept, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(out, 'cars.js'), 'w', encoding='utf-8').write('// Generated by scripts/build.py. Do not edit.\nwindow.CARS = ' + js + ';\n')
json.dump(kept, open(os.path.join(out, 'cars.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(log, open(os.path.join(LISTS, 'build_log.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('distinct', len(distinct), '| cars', len(kept), '| merged dups', merged, '| dropped without photo', no_photo,
      '| not real', log['not_real'], '| too few specs', log['no_specs'], '| ae rejected', len(log['ae_rejected']))
for f in F: print(f, sum(1 for c in kept if c[f] is not None))
print('with image', sum(1 for c in kept if c.get('image')))
print('draft pool (hp, torque, weight, ratings)', sum(1 for c in kept if c.get('ratings') and c['hp'] and c['torque'] and c['weight']))
