import type { HotnessResult } from "./hotness";

export interface ScanRecord {
  id: string;
  createdAt: number;
  title: string;
  category: string;
  thumbnail?: string; // data url
  scanType: "photo" | "barcode" | "qr";
  code?: string;
  priceLow: number;
  priceHigh: number;
  currency: string;
  buyPrice?: number;
  condition: "Poor" | "Fair" | "Good" | "Excellent";
  comps: { source: string; price: number }[];
  hotness: HotnessResult;
  confidence: number;
  flipTip: string;
  neighbourhood?: string;
}

const KEY = "scoreflipp.history.v1";

export function getHistory(): ScanRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function saveScan(r: ScanRecord) {
  const all = getHistory();
  all.unshift(r);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}

export function clearHistory() { localStorage.removeItem(KEY); }

export function computeBadges(history: ScanRecord[]) {
  const totalProfit = history.reduce((s, h) => {
    const mid = (h.priceLow + h.priceHigh) / 2;
    return s + Math.max(0, mid - (h.buyPrice ?? 0));
  }, 0);
  const hotCount = history.filter(h => h.hotness.tier === "HOT").length;
  return [
    { key: "first", emoji: "🏆", label: "First Flip", earned: history.length >= 1 },
    { key: "five_hot", emoji: "🔥", label: "5 High Scores", earned: hotCount >= 5 },
    { key: "500", emoji: "💎", label: "$500 Flipped", earned: totalProfit >= 500 },
    { key: "streak10", emoji: "⚡", label: "10 Scans", earned: history.length >= 10 },
  ];
}
