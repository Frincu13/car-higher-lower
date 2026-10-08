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

A opta pagină, `drag.html` (**Startul**): drag race pe sfert de milă (402 m), doi jucători unul lângă altul, pe același telefon, văzut de amândoi din aceeași parte. Sus e pista, desenată în perspectivă din spatele liniei de start, cu câte o bandă pentru fiecare, repere la 100, 201 și 305 m și finișul în carouri; jos, fiecare are coloana lui (stânga roșul, dreapta albul) cu mașina, turometrul și un buton mare care își schimbă rostul pe parcurs. Amândoi apasă Gata, apoi se aprind cinci lumini roșii, una câte una, ca în Formula 1, și după o pauză pe care n-o poți ghici se sting toate: prima apăsare pe Start de după e plecarea, iar timpul de reacție se adună la cursă. Plecarea e ca un launch control: cât se aprind luminile, ții apăsat ca să turezi; acul urcă cât ții și rămâne unde e când dai drumul, iar în limitator cade jos și o iei de la capăt. La a cincea lumină turația se blochează; o apăsare de atunci până la stingere e start fals și pierzi cursa (ridicatul degetului nu e). La stingere apeși (sau dai drumul, dacă încă țineai) și pleci cu turația blocată: în verde lansarea e perfectă, peste el patinezi (×1,3 pe prima treaptă), sub el pleci moale (×1,14), iar fără turație deloc ×1,5. Ținta e același verde ca la schimbări, deci la mașinile rapide și plecarea e mai grea. Reacția costă doar timpul ei. Botul își alege turația la mijlocul verdelui, cu o abatere de 0,05, 0,03 sau 0,015 după nivel, iar fantoma o păstrează pe cea înregistrată. Apoi, la fiecare treaptă, acul urcă pe o bară: în verde schimbarea e perfectă (+), sub verde e ok (0), în roșul de imediat după verde e târzie (~, ×1,3), prea devreme sau pe limitator e proastă (−). La mașinile lente (14,5 s și peste) acul urcă liniar și verdele e 0,08 din bară; la cele mai rapide acul urcă tot mai iute, ca o turație care explodează, și trece prin verde de până la 1,8 ori mai repede, iar verdele se îngustează până la 0,055, ca o mașină trasă bine din pachet să nu câștige singură, iar dacă nu apeși Schimbă, după o jumătate de secundă pe limitator cutia schimbă singură, cu nota proastă. Câștigă primul care ia trei curse.

