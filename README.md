# Jocuri cu mașini

`index.html` e pagina de start, de unde alegi unul din cele șapte jocuri (carusel orizontal).

`sus-sau-jos.html` (**Sus sau jos**): joc higher/lower cu mașini. Categorii: cai putere, greutate, 0-100 km/h, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi). `mai-mult.html` doar redirecționează aici (numele vechi).

A doua pagină, `draft.html` (**Mașina perfectă**): 2 jucători pe același dispozitiv. La fiecare rundă apar 2 mașini; cine e la rând ia una și o pune într-unul din cele 8 sloturi (putere, cuplu, greutate, viteză, accelerație, manevrabilitate, frânare, off-road), celălalt primește mașina rămasă. Nota unei mașini într-un slot e pe o scară fixă 0-10, independentă de lista de mașini: putere, cuplu și greutate pe scară logaritmică din cifrele reale (greutate: 800 kg = 10, 3.000 kg = 0), accelerația din timpul real 0-100 (2,3 s = 10, 12 s = 0), viteza maximă din km/h (80 = 0, 420 = 10). Viteza maximă, manevrabilitatea, frânarea și off-road-ul sunt puse de mână pentru fiecare mașină în `scripts/grades.csv` (se poate edita; `build.py` le preia). Nota finală e media.

A treia pagină, `turometru.html` (**Turometrul**): joc de grup cooperativ, pe un singur telefon. La fiecare rundă apare o axă (de ex. „Mașină de bunic ↔ Mașină de interlop”); cine e la rând primește 4 mașini aleatorii (poate cere alte 4 o singură dată), alege una și pune acul pe turometru. Ceilalți ghicesc poziția; echipa ia 4/3/2/0 puncte după distanță. Axele sunt în `AXES` din `turometru.js`; fiecare axă poate avea un `pool` (ce mașini pot apărea pe ea, după tip și an: `segOf` le împarte în road, sport, super, hyper, rally, suv, offroad, van) și un `mix` (cel puțin 2 din cele 4 mașini vin din grupul ăsta). Cele 4 mașini sunt alese cât mai diferite ca tip și marcă.

A patra pagină, `ordine.html` (**În ordine**): un clasament care crește. Mașina nouă se pune în locul ei derulând lista pe sub o linie fixă; după cai putere, greutate sau 0-100. Singur (record) sau 1 la 1 pe același telefon (cine greșește pierde).

A cincea pagină, `garaj.html` (**Garaj sau presă**): trei mașini, fiecare primește exact una dintre Garaj, Vânzare, Presă. Teme după tipul mașinii; la final se poate distribui o imagine cu alegerile.

A șasea pagină, `licitatie.html` (**Licitația**): doi jucători pe același telefon, 10 mil. fiecare, 12 mașini (câte una din fiecare tip plus 4 la întâmplare) licitate pe rând cu +250k / +500k / +1 mil., 5 secunde de privit mașina și 10 secunde pe tură. Dacă nimeni nu vrea o mașină, iese din joc; când rămân exact câte mai trebuie, se vând toate (fără ofertă, o ia cine are mai puține). Fiecare ia 4 mașini, le așază pe ascuns pe 4 categorii (2 anunțate înainte, 2 trase după); categoria câștigată aduce 5 mil. Câștigă cine are mai mulți bani la final. Notele pe categorii vin din `grades.js`, comun cu Mașina perfectă.

A șaptea pagină, `samsar.html` (**Cel mai bun samsar**): două echipe de samsari și un agent AI ca arbitru. Site-ul nu evaluează nimic; împarte runda, scrie instrucțiunea pentru agent și desenează verdictul primit înapoi.

Alegi mărimea echipelor (de la 1 la 1 până la 4 la 4) și câte tururi se joacă. În fiecare rundă se bat doi oameni, câte unul din fiecare echipă, pe locul lor din listă. Fiecare **cumpără** o mașină de pe un anunț real și **cere** un preț de la client. Clientul ia o singură mașină, pe cea cu nota mai mare, la prețul cerut, iar diferența față de cât a dat samsarul pe ea intră în buzunarul echipei. Celălalt rămâne cu mașina în curte și nu ia nimic. La final câștigă echipa cu mai mulți bani.

Miza e în prețul cerut: price fit se socotește pe el, nu pe prețul din anunț. Ceri mult, câștigi mult dacă iei clientul, dar scazi nota și riști să pleci cu zero.

Runda are mereu un client. Alegi doar categoria, adică ce fel de client vrei (12 categorii: supercar, sport accesibil, SUV de familie, prima mașină, clasică, electrică, break și utilitare, off-road, mașină de oraș, mașina de zi cu zi, business, mașina de 1.000 €, plus mix), dai Start, și abia atunci se vede cine a ieșit.

