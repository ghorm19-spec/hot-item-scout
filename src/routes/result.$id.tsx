import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getHistory, type ScanRecord } from "@/lib/storage";
import { tierClass } from "@/lib/hotness";
import { ArrowLeft, Share2, MapPin, TrendingUp, ScanLine, ShieldCheck, AlertTriangle, HelpCircle, Megaphone } from "lucide-react";
import { MarketplaceExport } from "@/components/MarketplaceExport";
import { shareText } from "@/lib/marketplace";

export const Route = createFileRoute("/result/$id")({
  component: ResultPage,
  head: () => ({ meta: [{ title: "Result — Flip it" }] }),
});

function confidenceTier(c: number): { label: string; cls: string } {
  if (c >= 75) return { label: "HIGH", cls: "text-hot border-hot/40 bg-hot/10" };
  if (c >= 50) return { label: "MEDIUM", cls: "text-warm border-warm/40 bg-warm/10" };
  return { label: "LOW", cls: "text-cold border-cold/40 bg-cold/10" };
}

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
  const conf = confidenceTier(rec.confidence);
  const isUnknown = !!rec.unknown || rec.confidence === 0;
  const heroImg = rec.imageUrl || rec.thumbnail;

  const share = async () => {
    const text = shareText(rec);
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

      {isUnknown && (
        <div className="mb-3 rounded-2xl border border-cold/40 bg-cold/10 p-4 flex gap-3">
          <HelpCircle className="size-5 text-cold shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-display font-bold text-cold">Couldn't identify this item</p>
            <p className="text-xs text-muted-foreground mt-1">
              The AI didn't have enough confidence to value this item. Try better lighting, a closer shot, or rescanning the barcode.
            </p>
            <Link to="/scan" search={{ mode: rec.scanType } as any} className="inline-block mt-3 rounded-lg bg-cold/20 text-cold border border-cold/40 px-3 py-1.5 text-xs font-bold">
              Rescan
            </Link>
          </div>
        </div>
      )}

      <section className={`relative rounded-3xl border bg-card p-5 grain ${t}`}>
        <div className="flex gap-4">
          {heroImg ? (
            <img src={heroImg} alt={rec.title} className="size-24 rounded-2xl object-cover border border-border bg-secondary" />
          ) : (
            <div className="size-24 rounded-2xl bg-secondary grid place-items-center text-3xl">
              {rec.scanType === "qr" ? "🔳" : rec.scanType === "barcode" ? "▦" : "📦"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{rec.category}</p>
            <h2 className="font-display font-bold text-lg leading-tight truncate">{rec.title}</h2>
            {rec.brand && <p className="text-xs text-muted-foreground truncate">by {rec.brand}</p>}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {!isUnknown && (
                <div className="inline-flex items-center gap-2 rounded-full border border-current/30 px-3 py-1 text-sm font-bold">
                  <span className="text-lg">{rec.hotness.emoji}</span>
                  {rec.hotness.label} · {rec.hotness.score}
                </div>
              )}
              {rec.verified && (
                <div className="inline-flex items-center gap-1 rounded-full border border-hot/40 bg-hot/10 text-hot px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="size-3" /> Verified
                </div>
              )}
            </div>
          </div>
        </div>

        {!isUnknown && (
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Resale ({rec.currency || "USD"})</p>
              <p className="font-display font-black text-3xl">
                {fmt(adjusted.low, rec.currency)}<span className="text-muted-foreground text-xl"> – </span>{fmt(adjusted.high, rec.currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Confidence</p>
              <div className={`inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded-lg border ${conf.cls}`}>
                <span className="font-display font-bold text-xl">{rec.confidence}%</span>
                <span className="text-[10px] font-bold tracking-wider">{conf.label}</span>
              </div>
            </div>
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {rec.dataSource ? `Source: ${rec.dataSource} · ` : ""}{rec.comps.length} comps{rec.code ? ` · ${rec.code.slice(0,16)}${rec.code.length>16?"…":""}` : ""}
        </p>
      </section>

      {rec.warnings && rec.warnings.length > 0 && !isUnknown && (
        <div className="mt-3 rounded-2xl border border-warm/40 bg-warm/10 p-3 flex gap-2">
          <AlertTriangle className="size-4 text-warm shrink-0 mt-0.5" />
          <ul className="text-xs text-warm space-y-1">
            {rec.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

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
