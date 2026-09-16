"""Internal report: every car on the site with its category and which games use it.

Writes data-src/lista-masini.csv (semicolon-separated, opens directly in Excel)
and prints a summary per category. Not shipped to the site.
"""
import csv, collections, json, os

HERE = os.path.dirname(__file__)
LISTS = os.path.join(HERE, '..', 'data-src', 'lists')
cars = json.load(open(os.path.join(HERE, '..', 'data', 'cars.json'), encoding='utf-8'))
div = json.load(open(os.path.join(LISTS, 'divisions.json'), encoding='utf-8'))

CODE = {'tt': 'Track Toys', 'h': 'Hypercars', 'ett': 'Extreme Track Toys', 'rsp': 'Retro Sports Cars',
        'ss': 'Modern Super Saloons', 'mss': 'Modern Super Saloons', 'msu': 'Modern Supercars',
        'msp': 'Modern Sports Cars', 'p4': "Pickups & 4x4's", 'rsu': 'Retro Supercars', 'cm': 'Classic Muscle',
        'mm': 'Modern Muscle', 'uo': 'Unlimited Offroad', 'suh': 'Sports Utility Heroes', 'dc': 'Drift Cars',
        'cc': 'Cult Cars', 'ram': 'Rally Monsters', 'crc': 'Classic Racers', 'csc': 'Classic Sports Cars',
        'rhh': 'Retro Hot Hatch', 'rs': 'Retro Super Saloons', 'rss': 'Retro Super Saloons', 'hh': 'Hot Hatch',
        'sgt': 'Super GT', 'rr': 'Retro Rally', 'rra': 'Retro Rally', 'rac': 'Rods and Customs',
        'shh': 'Super Hot Hatch', 'rc': 'Rare Classics', 'rem': 'Retro Muscle', 'vu': 'Utility Heroes',
        'gtc': 'GT Cars', 'crl': 'Classic Rally', 'mr': 'Modern Rally', 'ub': 'Unlimited Buggies', 'o': 'Offroad',
        'ecd': 'Eclectic Domestics', 'vr': 'Vintage Racers', 'utv': "UTV's", 'b': 'Buggies', 't': 'Offroad',
        'rrc': 'Retro Racers'}
GROUPS = [
    ('Hypercar', ['Hypercars']),
    ('Supercar', ['Modern Supercars', 'Retro Supercars']),
    ('Mașini de circuit', ['Track Toys', 'Extreme Track Toys']),
    ('Sport', ['Modern Sports Cars', 'Retro Sports Cars', 'Classic Sports Cars']),
    ('GT', ['GT Cars', 'Super GT']),
    ('Berline sport', ['Modern Super Saloons', 'Retro Super Saloons']),
    ('Muscle car', ['Classic Muscle', 'Modern Muscle', 'Retro Muscle']),
    ('Hot hatch', ['Hot Hatch', 'Super Hot Hatch', 'Retro Hot Hatch']),
    ('Raliu', ['Classic Rally', 'Retro Rally', 'Modern Rally', 'Rally Monsters']),
    ('SUV și camionete', ["Pickups & 4x4's", 'Sports Utility Heroes', 'Utility Heroes']),
    ('Off-road extrem și buggy', ['Offroad', 'Unlimited Offroad', 'Buggies', 'Unlimited Buggies', "UTV's"]),
    ('Curse și drift', ['Classic Racers', 'Retro Racers', 'Vintage Racers', 'Drift Cars']),
    ('Clasice și cult', ['Rare Classics', 'Cult Cars', 'Rods and Customs', 'Rods & Customs']),
    ('Mașini obișnuite', ['Eclectic Domestics', 'Electic Domestics']),
]
TO_GROUP = {d: g for g, ds in GROUPS for d in ds}


def category(car):
    info = div.get(f"{car['name']}|{car['years']}") or {}
    name = info.get('fh6type') or CODE.get(info.get('code'))
    if name in TO_GROUP:
        return TO_GROUP[name], False
    # No division known (mostly cars only in NFS / Motorfest): rough guess from specs.
    hp, kg = car.get('hp') or 0, car.get('weight') or 0
    if hp >= 900: return 'Hypercar', True
    if hp >= 550: return 'Supercar', True
    if kg >= 2100: return 'SUV și camionete', True
    if hp >= 250: return 'Sport', True
    return 'Mașini obișnuite', True


def in_draft(car):
    r = car.get('ratings')
    return bool(r and car.get('hp') and car.get('torque') and car.get('weight') and car.get('image'))


rows, summary = [], collections.OrderedDict((g, collections.Counter()) for g, _ in GROUPS)
for car in cars:
    cat, guessed = category(car)
    ssj = [label for key, label in (('hp', 'CP'), ('weight', 'greutate'), ('accel', '0-100')) if car.get(key) is not None]
    d = in_draft(car)
    rows.append([car['name'], car['years'], cat + (' (estimat)' if guessed else ''), car.get('hp') or '', car.get('weight') or '',
                 str(car['accel']).replace('.', ',') if car.get('accel') else '', ', '.join(ssj) or '-', 'da' if d else 'nu',
                 'da' if car.get('image') else 'nu'])
    s = summary[cat]
    s['total'] += 1; s['guessed'] += guessed; s['accel'] += car.get('accel') is not None; s['draft'] += d; s['photo'] += bool(car.get('image'))

rows.sort(key=lambda r: ([g for g, _ in GROUPS].index(r[2].replace(' (estimat)', '')), r[0], r[1]))
out = os.path.join(HERE, '..', 'data-src', 'lista-masini.csv')
with open(out, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['Mașină', 'An', 'Categorie', 'CP', 'Greutate (kg)', '0-100 (s)', 'Sus sau jos: categorii', 'Mașina perfectă', 'Poză'])
    w.writerows(rows)

print('| Categorie | Mașini | din care estimate | cu 0-100 | în Mașina perfectă | cu poză |')
print('|---|---:|---:|---:|---:|---:|')
tot = collections.Counter()
for g, s in summary.items():
    print(f"| {g} | {s['total']} | {s['guessed']} | {s['accel']} | {s['draft']} | {s['photo']} |"); tot.update(s)
print(f"| **Total** | **{tot['total']}** | {tot['guessed']} | {tot['accel']} | {tot['draft']} | {tot['photo']} |")
print('sus sau jos pools: CP', sum(1 for c in cars if c.get('hp')), '| greutate', sum(1 for c in cars if c.get('weight')), '| 0-100', sum(1 for c in cars if c.get('accel')))
print(out)
