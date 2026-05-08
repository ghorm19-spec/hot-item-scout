// Lightweight client-side telemetry. No external service.
// Buffers events to localStorage + window for diagnostics, debugging, and a future
// upload hook (when an analytics provider is connected).

export type TelemetryEvent =
  | { type: "scan.start"; mode: string; ts: number }
  | { type: "scan.barcode_invalid"; code: string; ts: number }
  | { type: "scan.detected"; mode: string; code?: string; ms: number; ts: number }
  | { type: "scan.captured"; mode: string; ms: number; ts: number }
  | { type: "valuation.ok"; verified: boolean; tier: string; confidence: number; ms: number; ts: number }
  | { type: "valuation.unknown"; reason: string; ts: number }
  | { type: "valuation.error"; message: string; ts: number }
  | { type: "network.offline"; ts: number }
  | { type: "network.online"; ts: number }
  | { type: "camera.lifecycle"; event: string; ts: number }
  | { type: "perf.long_task"; ms: number; ts: number };

const KEY = "flipit.telemetry.v1";
const MAX = 200;

function read(): TelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function write(events: TelemetryEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX))); } catch {}
}

type TrackInput = Omit<TelemetryEvent, "ts"> & { ts?: number };
export function track(ev: TrackInput) {
  if (typeof window === "undefined") return;
  const event = { ...(ev as object), ts: ev.ts ?? Date.now() } as TelemetryEvent;
  const buf = read();
  buf.push(event);
  write(buf);
  // Also expose for live debugging
  (window as any).__flipit_telemetry = buf;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[telemetry]", event);
  }
}

export function getTelemetry(): TelemetryEvent[] { return read(); }
export function clearTelemetry() { try { localStorage.removeItem(KEY); } catch {} }

// Long-task observer — install once on first import in browser.
if (typeof window !== "undefined" && "PerformanceObserver" in window) {
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 120) {
          track({ type: "perf.long_task", ms: Math.round(entry.duration) });
        }
      }
    });
    obs.observe({ entryTypes: ["longtask"] });
  } catch {}
  // Network state
  window.addEventListener("online", () => track({ type: "network.online" }));
  window.addEventListener("offline", () => track({ type: "network.offline" }));
  // Global error capture (best-effort, non-fatal)
  window.addEventListener("error", (e) => {
    track({ type: "valuation.error", message: String(e.message || "window.error") });
  });
  window.addEventListener("unhandledrejection", (e) => {
    track({ type: "valuation.error", message: String((e.reason && e.reason.message) || e.reason || "unhandledrejection") });
  });
}
