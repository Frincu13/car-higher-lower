# Jocuri cu mașini

`index.html` e pagina de start, de unde alegi unul din cele șapte jocuri (carusel orizontal).

`sus-sau-jos.html` (**Sus sau jos**): joc higher/lower cu mașini. Categorii: cai putere, greutate, 0-100 km/h, plus modul Mixt și Provocarea zilei (aceleași mașini pentru toată lumea, în aceeași zi). `mai-mult.html` doar redirecționează aici (numele vechi).

A doua pagină, `draft.html` (**Mașina perfectă**): 2 jucători pe același dispozitiv. La fiecare rundă apar 2 mașini; cine e la rând ia una și o pune într-unul din cele 8 sloturi (putere, cuplu, greutate, viteză, accelerație, manevrabilitate, frânare, off-road), celălalt primește mașina rămasă. Nota unei mașini într-un slot e pe o scară fixă 0-10, independentă de lista de mașini: putere, cuplu și greutate pe scară logaritmică din cifrele reale (greutate: 800 kg = 10, 3.000 kg = 0), accelerația din timpul real 0-100 (2,3 s = 10, 12 s = 0), viteza maximă din km/h (80 = 0, 420 = 10). Viteza maximă, manevrabilitatea, frânarea și off-road-ul sunt puse de mână pentru fiecare mașină în `scripts/grades.csv` (se poate edita; `build.py` le preia). Nota finală e media.

A treia pagină, `turometru.html` (**Turometrul**): joc de grup cooperativ, pe un singur telefon. La fiecare rundă apare o axă (de ex. „Mașină de bunic ↔ Mașină de interlop”); cine e la rând primește 4 mașini aleatorii (poate cere alte 4 o singură dată), alege una și pune acul pe turometru. Ceilalți ghicesc poziția; echipa ia 4/3/2/0 puncte după distanță. Axele sunt în `AXES` din `turometru.js`; fiecare axă poate avea un `pool` (ce mașini pot apărea pe ea, după tip și an: `segOf` le împarte în road, sport, super, hyper, rally, suv, offroad, van) și un `mix` (cel puțin 2 din cele 4 mașini vin din grupul ăsta). Cele 4 mașini sunt alese cât mai diferite ca tip și marcă.

A patra pagină, `ordine.html` (**În ordine**): un clasament care crește. Mașina nouă se pune în locul ei derulând lista pe sub o linie fixă; după cai putere, greutate sau 0-100. Singur (record) sau 1 la 1 pe același telefon (cine greșește pierde).

A cincea pagină, `garaj.html` (**Garaj sau presă**): trei mașini, fiecare primește exact una dintre Garaj, Vânzare, Presă. Teme după tipul mașinii; la final se poate distribui o imagine cu alegerile.

A șasea pagină, `licitatie.html` (**Licitația**): doi jucători pe același telefon, 10 mil. fiecare, 12 mașini (câte una din fiecare tip plus 4 la întâmplare) licitate pe rând, 5 secunde de privit mașina și 10 secunde pe tură. Prima ofertă e chiar prețul de pornire, ca la o licitație adevărată: dacă se strigă 400 și ridici mâna, plătești 400. Pașii de +250k / +500k / +1 mil. apar abia peste o ofertă care există, deci cât timp nu a ofertat nimeni se vede un singur buton, cu prețul mașinii. Iar cât ridici tu, atât trebuie să ridice și el, cel puțin: fără regula asta pașii mari nu aveau niciun rost, fiindcă atunci când o rundă în plus nu costă nimic, pasul cel mai mic e mereu cel mai bun. Acum sunt trei viteze: mic înseamnă „ne batem ieftin și lung", mare înseamnă „termin acum, decide-te". Butoanele de sub ultima ridicare se sting, iar lângă ofertă scrie „minim +1 mil.". Fiecare mașină are prețul ei de pornire, între 400k și 1,2 mil. din 100k în 100k: se trag 4 categorii din 8, iar mașina ajunge la una singură, aia la care stă cel mai bine dintre cele trase, deci valoarea ei e nota așteptată la cea mai bună dintre cele patru care pot pica. Iese o medie ponderată 50% / 28,6% / 14,3% / 5,7% / 1,4% pe notele ei ordonate descrescător, adică jumătate din greutate pe vârf și restul pe ce are dedesubt; ponderile nu sunt alese, le dau regulile. Prețul rămâne mic dinadins: el spune cât face mașina în general, licitația spune cât face în partida asta. Dacă nimeni nu vrea o mașină, iese din joc; când rămân exact câte mai trebuie, se vând toate (fără ofertă, o ia cine are mai puține). Fiecare ia 4 mașini, le așază pe ascuns pe 4 categorii (2 anunțate înainte, 2 trase după); categoria câștigată aduce 5 mil. Licitezi cu banii pe care îi ai, nimic nu se blochează pentru mașinile care urmează: dacă ai dat tot și sala te obligă să iei ultima, intri pe minus, iar împrumutul apare ca linie separată la final. Datoria nu e o alegere, deci nu poți licita pe banii băncii. Câștigă cine are mai mulți bani la final, iar bilanțul se citește linie cu linie, cu totalul care urcă sau coboară pe loc. Imediat ce se închide sala, după ce se trag ultimele două categorii, apare un ecran cu loturile care nu au mai apucat să vină, fiecare cu categoria în care ar fi dat cel mai bine: licitația se oprește când amândoi au patru mașini, deci aproape mereu rămân mașini nescoase la ciocan, iar întrebarea o pui fix atunci, nu la final. Notele pe categorii vin din `grades.js`, comun cu Mașina perfectă.

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

