"""Collect car rosters from racing games -> data-src/lists/game_cars.json.

Sources (names/years only, no images or stats):
  FH5          forza.fandom.com wiki (CarListStatsFH5 templates)
  FH6          forza.net/fh6cars (official list)
  NFS Heat     nfs.fandom.com wiki (NFSHECar templates)
  NFS Unbound  nfs.fandom.com wiki (NFSUBCar templates)
  Motorfest    igcd.net (playable vehicles; the wiki list is incomplete)
"""
import html, json, os, re, time, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(__file__), '..', 'data-src', 'lists')
os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (car-higher-lower data collection)'}


def get(url, cache):
    path = os.path.join(OUT, cache)
    if not os.path.exists(path):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            open(path, 'wb').write(r.read())
        time.sleep(1)
    return open(path, encoding='utf-8', errors='replace').read()


def wikitext(host, page, cache):
    q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'wikitext', 'format': 'json', 'redirects': 1})
    return json.loads(get(f'https://{host}/api.php?{q}', cache))['parse']['wikitext']['*']


def fh5():
    w = wikitext('forza.fandom.com', 'Forza_Horizon_5/Cars', 'fh5.json')
    for m in re.finditer(r'\{\{CarListStatsFH5\|([^|]+)\|[^|]*\|(\d{4})\|', w):
        name = re.sub(r'\s*\(\d{4}\)\s*$', '', m.group(1)).strip()
        yield {'game': 'FH5', 'name': name, 'year': int(m.group(2))}


def fh6():
    s = get('https://forza.net/fh6cars', 'fh6.html')
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S):
        cells = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', row, flags=re.S)]
        if len(cells) < 3: continue
        m = re.match(r'(\d{4})\s+(.+)', cells[1])
        if m: yield {'game': 'FH6', 'name': m.group(2), 'year': int(m.group(1)), 'type': cells[2]}


def nfs_heat():
    w = wikitext('nfs.fandom.com', 'Need_for_Speed:_Heat/Cars', 'nfsh.json')
    for m in re.finditer(r'\{\{NFSHECar\|[^|]*\|[^|]*\|([^|]+)\|[^|]*\'(\d{2})\|', w):
        yy = int(m.group(2)); name = re.sub(r'\s*\([^)]*\)', '', m.group(1)).strip()
        yield {'game': 'NFS Heat', 'name': name, 'year': 1900 + yy if yy > 30 else 2000 + yy}


def nfs_unbound():
    w = wikitext('nfs.fandom.com', 'Need_for_Speed:_Unbound/Cars', 'nfsu.json')
    for m in re.finditer(r'\{\{NFSUBCar\|[^|]*\|[^|]*\|([^|\n]+?)\s*\((\d{4})\)\s*\n', w):
        yield {'game': 'NFS Unbound', 'name': re.sub(r'\s*\([^)]*\)', '', m.group(1)).strip(), 'year': int(m.group(2))}


def motorfest():
    page = 1
    while True:
        s = get(f'https://www.igcd.net/game.php?id=1000016573&type=vehicules&resultsStyle=jouable&page={page}', f'igcd_tcm_{page}.html')
        titles = re.findall(r'<h5 class="card-title"[^>]*><b>\s*(.*?)</b>', s, flags=re.S)
        if not titles: break
        for t in titles:
            m = re.match(r'(\d{4})\s+(.+)', html.unescape(t).strip())
            if m: yield {'game': 'Motorfest', 'name': m.group(2), 'year': int(m.group(1))}
        if f'page={page + 1}' not in s: break
        page += 1


cars = []
for fn in (fh5, fh6, nfs_heat, nfs_unbound, motorfest):
    got = list(fn())
    print(fn.__name__, len(got), got[:2])
    cars += got
json.dump(cars, open(os.path.join(OUT, 'game_cars.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
uniq = {(c['name'].lower(), c['year']) for c in cars}
print('total', len(cars), 'unique name+year', len(uniq))
