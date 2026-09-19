// Car classification shared by the games: a rough body/segment per car and eight
// kinds players recognise (used by Turometrul and Garaj sau presă).
window.Kinds = (() => {
  'use strict';

  const yearOf = c => parseInt(String(c.years), 10) || 2000;
  const EXOTIC = /^(Ferrari|Lamborghini|McLaren|Bugatti|Pagani|Koenigsegg|Rimac|Zenvo|Hennessey|SSC|Saleen|Czinger|Apollo|W Motors|Ascari|Gumpert|Noble|Vector|Mosler|Spania|Arash|Pininfarina|De Tomaso|Lykan|Automobili Pininfarina|Aston Martin (Valkyrie|Vulcan|One-77|Victor|Valhalla))\b/;
  const OFFROAD = /\b(Baja|Trophy Truck|Buggy|Class 1|Ultra4|Rock Bouncer|UTV|Maverick X3|RZR|Warthog|Hummer H1|Bowler|Unimog|Hoonitruck)\b/i;
  const SUV = /\b(SUV|Land Cruiser|FJ40|FJ Cruiser|Patrol|Touareg|Tacoma|Tundra|Hilux|Ram|F-150|F-100|F-250|F-350|Raptor|Silverado|GMC Sierra|Colorado|Canyon|Ranger|Wrangler|Gladiator|Bronco|Defender|Discovery|Range Rover|G ?\d{2,3}|G-Class|ML ?\d{2}|GLA|4x4|Amarok|DBX\d*|Ateca|LX|XM|Grecale|Cayenne|Macan|Urus|Q[5-8]|SQ[5-8]|RS Q[38]|X[3-7]|X5 M|X6 M|Countryman|Escalade|Hummer|Tahoe|Suburban|Durango|Cherokee|Trackhawk|Model X|Bentayga|Cullinan|DBX|Levante|Stelvio|Purosangue|GLE|GLS|GLC|Grenadier|Pathfinder|Blazer|Scout|Samurai|Jimny|4Runner|Tacoma|Titan|Rivian|R1T|R1S|Cybertruck|Lightning|Pickup|Truck|Jeep|Evoque|Velar|Kodiaq|Tiguan|Juke|Qashqai|Duster)\b/;
  const VAN = /\b(Transit|Supervan|Sunshine|Traveller|S-Cargo|Acty|Type 2|Bus|Van|Kombi)\b/;
  const SPORTY = /\b(Exige|Elise|Cobra|Type R|Type-R|GTI|GTi|Cosworth|Williams|Integrale|Turbo)\b/;

  function segOf(c) {
    const k = c.offroadKind, y = yearOf(c), hp = c.hp || 0, kg = c.weight || 1500;
    if (k === 'extreme' || OFFROAD.test(c.name)) return 'offroad';
    if (VAN.test(c.name)) return 'van';
    if (k === 'suvSport' || k === 'utility' || k === 'offroad4x4' || SUV.test(c.name)) return 'suv';
    const exotic = k === 'supercar' || EXOTIC.test(c.name);
    if ((exotic || hp >= 650) && hp >= 780 && y >= 1990) return 'hyper';
    if (exotic || (hp >= 560 && kg < 1750)) return 'super';
    if (k === 'rally' || k === 'rallyMonster') return 'rally';
    if (k === 'sport' || hp >= 230 || hp / kg >= .15 || SPORTY.test(c.name)) return 'sport';
    return 'road';
  }
  const eraOf = c => { const y = yearOf(c); return y < 1975 ? 'classic' : y < 2000 ? 'retro' : 'modern'; };

  // Eight kinds of car. A round shows one car from four of them; "Altele" brings
  // one from each of the other four, so every round has a real mix.
  const MUSCLE = /\b(Mustang|Shelby|Camaro|Corvette|Challenger|Charger|Viper|Chrysler|Pontiac|Plymouth|Firebird|Chevelle|Cobra)\b/;
  const HYPER = /\b(Bugatti|Koenigsegg|Pagani|Rimac|Hennessey|Czinger|Apollo|Valkyrie|Valhalla|Vulcan|One-77|LaFerrari|FXX|F80|Enzo|Daytona SP3|Monza|P1|Senna|Speedtail|Elva|W1|ONE|918|Carrera GT|EP9|Evija|Battista|Sián|Essenza|Zenvo|Veneno|Centenario|Sesto|McLaren F1|Gemera|Bolide|Reventón|Jesko|Venom)\b/;
  const LUX = /\b(Rolls-Royce|Bentley|Maybach|Mulsanne|DB\d+|DB7|Vanquish|Rapide|S 6[35]|CL 65|SL 6[35]|SL 55|M760Li|M8|M6|Quattroporte|GranTurismo|Panamera|612|456M|FF|GTC4Lusso|California|Roma|Portofino|LC 500|XJ|XKR?|12Cilindri|Lagonda|850CSi|Taycan|e-tron GT|Ghibli|CLS 63|Air Sapphire|Continental)\b/;
  const SUV_EXTRA = /\b(Explorer|F-PACE|F-Pace|iX|Enyaq|T-Roc|Mach-E)\b/;
  const SPORTY_ROAD = /\b(MX-5|3000 GT|Eclipse|124 Spider|911 Rallye|RX-7|RX-8|S2000)\b/;
  const HOT = /\b(Golf|Polo|up!|Octavia|Fabia|Superb|Leon|Ibiza|CUPRA|Clio|M[ée]gane|20[58]|30[68]|508|106|Corsa|Astra|Insignia|Kadett|Focus|Fiesta|Puma|Civic|Integra|i20|i30|Veloster|ProCeed|Stinger|MPS|A 45|A45|CLA|C 63|C 43|C 32|E 63|E 55|190E|500 E|M3|M5|M340i|M550i|M135i|M140i|RS ?[2-7]|Audi S[1-8]|Evolution|Impreza|WRX|STI|Lancer|Yaris|Corolla|MINI|Mini|Cooper|Abarth|500|Giulia|Giulietta|14[57]|15[56]|Carlton|Type R|Arteon|Passat|Scirocco|Corrado|S60|V60|C30|DS3|Saxo|Swift|Model 3|Polestar 2|i4|GT 4-Door|Delta|Sierra|Escort|Legacy|Celica|XFR-S|GS F|IS F|XE SV)\b/;
  const CATS = [
    ['hot', 'Sport de zi cu zi'], ['suv', 'SUV & off-road'], ['sport', 'Sport'], ['super', 'Supercar'],
    ['hyper', 'Hypercar'], ['classic', 'Clasică'], ['muscle', 'Americană'], ['lux', 'Lux & GT'],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);
  function catOf(c) {
    const seg = segOf(c);
    if (seg === 'suv' || seg === 'offroad' || SUV_EXTRA.test(c.name)) return 'suv';
    if (MUSCLE.test(c.name)) return 'muscle';
    if (yearOf(c) < 1985) return 'classic';
    if (HYPER.test(c.name)) return 'hyper';
    if (LUX.test(c.name)) return 'lux';
    if (SPORTY_ROAD.test(c.name)) return 'sport';
    if (seg === 'rally' || seg === 'road' || seg === 'van' || HOT.test(c.name)) return 'hot';
    if (seg === 'super' || seg === 'hyper') return 'super';
    return 'sport';
  }

  return { yearOf, segOf, eraOf, kindOf: catOf, KINDS: CATS, KIND_LABEL: CAT_LABEL };
})();