Un meci se joacă pe 1-5 runde (3 implicit) și începe la magazin, ca la cutiile din CS: fiecare are 3 milioane pe rundă (dar cel puțin 8, ca și la 1-2 runde să se poată lua un Hypercar) și cumpără, pe rând, câte un pachet pentru fiecare rundă, deschis la vedere. Pachetele sunt Stradă (1 mil.: 55% comune, 35% rare, 10% epice), Sport (2 mil.: 20/40/30/9/1), Supercar (4 mil.: 0/15/40/35/10) și Hypercar (7 mil.: 0/0/25/45/30), pe raritățile comună, rară, epică, exotică și legendară; raritatea vine din timpul real al mașinii pe 1/4 (peste 13,6 s, 12,3-13,6, 11,2-12,3, 10-11,2, sub 10 s). Un pachet se poate lua doar dacă rămân bani de Stradă pentru celelalte. Pachetele arată ca lăzile din CS (ramă de metal, capac cu mâner, colțuri întărite, poza unei mașini reprezentative pe față: Golf GTI, M3, Huracán, P1) și se scutură înainte să se deschidă; sub fiecare, „Ce conține" arată toate mașinile pe care le poate da, pe rarități, cu șansa, intervalul de timp și numărul lor. La deschidere, o bandă cu mașini trase cu aceleași șanse trece prin fața unui ac și se oprește pe mașina trasă dinainte, ca în CS; primele două deschideri durează 5,6 s, următoarele 3,6 s, și de la a treia se poate sări. Apoi fiecare își așază mașinile pe runde, pe ascuns: un ecran de pază cere telefonul pentru cel care așază; fiecare rundă e un rând de duel (mașina ta în stânga, cartea întoarsă a celuilalt în dreapta), atingi o rundă ca s-o alegi și apoi o mașină din garaj, iar o mașină mutată în altă rundă își schimbă locul cu cea de acolo; garajul celuilalt se vede, fără ordine. Pe ecran lat, magazinul, ordinea și cursa stau într-o coloană de telefon mare. La începutul fiecărei runde ambele mașini se întorc deodată, apoi urmează cursa. Câștigă cine ia mai multe runde; la egalitate, cine a rămas cu mai mulți bani. Timpul de bază al fiecărei mașini e cel al unei curse perfecte și e egal cu ce măsoară revistele. Am strâns testele instrumentate (Car and Driver, Motor Trend, MotorWeek, Road & Track, adunate pe 0-60specs.com) pentru 26 de mașini pe benzină, de la Mazda MX-5 (14,6 s pe 1/4) la Bugatti Chiron (9,4 s), și 5 electrice, și am potrivit formulele pe media lor. Timpul pe 1/4: 2,872 + 3,781 × ∛(lb/cp) + 0,367 × 0-100 (eroare medie 0,24 s față de teste); la electrice, care pleacă mult mai tare și trag mai slab spre final, 1/4 vine din 0-100 oficial. Fiecare mașină are un profil de viteză care trece prin puncte reale: 60 mph la timpul din teste (0-60 = 0,784 × 1/4 − 5,674, eroare medie 0,23 s, dar nu sub 2,3 s, cât lasă aderența), 30 mph la 40% din timpul acela, viteza la linie din formula lui Hale calibrată (231 × ∛(cp/lb) mph, eroare medie 3 km/h; electricele +6%) și distanța exactă. Din profil vin poziția pe pistă, timpii de pe bon și vitezele. Valorile de 0-100 din date amestecă cifre oficiale, unele conservatoare, și estimări; la 15 mașini unde estimarea era departe de realitate (Taycan Turbo S: 4,0 s estimat, 2,8 s real) e pusă valoarea verificată. Nota fiecărei schimbări dă ritmul treptei care urmează: perfect înseamnă timpii din teste, ok ×1,14, prost ×1,5. Raportul de 1,5 dintre perfect și prost e cel cerut: o mașină de 15 s condusă perfect egalează una de 10 s condusă prost, dar un Chiron condus oricât de prost rămâne în fața celei mai lente mașini condusă perfect. Mașina rapidă e mai grea de trei ori: are trepte mai scurte, acul ei accelerează spre capăt, iar verdele e puțin mai îngust. În simulări, un jucător obișnuit pierde cam 0,6 s cu o legendară, 0,35 s cu o exotică și aproape nimic cu una comună. Numărul de schimbări vine din cutia mașinii, unde e trecută (trepte minus două, între trei și cinci), altfel patru. Electricele n-au trepte: au trei Boost-uri, care se joacă la fel; datele nu spun mereu că o mașină e electrică, așa că o listă de nume le prinde și pe cele scăpate. Simularea merge pe timpul real, iar fiecare apăsare se evaluează la ora exactă a evenimentului, nu la cadrul următor, deci un telefon care desenează mai rar nu dezavantajează pe nimeni. Pista e desenată în SVG, în perspectivă, văzută din spatele liniei de start, cu parapete, turnuri de reflectoare cu conuri de lumină, pete de lumină pe asfalt și reperele clasice de drag (330 ft, 1/8, 1000 ft; finișul e la 1/4 de milă), iar fiecare jucător e o săgeată luminoasă în culoarea lui, cu o dâră care crește cu viteza; la fiecare schimbare săgeata se aprinde o clipă. La final apare bonul cursei, ca la pistele adevărate: pentru fiecare jucător reacția, 0-100 km/h, timpii la 60 ft, 330 ft, 1/8 milă, 1000 ft și 1/4 milă (de la plecare, fără reacție, ca pe un bon real), viteza la 1/8 și la 1/4, iar jos totalul cu reacție, care decide cursa; timpii se notează în timpul simulării, la ora exactă la care e atins fiecare reper, iar viteza e derivata poziției. Apoi un singur buton „Mai departe", pentru amândoi. La finalul meciului, statisticile în stilul bonului: curse câștigate, cea mai bună reacție, cel mai bun 1/4, viteza maximă, schimbările perfecte și starturile false, cu valoarea mai bună în verde. Mașinile se trag acum la întâmplare; logica de perechi vine mai târziu.

