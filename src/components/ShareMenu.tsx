import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Facebook, Store, Copy, Check, Link2 } from "lucide-react";
import type { ScanRecord } from "@/lib/storage";
import { buildShareTargets, openShareWindow } from "@/lib/share";

interface Props {
  rec: ScanRecord;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
}

/** Share menu offering native share, Facebook, Facebook Marketplace, copy link, copy text. */
export function ShareMenu({ rec, trigger, align = "end" }: Props) {
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const targets = buildShareTargets(rec);

  const flash = (k: "link" | "text") => {
    setCopied(k);
    navigator.vibrate?.(20);
    setTimeout(() => setCopied(null), 1400);
  };

  const native = async () => {
    if (!navigator.share) return flash("text");
    try {
      await navigator.share({ title: rec.title, text: targets.text, url: targets.url });
    } catch {
      /* user cancelled */
    }
  };

  const copy = async (kind: "link" | "text") => {
    try {
      await navigator.clipboard.writeText(kind === "link" ? targets.url : `${targets.text}\n${targets.url}`);
      flash(kind);
    } catch {}
  };

  const fbMarketplace = async () => {
    // Pre-copy the full listing text so the user can paste into the Marketplace form.
    try { await navigator.clipboard.writeText(`${targets.text}\n${targets.url}`); } catch {}
    flash("text");
    openShareWindow(targets.fbMarketplace);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            className="size-9 grid place-items-center rounded-full bg-card border border-border active:scale-95 transition"
            aria-label="Share result"
          >
            <Share2 className="size-4" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Share this find
        </DropdownMenuLabel>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <DropdownMenuItem onClick={native} className="gap-2">
            <Share2 className="size-4" /> Share via…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => openShareWindow(targets.fbShare)} className="gap-2">
          <Facebook className="size-4 text-cold" /> Share to Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={fbMarketplace} className="gap-2">
          <Store className="size-4 text-primary" /> List on Marketplace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copy("link")} className="gap-2">
          {copied === "link" ? <Check className="size-4 text-hot" /> : <Link2 className="size-4" />}
          {copied === "link" ? "Link copied" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy("text")} className="gap-2">
          {copied === "text" ? <Check className="size-4 text-hot" /> : <Copy className="size-4" />}
          {copied === "text" ? "Text copied" : "Copy listing text"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}