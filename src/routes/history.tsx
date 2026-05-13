import { createFileRoute, Link } from "@tanstack/react-router";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getHistory, clearHistory, saveScan, subscribeHistory, type ScanRecord } from "@/lib/storage";
import { AlertTriangle, ScanLine } from "lucide-react";
import { analytics } from "@/lib/telemetry";

type Sort = "date" | "hotness" | "profit" | "category";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "History - Flip it" }] }),
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

  const sorted = useMemo(() => {
    const safeItems = items.filter(
      (r) =>
        r &&
        typeof r.id === "string" && r.id.length > 0 &&
        typeof r.createdAt === "number" && Number.isFinite(r.createdAt) &&
        (r.scanType === "photo" || (typeof r.code === "string" && r.code.length > 0)),
    );
    return [...safeItems].sort((a, b) => {
      if (sort === "date") return b.createdAt - a.createdAt;
      if (sort === "hotness") return b.hotness.score - a.hotness.score;
      if (sort === "profit") return ((b.priceLow + b.priceHigh) / 2 - (b.buyPrice ?? 0)) - ((a.priceLow + a.priceHigh) / 2 - (a.buyPrice ?? 0));
      return a.category.localeCompare(b.category);
    });
  }, [items, sort]);

  return (
    <AppShell>
      <div className="min-h-screen bg-white text-[#111827]">
        <header className="pt-6 pb-4 flex items-center justify-between">
          <h1 className="font-display font-black text-2xl text-[#111827]">Scan History</h1>
          {items.length > 0 && (
            <button
              type="button"
              aria-label="Clear scan history"
              onTouchStart={() => { try { navigator.vibrate?.([8, 0, 12]); } catch {} }}
              onClick={handleClear}
              className="clear-button relative rounded-lg px-5 py-3 text-xs font-medium text-[#6B7280] active:scale-95 transition-transform duration-[60ms] ease-out before:content-[''] before:absolute before:-inset-2"
              style={{ minWidth: 44, minHeight: 44, WebkitTapHighlightColor: "transparent" }}
            >
              Clear
            </button>
          )}
        </header>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-4">
          {(["date", "hotness", "profit", "category"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${sort === s ? "border-[#1D9E75] bg-[#1D9E75] text-white" : "border-[#E5E7EB] bg-white text-[#6B7280]"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <HistoryListBoundary onReset={() => { clearHistory(); setItems([]); }}>
          {sorted.length === 0 ? (
            <div className="min-h-[55vh] grid place-items-center">
              <div className="flex flex-col items-center text-center px-6">
                <ScanLine className="mb-4 size-12 text-[#9CA3AF]" />
                <h2 className="font-display font-black text-xl text-[#9CA3AF]">No scans yet</h2>
                <p className="mt-1 text-sm text-[#9CA3AF]">Start scanning to see your history</p>
                <Link
                  to="/scan"
                  search={{ mode: "photo" } as any}
                  onClick={() => analytics("empty_state_cta_tapped", { screen: "history" })}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1D9E75] px-6 py-3 font-bold text-white active:scale-95 transition"
                >
                  <ScanLine className="size-4" /> Scan Something
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {sorted.map((r) => (<HistoryRow key={r.id} r={r} />))}
            </ul>
          )}
        </HistoryListBoundary>
      </div>
    </AppShell>
  );
}

const HistoryRow = memo(function HistoryRow({ r }: { r: ScanRecord }) {
  return (
    <li>
      <Link to="/result/$id" params={{ id: r.id }} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3">
        {r.thumbnail ? (
          <img src={r.thumbnail} alt="" className="h-[60px] w-[60px] rounded-lg object-cover" />
        ) : (
          <div className="h-[60px] w-[60px] rounded-lg bg-[#F3F4F6] grid place-items-center text-xl">
            {r.scanType === "qr" ? "QR" : r.scanType === "barcode" ? "|||" : "IMG"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[#111827]">{r.title}</p>
          <p className="text-sm font-semibold text-[#1D9E75]">{r.currency || "USD"} {r.priceLow}-{r.priceHigh}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${hotnessBadge(r.hotness.tier)}`}>
          {r.hotness.label}
        </span>
      </Link>
    </li>
  );
});

function hotnessBadge(tier: ScanRecord["hotness"]["tier"]) {
  if (tier === "HOT") return "bg-[#16A34A]";
  if (tier === "WARM") return "bg-[#CA8A04]";
  return "bg-[#DC2626]";
}

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
      <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-white p-5 text-center">
        <AlertTriangle className="mx-auto mb-2 size-6 text-[#DC2626]" />
        <p className="font-display font-bold text-[#111827]">Couldn't load your history</p>
        <p className="mt-1 text-xs text-[#6B7280]">
          A scan record is corrupted. Clearing history will reset the local store.
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-lg bg-[#1D9E75] px-6 py-3 text-sm font-bold text-white active:scale-95 transition"
        >
          Clear history
        </button>
      </div>
    );
  }
}

const HistoryListBoundary = memo(HistoryListBoundaryImpl);
