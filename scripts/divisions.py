"""Car type (Forza division) lookup, shared by build.py and report_cars.py.

`divisions.json` comes from fetch_divisions.py: the FH6 list type, or the wiki's
division code for the car.
"""
import json, os

LISTS = os.path.join(os.path.dirname(__file__), '..', 'data-src', 'lists')

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

# Off-road "kind": which band of the off-road grade a car's type belongs to (see
# OFFROAD_BANDS in draft.js). Ground clearance and drivetrain follow the type far more
# than the raw rating does.
OFFROAD_KIND = {
    'supercar': ['Hypercars', 'Modern Supercars', 'Retro Supercars', 'Track Toys', 'Extreme Track Toys',
                 'Classic Racers', 'Retro Racers', 'Vintage Racers'],
    'sport': ['Modern Sports Cars', 'Retro Sports Cars', 'Classic Sports Cars', 'GT Cars', 'Super GT',
              'Classic Muscle', 'Modern Muscle', 'Retro Muscle', 'Drift Cars', 'Rods and Customs', 'Rods & Customs'],
    'road': ['Hot Hatch', 'Super Hot Hatch', 'Retro Hot Hatch', 'Modern Super Saloons', 'Retro Super Saloons',
             'Eclectic Domestics', 'Electic Domestics'],
    'classic': ['Rare Classics', 'Cult Cars'],
    'utility': ['Utility Heroes'],
    'suvSport': ['Sports Utility Heroes'],
    'rally': ['Classic Rally', 'Retro Rally', 'Modern Rally'],
    'rallyMonster': ['Rally Monsters'],
    'offroad4x4': ["Pickups & 4x4's"],
    'extreme': ['Offroad', 'Unlimited Offroad', 'Buggies', 'Unlimited Buggies', "UTV's"],
}
_KIND_OF = {d: k for k, ds in OFFROAD_KIND.items() for d in ds}

# Cars the source files under the wrong type for off-road purposes.
KIND_OVERRIDE = {
    'Land Rover Defender 110 X': 'offroad4x4',  # listed with road SUVs, but a real off-roader
}
# Raw rating that is clearly off for the road car (Evo X GSR is rated like a rally car).
OFFROAD_GRADE_OVERRIDE = {
    ('Mitsubishi Lancer Evolution X GSR', 2008): 5.7,
}

_div = None


def division(name, year):
    global _div
    if _div is None:
        path = os.path.join(LISTS, 'divisions.json')
        _div = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    info = _div.get(f'{name}|{year}') or {}
    return info.get('fh6type') or CODE.get(info.get('code'))


def offroad_kind(name, year):
    return KIND_OVERRIDE.get(name) or _KIND_OF.get(division(name, year))


def offroad_grade_override(name, year):
    return OFFROAD_GRADE_OVERRIDE.get((name, year))
