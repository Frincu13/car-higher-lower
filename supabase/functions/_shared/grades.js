// Slot grades shared by Mașina perfectă and Licitația: eight attributes, each graded
// 0-10 on a fixed scale. `points` = grade x 10 as a whole number.
window.Grades = (() => {
  'use strict';
  const { fmt } = window.Shared;

  // Grades are absolute: a fixed scale per attribute, so a car's grade never depends
  // on which other cars happen to be in the list. Real figures (hp, Nm, kg, km/h, 0-100)
  // use scales anchored on real-world extremes; handling, braking and off-road are set
  // per car in scripts/grades.csv on the same fixed 0-10 scale.
  const graded = key => c => c.grades && c.grades[key];
  const clamp = v => Math.max(0, Math.min(10, v));
  // 0 at `lo`, 10 at `hi`, logarithmic in between (doubling power adds the same amount).
  const logScale = (lo, hi) => v => clamp(10 * Math.log(v / lo) / Math.log(hi / lo));
  const ATTRS = [
    { key: 'hp',       label: 'Putere',          get: c => c.hp,     show: v => `${fmt(v, 0)} CP`,
      score: logScale(50, 1500), // 150 CP ≈ 3, 300 CP ≈ 5, 700 CP ≈ 8, 1500 CP = 10
      tip: 'Caii de sub capotă.' },
    { key: 'torque',   label: 'Cuplu',           get: c => c.torque, show: v => `${fmt(v, 0)} Nm`,
      score: logScale(60, 1600),
      tip: 'Forța care te lipește de scaun la plecare.' },
    { key: 'weight',   label: 'Greutate',        get: c => c.weight, show: v => `${fmt(v, 0)} kg`,
      score: w => logScale(800, 3000)(3000 * 800 / w), // mirrored: 800 kg = 10, 3.000 kg = 0
      tip: 'Mai ușoară, notă mai mare.' },
    { key: 'speed',    label: 'Viteză maximă',   get: graded('kmh'),      show: v => `${fmt(v, 0)} km/h`,
      score: v => clamp(10 * (v - 80) / 340), // 80 km/h = 0, 420 km/h = 10, linear
      tip: 'Cât poate prinde.' },
    // Real 0-100 time (or an estimate from power and weight when it is missing), not the
    // in-game acceleration rating: that one penalises rear-wheel drive so much that a
    // 3.9 s BMW M4 scored below a 4.7 s Golf R. 2.3 s = 10, 12 s = 0, linear.
    { key: 'accel',    label: 'Accelerație',     get: c => c.accel ?? c.accelEst,
      show: (v, c) => `${c && c.accel == null ? '~' : ''}${fmt(v, 1)} s`,
      score: t => clamp(10 * (12 - t) / (12 - 2.3)),
      tip: '0-100 km/h.' },
    { key: 'handling', label: 'Manevrabilitate', get: graded('handling'), score: v => v,
      tip: 'Cum ține virajele.' },
    { key: 'braking',  label: 'Frânare',         get: graded('braking'),  score: v => v,
      tip: 'Cât de scurt oprește.' },
    { key: 'offroad',  label: 'Off-road',        get: graded('offroad'),  score: v => v,
      tip: 'Pe pământ, nisip și iarbă.' },
  ];
  // Points 0-100 = the slot grade × 10, whole numbers, so a slot grade has exactly one
  // decimal and the final grade is exactly the average of the slot grades players see.
  const points = (attr, car) => Math.round(attr.score(attr.get(car)) * 10);

  const complete = c => ATTRS.every(a => a.get(c) != null);
  return { ATTRS, points, complete };
})();