Startul se joacă și singur, fără server. **Cursa zilei**: aceeași mașină pentru toți în aceeași zi, aleasă de un generator pornit de la dată (rarități 10/25/30/25/10%), deci nu trebuie ținută nicăieri. Prima dată concurezi contra lui FRQ Bot, apoi contra fantomei recordului tău de azi; recordul și seria de zile stau pe telefon (localStorage). Fiecare cursă își înregistrează apăsările (reacția și ora fiecărei schimbări, în ms de la stingerea luminilor), iar fantoma le repetă: simularea fiind aceeași, cursa iese identic. „Provoacă un prieten” face un link care conține tot (ziua, mașina, timpul, numele și apăsările în baza 36); cine îl deschide primește aceeași mașină și concurează contra fantomei, al cărei timp se reface din apăsări, nu se ia din link. Același format e gândit pentru un clasament global: serverul ar reface cursa din apăsări în loc să creadă timpul trimis. „Salvează bonul” face o imagine 1080x1350 cu mașina, timpul și reperele, trimisă cu butonul de share al telefonului sau descărcată. **Contra bot**: meciul întreg, cu pachete, contra lui FRQ Bot, pe trei niveluri; botul cumpără de obicei cel mai scump pachet pe care și-l permite, își amestecă mașinile pe runde și, în cursă, țintește mijlocul verdelui cu o abatere de 105, 70 sau 42 ms și o reacție de aproximativ 0,31, 0,25 sau 0,20 s. **Sunetul** e sintetizat în browser (Web Audio): motorul fiecăruia urcă în turație cu acul, în stânga sau în dreapta, cade la schimbare cu o pocnitură în evacuare, bate în limitator, iar electricele șuieră; se oprește din butonul de lângă numărul rundei.

**Clasamentul zilei** (Supabase, proiectul frq-jocuri din organizația Frq-Games, Frankfurt). Modelul cursei stă în `drag-model.js`, comun pentru joc și server; turația de la start se socotește din orele degetului (`turatieLa`), ca serverul s-o poată reface. După fiecare Cursă a zilei terminată, jocul face un cont anonim (doar atunci, nu la simpla vizită) și trimite funcției `trimite-zi` doar apăsările și orele degetului de la start; funcția reface cursa cu același model, deci timpul nu se ia pe cuvânt, și păstrează cel mai bun timp al jucătorului pe zi (limită de 30 de trimiteri la 10 minute, reacție de cel puțin 0,1 s, filtru de nume). Tabelele au RLS: clienții doar citesc (`jucatori`, `zi_rezultate`, RPC `clasament_zi`), scrie doar funcția. Pe ecranul de final apar primii zece și locul tău, pe cardul zilei „Locul tău”; `confidentialitate.html` spune ce se păstrează și are „Șterge datele mele” (funcția `sterge-cont`). Codul de server e în `supabase/` (migrații și funcții); înainte de `supabase functions deploy`, `node tools/pregateste-functii.mjs` copiază modelul și mașinile lângă funcții. Token-ul CLI pentru proiect stă în afara folderului servit, în `../.env.frq-supabase` (nu în repo).

**Clasamentele Provocării zilei** în Sus sau jos și În ordine (care a primit acum și ea o Provocare a zilei: categoria și mașinile vin din dată, singur, fără ceas). Ce mașini vin și ce răspuns e corect stau în `sus-model.js` și `ordine-model.js`, comune cu serverul. La finalul provocării, jocul trimite funcției `trimite-scor` doar răspunsurile (sus/jos, respectiv locul ales la fiecare mașină) și timpul de gândire; funcția reface șirul zilei și numără singură scorul (minimum 0,15 s pe răspuns, aceeași limită de trimiteri). Tabelul `scoruri_zi` păstrează cel mai bun scor pe joc și zi (scor mai mare, apoi timp mai mic); răspunsurile nu se văd public, ca să nu dea răspunsurile zilei. Numele din clasamente e același în toate jocurile (`frq_nume` pe telefon) și se schimbă pe loc din fereastra de final. O provocare din În ordine întreruptă se reia cu starea generatorului, deci cu aceleași mașini. Recordurile partidelor la întâmplare rămân pe telefon: acolo șirul îl alegi tu, deci un clasament s-ar putea trișa reluând până iese.

