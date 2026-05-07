import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { computeBadges, getHistory, type ScanRecord } from "@/lib/storage";

export const Route = createFileRoute("/badges")({
  component: BadgesPage,
  head: () => ({ meta: [{ title: "Badges — Score Flipp" }] }),
});

function BadgesPage() {
  const [items, setItems] = useState<ScanRecord[]>([]);
  useEffect(() => { setItems(getHistory()); }, []);
  const badges = computeBadges(items);
  const totalProfit = items.reduce((s, h) => s + Math.max(0, (h.priceLow+h.priceHigh)/2 - (h.buyPrice ?? 0)), 0);
  const hot = items.filter(i => i.hotness.tier === "HOT").length;

  return (
    <AppShell>
      <header className="pt-6 pb-3">
        <h1 className="font-display font-black text-2xl">Achievements</h1>
        <p className="text-sm text-muted-foreground">Flip more, level up.</p>
      </header>

      <section className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="Scans" value={items.length} />
        <Stat label="🔥 High" value={hot} />
        <Stat label="Est. profit" value={`$${totalProfit.toFixed(0)}`} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        {badges.map(b => (
          <div key={b.key} className={`rounded-2xl border p-4 text-center ${b.earned ? "bg-card border-primary/40 glow-primary" : "bg-card/50 border-border opacity-50"}`}>
            <div className="text-4xl">{b.emoji}</div>
            <p className="mt-2 font-display font-bold">{b.label}</p>
            <p className="text-[11px] text-muted-foreground">{b.earned ? "Earned" : "Locked"}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="font-display font-black text-xl">{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
