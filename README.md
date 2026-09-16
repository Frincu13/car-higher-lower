# Jocuri cu mașini

`index.html` e pagina de start, de unde alegi unul din cele două jocuri.

`mai-mult.html` (**Mai mult sau mai puțin**): joc higher/lower cu mașini. Categorii: putere (CP), cuplu (Nm), 0-100 km/h, viteză maximă, greutate, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi).

A doua pagină, `draft.html` (**Mașina perfectă**): 2 jucători pe același dispozitiv. La fiecare rundă apar 2 mașini; cine e la rând ia una și o pune într-unul din cele 8 sloturi (putere, cuplu, lejeritate, viteză, accelerație, manevrabilitate, frânare, off-road), celălalt primește mașina rămasă. Punctele unei mașini = procentul de mașini pe care le bate în slotul ei; nota finală e media, din 10. Putere, cuplu și greutate sunt cifre reale; restul sunt notele din Forza Horizon 5.

Lista de mașini = mașinile din Forza Horizon 5, Forza Horizon 6, Need for Speed Heat, Need for Speed Unbound și The Crew Motorfest.

Fără build și fără backend: HTML, CSS și JS simplu. Live: https://frincu13.github.io/car-higher-lower/

## Rulare

Deschide `index.html` direct în browser sau pornește un server static:

```bash
npx serve -p 3470 .
```

Taste: săgeată sus / jos pentru răspuns, Esc pentru meniu.

## Date

| Ce | Sursă |
| --- | --- |
| Liste de mașini | Forza Wiki (FH5), forza.net (FH6), NFS Wiki (Heat, Unbound), IGCD (Motorfest) |
| Putere, cuplu, greutate | Forza Wiki, caseta fiecărei mașini (cifrele de fabrică pe care le folosește Forza) |
| 0-100, viteză maximă, specs pentru mașinile fără pagină Forza | [automobile-models-and-specs](https://github.com/ilyasozkurt/automobile-models-and-specs) (autoevolution.com, oct. 2024) |
| Poze | Wikimedia Commons, cu autor și licență pe fiecare poză |

Pipeline (datele brute stau în `data-src/`, ignorat de git):

```bash
git clone --depth 1 https://github.com/ilyasozkurt/automobile-models-and-specs.git data-src
cd data-src && unzip automobiles.json.zip -d raw && cd ..
python scripts/parse.py           # autoevolution -> data-src/parsed.json
python scripts/collect_games.py   # listele din jocuri -> data-src/lists/game_cars.json
python scripts/fetch_forza.py     # specs Forza Wiki -> data-src/lists/forza_specs.json
python scripts/match_games.py     # mașină din joc -> înregistrare autoevolution (strict)
python scripts/build.py           # -> data/cars.js + data/cars.json
python scripts/fetch_images.py    # poze Commons -> data-src/lists/images.json
python scripts/build.py           # din nou, ca să includă pozele
```

Reguli importante din `build.py`:
- Mașinile construite special pentru jocuri (Forza Edition, Hoonigan, Formula Drift, Hot Wheels etc.) sunt scoase: cifrele lor nu sunt ale unei mașini reale.
- 0-100 și viteza maximă din autoevolution se folosesc doar dacă puterea de acolo e la max. 7% de cea din Forza, altfel e altă versiune.
- O mașină iese dintr-o categorie dacă numele sau motorizarea afișate conțin deja răspunsul (McLaren 720S la putere).
- `data/cars.js` e generat, nu îl edita de mână.

O mașină apare într-o categorie doar dacă are valoare pentru ea. 0-100 și viteza maximă au mai puține mașini decât putere, cuplu și greutate.
