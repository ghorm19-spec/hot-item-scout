// Lightweight client-side cache for verified product valuations keyed by barcode.
// Backed by IndexedDB; mirrored in an in-memory snapshot so the public API stays
// synchronous (callers don't need to await).

import { openDB, type IDBPDatabase } from "idb";
import type { ValuationOutput } from "./valuate.functions";

const DB_NAME = "flipit";
const DB_VERSION = 1;
const STORE = "productCache";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_ENTRIES = 200;
const LEGACY_LS_KEY = "flipit.product-cache.v1"; // migration source only

interface Entry {
  at: number;
  region: string;
  value: ValuationOutput;
}

const _mem: Map<string, Entry> = new Map();
let _dbPromise: Promise<IDBPDatabase> | null = null;
let _hydrated = false;

function k(code: string, region: string) { return `${region}:${code}`; }

function openCacheDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("scanHistory")) {
          db.createObjectStore("scanHistory", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return _dbPromise;
}

async function migrateLegacy(db: IDBPDatabase) {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(LEGACY_LS_KEY); } catch { return; }
  if (!raw) return;
  try {
    const obj = JSON.parse(raw) as Record<string, Entry>;
    if (obj && typeof obj === "object") {
      const tx = db.transaction(STORE, "readwrite");
      for (const [key, val] of Object.entries(obj)) {
        if (val && typeof val.at === "number") await tx.store.put(val, key);
      }
      await tx.done;
    }
  } catch { /* ignore */ }
  try { window.localStorage.removeItem(LEGACY_LS_KEY); } catch {}
}

async function hydrate(): Promise<void> {
  if (_hydrated || typeof window === "undefined") return;
  try {
    const db = await openCacheDB();
    await migrateLegacy(db);
    const keys = (await db.getAllKeys(STORE)) as string[];
    const vals = (await db.getAll(STORE)) as Entry[];
    const cutoff = Date.now() - TTL_MS;
    keys.forEach((key, i) => {
      const v = vals[i];
      if (v && typeof v.at === "number" && v.at >= cutoff) _mem.set(key, v);
    });
    _hydrated = true;
  } catch (e) {
    console.warn("[product-cache] hydrate failed", e);
    _hydrated = true;
  }
}

if (typeof window !== "undefined") { void hydrate(); }

export function getCachedValuation(code: string, region: string): ValuationOutput | null {
  if (!code) return null;
  const e = _mem.get(k(code, region));
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    _mem.delete(k(code, region));
    void (async () => { try { (await openCacheDB()).delete(STORE, k(code, region)); } catch {} })();
    return null;
  }
  return e.value;
}

export function setCachedValuation(code: string, region: string, value: ValuationOutput) {
  if (!code || !value.verified) return; // only cache verified results
  const key = k(code, region);
  const entry: Entry = { at: Date.now(), region, value };
  _mem.set(key, entry);

  // Enforce cap in memory immediately.
  if (_mem.size > MAX_ENTRIES) {
    const sorted = [..._mem.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < _mem.size - MAX_ENTRIES; i++) _mem.delete(sorted[i][0]);
  }

  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const db = await openCacheDB();
      await db.put(STORE, entry, key);
      // Cap on disk too: keep newest MAX_ENTRIES.
      const allKeys = (await db.getAllKeys(STORE)) as string[];
      if (allKeys.length > MAX_ENTRIES) {
        const all = (await db.getAll(STORE)) as Entry[];
        const pairs = allKeys.map((kk, i) => ({ key: kk, at: all[i]?.at ?? 0 }));
        pairs.sort((a, b) => a.at - b.at);
        const tx = db.transaction(STORE, "readwrite");
        for (let i = 0; i < pairs.length - MAX_ENTRIES; i++) await tx.store.delete(pairs[i].key);
        await tx.done;
      }
    } catch (e) { console.warn("[product-cache] set failed", e); }
  })();
}