Sunt 38 de clienți în `data/samsar.js`, fiecare cu bugetul lui și cele șase criterii ale lui în ordinea importanței. Fiecare are și o poveste de patru sau cinci fraze, între 70 și 105 cuvinte, nu o fișă cu liniuțe: din ea trebuie să înțelegi dintr-o citire ce mașină să îi aduci, iar criteriile din dreapta sunt regulile, povestea e motivul lor. Poveștile au lungimi diferite, deci cardul își micșorează singur textul până intră în ecran, măsurat, nu ghicit, din jumătate în jumătate de pixel.

Mai sunt două surprize, adică al șaptelea și al optulea criteriu, pe care nu le vezi. Se trag dintr-un pachet de 40, dar nu din tot pachetul: fiecare surpriză știe la ce fel de client are sens, deci la un ghid montan pot pica blocare de diferențial sau tracțiune integrală, nu trapă panoramică la o mașină de oraș. Le poți mirosi după tipul clientului, dar nu le poți ști, fiindcă fiecare categorie are între șapte și douăzeci și șapte. Nu apar nicăieri pe ecran, nici în instrucțiunea afișată, unde sunt acoperite cu buline, dar intră în clar în textul copiat, fiindcă agentul are nevoie de ele. Se dezvăluie la final. Categoria mix trage din tot pachetul și mai poate adăuga o regulă care taie din ce ai voie să aduci.

Fiecare surpriză trebuie să se poată verifica într-un anunț: ori e câmp din tabel (tracțiune, cutie, capacitate, consum, caroserie, locuri, normă, kilometraj, proprietari), ori e bifă din lista de dotări (cameră, trapă, cârlig, piele, climatronic, pilot adaptiv, head-up, blocare de diferențial), ori e o declarație standard (fără accident, nefumător, carte de service, garanție). Nimic din ce se scrie doar în text liber, gen distribuție schimbată sau a doua cheie, pentru că atunci agentul ar ghici în loc să citească.

Fiecare criteriu din `CRIT` are două texte. O **scală** cu trepte, ce înseamnă un 10, un 5 și un 1, care intră în instrucțiune ca agentul să dea același 8 de fiecare dată. Și o **explicație** în cuvinte, care apare pe ecran: un buton lângă lista de criterii, sau o apăsare pe listă, deschide un panou cu toate șase plus price fit și un rând despre surprize. Jucătorul nu are nevoie de trepte, are nevoie să știe ce se judecă, deci acolo nu apare nicio cifră.

Instrucțiunea îi dă agentului și linia dintre deducție și presupunere: **identitatea mașinii se deduce, dotarea se citește.** Ce scrie în anunț e acolo; ce nu scrie dar reiese sigur din versiunea din titlu (xDrive, quattro, 4Motion, Touring, DSG) e tot acolo; ce nu scrie și e doar o opțiune pe care modelul o putea avea primește notă mică, iar agentul spune în motiv că anunțul nu o menționează. Nu i se cere să caute ce echipări existau la modelul ăla.

Instrucțiunea compusă de site dă fiecărui criteriu o scală explicită (ce înseamnă 10, 5 și 1), cere agentului să extragă întâi faptele din anunț și să motiveze fiecare notă cu ceva concret, și interzice egalitatea la total. Cere JSON cu chei fixe; dacă agentul dă totuși tabelul, un parser tolerant îl citește potrivind rândurile după etichetă. Agentul dă doar notele: banii îi socotește site-ul, deci nu are ce inventa acolo.

Verdictul arată două note: **nota simplă**, media tuturor rândurilor, și **nota clientului**, care scoate price fit din medie și cântărește criteriile după locul lor în top (1,5 la primul, 0,8 la ultimul; surprizele cu 1). Nota clientului decide cine ia afacerea. Ecranul are trei file, tranzacții, tabel și meci, ca să nu fie nevoie de derulare. O rundă se rulează o dată: după ce ai lipit un rezultat, urmează runda următoare. Textele clienților stau în ambele limbi în `data/samsar.js`, iar instrucțiunea pentru agent se scrie în limba aleasă.

Tipul fiecărei mașini (Supercar, SUV & off-road, Clasică...) se calculează în `kinds.js`, folosit de Turometrul și Garaj sau presă. `shared.js` are și `haptic()`: vibrație pe Android și, pe iPhone (iOS 18+), trucul cu un comutator nativ ascuns.

