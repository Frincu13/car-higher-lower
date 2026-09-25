// Romanian is the source language: every string in the pages and in the game code is
// written in Romanian, and this file holds the English version of each one. The page is
// translated after it is built, and a MutationObserver catches everything the games
// render later, so the game code itself needs no translation calls.
window.I18n = (() => {
  'use strict';

  const EN = {
    // ---- shared UI ----
    'Jocuri FRQ': 'FRQ Games',
    'Despre FRQ': 'About FRQ',
    'FRQ, toate jocurile': 'FRQ, all games',
    '← Jocuri': '← Games',
    '← Meniu': '← Menu',
    'Meniu': 'Menu',
    'Înapoi la meniul jocului': 'Back to the game menu',
    'Joacă': 'Play',
    'Start': 'Start',
    'Din nou': 'Again',
    'Revanșă': 'Rematch',
    'Alți jucători': 'New players',
    'Mai departe': 'Next',
    'Următoarea': 'Next',
    'Rezultat': 'Result',
    'Final': 'Final',
    'Scor': 'Score',
    'Record': 'Best',
    'Runda': 'Round',
    'Runde': 'Rounds',
    'Categorie': 'Category',
    'Categorii': 'Categories',
    'Categorie nouă': 'New category',
    'Record nou!': 'New best!',
    'mașină pusă la locul ei': 'car in the right place',
    'mașini puse la locul lor': 'cars in the right place',
    'răspuns corect': 'correct answer',
    'răspunsuri corecte': 'correct answers',
    'Copiat': 'Copied',
    'Distribuie': 'Share',
    'Egalitate': 'Draw',
    'Foto:': 'Photo:',
    'decupată': 'cropped',
    'domeniu public': 'public domain',
    'Jucător 1': 'Player 1',
    'Jucător 2': 'Player 2',
    '+ Jucător': '+ Player',
    'Mod': 'Mode',
    'Cronometru': 'Timer',
    'Timp': 'Time',
    'Fără': 'Off',
    'Fără limită de timp': 'No time limit',
    'Pe fiecare mașină': 'For each car',
    'Pe fiecare alegere': 'For each pick',
    '10 secunde': '10 seconds',
    '15 secunde': '15 seconds',
    '20 de secunde': '20 seconds',
    'Singur': 'Solo',
    '1 la 1': 'Head to head',
    'Amestec': 'Mix',

    'Mixt': 'Mixed',
    'CP': 'hp',
    'Liber': 'Free',
    'Mai puternică sus': 'More power on top',
    'Mai grea sus': 'Heavier on top',
    'Mai rapidă sus': 'Faster on top',
    '▲ Mai puternică': '▲ More power',
    '▼ Mai slabă': '▼ Less power',
    '▲ Mai grea': '▲ Heavier',
    '▼ Mai ușoară': '▼ Lighter',
    '▲ Mai rapidă': '▲ Faster',
    '▼ Mai lentă': '▼ Slower',

    // ---- car kinds ----
    'Sport de zi cu zi': 'Everyday sport',
    'SUV & off-road': 'SUV & off-road',
    'Sport': 'Sports car',
    'Supercar': 'Supercar',
    'Hypercar': 'Hypercar',
    'Clasică': 'Classic',
    'Americană': 'American muscle',
    'Lux & GT': 'Luxury & GT',

    // ---- grades ----
    'Putere': 'Power',
    'Cuplu': 'Torque',
    'Greutate': 'Weight',
    'Viteză maximă': 'Top speed',
    'Accelerație': 'Acceleration',
    'Manevrabilitate': 'Handling',
    'Frânare': 'Braking',
    'Off-road': 'Off-road',
    'Cai putere': 'Horsepower',
    'Caii de sub capotă.': 'The horses under the bonnet.',
    'Forța care te lipește de scaun la plecare.': 'The shove that pins you to the seat.',
    'Mai ușoară, notă mai mare.': 'Lighter means a higher grade.',
    'Cât poate prinde.': 'How fast it can go.',
    '0-100 km/h.': '0-100 km/h.',
    'Cum ține virajele.': 'How it holds a corner.',
    'Cât de scurt oprește.': 'How short it stops.',
    'Pe pământ, nisip și iarbă.': 'On dirt, sand and grass.',

    // ---- hub ----
    'Alege': 'Pick',
    'jocul': 'a game',
    'Jocuri cu mașini: Sus sau jos, Mașina perfectă, Turometrul, În ordine, Garaj sau presă și Licitația.':
      'Car games: Higher or Lower, The Perfect Car, The Rev Counter, In Order, Garage or Crusher and The Auction.',
    'Jocurile anterioare': 'Previous games',
    'Jocurile următoare': 'Next games',
    '1 jucător': '1 player',
    '2 jucători, același ecran': '2 players, one screen',
    '2+ jucători, echipă': '2+ players, as a team',
    'Singur sau 1 la 1': 'Solo or head to head',
    'Pentru orice discuție': 'Made for arguments',
    '1 la 1, același telefon': 'Head to head, one phone',
    'Mai mulți cai sau mai puțini? Mai grea sau mai ușoară? O greșeală și s-a terminat.':
      'More horses or fewer? Heavier or lighter? One mistake and it is over.',
    '3 categorii și provocarea zilei': '3 categories and a daily challenge',
    'Două mașini pe rundă, opt sloturi de umplut. Cea mai bună combinație câștigă.':
      'Two cars a round, eight slots to fill. The best line-up wins.',
    '8 runde, notă din 10': '8 rounds, graded out of 10',
    'Unul pune o mașină pe turometru, restul ghicesc unde. Cu cât mai aproape, cu atât mai bine.':
      'One player sets a car on the dial, the rest guess where. The closer, the better.',
    'Pentru grup, 6-12 runde': 'For a group, 6-12 rounds',
    'Fiecare mașină nouă intră la locul ei în clasament. Cu cât crește lista, cu atât e mai strâns.':
      'Every new car slots into the ranking. The longer the list, the tighter it gets.',
    'Cai putere, greutate, 0-100': 'Horsepower, weight, 0-100',
    'Trei mașini: una în garaj, una la vânzare, una la presă. Fără răspuns corect, doar alegeri grele.':
      'Three cars: one to keep, one to sell, one to crush. No right answer, only hard calls.',
    '9 teme': '9 themes',
    '10 milioane fiecare, 12 mașini pe masă. Licitați pe rând, apoi mașinile voastre se bat pe categorii.':
      '10 million each, 12 cars on the block. Bid in turns, then your cars fight over categories.',
    '12 mașini, 4 categorii': '12 cars, 4 categories',
    'Porsche 911 Turbo S aurie': 'A gold Porsche 911 Turbo S',
    'Ferrari F40 roșu în mers': 'A red Ferrari F40 on the move',
    'BMW M1 Procar în culorile BMW Motorsport': 'A BMW M1 Procar in BMW Motorsport colours',
    'Botul unui Porsche 911 Turbo S': 'The nose of a Porsche 911 Turbo S',
    'Un Ferrari F40 în mers': 'A Ferrari F40 on the move',
    'Un BMW M1 Procar': 'A BMW M1 Procar',
    'Mașini presate la un parc de dezmembrări': 'Crushed cars at a scrapyard',
    'Silueta unui supercar ieșind din întuneric': 'A supercar emerging from the dark',
    'Mașini parcate în șir, noaptea': 'Cars parked in a row at night',
    'Mașini clasice într-un garaj vechi': 'Classic cars in an old garage',
    'Un Ferrari F40 pe scena unei licitații': 'A Ferrari F40 on an auction stage',
    'Porsche 911 GT3 RS într-un studio întunecat': 'A Porsche 911 GT3 RS in a dark studio',
    'Turometrul unei mașini': 'A car rev counter',
    'Supercaruri parcate în șir': 'Supercars parked in a row',
    'Stivă de mașini presate la un parc de dezmembrări': 'A stack of crushed cars at a scrapyard',
    'Mașini de colecție într-o sală de licitații': 'Collector cars in an auction hall',

    // ---- Sus sau jos ----
    'Sus sau Jos | FRQ': 'Higher or Lower | FRQ',
    'Sus sau jos': 'Higher or Lower',
    'Sus': 'Higher',
    'sau': 'or',
    'jos': 'Lower',
    'Următoarea mașină stă mai sus sau mai jos? O greșeală și s-a terminat.':
      'Does the next car sit higher or lower? One mistake and it is over.',
    'Ghicește care mașină are mai mulți cai putere, e mai grea sau prinde mai repede suta.':
      'Guess which car has more horsepower, weighs more or hits 100 km/h sooner.',
    'Provocarea zilei': 'Daily challenge',
    'Mai mulți CP': 'More hp',
    'Mai puțini CP': 'Fewer hp',
    'Mai grea': 'Heavier',
    'Mai ușoară': 'Lighter',
    'Mai lentă': 'Slower',
    'Mai rapidă': 'Faster',
    'Se schimbă din mers': 'Changes as you go',
    'Final de cursă': 'Race over',
    'Copiază scorul': 'Copy score',

    // ---- Mașina perfectă ----
    'Mașina Perfectă | FRQ': 'The Perfect Car | FRQ',
    'Mașina perfectă': 'The Perfect Car',
    'Mașina': 'Perfect',
    'perfectă': 'Car',
    'Jocuri FRQ · 2 jucători': 'FRQ Games · 2 players',
    'Două mașini pe rundă: una pentru tine, una pentru celălalt. Opt sloturi, o singură mașină perfectă.':
      'Two cars a round: one for you, one for the other. Eight slots, one perfect car.',
    'Cine e la rând ia o mașină și o pune într-un slot. Celălalt primește ce rămâne.':
      'Whoever is on turn takes a car and drops it in a slot. The other gets what is left.',
    'Nota depinde de slot: un supercar ia mult la putere și puțin la off-road.':
      'The grade depends on the slot: a supercar scores high on power and low off-road.',
    'Câștigă media mai mare.': 'The better average wins.',
    'Joc pentru 2 jucători pe același dispozitiv: alegeți pe rând mașini și construiți mașina perfectă.':
      'A game for 2 players on one device: take turns picking cars and build the perfect car.',
    'Rândul lui': 'Turn',
    'Rămâne la': 'Goes to',
    'Nota în acest slot': 'Grade in this slot',
    'Cel mai bun slot': 'Best slot',
    'Aranjare perfectă': 'Perfect fit',
    'Câștigă': 'Winner',

    // ---- Turometrul ----
    'Turometrul | FRQ': 'The Rev Counter | FRQ',
    'Turometrul': 'The Rev Counter',
    'unde e acul': 'where the needle sits',
    'Jocuri FRQ · 2 sau mai mulți jucători': 'FRQ Games · 2 players or more',
    'Unul pune o mașină pe turometru, restul ghicesc unde. Un telefon, toată gașca.':
      'One player sets a car on the dial, the rest guess where. One phone, the whole crew.',
    'Joc de grup cu mașini: unul alege o mașină și o așază pe turometru, ceilalți ghicesc unde a pus-o.':
      'A car party game: one player puts a car on the dial, the others guess where it landed.',
    'O axă, de exemplu': 'An axis, for example',
    'Mașină de bunic ↔ Mașină de interlop': 'Grandpa car ↔ Gangster car',
    ', și 4 mașini din care alegi una.': ', and 4 cars to pick one from.',
    'Pui acul pe ascuns. Restul ghicesc unde.': 'You set the needle in secret. The rest guess where.',
    'Cu cât mai aproape, cu atât mai multe puncte: 4, 3, 2 sau 0.':
      'The closer you are, the more points: 4, 3, 2 or 0.',
    'Scor echipă': 'Team score',
    'Poziția acului': 'Needle position',
    'Altele': 'Others',
    'Telefonul la': 'Phone to',
    'echipă': 'the team',
    'Echipa': 'The team',
    'Foarte aproape': 'So close',
    'Sunteți pe aceeași turație. Vă știți gândurile.': 'Same revs, same mind. You read each other.',
    'Ați prins bine turația în cele mai multe runde.': 'You read the revs right in most rounds.',
    'Mai e de lucru la sincronizare.': 'The sync still needs work.',
    'Fiecare a mers pe alt drum.': 'Everyone drove a different road.',

    // axes
    'Discretă': 'Discreet',
    'Toată strada se uită după ea': 'The whole street stares',
    'Nebunie curată': 'Pure madness',
    'Uitată de toți': 'Forgotten by everyone',
    'Legendă': 'A legend',
    'Parchezi oriunde': 'Parks anywhere',
    'Nu încape în nicio parcare': 'Fits in no parking space',
    'O împrumuți oricui': 'You would lend it to anyone',
    'Nu o împrumuți nimănui': 'You would lend it to no one',
    'Sună a mașină de cusut': 'Sounds like a sewing machine',
    'Sună a avion de vânătoare': 'Sounds like a fighter jet',
    'Cumperi cu mintea': 'Bought with your head',
    'Cumperi cu inima': 'Bought with your heart',
    'Stă mai mult în service': 'Lives at the mechanic',
    'Nu moare niciodată': 'Never dies',
    'Nu o recunoaște nimeni': 'Nobody recognises it',
    'O recunoaște și un copil': 'Even a kid knows it',
    'Pentru drum la țară': 'For a country road',
    'Pentru Monaco': 'For Monaco',
    'Strică prima întâlnire': 'Ruins a first date',
    'Garantează a doua întâlnire': 'Guarantees a second date',
    'Nu o fură nimeni': 'Nobody would steal it',
    'Prima pe lista hoților': 'First on the thief list',
    'Confortabilă': 'Comfortable',
    'Te doare spatele după 10 km': 'Your back hurts after 10 km',
    'Mașina din copilăria ta': 'The car from your childhood',
    'Mașina din viitor': 'The car from the future',
    'Merge prin zăpadă': 'Goes through snow',
    'Stă în garaj toată iarna': 'Stays in the garage all winter',
    'Pe asfalt e acasă': 'At home on tarmac',
    'În noroi e acasă': 'At home in the mud',
    'Ieftină la service': 'Cheap to service',
    'Te lasă sărac la service': 'Servicing leaves you broke',
    'Mașină de bunic': 'Grandpa car',
    'Mașină de interlop': 'Gangster car',
    'Mașină de profesor': 'Teacher car',
    'Mașină de rapper': 'Rapper car',
    'Șofer răbdător': 'Patient driver',
    'Claxonează când se face verde': 'Honks the second it turns green',
    'Mașină de oraș': 'City car',
    'Mașină de autostradă': 'Motorway car',
    'Mașină de taxi': 'Taxi car',
    'Mașină de colecție': 'Collector car',
    'Mașină de familie': 'Family car',
    'Mașină de burlac': 'Bachelor car',
    'Mașina stagiarului': 'The intern car',
    'Mașina șefului': 'The boss car',
    'Nu știe ce e driftul': 'Never heard of drifting',
    'Născută pentru drift': 'Born to drift',
    'Pur și simplu veche': 'Just old',
    'Retro și cool': 'Retro and cool',
    'Clasică de muzeu': 'Museum classic',
    'Clasică de condus zilnic': 'Daily driven classic',
    'Arată îmbătrânită': 'Looks its age',
    'Arată bine și azi': 'Still looks good today',
    'Supercar de fotbalist': 'Footballer supercar',
    'Supercar de colecționar': 'Collector supercar',
    'Costă cât o garsonieră': 'Costs as much as a flat',
    'Costă cât un bloc': 'Costs as much as a block',
    'Pentru Instagram': 'For Instagram',
    'Pentru pistă': 'For the track',
    'O conduce oricine': 'Anyone can drive it',
    'Doar un pilot o stăpânește': 'Only a racer can tame it',
    'SUV de mers la mall': 'Mall run SUV',
    'SUV de aventură': 'Adventure SUV',

    // ---- În ordine ----
    'În ordine | FRQ': 'In Order | FRQ',
    'În ordine': 'In Order',
    'În': 'In',
    'ordine': 'Order',
    'Jocuri FRQ · singur sau 1 la 1': 'FRQ Games · solo or head to head',
    'Fiecare mașină nouă intră la locul ei în clasament. Cu cât crește lista, cu atât e mai strâns. O greșeală și s-a terminat.':
      'Every new car slots into the ranking. The longer the list, the tighter it gets. One mistake and it is over.',
    'Pune fiecare mașină nouă la locul ei în clasament: după cai putere, greutate sau 0-100. Singur sau 1 la 1.':
      'Slot every new car into the ranking: by horsepower, weight or 0-100. Solo or head to head.',
    'Clasament după': 'Rank by',
    'Clasament': 'Ranking',
    'Clasament; derulează ca să alegi locul': 'Ranking; scroll to pick the spot',
    'Aici': 'Here',
    'Mai puternică': 'More power',
    'Mai slabă': 'Less power',
    'Cât de lung îl faci': 'How long can you make it',
    'Pe rând, pe același telefon': 'Taking turns on one phone',
    'Puse': 'Placed',

    // ---- Garaj sau presă ----
    'Garaj sau presă | FRQ': 'Garage or Crusher | FRQ',
    'Garaj sau presă': 'Garage or Crusher',
    'Garaj': 'Garage',
    'sau presă': 'or crusher',
    'Jocuri FRQ · singur sau cu prietenii': 'FRQ Games · alone or with friends',
    'Trei mașini. Una intră în garaj, una o vinzi, una merge la presă. Fără răspuns corect, doar alegeri grele.':
      'Three cars. One goes in the garage, one you sell, one goes to the crusher. No right answer, only hard calls.',
    'Trei mașini: una în garaj, una la vânzare, una la presă. Tu alegi.':
      'Three cars: one to keep, one to sell, one to crush. You decide.',
    'Tema': 'Theme',
    'Ce faci cu ea': 'What you do with it',
    'Vânzare': 'Sell',
    'Presă': 'Crush',
    'De vânzare': 'For sale',
    'Gata': 'Done',
    'Încă 3': '3 more',
    'GARAJ SAU PRESĂ': 'GARAGE OR CRUSHER',

    // ---- Licitația ----
    'Licitația | FRQ': 'The Auction | FRQ',
    'Licitația': 'The Auction',
    'la ciocan': 'under the hammer',
    'Lici': 'Auc',
    'tația': 'tion',
    'Jocuri FRQ · 1 la 1': 'FRQ Games · head to head',
    '10 milioane fiecare, 12 mașini la licitație, 4 pentru fiecare, 10 secunde pe tură. Apoi mașinile voastre se bat pe 4 categorii, fiecare categorie câștigată aduce 5 mil.':
      '10 million each, 12 cars up for auction, 4 apiece, 10 seconds a turn. Then your cars fight over 4 categories, and each category won pays 5 mil.',
    'Doi jucători, 10 milioane fiecare, 12 mașini la licitație. Apoi mașinile se bat pe categorii.':
      'Two players, 10 million each, 12 cars up for auction. Then the cars fight over categories.',
    'Lot': 'Lot',
    'Se joacă pe': 'Playing for',
    'După licitație': 'After the auction',
    'Două categorii le știți. Celelalte două apar după licitație.':
      'You know two categories. The other two show up after the auction.',
    'Începe licitația': 'Start the auction',
    'Preț de pornire': 'Starting price',
    'Ofertă de la': 'Bid by',
    'nu o vrea': 'does not want it',
    'Nimeni nu o vrea': 'Nobody wants it',
    'Vândut lui': 'Sold to',
    'Vândut': 'Sold',
    'Nevândut': 'Unsold',
    'Renunț': 'Pass',
    'Ultima mașină': 'Last car',
    'Licitație încheiată': 'Auction over',
    'Categoriile finale': 'The final categories',
    'Acum fiecare își pune mașinile pe categorii, pe ascuns.':
      'Now each of you places their cars on the categories, in secret.',
    'Așezare': 'Placing',
    'Pe ascuns': 'In secret',
    'Lock in': 'Lock in',
    'Bani rămași': 'Cash left',
    'Premii': 'Prizes',
    'Nicio mașină încă': 'No cars yet',

    // ---- Cel mai bun samsar ----
    'Cel mai bun samsar | FRQ': 'The Best Dealer | FRQ',
    'Cel mai bun samsar': 'The best dealer',
    'Cel mai bun': 'The best',
    'samsar': 'dealer',
    'Cumperi de pe un anunț real și ceri prețul tău. Clientul ia o singură mașină, iar diferența e banii echipei.':
      'You buy from a real listing and name your price. The client takes one car only, and the difference is your team money.',
    'Jocuri': 'Games',
    'Primești un client cu poveste și un buget. Fiecare aduce un anunț real. Un agent AI dă notele, tu vezi cine a găsit mașina potrivită.':
      'You get a client with a story and a budget. Each of you brings a real listing. An AI agent does the scoring, you see who found the right car.',
    'Jocuri FRQ · 2 jucători · cu un agent AI': 'FRQ Games · 2 players · with an AI agent',
    'Pe echipe, cu un agent AI': 'In teams, with an AI agent',
    '1 la 1 până la 4 la 4': '1 v 1 up to 4 v 4',
    'Un rând de mașini aliniate într-un parc auto': 'A row of cars lined up on a dealer lot',
    'Categoria': 'Category',
    'Categoria de client': 'Client category',
    'Alegi ce fel de client vrei, iar cine iese din categorie se vede abia după Start. Fiecare aduce un anunț real și un agent AI dă notele.':
      'You pick what kind of client you want, and who comes out of the category is only revealed after Start. Each of you brings a real listing and an AI agent does the scoring.',
    'Copiaz-o și lipește-o în ChatGPT, Claude sau ce agent folosești. Trebuie să poată deschide linkuri. Cele două surprize sunt acoperite aici, dar se copiază odată cu textul.':
      'Copy it and paste it into ChatGPT, Claude or whichever agent you use. It has to be able to open links. The two surprises are covered up here, but they are copied along with the text.',
    '← Categorii': '← Categories',
    '← Client': '← Client',
    'Două surprize, dezvăluite la final': 'Two surprises, revealed at the end',
    'Verdict': 'Verdict',
    'Tabel': 'Table',
    'Istoric': 'History',
    'Nicio rundă jucată încă.': 'No rounds played yet.',
    'Două echipe de samsari. Cumperi de pe un anunț real și ceri prețul tău. Clientul ia o singură mașină, iar diferența intră în buzunarul echipei.':
      'Two teams of dealers. You buy from a real listing and name your price. The client takes one car only, and the difference goes into your team pocket.',
    'Cumperi de pe un anunț real și ceri prețul tău. Un agent AI dă notele, clientul ia o singură mașină, iar diferența intră în buzunarul echipei.':
      'You buy from a real listing and name your price. An AI agent gives the scores, the client takes one car only, and the difference goes into your team pocket.',
    'Jocuri FRQ · pe echipe · cu un agent AI': 'FRQ Games · in teams · with an AI agent',
    'Echipe': 'Teams',
    'Echipe noi': 'New teams',
    'Tururi': 'Rounds each',
    'un tur': 'one round each',
    'două tururi': 'two rounds each',
    'trei tururi': 'three rounds each',
    'Mărimea echipei': 'Team size',
    'Câte tururi': 'How many rounds each',
    'Începe meciul': 'Start the match',
    'Meci nou': 'New match',
    'Înapoi la meci': 'Back to the match',
    'Categoria clientului': 'The client category',
    'Mașinile voastre': 'Your cars',
    'Linkul anunțului, cât dai pe ea și cât ceri. Clientul ia o singură mașină, pe cea cu nota mai mare, la prețul cerut. Ceri mult, câștigi mult, dar prețul cerut intră în notă.':
      'The listing link, what you pay for it and what you ask. The client takes one car only, the one with the higher score, at the price asked. Ask high, earn high, but the asking price counts towards the score.',
    'Cât dai pe ea': 'What you pay',
    'Cât ceri': 'What you ask',
    '← Mașini': '← Cars',
    'Tranzacții': 'Deals',
    'Meciul': 'The match',
    'ia clientul': 'takes the client',
    'ia runda': 'take the round',
    'câștigă': 'win',
    'Clientul îi ia mașina': 'The client takes this car',
    'Rămâne cu ea în curte': 'Stuck with it',
    'Ce a decis notele': 'What decided the scores',
    'Runda următoare': 'Next round',
    'Finalul meciului': 'End of the match',
    'Încă un meci': 'One more match',
    'Rundă cu rundă': 'Round by round',
    'Egalitate': 'A draw',
    'contra': 'versus',
    'Roșii': 'Reds',
    'Albii': 'Whites',
    'Cum se dau notele': 'How the scores work',
    'Am înțeles': 'Got it',
    'ce înseamnă': 'what it means',
    'Cât de bine pică prețul pe care îl ceri tu, nu cel din anunț. Dacă stai în bugetul clientului e bine; peste țintă începe să te coste, iar mult peste maximul lui te scoate din discuție.':
      'How well the price you ask lands, not the one in the listing. Inside the client budget is good; over target it starts to cost you, and well over their maximum takes you out of the running.',
    'cele două surprize': 'the two surprises',
    'Încă două criterii, ascunse până la final. Se trag dintre lucrurile care contează pentru un client ca ăsta și care se pot verifica într-un anunț.':
      'Two more criteria, hidden until the end. They are drawn from the things that matter to a client like this one and that can be checked in a listing.',
    'Clientul rundei': 'Client of the round',
    'Alt client': 'Another client',
    'Buget': 'Budget',
    'Regulă': 'Rule',
    'Altă rundă': 'Another round',
    '← Rundă': '← Round',
    '← Anunțuri': '← Listings',
    '← Instrucțiune': '← Instruction',
    'Anunțurile': 'The listings',
    'Fiecare pune linkul lui. Merge orice site cu anunțuri: mobile.de, autovit, olx, autoscout.':
      'Each of you drops in a link. Any classifieds site works: mobile.de, autovit, olx, autoscout.',
    'Jucătorul 1': 'Player 1',
    'Jucătorul 2': 'Player 2',
    'Numele primului jucător': 'The first player name',
    'Numele celui de-al doilea jucător': 'The second player name',
    'Lipește linkul anunțului': 'Paste the listing link',
    'Linkul primului jucător': 'The first player link',
    'Linkul celui de-al doilea jucător': 'The second player link',
    'Fă instrucțiunea': 'Build the instruction',
    'Instrucțiunea': 'The instruction',
    'Copiază': 'Copy',
    'Nu am putut copia': 'I could not copy it',
    'Am răspunsul': 'I have the answer',
    'Răspunsul': 'The answer',
    'Lipește tot ce ți-a dat agentul. Caut blocul de date în el, iar dacă nu îl găsesc încerc tabelul.':
      'Paste everything the agent gave you. I look for the data block, and if I cannot find it I try the table.',
    'Lipește aici răspunsul agentului': 'Paste the agent answer here',
    'Răspunsul agentului': 'The agent answer',
    'Arată verdictul': 'Show the verdict',
    'Nu am găsit nici blocul de date, nici tabelul. Lipește tot răspunsul agentului, cu tot cu blocul de cod.':
      'I found neither the data block nor the table. Paste the whole answer, code block included.',
    'Am găsit prea puține note. Cere-i agentului blocul de date din instrucțiune.':
      'I found too few scores. Ask the agent for the data block from the instruction.',
    'câștigă': 'wins',
    'nota clientului': 'client score',
    'nota simplă': 'plain score',
    'Nota simplă': 'Plain score',
    'Sumă': 'Sum',
    'Vezi anunțul': 'Open the listing',
    'Surprizele erau': 'The surprises were',
    'Ce a decis runda': 'What decided the round',
    'Tabelul complet': 'The full table',
    'Rundă nouă': 'New round',
  };

  // Strings built with a number or a name inside them.
  const RX = [
    [/^Jucător (\d+)$/, 'Player $1'],
    [/^Scoate jucătorul (\d+)$/, 'Remove player $1'],
    [/^Recordul tău: (.+)$/, 'Your best: $1'],
    [/^Record (\d+)$/, 'Best $1'],
    [/^Record (\d+) · (.+)$/, 'Best $1 · $2'],
    [/^record (\d+)$/, 'best $1'],
    [/^Runda (\d+)$/, 'Round $1'],
    [/^Categoria (\d+) \/ (\d+)$/, 'Category $1 / $2'],
    [/^(\d+) din (\d+)$/, '$1 of $2'],
    [/^de (.+)$/, 'from $1'],
    [/^Ce înseamnă (.+)$/, 'What $1 means'],
    [/^Maxim (.+) la (.+)$/, 'Best $1 in $2'],
    [/^(.+) a greșit$/, '$1 got it wrong'],
    [/^câștigă, cu un clasament de (\d+) mașini$/, 'wins, with a ranking of $1 cars'],
    [/^(?:mașină pusă|mașini puse) la locul lor • record (\d+)$/, 'cars in the right place • best $1'],
    [/^(?:răspuns corect|răspunsuri corecte) • record (\d+)$/, 'correct • best $1'],
    [/^Provocarea zilei, (.+)$/, 'Daily challenge, $1'],
    [/^(.+) are deja 4 mașini$/, '$1 already has 4 cars'],
    [/^Ultimele (\d+), se vând toate$/, 'Last $1, all of them sell'],
    [/^Cumpăr · (.+)$/, 'Buy · $1'],
    [/^\+([\d.,]+) mil\.$/, '+$1M'],
    [/^([\d.,]+) mil\. €$/, '$1M €'],
    [/^\+([\d.,]+) mil\. €$/, '+$1M €'],
    [/^([\d.,]+) CP$/, '$1 hp'],
    [/^Foto: (.+), (.+), decupată$/, 'Photo: $1, $2, cropped'],
    [/^Foto: (.+), domeniu public, decupată$/, 'Photo: $1, public domain, cropped'],
    [/^Foto: (.+)$/, 'Photo: $1'],
    [/^(\d+) de ani$/, '$1 years old'],
    [/^Ce contează pentru (.+)$/, 'What matters to $1'],
    [/^maxim absolut (.+)$/, 'absolute maximum $1'],
    [/^Surpriza (\d+)$/, 'Surprise $1'],
    [/^a dat (.+)$/, 'paid $1'],
    [/^a cerut (.+)$/, 'asked $1'],
    [/^nota clientului (.+) · price fit (.+)$/, 'client score $1 · price fit $2'],
    [/^nota clientului (.+)$/, 'client score $1'],
    [/^(\d+) la (\d+)$/, '$1 v $2'],
    [/^(\d+) rundă$/, '$1 round'],
    [/^(\d+) runde$/, '$1 rounds'],
    [/^Runda (\d+) \/ (\d+)$/, 'Round $1 / $2'],
    [/^Runda (\d+) \/ (\d+) · (.+)$/, 'Round $1 / $2 · $3'],
    [/^Jucătorul (\d+) din echipa (\d+)$/, 'Player $1 of team $2'],
    [/^Numele echipei (\d+)$/, 'Name of team $1'],
    [/^Cât plătește (.+)$/, 'What $1 pays'],
    [/^Cât cere (.+)$/, 'What $1 asks'],
    [/^Linkul lui (.+)$/, 'The link for $1'],
    [/^Final de meci · (.+)$/, 'End of match · $1'],
    [/^(.+) nu a scris și cât dă pe ea, și cât cere\.$/, '$1 has not written both what they pay and what they ask.'],
    [/^(\d+) clienți$/, '$1 clients'],
    [/^(\d+) client$/, '$1 client'],
    [/^Runda #(\d+)$/, 'Round #$1'],
    [/^Runda #(\d+) · (.+)$/, 'Round #$1 · $2'],
    [/^(.+) a găsit mașina$/, '$1 found the car'],
    [/^Mașina (\d+)$/, 'Car $1'],
    [/^price fit \((.+)\)$/, 'price fit ($1)'],
    [/^În buget · price fit (.+)$/, 'In budget · price fit $1'],
    [/^Peste țintă · price fit (.+)$/, 'Over target · price fit $1'],
    [/^Peste maxim · price fit (.+)$/, 'Over maximum · price fit $1'],
    [/^La sumă simplă ar fi câștigat (.+)\. Topul clientului a întors runda\.$/,
      'On the plain sum $1 would have won. The client ranking turned the round.'],
    [/^Agentul nu a dat notă la: (.+)\. Am socotit fără ele\.$/,
      'The agent gave no score for: $1. I worked it out without them.'],
    [/^Mai lipsește linkul lui (.+)\. Trebuie să înceapă cu http\.$/,
      'The link for $1 is still missing. It has to start with http.'],
  ];

  const KEY = 'frq_lang';
  let lang = 'ro';
  try {
    const saved = localStorage.getItem(KEY);
    lang = saved || (/^ro\b/i.test(navigator.language || '') ? 'ro' : 'en');
  } catch { /* private mode: Romanian, as written */ }

  const missing = new Set();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
  const WORDS = /[A-Za-zĂÂÎȘȚăâîșț]/;

  function direct(k) {
    if (EN[k] != null) return EN[k];
    for (const [rx, out] of RX) if (rx.test(k)) return k.replace(rx, out);
    return null;
  }
  function lookup(raw) {
    const k = raw.trim();
    if (!k || !WORDS.test(k)) return null;
    const hit = direct(k);
    if (hit != null) return hit;
    // Lines the games build out of several pieces, such as "2006 · Everyday sport".
    if (k.includes(' · ')) {
      const parts = k.split(' · ');
      const out = parts.map(p => direct(p.trim()) ?? p.trim());
      if (out.some((p, i) => p !== parts[i].trim())) return out.join(' · ');
    }
    missing.add(k);
    return null;
  }

  // `t` is for the few strings that never reach the DOM: dialogs, canvas text, share text.
  function t(s, vars) {
    let out = lang === 'en' ? (lookup(s) ?? s) : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  }

  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const SKIP_NODE = n => n.parentNode && SKIP.has(n.parentNode.nodeName);

  function textNode(n) {
    if (SKIP_NODE(n)) return;
    const hit = lookup(n.nodeValue);
    if (hit != null) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), hit);
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      const hit = lookup(v);
      if (hit != null) el.setAttribute(a, hit);
    }
  }
  function apply(root) {
    if (lang !== 'en' || !root) return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(textNode);
    if (root.nodeType === 1) attrs(root);
    if (root.querySelectorAll) root.querySelectorAll('[placeholder], [aria-label], [title], [alt]').forEach(attrs);
  }

  // Everything the games render later is translated here. The observer's own edits queue
  // new records, which are dropped at the end of each pass instead of being chased.
  let obs = null;
  function flush(records) {
    if (obs) records = records.concat(obs.takeRecords());
    for (const m of records) {
      if (m.type === 'characterData') apply(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(n => apply(n));
    }
    if (obs) obs.takeRecords();
  }

  function start() {
    if (lang !== 'en') return;
    document.documentElement.lang = 'en';
    document.title = t(document.title);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = t(desc.content);
    apply(document.body);
    obs = new MutationObserver(flush);
    obs.takeRecords();
    obs.observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ATTRS,
    });
  }

  // A small RO / EN switch in the top bar. It only sits on the start screens, so it can
  // never cut into a game in progress.
  function mountSwitch() {
    document.querySelectorAll('.brand-bar').forEach(bar => {
      if (bar.querySelector('.lang-switch')) return;
      const box = document.createElement('div');
      box.className = 'lang-switch';
      box.innerHTML = ['ro', 'en'].map(l =>
        `<button type="button" data-lang="${l}"${l === lang ? ' class="is-on" aria-current="true"' : ''}>${l.toUpperCase()}</button>`).join('');
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-lang]');
        if (!b || b.dataset.lang === lang) return;
        try { localStorage.setItem(KEY, b.dataset.lang); } catch { /* nothing to do */ }
        location.reload();
      });
      bar.appendChild(box);
    });
  }

  start();
  mountSwitch();

  return { get lang() { return lang; }, t, apply, missing };
})();
