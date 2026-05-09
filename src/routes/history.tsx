import { createFileRoute, Link } from "@tanstack/react-router";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getHistory, clearHistory, saveScan, subscribeHistory, type ScanRecord } from "@/lib/storage";
import { tierClass } from "@/lib/hotness";
import { AlertTriangle, ScanLine } from "lucide-react";
import { analytics } from "@/lib/telemetry";

type Sort = "date" | "hotness" | "profit" | "category";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "History — Flip it" }] }),
});

function HistoryPage() {
  const [items, setItems] = useState<ScanRecord[]>([]);
  const [sort, setSort] = useState<Sort>("date");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setItems(() => getHistory());
    const unsub = subscribeHistory(() => setItems(() => getHistory()));
    return () => {
      unsub();
      if (clearDebounceRef.current) clearTimeout(clearDebounceRef.current);
    };
  }, []);

  const handleClear = useCallback(() => {
    // 300ms debounce to prevent double-fire on flaky touches.
    if (clearDebounceRef.current) return;
    clearDebounceRef.current = setTimeout(() => {
      clearDebounceRef.current = null;
    }, 300);
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev;
      clearHistory();
      if (undoTimer.current) clearTimeout(undoTimer.current);
      toast("Scan history cleared", {
        duration: 2000,
        action: {
          label: "Undo",
          onClick: () => {
            const ordered = [...snapshot].sort((a, b) => a.createdAt - b.createdAt);
            ordered.forEach((r) => saveScan(r));
            setItems(() => getHistory());
          },
        },
      });
      return [];
    });
  }, []);

  // Drop malformed entries + sort — memoized so it only recomputes when items or sort change.
  const sorted = useMemo(() => {
    const safeItems = items.filter(
      (r) =>
        r &&
        typeof r.id === "string" && r.id.length > 0 &&
        typeof r.createdAt === "number" && Number.isFinite(r.createdAt) &&
        // For barcode/qr scans, require a code; photo scans are exempt (no barcode).
        (r.scanType === "photo" || (typeof r.code === "string" && r.code.length > 0)),
    );
    return [...safeItems].sort((a, b) => {
      if (sort === "date") return b.createdAt - a.createdAt;
      if (sort === "hotness") return b.hotness.score - a.hotness.score;
      if (sort === "profit") return ((b.priceLow+b.priceHigh)/2 - (b.buyPrice ?? 0)) - ((a.priceLow+a.priceHigh)/2 - (a.buyPrice ?? 0));
      return a.category.localeCompare(b.category);
    });
  }, [items, sort]);

  return (
    <AppShell>
      <header className="pt-6 pb-3 flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">History</h1>
        {items.length > 0 && (
          <button
            type="button"
            aria-label="Clear scan history"
            onTouchStart={() => { try { navigator.vibrate?.([8, 0, 12]); } catch {} }}
            onClick={handleClear}
            className="clear-button relative text-xs text-muted-foreground font-medium rounded-lg active:scale-95 transition-transform duration-[60ms] ease-out before:content-[''] before:absolute before:-inset-2"
            style={{
              minWidth: 44,
              minHeight: 44,
              padding: "12px 20px",
              WebkitTapHighlightColor: "transparent",
            }}
          >Clear</button>
        )}
      </header>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3">
        {(["date","hotness","profit","category"] as Sort[]).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${sort===s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
          >{s}</button>
        ))}
      </div>

      <HistoryListBoundary onReset={() => { clearHistory(); setItems([]); }}>
        {sorted.length === 0 ? (
        <div className="mt-10 relative">
          {/* Ghost card behind the empty-state — fake data, never persisted. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-4 top-2 rounded-2xl border border-border bg-card/60 p-3 flex gap-3 opacity-20 blur-[1px] pointer-events-none"
          >
            <div className="size-16 rounded-xl bg-secondary grid place-items-center text-2xl">👟</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sneakers</p>
              <p className="font-semibold truncate">Nike Dunk Low Panda</p>
              <p className="text-xs text-muted-foreground">USD 90–140</p>
            </div>
            <div className="text-right">
              <div className="text-2xl">🔥</div>
              <div className="text-xs font-display font-bold">82</div>
            </div>
          </div>

          <div className="relative mt-16 flex flex-col items-center text-center px-6">
            <div className="size-16 rounded-2xl bg-primary/15 border border-primary/30 grid place-items-center mb-4 glow-primary">
              <ScanLine className="size-8 text-primary" />
            </div>
            <h2 className="font-display font-black text-xl mb-1">No flips yet</h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Scan your first item to see your profit here.
            </p>
            <Link
              to="/scan"
              search={{ mode: "photo" } as any}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-bold active:scale-95 transition glow-primary"
            >
              <ScanLine className="size-4" /> Scan Something
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(r => (<HistoryRow key={r.id} r={r} />))}
        </ul>
        )}
      </HistoryListBoundary>
    </AppShell>
  );
}

/* ----------------- Memoized row component ----------------- */

const HistoryRow = memo(function HistoryRow({ r }: { r: ScanRecord }) {
  return (
    <li>
      <Link to="/result/$id" params={{ id: r.id }} className={`flex gap-3 p-3 rounded-2xl border bg-card ${tierClass(r.hotness.tier)}`}>
        {r.thumbnail ? (
          <img src={r.thumbnail} alt="" className="size-16 rounded-xl object-cover border border-border" />
        ) : (
          <div className="size-16 rounded-xl bg-secondary grid place-items-center text-2xl">
            {r.scanType === "qr" ? "🔳" : r.scanType === "barcode" ? "▦" : "📦"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.category}</p>
          <p className="font-semibold truncate">{r.title}</p>
          <p className="text-xs text-muted-foreground">{r.currency || "USD"} {r.priceLow}–{r.priceHigh}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl">{r.hotness.emoji}</div>
          <div className="text-xs font-display font-bold">{r.hotness.score}</div>
        </div>
      </Link>
    </li>
  );
});

/* ----------------- Local error boundary for the history list ----------------- */

interface BoundaryProps { children: ReactNode; onReset: () => void; }
interface BoundaryState { error: Error | null; }

class HistoryListBoundaryImpl extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[history] list crashed", error, info);
  }

  reset = () => {
    try { this.props.onReset(); } catch {}
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-center">
        <AlertTriangle className="size-6 text-destructive mx-auto mb-2" />
        <p className="font-display font-bold text-destructive">Couldn't load your history</p>
        <p className="text-xs text-muted-foreground mt-1">
          A scan record is corrupted. Clearing history will reset the local store.
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-xl bg-destructive text-destructive-foreground px-4 py-2 text-sm font-bold active:scale-95 transition"
        >
          Clear history
        </button>
      </div>
    );
  }
}

const HistoryListBoundary = memo(HistoryListBoundaryImpl);
