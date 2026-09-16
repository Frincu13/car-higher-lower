# Mai mult sau mai puțin

Joc higher/lower cu mașini. Categorii: putere (CP), cuplu (Nm), 0-100 km/h, viteză maximă, greutate, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi).

Fără build și fără backend: HTML, CSS și JS simplu.

## Rulare

Deschide `index.html` direct în browser sau pornește un server static:

```bash
npx serve -p 3470 .
```

Taste: săgeată sus / jos pentru răspuns, Esc pentru meniu.

## Date

Sursa: [ilyasozkurt/automobile-models-and-specs](https://github.com/ilyasozkurt/automobile-models-and-specs) (preluat de pe autoevolution.com, octombrie 2024). Repo-ul nu are licență, așa că pentru lansare publică merită o sursă licențiată.

Pipeline:

```bash
git clone --depth 1 https://github.com/ilyasozkurt/automobile-models-and-specs.git data-src
cd data-src && unzip automobiles.json.zip -d raw && cd ..
python scripts/parse.py   # raw -> data-src/parsed.json (30.066 motorizări)
python scripts/build.py   # curated list -> data/cars.js + data/cars.json
```

- `scripts/curated.py`: lista de mașini din joc (nume afișat, marcă, regex model, an, regex motor). Aici adaugi sau scoți mașini.
- `scripts/build.py`: alege cea mai bună potrivire, ia puterea de sistem din numele motorului (hibride/EV), elimină valorile imposibile și aplică `OVERRIDES` pentru erori cunoscute din sursă.
- `data/cars.js` e generat, nu îl edita de mână.

O mașină apare într-o categorie doar dacă are valoare pentru ea (de exemplu Koenigsegg Jesko nu are 0-100 în sursă).

## Poze

Momentan sunt placeholder-e. Pentru poze reale adaugă câmpul `image` (URL) pe mașină, iar cardul îl folosește automat. Sursă recomandată: Wikimedia Commons, cu atribuire.