Lista de mașini (~770) e aleasă de mână: mașini de performanță de la mărci premium (BMW M, AMG, Audi RS, Porsche...), versiunile sport ale mărcilor obișnuite (Golf GTI/R, Octavia RS, Mégane R.S....), supercar și hypercar, SUV-uri și off-road serioase, legende japoneze, clasice iconice și mașini de raliu. Pornește de la mașinile din Forza Horizon 5/6, NFS Heat/Unbound și The Crew Motorfest (`scripts/keep.csv` spune care rămân) plus mașini adăugate din arhiva autoevolution (`scripts/extra_cars.csv`).

Fără build și fără backend: HTML, CSS și JS simplu. Live: https://frincu13.github.io/car-higher-lower/

## Poze

Pozele mașinilor din jocuri vin de pe Wikimedia Commons, cu credit pe card (licențele CC
o cer). Pozele de prezentare ale jocurilor (cardurile din meniu și imaginile de
previzualizare pentru linkuri) vin de pe Unsplash, unde licența permite folosirea liberă;
toate trec prin aceeași calibrare de culoare din `scripts`-ul de artwork: negruri adânci,
saturație puțin scăzută, umbre reci, lumini calde, vinietă și granulație fină.

## Runde, recorduri și viitorul clasament

`scores.js` ține forma unei runde terminate, ca să se poată adăuga un clasament fără să
se mai umble prin jocuri. O rundă arată așa:

```
{ v, game, board, mode, cat, timed, seconds, seed, score, timeMs, turns, startedAt, endedAt }
```

- `board` e singurul lucru după care se compară rundele: `joc:categorie:ceas`, de exemplu
  `sus-sau-jos:hp:t10` sau `ordine:weight:free`. Rundele cu ceas nu se amestecă niciodată
  cu cele fără, iar duratele ceasului sunt constante în cod (10, 15 și 20 de secunde),
  tocmai ca un clasament să aibă sens.
- `timeMs` e timpul de gândire, măsurat cu `performance.now()` și adunat tură cu tură.
  Nu curge cât rulează animațiile de dezvăluire. Se afișează la sutime (`Scores.time`).
- Ieșitul din pagină: la rundele cu cronometru timpul curge mai departe cât ești plecat,
  altfel schimbatul de filă ar fi o metodă de a câștiga timp de gândire. La rundele fără
  cronometru se oprește, că oricum nu se compară nimic. În ambele cazuri runda reține
  `hiddenMs` și `awayCount`, deci un clasament poate refuza sau marca rundele cu pauze.
- Departajarea la scor egal: timpul mai mic câștigă. Regula stă într-un singur loc,
  `Scores.better`, folosit și pentru recordul local.
- `seed` e pus doar la provocarea zilei, unde toată lumea primește aceeași succesiune.

Recordurile locale stau în `localStorage` sub `frq_best_<board>`. Vechile recorduri, care
erau doar un număr, se mută automat la prima rulare (`Scores.migrate`).

Când adăugăm clasamentul, singurul loc de atins e `Scores.submit`: dacă există
`window.Leaderboard.submit(run)`, runda pleacă acolo. Jocurile nu știu nimic despre rețea.
De reținut înainte: scorurile venite din browser nu sunt de încredere, deci un clasament
public are nevoie fie de runde cu `seed` pe care serverul le poate reface, fie de validări
pe server. Iar `v` se mărește când se schimbă regulile, ceasul sau lista de mașini, ca
rundele vechi să nu se amestece cu cele noi.

## Cronometru

Sus sau jos, Mașina perfectă și În ordine au, opțional, un cronometru pe tură, ales pe
ecranul de start și ținut minte în `localStorage`. Ceasul e comun (`makeTimer` din
`shared.js`): o bară care se golește sub bara de sus, secundele în dreapta, vibrație în
ultimele trei secunde, pauză când fila e ascunsă. Când timpul expiră: la Sus sau jos și
la În ordine se numără ca greșeală, iar la Mașina perfectă mașina intră singură într-un
slot liber. Recordurile pe cronometru se țin separat de cele fără.

## Limbă

Româna e limba sursă: textele stau scrise în română în pagini și în cod. `i18n.js` ține
versiunea engleză a fiecărui text, traduce pagina după ce se încarcă și urmărește cu un
MutationObserver tot ce desenează jocurile după aceea, deci codul jocurilor nu are nevoie
de apeluri de traducere. Comutatorul RO / EN apare în bara de sus, doar pe ecranele de
start, iar alegerea se ține în `localStorage` (`frq_lang`). Numerele urmează limba:
`fmt()` folosește `ro-RO` sau `en-GB`.

