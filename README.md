# Jocuri cu mașini

`index.html` e pagina de start, de unde alegi unul din cele cinci jocuri (carusel orizontal).

`sus-sau-jos.html` (**Sus sau jos**): joc higher/lower cu mașini. Categorii: cai putere, greutate, 0-100 km/h, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi). `mai-mult.html` doar redirecționează aici (numele vechi).

A doua pagină, `draft.html` (**Mașina perfectă**): 2 jucători pe același dispozitiv. La fiecare rundă apar 2 mașini; cine e la rând ia una și o pune într-unul din cele 8 sloturi (putere, cuplu, greutate, viteză, accelerație, manevrabilitate, frânare, off-road), celălalt primește mașina rămasă. Nota unei mașini într-un slot e pe o scară fixă 0-10, independentă de lista de mașini: putere, cuplu și greutate pe scară logaritmică din cifrele reale (greutate: 800 kg = 10, 3.000 kg = 0), accelerația din timpul real 0-100 (2,3 s = 10, 12 s = 0), viteza maximă din km/h (80 = 0, 420 = 10). Viteza maximă, manevrabilitatea, frânarea și off-road-ul sunt puse de mână pentru fiecare mașină în `scripts/grades.csv` (se poate edita; `build.py` le preia). Nota finală e media.

A treia pagină, `turometru.html` (**Turometrul**): joc de grup cooperativ, pe un singur telefon. La fiecare rundă apare o axă (de ex. „Mașină de bunic ↔ Mașină de interlop”); cine e la rând primește 4 mașini aleatorii (poate cere alte 4 o singură dată), alege una și pune acul pe turometru. Ceilalți ghicesc poziția; echipa ia 4/3/2/0 puncte după distanță. Axele sunt în `AXES` din `turometru.js`; fiecare axă poate avea un `pool` (ce mașini pot apărea pe ea, după tip și an: `segOf` le împarte în road, sport, super, hyper, rally, suv, offroad, van) și un `mix` (cel puțin 2 din cele 4 mașini vin din grupul ăsta). Cele 4 mașini sunt alese cât mai diferite ca tip și marcă.

A patra pagină, `ordine.html` (**În ordine**): un clasament care crește. Mașina nouă se pune în locul ei derulând lista pe sub o linie fixă; după cai putere, greutate sau 0-100. Singur (record) sau 1 la 1 pe același telefon (cine greșește pierde).

A cincea pagină, `garaj.html` (**Garaj sau presă**): trei mașini, fiecare primește exact una dintre Garaj, Vânzare, Presă. Teme după tipul mașinii; la final se poate distribui o imagine cu alegerile.

A șasea pagină, `licitatie.html` (**Licitația**): doi jucători pe același telefon, 10 mil. fiecare, 12 mașini (câte una din fiecare tip plus 4 la întâmplare) licitate pe rând cu +250k / +500k / +1 mil., 5 secunde de privit mașina și 10 secunde pe tură. Dacă nimeni nu vrea o mașină, iese din joc; când rămân exact câte mai trebuie, se vând toate (fără ofertă, o ia cine are mai puține). Fiecare ia 4 mașini, le așază pe ascuns pe 4 categorii (2 anunțate înainte, 2 trase după); categoria câștigată aduce 5 mil. Câștigă cine are mai mulți bani la final. Notele pe categorii vin din `grades.js`, comun cu Mașina perfectă.

Tipul fiecărei mașini (Supercar, SUV & off-road, Clasică...) se calculează în `kinds.js`, folosit de Turometrul și Garaj sau presă. `shared.js` are și `haptic()`: vibrație pe Android și, pe iPhone (iOS 18+), trucul cu un comutator nativ ascuns.

Lista de mașini (~770) e aleasă de mână: mașini de performanță de la mărci premium (BMW M, AMG, Audi RS, Porsche...), versiunile sport ale mărcilor obișnuite (Golf GTI/R, Octavia RS, Mégane R.S....), supercar și hypercar, SUV-uri și off-road serioase, legende japoneze, clasice iconice și mașini de raliu. Pornește de la mașinile din Forza Horizon 5/6, NFS Heat/Unbound și The Crew Motorfest (`scripts/keep.csv` spune care rămân) plus mașini adăugate din arhiva autoevolution (`scripts/extra_cars.csv`).

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
python scripts/fetch_divisions.py # tipul fiecărei mașini (supercar, SUV...) -> data-src/lists/divisions.json
python scripts/match_extra.py     # mașinile din extra_cars.csv -> înregistrări autoevolution
python scripts/build.py           # -> data/cars.js + data/cars.json
python scripts/fetch_images.py    # poze Commons -> data-src/lists/images.json (pozele greșite se trec în images.reject.json)
python scripts/build.py           # din nou, ca să includă pozele
```

Reguli importante din `build.py`:
- Mașinile construite special pentru jocuri (Forza Edition, Hoonigan, Formula Drift, Hot Wheels etc.) sunt scoase: cifrele lor nu sunt ale unei mașini reale.
- 0-100 și viteza maximă din autoevolution se folosesc doar dacă puterea de acolo e la max. 7% de cea din Forza, altfel e altă versiune.
- O mașină iese dintr-o categorie dacă numele sau motorizarea afișate conțin deja răspunsul (McLaren 720S la putere).
- `data/cars.js` e generat, nu îl edita de mână.

Pe site ajung doar mașinile cu poză. O mașină apare într-o categorie doar dacă are valoare pentru ea. 0-100 și viteza maximă au mai puține mașini decât putere, cuplu și greutate.

Pozele de pe pagina de start (`img/hub-*`) sunt fotografii de pe Wikimedia Commons (CC BY-SA), decupate la 16:9; autorul și licența sunt trecute sub fiecare.
