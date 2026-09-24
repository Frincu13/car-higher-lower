// Cel mai bun samsar: clienții, categoriile și pachetul de surprize.
//
// Un criteriu are o cheie stabilă, care ajunge în JSON-ul cerut agentului, o etichetă
// și o scală scurtă. Scala e acolo ca să dea același 8 de fiecare dată: fără ea,
// aceleași două mașini primesc alte note la a doua rulare.
window.SAMSAR = (() => {
  'use strict';

  const CRIT = {
    drum_lung:   ['confort pe drum lung',        '10 = faci 600 km fără să simți; 5 = obositor după 3 ore; 1 = te doare spatele'],
    oras:        ['confort în oraș',             '10 = mic, vizibil, parchează singur; 5 = descurcabil; 1 = coșmar la fiecare parcare'],
    noapte:      ['siguranță și faruri noaptea', '10 = matrix sau laser plus asistenți; 5 = LED simplu; 1 = halogen și niciun asistent'],
    risc_sh:     ['risc mic la second hand',     '10 = un proprietar, istoric complet, motor fără vicii știute; 5 = normal; 1 = loterie'],
    costuri:     ['costuri reale de ținut',      '10 = foarte ieftin, consum mic și piese ieftine; 5 = mediu; 1 = te mănâncă lunar'],
    business:    ['aspect serios',               '10 = intri cu ea la o întâlnire de afaceri; 5 = neutru; 1 = te face de râs'],
    familie:     ['spațiu pentru familie',       '10 = trei scaune de copil în spate lejer; 5 = merge la nevoie; 1 = nu încape nimeni'],
    portbagaj:   ['portbagaj',                   '10 = cară o mutare; 5 = cumpărături de săptămână; 1 = un rucsac'],
    siguranta:   ['siguranță pasivă',            '10 = 5 stele recente și airbaguri peste tot; 5 = decent; 1 = caroserie veche fără nimic'],
    distractie:  ['cât de distractivă e',        '10 = zâmbești pe orice drum cu curbe; 5 = corectă; 1 = electrocasnic'],
    sunet:       ['sunetul motorului',           '10 = ți se face pielea de găină; 5 = se aude ceva; 1 = aspirator sau tăcere'],
    accelerare:  ['accelerare',                  '10 = sub 4 secunde; 5 = în jur de 8; 1 = peste 12'],
    manevrabil:  ['cum se simte în curbe',       '10 = chirurgical; 5 = sigur dar plat; 1 = se lasă pe o parte'],
    raritate:    ['cât de rară e',               '10 = o vezi o dată pe an; 5 = o întâlnești des; 1 = e la fiecare colț'],
    fiabilitate: ['fiabilitate',                 '10 = motor legendar, nu se strică; 5 = normal; 1 = e cunoscută că se rupe'],
    consum:      ['consum',                      '10 = sub 5 litri; 5 = în jur de 8; 1 = peste 14'],
    iarna:       ['iarnă și vreme rea',          '10 = tracțiune integrală, gardă bună, încălzire peste tot; 5 = se descurcă; 1 = rămâi în prima pantă'],
    teren:       ['cât de serios merge pe teren', '10 = blocaje și reductor; 5 = drum forestier; 1 = se oprește la prima bordură'],
    remorcare:   ['tras remorcă',                '10 = peste 2,5 tone frânat și cârlig montat; 5 = o remorcă mică; 1 = nici vorbă'],
    tehnologie:  ['tehnologie la bord',          '10 = tot ce există în anul ăla; 5 = ecran și cameră; 1 = radio cu CD'],
    piese:       ['piese și service ieftin',     '10 = găsești piese în orice sat; 5 = comandă de o săptămână; 1 = piese aduse din altă țară'],
    revanzare:   ['cât de ușor o vinzi înapoi',  '10 = zboară într-o zi; 5 = o lună; 1 = rămâi cu ea'],
    look_tanar:  ['cât de bine arată',           '10 = întorc capul după ea; 5 = curată și îngrijită; 1 = tristă'],
    discretie:   ['cât de discretă e',           '10 = nu o bagă nimeni în seamă; 5 = neutră; 1 = țipă de la un kilometru'],
    autonomie:   ['autonomie reală',             '10 = peste 450 km fără grijă; 5 = în jur de 250; 1 = sub 150'],
    incarcare:   ['încărcare',                   '10 = peste 150 kW și priză trifazică; 5 = mediu; 1 = doar din priza de perete'],
    gabarit:     ['gabarit mic',                 '10 = intră oriunde; 5 = normală; 1 = nu încape în parcarea blocului'],
    poveste:     ['poveste și caracter',         '10 = are ceva de povestit la fiecare întâlnire; 5 = o mașină; 1 = nimic de zis despre ea'],
    scaune:      ['scaunele',                    '10 = te țin bine și sunt reglabile electric; 5 = corecte; 1 = banchetă de autobuz'],
    vizibilitate:['vizibilitate din scaun',      '10 = vezi tot, stâlpi subțiri; 5 = normală; 1 = tragi cu urechea la senzori'],
  };

  // Clienții. Ordinea din `criterii` e ordinea lor de importanță, de la cel mai
  // important la cel mai puțin, și din ea ies ponderile la nota a doua.
  const CLIENTI = [
    { nume: 'Iulian', varsta: 33, ocupatie: 'medic, gărzi și navetă',
      context: 'Conduce mult noaptea, între spital și casă, pe drum național.',
      uz: ['20-28.000 km pe an', 'jumătate oraș, jumătate drum lung', 'foarte multe drumuri pe întuneric'],
      vrea: 'Calm și confort, dar să se simtă în control pe ploaie și pe gheață. Nimic ostentativ, trebuie să pară serios.',
      buget: [24000, 40000], maxim: 46000,
      criterii: ['drum_lung', 'noapte', 'risc_sh', 'costuri', 'business', 'oras'] },

    { nume: 'Adina', varsta: 29, ocupatie: 'agent de vânzări pe teren',
      context: 'Face 40.000 de km pe an prin toată țara, cu bagaj de prezentări în portbagaj.',
      uz: ['peste 40.000 km pe an', 'aproape numai autostradă și drum național', 'darme la client de dimineață'],
      vrea: 'Să nu o coste o avere motorina și să arate bine în parcarea clientului.',
      buget: [12000, 22000], maxim: 26000,
      criterii: ['consum', 'drum_lung', 'business', 'risc_sh', 'portbagaj', 'scaune'] },

    { nume: 'Robert', varsta: 21, ocupatie: 'student la Politehnică',
      context: 'Prima lui mașină, plătită din banii strânși vara.',
      uz: ['8.000 km pe an', 'oraș și weekenduri acasă la părinți', 'o parchează pe stradă'],
      vrea: 'Să fie ieftină de ținut, să nu îl lase și să nu îi fie rușine cu ea în fața colegilor.',
      buget: [1800, 4000], maxim: 5000,
      criterii: ['costuri', 'piese', 'risc_sh', 'look_tanar', 'consum', 'gabarit'] },

    { nume: 'Familia Popa', varsta: 38, ocupatie: 'doi părinți, trei copii',
      context: 'Doi copii în scaune și unul pe înălțător, plus bunica la fiecare vacanță.',
      uz: ['15.000 km pe an', 'școală, cumpărături, două drumuri lungi pe an', 'garaj la casă'],
      vrea: 'Să încapă toți cu bagaje, fără să se certe nimeni pe cotieră.',
      buget: [15000, 28000], maxim: 33000,
      criterii: ['familie', 'portbagaj', 'siguranta', 'costuri', 'drum_lung', 'risc_sh'] },

    { nume: 'Cătălin', varsta: 45, ocupatie: 'constructor, firmă mică',
      context: 'Cară scule, materiale și o remorcă cu utilaj pe șantier.',
      uz: ['25.000 km pe an', 'drumuri de șantier, noroi, pietriș', 'trage remorcă de două tone'],
      vrea: 'Să nu se blocheze nicăieri și să o repare oricine, oriunde.',
      buget: [8000, 18000], maxim: 22000,
      criterii: ['remorcare', 'teren', 'fiabilitate', 'piese', 'portbagaj', 'costuri'] },

    { nume: 'Ștefania', varsta: 26, ocupatie: 'designer, lucrează de acasă',
      context: 'Iese cu mașina de trei ori pe săptămână, mai mult prin oraș.',
      uz: ['6.000 km pe an', 'aproape numai oraș', 'priză în parcarea blocului'],
      vrea: 'Ceva mic, ieftin de ținut și drăguț, pe care îl parchează oriunde.',
      buget: [9000, 18000], maxim: 21000,
      criterii: ['oras', 'gabarit', 'costuri', 'look_tanar', 'tehnologie', 'consum'] },

    { nume: 'Domnul Vasile', varsta: 64, ocupatie: 'pensionar, fost inginer',
      context: 'Ultima lui mașină, o vrea pe cea la care a visat toată viața.',
      uz: ['7.000 km pe an', 'oraș și drumuri la munte cu nevasta', 'garaj uscat'],
      vrea: 'Confort, poziție înaltă la volan și să nu îl lase în drum.',
      buget: [18000, 32000], maxim: 38000,
      criterii: ['scaune', 'vizibilitate', 'fiabilitate', 'drum_lung', 'risc_sh', 'oras'] },

    { nume: 'Alex', varsta: 24, ocupatie: 'lucrează în IT, primul salariu bun',
      context: 'Vrea prima mașină care să îl bage în seamă la întâlnirile de mașini de duminică.',
      uz: ['12.000 km pe an', 'oraș în timpul săptămânii, drumuri cu curbe în weekend', 'fără garaj'],
      vrea: 'Ceva cu tracțiune spate, sunet și caracter. Fiabilitatea e negociabilă.',
      buget: [8000, 16000], maxim: 20000,
      criterii: ['distractie', 'sunet', 'manevrabil', 'look_tanar', 'poveste', 'piese'] },

    { nume: 'Mihaela', varsta: 35, ocupatie: 'medic veterinar la țară',
      context: 'Merge la ferme, pe drumuri de pământ, cu doi câini mari în spate.',
      uz: ['30.000 km pe an', 'drumuri de țară, noroi jumătate de an', 'spală mașina săptămânal'],
      vrea: 'Să ajungă oriunde, să încapă cuștile și să nu îi fie frică de o groapă.',
      buget: [10000, 20000], maxim: 24000,
      criterii: ['teren', 'portbagaj', 'fiabilitate', 'iarna', 'piese', 'costuri'] },

    { nume: 'Dragoș', varsta: 41, ocupatie: 'patron de firmă de transport',
      context: 'Vrea mașina cu care se duce la bancă și la clienți mari.',
      uz: ['20.000 km pe an', 'oraș și autostradă', 'parcare păzită'],
      vrea: 'Impresie puternică fără să pară parvenit. Interior peste tot ce a avut.',
      buget: [35000, 60000], maxim: 70000,
      criterii: ['business', 'drum_lung', 'tehnologie', 'scaune', 'discretie', 'revanzare'] },

    { nume: 'Bogdan', varsta: 31, ocupatie: 'instructor auto',
      context: 'Mașina asta îi ține familia, opt ore pe zi în trafic.',
      uz: ['45.000 km pe an', 'numai oraș, numai ambreiaj', 'stă mai mult în mașină decât acasă'],
      vrea: 'Să nu se strice, să consume puțin și să fie ieftină la piese. Restul nu contează.',
      buget: [6000, 12000], maxim: 15000,
      criterii: ['fiabilitate', 'costuri', 'consum', 'piese', 'vizibilitate', 'oras'] },

    { nume: 'Carmen', varsta: 37, ocupatie: 'fotograf de nuntă',
      context: 'Cară echipament scump la evenimente, ajunge și pe drumuri de țară la biserici.',
      uz: ['25.000 km pe an', 'weekenduri lungi, drumuri mixte', 'încarcă și descarcă de zece ori pe zi'],
      vrea: 'Portbagaj mare care se închide cu cheie și o mașină care arată curat la un eveniment.',
      buget: [14000, 25000], maxim: 30000,
      criterii: ['portbagaj', 'business', 'drum_lung', 'risc_sh', 'iarna', 'consum'] },

    { nume: 'Paul', varsta: 28, ocupatie: 'programator, pasionat de raliuri',
      context: 'Merge la etape de amatori în weekend și la birou în restul timpului.',
      uz: ['15.000 km pe an', 'oraș plus câteva mii de km pe drumuri închise', 'are unde lucra la ea'],
      vrea: 'Ceva cu tracțiune integrală și potențial, care să reziste la bătaie.',
      buget: [12000, 25000], maxim: 30000,
      criterii: ['manevrabil', 'iarna', 'fiabilitate', 'piese', 'accelerare', 'poveste'] },

    { nume: 'Larisa', varsta: 23, ocupatie: 'creatoare de conținut',
      context: 'Mașina apare în fiecare filmare, deci contează cum arată în cadru.',
      uz: ['9.000 km pe an', 'oraș și drumuri scurte la filmări', 'parcare subterană'],
      vrea: 'Culoare, interior care se filmează bine și ceva ce nu are toată lumea.',
      buget: [15000, 30000], maxim: 36000,
      criterii: ['look_tanar', 'raritate', 'tehnologie', 'oras', 'poveste', 'costuri'] },

    { nume: 'Sorin', varsta: 52, ocupatie: 'colecționar de mașini vechi',
      context: 'Caută a șaptea mașină din garaj, una pe care să o conducă duminica.',
      uz: ['3.000 km pe an', 'ieșiri de duminică pe vreme bună', 'garaj cu încălzire'],
      vrea: 'Originalitate, poveste și o mașină care crește în valoare.',
      buget: [20000, 45000], maxim: 55000,
      criterii: ['poveste', 'raritate', 'revanzare', 'sunet', 'risc_sh', 'distractie'] },

    { nume: 'Andreea', varsta: 30, ocupatie: 'asistentă medicală, trei schimburi',
      context: 'Pleacă la 5 dimineața și se întoarce noaptea, oricât de urât ar fi afară.',
      uz: ['18.000 km pe an', 'oraș și 30 km de drum județean', 'parchează pe stradă, neacoperit'],
      vrea: 'Să pornească de fiecare dată, să fie caldă repede și sigură noaptea.',
      buget: [7000, 14000], maxim: 17000,
      criterii: ['fiabilitate', 'iarna', 'noapte', 'costuri', 'siguranta', 'oras'] },

    { nume: 'Cristi', varsta: 34, ocupatie: 'samsar de mașini',
      context: 'Cumpără ca să vândă în două săptămâni, nu ca să țină.',
      uz: ['lună de lună alta', 'drumuri de aducere din străinătate', 'are mecanic de încredere'],
      vrea: 'Ceva ce se vinde repede și cu marjă, fără surprize la prima revizie.',
      buget: [5000, 12000], maxim: 15000,
      criterii: ['revanzare', 'risc_sh', 'piese', 'costuri', 'look_tanar', 'consum'] },

    { nume: 'Tudor', varsta: 39, ocupatie: 'ghid montan',
      context: 'Duce turiști la cabane, pe drumuri forestiere, cu rucsacuri și schiuri.',
      uz: ['22.000 km pe an', 'jumătate drum forestier, zăpadă cinci luni pe an', 'lanțuri în portbagaj'],
      vrea: 'Gardă la sol, tracțiune și un portbagaj în care intră șase rucsacuri.',
      buget: [12000, 24000], maxim: 28000,
      criterii: ['teren', 'iarna', 'portbagaj', 'fiabilitate', 'remorcare', 'piese'] },

    { nume: 'Georgiana', varsta: 27, ocupatie: 'curier în oraș',
      context: 'Optzeci de opriri pe zi, mereu în căutare de loc de parcare.',
      uz: ['35.000 km pe an, toți în oraș', 'pornește și oprește de sute de ori pe zi', 'încarcă dimineața la depozit'],
      vrea: 'Mică, ieftină, cu portbagaj surprinzător de mare și ușă glisantă dacă se poate.',
      buget: [4000, 9000], maxim: 11000,
      criterii: ['oras', 'gabarit', 'consum', 'portbagaj', 'costuri', 'fiabilitate'] },

    { nume: 'Marius', varsta: 48, ocupatie: 'director de fabrică',
      context: 'Face naveta 90 de km pe zi, plus drumuri la sediul central.',
      uz: ['50.000 km pe an', 'aproape numai autostradă', 'parcare la birou cu priză'],
      vrea: 'Liniște, scaune bune și cost pe kilometru mic. Să poată lucra din ea în pauze.',
      buget: [30000, 55000], maxim: 65000,
      criterii: ['drum_lung', 'scaune', 'consum', 'tehnologie', 'business', 'noapte'] },

    { nume: 'Ana', varsta: 32, ocupatie: 'arhitectă, oraș mare',
      context: 'Vrea să treacă pe electric, dar se teme să nu rămână pe drum.',
      uz: ['14.000 km pe an', 'oraș plus un drum de 300 km pe lună', 'priză în garajul blocului'],
      vrea: 'Autonomie reală care să nu o mintă și încărcare rapidă pe drumul spre părinți.',
      buget: [18000, 35000], maxim: 42000,
      criterii: ['autonomie', 'incarcare', 'oras', 'tehnologie', 'costuri', 'risc_sh'] },

    { nume: 'Nicolae', varsta: 58, ocupatie: 'taximetrist',
      context: 'Mașina merge 12 ore pe zi, șase zile pe săptămână.',
      uz: ['70.000 km pe an', 'numai oraș, numai opriri', 'schimbă mașina la trei ani'],
      vrea: 'Cost pe kilometru cât mai mic și un scaun care să nu îi rupă spatele.',
      buget: [8000, 16000], maxim: 19000,
      criterii: ['costuri', 'fiabilitate', 'consum', 'scaune', 'piese', 'portbagaj'] },

    { nume: 'Elena', varsta: 36, ocupatie: 'proaspătă mămică',
      context: 'Primul copil, primul scaun de copil, prima grijă de fiecare dată când pornește.',
      uz: ['10.000 km pe an', 'oraș, pediatru, vizite la bunici', 'parcare la bloc, înghesuită'],
      vrea: 'Siguranță înainte de orice, plus un portbagaj în care intră căruciorul fără luptă.',
      buget: [13000, 24000], maxim: 28000,
      criterii: ['siguranta', 'familie', 'portbagaj', 'oras', 'risc_sh', 'costuri'] },

    { nume: 'Vlad', varsta: 44, ocupatie: 'chirurg, are deja două mașini',
      context: 'Caută jucăria de weekend, fără compromisuri de practicitate.',
      uz: ['4.000 km pe an', 'drumuri cu curbe pe vreme bună', 'garaj cu loc liber'],
      vrea: 'Emoție pură. Nu îl interesează portbagajul, consumul sau spațiul din spate.',
      buget: [60000, 120000], maxim: 150000,
      criterii: ['distractie', 'sunet', 'accelerare', 'manevrabil', 'raritate', 'poveste'] },
  ];

  // Categoriile: aceeași rundă, dar arbitrul judecă pentru o clasă de mașini, nu
  // pentru un om. Criteriile sunt ale categoriei, iar bugetul e al rundei.
  const CATEGORII = [
    { nume: 'Supercar', tag: 'fără compromisuri',
      desc: 'Mașina care oprește traficul. Portbagajul și consumul nu contează deloc.',
      buget: [80000, 250000], maxim: 400000,
      criterii: ['accelerare', 'sunet', 'raritate', 'look_tanar', 'manevrabil', 'poveste'] },

    { nume: 'Sport accesibil', tag: 'distracție pe bani puțini',
      desc: 'Cea mai multă plăcere pe euro. Tracțiune spate dacă se poate, dar nu obligatoriu.',
      buget: [6000, 18000], maxim: 22000,
      criterii: ['distractie', 'manevrabil', 'sunet', 'piese', 'fiabilitate', 'look_tanar'] },

    { nume: 'SUV de familie', tag: 'cinci locuri, vacanță',
      desc: 'Mașina pentru toată familia, care duce și bagajele, și bunicii.',
      buget: [15000, 35000], maxim: 42000,
      criterii: ['familie', 'portbagaj', 'siguranta', 'drum_lung', 'costuri', 'iarna'] },

    { nume: 'Prima mașină', tag: 'sub 4.000 de euro',
      desc: 'Ieftină de cumpărat, ieftină de ținut, suficient de sigură cât să dormi liniștit.',
      buget: [1200, 4000], maxim: 5000,
      criterii: ['costuri', 'piese', 'fiabilitate', 'consum', 'siguranta', 'gabarit'] },

    { nume: 'Clasică', tag: 'mașină cu istorie',
      desc: 'Peste 25 de ani, originalitate care contează, o mașină pe care o cumperi cu inima.',
      buget: [5000, 40000], maxim: 60000,
      criterii: ['poveste', 'raritate', 'revanzare', 'risc_sh', 'sunet', 'piese'] },

    { nume: 'Electrică', tag: 'fără benzinărie',
      desc: 'Cea mai bună mașină electrică pe banii ăștia, judecată pe autonomia reală, nu pe cea din broșură.',
      buget: [12000, 45000], maxim: 55000,
      criterii: ['autonomie', 'incarcare', 'costuri', 'tehnologie', 'oras', 'risc_sh'] },

    { nume: 'Break de marfă', tag: 'cară tot',
      desc: 'Portbagaj cât o dubă, dar să se conducă tot ca o mașină.',
      buget: [4000, 16000], maxim: 20000,
      criterii: ['portbagaj', 'remorcare', 'consum', 'fiabilitate', 'drum_lung', 'costuri'] },

    { nume: 'Off-road serios', tag: 'unde se termină asfaltul',
      desc: 'Reductor, blocaje, gardă la sol. Confortul e un bonus, nu o cerință.',
      buget: [8000, 30000], maxim: 40000,
      criterii: ['teren', 'iarna', 'fiabilitate', 'remorcare', 'piese', 'poveste'] },

    { nume: 'Mașina de zi cu zi', tag: '10.000 - 20.000 €',
      desc: 'Cea mai echilibrată mașină din buget. Nimic spectaculos, nimic prost.',
      buget: [10000, 20000], maxim: 24000,
      criterii: ['costuri', 'fiabilitate', 'drum_lung', 'oras', 'consum', 'risc_sh'] },

    { nume: 'Mașina de 1.000 de euro', tag: 'cel mai greu test',
      desc: 'O mie de euro. Trebuie să pornească, să treacă ITP-ul și să te ducă acasă.',
      buget: [400, 1200], maxim: 1600,
      criterii: ['fiabilitate', 'piese', 'costuri', 'poveste', 'consum', 'siguranta'] },
  ];

  // Pachetul de surprize: se trag două pe rundă, se arată codate și se dezvăluie
  // abia în tabel. Cuvintele stau fără diacritice, ca să se decodeze curat.
  const SURPRIZE = [
    'awd', 'camera', 'trapa', 'carlig', 'cutie manuala', 'faruri matrix', 'scaune incalzite',
    'volan incalzit', 'portbagaj mare', 'jante mici', 'culoare rara', 'un proprietar',
    'carte de service', 'consum mic', 'garantie', 'sistem audio', 'carplay', 'senzori parcare',
    'pilot adaptiv', 'scaune sport', 'interior deschis', 'cauciucuri noi', 'distributie schimbata',
    'piele', 'climatronic', 'scaun de copil', 'garda la sol', 'anvelope de iarna',
    'suspensie reglabila', 'blocare diferential', 'priza de 230v', 'head up display',
    'cheie de rezerva', 'sub 100000 km', 'motor mare', 'cutie automata',
  ];

  // Codul: fiecare literă mutată cu 3 în față. Agentul scade 3 ca să afle cuvântul.
  const ROT = 3;
  const shift = (s, by) => s.replace(/[a-z]/g, c =>
    String.fromCharCode((c.charCodeAt(0) - 97 + by + 26) % 26 + 97));
  const codeaza = s => shift(s, ROT);
  const decodeaza = s => shift(s, -ROT);

  const label = k => (CRIT[k] || [k, ''])[0];
  const scala = k => (CRIT[k] || ['', ''])[1];

  return { CRIT, CLIENTI, CATEGORII, SURPRIZE, ROT, codeaza, decodeaza, label, scala };
})();
