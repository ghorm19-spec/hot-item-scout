// Loud, realistic DSLR shutter via WebAudio (no assets required)
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let comp: DynamicsCompressorNode | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 1.6; // overall loudness
    comp.connect(master).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function out() {
  return comp!;
}

function beep(freq: number, duration = 0.08, type: OscillatorType = "sine", gain = 0.3, when = 0) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(out());
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst(when: number, dur: number, gain: number, hp: number, lp?: number) {
  const c = getCtx(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpF = c.createBiquadFilter();
  hpF.type = "highpass"; hpF.frequency.value = hp;
  let chain: AudioNode = src.connect(hpF);
  if (lp) {
    const lpF = c.createBiquadFilter();
    lpF.type = "lowpass"; lpF.frequency.value = lp;
    chain = (chain as any).connect(lpF);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  (chain as any).connect(g).connect(out());
  src.start(c.currentTime + when);
  src.stop(c.currentTime + when + dur + 0.02);
}

function clack(when: number, freq: number, dur: number, gain: number) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + when;
  // Body: square tone with quick pitch drop
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + dur);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(gain, t + 0.002);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 4000;
  osc.connect(lp).connect(og).connect(out());
  osc.start(t); osc.stop(t + dur + 0.02);
  // Transient: very short metallic noise
  noiseBurst(when, 0.02, gain * 0.9, 3500);
}

// Loud, layered DSLR shutter
export function playShutter() {
  const c = getCtx(); if (!c) return;
  // Mirror up — sharp clack
  clack(0.0, 2400, 0.06, 0.9);
  noiseBurst(0.0, 0.05, 0.7, 2200);
  // Curtain travel — broadband whoosh
  noiseBurst(0.05, 0.09, 0.55, 600, 5000);
  // Mirror down — bigger thunk
  clack(0.16, 1600, 0.09, 1.0);
  noiseBurst(0.16, 0.07, 0.7, 1500);
  // Body resonance tail
  beep(180, 0.12, "triangle", 0.35, 0.16);
}

// Success: two-note rising chirp
export function playSuccess() {
  beep(880, 0.09, "sine", 0.32, 0);
  beep(1320, 0.12, "sine", 0.32, 0.08);
}

// Beep for barcode/QR detect
export function playDetect() {
  beep(1400, 0.07, "triangle", 0.35);
}
