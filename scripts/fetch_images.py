"""Find a freely licensed photo on Wikimedia Commons for every car -> data-src/lists/images.json.

For each car: search Commons files for "<year> <name>", keep landscape photos whose
file name mentions the model (and ideally the year), skip interiors/engines/toys,
and store the 800px thumbnail URL plus author and license for attribution.
Resumable: already-resolved cars are skipped.
"""
import html, json, os, re, sys, threading, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

LISTS = os.path.join(os.path.dirname(__file__), '..', 'data-src', 'lists')
OUT = os.path.join(LISTS, 'images.json')
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'car-higher-lower/0.1 (https://github.com/Frincu13/car-higher-lower; quiz game image lookup)'}

BAD = re.compile(r'\b(interior|cockpit|dashboard|engine bay|badge|emblem|logo|steering wheel|wheels?|detail|toys?|'
                 r'model car|scale model|diecast|die-cast|lego|hot wheels|forza|gran turismo|need for speed|'
                 r'screenshot|render|drawing|sketch|brochure|poster|advert|stamp|crash|wreck|burnt|taillights?|'
                 r'tail light|headlights?|head light|grille|trunk|door handle|mirror|exhaust|tyres?|tires?|rims?|'
                 r'keys?|license plate|engine|fujimi|tamiya|revell|minichamps|bburago|maisto)\b|\.(svg|gif|tiff?)$', re.I)
STOP = {'the', 'edition', 'coupe', 'coupé', 'sedan', 'de', 'and'}


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(f'{API}?{q}', headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:  # 429 / transient
            time.sleep(5 * (attempt + 1))
    return {}


def strip_html(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s or ''))).strip()


def words(s):
    return [w for w in re.split(r'[^a-z0-9]+', s.lower().replace('é', 'e').replace('ë', 'e')) if w]


# Photos checked by hand and found wrong (another generation, interior, race car...).
REJECT_PATH = os.path.join(LISTS, 'images.reject.json')
REJECT = json.load(open(REJECT_PATH, encoding='utf-8')) if os.path.exists(REJECT_PATH) else {}


def best_image(name, year):
    rejected = set(REJECT.get(f'{name}|{year}', []))
    toks = [w for w in words(name) if w not in STOP]
    brand, model_toks = toks[0], toks[1:] or toks
    cands = []
    for query in (f'{year} {name}', name):
        d = api({'action': 'query', 'generator': 'search', 'gsrnamespace': 6, 'gsrsearch': f'{query} filetype:bitmap',
                 'gsrlimit': 20, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 800})
        time.sleep(0.3)
        for p in d.get('query', {}).get('pages', []):
            title = p['title']
            info = (p.get('imageinfo') or [{}])[0]
            if not info or BAD.search(title) or title in rejected: continue
            if info.get('width', 0) < 800 or info['width'] < info.get('height', 0) * 1.15: continue
            tw = set(words(title))
            if brand not in tw and brand not in title.lower(): continue
            hit = sum(1 for t in model_toks if t in tw)
            if hit < max(1, len(model_toks) - 1): continue  # allow one missing word ("Coupé", trim suffix)
            # Numbers identify the model (RS 4 vs RS Q3, RX-3 vs RX-4): never allow them missing.
            # Compare longer ones on the squashed title so "LP 700-4" still matches "LP700-4";
            # short ones ("4") must be a whole word, or any photo ID like "1X7A1874" would match.
            flat = ''.join(words(title))
            if any(re.search(r'\d', t) and t not in tw and (len(t) < 3 or t not in flat) for t in model_toks): continue
            years = [int(y) for y in re.findall(r'(?<!\d)(19\d{2}|20\d{2})(?!\d)', title)]
            ygap = min((abs(y - year) for y in years), default=None)
            # Any year far from the car's means another generation, or an event year
            # next to an old car ("Retromobile 2017 - Alpine A110 - 1969").
            if any(abs(y - year) > 4 for y in years): continue
            meta = info.get('extmetadata', {})
            lic = strip_html(meta.get('LicenseShortName', {}).get('value'))
            if not lic or 'fair use' in lic.lower() or 'non-free' in lic.lower(): continue
            score = hit * 2 + (3 if ygap == 0 else 2 if ygap is not None and ygap <= 2 else 0) - len(tw - set(toks)) * 0.1
            cands.append((score, {
                'thumb': (info.get('thumburl') or info['url']).split('?')[0], 'page': info.get('descriptionurl'),
                'file': title, 'credit': strip_html(meta.get('Artist', {}).get('value'))[:120] or 'Wikimedia Commons',
                'license': lic,
            }))
        if cands: break
    return max(cands, key=lambda c: c[0])[1] if cands else None


def main():
    # The full roster written by build.py (cars.json only has the ones that already have a photo).
    cand = os.path.join(LISTS, 'candidates.json')
    cars = json.load(open(cand if os.path.exists(cand) else os.path.join(os.path.dirname(__file__), '..', 'data', 'cars.json'), encoding='utf-8'))
    done = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    misses = set(json.load(open(OUT + '.miss', encoding='utf-8'))) if os.path.exists(OUT + '.miss') else set()
    todo = [c for c in cars if f"{c['name']}|{c['years']}" not in done and f"{c['name']}|{c['years']}" not in misses]
    # Entries found before the event-year rule existed get re-checked.
    for k in [k for k, v in done.items()
              if any(abs(int(y) - int(k.split('|')[1])) > 4 for y in re.findall(r'(?<!\d)(19\d{2}|20\d{2})(?!\d)', v['file']))]:
        del done[k]
    todo = [c for c in cars if f"{c['name']}|{c['years']}" not in done and f"{c['name']}|{c['years']}" not in misses]
    print('todo', len(todo), 'done', len(done), flush=True)
    lock = threading.Lock()
    count = [0]

    def work(c):
        key = f"{c['name']}|{c['years']}"
        img = best_image(c['name'], int(c['years']))
        with lock:
            if img: done[key] = img
            else: misses.add(key)
            count[0] += 1
            if count[0] % 25 == 0 or count[0] == len(todo):
                json.dump(done, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                json.dump(sorted(misses), open(OUT + '.miss', 'w', encoding='utf-8'), ensure_ascii=False)
                print(f'{count[0]}/{len(todo)} found={len(done)} miss={len(misses)}', flush=True)

    # A few parallel requests is within Wikimedia's API etiquette for a one-off batch.
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(work, todo))


if __name__ == '__main__':
    main()
