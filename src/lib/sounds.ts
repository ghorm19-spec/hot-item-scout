// Lightweight WebAudio-based UI sounds (no assets required)
let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function beep(freq: number, duration = 0.08, type: OscillatorType = "sine", gain = 0.15, when = 0) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Realistic DSLR shutter: mirror-up click, brief noise, mirror-down click
export function playShutter() {
  const c = getCtx(); if (!c) return;
  const now = c.currentTime;

  const clack = (when: number, freq: number, dur: number, gain: number) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now + when);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + when + dur);
    g.gain.setValueAtTime(0.0001, now + when);
    g.gain.exponentialRampToValueAtTime(gain, now + when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + when + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3500;
    osc.connect(lp).connect(g).connect(c.destination);
    osc.start(now + when);
    osc.stop(now + when + dur + 0.02);
  };

  const noise = (when: number, dur: number, gain: number, hp: number) => {
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(c.destination);
    src.start(now + when);
  };

  // Mirror up — sharp metallic clack
  clack(0, 2200, 0.05, 0.55);
  noise(0, 0.04, 0.45, 2500);
  // Shutter blades whoosh
  noise(0.05, 0.07, 0.18, 800);
  // Mirror down — second clack
  clack(0.13, 1800, 0.07, 0.5);
  noise(0.13, 0.05, 0.4, 2000);
}

// Success: two-note rising chirp
export function playSuccess() {
  beep(880, 0.09, "sine", 0.18, 0);
  beep(1320, 0.12, "sine", 0.18, 0.08);
}

// Beep for barcode/QR detect
export function playDetect() {
  beep(1200, 0.07, "triangle", 0.2);
}
