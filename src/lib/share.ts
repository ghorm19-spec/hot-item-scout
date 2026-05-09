import type { ScanRecord } from "./storage";
import { shareText } from "./marketplace";

/** Build the public URL for a given scan result. Falls back to current origin. */
export function resultShareUrl(rec: ScanRecord): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/result/${rec.id}`;
}

/** Facebook share dialog — no app or login required by us; FB handles auth if needed. */
export function facebookShareUrl(url: string, quote?: string): string {
  const params = new URLSearchParams({ u: url });
  if (quote) params.set("quote", quote);
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/** Facebook Marketplace "create item" deep-link. Works on web + opens the FB app on mobile. */
export function facebookMarketplaceCreateUrl(): string {
  return "https://www.facebook.com/marketplace/create/item";
}

/** Open a share target in a new tab/window safely. */
export function openShareWindow(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer,width=640,height=720");
}

export interface ShareTargets {
  url: string;
  text: string;
  fbShare: string;
  fbMarketplace: string;
}

export function buildShareTargets(rec: ScanRecord): ShareTargets {
  const url = resultShareUrl(rec);
  const text = shareText(rec);
  return {
    url,
    text,
    fbShare: facebookShareUrl(url, text),
    fbMarketplace: facebookMarketplaceCreateUrl(),
  };
}