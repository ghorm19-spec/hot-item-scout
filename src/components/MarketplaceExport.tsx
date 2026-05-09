import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { generateListings, listingToText, platformFeeLabel, type Marketplace } from "@/lib/marketplace";
import type { ScanRecord } from "@/lib/storage";
import { Copy, Check, Share2, ShoppingBag, AlertTriangle, ShieldCheck, Info, Facebook, Store } from "lucide-react";
import { buildShareTargets, openShareWindow } from "@/lib/share";

const MARKETS: { key: Marketplace; label: string; color: string }[] = [
  { key: "ebay",     label: "eBay",     color: "text-warm" },
  { key: "mercari",  label: "Mercari",  color: "text-primary" },
  { key: "facebook", label: "Facebook", color: "text-cold" },
  { key: "depop",    label: "Depop",    color: "text-accent" },
  { key: "poshmark", label: "Poshmark", color: "text-hot" },
  { key: "generic",  label: "Generic",  color: "text-muted-foreground" },
];

const RISK_STYLES: Record<"low" | "medium" | "high", string> = {
  low: "border-hot/40 bg-hot/10 text-hot",
  medium: "border-warm/40 bg-warm/10 text-warm",
  high: "border-cold/40 bg-cold/10 text-cold",
};

export function MarketplaceExport({ rec, trigger }: { rec: ScanRecord; trigger: React.ReactNode }) {
  const [active, setActive] = useState<Marketplace>("ebay");
  const [copied, setCopied] = useState(false);
  const listings = generateListings(rec);
  const current = listings[active];
  const fullText = listingToText(current, rec.currency);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      navigator.vibrate?.(20);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: current.title, text: fullText }); } catch {}
    } else { copy(); }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: rec.currency, maximumFractionDigits: 2 }).format(n);

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            Listing copy generator
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Pick a marketplace — copy a fee-aware, ready-to-paste listing.</p>
        </SheetHeader>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {MARKETS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                active === m.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : `bg-secondary border-border ${m.color}`
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Risk banner */}
        <div className={`mt-3 rounded-xl border p-3 flex gap-2 text-xs ${RISK_STYLES[current.resaleRisk]}`}>
          {current.resaleRisk === "low" ? <ShieldCheck className="size-4 mt-0.5 shrink-0" /> : <AlertTriangle className="size-4 mt-0.5 shrink-0" />}
          <div>
            <p className="font-bold uppercase tracking-wider">Resale risk: {current.resaleRisk}</p>
            <ul className="mt-1 space-y-0.5 opacity-90 list-disc list-inside">
              {current.riskReasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-background/60 p-4 space-y-3 animate-rise">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Title</p>
              <span className={`text-[10px] font-bold ${current.titleScore.score >= 75 ? "text-hot" : current.titleScore.score >= 50 ? "text-warm" : "text-cold"}`}>
                SEO {current.titleScore.score}/100
              </span>
            </div>
            <p className="font-display font-bold leading-tight">{current.title}</p>
            {current.titleScore.tips.length > 0 && (
              <ul className="mt-1 text-[11px] text-muted-foreground list-disc list-inside">
                {current.titleScore.tips.slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Recommended price</p>
            <p className="font-display font-bold text-primary text-xl">{fmt(current.recommendedPrice)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Fees ({platformFeeLabel(active)}): −{fmt(current.fees.total)} · Net to you: <span className="text-foreground font-semibold">{fmt(current.fees.net)}</span>
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Condition guidance</p>
            <p className="text-xs text-foreground/85">{current.conditionGuidance}</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-line text-foreground/90">{current.description}</p>
          </div>

          {current.templateNotes.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/40 p-2.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Info className="size-3" /> Listing tips</p>
              <ul className="text-[11px] text-foreground/85 space-y-0.5 list-disc list-inside">
                {current.templateNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Hashtags</p>
            <p className="text-xs text-primary/90">{current.hashtags.map((t) => "#" + t).join(" ")}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={copy}
            className="rounded-xl bg-primary text-primary-foreground py-3 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy listing"}
          </button>
          <button
            onClick={share}
            className="rounded-xl bg-card border border-border py-3 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Share2 className="size-4" /> Share
          </button>
        </div>

        {active === "facebook" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => openShareWindow(buildShareTargets(rec).fbShare)}
              className="rounded-xl bg-cold/15 border border-cold/40 text-cold py-3 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Facebook className="size-4" /> Share to Facebook
            </button>
            <button
              onClick={async () => { await copy(); openShareWindow(buildShareTargets(rec).fbMarketplace); }}
              className="rounded-xl bg-primary/15 border border-primary/40 text-primary py-3 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Store className="size-4" /> List on Marketplace
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
