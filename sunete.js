// Sunetele scurte ale jocurilor (nu ale motoarelor din Startul, care au drag-sunet.js):
// răspuns corect, greșit, record nou, ofertă, ciocanul de la licitație, victorie,
// înfrângere, o ladă deschisă. Sintetizate pe loc cu Web Audio, fără fișiere de
// descărcat. Volumul e cel din Setări (frq_volum); „Sunetele jocurilor" (frq_sunete)
// le oprește. Contextul audio pornește la primul sunet, care vine mereu dintr-o
// atingere (browserele pornesc sunetul doar după un gest al omului).
window.Sunete = (() => {
  'use strict';
  const { store } = window.Shared;
  let ctx = null, master = null;
  const pornite = () => store.get('frq_sunete', true) !== false;
  const nivel = () => 0.5 * Math.max(0, Math.min(1, Number(store.get('frq_volum', 1))));

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    return ctx;
  }
  // o notă: frecvența, când începe (s de acum), cât ține, forma și cât de tare
  function nota(f, la, dur, { tip = 'triangle', vol = 0.6, spre = null } = {}) {
    const t = ctx.currentTime + la;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(f, t);
    if (spre) o.frequency.exponentialRampToValueAtTime(spre, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // un zgomot scurt, filtrat (ciocanul, capacul lăzii)
  function zgomot(la, dur, frecv, vol = 0.7) {
    const t = ctx.currentTime + la;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = frecv; f.Q.value = 1.2; g.gain.value = vol;
    s.connect(f).connect(g).connect(master);
    s.start(t);
  }
  function canta(fn) {
    if (!pornite() || !init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = nivel();
    try { fn(); } catch { /* fără sunet */ }
  }

  const S = {
    // două note care urcă, scurt și curat
    corect: () => canta(() => { nota(880, 0, 0.09, { vol: 0.45 }); nota(1320, 0.07, 0.14, { vol: 0.4 }); }),
    // un bâzâit care coboară
    gresit: () => canta(() => { nota(220, 0, 0.32, { tip: 'sawtooth', vol: 0.25, spre: 110 }); nota(233, 0, 0.32, { tip: 'square', vol: 0.08, spre: 116 }); }),
    // arpegiu în sus
    record: () => canta(() => [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.09, 0.28, { vol: 0.4 }))),
    // un clic de ofertă
    oferta: () => canta(() => { nota(1500, 0, 0.04, { tip: 'square', vol: 0.12 }); zgomot(0, 0.03, 3000, 0.2); }),
    // ciocanul: lemn pe lemn
    ciocan: () => canta(() => { zgomot(0, 0.12, 900, 0.9); nota(160, 0, 0.12, { tip: 'sine', vol: 0.5, spre: 90 }); }),
    // victoria: un acord scurt
    victorie: () => canta(() => { [523, 659, 784].forEach(f => nota(f, 0, 0.5, { vol: 0.28 })); nota(1047, 0.18, 0.5, { vol: 0.3 }); }),
    // înfrângerea: două note care coboară
    infrangere: () => canta(() => { nota(392, 0, 0.25, { vol: 0.35 }); nota(311, 0.2, 0.4, { vol: 0.32 }); }),
    // o mașină pusă (Mașina perfectă, În ordine pe local)
    pune: () => canta(() => { nota(660, 0, 0.06, { vol: 0.3 }); zgomot(0, 0.04, 2000, 0.15); }),
    // ultimele secunde din tură
    tic: () => canta(() => nota(1200, 0, 0.03, { tip: 'square', vol: 0.08 })),
    // ladă deschisă: capacul, apoi un sunet cu atât mai sus cu cât e mai rară mașina
    lada: raritate => canta(() => {
      zgomot(0, 0.08, 600, 0.6);
      const baza = [392, 440, 523, 659, 784][Math.max(0, Math.min(4, raritate | 0))];
      nota(baza, 0.06, 0.35, { vol: 0.35 });
      if (raritate >= 2) nota(baza * 1.5, 0.16, 0.4, { vol: 0.3 });
      if (raritate >= 4) nota(baza * 2, 0.28, 0.5, { vol: 0.3 });
    }),
  };
  return S;
})();