A opta pagină, `drag.html` (**Startul**): drag race pe 402 m, doi jucători unul lângă altul, pe același telefon, văzut de amândoi din aceeași parte. Sus e pista, desenată în perspectivă din spatele liniei de start, cu câte o bandă pentru fiecare, repere la 100, 201 și 305 m și finișul în carouri; jos, fiecare are coloana lui (stânga roșul, dreapta albul) cu mașina, turometrul și un buton mare care își schimbă rostul pe parcurs. Amândoi apasă Gata, apoi se aprind cinci lumini roșii, una câte una, ca în Formula 1, și după o pauză pe care n-o poți ghici se sting toate: prima apăsare pe Start de după e plecarea, iar timpul de reacție se adună la cursă. O apăsare înainte de stingere e start fals și pierzi cursa. Apoi, la fiecare treaptă, acul urcă pe o bară: în verde (0,89-0,94) schimbarea e perfectă (+), aproape de verde e ok (0), prea devreme sau pe limitator e proastă (−), iar dacă nu apeși Schimbă, după o jumătate de secundă pe limitator cutia schimbă singură, cu nota proastă. Câștigă primul care ia trei curse.

Timpul de bază al fiecărei mașini e cel pe 402 m jucat „normal": media dintre formula clasică din putere și greutate și una din timpul de 0-100, care aduce tracțiunea pe care puterea singură n-o vede. Am verificat-o pe 14 mașini cu timpi măsurați în teste (Chiron 9,4 s, 911 GT3 11,6 s, M3 12,6 s) și ieșea constant cu 6,5% prea optimistă, de unde înmulțirea cu 1,065; eroarea medie rămasă e de o jumătate de secundă. Nota fiecărei schimbări dă ritmul treptei care urmează: totul perfect înseamnă ×0,88 din timpul de bază, totul prost ×1,32. Raportul de 1,5 dintre ele e cel cerut: o mașină de 15 s condusă perfect egalează una de 10 s condusă prost (13,2 s amândouă), dar un Chiron condus oricât de prost rămâne în fața celei mai lente mașini condusă perfect (11,4 s contra 16,3 s). 80% din mașini au între 9,8 și 13,8 s, deci de obicei contează mai mult mâna decât mașina. Nicio regulă inventată nu face mașina rapidă mai grea: are pur și simplu trepte mai scurte, deci acul trece mai iute prin verde. Numărul de schimbări vine din cutia mașinii, unde e trecută (trepte minus două, între trei și cinci), altfel patru. Mașinile electrice au o singură treaptă, deci deocamdată nu intră în joc; datele nu spun mereu că sunt electrice, așa că o listă scurtă le prinde și pe cele scăpate. Simularea merge pe timpul real, iar fiecare apăsare se evaluează la ora exactă a evenimentului, nu la cadrul următor, deci un telefon care desenează mai rar nu dezavantajează pe nimeni. Pe pistă, mașinile sunt machete văzute din spate, desenate în `machete.js`: unsprezece siluete după tipul mașinii (supercar, hypercar cu aripă, sport, hatchback, lux, SUV, de teren cu roata de rezervă pe ușă, pickup, americană cu dungi, clasică, sportivă clasică), toate în culoarea jucătorului, cu o flacără scurtă din evacuare la fiecare schimbare. Mașinile se trag acum la întâmplare; logica de perechi vine mai târziu.

Pentru timpi am folosit site-urile de accelerație doar ca etalon, pe câteva mașini, fără să le copiez datele: ZePerfs interzice explicit extragerea, iar AccelerationTimes și DragMile nu au licență de refolosire. Singura sursă cu adevărat liberă dintre ele e cardata.wiki (CC BY 4.0, cu descărcare CSV), care are 0-100, putere, cuplu și cutie, dar nu timpi pe 402 m.

