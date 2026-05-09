import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getHistory, saveScan, saveScanAsync, type ScanRecord } from "@/lib/storage";
import { tierClass } from "@/lib/hotness";
import { ArrowLeft, MapPin, TrendingUp, ScanLine, ShieldCheck, AlertTriangle, HelpCircle, Megaphone, Sparkles, Info, Settings as SettingsIcon, BadgeCheck, Bookmark, Check, Loader2, Activity, Copy, ClipboardCheck } from "lucide-react";
import { MarketplaceExport } from "@/components/MarketplaceExport";
import { ShareMenu } from "@/components/ShareMenu";
import { calculateNetProceeds } from "@/lib/pricing/feeCalculator";
import { toast } from "sonner";
import { analytics } from "@/lib/telemetry";
import { getRegion } from "@/lib/regions";

export const Route = createFileRoute("/result/$id")({
  component: ResultPage,
  head: () => ({ meta: [{ title: "Result — Flip it" }] }),
});

function confidenceTier(c: number): { label: string; cls: string } {
  if (c >= 75) return { label: "HIGH", cls: "text-hot border-hot/40 bg-hot/10" };
  if (c >= 50) return { label: "MEDIUM", cls: "text-warm border-warm/40 bg-warm/10" };
  return { label: "LOW", cls: "text-cold border-cold/40 bg-cold/10" };
}

const TIER_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  VERIFIED:    { label: "VERIFIED MATCH",  cls: "text-hot border-hot/40 bg-hot/10",   icon: ShieldCheck },
  ESTIMATE:    { label: "AI ESTIMATE",     cls: "text-warm border-warm/40 bg-warm/10", icon: Sparkles },
  SPECULATIVE: { label: "SPECULATIVE",     cls: "text-cold border-cold/40 bg-cold/10", icon: AlertTriangle },
  UNKNOWN:     { label: "UNIDENTIFIED",    cls: "text-cold border-cold/40 bg-cold/10", icon: HelpCircle },
};

const CONDITIONS = ["Poor","Fair","Good","Excellent"] as const;
const CONDITION_MULT: Record<string, number> = { Poor: 0.55, Fair: 0.78, Good: 1.0, Excellent: 1.2 };

function ResultPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [rec, setRec] = useState<ScanRecord | null>(null);
  const [condition, setCondition] = useState<ScanRecord["condition"]>("Good");
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const r = getHistory().find(h => h.id === id) || null;
    setRec(r);
    if (r) {
      setCondition(r.condition);
      setBuyPrice(r.buyPrice ?? 0);
      setSaved(!!r.savedAt);
    }
  }, [id]);

  const handleSave = async () => {
    if (!rec || saving || saved) return;
    setSaving(true);
    const updated: ScanRecord = { ...rec, condition, buyPrice, savedAt: Date.now() };
    try {
      await saveScanAsync(updated);
      setRec(updated);
      setSaved(true);
      toast.success("✓ Saved to your flips", { duration: 2500 });
      analytics("result_saved", {
        item_category: updated.category,
        profit_amount: Math.round((updated.priceLow + updated.priceHigh) / 2 - (updated.buyPrice ?? 0)),
      });
    } catch (e) {
      console.warn("save failed", e);
      toast.error("Save failed — tap to retry", {
        duration: 6000,
        action: { label: "Retry", onClick: () => handleSave() },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyListing = async () => {
    if (!rec || !adjusted) return;
    const country = (() => { try { return getRegion().name; } catch { return ""; } })();
    const price = new Intl.NumberFormat(undefined, { style: "currency", currency: rec.currency, maximumFractionDigits: 2 }).format(adjusted.mid);
    const tip = (rec.flipTip || "").split(/(?<=[.!?])\s+/)[0]?.trim() || "";
    const lines = [
      `${rec.title} — ${condition}`,
      `Asking: ${price}`,
      tip,
      country ? `Ships from: ${country}` : null,
      "Message me with any questions!",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      navigator.vibrate?.(15);
      const platforms = DEEP_LINK_PLATFORMS.filter(p => p.show(rec)).length;
      analytics("listing_copied", { platform_count: platforms });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  const adjusted = useMemo(() => {
    if (!rec) return null;
    const m = CONDITION_MULT[condition] ?? 1;
    const baseM = CONDITION_MULT[rec.condition] ?? 1;
    const factor = m / baseM;
    const low = Math.round(rec.priceLow * factor);
    const high = Math.round(rec.priceHigh * factor);
    const mid = (low + high) / 2;
    const fb = calculateNetProceeds(mid, rec.category);
    const profit = Math.max(0, fb.netProceeds - buyPrice);
    return { low, high, mid, fees: fb.ebayFee + fb.paymentFee + fb.shipping, profit, fb };
  }, [rec, condition, buyPrice]);

  if (!rec || !adjusted) {
    return <AppShell><p className="pt-10 text-center text-muted-foreground">Loading…</p></AppShell>;
  }

  const t = tierClass(rec.hotness.tier);
  const maxComp = Math.max(...rec.comps.map(c => c.price), 1);
  const conf = confidenceTier(rec.confidence);
  const isUnknown = !!rec.unknown || rec.confidence === 0;
  const heroImg = rec.imageUrl || rec.thumbnail;
  const hasRealComps = rec.compsAreEstimates === false && (rec.pricingSampleCount || 0) >= 5;

  const persistTweaks = () => {
    const updated = { ...rec, condition, buyPrice };
    saveScan(updated);
    setRec(updated);
  };

  return (
    <AppShell>
      <header dir="ltr" className="pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/" })} className="size-9 grid place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display font-bold">Result</h1>
        <ShareMenu rec={rec} />
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
              {(() => {
                const tier = rec.pricingTier || (rec.verified ? "VERIFIED" : "ESTIMATE");
                const t = TIER_BADGE[tier];
                const Icon = t.icon;
                return (
                  <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.cls}`}>
                    <Icon className="size-3" /> {t.label}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {!isUnknown && (rec.pricingTier === "VERIFIED" || rec.pricingTier === "ESTIMATE" || !rec.pricingTier) && (
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {rec.pricingTier === "VERIFIED" ? "Estimated resale" : "AI-estimated resale"} ({rec.currency || "USD"})
              </p>
              <p className="font-display font-black text-3xl">
                {fmt(adjusted.low, rec.currency)}<span className="text-muted-foreground text-xl"> – </span>{fmt(adjusted.high, rec.currency)}
              </p>
              {rec.pricingTier !== "VERIFIED" && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Verify against current sold listings before pricing.</p>
              )}
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

        {!isUnknown && rec.pricingTier === "SPECULATIVE" && (
          <div className="mt-4 rounded-xl border border-cold/40 bg-cold/10 p-3">
            <p className="text-[11px] uppercase tracking-widest text-cold font-bold">Pricing withheld</p>
            <p className="text-xs text-foreground/80 mt-1">Confidence is too low to show a trustworthy price. Try a clearer photo or scan the barcode.</p>
          </div>
        )}

        <p className="mt-1 text-[11px] text-muted-foreground">
          {rec.dataSource ? `Source: ${rec.dataSource} · ` : ""}{rec.comps.length} {hasRealComps ? "sold" : "AI-estimated"} comps{rec.code ? ` · ${rec.code.slice(0,16)}${rec.code.length>16?"…":""}` : ""}
        </p>
      </section>

      {/* Real sold-listing panel */}
      {hasRealComps && !isUnknown && (
        <section className="mt-3 rounded-2xl border border-hot/40 bg-hot/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BadgeCheck className="size-4 text-hot" />
            <p className="text-xs uppercase tracking-widest text-hot font-bold">Real market data</p>
          </div>
          <p className="text-xs text-foreground/85">
            Based on <span className="font-bold">{rec.pricingSampleCount}</span> recent sold listings on eBay.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Pill label="Low" value={fmt(rec.pricingLow ?? 0, rec.currency)} />
            <Pill label="Median" value={fmt(rec.pricingMedian ?? 0, rec.currency)} highlight />
            <Pill label="High" value={fmt(rec.pricingHigh ?? 0, rec.currency)} />
          </div>
          {rec.pricingRetrievedAt && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Retrieved {new Date(rec.pricingRetrievedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      {/* Confidence reasons — provenance/honesty panel */}
      {rec.confidenceReasons && rec.confidenceReasons.length > 0 && (
        <div className="mt-3 rounded-2xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><Info className="size-3" /> Why this confidence</p>
          <ul className="text-xs text-foreground/85 space-y-1 list-disc list-inside">
            {rec.confidenceReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {rec.suggestBarcode && rec.scanType === "photo" && (
            <Link to="/scan" search={{ mode: "barcode" } as any} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary/15 text-primary border border-primary/30 px-3 py-1.5 text-xs font-bold">
              <ScanLine className="size-3.5" /> Scan barcode for verified result
            </Link>
          )}
        </div>
      )}

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

      {(rec.pricingTier === "VERIFIED" || rec.pricingTier === "ESTIMATE" || !rec.pricingTier) && !isUnknown && (
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <Pill label="Mid sell" value={fmt(adjusted.mid, rec.currency)} />
            <Pill label="Net profit" value={fmt(adjusted.profit, rec.currency)} highlight />
          </div>
          <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 space-y-1.5 text-xs">
            <FeeRow label="Gross sell"     value={fmt(adjusted.fb.grossSalePrice, rec.currency)} />
            <FeeRow label="eBay fee (13.25% + $0.30)" value={`-${fmt(adjusted.fb.ebayFee, rec.currency)}`} />
            <FeeRow label="Payment fee (2.9% + $0.30)" value={`-${fmt(adjusted.fb.paymentFee, rec.currency)}`} />
            <FeeRow label="Shipping est."  value={`-${fmt(adjusted.fb.shipping, rec.currency)}`} />
            <div className="h-px bg-border my-1" />
            <FeeRow label="Net proceeds"   value={fmt(adjusted.fb.netProceeds, rec.currency)} bold />
          </div>
        </section>
      )}

      {/* Price context bar — pure SVG, hidden when resale data is missing */}
      {!isUnknown && adjusted.low > 0 && adjusted.high > adjusted.low && (
        <PriceContextBar
          buyPrice={buyPrice}
          low={adjusted.low}
          mid={adjusted.mid}
          high={adjusted.high}
          currency={rec.currency}
          live={hasRealComps}
        />
      )}

      {rec.comps.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3.5" /> Comparable prices
            </p>
            {hasRealComps ? (
              <span className="text-[9px] uppercase tracking-wider font-bold text-hot border border-hot/40 bg-hot/10 px-1.5 py-0.5 rounded">
                eBay Sold
              </span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider font-bold text-warm border border-warm/40 bg-warm/10 px-1.5 py-0.5 rounded">
                AI Estimates
              </span>
            )}
          </div>
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
          {hasRealComps ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Real sold prices from eBay (outliers trimmed).
            </p>
          ) : (
            <>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Estimates derived from AI knowledge, not real-time sold listings. Verify on the platform.
              </p>
              <Link
                to="/settings"
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary/15 text-primary border border-primary/30 px-3 py-1.5 text-[11px] font-bold"
              >
                <SettingsIcon className="size-3.5" /> Connect eBay in Settings for real comps
              </Link>
            </>
          )}
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 glow-primary">
        <p className="text-xs uppercase tracking-widest text-primary mb-1">Flip strategy</p>
        <p className="text-sm">{rec.flipTip}</p>
        {rec.neighbourhood && (
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="size-3" /> Trending in {rec.neighbourhood}
          </p>
        )}
      </section>

      {!isUnknown && rec.pricingTier !== "SPECULATIVE" && (
        <MarketplaceExport
          rec={rec}
          trigger={
            <button className="mt-5 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground py-3.5 font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition glow-primary">
              <Megaphone className="size-4" />
              Generate listing for marketplaces
            </button>
          }
        />
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          aria-disabled={saving || saved}
          className={`w-full rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 transition ${
            saved
              ? "bg-hot/15 text-hot border border-hot/40 cursor-default"
              : saving
                ? "bg-primary/70 text-primary-foreground cursor-wait"
                : "bg-primary text-primary-foreground glow-primary active:scale-[0.99]"
          }`}
        >
          {saved ? (
            <><Check className="size-4" /> Saved</>
          ) : saving ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : (
            <><Bookmark className="size-4" /> Save to my flips</>
          )}
        </button>

        <button
          onClick={() => navigate({ to: "/scan", search: { mode: rec.scanType } as any })}
          className="w-full rounded-2xl bg-card border border-border py-3.5 font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition"
        >
          <ScanLine className="size-4" /> Scan Another Item
        </button>

        <Link
          to="/history"
          className="w-full rounded-2xl bg-secondary text-foreground py-3 text-center text-sm font-semibold"
        >
          View history
        </Link>
      </div>
    </AppShell>
  );
}

function PriceContextBar({
  buyPrice, low, mid, high, currency, live,
}: { buyPrice: number; low: number; mid: number; high: number; currency: string; live?: boolean }) {
  // Bar spans from $0 to high * 1.05 for a touch of headroom.
  const max = high * 1.05;
  // Break-even: sell price where net proceeds ≈ buyPrice (approx 16% fees + $0.60 fixed).
  const breakEven = buyPrice > 0 ? buyPrice / 0.84 + 0.6 : 0;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const buyPct = buyPrice > 0 ? pct(buyPrice) : null;
  const breakEvenPct = breakEven > 0 ? pct(breakEven) : 0;
  const lowPct = pct(low);
  const midPct = pct(mid);
  const highPct = pct(high);

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Market price range</p>
        {live && (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-hot border border-hot/40 bg-hot/10 px-1.5 py-0.5 rounded">
            <Activity className="size-2.5" /> Live data
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-secondary border border-border">
        {/* Red zone — loss territory (0 → break-even) */}
        {breakEvenPct > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-cold/40"
            style={{ width: `${breakEvenPct}%` }}
          />
        )}
        {/* Green zone — profit window (break-even → high) */}
        <div
          className="absolute inset-y-0 bg-hot/50"
          style={{ left: `${breakEvenPct}%`, width: `${Math.max(0, highPct - breakEvenPct)}%` }}
        />
        {/* Tick: resale low */}
        <div
          className="absolute inset-y-0 w-px bg-foreground/40"
          style={{ left: `${lowPct}%` }}
        />
        {/* Tick: resale mid (avg) */}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${midPct}%` }}
        />
        {/* Buy-price marker dot */}
        {buyPct !== null && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full bg-primary border-2 border-background shadow-[0_0_0_2px] shadow-primary/40"
            style={{ left: `${buyPct}%` }}
            aria-label="Your buy price"
          />
        )}
      </div>

      {/* Labels */}
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <div className="flex flex-col items-start">
          <span className="text-muted-foreground uppercase tracking-wider">Price paid</span>
          <span className="font-display font-bold">{buyPrice > 0 ? fmt(buyPrice, currency) : "—"}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground uppercase tracking-wider">Avg resale</span>
          <span className="font-display font-bold">{fmt(mid, currency)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground uppercase tracking-wider">High end</span>
          <span className="font-display font-bold">{fmt(high, currency)}</span>
        </div>
      </div>

      {buyPrice > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Break-even sell price ≈ <span className="font-bold text-foreground">{fmt(breakEven, currency)}</span> after fees.
        </p>
      )}
    </section>
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

function FeeRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={`font-display ${bold ? "font-black text-primary" : "font-bold"}`}>{value}</span>
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
