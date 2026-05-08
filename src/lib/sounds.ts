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

// Camera shutter: short noise burst + click
export function playShutter() {
  const c = getCtx(); if (!c) return;
  // Click
  beep(1800, 0.04, "square", 0.18);
  // Noise burst
  const t0 = c.currentTime + 0.02;
  const buffer = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = 0.25;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1500;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
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
