// Lightweight client-side cache for verified product valuations keyed by barcode.
// Avoids re-billing AI for repeat scans of the same item.

import type { ValuationOutput } from "./valuate.functions";

const KEY = "flipit.product-cache.v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface Entry {
  at: number;
  region: string;
  value: ValuationOutput;
}

type Store = Record<string, Entry>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

function write(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getCachedValuation(code: string, region: string): ValuationOutput | null {
  if (!code) return null;
  const s = read();
  const e = s[`${region}:${code}`];
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) return null;
  return e.value;
}

export function setCachedValuation(code: string, region: string, value: ValuationOutput) {
  if (!code || !value.verified) return; // only cache verified results
  const s = read();
  s[`${region}:${code}`] = { at: Date.now(), region, value };
  // cap at 200 entries
  const keys = Object.keys(s);
  if (keys.length > 200) {
    const sorted = keys.sort((a, b) => s[a].at - s[b].at);
    for (let i = 0; i < keys.length - 200; i++) delete s[sorted[i]];
  }
  write(s);
}
