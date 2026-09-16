"""Parse raw autoevolution dump into normalized records (data-src/parsed.json)."""
import json, re, html, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'data-src')
load = lambda n: json.load(open(os.path.join(ROOT, 'raw', n), encoding='utf-8'))
brands = {b['id']: b['name'] for b in load('brands.json')}
autos = {a['id']: a for a in load('automobiles.json')}

def num(pat, s):
    m = re.search(pat, s or '', re.I)
    return float(m.group(1).replace(',', '')) if m else None

out = []
for e in load('engines.json'):
    a = autos.get(e['automobile_id'])
    if not a: continue
    s = e['specs'] or {}
    eng, perf = s.get('Engine Specs', {}), s.get('Performance Specs', {})
    w = s.get('Weight Specs', {})
    name = html.unescape(a['name']).replace('Photos, engines & full specs', '').strip()
    name = re.sub(r'\s+', ' ', name)
    brand = brands.get(a['brand_id'], '')
    yrs = re.search(r'(\d{4})\s*-\s*(\d{4}|Present)', name)
    y1 = int(yrs.group(1)) if yrs else None
    y2 = (2024 if yrs.group(2) == 'Present' else int(yrs.group(2))) if yrs else None
    if not yrs:
        m1 = re.match(r'^(\d{4})\s+', name) or re.search(r'\s(\d{4})$', name)
        if m1: y1 = y2 = int(m1.group(1))
        name = re.sub(r'^\d{4}\s+|\s\d{4}$', '', name)
    model = re.sub(r'\s*\d{4}\s*-\s*(\d{4}|Present)\s*$', '', name)
    for pref in (brand, brand.replace(' ', '-'), 'Mercedes-Benz', 'Mercedes-AMG'):
        if model.upper().startswith(pref.upper() + ' '): model = model[len(pref):].strip()
    power = eng.get('Power:', '') or s.get('Electric Motor Specs', {}).get('Power:', '')
    acc = next((v for k, v in perf.items() if k.startswith('Acceleration 0-62')), '')
    photos = a.get('photos') or []
    out.append({
        'id': e['id'], 'brand': brand, 'model': model, 'yearFrom': y1, 'yearTo': y2,
        'engine': html.unescape(e['name']),
        'hp': num(r'([\d.,]+)\s*Hp', power),
        'torque': num(r'([\d.,]+)\s*Nm', eng.get('Torque:', '')),
        'accel': num(r'([\d.]+)\s*S', acc),
        'topSpeed': num(r'\(([\d.,]+)\s*Km/H\)', perf.get('Top Speed:', '')),
        'weight': num(r'\(([\d.,]+)\s*Kg\)', w.get('Unladen Weight:', '')),
        'displacement': num(r'([\d.,]+)\s*Cm3', eng.get('Displacement:', '')),
        'fuel': eng.get('Fuel:'), 'drive': s.get('Transmission Specs', {}).get('Drive Type:'),
        'cylinders': eng.get('Cylinders:'),
        'photos': len(photos) if isinstance(photos, list) else 0,
        'specKeys': list(s.keys()),
    })
json.dump(out, open(os.path.join(ROOT, 'parsed.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out))