**Clasamentul general** în Sus sau jos și În ordine: doar partidele cu cronometru, cel mai bun scor al fiecăruia pe categorie, de oricând (tabelul `scoruri_general`, RPC `clasament_general`). O astfel de partidă o pornește funcția `partida`: dă seed-ul (aleator, criptografic) și ține ora de start în `partide`, deci șirul nu se poate alege reluând. La final jocul trimite răspunsurile și timpul de gândire; funcția reface partida din seed și verifică pe ceasul ei că a încăput în secundele de pe fiecare mașină (10 s în Sus sau jos, 15 s în În ordine, plus pauzele dintre mașini și o marjă de 30 s). O partidă trimisă de două ori sau ieșită din timp nu intră. Fără rețea partida se joacă oricum, doar că nu intră în clasament. Butonul **Clasament** din antetul fiecărui joc deschide aceeași fereastră (din `frq-cloud.js`): General pe categorii și Provocarea zilei, iar la Startul Dueluri rapide și Cursa zilei, azi sau ieri.

**Duel rapid** în Startul: alegi miza (2, 5, 10, 25 sau 50 mil.) și mașina, iar adversarul îl alege serverul (funcția SQL `duel_rapid`, într-o singură tranzacție): cel mai vechi duel rapid care așteaptă, din aceeași clasă și cu aceeași miză, al altcuiva, cu care n-ai mai avut un duel rapid în ultimele 24 de ore. Dacă există, alergi contra cursei lui; dacă nu, alergi tu primul și aștepți (24 de ore, apoi miza se întoarce). Cel mult 3 dueluri rapide în așteptare pe jucător. Un duel rapid nu se poate deschide după cod. Pentru că nu-ți alegi adversarul, doar duelurile rapide intră în clasamentul zilei de la Startul (`clasament_bani`: câștigul net în mil. pe ziua din România).

**Meniul principal** (`index.html`): Online, Local, Garajul meu și Setări. Fiecare ecran are adresa lui (`#online`, `#local`, `#setari`), deci butonul Înapoi al telefonului urcă un nivel, iar „← Jocuri” din fiecare joc duce la meniul potrivit. Setările țin numele online (online ești tu; la Local scrii numele jucătorilor în joc), limba, sunetul și volumul (`drg_sunet`, `frq_volum`), vibrațiile (`frq_vibratii`), contul (`cont.js`, același și în Garajul meu), instalarea și confidențialitatea.

**Meniurile jocurilor.** Fiecare joc pornește cu un meniu din rânduri mari (`Shared.randuriMeniu`, clasa `mj`), fiecare cu starea lui pe scurt: Startul (local: 2 jucători, Contra botului; online: Cursa zilei, Duel rapid, Cupa, Echipa, Cu un prieten, Am un cod, Duelurile mele, Antrenament), Sus sau jos și În ordine (Joacă, Provocarea zilei, Categoria, Cronometrul, Clasamentul), Garajul meu (Lăzi, Misiuni, Colecția, Seturi, Contul). Paginile din interior au adresa lor (`#categorie`, `#nume`, `#meci`, `#lazi`...), deci Înapoi-ul telefonului duce în meniu. Meniurile Online și Local de pe prima pagină sunt tot rânduri, cu o poză mică.

**Local, Online și Garajul meu.** Mai jos, cele trei: **Local** (toate jocurile, pe un telefon, fără cont; cronometrul la alegere, nimic nu pleacă pe server), **Online** (Startul, Sus sau jos și În ordine cu `?online` în adresă) și **Garajul meu** (`colectie.html`). Online, Sus sau jos și În ordine sunt mereu cu 10 secunde pe mașină și fiecare partidă o pornește serverul (`partida`), inclusiv Provocarea zilei, din care intră în clasament doar prima partidă a zilei (`trimite-scor` e oprită). Startul local e doar meciul cu pachete; Startul online are Cursa zilei, Cupa, duelurile și **Echipa**: câte o mașină pe clasă (tabelul `echipe`; ce nu e ales se completează cu cea mai rapidă din clasă), cu care pornește duelul rapid. Pentru serverul local, `serve.json` oprește `cleanUrls` (altfel se pierde `?online`) și lista de fișiere.

