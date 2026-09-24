// Cel mai bun samsar: categoriile de clienți, clienții și pachetul de surprize.
//
// O rundă are mereu un client. Categoria spune doar ce fel de client primești, iar
// clientul se trage la sorți din ea abia după Start.
//
// Fiecare client are o poveste de patru sau cinci fraze, nu o fișă cu liniuțe: din
// ea trebuie să înțelegi dintr-o citire ce mașină să îi aduci. Cele șase criterii
// din dreapta sunt regulile, povestea e motivul lor.
//
// Surprizele nu se trag din tot pachetul, ci doar dintre cele care au sens pentru
// categoria clientului: la un ghid montan pot pica tracțiune integrală sau gardă la
// sol, nu cârlig de rulotă la o mașină de oraș. Deci le poți mirosi, dar nu le poți
// ști: pachetul unei categorii are între șase și paisprezece intrări.
//
// Textele stau în ambele limbi aici, nu în dicționarul din i18n.js: sunt proză, nu
// etichete de interfață, și ajung și în instrucțiunea trimisă agentului, care trebuie
// scrisă în limba jucătorului. `L()` alege limba o dată, la încărcare.
window.SAMSAR = (() => {
  'use strict';

  const en = () => !!(window.I18n && window.I18n.lang === 'en');
  const L = o => (en() ? o.en : o.ro);

  const CRIT = {
    drum_lung: {
      ro: ['confort pe drum lung', '10 = faci 600 km fără să simți; 5 = obositor după 3 ore; 1 = te doare spatele'],
      en: ['long-distance comfort', '10 = 600 km and you step out fresh; 5 = tiring after 3 hours; 1 = your back hurts'] },
    oras: {
      ro: ['confort în oraș', '10 = mică, vizibilitate bună, parchează singură; 5 = descurcabilă; 1 = coșmar la fiecare parcare'],
      en: ['comfort in town', '10 = small, easy to see out of, parks itself; 5 = manageable; 1 = a nightmare every time you park'] },
    noapte: {
      ro: ['siguranță și faruri noaptea', '10 = matrix sau laser plus asistenți; 5 = LED simplu; 1 = halogen și niciun asistent'],
      en: ['night safety and headlights', '10 = matrix or laser plus driver aids; 5 = plain LED; 1 = halogen and no aids'] },
    risc_sh: {
      ro: ['risc mic la second hand', '10 = un proprietar, istoric complet, motor fără vicii știute; 5 = normal; 1 = loterie'],
      en: ['low used-car risk', '10 = one owner, full history, an engine with no known faults; 5 = average; 1 = a lottery'] },
    costuri: {
      ro: ['costuri reale de ținut', '10 = foarte ieftin, consum mic și piese ieftine; 5 = mediu; 1 = te mănâncă lunar'],
      en: ['real running costs', '10 = very cheap, low thirst and cheap parts; 5 = average; 1 = it eats you alive monthly'] },
    business: {
      ro: ['aspect serios', '10 = intri cu ea la o întâlnire de afaceri; 5 = neutru; 1 = te face de râs'],
      en: ['serious, business look', '10 = you arrive at a business meeting in it; 5 = neutral; 1 = it embarrasses you'] },
    familie: {
      ro: ['spațiu pentru familie', '10 = trei scaune de copil în spate lejer; 5 = merge la nevoie; 1 = nu încape nimeni'],
      en: ['room for a family', '10 = three child seats across the back easily; 5 = it works at a push; 1 = nobody fits'] },
    portbagaj: {
      ro: ['portbagaj', '10 = cară o mutare; 5 = cumpărături de săptămână; 1 = un rucsac'],
      en: ['boot space', '10 = it carries a house move; 5 = a week of shopping; 1 = one backpack'] },
    siguranta: {
      ro: ['siguranță pasivă', '10 = 5 stele recente și airbaguri peste tot; 5 = decentă; 1 = caroserie veche fără nimic'],
      en: ['passive safety', '10 = a recent 5 stars and airbags everywhere; 5 = decent; 1 = an old shell with nothing'] },
    distractie: {
      ro: ['cât de distractivă e', '10 = zâmbești pe orice drum cu curbe; 5 = corectă; 1 = electrocasnic'],
      en: ['how much fun it is', '10 = you grin on any twisty road; 5 = competent; 1 = a household appliance'] },
    sunet: {
      ro: ['sunetul motorului', '10 = ți se face pielea de găină; 5 = se aude ceva; 1 = aspirator sau tăcere'],
      en: ['engine sound', '10 = it gives you goosebumps; 5 = you hear something; 1 = a vacuum cleaner, or silence'] },
    accelerare: {
      ro: ['accelerare', '10 = sub 4 secunde; 5 = în jur de 8; 1 = peste 12'],
      en: ['acceleration', '10 = under 4 seconds; 5 = around 8; 1 = over 12'] },
    manevrabil: {
      ro: ['cum se simte în curbe', '10 = chirurgicală; 5 = sigură dar plată; 1 = se lasă pe o parte'],
      en: ['how it handles', '10 = surgical; 5 = safe but dull; 1 = it leans over and gives up'] },
    raritate: {
      ro: ['cât de rară e', '10 = o vezi o dată pe an; 5 = o întâlnești des; 1 = e la fiecare colț'],
      en: ['how rare it is', '10 = you see one a year; 5 = you meet them often; 1 = one on every corner'] },
    fiabilitate: {
      ro: ['fiabilitate', '10 = motor legendar, nu se strică; 5 = normal; 1 = e cunoscută că se rupe'],
      en: ['reliability', '10 = a legendary engine that never breaks; 5 = average; 1 = known for falling apart'] },
    consum: {
      ro: ['consum', '10 = sub 5 litri; 5 = în jur de 8; 1 = peste 14'],
      en: ['fuel use', '10 = under 5 litres; 5 = around 8; 1 = over 14'] },
    iarna: {
      ro: ['iarnă și vreme rea', '10 = tracțiune integrală, gardă bună, încălzire peste tot; 5 = se descurcă; 1 = rămâi în prima pantă'],
      en: ['winter and bad weather', '10 = all-wheel drive, good clearance, heating everywhere; 5 = it copes; 1 = stuck on the first slope'] },
    teren: {
      ro: ['cât de serios merge pe teren', '10 = blocaje și reductor; 5 = drum forestier; 1 = se oprește la prima bordură'],
      en: ['how serious it is off road', '10 = diff locks and low range; 5 = a forest track; 1 = beaten by the first kerb'] },
    remorcare: {
      ro: ['tras remorcă', '10 = peste 2,5 tone frânat și cârlig montat; 5 = o remorcă mică; 1 = nici vorbă'],
      en: ['towing', '10 = over 2.5 tonnes braked, tow bar fitted; 5 = a small trailer; 1 = no chance'] },
    tehnologie: {
      ro: ['tehnologie la bord', '10 = tot ce există în anul ăla; 5 = ecran și cameră; 1 = radio cu CD'],
      en: ['technology on board', '10 = everything that existed that year; 5 = a screen and a camera; 1 = a CD radio'] },
    piese: {
      ro: ['piese și service ieftin', '10 = găsești piese în orice sat; 5 = comandă de o săptămână; 1 = piese aduse din altă țară'],
      en: ['cheap parts and servicing', '10 = parts in any village; 5 = a week-long order; 1 = parts shipped from abroad'] },
    revanzare: {
      ro: ['cât de ușor o vinzi înapoi', '10 = zboară într-o zi; 5 = o lună; 1 = rămâi cu ea'],
      en: ['how easily it sells on', '10 = gone in a day; 5 = a month; 1 = you are stuck with it'] },
    look_tanar: {
      ro: ['cât de bine arată', '10 = întorc capul după ea; 5 = curată și îngrijită; 1 = tristă'],
      en: ['how good it looks', '10 = heads turn; 5 = clean and tidy; 1 = sad'] },
    discretie: {
      ro: ['cât de discretă e', '10 = nu o bagă nimeni în seamă; 5 = neutră; 1 = țipă de la un kilometru'],
      en: ['how discreet it is', '10 = nobody notices it; 5 = neutral; 1 = it shouts from a mile away'] },
    autonomie: {
      ro: ['autonomie reală', '10 = peste 450 km fără grijă; 5 = în jur de 250; 1 = sub 150'],
      en: ['real range', '10 = over 450 km without worrying; 5 = around 250; 1 = under 150'] },
    incarcare: {
      ro: ['încărcare', '10 = peste 150 kW și priză trifazică; 5 = mediu; 1 = doar din priza de perete'],
      en: ['charging', '10 = over 150 kW plus three-phase at home; 5 = average; 1 = a wall socket only'] },
    gabarit: {
      ro: ['gabarit mic', '10 = intră oriunde; 5 = normală; 1 = nu încape în parcarea blocului'],
      en: ['small footprint', '10 = it fits anywhere; 5 = normal; 1 = it will not fit the block car park'] },
    poveste: {
      ro: ['poveste și caracter', '10 = are ceva de povestit la fiecare întâlnire; 5 = o mașină; 1 = nimic de zis despre ea'],
      en: ['story and character', '10 = something to talk about at every meet; 5 = a car; 1 = nothing to say about it'] },
    scaune: {
      ro: ['scaunele', '10 = te țin bine și sunt reglabile electric; 5 = corecte; 1 = banchetă de autobuz'],
      en: ['the seats', '10 = supportive and electrically adjustable; 5 = fine; 1 = a bus bench'] },
    vizibilitate: {
      ro: ['vizibilitate din scaun', '10 = vezi tot, stâlpi subțiri; 5 = normală; 1 = tragi cu urechea la senzori'],
      en: ['visibility from the seat', '10 = you see everything, thin pillars; 5 = normal; 1 = you drive by the beeping'] },
  };

  // Categoriile: ce fel de client primești. `mix` trage din toate.
  const CATEGORII = [
    { key: 'supercar', ro: { nume: 'Supercar', tag: 'fără compromisuri' }, en: { nume: 'Supercar', tag: 'no compromises' } },
    { key: 'sport', ro: { nume: 'Sport accesibil', tag: 'distracție pe bani puțini' }, en: { nume: 'Affordable sports', tag: 'fun on little money' } },
    { key: 'suv', ro: { nume: 'SUV de familie', tag: 'cinci locuri și bagaje' }, en: { nume: 'Family SUV', tag: 'five seats and luggage' } },
    { key: 'prima', ro: { nume: 'Prima mașină', tag: 'sub 5.000 de euro' }, en: { nume: 'First car', tag: 'under 5,000 euro' } },
    { key: 'clasica', ro: { nume: 'Clasică', tag: 'mașină cu istorie' }, en: { nume: 'Classic', tag: 'a car with history' } },
    { key: 'electrica', ro: { nume: 'Electrică', tag: 'fără benzinărie' }, en: { nume: 'Electric', tag: 'no petrol station' } },
    { key: 'marfa', ro: { nume: 'Break și utilitare', tag: 'cară tot' }, en: { nume: 'Estates and vans', tag: 'carries everything' } },
    { key: 'offroad', ro: { nume: 'Off-road', tag: 'unde se termină asfaltul' }, en: { nume: 'Off-road', tag: 'where the tarmac ends' } },
    { key: 'oras', ro: { nume: 'Mașină de oraș', tag: 'mică și ușor de parcat' }, en: { nume: 'City car', tag: 'small and easy to park' } },
    { key: 'zi', ro: { nume: 'Mașina de zi cu zi', tag: 'cea mai echilibrată' }, en: { nume: 'Everyday car', tag: 'the most balanced one' } },
    { key: 'business', ro: { nume: 'Business', tag: 'impresie și confort' }, en: { nume: 'Business', tag: 'impression and comfort' } },
    { key: 'omie', ro: { nume: 'Mașina de 1.000 €', tag: 'cel mai greu test' }, en: { nume: 'The 1,000 € car', tag: 'the hardest test' } },
    { key: 'mix', ro: { nume: 'Mix', tag: 'un client la întâmplare' }, en: { nume: 'Mix', tag: 'a client at random' } },
  ];

  // Clienții. Ordinea din `criterii` e ordinea lor de importanță, de la cel mai
  // important la cel mai puțin, și din ea ies ponderile la nota a doua.
  const CLIENTI = [
    // ---------------- supercar ----------------
    { nume: 'Vlad', varsta: 44, cat: 'supercar', buget: [90000, 160000], maxim: 200000,
      criterii: ['distractie', 'sunet', 'accelerare', 'manevrabil', 'raritate', 'poveste'],
      ro: { ocupatie: 'chirurg',
        poveste: 'Operează cinci zile pe săptămână și are deja două mașini în garaj, una de oraș și una de familie. Asta e a treia, cea la care se gândește marți dimineața, între două operații. O scoate de vreo zece ori pe an, pe drumuri cu curbe, pe vreme bună, și vrea să simtă ceva de fiecare dată când apasă. Portbagajul, consumul și locurile din spate nu contează absolut deloc. Dacă nu îl trece un fior când pornește motorul, nu o cumpără.' },
      en: { ocupatie: 'surgeon',
        poveste: 'He operates five days a week and already has two cars in the garage, one for town and one for the family. This is the third, the one he thinks about on a Tuesday morning between two operations. He takes it out about ten times a year, on twisty roads, in good weather, and he wants to feel something every time he puts his foot down. Boot space, fuel and rear seats do not matter in the slightest. If it does not give him a shiver when it starts, he will not buy it.' } },

    { nume: 'Sebastian', varsta: 38, cat: 'supercar', buget: [120000, 250000], maxim: 320000,
      criterii: ['accelerare', 'raritate', 'look_tanar', 'sunet', 'revanzare', 'poveste'],
      ro: { ocupatie: 'și-a vândut firma anul trecut',
        poveste: 'Și-a vândut firma anul trecut și, pentru prima dată în viață, nu se mai uită la rata lunară. Vrea mașina care spune tot, fără să o explice nimănui, și o vrea acum, nu peste doi ani, când o să fie prea târziu. Merge cu ea la evenimente și de două ori pe an la mare, restul timpului stă acoperită în garaj. Singura lui grijă e să nu piardă jumătate din bani în trei ani, pentru că știe cât de repede se depreciază lucrurile scumpe.' },
      en: { ocupatie: 'sold his company last year',
        poveste: 'He sold his company last year and, for the first time in his life, he is not looking at a monthly payment. He wants the car that says everything without him having to explain it, and he wants it now, not in two years when it will be too late. He drives it to events and twice a year to the coast, the rest of the time it sits under a cover in the garage. His only worry is losing half the money in three years, because he knows how fast expensive things fall in value.' } },

    { nume: 'Horia', varsta: 55, cat: 'supercar', buget: [100000, 200000], maxim: 260000,
      criterii: ['poveste', 'raritate', 'drum_lung', 'sunet', 'revanzare', 'fiabilitate'],
      ro: { ocupatie: 'dezvoltator imobiliar',
        poveste: 'A avut la douăzeci de ani toate mașinile pe care și le dorea, acum caută una pe care să o poată conduce și miercuri dimineața, nu doar la paradă. Face douăsprezece mii de kilometri pe an și, de două ori pe an, pleacă prin Europa cu ea, opt sute de kilometri într-o singură zi. Vrea prezență și caracter, dar nu suportă ideea de a rămâne în pană departe de casă, într-o țară în care nu cunoaște pe nimeni. Are garaj cu încălzire și un mecanic care îi răspunde la telefon și duminica.' },
      en: { ocupatie: 'property developer',
        poveste: 'At twenty he had every car he wanted, now he is looking for one he can also drive on a Wednesday morning, not just to a show. He covers twelve thousand kilometres a year and twice a year he takes it across Europe, eight hundred kilometres in a single day. He wants presence and character, but he cannot stand the thought of breaking down far from home, in a country where he knows nobody. He has a heated garage and a mechanic who answers the phone on Sundays too.' } },

    // ---------------- sport accesibil ----------------
    { nume: 'Alex', varsta: 24, cat: 'sport', buget: [8000, 16000], maxim: 20000,
      criterii: ['distractie', 'sunet', 'manevrabil', 'look_tanar', 'poveste', 'piese'],
      ro: { ocupatie: 'lucrează în IT',
        poveste: 'A luat primul salariu bun acum patru luni și de atunci se uită la anunțuri în fiecare seară, până la unu noaptea. Duminica dimineața e la întâlnirea de mașini din parcarea mallului și vrea să aibă și el ceva de pus în mijloc. În timpul săptămânii merge la birou prin oraș, iar sâmbăta urcă pe un drum cu curbe doar ca să audă motorul în tunel. Tracțiune spate dacă se poate, iar dacă se mai strică din când în când, o repară și merge mai departe.' },
      en: { ocupatie: 'works in IT',
        poveste: 'He got his first decent salary four months ago and has been reading listings every evening since, until one in the morning. On Sunday mornings he is at the car meet in the mall car park and he wants something of his own to park in the middle. During the week he drives to the office through town, and on Saturdays he climbs a twisty road just to hear the engine in the tunnel. Rear-wheel drive if possible, and if it breaks down now and then, he will fix it and carry on.' } },

    { nume: 'Paul', varsta: 28, cat: 'sport', buget: [12000, 25000], maxim: 30000,
      criterii: ['manevrabil', 'iarna', 'fiabilitate', 'piese', 'accelerare', 'poveste'],
      ro: { ocupatie: 'programator, merge la raliuri de amatori',
        poveste: 'Programează de luni până vineri și merge la etape de amatori în weekend, pe drumuri închise, pline de pietriș. Mașina trebuie să facă și naveta la birou, și să reziste la o zi întreagă de bătaie fără să se plângă luni dimineața. Are unde să lucreze la ea și doi prieteni care îl ajută, deci munca nu îl sperie, dimpotrivă. Caută tracțiune integrală și o bază bună, ceva ce poate crește odată cu el, nu o mașină gata făcută de altcineva.' },
      en: { ocupatie: 'programmer, runs amateur rallies',
        poveste: 'He writes code from Monday to Friday and runs amateur stages at weekends, on closed roads covered in gravel. The car has to do the commute to the office as well, and survive a whole day of punishment without complaining on Monday morning. He has somewhere to work on it and two friends who help, so the work does not scare him, quite the opposite. He is after all-wheel drive and a good base, something that can grow with him, not a car someone else already finished.' } },

    { nume: 'Denisa', varsta: 26, cat: 'sport', buget: [5000, 12000], maxim: 15000,
      criterii: ['distractie', 'piese', 'manevrabil', 'fiabilitate', 'sunet', 'costuri'],
      ro: { ocupatie: 'mecanic auto',
        poveste: 'Lucrează într-un service de opt ani și repară singură tot ce se poate repara, deci o mașină cu vicii nu o sperie deloc. Ce o sperie e o mașină pentru care nu găsești piese, sau la care trebuie să scoți motorul ca să schimbi o bujie. Merge la munte în fiecare weekend, pe drumuri cu curbe, și vrea maximum de distracție pe cât mai puțini bani. Zice că o mașină bună îți spune totul în primii cinci sute de metri, restul sunt povești de pe internet.' },
      en: { ocupatie: 'car mechanic',
        poveste: 'She has worked in a garage for eight years and fixes everything that can be fixed herself, so a car with faults does not scare her at all. What scares her is a car you cannot find parts for, or one where you have to drop the engine to change a spark plug. She drives to the mountains every weekend, on twisty roads, and wants the most fun for the least money. She says a good car tells you everything in the first five hundred metres, the rest is stories from the internet.' } },

    // ---------------- SUV de familie ----------------
    { nume: 'Dan', varsta: 38, cat: 'suv', buget: [15000, 28000], maxim: 33000,
      criterii: ['familie', 'portbagaj', 'siguranta', 'costuri', 'drum_lung', 'risc_sh'],
      ro: { ocupatie: 'tată a trei copii',
        poveste: 'Are trei copii, doi în scaune și unul pe înălțător, iar la fiecare vacanță urcă și bunica pe bancheta din spate. Face cincisprezece mii de kilometri pe an, între școală, cumpărături și două drumuri lungi pe vară. Și-a numărat deja bagajele și știe exact câte nu intră în mașina pe care o are acum. Vrea să plece de acasă fără cearta obișnuită pe cotieră și fără portbagajul închis cu o sfoară.' },
      en: { ocupatie: 'father of three',
        poveste: 'He has three children, two in car seats and one on a booster, and on every holiday grandma climbs into the back as well. He covers fifteen thousand kilometres a year, between school, shopping and two long trips each summer. He has already counted the bags and knows exactly how many do not fit in the car he has now. He wants to leave the house without the usual fight over the armrest and without the boot held shut with string.' } },

    { nume: 'Iulian', varsta: 33, cat: 'suv', buget: [24000, 40000], maxim: 46000,
      criterii: ['drum_lung', 'noapte', 'risc_sh', 'costuri', 'business', 'oras'],
      ro: { ocupatie: 'medic de gardă',
        poveste: 'Face gărzi de noapte la spitalul județean și stă la patruzeci de kilometri de oraș, așa că jumătate din anul lui se petrece pe un drum național neiluminat, la trei dimineața, pe ploaie sau pe polei. Strânge vreo douăzeci și cinci de mii de kilometri pe an și a ajuns să urască mașinile care îl obosesc: vrea să coboare din ea la fel cum s-a urcat. Nu dă bani pe fițe, dar nici nu vrea să tragă în parcarea spitalului cu ceva care îl face de râs. A cumpărat prost de două ori și acum se uită întâi la istoric, abia apoi la restul.' },
      en: { ocupatie: 'doctor on night shifts',
        poveste: 'He works night shifts at the county hospital and lives forty kilometres out of town, so half his year is spent on an unlit main road at three in the morning, in rain or on black ice. He racks up about twenty five thousand kilometres a year and has come to hate cars that tire him out: he wants to step out of it the way he got in. He does not spend money on show, but he does not want to pull into the hospital car park in something embarrassing either. He bought badly twice and now he looks at the history first and everything else after.' } },

    { nume: 'Elena', varsta: 36, cat: 'suv', buget: [16000, 28000], maxim: 33000,
      criterii: ['siguranta', 'familie', 'portbagaj', 'oras', 'risc_sh', 'costuri'],
      ro: { ocupatie: 'proaspătă mămică',
        poveste: 'Are un copil de șapte luni și de atunci conduce altfel, mai încet și cu ochii în oglinda retrovizoare la fiecare semafor. Face zece mii de kilometri pe an, pediatru, cumpărături și weekenduri la bunici, la o sută cincizeci de kilometri. Căruciorul e mare și greu, iar ea îl ridică singură de zece ori pe zi, deci portbagajul nu e un detaliu, e ziua ei. Parchează la bloc, între două mașini, pe un loc în care abia încape, și nu vrea să transpire de fiecare dată.' },
      en: { ocupatie: 'new mother',
        poveste: 'She has a seven month old baby and has driven differently ever since, slower and with her eyes on the mirror at every light. She covers ten thousand kilometres a year, the paediatrician, the shopping and weekends at the grandparents, a hundred and fifty kilometres away. The pram is big and heavy and she lifts it alone ten times a day, so the boot is not a detail, it is her whole day. She parks at the block, between two cars, in a space that barely fits, and she does not want to break a sweat every time.' } },

    // ---------------- prima mașină ----------------
    { nume: 'Robert', varsta: 21, cat: 'prima', buget: [1800, 4000], maxim: 5000,
      criterii: ['costuri', 'piese', 'risc_sh', 'look_tanar', 'consum', 'gabarit'],
      ro: { ocupatie: 'student la Politehnică',
        poveste: 'A muncit două veri ca să strângă banii și încă nu i-a spus tatălui său cât are de gând să dea pe ea. Face opt mii de kilometri pe an, între facultate și casa părinților, la două sute de kilometri, și o parchează pe stradă, sub bloc. Nu are bani de reparații, deci orice surpriză mecanică îl lasă pe jos o lună întreagă. Vrea ceva ieftin de ținut, dar cu care să nu îi fie rușine când oprește în fața facultății, luni la opt.' },
      en: { ocupatie: 'engineering student',
        poveste: 'He worked two summers to save the money and still has not told his father how much he means to spend on it. He covers eight thousand kilometres a year between university and the house of his parents two hundred kilometres away, and parks it on the street by the block. He has no money for repairs, so any mechanical surprise leaves him walking for a whole month. He wants something cheap to keep, but one he will not be ashamed of when he pulls up outside the faculty at eight on a Monday.' } },

    { nume: 'Maria', varsta: 19, cat: 'prima', buget: [1500, 3500], maxim: 4500,
      criterii: ['siguranta', 'costuri', 'piese', 'fiabilitate', 'gabarit', 'look_tanar'],
      ro: { ocupatie: 'elevă în ultimul an de liceu',
        poveste: 'A luat permisul acum o lună și încă parchează cu geamul deschis, ca să audă bordura înainte să o atingă. Părinții pun jumătate din bani și, odată cu ei, toate condițiile: să fie sigură, să nu consume mult și să nu fie mai rapidă decât trebuie. Face cinci mii de kilometri pe an, drumul la liceu și patruzeci de kilometri până la bunici, în fiecare duminică. Mașina stă în curte, la poartă, și e prima ei responsabilitate adevărată, pe care nu vrea să o strice.' },
      en: { ocupatie: 'in her final year of school',
        poveste: 'She passed her test a month ago and still parks with the window down so she can hear the kerb before she touches it. Her parents are paying half and, with the money, come all the conditions: it has to be safe, it must not drink much and it must not be faster than it needs to be. She covers five thousand kilometres a year, the run to school and forty kilometres to her grandparents every Sunday. The car sits in the yard by the gate, and it is her first real responsibility, one she does not want to ruin.' } },

    { nume: 'Ionuț', varsta: 23, cat: 'prima', buget: [2000, 4500], maxim: 5500,
      criterii: ['fiabilitate', 'costuri', 'noapte', 'piese', 'consum', 'gabarit'],
      ro: { ocupatie: 'ospătar, ture de noapte',
        poveste: 'Termină tura la două dimineața, când nu mai circulă nimic, și până acum se întorcea acasă pe jos, patruzeci de minute. Face douăsprezece mii de kilometri pe an, aproape toți noaptea, prin oraș și pe o centură fără niciun stâlp de iluminat. Iarna mașina doarme afară, în fața blocului, și trebuie să pornească din prima la minus zece grade. Nu îi pasă cum arată, îi pasă să nu rămână la trei noaptea în stație, cu telefonul descărcat.' },
      en: { ocupatie: 'waiter on night shifts',
        poveste: 'His shift ends at two in the morning, when nothing is running, and until now he walked home for forty minutes. He covers twelve thousand kilometres a year, almost all at night, through town and along a ring road without a single street light. In winter the car sleeps outside in front of the block and has to start first time at minus ten. He does not care how it looks, he cares about not being stuck at three in the morning at a bus stop with a flat phone.' } },

    // ---------------- clasică ----------------
    { nume: 'Sorin', varsta: 52, cat: 'clasica', buget: [20000, 45000], maxim: 55000,
      criterii: ['poveste', 'raritate', 'revanzare', 'sunet', 'risc_sh', 'distractie'],
      ro: { ocupatie: 'colecționar',
        poveste: 'Are șase mașini în garaj și un caiet în care scrie ce a plătit pe fiecare și cât face acum, an de an. Caută a șaptea, una pe care să o scoată duminica dimineața, pe vreme bună, vreo trei mii de kilometri pe an. Îl interesează originalitatea mai mult decât starea: o mașină reparată prost e mai greu de salvat decât una obosită dar întreagă. Cumpără și cu gândul la ce va face peste zece ani, pentru că până acum nu a pierdut bani pe niciuna.' },
      en: { ocupatie: 'collector',
        poveste: 'He has six cars in the garage and a notebook where he writes what he paid for each and what it is worth now, year by year. He is looking for a seventh, one to take out on Sunday mornings in good weather, about three thousand kilometres a year. Originality matters to him more than condition: a badly repaired car is harder to save than a tired but honest one. He also buys thinking about what it will be worth in ten years, because so far he has not lost money on a single one.' } },

    { nume: 'Ileana', varsta: 61, cat: 'clasica', buget: [6000, 15000], maxim: 19000,
      criterii: ['poveste', 'raritate', 'risc_sh', 'fiabilitate', 'piese', 'revanzare'],
      ro: { ocupatie: 'profesoară de istorie',
        poveste: 'Tatăl ei a avut una la fel și a învățat să conducă pe ea, la optsprezece ani, pe un drum de țară plin de praf. Acum, după ce a ieșit la pensie, vrea exact modelul acela, cu aceeași culoare dacă se poate găsi. O va scoate de câteva ori pe lună, două mii cinci sute de kilometri pe an, și o ține în garajul uscat de la casa părintească. Se teme de rugină ascunsă și de motoare bricolate, pentru că nu are cum să verifice singură nimic.' },
      en: { ocupatie: 'history teacher',
        poveste: 'Her father had one just like it and she learned to drive in it at eighteen, on a dusty country road. Now that she has retired, she wants exactly that model, in the same colour if one can be found. She will take it out a few times a month, two and a half thousand kilometres a year, and keep it in the dry garage at the family house. She is afraid of hidden rust and bodged engines, because she has no way of checking anything herself.' } },

    { nume: 'Matei', varsta: 30, cat: 'clasica', buget: [3000, 10000], maxim: 13000,
      criterii: ['piese', 'poveste', 'revanzare', 'raritate', 'sunet', 'costuri'],
      ro: { ocupatie: 'tâmplar cu atelier propriu',
        poveste: 'Are atelier propriu, cu elevator și scule, iar iarna nu prea are de lucru, deci caută un proiect care să îi umple lunile alea. Vrea să desfacă o mașină până la caroserie și să o pună la loc singur, fără să aștepte trei luni după o piesă din Germania. Din aprilie anul viitor o scoate pe drum, o mie cinci sute de kilometri pe an, în weekenduri. Îl interesează să iasă ceva care să merite munca, nu o epavă pe care o va abandona în august.' },
      en: { ocupatie: 'carpenter with his own workshop',
        poveste: 'He has his own workshop with a lift and tools, and in winter there is not much work, so he is looking for a project to fill those months. He wants to strip a car down to the shell and put it back together himself, without waiting three months for a part from Germany. From April next year he will put it on the road, fifteen hundred kilometres a year, at weekends. He cares about ending up with something worth the work, not a wreck he abandons in August.' } },

    // ---------------- electrică ----------------
    { nume: 'Ana', varsta: 32, cat: 'electrica', buget: [18000, 35000], maxim: 42000,
      criterii: ['autonomie', 'incarcare', 'oras', 'tehnologie', 'costuri', 'risc_sh'],
      ro: { ocupatie: 'arhitectă',
        poveste: 'Lucrează într-un birou din centru și are priză în garajul blocului, deci a calculat deja că ar plăti o treime pe kilometru. O singură teamă o ține pe loc: drumul de trei sute de kilometri pe care îl face lunar la părinți, iarna, cu căldura pornită tot timpul. Face paisprezece mii de kilometri pe an, restul prin oraș, între șantiere și birou, în trafic. Vrea o autonomie care să nu o mintă în ianuarie și o stație rapidă pe drumul acela, nu promisiuni din broșură.' },
      en: { ocupatie: 'architect',
        poveste: 'She works in an office in the centre and has a socket in the block garage, so she has already worked out that she would pay a third per kilometre. One fear holds her back: the three hundred kilometre trip she makes to her parents every month, in winter, with the heating on the whole way. She covers fourteen thousand kilometres a year, the rest around town between sites and the office, in traffic. She wants range that will not lie to her in January and a fast charger on that route, not brochure promises.' } },

    { nume: 'Ștefania', varsta: 26, cat: 'electrica', buget: [9000, 18000], maxim: 21000,
      criterii: ['oras', 'gabarit', 'costuri', 'look_tanar', 'tehnologie', 'autonomie'],
      ro: { ocupatie: 'designer, lucrează de acasă',
        poveste: 'Lucrează de acasă și iese cu mașina de trei ori pe săptămână, la cumpărături, la sală și la câte o întâlnire în oraș. Șase mii de kilometri pe an, aproape toți pe două bulevarde și într-o parcare subterană cu rampă îngustă. Are priză în parcarea blocului și nu a mai pus benzină de când o prietenă de-a ei a trecut pe electric. Vrea ceva mic, drăguț și ieftin de ținut, cu care să poată parca oriunde fără trei manevre și un vecin supărat.' },
      en: { ocupatie: 'designer, works from home',
        poveste: 'She works from home and takes the car out three times a week, for shopping, the gym and the odd meeting in town. Six thousand kilometres a year, almost all of them on two boulevards and into an underground car park with a narrow ramp. She has a socket in the block car park and has not bought petrol since a friend of hers went electric. She wants something small, good looking and cheap to keep, that parks anywhere without three attempts and an angry neighbour.' } },

    { nume: 'Radu', varsta: 45, cat: 'electrica', buget: [25000, 45000], maxim: 52000,
      criterii: ['autonomie', 'incarcare', 'drum_lung', 'tehnologie', 'costuri', 'scaune'],
      ro: { ocupatie: 'inginer la o firmă de energie',
        poveste: 'Lucrează la o firmă de energie, are panouri pe casă și trifazic în garaj, deci nu îl sperie nimic legat de încărcat. Face douăzeci și opt de mii de kilometri pe an, mai ales pe autostradă, cu doi copii în spate care adorm după prima oră. Vrea să facă patru sute de kilometri iarna fără să calculeze nimic și să încarce cât bea o cafea în benzinărie. A citit toate testele și știe exact ce consumă fiecare la o sută douăzeci la oră, iarna, cu căldura pornită.' },
      en: { ocupatie: 'engineer at an energy company',
        poveste: 'He works for an energy company, has panels on the roof and three phase in the garage, so nothing about charging worries him. He covers twenty eight thousand kilometres a year, mostly motorway, with two children in the back who fall asleep after the first hour. He wants to do four hundred kilometres in winter without doing any sums and to charge in the time it takes to drink a coffee. He has read every test and knows exactly what each one uses at a hundred and twenty, in winter, with the heating on.' } },

    // ---------------- break și utilitare ----------------
    { nume: 'Carmen', varsta: 37, cat: 'marfa', buget: [14000, 25000], maxim: 30000,
      criterii: ['portbagaj', 'business', 'drum_lung', 'risc_sh', 'iarna', 'consum'],
      ro: { ocupatie: 'fotograf de nuntă',
        poveste: 'Cară două trepiede, trei aparate și un geamantan de obiective, iar echipamentul face aproape cât mașina. Vara are nuntă în fiecare weekend, douăzeci și cinci de mii de kilometri pe an, jumătate pe drumuri de țară, până la biserici de care nu a auzit nimeni. Încarcă și descarcă de zece ori pe zi și vrea un portbagaj care se încuie, nu o banchetă rabatată peste care se vede tot. Trage în fața restaurantului la ora șase și nu vrea să coboare dintr-o mașină obosită, în fața a două sute de invitați.' },
      en: { ocupatie: 'wedding photographer',
        poveste: 'She carries two tripods, three bodies and a case of lenses, and the kit is worth almost as much as the car. In summer there is a wedding every weekend, twenty five thousand kilometres a year, half of them on country lanes to churches nobody has heard of. She loads and unloads ten times a day and wants a boot that locks, not a folded down seat with everything on show. She pulls up in front of the restaurant at six and does not want to step out of a tired car in front of two hundred guests.' } },

    { nume: 'Viorel', varsta: 50, cat: 'marfa', buget: [5000, 14000], maxim: 17000,
      criterii: ['portbagaj', 'remorcare', 'fiabilitate', 'piese', 'teren', 'costuri'],
      ro: { ocupatie: 'apicultor',
        poveste: 'Mută o sută de stupi de trei ori pe an, primăvara la salcâm, vara la floarea soarelui și toamna înapoi acasă. Merge pe drumuri de câmp, pe miriște și prin noroi, cu o remorcă de o tonă și jumătate în spate, de multe ori noaptea. Optsprezece mii de kilometri pe an, dintre care jumătate pe unde nu se aventurează nimeni cu mașina lui. Vrea ceva pe care mecanicul din sat să îl repare într-o după-amiază, cu piese de la magazinul din comună.' },
      en: { ocupatie: 'beekeeper',
        poveste: 'He moves a hundred hives three times a year, in spring to the acacia, in summer to the sunflower and in autumn back home. He drives on field tracks, across stubble and through mud, with a one and a half tonne trailer behind him, often at night. Eighteen thousand kilometres a year, half of them where nobody else would take their own car. He wants something the village mechanic can fix in an afternoon, with parts from the shop down the road.' } },

    { nume: 'Simona', varsta: 34, cat: 'marfa', buget: [6000, 15000], maxim: 18000,
      criterii: ['portbagaj', 'consum', 'oras', 'fiabilitate', 'costuri', 'vizibilitate'],
      ro: { ocupatie: 'are o florărie',
        poveste: 'Are o florărie de șase ani și livrează singură aranjamentele înalte, alea care nu suportă să fie culcate pe o parte. Douăzeci și două de mii de kilometri pe an, toți prin oraș, douăzeci de opriri pe zi și tot atâtea locuri de parcare găsite cu greu. Încarcă din spatele magazinului, pe o alee îngustă unde poate deschide larg ușa doar într-o parte. Stă mult în trafic, deci consumul o doare direct la marjă, iar vara aerul condiționat merge opt ore pe zi.' },
      en: { ocupatie: 'runs a flower shop',
        poveste: 'She has run a flower shop for six years and delivers the tall arrangements herself, the ones that cannot be laid on their side. Twenty two thousand kilometres a year, all in town, twenty stops a day and as many parking spaces found with difficulty. She loads at the back of the shop, down a narrow lane where she can only open the door wide on one side. She sits in traffic a lot, so fuel hits her margin directly, and in summer the air conditioning runs eight hours a day.' } },

    // ---------------- off-road ----------------
    { nume: 'Tudor', varsta: 39, cat: 'offroad', buget: [12000, 24000], maxim: 28000,
      criterii: ['teren', 'iarna', 'portbagaj', 'fiabilitate', 'remorcare', 'piese'],
      ro: { ocupatie: 'ghid montan',
        poveste: 'Duce turiști la cabane, pe drumuri forestiere pe care primăria nu le-a văzut de zece ani. Iarna, cinci luni pe an, urcă pe zăpadă bătătorită cu lanțuri în portbagaj, șase rucsacuri și schiuri în spate. Douăzeci și două de mii de kilometri pe an, jumătate pe pietre, făgașe și pante pe care alții se întorc. Dacă rămâne blocat la o mie patru sute de metri, cu clienți în mașină, nu îl scoate nimeni de acolo până a doua zi.' },
      en: { ocupatie: 'mountain guide',
        poveste: 'He takes tourists up to cabins on forest tracks the council has not seen in ten years. In winter, five months of the year, he climbs packed snow with chains in the boot, six rucksacks and skis in the back. Twenty two thousand kilometres a year, half of them on rocks, ruts and slopes where other people turn around. If he gets stuck at fourteen hundred metres with clients in the car, nobody is pulling him out until the next day.' } },

    { nume: 'Mihaela', varsta: 35, cat: 'offroad', buget: [10000, 20000], maxim: 24000,
      criterii: ['teren', 'portbagaj', 'fiabilitate', 'iarna', 'piese', 'costuri'],
      ro: { ocupatie: 'medic veterinar la țară',
        poveste: 'Merge la ferme din opt sate, pe drumuri de pământ care jumătate de an sunt noroi până la genunchi. Are doi câini mari și cuștile în spate, plus o trusă care cântărește cât un om în picioare. Treizeci de mii de kilometri pe an și, de multe ori, ultimii doi kilometri nu mai sunt drum, ci făgaș de tractor. Spală mașina săptămânal și tot arată ca și cum ar fi ieșit dintr-o baltă, dar nu i-a fost frică niciodată de o groapă.' },
      en: { ocupatie: 'country vet',
        poveste: 'She visits farms in eight villages, on dirt roads that are knee deep mud for half the year. She has two big dogs and the crates in the back, plus a kit that weighs as much as a standing person. Thirty thousand kilometres a year, and often the last two kilometres are not a road at all but a tractor rut. She washes the car every week and it still looks like it came out of a puddle, but she has never been afraid of a pothole.' } },

    { nume: 'Cătălin', varsta: 45, cat: 'offroad', buget: [8000, 18000], maxim: 22000,
      criterii: ['remorcare', 'teren', 'fiabilitate', 'piese', 'portbagaj', 'costuri'],
      ro: { ocupatie: 'constructor, firmă cu patru oameni',
        poveste: 'Are o firmă de construcții cu patru oameni și duce scule, saci de ciment și o remorcă cu placă vibratoare pe șantier. Douăzeci și cinci de mii de kilometri pe an, mare parte pe pământ răscolit de excavator, pietriș și urme de camion. Dacă mașina stă o zi în service, stau și oamenii lui, deci fiabilitatea nu e o preferință, e salariu. Vrea ceva ce se repară oriunde, inclusiv de un mecanic dintr-un sat în care a ajuns din greșeală, cu remorca plină.' },
      en: { ocupatie: 'builder with a four man firm',
        poveste: 'He runs a building firm with four people and hauls tools, bags of cement and a trailer with a plate compactor onto sites. Twenty five thousand kilometres a year, much of it over ground churned up by a digger, gravel and lorry tracks. If the car spends a day in the garage, so do his men, so reliability is not a preference, it is wages. He wants something that can be fixed anywhere, including by a mechanic in a village he ended up in by mistake with a loaded trailer.' } },

    // ---------------- mașină de oraș ----------------
    { nume: 'Georgiana', varsta: 27, cat: 'oras', buget: [4000, 9000], maxim: 11000,
      criterii: ['oras', 'gabarit', 'consum', 'portbagaj', 'costuri', 'fiabilitate'],
      ro: { ocupatie: 'curier',
        poveste: 'Face optzeci de opriri pe zi, încarcă dimineața la depozit și termină abia când se golește tot din spate. Treizeci și cinci de mii de kilometri pe an, toți în oraș, cu motorul pornit și oprit de sute de ori pe zi. Parchează pe trotuar, pe alei, în fața porților, oriunde încape pentru două minute, cu avariile pornite. O ușă glisantă i-ar schimba ziua, iar fiecare litru în plus la sută îi mănâncă direct din ce câștigă.' },
      en: { ocupatie: 'courier',
        poveste: 'She makes eighty stops a day, loads at the depot in the morning and finishes only when the back is empty. Thirty five thousand kilometres a year, all in town, with the engine started and stopped hundreds of times a day. She parks on the pavement, down alleys, in front of gates, anywhere that fits for two minutes with the hazards on. A sliding door would change her day, and every extra litre per hundred comes straight out of what she earns.' } },

    { nume: 'Larisa', varsta: 23, cat: 'oras', buget: [15000, 30000], maxim: 36000,
      criterii: ['look_tanar', 'raritate', 'tehnologie', 'oras', 'poveste', 'costuri'],
      ro: { ocupatie: 'creatoare de conținut',
        poveste: 'Mașina apare în fiecare filmare, deci contează cum arată în cadru mai mult decât cum merge pe drum. Nouă mii de kilometri pe an, prin oraș și la filmări în alt cartier, plus o parcare subterană cu rampă strâmtă. Vrea culoare, un interior care nu arată ieftin pe cameră și ceva ce nu are toată lumea în feed. Nu se pricepe la mecanică și nici nu vrea să învețe, deci orice bătaie de cap o costă direct zile de filmare.' },
      en: { ocupatie: 'content creator',
        poveste: 'The car is in every shoot, so how it looks on camera matters more than how it drives. Nine thousand kilometres a year, around town and to shoots in another neighbourhood, plus an underground car park with a tight ramp. She wants colour, an interior that does not look cheap on camera and something not everyone has in their feed. She knows nothing about mechanics and does not want to learn, so any trouble costs her shooting days.' } },

    { nume: 'Delia', varsta: 24, cat: 'oras', buget: [5000, 11000], maxim: 13000,
      criterii: ['gabarit', 'oras', 'costuri', 'consum', 'siguranta', 'fiabilitate'],
      ro: { ocupatie: 'studentă la medicină',
        poveste: 'Stă în centrul vechi, pe o stradă de doi metri și jumătate, unde parcarea e o luptă zilnică cu vecinii. Face nouă mii de kilometri pe an, spitalul, facultatea și, o dată pe lună, două sute de kilometri până acasă. Nu are garaj, nu are loc de parcare și lasă mașina pe stradă, sub un copac, uneori câte o săptămână întreagă. Vrea ceva cât mai mic și cât mai ieftin, ca să nu îi pară rău dacă i-o zgârie cineva la trei noaptea.' },
      en: { ocupatie: 'medical student',
        poveste: 'She lives in the old town, on a street two and a half metres wide, where parking is a daily fight with the neighbours. She covers nine thousand kilometres a year, the hospital, the faculty and once a month two hundred kilometres home. She has no garage, no parking space, and leaves the car on the street under a tree, sometimes for a whole week. She wants something as small and as cheap as possible, so it will not hurt if somebody scratches it at three in the morning.' } },

    // ---------------- mașina de zi cu zi ----------------
    { nume: 'Adina', varsta: 29, cat: 'zi', buget: [12000, 22000], maxim: 26000,
      criterii: ['consum', 'drum_lung', 'business', 'risc_sh', 'portbagaj', 'scaune'],
      ro: { ocupatie: 'agent de vânzări pe teren',
        poveste: 'Face patruzeci de mii de kilometri pe an prin toată țara, cu un geamantan de prezentări și mostre în portbagaj. Pleacă luni dimineața la cinci și ajunge la primul client înainte de nouă, indiferent în ce colț de țară e clientul. Motorina o plătește ea și abia apoi o decontează, deci fiecare litru se vede direct în luna ei. Trage în parcarea clientului și știe că mașina vorbește înaintea ei, dar nu are buget să impresioneze pe nimeni.' },
      en: { ocupatie: 'field sales rep',
        poveste: 'She covers forty thousand kilometres a year across the country, with a case of presentations and samples in the boot. She leaves at five on a Monday morning and reaches the first client before nine, whatever corner of the country that client is in. She pays for the diesel herself and claims it back later, so every litre shows up directly in her month. She pulls into the client car park knowing the car speaks before she does, but she has no budget to impress anyone.' } },

    { nume: 'Andreea', varsta: 30, cat: 'zi', buget: [7000, 14000], maxim: 17000,
      criterii: ['fiabilitate', 'iarna', 'noapte', 'costuri', 'siguranta', 'oras'],
      ro: { ocupatie: 'asistentă medicală, trei schimburi',
        poveste: 'Lucrează în trei schimburi, deci pleacă la cinci dimineața sau se întoarce la unsprezece noaptea, după cum pică programul. Optsprezece mii de kilometri pe an, oraș plus treizeci de kilometri de drum județean prost iluminat și plin de gropi. Mașina stă afară, neacoperită, și iarna o dezgheață cu mâna, în uniformă, înainte de tură. Nu are timp și nici bani de service neprevăzut, iar o mașină care nu pornește o costă direct ziua de lucru.' },
      en: { ocupatie: 'nurse on rotating shifts',
        poveste: 'She works rotating shifts, so she leaves at five in the morning or comes back at eleven at night, however the rota falls. Eighteen thousand kilometres a year, town plus thirty kilometres of badly lit county road full of potholes. The car stays outside, uncovered, and in winter she scrapes it by hand, in uniform, before her shift. She has no time and no money for an unexpected garage bill, and a car that will not start costs her a day of work.' } },

    { nume: 'Vasile', varsta: 64, cat: 'zi', buget: [18000, 32000], maxim: 38000,
      criterii: ['scaune', 'vizibilitate', 'fiabilitate', 'drum_lung', 'risc_sh', 'oras'],
      ro: { ocupatie: 'pensionar, fost inginer',
        poveste: 'A ieșit la pensie acum doi ani, după treizeci și opt de ani de inginerie, și asta e ultima mașină pe care o cumpără. Șapte mii de kilometri pe an, oraș și drumuri la munte cu soția, duminica, pe vreme bună, fără grabă. Îl deranjează să se lase jos în scaun, vrea să stea sus și să vadă drumul, iar spatele nu îl mai iartă după două ore. Are garaj uscat și răbdare să aleagă, dar nu vrea o mașină care să îl lase în drum la Predeal.' },
      en: { ocupatie: 'retired engineer',
        poveste: 'He retired two years ago after thirty eight years of engineering, and this is the last car he will buy. Seven thousand kilometres a year, town and trips to the mountains with his wife on Sundays, in good weather, in no hurry. He hates dropping down into a seat, he wants to sit up and see the road, and his back no longer forgives two hours. He has a dry garage and the patience to choose, but he does not want a car that strands him halfway up the mountain.' } },

    { nume: 'Bogdan', varsta: 31, cat: 'zi', buget: [6000, 12000], maxim: 15000,
      criterii: ['fiabilitate', 'costuri', 'consum', 'piese', 'vizibilitate', 'oras'],
      ro: { ocupatie: 'instructor auto',
        poveste: 'Stă opt ore pe zi în trafic, cu ambreiajul apăsat, și mașina asta îi ține familia, nu e un moft. Patruzeci și cinci de mii de kilometri pe an, toți în oraș, cu porniri și opriri la fiecare sută de metri. La fiecare o sută de mii de kilometri schimbă ambreiajul și știe pe de rost cât îl costă la fiecare marcă. Vrea vizibilitate bună, pentru că explică toată ziua ce se vede din scaun, și piese care se găsesc a doua zi.' },
      en: { ocupatie: 'driving instructor',
        poveste: 'He spends eight hours a day in traffic with the clutch down, and this car feeds his family, it is not a whim. Forty five thousand kilometres a year, all in town, starting and stopping every hundred metres. Every hundred thousand kilometres he changes the clutch and he knows by heart what it costs on each make. He wants good visibility, because he explains what you can see from the seat all day long, and parts you can get the next morning.' } },

    { nume: 'Nicolae', varsta: 58, cat: 'zi', buget: [8000, 16000], maxim: 19000,
      criterii: ['costuri', 'fiabilitate', 'consum', 'scaune', 'piese', 'portbagaj'],
      ro: { ocupatie: 'taximetrist',
        poveste: 'Conduce douăsprezece ore pe zi, șase zile pe săptămână, și schimbă mașina la trei ani, când ajunge la o jumătate de milion de kilometri. Șaptezeci de mii de kilometri pe an, numai oraș, numai opriri, cu portbagajul plin de bagaje de aeroport. Socotește totul pe kilometru: consumul, uleiul, plăcuțele, până și cauciucurile de iarnă, și știe cifrele pe de rost. Singurul lux pe care îl vrea e un scaun care să nu îi rupă spatele până la pensie.' },
      en: { ocupatie: 'taxi driver',
        poveste: 'He drives twelve hours a day, six days a week, and changes car every three years, when it reaches half a million kilometres. Seventy thousand kilometres a year, town only, stop and go, with the boot full of airport luggage. He works everything out per kilometre: fuel, oil, pads, even the winter tyres, and he knows the numbers by heart. The only luxury he wants is a seat that will not wreck his back before he retires.' } },

    // ---------------- business ----------------
    { nume: 'Dragoș', varsta: 41, cat: 'business', buget: [35000, 60000], maxim: 70000,
      criterii: ['business', 'drum_lung', 'tehnologie', 'scaune', 'discretie', 'revanzare'],
      ro: { ocupatie: 'patron de firmă de transport',
        poveste: 'A început cu o dubă cumpărată pe credit și acum are unsprezece camioane și doi oameni la dispecerat. Se duce cu mașina asta la bancă, la clienți mari și la întâlniri unde toată lumea se uită întâi în parcare, apoi la om. Douăzeci de mii de kilometri pe an, oraș și autostradă, cu parcare păzită la birou. Vrea să se vadă că i-a mers bine, dar nu suportă ideea că cineva l-ar putea numi parvenit pe la spate.' },
      en: { ocupatie: 'owner of a haulage firm',
        poveste: 'He started with a van bought on credit and now has eleven trucks and two people on dispatch. He drives this car to the bank, to big clients and to meetings where everyone looks at the car park first and the person second. Twenty thousand kilometres a year, town and motorway, with guarded parking at the office. He wants it to show that things went well, but he cannot stand the thought of anyone calling him a show off behind his back.' } },

    { nume: 'Marius', varsta: 48, cat: 'business', buget: [30000, 55000], maxim: 65000,
      criterii: ['drum_lung', 'scaune', 'consum', 'tehnologie', 'business', 'noapte'],
      ro: { ocupatie: 'director de fabrică',
        poveste: 'Face nouăzeci de kilometri pe zi între casă și fabrică, plus drumuri lunare la sediul central, la patru sute de kilometri. Cincizeci de mii de kilometri pe an, aproape toți pe autostradă, cu două telefoane pe scaunul din dreapta. Între ședințe mănâncă în mașină și răspunde la mailuri, deci scaunul și liniștea contează mai mult decât motorul. Are priză la birou și a calculat deja cât l-ar costa fiecare variantă pe an, la kilometrii lui, până la ultimul leu.' },
      en: { ocupatie: 'factory director',
        poveste: 'He does ninety kilometres a day between home and the factory, plus monthly trips to head office four hundred kilometres away. Fifty thousand kilometres a year, almost all motorway, with two phones on the passenger seat. Between meetings he eats in the car and answers emails, so the seat and the quiet matter more than the engine. He has a charger at the office and has already worked out what each option would cost him a year, at his mileage, down to the last penny.' } },

    { nume: 'Cristina', varsta: 39, cat: 'business', buget: [28000, 50000], maxim: 58000,
      criterii: ['discretie', 'scaune', 'drum_lung', 'business', 'risc_sh', 'tehnologie'],
      ro: { ocupatie: 'notar',
        poveste: 'Are birou de notariat de zece ani și clienți care vin cu dosare grele și cu nervii întinși la maximum. Nu vrea nimic care să atragă privirile în fața biroului, pentru că jumătate din clienți se uită la mașina ei și socotesc onorariul. Șaisprezece mii de kilometri pe an, oraș și drumuri la instanțe din alte județe, trei ore într-un sens. Vrea să coboare odihnită după drumul ăla și să aibă tot ce se poate avea înăuntru, fără să se vadă nimic de afară.' },
      en: { ocupatie: 'notary',
        poveste: 'She has run a notary office for ten years, with clients who arrive carrying heavy files and stretched nerves. She wants nothing that draws eyes outside the office, because half her clients look at her car and do the maths on her fee. Sixteen thousand kilometres a year, town and trips to courts in other counties, three hours each way. She wants to step out rested after that drive, with everything money can buy inside and none of it showing from outside.' } },

    // ---------------- mașina de 1.000 € ----------------
    { nume: 'Cristi', varsta: 34, cat: 'omie', buget: [600, 1400], maxim: 1800,
      criterii: ['revanzare', 'fiabilitate', 'piese', 'risc_sh', 'costuri', 'poveste'],
      ro: { ocupatie: 'samsar de mașini',
        poveste: 'Cumpără ca să vândă în două săptămâni și nu s-a atașat de nicio mașină în zece ani de meserie. O spală, o fotografiază bine la asfințit, o pune pe două site-uri și o vinde înainte să îi expire asigurarea. Are un mecanic care îi spune în zece minute dacă merită sau nu, și un ochi bun pentru ce se caută luna asta. Nu vrea cea mai bună mașină, vrea mașina care pleacă repede și cu marjă, fără surprize la prima probă de drum.' },
      en: { ocupatie: 'car trader',
        poveste: 'He buys to sell in two weeks and has not grown attached to a single car in ten years of doing this. He washes it, photographs it well at sunset, puts it on two sites and sells it before the insurance runs out. He has a mechanic who tells him in ten minutes whether it is worth it, and a good eye for what people are looking for this month. He does not want the best car, he wants the one that leaves fast and at a margin, with no surprises on the first test drive.' } },

    { nume: 'Gabi', varsta: 20, cat: 'omie', buget: [500, 1200], maxim: 1500,
      criterii: ['fiabilitate', 'piese', 'costuri', 'consum', 'portbagaj', 'siguranta'],
      ro: { ocupatie: 'muncește pe șantier',
        poveste: 'Se trezește la cinci și are treizeci de kilometri până la șantier, pe un drum de țară plin de gropi și de tractoare. Până acum mergea cu un coleg, dar colegul s-a mutat în alt oraș și acum nu mai are cu ce ajunge la muncă. Douăzeci de mii de kilometri pe an, aceeași bucată de drum, de două ori pe zi, pe orice vreme, inclusiv iarna. Nu îi trebuie decât să meargă și să încapă în spate niște scule și un sac de ciment, restul chiar nu contează.' },
      en: { ocupatie: 'works on building sites',
        poveste: 'He gets up at five and has thirty kilometres to the site, on a country road full of potholes and tractors. Until now he rode with a workmate, but the workmate moved to another town and now he has no way of getting to work. Twenty thousand kilometres a year, the same stretch of road twice a day, in any weather, winter included. All he needs is for it to run and to take some tools and a bag of cement in the back, the rest really does not matter.' } },

    { nume: 'Paula', varsta: 28, cat: 'omie', buget: [400, 1100], maxim: 1400,
      criterii: ['costuri', 'fiabilitate', 'consum', 'piese', 'gabarit', 'siguranta'],
      ro: { ocupatie: 'lucrează la o brutărie',
        poveste: 'Intră în tură la patru dimineața și face doisprezece kilometri până la brutărie, pe străzi complet goale. A împrumutat banii de la sora ei și i-a promis că îi dă înapoi până în primăvară, până la ultimul leu. Nouă mii de kilometri pe an, același drum, de două ori pe zi, iar mașina stă în stradă, în ploaie, tot anul. Nu are de gând să bage niciun leu în plus: dacă trece ITP-ul și ține un an fără reparații, e perfectă.' },
      en: { ocupatie: 'works at a bakery',
        poveste: 'She starts her shift at four in the morning and drives twelve kilometres to the bakery on completely empty streets. She borrowed the money from her sister and promised to pay it back by spring, down to the last penny. Nine thousand kilometres a year, the same road twice a day, and the car sits in the street, in the rain, all year. She has no intention of spending another penny: if it passes the test and lasts a year without repairs, it is perfect.' } },
  ];

  // Pachetul de surprize. `cat` spune la ce fel de client are sens fiecare, iar
  // runda trage doar dintre alea: la un ghid montan poate pica tracțiune integrală
  // sau gardă la sol, nu cârlig de rulotă la o mașină de oraș. Le poți mirosi, dar
  // nu le poți ști, pentru că fiecare categorie are între șase și paisprezece.
  const SURPRIZE = [
    { ro: 'tracțiune integrală', en: 'all-wheel drive', cat: ['suv', 'offroad', 'zi', 'business', 'marfa'] },
    { ro: 'cameră de mers înapoi', en: 'a reversing camera', cat: ['suv', 'business', 'zi', 'oras', 'electrica'] },
    { ro: 'trapă', en: 'a sunroof', cat: ['supercar', 'business', 'suv', 'clasica'] },
    { ro: 'cârlig de remorcare', en: 'a tow bar', cat: ['marfa', 'offroad', 'suv'] },
    { ro: 'cutie manuală', en: 'a manual gearbox', cat: ['sport', 'clasica', 'prima', 'omie'] },
    { ro: 'faruri matrix', en: 'matrix headlights', cat: ['business', 'suv', 'zi', 'electrica'] },
    { ro: 'scaune încălzite', en: 'heated seats', cat: ['zi', 'business', 'suv', 'offroad', 'electrica'] },
    { ro: 'volan încălzit', en: 'a heated steering wheel', cat: ['business', 'zi', 'electrica', 'suv'] },
    { ro: 'portbagaj peste 500 de litri', en: 'a boot over 500 litres', cat: ['marfa', 'suv', 'zi', 'oras', 'prima'] },
    { ro: 'jante mici, pe anvelope groase', en: 'small wheels on fat tyres', cat: ['zi', 'prima', 'omie', 'oras'] },
    { ro: 'culoare rară', en: 'a rare colour', cat: ['supercar', 'sport', 'clasica', 'oras'] },
    { ro: 'un singur proprietar', en: 'a single owner', cat: ['prima', 'zi', 'clasica', 'omie', 'suv'] },
    { ro: 'carte de service completă', en: 'a full service history', cat: ['prima', 'zi', 'omie', 'clasica', 'suv'] },
    { ro: 'sub 6 litri la sută', en: 'under 6 litres per hundred', cat: ['prima', 'oras', 'zi', 'omie', 'marfa'] },
    { ro: 'garanție rămasă', en: 'warranty left on it', cat: ['electrica', 'business', 'suv', 'zi'] },
    { ro: 'sistem audio de firmă', en: 'a branded sound system', cat: ['sport', 'business', 'oras', 'supercar'] },
    { ro: 'Apple CarPlay', en: 'Apple CarPlay', cat: ['oras', 'zi', 'electrica', 'business', 'prima'] },
    { ro: 'senzori de parcare', en: 'parking sensors', cat: ['oras', 'suv', 'zi', 'business'] },
    { ro: 'pilot adaptiv', en: 'adaptive cruise control', cat: ['business', 'zi', 'electrica', 'suv'] },
    { ro: 'scaune sport', en: 'sport seats', cat: ['sport', 'supercar', 'clasica'] },
    { ro: 'interior deschis la culoare', en: 'a light interior', cat: ['business', 'supercar', 'electrica', 'suv'] },
    { ro: 'cauciucuri noi', en: 'new tyres', cat: ['prima', 'omie', 'zi', 'marfa'] },
    { ro: 'distribuție schimbată', en: 'a new timing belt', cat: ['prima', 'omie', 'zi', 'clasica', 'marfa'] },
    { ro: 'tapițerie de piele', en: 'leather upholstery', cat: ['business', 'supercar', 'suv', 'clasica'] },
    { ro: 'climatronic pe zone', en: 'multi-zone climate control', cat: ['suv', 'business', 'zi'] },
    { ro: 'Isofix pe trei locuri', en: 'Isofix on three seats', cat: ['suv', 'zi', 'marfa'] },
    { ro: 'gardă la sol peste 20 cm', en: 'over 20 cm of ground clearance', cat: ['offroad', 'suv', 'marfa'] },
    { ro: 'anvelope de iarnă incluse', en: 'winter tyres included', cat: ['offroad', 'zi', 'suv', 'prima', 'omie'] },
    { ro: 'suspensie reglabilă', en: 'adjustable suspension', cat: ['sport', 'supercar', 'offroad'] },
    { ro: 'blocare de diferențial', en: 'a diff lock', cat: ['offroad'] },
    { ro: 'priză de 230V la bord', en: 'a 230V socket on board', cat: ['marfa', 'offroad', 'suv', 'electrica'] },
    { ro: 'head-up display', en: 'a head-up display', cat: ['business', 'supercar', 'electrica', 'suv'] },
    { ro: 'a doua cheie', en: 'a second key', cat: ['prima', 'omie', 'zi', 'clasica'] },
    { ro: 'sub 100.000 km', en: 'under 100,000 km', cat: ['prima', 'zi', 'omie', 'suv', 'clasica'] },
    { ro: 'motor de peste 3 litri', en: 'an engine over 3 litres', cat: ['supercar', 'sport', 'clasica', 'offroad'] },
    { ro: 'cutie automată', en: 'an automatic gearbox', cat: ['business', 'suv', 'zi', 'electrica', 'oras'] },
    { ro: 'reductor', en: 'a low range box', cat: ['offroad'] },
    { ro: 'scaun de șofer reglabil electric', en: 'an electrically adjustable driver seat', cat: ['business', 'zi', 'suv', 'marfa'] },
  ];

  const label = k => (CRIT[k] ? L(CRIT[k])[0] : k);
  const scala = k => (CRIT[k] ? L(CRIT[k])[1] : '');
  const dinCategorie = key => (key === 'mix' ? CLIENTI : CLIENTI.filter(c => c.cat === key));
  // La mix trage din tot pachetul, că nici clientul nu e ales dinainte.
  const surprizeDin = key => (key === 'mix' ? SURPRIZE : SURPRIZE.filter(s => s.cat.includes(key)));

  return { CRIT, CLIENTI, CATEGORII, SURPRIZE, label, scala, dinCategorie, surprizeDin, L, en };
})();
