import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getHistory, clearHistory, type ScanRecord } from "@/lib/storage";
import { tierClass } from "@/lib/hotness";

type Sort = "date" | "hotness" | "profit" | "category";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "History — Flip it" }] }),
});

function HistoryPage() {
  const [items, setItems] = useState<ScanRecord[]>([]);
  const [sort, setSort] = useState<Sort>("date");

  useEffect(() => { setItems(getHistory()); }, []);

  const sorted = [...items].sort((a, b) => {
    if (sort === "date") return b.createdAt - a.createdAt;
    if (sort === "hotness") return b.hotness.score - a.hotness.score;
    if (sort === "profit") return ((b.priceLow+b.priceHigh)/2 - (b.buyPrice ?? 0)) - ((a.priceLow+a.priceHigh)/2 - (a.buyPrice ?? 0));
    return a.category.localeCompare(b.category);
  });

  return (
    <AppShell>
      <header className="pt-6 pb-3 flex items-center justify-between">
        <h1 className="font-display font-black text-2xl">History</h1>
        {items.length > 0 && (
          <button
            onClick={() => { if (confirm("Clear all scans?")) { clearHistory(); setItems([]); } }}
            className="text-xs text-muted-foreground"
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

      {sorted.length === 0 ? (
        <div className="mt-10 text-center text-muted-foreground">
          <p>No scans yet.</p>
          <Link to="/scan" search={{ mode: "photo" } as any} className="mt-4 inline-block rounded-xl bg-primary text-primary-foreground px-4 py-2 font-semibold">Start scanning</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(r => (
            <li key={r.id}>
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
          ))}
        </ul>
      )}
    </AppShell>
  );
}
