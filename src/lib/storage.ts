import type { HotnessResult } from "./hotness";
import type { PricingTier } from "./valuate.functions";
import { openDB, type IDBPDatabase } from "idb";

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
  // Phase 1 — accuracy
  verified?: boolean;
  dataSource?: string;
  warnings?: string[];
  unknown?: boolean;
  brand?: string;
  imageUrl?: string;
  // Phase 2 — pricing honesty
  pricingTier?: PricingTier;
  compsAreEstimates?: boolean;
  confidenceReasons?: string[];
  suggestBarcode?: boolean;
  // Phase 3 — real sold-listing comps (when available)
  pricingSource?: string;          // e.g. "ebay-finding-completed"
  pricingSampleCount?: number;
  pricingMedian?: number;
  pricingLow?: number;
  pricingHigh?: number;
  pricingRetrievedAt?: string;     // ISO
}

/* ----------------------------- IndexedDB layer ----------------------------- */

const DB_NAME = "flipit";
const DB_VERSION = 1;
const STORE = "scanHistory";
const MAX_ENTRIES = 200;
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7-day TTL
const LEGACY_LOCALSTORAGE_KEY = "scoreflipp.history.v1"; // migration source only

let _cache: ScanRecord[] = [];
let _dbPromise: Promise<IDBPDatabase> | null = null;
let _hydrated = false;
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((cb) => { try { cb(); } catch {} }); }

function openHistoryDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("productCache")) {
          db.createObjectStore("productCache");
        }
      },
    });
  }
  return _dbPromise;
}

function applyCapAndTtl(records: ScanRecord[]): ScanRecord[] {
  const cutoff = Date.now() - TTL_MS;
  return records
    .filter((r) => r && typeof r.id === "string" && typeof r.createdAt === "number" && r.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ENTRIES);
}

async function migrateLegacyLocalStorage(db: IDBPDatabase) {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY); } catch { return; }
  if (!raw) return;
  try {
    const arr = JSON.parse(raw) as ScanRecord[];
    if (Array.isArray(arr) && arr.length) {
      const tx = db.transaction(STORE, "readwrite");
      for (const r of arr) {
        if (r && typeof r.id === "string") await tx.store.put(r);
      }
      await tx.done;
    }
  } catch { /* ignore malformed legacy data */ }
  try { window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY); } catch {}
}

async function hydrate(): Promise<void> {
  if (_hydrated || typeof window === "undefined") return;
  try {
    const db = await openHistoryDB();
    await migrateLegacyLocalStorage(db);
    const all = (await db.getAll(STORE)) as ScanRecord[];
    _cache = applyCapAndTtl(all);
    _hydrated = true;
    notify();
  } catch (e) {
    console.warn("[storage] hydrate failed", e);
    _hydrated = true;
  }
}

// Kick off hydration eagerly so first sync read returns data ASAP.
if (typeof window !== "undefined") { void hydrate(); }

/** Subscribe to in-memory cache updates. Returns an unsubscribe fn. */
export function subscribeHistory(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

/** Synchronous read of the in-memory cache (hydrated from IndexedDB). */
export function getHistory(): ScanRecord[] {
  return _cache;
}

export function saveScan(r: ScanRecord) {
  _cache = applyCapAndTtl([r, ..._cache.filter((x) => x.id !== r.id)]);
  notify();
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const db = await openHistoryDB();
      await db.put(STORE, r);
      // Enforce cap on disk too: drop entries beyond MAX_ENTRIES (oldest first).
      const all = ((await db.getAll(STORE)) as ScanRecord[])
        .filter((x) => x && typeof x.id === "string" && typeof x.createdAt === "number")
        .sort((a, b) => b.createdAt - a.createdAt);
      if (all.length > MAX_ENTRIES) {
        const tx = db.transaction(STORE, "readwrite");
        for (let i = MAX_ENTRIES; i < all.length; i++) await tx.store.delete(all[i].id);
        await tx.done;
      }
    } catch (e) { console.warn("[storage] saveScan failed", e); }
  })();
}

export function clearHistory() {
  _cache = [];
  notify();
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const db = await openHistoryDB();
      await db.clear(STORE);
    } catch (e) { console.warn("[storage] clearHistory failed", e); }
  })();
}

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