Texte noi: le scrii în română și adaugi traducerea în `EN` din `i18n.js`. Pentru textele
cu numere sau nume în ele sunt reguli cu expresii regulate în `RX`. Ce nu are traducere
rămâne în română și e strâns în `I18n.missing`, de verificat în consolă.

## Aplicație și partajare

`manifest.webmanifest` plus `sw.js` fac site-ul instalabil: pornește pe tot ecranul, cu
iconiță proprie, iar jocurile merg și fără net (pozele mașinilor se păstrează într-un
cache separat, maximum 300). Paginile se iau întâi din rețea, ca o versiune nouă să apară
imediat. Fiecare pagină are `og:image` (1200x630, generate din pozele de meniu), deci
linkul arată ca un card cu poză când e trimis pe WhatsApp sau oriunde altundeva.

Vibrațiile merg pe Android. Pe iPhone, Safari nu are Vibration API, deci acolo nu vibrează.

## Un ecran, fără scroll

Pe telefon nimic nu se derulează. Ecranele de joc încăpeau deja, ecranele de pregătire nu:
la 568 de pixeli înălțime butonul de start ajungea cu trei sute de pixeli sub marginea de
jos, ceea ce face un meniu să pară neterminat. Sub 860 de pixeli lățime, `#screen-start` și
`#screen-setup` devin coloane cât fereastra (`100dvh`, `overflow: hidden`): titlurile și
textele se strâng pe `vh` cu `clamp()`, lista de jucători sau de categorii ia locul rămas,
iar rândul de butoane stă jos, lipit cu `margin-top: auto`, unde îl caută degetul.

Ce nu are loc se mută, nu se micșorează la nesimțire. Regulile pas cu pas nu mai stau pe
ecranul de pregătire, ci într-un panou "Cum se joacă" deschis de un buton, legat o singură
dată din `shared.js` (`wireHow`) pentru orice pagină care are `#how`. Sub 640 de pixeli
înălțime dispare și fraza de sub titlu. La Cel mai bun samsar, unde povestea clientului are
nevoie de tot spațiul, cele șase criterii devin o listă pe un rând sub 660 de pixeli, iar
textul poveștii se micșorează măsurat, din jumătate în jumătate de pixel, până intră.

Pe lat toate jocurile ar ieși înghesuite, fiindcă sunt gândite pe înalt: meniul e un carusel
de carduri înalte, În ordine e o scară verticală, Licitația are două tabele una sub alta. Sub
520 de pixeli înălțime, în peisaj, apare un panou care cere întoarcerea telefonului
(`wireRotate` din `shared.js`). Pragul e pe înălțime, deci tabletele nu sunt atinse.

## Fonturi, tastatură, mișcare

Fonturile stau la noi, în `fonts/`. Înainte veneau de la Google: un CSS care bloca
randarea, plus patru fișiere de la două origini străine, o sută de kiloocteți, trei
handshake-uri în plus și, offline, niciun font. Acum sunt două fișiere woff2 de 64 de
kiloocteți, tăiate pe alfabetul de care avem nevoie, latin, latin extins și virgulele
românești, cu `preload` în fiecare pagină. Archivo e varianta variabilă, deci 400, 500,
600 și 700 ies dintr-un singur fișier. Dacă adaugi un caracter nou, de exemplu un alfabet
străin, trebuie regenerat subsetul cu `fonttools`: `python scripts/build_fonts.py` ia
sursele de la Google Fonts, le taie și le scrie la loc. Archivo și Archivo Black sunt
sub licența Open Font, deci textul licenței vine cu ele, în `fonts/OFL.txt`.

Panourile care se deschid peste ecran iau și tastatura, nu doar ecranul. `wirePanouri` din
`shared.js` urmărește atributul `hidden` pe orice `.overlay` și pune `inert` pe restul
paginii cât timp panoul e deschis: Tab nu mai pleacă pe sub el, la butoane pe care nu le
vezi, iar cititoarele de ecran nu mai citesc pagina de dedesubt. La închidere focusul se
întoarce de unde a plecat. Merge la fel pentru „Cum se joacă", pentru explicațiile de la
Cel mai bun samsar și pentru ecranul de final.

Cine cere `prefers-reduced-motion` primește o plasă generală: durata animațiilor scade la
zero, la fel întârzierile, iar repetările se opresc la una. Ultima parte contează: două
animații din Licitația sunt infinite, deci până acum pâlpâiau de mii de ori pe secundă
exact la oamenii care ceruseră să nu se miște nimic. Unde starea finală ar fi invizibilă,
de exemplu eticheta de categorie, există o variantă fără mișcare care rămâne pe ecran cât
să o citești.

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
