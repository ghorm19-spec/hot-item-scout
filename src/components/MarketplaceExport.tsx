import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { generateListings, listingToText, type MarketplaceListing } from "@/lib/marketplace";
import type { ScanRecord } from "@/lib/storage";
import { Copy, Check, Share2, ShoppingBag } from "lucide-react";

const MARKETS: { key: MarketplaceListing["marketplace"]; label: string; color: string }[] = [
  { key: "ebay",     label: "eBay",         color: "text-warm" },
  { key: "mercari",  label: "Mercari",      color: "text-primary" },
  { key: "facebook", label: "Facebook",     color: "text-cold" },
  { key: "depop",    label: "Depop",        color: "text-accent" },
  { key: "poshmark", label: "Poshmark",     color: "text-hot" },
  { key: "generic",  label: "Generic",      color: "text-muted-foreground" },
];

export function MarketplaceExport({ rec, trigger }: { rec: ScanRecord; trigger: React.ReactNode }) {
  const [active, setActive] = useState<MarketplaceListing["marketplace"]>("ebay");
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
    } else {
      copy();
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            Listing copy generator
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Pick a marketplace — copy a ready-to-paste listing.</p>
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

        <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4 space-y-3 animate-rise">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Title</p>
            <p className="font-display font-bold leading-tight">{current.title}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Price</p>
            <p className="font-display font-bold text-primary">
              {new Intl.NumberFormat(undefined, { style: "currency", currency: rec.currency, maximumFractionDigits: 0 }).format(current.price)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-line text-foreground/90">{current.description}</p>
          </div>
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
      </SheetContent>
    </Sheet>
  );
}
