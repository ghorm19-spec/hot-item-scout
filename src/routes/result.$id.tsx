import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getHistory, saveScan, type ScanRecord } from "@/lib/storage";
import { tierClass } from "@/lib/hotness";
import { ArrowLeft, Share2, MapPin, TrendingUp, ScanLine } from "lucide-react";

export const Route = createFileRoute("/result/$id")({
  component: ResultPage,
  head: () => ({ meta: [{ title: "Result — Flip it" }] }),
});

const CONDITIONS = ["Poor","Fair","Good","Excellent"] as const;
const CONDITION_MULT: Record<string, number> = { Poor: 0.55, Fair: 0.78, Good: 1.0, Excellent: 1.2 };

function ResultPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [rec, setRec] = useState<ScanRecord | null>(null);
  const [condition, setCondition] = useState<ScanRecord["condition"]>("Good");
  const [buyPrice, setBuyPrice] = useState<number>(0);

  useEffect(() => {
    const r = getHistory().find(h => h.id === id) || null;
    setRec(r);
    if (r) { setCondition(r.condition); setBuyPrice(r.buyPrice ?? 0); }
  }, [id]);

  const adjusted = useMemo(() => {
    if (!rec) return null;
    const m = CONDITION_MULT[condition] ?? 1;
    const baseM = CONDITION_MULT[rec.condition] ?? 1;
    const factor = m / baseM;
    const low = Math.round(rec.priceLow * factor);
    const high = Math.round(rec.priceHigh * factor);
    const mid = (low + high) / 2;
    const fees = mid * 0.13; // platform + shipping rough
    const profit = Math.max(0, mid - buyPrice - fees);
    return { low, high, mid, fees, profit };
  }, [rec, condition, buyPrice]);

  if (!rec || !adjusted) {
    return <AppShell><p className="pt-10 text-center text-muted-foreground">Loading…</p></AppShell>;
  }

  const t = tierClass(rec.hotness.tier);
  const maxComp = Math.max(...rec.comps.map(c => c.price), 1);

  const share = async () => {
    const text = `${rec.title} — ${rec.hotness.emoji} ${rec.hotness.label} (score ${rec.hotness.score})\nCAD $${adjusted.low}–$${adjusted.high}\nvia Flip it`;
    if (navigator.share) { try { await navigator.share({ text }); } catch {} }
    else { navigator.clipboard?.writeText(text); }
  };

  const persistTweaks = () => {
    const updated = { ...rec, condition, buyPrice };
    const all = getHistory().filter(h => h.id !== rec.id);
    localStorage.setItem("scoreflipp.history.v1", JSON.stringify([updated, ...all].slice(0,200)));
    setRec(updated);
  };

  return (
    <AppShell>
      <header dir="ltr" className="pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/" })} className="size-9 grid place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display font-bold">Result</h1>
        <button onClick={share} className="size-9 grid place-items-center rounded-full bg-card border border-border">
          <Share2 className="size-4" />
        </button>
      </header>

      <section className={`relative rounded-3xl border bg-card p-5 grain ${t}`}>
        <div className="flex gap-4">
          {rec.thumbnail ? (
            <img src={rec.thumbnail} alt={rec.title} className="size-24 rounded-2xl object-cover border border-border" />
          ) : (
            <div className="size-24 rounded-2xl bg-secondary grid place-items-center text-3xl">
              {rec.scanType === "qr" ? "🔳" : rec.scanType === "barcode" ? "▦" : "📦"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{rec.category}</p>
            <h2 className="font-display font-bold text-lg leading-tight truncate">{rec.title}</h2>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-current/30 px-3 py-1 text-sm font-bold">
              <span className="text-lg">{rec.hotness.emoji}</span>
              {rec.hotness.label} · {rec.hotness.score}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Resale ({rec.currency || "USD"})</p>
            <p className="font-display font-black text-3xl">
              {fmt(adjusted.low, rec.currency)}<span className="text-muted-foreground text-xl"> – </span>{fmt(adjusted.high, rec.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Confidence</p>
            <p className="font-display font-bold text-xl">{rec.confidence}%</p>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {rec.comps.length} sources cross-validated{rec.code ? ` · code ${rec.code.slice(0,16)}${rec.code.length>16?"…":""}` : ""}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Condition</p>
        <div className="grid grid-cols-4 gap-1">
          {CONDITIONS.map(c => (
            <button
              key={c}
              onClick={() => setCondition(c)}
              className={`py-2 text-xs rounded-lg border ${condition===c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground"}`}
            >{c}</button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Profit calculator</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Buy price ({rec.currency || "USD"})</span>
          <input
            type="number" inputMode="decimal" min={0}
            value={buyPrice || ""}
            onChange={e => setBuyPrice(parseFloat(e.target.value) || 0)}
            onBlur={persistTweaks}
            placeholder="0"
            className="w-28 rounded-lg bg-input border border-border px-3 py-2 text-right font-display font-bold"
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Pill label="Mid sell" value={fmt(adjusted.mid, rec.currency)} />
          <Pill label="Fees ~13%" value={`-${fmt(adjusted.fees, rec.currency)}`} />
          <Pill label="Net profit" value={fmt(adjusted.profit, rec.currency)} highlight />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1">
          <TrendingUp className="size-3.5" /> Recent sold comps
        </p>
        <ul className="space-y-2">
          {rec.comps.map((c, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-muted-foreground">{c.source}</span>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(c.price/maxComp)*100}%` }} />
              </div>
              <span className="w-14 text-right text-sm font-display font-bold">{fmt(c.price, rec.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 glow-primary">
        <p className="text-xs uppercase tracking-widest text-primary mb-1">Flip strategy</p>
        <p className="text-sm">{rec.flipTip}</p>
        {rec.neighbourhood && (
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3" /> Trending in {rec.neighbourhood}
          </p>
        )}
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/scan" search={{ mode: "photo" } as any} className="rounded-xl bg-card border border-border py-3 text-center text-sm font-semibold flex items-center justify-center gap-2">
          <ScanLine className="size-4" /> Scan another
        </Link>
        <Link to="/history" className="rounded-xl bg-primary text-primary-foreground py-3 text-center text-sm font-bold">
          View history
        </Link>
      </div>
    </AppShell>
  );
}

function Pill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-2 ${highlight ? "border-primary/40 bg-primary/10" : "border-border bg-secondary"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function fmt(n: number, currency?: string) {
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${cur} ${Math.round(n)}`;
  }
}