**Camere online** (`camera.html`, funcția `camera`): doi prieteni, fiecare pe telefonul lui; întâi Licitația. Regulile stau în `licitatie-model.js`, comun pentru pagină și server (ca o stare care se schimbă doar prin mutări și termene: privirea de 5 s, tura de 10 s, așezarea de 75 s). Serverul ține starea întreagă în `camere_secret` și pune în `camere.public` doar ce au voie să vadă amândoi (fără loturile care urmează, categoriile ascunse și așezările); telefoanele află de mutări prin Realtime pe rândul camerei, iar la fiecare termen trecut cer starea, deci jocul merge mai departe și dacă unul pleacă. Miza (0, 5, 10 sau 25 mil.) se blochează la intrare; câștigătorul ia potul minus 10% (`camera_incheie`), la egal miza se întoarce. Pe server, `fereastra.js` le dă lui `grades.js` și `kinds.js` obiectele de pagină de care au nevoie.

**Economia** (cifrele în `economie.js`, comune paginilor și serverului; zilele și săptămânile pe ora României). Banii intră doar din joc, cu limite pe zi; între jucători se mută doar prin întreceri; și există mereu pe ce să-i cheltui.
- **Misiunile zilei**: trei pe zi, aceleași pentru toți (una de joc, una de rutină, una de duel), 1-3 mil. fiecare. Progresul îl socotește baza de date din ce s-a jucat azi (`misiuni_progres`), iar cele terminate se plătesc singure în Garajul meu (`recompensa`, o dată pe cheie).
- **Seturile** (`seturi.js`): 59 de grupe (mărcile, cele mari pe epoci, plus electricele, anii '50-'80 și JDM anii '90). Un set complet se plătește o singură dată (dublul valorii dublurilor din el, de la 10 mil.). Un clic pe set filtrează colecția.
- **Vitrina**: o mașină care îți lipsește se cumpără exact pe ea (5 / 12 / 30 / 70 / 160 mil. după raritate; `cumpara_masina`).
- **Premiile săptămânii**: Sus sau jos pe Mixt și În ordine pe categoria săptămânii, doar partidele cu cronometru; locurile 1-3 primesc 25 / 15 / 10 mil. luni, dacă au jucat măcar 5 (`clasament_saptamana`, `plateste_saptamana`).
- **Cupa de duminică** (funcția `cupa`): aceeași mașină pentru toți, intrare 10 mil., trei încercări (consumate de la start), contează cel mai bun timp, refăcut pe server din apăsări. Potul (intrările minus 10%) merge la primii trei (50 / 30 / 20%); sub 4 înscriși, intrarea se întoarce. În `cupe_extra` se pot pune zile de cupă în plus.
- Plățile pentru ce s-a încheiat (săptămâna, cupa) le face primul care deschide Garajul sau Startul după aceea (`platesteRestante`); `premii_platite` ține ca fiecare să se facă o singură dată. Premiile noi apar ca anunțuri în Garajul meu.

**Garajul meu** (`colectie.html`, economia, pasul 1): o singură monedă, mil., câștigată doar jucând; nu se cumpără și nu se scoate (bani reali ar însemna jocuri de noroc / loot boxes). Cifrele stau în `economie.js`, comun cu serverul: 10 mil. și o ladă gratis la primul cont, 2 mil. pe fiecare Provocare a zilei terminată (o dată pe zi și joc), o ladă Stradă gratis la prima provocare a zilei, bonus de serie (3 zile: 3 mil., 7: 10, apoi 10 la fiecare săptămână, 30: 50). Lăzile au aceleași șanse ca în Startul, la prețuri de garaj (Stradă 2, Sport 5, Supercar 12, Hypercar 25 mil.); mașina o trage funcția `portofel` cu numere aleatoare criptografice, iar banda doar arată rezultatul. O mașină pe care o ai deja se vinde pe loc (1/2/4/8/20 mil. după raritate). Tabelele `portofele`, `garaje` (cu `nivel` pentru tuning, mai târziu) și `miscari` (fiecare mișcare de bani; cheia unică face ca o recompensă să se dea o singură dată) au RLS: fiecare își citește doar rândurile lui; banii îi mută doar funcțiile SQL `asigura_portofel`, `recompensa`, `noteaza_zi` și `deschide_lada`, fiecare într-o tranzacție, chemate numai de funcțiile de pe server. Colecția arată toate cele 685 de mașini pe rarități, cele lipsă ca siluete. Plan mai departe: Startul cu mașinile din garaj, dueluri pe bani și „pe acte” (pierzi mașina), camere la distanță, tuning pe niveluri și dueluri între mașini de același nivel.

**Dueluri cu miză** (Startul, economia, pasul 2): pe bani (1-100 mil., câștigătorul ia ambele mize minus 10%) sau „pe acte" (fiecare pune o mașină de aceeași raritate; cine pierde și-o pierde). Doar din conturi legate de mail, ca nimeni să nu-și treacă bani sau mașini între conturi făcute în serie. Fiecare aleargă pe telefonul lui, o singură dată, deci se poate juca și unul lângă altul, și din orașe diferite: A alege tipul, miza și mașina, aleargă (cu FRQ Bot doar ca ritm) și primește un cod sau un link `drag.html?duel=COD`; B îl deschide, vede cine îl provoacă și cu ce mașină (nu și timpul), pune o mașină de aceeași raritate și aleargă contra fantomei lui A, pe care o primește abia după ce și-a blocat miza. Funcția `duel` reface ambele curse din apăsări; tabelul `dueluri` și funcțiile SQL `duel_creeaza`, `duel_accepta`, `duel_cursa`, `duel_anuleaza`, `duel_incheie`, `duel_expira` blochează și mută mizele, fiecare într-o tranzacție (mașina pusă în joc e `blocat` în garaj). Termene: A are 15 minute să termine cursa (altfel duelul se anulează cu o taxă de abandon, 10% din miză sau 1 mil. pe acte, ca să nu poată reîncerca până iese o cursă bună), duelul stă deschis 24 de ore, B are 15 minute după ce acceptă (altfel pierde). Startul fals sau ieșirea din cursă: A plătește taxa, B pierde. La egalitate fiecare își ia miza înapoi.

**Tuning și clase.** Fiecare mașină din garaj are un nivel 0-5 (Garajul meu, apeși pe mașină): fiecare nivel o face cu 1,2% mai rapidă pe sfertul de milă (`DragModel.timpTunat`), iar tot restul se calculează din timpul nou, deci o mașină tunată e și mai greu de condus perfect. Nivelul următor costă baza rarității (2/3/5/8/12 mil.) înmulțită cu nivelul la care ajungi (`Economie.TUNING`), deci până la 5: 30 mil. o comună, 180 o legendară; funcția SQL `tuneaza` scade banii și urcă nivelul într-o tranzacție, iar o mașină pusă în duel pe acte nu se tunează. **Clasa** e raritatea timpului după tuning (`DragModel.clasa`, aceleași praguri), iar duelurile se fac între mașini din aceeași clasă: o comună tunată poate concura cu rare. Nivelul se fixează la începutul duelului (`nivel_a`, `nivel_b`), serverul reface cursele cu el, iar pe acte câștigătorul primește mașina cu tot cu tuning. **Antrenament** (Startul): orice mașină din garaj contra lui FRQ Bot cu aceeași mașină și același nivel, fără miză.

Pentru calibrare am folosit testele doar ca etalon, pe 31 de mașini, fără să copiez date în joc: ZePerfs interzice explicit extragerea, iar AccelerationTimes și DragMile nu au licență de refolosire. Singura sursă cu adevărat liberă dintre ele e cardata.wiki (CC BY 4.0, cu descărcare CSV), care are 0-100, putere, cuplu și cutie, dar nu timpi pe 402 m.

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
