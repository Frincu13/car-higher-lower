// Sunetul din Startul, sintetizat pe loc (Web Audio), fără fișiere de descărcat:
// motorul fiecăruia urcă în turație cu acul, în stânga sau în dreapta căștilor, cade
// la fiecare schimbare cu o pocnitură în evacuare, bate în limitator și se stinge
// după linie. Electricele șuieră în loc să toarcă. Luminile de start țiuie scurt.
window.DragSunet = (() => {
  'use strict';

  const { store } = window.Shared;
  const CHEIE = 'drg_sunet';
  let pornit = store.get(CHEIE, true);
  let ctx = null, master = null, zgomot = null;
  const motoare = new Map();

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain();
    master.gain.value = pornit ? 0.55 : 0;
    // un compresor blând, ca două motoare deodată să nu se spargă în difuzorul telefonului
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    // o secundă de zgomot alb, refolosită pentru pocnituri
    zgomot = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = zgomot.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Se cheamă la fiecare atingere din cursă: browserele pornesc sunetul doar după un
  // gest al omului.
  function trezeste() {
    if (!pornit) return;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function comuta() {
    pornit = !pornit;
    store.set(CHEIE, pornit);
    if (pornit) trezeste();
    if (master) master.gain.setTargetAtTime(pornit ? 0.55 : 0, ctx.currentTime, 0.05);
    return pornit;
  }

  // Turația: acul merge de la 0,55 (jos, după schimbare) la 1 (limitator).
  const turatie = r => 900 + Math.max(0, r) * 7100;

  function motor(p, ev) {
    if (!pornit || !init()) return;
    opreste(p, 0);
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = p ? 0.55 : -0.55;
    const vol = ctx.createGain();
    vol.gain.value = 0;
    vol.gain.setTargetAtTime(ev ? 0.12 : 0.2, t, 0.15);
    // bătaia limitatorului: un LFO care taie volumul de ~22 de ori pe secundă
    const taie = ctx.createGain();
    taie.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = 22;
    const adanc = ctx.createGain();
    adanc.gain.value = 0;
    lfo.connect(adanc).connect(taie.gain);
    const filtru = ctx.createBiquadFilter();
    filtru.type = 'lowpass'; filtru.Q.value = ev ? 4 : 1.2;
    const osc = [];
    if (ev) {
      // electrica: un șuierat curat, plus o octavă mai sus, încet
      const a = ctx.createOscillator(); a.type = 'triangle';
      const b = ctx.createOscillator(); b.type = 'sine';
      const gb = ctx.createGain(); gb.gain.value = 0.35;
      a.connect(filtru); b.connect(gb).connect(filtru);
      osc.push([a, 1], [b, 2]);
    } else {
      // pe benzină: dinte de fierăstrău pe frecvența aprinderilor, plus un pătrat la
      // jumătate pentru bas
      const a = ctx.createOscillator(); a.type = 'sawtooth';
      const b = ctx.createOscillator(); b.type = 'square';
      const gb = ctx.createGain(); gb.gain.value = 0.45;
      a.connect(filtru); b.connect(gb).connect(filtru);
      osc.push([a, 1], [b, 0.5]);
    }
    filtru.connect(taie).connect(vol);
    if (pan) vol.connect(pan).connect(master); else vol.connect(master);
    osc.forEach(([o]) => o.start(t));
    lfo.start(t);
    const m = { ev, osc, filtru, vol, adanc, lfo, pan, lim: false };
    motoare.set(p, m);
    seteaza(p, 0.2, false);
  }

  function seteaza(p, r, limitator) {
    const m = motoare.get(p);
    if (!m || !ctx) return;
    const t = ctx.currentTime, rpm = turatie(r);
    const f = m.ev ? 120 + Math.max(0, r) * 1500 : rpm / 60 * 2.2;
    m.osc.forEach(([o, k]) => o.frequency.setTargetAtTime(f * k, t, 0.025));
    m.filtru.frequency.setTargetAtTime(m.ev ? f * 3 : 300 + rpm * 0.32, t, 0.03);
    if (limitator !== m.lim) {
      m.lim = limitator;
      m.adanc.gain.setTargetAtTime(limitator ? 0.85 : 0, t, 0.01);
    }
  }

  // Schimbarea: turația cade (o face acul), volumul se înmoaie o clipă, iar pe benzină
  // evacuarea pocnește. O schimbare proastă pocnește mai tare.
  function schimba(p, rau) {
    const m = motoare.get(p);
    if (!m || !ctx) return;
    const t = ctx.currentTime, g = m.vol.gain, nivel = m.ev ? 0.12 : 0.2;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(nivel * 0.35, t + 0.03);
    g.linearRampToValueAtTime(nivel, t + 0.16);
    if (m.ev || !zgomot) return;
    const src = ctx.createBufferSource();
    src.buffer = zgomot;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = rau ? 900 : 1500; bp.Q.value = 1.4;
    const gp = ctx.createGain();
    gp.gain.setValueAtTime(rau ? 0.5 : 0.3, t);
    gp.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(gp);
    gp.connect(m.pan || master);
    src.start(t, Math.random() * 0.8, 0.1);
  }

  function opreste(p, fade = 0.5) {
    const m = motoare.get(p);
    if (!m || !ctx) return;
    motoare.delete(p);
    const t = ctx.currentTime;
    m.vol.gain.cancelScheduledValues(t);
    m.vol.gain.setValueAtTime(m.vol.gain.value, t);
    m.vol.gain.linearRampToValueAtTime(0, t + Math.max(0.02, fade));
    // turația cade cât se stinge
    m.osc.forEach(([o]) => o.frequency.setTargetAtTime(o.frequency.value * 0.5, t, Math.max(0.02, fade / 2)));
    const stop = t + Math.max(0.05, fade) + 0.05;
    m.osc.forEach(([o]) => { try { o.stop(stop); } catch { /* deja oprit */ } });
    try { m.lfo.stop(stop); } catch { /* deja oprit */ }
  }

  function opresteTot(fade = 0.3) { [...motoare.keys()].forEach(p => opreste(p, fade)); }

  // Un țiuit scurt, pentru luminile de start.
  function bip(frecv = 660, durata = 0.12) {
    if (!pornit || !init()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = frecv;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + durata + 0.02);
  }

  return { trezeste, comuta, motor, seteaza, schimba, opreste, opresteTot, bip, get pornit() { return pornit; } };
})();
