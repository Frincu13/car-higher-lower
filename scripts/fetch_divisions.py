"""Internal: Forza car division (Hypercars, Hot Hatch, ...) per car -> data-src/lists/divisions.json.

Sources: FH6 official list (type column) and the `div =` code in each Forza wiki page's
FH5/FH6 stats block. Used only for internal reports, never shipped to the site.
"""
import json, os, re, time, urllib.parse, urllib.request

LISTS = os.path.join(os.path.dirname(__file__), '..', 'data-src', 'lists')
API = 'https://forza.fandom.com/api.php'
UA = {'User-Agent': 'car-higher-lower-bot/0.1 (personal quiz game; batch of ~30 requests)'}


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    with urllib.request.urlopen(urllib.request.Request(f'{API}?{q}', headers=UA), timeout=60) as r:
        data = json.load(r)
    time.sleep(1)
    return data


roster = json.load(open(os.path.join(LISTS, 'game_cars.json'), encoding='utf-8'))
fh5_wt = json.load(open(os.path.join(LISTS, 'fh5.json'), encoding='utf-8'))['parse']['wikitext']['*']
title_for = {}
for m in re.finditer(r'\{\{CarListStatsFH5\|([^|]+)\|[^|]*\|(\d{4})\|', fh5_wt):
    title_for[(re.sub(r'\s*\(\d{4}\)\s*$', '', m.group(1)).strip(), int(m.group(2)))] = m.group(1).strip()
for c in roster:
    title_for.setdefault((c['name'], c['year']), c['name'])

fh6_type = {(c['name'], c['year']): c['type'] for c in roster if c['game'] == 'FH6' and c.get('type')}

cache_path = os.path.join(LISTS, 'division_pages.json')
codes = json.load(open(cache_path, encoding='utf-8')) if os.path.exists(cache_path) else {}
titles = sorted({t for t in title_for.values() if t not in codes})
print('fetching', len(titles))
for i in range(0, len(titles), 50):
    batch = titles[i:i + 50]
    q = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main', 'titles': '|'.join(batch), 'redirects': 1})['query']
    back = {r['to']: r['from'] for r in q.get('redirects', [])}
    norm = {n['to']: n['from'] for n in q.get('normalized', [])}
    for p in q['pages']:
        src = back.get(p['title'], p['title']); src = norm.get(src, src)
        text = p['revisions'][0]['slots']['main']['content'] if 'revisions' in p else ''
        found = {}
        for block in re.finditer(r'\{\{CarStats\|(fh5|fh6)(.*?)\n\}\}', text, flags=re.S):
            m = re.search(r'\|\s*div\s*=\s*([\w-]+)', block.group(2))
            if m: found.setdefault(block.group(1), m.group(1))
        codes[src] = found
    for t in batch: codes.setdefault(t, {})
    json.dump(codes, open(cache_path, 'w', encoding='utf-8'), ensure_ascii=False)
    print(i + len(batch), '/', len(titles), flush=True)

out = {}
for key, title in title_for.items():
    c = codes.get(title) or {}
    out[f'{key[0]}|{key[1]}'] = {'fh6type': fh6_type.get(key), 'code': c.get('fh5') or c.get('fh6')}
json.dump(out, open(os.path.join(LISTS, 'divisions.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('with fh6 type', sum(1 for v in out.values() if v['fh6type']), '| with code', sum(1 for v in out.values() if v['code']), '| total', len(out))
