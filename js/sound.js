// Tiny procedural sound effects via WebAudio (no audio assets).

let ctx = null;

export function initAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(type, f0, f1, dur, vol = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  break: () => tone('square', 170 + Math.random() * 60, 55, 0.12, 0.12),
  place: () => tone('square', 250 + Math.random() * 40, 170, 0.07, 0.1),
  hurt: () => tone('sawtooth', 300, 90, 0.22, 0.18),
  pop: () => tone('square', 380, 900, 0.09, 0.12),
  hit: () => tone('square', 120, 60, 0.08, 0.12),
  splash: () => tone('sawtooth', 500, 100, 0.25, 0.06),
  pickup: () => tone('square', 700 + Math.random() * 200, 1100, 0.08, 0.08),
  eat: () => { tone('square', 90, 60, 0.09, 0.1); setTimeout(() => tone('square', 80, 55, 0.09, 0.1), 120); },
  craft: () => tone('square', 300, 500, 0.1, 0.1),
  mine: () => tone('square', 140 + Math.random() * 50, 100, 0.04, 0.05),
};
