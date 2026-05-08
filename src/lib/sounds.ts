// Premium WebAudio sound design for Flip it.
// Goal: production-grade smartphone-camera UX audio identity (not just synthesized DSLR).
// - Stereo width + subtle servo texture + tight transients
// - Compressed master bus with safety limiter
// - Unified palette: shutter / detect / success / warn / error
// - Audio context warmed on first user gesture for low-latency playback

let ctx: AudioContext | null = null;
let masterIn: GainNode | null = null;       // input bus → comp → limiter → destination
let comp: DynamicsCompressorNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let primed = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    masterIn = ctx.createGain();
    masterIn.gain.value = 1.0;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;

    // Brick-wall safety limiter
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const trim = ctx.createGain();
    trim.gain.value = 1.6;

    masterIn.connect(comp).connect(limiter).connect(trim).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function bus() { return masterIn!; }

/** Stereo placement helper. pan ∈ [-1, 1] */
function panNode(pan = 0): StereoPannerNode | null {
  const c = getCtx(); if (!c) return null;
  try {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  } catch { return null; }
}

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

function tone(opts: {
  freq: number; dur: number; type?: OscillatorType; gain?: number;
  when?: number; glideTo?: number; pan?: number;
}) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + (opts.when || 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + opts.dur);
  const gain = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  const p = panNode(opts.pan || 0);
  let chain: AudioNode = osc;
  chain = chain.connect(g);
  if (p) chain = chain.connect(p);
  chain.connect(bus());
  osc.start(t); osc.stop(t + opts.dur + 0.02);
}

function noise(opts: {
  when: number; dur: number; gain: number;
  hp: number; lp?: number; curve?: number; pan?: number;
}) {
  const c = getCtx(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * opts.dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  const curve = opts.curve ?? 1.6;
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
  const src = c.createBufferSource(); src.buffer = buf;
  const hpF = c.createBiquadFilter(); hpF.type = "highpass"; hpF.frequency.value = opts.hp;
  let chain: AudioNode = src.connect(hpF);
  if (opts.lp) {
    const lpF = c.createBiquadFilter(); lpF.type = "lowpass"; lpF.frequency.value = opts.lp;
    chain = (chain as any).connect(lpF);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain, c.currentTime + opts.when);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + opts.when + opts.dur);
  let post: AudioNode = (chain as any).connect(g);
  const p = panNode(opts.pan || 0);
  if (p) post = (post as any).connect(p);
  (post as any).connect(bus());
  src.start(c.currentTime + opts.when);
  src.stop(c.currentTime + opts.when + opts.dur + 0.02);
}

function clack(when: number, freq: number, dur: number, gain: number, pan = 0) {
  const c = getCtx(); if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.25, t + dur);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(gain, t + 0.0012);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
  const p = panNode(pan);
  let chain: AudioNode = osc.connect(lp).connect(og);
  if (p) chain = chain.connect(p);
  chain.connect(bus());
  osc.start(t); osc.stop(t + dur + 0.02);
  noise({ when, dur: 0.022, gain: gain * 0.95, hp: 3000, pan });
}

/**
 * Premium mobile-camera shutter:
 *   pre-servo tick → mirror clack (left) → curtain whoosh (wide) → mirror return (right) → body resonance.
 * Stereo width + servo texture pushes it past "synthetic DSLR" toward modern phone capture UX.
 */
export function playShutter() {
  const c = getCtx(); if (!c) return;
  // 1) Servo prep tick — tiny sub-tick before the main clack
  noise({ when: 0,    dur: 0.012, gain: 0.35, hp: 5000, pan: -0.15 });
  // 2) Mirror up — sharp metallic clack (left-biased)
  clack(0.012, 2700, 0.05, 1.0, -0.25);
  noise({ when: 0.012, dur: 0.04, gain: 0.7,  hp: 2400, pan: -0.2 });
  // 3) Curtain travel — broadband whoosh (wide stereo via two pans)
  noise({ when: 0.055, dur: 0.075, gain: 0.55, hp: 700, lp: 5200, curve: 1.2, pan: -0.4 });
  noise({ when: 0.062, dur: 0.07,  gain: 0.45, hp: 600, lp: 4800, curve: 1.3, pan: 0.4 });
  // 4) Servo mid-texture — high-freq fluctuation
  noise({ when: 0.09,  dur: 0.025, gain: 0.18, hp: 6500, pan: 0 });
  // 5) Mirror down — heavier thunk (right-biased)
  clack(0.17, 1450, 0.085, 1.05, 0.3);
  noise({ when: 0.17, dur: 0.07, gain: 0.65, hp: 1200, pan: 0.25 });
  // 6) Body resonance tail (centered)
  tone({ freq: 165, dur: 0.13, type: "triangle", gain: 0.38, when: 0.17 });
  tone({ freq: 92,  dur: 0.20, type: "sine",     gain: 0.22, when: 0.19 });
}

/** Confident two-note success chime (centered, slight stereo sparkle). */
export function playSuccess() {
  tone({ freq: 880,  dur: 0.08, type: "sine",     gain: 0.30, when: 0,    pan: -0.1 });
  tone({ freq: 1320, dur: 0.10, type: "sine",     gain: 0.30, when: 0.07, pan: 0.1 });
  tone({ freq: 1760, dur: 0.12, type: "triangle", gain: 0.18, when: 0.13 });
}

/** Short positive detect blip for barcode/QR lock. */
export function playDetect() {
  tone({ freq: 1500, dur: 0.06, type: "triangle", gain: 0.36, when: 0,    pan: -0.05 });
  tone({ freq: 2100, dur: 0.05, type: "sine",     gain: 0.22, when: 0.04, pan: 0.05 });
}

/** Soft warning bling — for low-confidence / warnings (not failures). */
export function playWarn() {
  tone({ freq: 740, dur: 0.09, type: "sine",     gain: 0.26, when: 0 });
  tone({ freq: 555, dur: 0.10, type: "triangle", gain: 0.22, when: 0.06 });
}

/** Descending error tone with subtle noise grit. */
export function playError() {
  tone({ freq: 440, dur: 0.10, type: "sawtooth", gain: 0.30, when: 0, glideTo: 220 });
  noise({ when: 0.05, dur: 0.08, gain: 0.18, hp: 800 });
}