Tipul fiecărei mașini (Supercar, SUV & off-road, Clasică...) se calculează în `kinds.js`, folosit de Turometrul și Garaj sau presă. `shared.js` are și `haptic()`: vibrație pe Android și, pe iPhone (iOS 18+), trucul cu un comutator nativ ascuns.

Lista de mașini (~770) e aleasă de mână: mașini de performanță de la mărci premium (BMW M, AMG, Audi RS, Porsche...), versiunile sport ale mărcilor obișnuite (Golf GTI/R, Octavia RS, Mégane R.S....), supercar și hypercar, SUV-uri și off-road serioase, legende japoneze, clasice iconice și mașini de raliu. Pornește de la mașinile din Forza Horizon 5/6, NFS Heat/Unbound și The Crew Motorfest (`scripts/keep.csv` spune care rămân) plus mașini adăugate din arhiva autoevolution (`scripts/extra_cars.csv`).

Fără build și fără backend: HTML, CSS și JS simplu. Live: https://frincu13.github.io/car-higher-lower/

## Poze

Pozele mașinilor din jocuri vin de pe Wikimedia Commons, cu credit pe card (licențele CC
o cer). Pozele de prezentare ale jocurilor (cardurile din meniu și imaginile de
previzualizare pentru linkuri) vin de pe Unsplash, unde licența permite folosirea liberă;
toate trec prin aceeași calibrare de culoare din `scripts`-ul de artwork: negruri adânci,
saturație puțin scăzută, umbre reci, lumini calde, vinietă și granulație fină.

Pozele vin de pe rețeaua telefonului, deci trebuie tratate ca ceva care poate să nu
apară. Sub fiecare stă un desen de mașină pe fundalul mărcii, așa că o poză care
întârzie sau care nu mai vine lasă o cutie terminată, nu una goală; asta e valabil și
pentru miniaturile mici din sloturile și din garajul Licitației, care înainte se ștergeau
pur și simplu. `wirePhotos` mai încearcă o dată după șapte zecimi de secundă înainte să
renunțe, fiindcă o sincopă nu trebuie să coste poza pentru toată runda.

Service worker-ul cere pozele cu CORS, nu simplu. O cerere simplă întoarce un răspuns
opac, iar un răspuns opac are mereu status zero: un 404 sau o limitare de trafic arată
exact ca o poză bună și rămânea în cache pentru totdeauna, de unde mașini fără poză la un
jucător și cu poză la altul. Pe deasupra, un răspuns opac nu poate răspunde unei cereri
`crossOrigin`, care e fix ce folosește Garaj sau presă ca să deseneze cardul de
distribuire, deci pozele lipseau din fiecare imagine trimisă mai departe. Wikimedia
permite CORS, deci o singură cerere ne dă și status adevărat, și un răspuns bun pentru
amândouă felurile de cerere. Dacă totuși o poză nu ajunge pe card, se desenează plăcuța
cu marca în locul ei.

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
handshake-uri în plus și, offline, niciun font. Acum sunt două fișiere woff2 de 53 de
kiloocteți, tăiate pe alfabetul de care avem nevoie, latin, latin extins și virgulele
românești, cu `preload` în fiecare pagină. Archivo e pentru text, în varianta variabilă,
deci 400, 500, 600 și 700 ies dintr-un singur fișier. Titlurile sunt în Big Shoulders
Display, grosimea 900, 14 KB. L-am ales după ce am măsurat titlurile reale la mărimea de
pe telefon, pe un rând de 343 de pixeli: cu Archivo Black, „Garaj sau presă" avea 389 și
se rupea, cu Big Shoulders are 243. Fiind condensat, literele mari ies și cu 16% mai înalte
la aceeași mărime de font (0,80 din em, față de 0,688), deci nu a trebuit mărit nimic, iar
rândurile au rămas la aceeași înălțime și ecranele fără scroll nu s-au mișcat. Fonturile
late pe care le-am încercat, Archivo Expanded și Unbounded, nu încăpeau nici măcar
„Turometrul" pe un rând. Dacă adaugi un caracter nou, de exemplu un alfabet străin,
trebuie regenerat subsetul cu `fonttools`: `python scripts/build_fonts.py` ia sursele de
la Google Fonts, le taie și le scrie la loc. Archivo și Big Shoulders sunt sub licența
Open Font, deci textul licenței vine cu ele, în `fonts/OFL.txt`.

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

## Pe telefon, ca aplicație

