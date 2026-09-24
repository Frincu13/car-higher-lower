// Cel mai bun samsar: clienții, categoriile și pachetul de surprize.
//
// Textele stau în ambele limbi aici, nu în dicționarul din i18n.js: sunt proză, nu
// etichete de interfață, și ajung și în instrucțiunea trimisă agentului, care trebuie
// scrisă în limba jucătorului. `L()` alege limba o dată, la încărcare.
//
// Un criteriu are o cheie stabilă, care ajunge în JSON-ul cerut agentului, o etichetă
// și o scală scurtă. Scala e acolo ca să dea același 8 de fiecare dată: fără ea,
// aceleași două mașini primesc alte note la a doua rulare.
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

  // Clienții. Ordinea din `criterii` e ordinea lor de importanță, de la cel mai
  // important la cel mai puțin, și din ea ies ponderile la nota a doua.
  const CLIENTI = [
    { nume: 'Iulian', varsta: 33,
      criterii: ['drum_lung', 'noapte', 'risc_sh', 'costuri', 'business', 'oras'],
      buget: [24000, 40000], maxim: 46000,
      ro: { ocupatie: 'medic, gărzi și navetă',
        context: 'Conduce mult noaptea, între spital și casă, pe drum național.',
        uz: ['20-28.000 km pe an', 'jumătate oraș, jumătate drum lung', 'foarte multe drumuri pe întuneric'],
        vrea: 'Calm și confort, dar să se simtă în control pe ploaie și pe gheață. Nimic ostentativ, trebuie să pară serios.' },
      en: { ocupatie: 'doctor, night shifts and a long commute',
        context: 'Drives a lot at night, between the hospital and home, on main roads.',
        uz: ['20,000-28,000 km a year', 'half town, half long road', 'a great deal of driving in the dark'],
        vrea: 'Calm and comfort, but in control in rain and on ice. Nothing flashy, it has to look serious.' } },

    { nume: 'Adina', varsta: 29,
      criterii: ['consum', 'drum_lung', 'business', 'risc_sh', 'portbagaj', 'scaune'],
      buget: [12000, 22000], maxim: 26000,
      ro: { ocupatie: 'agent de vânzări pe teren',
        context: 'Face 40.000 de km pe an prin toată țara, cu bagaj de prezentări în portbagaj.',
        uz: ['peste 40.000 km pe an', 'aproape numai autostradă și drum național', 'trebuie să fie la client de dimineață'],
        vrea: 'Să nu o coste o avere motorina și să arate bine în parcarea clientului.' },
      en: { ocupatie: 'field sales rep',
        context: 'Covers 40,000 km a year across the country, with demo kit in the boot.',
        uz: ['over 40,000 km a year', 'almost all motorway and main road', 'has to be at the client first thing'],
        vrea: 'Fuel must not cost a fortune, and it has to look right in the client car park.' } },

    { nume: 'Robert', varsta: 21,
      criterii: ['costuri', 'piese', 'risc_sh', 'look_tanar', 'consum', 'gabarit'],
      buget: [1800, 4000], maxim: 5000,
      ro: { ocupatie: 'student la Politehnică',
        context: 'Prima lui mașină, plătită din banii strânși vara.',
        uz: ['8.000 km pe an', 'oraș și weekenduri acasă la părinți', 'o parchează pe stradă'],
        vrea: 'Să fie ieftină de ținut, să nu îl lase și să nu îi fie rușine cu ea în fața colegilor.' },
      en: { ocupatie: 'engineering student',
        context: 'A first car, paid for with money saved over the summer.',
        uz: ['8,000 km a year', 'town, plus weekends at his parents', 'parked on the street'],
        vrea: 'Cheap to keep, it must not strand him, and he must not be embarrassed in front of friends.' } },

    { nume: 'Familia Popa', varsta: 38,
      criterii: ['familie', 'portbagaj', 'siguranta', 'costuri', 'drum_lung', 'risc_sh'],
      buget: [15000, 28000], maxim: 33000,
      ro: { ocupatie: 'doi părinți, trei copii',
        context: 'Doi copii în scaune și unul pe înălțător, plus bunica la fiecare vacanță.',
        uz: ['15.000 km pe an', 'școală, cumpărături, două drumuri lungi pe an', 'garaj la casă'],
        vrea: 'Să încapă toți cu bagaje, fără să se certe nimeni pe cotieră.' },
      en: { ocupatie: 'two parents, three children',
        context: 'Two children in car seats, one on a booster, and grandma on every holiday.',
        uz: ['15,000 km a year', 'school, shopping, two long trips a year', 'a garage at the house'],
        vrea: 'Everyone plus luggage has to fit, with nobody fighting over the armrest.' } },

    { nume: 'Cătălin', varsta: 45,
      criterii: ['remorcare', 'teren', 'fiabilitate', 'piese', 'portbagaj', 'costuri'],
      buget: [8000, 18000], maxim: 22000,
      ro: { ocupatie: 'constructor, firmă mică',
        context: 'Cară scule, materiale și o remorcă cu utilaj pe șantier.',
        uz: ['25.000 km pe an', 'drumuri de șantier, noroi, pietriș', 'trage remorcă de două tone'],
        vrea: 'Să nu se blocheze nicăieri și să o repare oricine, oriunde.' },
      en: { ocupatie: 'builder with a small firm',
        context: 'Hauls tools, materials and a plant trailer onto sites.',
        uz: ['25,000 km a year', 'site tracks, mud, gravel', 'tows a two-tonne trailer'],
        vrea: 'It must not get stuck anywhere, and anyone anywhere should be able to fix it.' } },

    { nume: 'Ștefania', varsta: 26,
      criterii: ['oras', 'gabarit', 'costuri', 'look_tanar', 'tehnologie', 'consum'],
      buget: [9000, 18000], maxim: 21000,
      ro: { ocupatie: 'designer, lucrează de acasă',
        context: 'Iese cu mașina de trei ori pe săptămână, mai mult prin oraș.',
        uz: ['6.000 km pe an', 'aproape numai oraș', 'priză în parcarea blocului'],
        vrea: 'Ceva mic, ieftin de ținut și drăguț, pe care îl parchează oriunde.' },
      en: { ocupatie: 'designer, works from home',
        context: 'Takes the car out three times a week, mostly around town.',
        uz: ['6,000 km a year', 'almost entirely town', 'a socket in the block car park'],
        vrea: 'Something small, cheap to keep and good looking, that parks anywhere.' } },

    { nume: 'Domnul Vasile', varsta: 64,
      criterii: ['scaune', 'vizibilitate', 'fiabilitate', 'drum_lung', 'risc_sh', 'oras'],
      buget: [18000, 32000], maxim: 38000,
      ro: { ocupatie: 'pensionar, fost inginer',
        context: 'Ultima lui mașină, o vrea pe cea la care a visat toată viața.',
        uz: ['7.000 km pe an', 'oraș și drumuri la munte', 'garaj uscat'],
        vrea: 'Confort, poziție înaltă la volan și să nu îl lase în drum.' },
      en: { ocupatie: 'retired engineer',
        context: 'His last car, and he wants the one he dreamed about all his life.',
        uz: ['7,000 km a year', 'town and trips to the mountains', 'a dry garage'],
        vrea: 'Comfort, a high driving position, and it must never leave him stranded.' } },

    { nume: 'Alex', varsta: 24,
      criterii: ['distractie', 'sunet', 'manevrabil', 'look_tanar', 'poveste', 'piese'],
      buget: [8000, 16000], maxim: 20000,
      ro: { ocupatie: 'lucrează în IT, primul salariu bun',
        context: 'Vrea prima mașină care să îl bage în seamă la întâlnirile de duminică.',
        uz: ['12.000 km pe an', 'oraș în timpul săptămânii, drumuri cu curbe în weekend', 'fără garaj'],
        vrea: 'Ceva cu tracțiune spate, sunet și caracter. Fiabilitatea e negociabilă.' },
      en: { ocupatie: 'works in IT, first decent salary',
        context: 'Wants the first car that gets him noticed at the Sunday meets.',
        uz: ['12,000 km a year', 'town during the week, twisty roads at weekends', 'no garage'],
        vrea: 'Something rear-wheel drive, with a sound and some character. Reliability is negotiable.' } },

    { nume: 'Mihaela', varsta: 35,
      criterii: ['teren', 'portbagaj', 'fiabilitate', 'iarna', 'piese', 'costuri'],
      buget: [10000, 20000], maxim: 24000,
      ro: { ocupatie: 'medic veterinar la țară',
        context: 'Merge la ferme, pe drumuri de pământ, cu doi câini mari în spate.',
        uz: ['30.000 km pe an', 'drumuri de țară, noroi jumătate de an', 'spală mașina săptămânal'],
        vrea: 'Să ajungă oriunde, să încapă cuștile și să nu îi fie frică de o groapă.' },
      en: { ocupatie: 'country vet',
        context: 'Drives out to farms on dirt roads with two big dogs in the back.',
        uz: ['30,000 km a year', 'country roads, mud half the year', 'washes the car weekly'],
        vrea: 'It has to get anywhere, swallow the crates, and not fear a pothole.' } },

    { nume: 'Dragoș', varsta: 41,
      criterii: ['business', 'drum_lung', 'tehnologie', 'scaune', 'discretie', 'revanzare'],
      buget: [35000, 60000], maxim: 70000,
      ro: { ocupatie: 'patron de firmă de transport',
        context: 'Vrea mașina cu care se duce la bancă și la clienți mari.',
        uz: ['20.000 km pe an', 'oraș și autostradă', 'parcare păzită'],
        vrea: 'Impresie puternică fără să pară parvenit. Interior peste tot ce a avut.' },
      en: { ocupatie: 'owner of a haulage firm',
        context: 'Wants the car he drives to the bank and to his big clients.',
        uz: ['20,000 km a year', 'town and motorway', 'a guarded car park'],
        vrea: 'A strong impression without looking like a show-off. An interior better than anything he has had.' } },

    { nume: 'Bogdan', varsta: 31,
      criterii: ['fiabilitate', 'costuri', 'consum', 'piese', 'vizibilitate', 'oras'],
      buget: [6000, 12000], maxim: 15000,
      ro: { ocupatie: 'instructor auto',
        context: 'Mașina asta îi ține familia, opt ore pe zi în trafic.',
        uz: ['45.000 km pe an', 'numai oraș, numai ambreiaj', 'stă mai mult în mașină decât acasă'],
        vrea: 'Să nu se strice, să consume puțin și să fie ieftină la piese. Restul nu contează.' },
      en: { ocupatie: 'driving instructor',
        context: 'This car feeds his family, eight hours a day in traffic.',
        uz: ['45,000 km a year', 'town only, clutch only', 'he is in it more than he is at home'],
        vrea: 'It must not break, must drink little and have cheap parts. Nothing else matters.' } },

    { nume: 'Carmen', varsta: 37,
      criterii: ['portbagaj', 'business', 'drum_lung', 'risc_sh', 'iarna', 'consum'],
      buget: [14000, 25000], maxim: 30000,
      ro: { ocupatie: 'fotograf de nuntă',
        context: 'Cară echipament scump la evenimente, ajunge și pe drumuri de țară la biserici.',
        uz: ['25.000 km pe an', 'weekenduri lungi, drumuri mixte', 'încarcă și descarcă de zece ori pe zi'],
        vrea: 'Portbagaj mare care se închide cu cheie și o mașină care arată curat la un eveniment.' },
      en: { ocupatie: 'wedding photographer',
        context: 'Carries expensive kit to events, and ends up on country lanes to churches.',
        uz: ['25,000 km a year', 'long weekends, mixed roads', 'loads and unloads ten times a day'],
        vrea: 'A big boot that locks, and a car that looks clean pulling up at an event.' } },

    { nume: 'Paul', varsta: 28,
      criterii: ['manevrabil', 'iarna', 'fiabilitate', 'piese', 'accelerare', 'poveste'],
      buget: [12000, 25000], maxim: 30000,
      ro: { ocupatie: 'programator, pasionat de raliuri',
        context: 'Merge la etape de amatori în weekend și la birou în restul timpului.',
        uz: ['15.000 km pe an', 'oraș plus câteva mii de km pe drumuri închise', 'are unde lucra la ea'],
        vrea: 'Ceva cu tracțiune integrală și potențial, care să reziste la bătaie.' },
      en: { ocupatie: 'programmer, into rallying',
        context: 'Runs amateur stages at weekends and drives to the office the rest of the time.',
        uz: ['15,000 km a year', 'town plus a few thousand km on closed roads', 'has somewhere to work on it'],
        vrea: 'Something all-wheel drive with potential, that takes a beating.' } },

    { nume: 'Larisa', varsta: 23,
      criterii: ['look_tanar', 'raritate', 'tehnologie', 'oras', 'poveste', 'costuri'],
      buget: [15000, 30000], maxim: 36000,
      ro: { ocupatie: 'creatoare de conținut',
        context: 'Mașina apare în fiecare filmare, deci contează cum arată în cadru.',
        uz: ['9.000 km pe an', 'oraș și drumuri scurte la filmări', 'parcare subterană'],
        vrea: 'Culoare, interior care se filmează bine și ceva ce nu are toată lumea.' },
      en: { ocupatie: 'content creator',
        context: 'The car is in every shoot, so how it looks on camera matters.',
        uz: ['9,000 km a year', 'town and short drives to shoots', 'underground parking'],
        vrea: 'Colour, an interior that films well, and something not everyone has.' } },

    { nume: 'Sorin', varsta: 52,
      criterii: ['poveste', 'raritate', 'revanzare', 'sunet', 'risc_sh', 'distractie'],
      buget: [20000, 45000], maxim: 55000,
      ro: { ocupatie: 'colecționar de mașini vechi',
        context: 'Caută a șaptea mașină din garaj, una pe care să o conducă duminica.',
        uz: ['3.000 km pe an', 'ieșiri de duminică pe vreme bună', 'garaj cu încălzire'],
        vrea: 'Originalitate, poveste și o mașină care crește în valoare.' },
      en: { ocupatie: 'classic car collector',
        context: 'Looking for the seventh car in the garage, one to drive on Sundays.',
        uz: ['3,000 km a year', 'Sunday runs in good weather', 'a heated garage'],
        vrea: 'Originality, a story, and a car that goes up in value.' } },

    { nume: 'Andreea', varsta: 30,
      criterii: ['fiabilitate', 'iarna', 'noapte', 'costuri', 'siguranta', 'oras'],
      buget: [7000, 14000], maxim: 17000,
      ro: { ocupatie: 'asistentă medicală, trei schimburi',
        context: 'Pleacă la 5 dimineața și se întoarce noaptea, oricât de urât ar fi afară.',
        uz: ['18.000 km pe an', 'oraș și 30 km de drum județean', 'parchează pe stradă, neacoperit'],
        vrea: 'Să pornească de fiecare dată, să fie caldă repede și sigură noaptea.' },
      en: { ocupatie: 'nurse on rotating shifts',
        context: 'Leaves at five in the morning and comes back at night, whatever the weather.',
        uz: ['18,000 km a year', 'town plus 30 km of county road', 'parked outside, uncovered'],
        vrea: 'It must start every time, warm up fast and feel safe at night.' } },

    { nume: 'Cristi', varsta: 34,
      criterii: ['revanzare', 'risc_sh', 'piese', 'costuri', 'look_tanar', 'consum'],
      buget: [5000, 12000], maxim: 15000,
      ro: { ocupatie: 'samsar de mașini',
        context: 'Cumpără ca să vândă în două săptămâni, nu ca să țină.',
        uz: ['lună de lună alta', 'drumuri de aducere din străinătate', 'are mecanic de încredere'],
        vrea: 'Ceva ce se vinde repede și cu marjă, fără surprize la prima revizie.' },
      en: { ocupatie: 'car trader',
        context: 'Buys to sell in two weeks, not to keep.',
        uz: ['a different one every month', 'import runs from abroad', 'has a mechanic he trusts'],
        vrea: 'Something that sells fast and at a margin, with no surprises at the first service.' } },

    { nume: 'Tudor', varsta: 39,
      criterii: ['teren', 'iarna', 'portbagaj', 'fiabilitate', 'remorcare', 'piese'],
      buget: [12000, 24000], maxim: 28000,
      ro: { ocupatie: 'ghid montan',
        context: 'Duce turiști la cabane, pe drumuri forestiere, cu rucsacuri și schiuri.',
        uz: ['22.000 km pe an', 'jumătate drum forestier, zăpadă cinci luni pe an', 'lanțuri în portbagaj'],
        vrea: 'Gardă la sol, tracțiune și un portbagaj în care intră șase rucsacuri.' },
      en: { ocupatie: 'mountain guide',
        context: 'Takes tourists up to cabins on forest tracks, with rucksacks and skis.',
        uz: ['22,000 km a year', 'half forest track, snow five months a year', 'chains in the boot'],
        vrea: 'Ground clearance, traction, and a boot that swallows six rucksacks.' } },

    { nume: 'Georgiana', varsta: 27,
      criterii: ['oras', 'gabarit', 'consum', 'portbagaj', 'costuri', 'fiabilitate'],
      buget: [4000, 9000], maxim: 11000,
      ro: { ocupatie: 'curier în oraș',
        context: 'Optzeci de opriri pe zi, mereu în căutare de loc de parcare.',
        uz: ['35.000 km pe an, toți în oraș', 'pornește și oprește de sute de ori pe zi', 'încarcă dimineața la depozit'],
        vrea: 'Mică, ieftină, cu portbagaj surprinzător de mare și ușă glisantă dacă se poate.' },
      en: { ocupatie: 'city courier',
        context: 'Eighty stops a day, always hunting for a parking space.',
        uz: ['35,000 km a year, all in town', 'starts and stops hundreds of times a day', 'loads at the depot each morning'],
        vrea: 'Small, cheap, with a surprisingly big load space and a sliding door if possible.' } },

    { nume: 'Marius', varsta: 48,
      criterii: ['drum_lung', 'scaune', 'consum', 'tehnologie', 'business', 'noapte'],
      buget: [30000, 55000], maxim: 65000,
      ro: { ocupatie: 'director de fabrică',
        context: 'Face naveta 90 de km pe zi, plus drumuri la sediul central.',
        uz: ['50.000 km pe an', 'aproape numai autostradă', 'parcare la birou cu priză'],
        vrea: 'Liniște, scaune bune și cost pe kilometru mic. Să poată lucra din ea în pauze.' },
      en: { ocupatie: 'factory director',
        context: 'Commutes 90 km a day, plus trips to head office.',
        uz: ['50,000 km a year', 'almost all motorway', 'office parking with a charger'],
        vrea: 'Quiet, good seats and a low cost per kilometre. He wants to work from it between meetings.' } },

    { nume: 'Ana', varsta: 32,
      criterii: ['autonomie', 'incarcare', 'oras', 'tehnologie', 'costuri', 'risc_sh'],
      buget: [18000, 35000], maxim: 42000,
      ro: { ocupatie: 'arhitectă, oraș mare',
        context: 'Vrea să treacă pe electric, dar se teme să nu rămână pe drum.',
        uz: ['14.000 km pe an', 'oraș plus un drum de 300 km pe lună', 'priză în garajul blocului'],
        vrea: 'Autonomie reală care să nu o mintă și încărcare rapidă pe drumul spre părinți.' },
      en: { ocupatie: 'architect in a big city',
        context: 'Wants to go electric but is afraid of being left on the road.',
        uz: ['14,000 km a year', 'town plus one 300 km trip a month', 'a socket in the block garage'],
        vrea: 'Real range that does not lie to her, and fast charging on the road to her parents.' } },

    { nume: 'Nicolae', varsta: 58,
      criterii: ['costuri', 'fiabilitate', 'consum', 'scaune', 'piese', 'portbagaj'],
      buget: [8000, 16000], maxim: 19000,
      ro: { ocupatie: 'taximetrist',
        context: 'Mașina merge 12 ore pe zi, șase zile pe săptămână.',
        uz: ['70.000 km pe an', 'numai oraș, numai opriri', 'schimbă mașina la trei ani'],
        vrea: 'Cost pe kilometru cât mai mic și un scaun care să nu îi rupă spatele.' },
      en: { ocupatie: 'taxi driver',
        context: 'The car runs 12 hours a day, six days a week.',
        uz: ['70,000 km a year', 'town only, stop and go', 'changes car every three years'],
        vrea: 'The lowest possible cost per kilometre and a seat that will not wreck his back.' } },

    { nume: 'Elena', varsta: 36,
      criterii: ['siguranta', 'familie', 'portbagaj', 'oras', 'risc_sh', 'costuri'],
      buget: [13000, 24000], maxim: 28000,
      ro: { ocupatie: 'proaspătă mămică',
        context: 'Primul copil, primul scaun de copil, prima grijă de fiecare dată când pornește.',
        uz: ['10.000 km pe an', 'oraș, pediatru, vizite la bunici', 'parcare la bloc, înghesuită'],
        vrea: 'Siguranță înainte de orice, plus un portbagaj în care intră căruciorul fără luptă.' },
      en: { ocupatie: 'new mother',
        context: 'First child, first car seat, a new worry every time she sets off.',
        uz: ['10,000 km a year', 'town, the paediatrician, visits to grandparents', 'a tight space at the block'],
        vrea: 'Safety before anything, plus a boot the pram goes into without a fight.' } },

    { nume: 'Vlad', varsta: 44,
      criterii: ['distractie', 'sunet', 'accelerare', 'manevrabil', 'raritate', 'poveste'],
      buget: [60000, 120000], maxim: 150000,
      ro: { ocupatie: 'chirurg, are deja două mașini',
        context: 'Caută jucăria de weekend, fără compromisuri de practicitate.',
        uz: ['4.000 km pe an', 'drumuri cu curbe pe vreme bună', 'garaj cu loc liber'],
        vrea: 'Emoție pură. Nu îl interesează portbagajul, consumul sau spațiul din spate.' },
      en: { ocupatie: 'surgeon who already owns two cars',
        context: 'Looking for the weekend toy, with no practicality compromises.',
        uz: ['4,000 km a year', 'twisty roads in good weather', 'a free bay in the garage'],
        vrea: 'Pure feeling. He does not care about the boot, the fuel bill or the back seats.' } },
  ];

  // Categoriile: aceeași rundă, dar arbitrul judecă pentru o clasă de mașini, nu
  // pentru un om. Criteriile sunt ale categoriei, iar bugetul e al rundei.
  const CATEGORII = [
    { criterii: ['accelerare', 'sunet', 'raritate', 'look_tanar', 'manevrabil', 'poveste'],
      buget: [80000, 250000], maxim: 400000,
      ro: { nume: 'Supercar', tag: 'fără compromisuri', desc: 'Mașina care oprește traficul. Portbagajul și consumul nu contează deloc.' },
      en: { nume: 'Supercar', tag: 'no compromises', desc: 'The car that stops traffic. The boot and the fuel bill do not matter at all.' } },

    { criterii: ['distractie', 'manevrabil', 'sunet', 'piese', 'fiabilitate', 'look_tanar'],
      buget: [6000, 18000], maxim: 22000,
      ro: { nume: 'Sport accesibil', tag: 'distracție pe bani puțini', desc: 'Cea mai multă plăcere pe euro. Tracțiune spate dacă se poate, dar nu obligatoriu.' },
      en: { nume: 'Affordable sports car', tag: 'fun on little money', desc: 'The most fun per euro. Rear-wheel drive if possible, but not required.' } },

    { criterii: ['familie', 'portbagaj', 'siguranta', 'drum_lung', 'costuri', 'iarna'],
      buget: [15000, 35000], maxim: 42000,
      ro: { nume: 'SUV de familie', tag: 'cinci locuri, vacanță', desc: 'Mașina pentru toată familia, care duce și bagajele, și bunicii.' },
      en: { nume: 'Family SUV', tag: 'five seats, holiday ready', desc: 'The car for the whole family, that carries the luggage and the grandparents too.' } },

    { criterii: ['costuri', 'piese', 'fiabilitate', 'consum', 'siguranta', 'gabarit'],
      buget: [1200, 4000], maxim: 5000,
      ro: { nume: 'Prima mașină', tag: 'sub 4.000 de euro', desc: 'Ieftină de cumpărat, ieftină de ținut, suficient de sigură cât să dormi liniștit.' },
      en: { nume: 'First car', tag: 'under 4,000 euro', desc: 'Cheap to buy, cheap to keep, and safe enough that you sleep at night.' } },

    { criterii: ['poveste', 'raritate', 'revanzare', 'risc_sh', 'sunet', 'piese'],
      buget: [5000, 40000], maxim: 60000,
      ro: { nume: 'Clasică', tag: 'mașină cu istorie', desc: 'Peste 25 de ani, originalitate care contează, o mașină pe care o cumperi cu inima.' },
      en: { nume: 'Classic', tag: 'a car with history', desc: 'Over 25 years old, originality that counts, a car you buy with your heart.' } },

    { criterii: ['autonomie', 'incarcare', 'costuri', 'tehnologie', 'oras', 'risc_sh'],
      buget: [12000, 45000], maxim: 55000,
      ro: { nume: 'Electrică', tag: 'fără benzinărie', desc: 'Cea mai bună mașină electrică pe banii ăștia, judecată pe autonomia reală, nu pe cea din broșură.' },
      en: { nume: 'Electric', tag: 'no petrol station', desc: 'The best electric car for the money, judged on real range, not the brochure figure.' } },

    { criterii: ['portbagaj', 'remorcare', 'consum', 'fiabilitate', 'drum_lung', 'costuri'],
      buget: [4000, 16000], maxim: 20000,
      ro: { nume: 'Break de marfă', tag: 'cară tot', desc: 'Portbagaj cât o dubă, dar să se conducă tot ca o mașină.' },
      en: { nume: 'Workhorse estate', tag: 'carries everything', desc: 'A van-sized boot, but it still has to drive like a car.' } },

    { criterii: ['teren', 'iarna', 'fiabilitate', 'remorcare', 'piese', 'poveste'],
      buget: [8000, 30000], maxim: 40000,
      ro: { nume: 'Off-road serios', tag: 'unde se termină asfaltul', desc: 'Reductor, blocaje, gardă la sol. Confortul e un bonus, nu o cerință.' },
      en: { nume: 'Serious off-roader', tag: 'where the tarmac ends', desc: 'Low range, diff locks, ground clearance. Comfort is a bonus, not a requirement.' } },

    { criterii: ['costuri', 'fiabilitate', 'drum_lung', 'oras', 'consum', 'risc_sh'],
      buget: [10000, 20000], maxim: 24000,
      ro: { nume: 'Mașina de zi cu zi', tag: '10.000 - 20.000 €', desc: 'Cea mai echilibrată mașină din buget. Nimic spectaculos, nimic prost.' },
      en: { nume: 'Everyday car', tag: '10,000 - 20,000 €', desc: 'The most balanced car in the budget. Nothing spectacular, nothing bad.' } },

    { criterii: ['fiabilitate', 'piese', 'costuri', 'poveste', 'consum', 'siguranta'],
      buget: [400, 1200], maxim: 1600,
      ro: { nume: 'Mașina de 1.000 de euro', tag: 'cel mai greu test', desc: 'O mie de euro. Trebuie să pornească, să treacă ITP-ul și să te ducă acasă.' },
      en: { nume: 'The 1,000 euro car', tag: 'the hardest test', desc: 'One thousand euro. It has to start, pass the test and get you home.' } },
  ];

  // Pachetul de surprize: se trag două pe rundă, se arată codate și se dezvăluie
  // abia în tabel. Cuvintele stau fără diacritice, ca să se codeze curat.
  const SURPRIZE = [
    { ro: 'awd', en: 'awd' },
    { ro: 'camera', en: 'camera' },
    { ro: 'trapa', en: 'sunroof' },
    { ro: 'carlig', en: 'tow bar' },
    { ro: 'cutie manuala', en: 'manual gearbox' },
    { ro: 'faruri matrix', en: 'matrix headlights' },
    { ro: 'scaune incalzite', en: 'heated seats' },
    { ro: 'volan incalzit', en: 'heated wheel' },
    { ro: 'portbagaj mare', en: 'big boot' },
    { ro: 'jante mici', en: 'small wheels' },
    { ro: 'culoare rara', en: 'rare colour' },
    { ro: 'un proprietar', en: 'one owner' },
    { ro: 'carte de service', en: 'service history' },
    { ro: 'consum mic', en: 'low fuel use' },
    { ro: 'garantie', en: 'warranty' },
    { ro: 'sistem audio', en: 'sound system' },
    { ro: 'carplay', en: 'carplay' },
    { ro: 'senzori parcare', en: 'parking sensors' },
    { ro: 'pilot adaptiv', en: 'adaptive cruise' },
    { ro: 'scaune sport', en: 'sport seats' },
    { ro: 'interior deschis', en: 'light interior' },
    { ro: 'cauciucuri noi', en: 'new tyres' },
    { ro: 'distributie schimbata', en: 'new timing belt' },
    { ro: 'piele', en: 'leather' },
    { ro: 'climatronic', en: 'climate control' },
    { ro: 'scaun de copil', en: 'child seat' },
    { ro: 'garda la sol', en: 'ground clearance' },
    { ro: 'anvelope de iarna', en: 'winter tyres' },
    { ro: 'suspensie reglabila', en: 'adjustable suspension' },
    { ro: 'blocare diferential', en: 'diff lock' },
    { ro: 'priza de 230v', en: '230v socket' },
    { ro: 'head up display', en: 'head up display' },
    { ro: 'cheie de rezerva', en: 'spare key' },
    { ro: 'sub 100000 km', en: 'under 100000 km' },
    { ro: 'motor mare', en: 'big engine' },
    { ro: 'cutie automata', en: 'automatic gearbox' },
  ];

  // Codul: fiecare literă mutată cu 3 în față. Agentul scade 3 ca să afle cuvântul.
  const ROT = 3;
  const shift = (s, by) => s.replace(/[a-z]/g, c =>
    String.fromCharCode((c.charCodeAt(0) - 97 + by + 26) % 26 + 97));
  const codeaza = s => shift(s, ROT);
  const decodeaza = s => shift(s, -ROT);

  const label = k => (CRIT[k] ? L(CRIT[k])[0] : k);
  const scala = k => (CRIT[k] ? L(CRIT[k])[1] : '');

  return { CRIT, CLIENTI, CATEGORII, SURPRIZE, ROT, codeaza, decodeaza, label, scala, L, en };
})();
