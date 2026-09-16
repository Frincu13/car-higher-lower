"""Fetch Forza wiki car pages for FH5/FH6 cars -> data-src/lists/forza_specs.json.

Uses the CarInfobox on each page: power (hp), torque (lb-ft), weight (lb),
displacement, engine layout, year. These are the manufacturer figures Forza uses
for the stock car, so they describe exactly the version that is in the game.
"""
import json, os, re, time, urllib.parse, urllib.request

LISTS = os.path.join(os.path.dirname(__file__), '..', 'data-src', 'lists')
API = 'https://forza.fandom.com/api.php'
UA = {'User-Agent': 'car-higher-lower-bot/0.1 (personal quiz game; batch of ~30 requests)'}
CACHE = os.path.join(LISTS, 'forza_pages.json')


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    with urllib.request.urlopen(urllib.request.Request(f'{API}?{q}', headers=UA), timeout=60) as r:
        data = json.load(r)
    time.sleep(1)
    return data


def infobox(text):
    m = re.search(r'\{\{CarInfobox(.*?)\n\}\}', text, flags=re.S)
    if not m: return None
    fields = dict(re.findall(r'^\|\s*(\w+)\s*=\s*(.*?)\s*$', m.group(1), flags=re.M))
    num = lambda k: float(fields[k].replace(',', '')) if re.fullmatch(r'[\d.,]+', fields.get(k, '')) else None
    return {'manufacturer': fields.get('manufacturer'), 'model': fields.get('model'), 'year': num('year'),
            'hp': num('power'), 'torqueLbft': num('torque'), 'weightLb': num('weight'),
            'disp': fields.get('disp'), 'engine': fields.get('engine'), 'aspiration': fields.get('aspiration'),
            'type': fields.get('type')}


def main():
    pages = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}

    fh5_wt = json.load(open(os.path.join(LISTS, 'fh5.json'), encoding='utf-8'))['parse']['wikitext']['*']
    wanted = {}  # (game name, year) -> page title guess
    for m in re.finditer(r'\{\{CarListStatsFH5\|([^|]+)\|[^|]*\|(\d{4})\|', fh5_wt):
        wanted[(re.sub(r'\s*\(\d{4}\)\s*$', '', m.group(1)).strip(), int(m.group(2)))] = m.group(1).strip()
    for c in json.load(open(os.path.join(LISTS, 'game_cars.json'), encoding='utf-8')):
        wanted.setdefault((c['name'], c['year']), c['name'])

    titles = sorted({t for t in wanted.values() if t not in pages})
    print('fetching', len(titles), 'titles')
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        d = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main',
                 'titles': '|'.join(batch), 'redirects': 1})
        q = d['query']
        back = {r['to']: r['from'] for r in q.get('redirects', [])}
        norm = {n['to']: n['from'] for n in q.get('normalized', [])}
        for p in q['pages']:
            src = back.get(p['title'], p['title']); src = norm.get(src, src)
            if p.get('missing') or 'revisions' not in p:
                pages[src] = None; continue
            pages[src] = infobox(p['revisions'][0]['slots']['main']['content'])
        for t in batch: pages.setdefault(t, None)
        json.dump(pages, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
        print(i + len(batch), '/', len(titles))

    out = {}
    for (name, year), title in wanted.items():
        box = pages.get(title)
        if box and box.get('hp'):
            out[f'{name}|{year}'] = box
    json.dump(out, open(os.path.join(LISTS, 'forza_specs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('with specs', len(out), 'of', len(wanted))


if __name__ == '__main__':
    main()