Site-ul se instalează. Pe Android, din meniul browserului sau din butonul „Pune-l pe
telefon" din bara de sus, care deschide chiar dialogul nativ. Pe iPhone nu există prompt,
deci același buton arată pașii: Safari, butonul de partajare, „Adaugă pe ecranul
principal". Butonul apare numai dacă instalarea chiar e posibilă și dispare cu totul dacă
jocul rulează deja instalat, deci nu stă degeaba în drum. `wireInstal` din `shared.js` îl
leagă, iar `manifest.webmanifest` are și capturi, ca Android să arate dialogul cu poze în
loc de bara simplă.

Decupajele telefonului stau în patru variabile pe `:root`, `--sa-sus`, `--sa-jos`, `--sa-st`
și `--sa-dr`, fiecare citind `env(safe-area-inset-*)`. Sunt zero pe un ecran fără breton,
deci se pot pune oriunde fără grijă, iar cele patru nume fac și testarea posibilă: le
suprascrii cu 47 și 34 de pixeli și vezi pe loc cum arată pe un iPhone cu breton și bară
de gesturi. Fără ele, instalată pe telefon, bara de sus intra sub ceas și sub baterie:
ceasul peste logo, comutatorul de limbă pe jumătate sub indicatorul de baterie. Atenție la
scurtăturile `padding` din media query-uri, o singură prescurtare uitată într-un bloc de
mobil ștergea tot decupajul din bara de joc. Verificat pe trei scenarii, fără decupaj, cu
bară de stare de 20 de pixeli și cu breton de 47.

Trei lucruri fac diferența între o pagină și o aplicație pe telefon, toate în `shared.js`.
**Butonul Înapoi al telefonului** (`wireInapoi`): pentru browser un joc e o singură pagină,
deci un gest de înapoi în mijlocul partidei te scotea de tot, iar în aplicația instalată
putea chiar s-o închidă. Acum în istoric stă câte un pas pentru fiecare strat deschis,
partida și panoul de deasupra ei, iar Înapoi închide stratul de sus apăsând butonul lui din
pagină: panoul se închide, partida întreabă „Ieși?", Cel mai bun samsar dă un ecran înapoi.
**Întrebarea „Sigur?"** (`intreaba`) înlocuiește `confirm()`, care arăta adresa site-ului și
butoanele sistemului. „Rămân" e primul buton, deci un Enter grăbit te ține în joc. Sus sau
jos întreabă acum și el, dar numai dacă ai ce pierde. **Ecranul rămâne aprins** cât ține
partida, prin Wake Lock, fiindcă la un joc de petrecere se vorbește mult între ture.

**Partida supraviețuiește telefonului** (`partida` din `shared.js`). iOS închide fără să
întrebe aplicațiile din fundal, deci cine ieșea o clipă să răspundă la un mesaj se întorcea
la o pagină goală. Ordine, Mașina perfectă, Turometrul și Licitația își scriu acum starea la
fiecare pas încheiat, cu mașinile ca id-uri, nu ca obiecte. Dacă pagina s-a reîncărcat
singură, partida se reia direct; dacă intri de pe meniu, rămâi pe ecranul de start cu
„Continuă" și locul unde ai rămas, plus „Joc nou" lângă. Salvarea expiră după două ore și se
șterge la final sau la „Ies". Licitația se salvează la începutul fiecărui pas, iar
dezvăluirea înainte de adunarea premiului, ca o reluare să nu-l numere de două ori; o cursă
cronometrată reluată primește `reluari` în run, ca un clasament să o poată deosebi. Sus sau
jos și Garaj sau presă nu se salvează: o cursă durează un minut și se termină la prima
greșeală, iar o rundă de garaj nu adună nimic. Cel mai bun samsar se salva și înainte, dar o
vizită nouă de pe meniu ștergea meciul; acum îl păstrează și arată „Înapoi la meci", iar un
meci terminat nu mai pretinde că e în curs.

Update-urile rămân un `git push`. Două amănunte le fac să și ajungă:

Pages trimite tot cu `max-age=600`, deci service worker-ul cere fișierele cu
`cache: 'reload'` la instalare, altfel o versiune nouă își putea pune în cache fișiere
vechi de zece minute sub eticheta cea nouă. Paginile se cer cu `cache: 'no-cache'`, adică
revalidate, altfel zece minute după un deploy puteai primi tot pagina veche.

Și, fiindcă o încărcare poate prinde HTML nou cu scripturi vechi până preia service
worker-ul nou, pagina se reîncarcă o dată în clipa în care acesta preia. Dar numai dacă
nu ești în mijlocul unei partide: o reîncărcare în timpul jocului ar șterge scorul
tuturor, iar următoarea deschidere pornește oricum curată.

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
