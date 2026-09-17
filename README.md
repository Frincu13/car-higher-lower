# Jocuri cu mașini

`index.html` e pagina de start, de unde alegi unul din cele trei jocuri.

`sus-sau-jos.html` (**Sus sau jos**): joc higher/lower cu mașini. Categorii: cai putere, greutate, 0-100 km/h, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi). `mai-mult.html` doar redirecționează aici (numele vechi).

A doua pagină, `draft.html` (**Mașina perfectă**): 2 jucători pe același dispozitiv. La fiecare rundă apar 2 mașini; cine e la rând ia una și o pune într-unul din cele 8 sloturi (putere, cuplu, greutate, viteză, accelerație, manevrabilitate, frânare, off-road), celălalt primește mașina rămasă. Nota unei mașini într-un slot e pe o scară fixă 0-10, independentă de lista de mașini (putere/cuplu/greutate pe scară logaritmică, off-road pe intervale după tipul mașinii: supercar 0-2, sport 1,5-3,5, berline 3-4,5, SUV de oraș 5,5-7, raliu 5-8, 4x4 7,5-9,5, off-road extrem 9-10); nota finală e media. Putere, cuplu și greutate sunt cifre reale; restul sunt notele din Forza Horizon 5 (nu se afișează în joc, doar nota calculată).

A treia pagină, `turometru.html` (**Turometrul**): joc de grup cooperativ, pe un singur telefon. La fiecare rundă apare o axă (de ex. „Mașină de bunic ↔ Mașină de interlop”); cine e la rând primește 4 mașini aleatorii (poate cere alte 4 o singură dată), alege una și pune acul pe turometru. Ceilalți ghicesc poziția; echipa ia 4/3/2/0 puncte după distanță. Axele sunt în `AXES` din `turometru.js`; fiecare axă poate avea un `pool` (ce mașini pot apărea pe ea, după tip și an: `segOf` le împarte în road, sport, super, hyper, rally, suv, offroad, van) și un `mix` (cel puțin 2 din cele 4 mașini vin din grupul ăsta). Cele 4 mașini sunt alese cât mai diferite ca tip și marcă.

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
python scripts/fetch_divisions.py # tipul fiecărei mașini (supercar, SUV...) -> data-src/lists/divisions.json
python scripts/build.py           # -> data/cars.js + data/cars.json
python scripts/fetch_images.py    # poze Commons -> data-src/lists/images.json
python scripts/build.py           # din nou, ca să includă pozele
```

Reguli importante din `build.py`:
- Mașinile construite special pentru jocuri (Forza Edition, Hoonigan, Formula Drift, Hot Wheels etc.) sunt scoase: cifrele lor nu sunt ale unei mașini reale.
- 0-100 și viteza maximă din autoevolution se folosesc doar dacă puterea de acolo e la max. 7% de cea din Forza, altfel e altă versiune.
- O mașină iese dintr-o categorie dacă numele sau motorizarea afișate conțin deja răspunsul (McLaren 720S la putere).
- `data/cars.js` e generat, nu îl edita de mână.

Pe site ajung doar mașinile cu poză. O mașină apare într-o categorie doar dacă are valoare pentru ea. 0-100 și viteza maximă au mai puține mașini decât putere, cuplu și greutate.

Pozele de pe pagina de start (`img/hub-*`) sunt fotografii de pe Wikimedia Commons, CC BY-SA 4.0, decupate la 16:9; autorul e trecut sub fiecare.
