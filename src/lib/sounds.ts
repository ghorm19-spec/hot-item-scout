// Premium WebAudio sound design for Flip it.
// - Real DSLR-style shutter (mirror clack + curtain whoosh + return + body resonance)
// - Crisp success / detect / error tones synchronized with haptics
// - Audio context warmup primed on first user gesture for low-latency playback

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let comp: DynamicsCompressorNode | null = null;
let primed = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 8;
    comp.ratio.value = 5;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = 1.8;
    comp.connect(master).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function out() { return comp!; }

/** Call from a user gesture to unlock audio for instant playback later. */
export function primeAudio() {
  if (primed) return;
  const c = getCtx(); if (!c) return;
  const buf = c.createBuffer(1, 1, c.sampleRate);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
  primed = true;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, glideTo?: number) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out());
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noise(when: number, dur: number, gain: number, hp: number, lp?: number, curve = 1.6) {
  const c = getCtx(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
  const src = c.createBufferSource(); src.buffer = buf;
  const hpF = c.createBiquadFilter(); hpF.type = "highpass"; hpF.frequency.value = hp;
  let chain: AudioNode = src.connect(hpF);
  if (lp) {
    const lpF = c.createBiquadFilter(); lpF.type = "lowpass"; lpF.frequency.value = lp;
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
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + dur);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4500;
  osc.connect(lp).connect(og).connect(out());
  osc.start(t); osc.stop(t + dur + 0.02);
  noise(when, 0.022, gain * 0.95, 3000);
}

/** Layered DSLR shutter: mirror up → curtain → mirror down → body resonance. */
export function playShutter() {
  const c = getCtx(); if (!c) return;
  // Mirror up — sharp metallic clack
  clack(0.0, 2600, 0.05, 1.0);
  noise(0.0, 0.04, 0.8, 2400);
  // Curtain travel — broadband whoosh
  noise(0.045, 0.085, 0.6, 700, 5500, 1.2);
  // Mirror down — heavier thunk
  clack(0.16, 1500, 0.09, 1.1);
  noise(0.16, 0.07, 0.75, 1200);
  // Body resonance tail
  tone(170, 0.13, "triangle", 0.4, 0.16);
  tone(95, 0.18, "sine", 0.25, 0.18);
}

/** Crisp two-note success chime. */
export function playSuccess() {
  tone(880, 0.08, "sine", 0.32, 0);
  tone(1320, 0.11, "sine", 0.32, 0.07);
  tone(1760, 0.12, "triangle", 0.18, 0.13);
}

/** Short positive detect blip for barcode/QR lock. */
export function playDetect() {
  tone(1500, 0.06, "triangle", 0.38, 0);
  tone(2100, 0.05, "sine", 0.24, 0.04);
}

/** Descending error tone. */
export function playError() {
  tone(440, 0.1, "sawtooth", 0.3, 0, 220);
  noise(0.05, 0.08, 0.2, 800);
}
