// Pure, deterministic resell strategy generator.
// Produces real, platform-specific recommendations based on item category,
// region, and live price band — not generic advice.

import type { ScanRecord } from "./storage";
import type { Region } from "./regions";

export interface PlatformStrategy {
  platform: string;
  priceLow: number;
  priceHigh: number;
  expectedDays: string;     // e.g. "2–3 days"
  demand: "high" | "steady" | "slow";
  reason: string;           // one-sentence "why this platform for this item"
}

// Category → ranked list of platforms that actually move that category well.
// Each entry: { match: regex on category text, platforms: ranked list }
const CATEGORY_PLATFORMS: Array<{ match: RegExp; platforms: string[] }> = [
  { match: /sneaker|shoe|trainer|jordan|yeezy|nike|adidas/i,
    platforms: ["StockX", "GOAT", "eBay", "Depop"] },
  { match: /streetwear|hoodie|tee|supreme|bape|stussy|palace/i,
    platforms: ["Grailed", "Depop", "eBay"] },
  { match: /denim|jeans|levis|levi|carhartt/i,
    platforms: ["Depop", "Grailed", "eBay", "Vinted"] },
  { match: /designer|luxury|gucci|prada|louis|chanel|hermes|dior/i,
    platforms: ["Vestiaire Collective", "TheRealReal", "eBay"] },
  { match: /watch|rolex|omega|seiko/i,
    platforms: ["Chrono24", "eBay", "WatchUSeek"] },
  { match: /vinyl|record|lp/i,
    platforms: ["Discogs", "eBay", "Reverb LP"] },
  { match: /card|tcg|pokemon|magic|mtg|baseball|sports card/i,
    platforms: ["TCGplayer", "eBay", "Whatnot"] },
  { match: /game|console|nintendo|playstation|xbox|retro/i,
    platforms: ["eBay", "Mercari", "Facebook Marketplace"] },
  { match: /camera|lens|leica|canon|nikon|fuji|polaroid/i,
    platforms: ["KEH", "eBay", "Mercari"] },
  { match: /lego|toy|figure|funko/i,
    platforms: ["eBay", "Mercari", "BrickLink"] },
  { match: /book|comic|manga/i,
    platforms: ["eBay", "AbeBooks", "Mercari"] },
  { match: /furniture|chair|table|lamp|mid.?century/i,
    platforms: ["Facebook Marketplace", "Chairish", "1stDibs"] },
  { match: /tool|drill|saw|dewalt|milwaukee/i,
    platforms: ["Facebook Marketplace", "eBay", "OfferUp"] },
  { match: /clothing|jacket|coat|dress|skirt|fashion|y2k|vintage/i,
    platforms: ["Depop", "Vinted", "Poshmark", "eBay"] },
  { match: /phone|iphone|samsung|electronic|laptop|tablet|ipad/i,
    platforms: ["Swappa", "eBay", "Facebook Marketplace"] },
];

// Per-platform metadata: typical fee, baseline sell-through, and a one-line "why".
const PLATFORM_META: Record<string, {
  feePct: number;
  baseDays: [number, number];   // typical days-to-sell range for in-demand items
  why: string;
}> = {
  "StockX":               { feePct: 0.10, baseDays: [1, 3],  why: "Authenticated sneakers move within days at market price." },
  "GOAT":                 { feePct: 0.095, baseDays: [2, 5],  why: "Strong sneaker buyer base, slightly lower fees than StockX." },
  "Grailed":              { feePct: 0.09, baseDays: [4, 14], why: "Buyers expect designer/streetwear and pay accordingly." },
  "Depop":                { feePct: 0.10, baseDays: [3, 10], why: "Gen-Z fashion buyers, fast turnaround for trendy items." },
  "Vinted":               { feePct: 0.05, baseDays: [4, 12], why: "Buyer pays fees — your asking price is your net." },
  "Poshmark":             { feePct: 0.20, baseDays: [7, 21], why: "Share-driven; works for women's clothing and accessories." },
  "Vestiaire Collective": { feePct: 0.15, baseDays: [10, 30], why: "Authenticated luxury — slower but premium prices." },
  "TheRealReal":          { feePct: 0.40, baseDays: [14, 30], why: "Consignment for luxury; they handle everything." },
  "Chrono24":             { feePct: 0.065, baseDays: [14, 45], why: "Global watch marketplace, serious buyers only." },
  "Discogs":              { feePct: 0.09, baseDays: [3, 14], why: "The vinyl marketplace — exact pressing matters." },
  "TCGplayer":            { feePct: 0.105, baseDays: [3, 10], why: "TCG players check prices here first." },
  "Whatnot":              { feePct: 0.08, baseDays: [1, 3],  why: "Live auctions move cards in minutes." },
  "KEH":                  { feePct: 0,    baseDays: [3, 7],  why: "Outright cash offer for cameras — fastest exit." },
  "BrickLink":            { feePct: 0.03, baseDays: [7, 21], why: "Lego collectors search by set number here." },
  "AbeBooks":             { feePct: 0.08, baseDays: [10, 30], why: "Best for rare and collectible books." },
  "Chairish":             { feePct: 0.20, baseDays: [21, 60], why: "Curated furniture buyers willing to pay shipping." },
  "1stDibs":              { feePct: 0.30, baseDays: [30, 90], why: "High-end design buyers, slow but premium." },
  "OfferUp":              { feePct: 0.0,  baseDays: [3, 10], why: "Local cash deals, no shipping hassle." },
  "Swappa":               { feePct: 0.03, baseDays: [3, 10], why: "Phones-only marketplace with low fees." },
  "Reverb LP":            { feePct: 0.08, baseDays: [7, 21], why: "Music-gear audience overlap helps records too." },
  "WatchUSeek":           { feePct: 0,    baseDays: [7, 30], why: "Enthusiast forum — list flat, pay no fees." },
  "Mercari":              { feePct: 0.10, baseDays: [4, 10], why: "Broad audience, simple shipping labels." },
  "eBay":                 { feePct: 0.1325, baseDays: [3, 10], why: "Largest buyer pool worldwide, sold-comps validate price." },
  "Facebook Marketplace": { feePct: 0.05, baseDays: [2, 7],  why: "Local pickup; cash buyers skip shipping cost." },
};

function regionalize(platform: string, region: Region): string {
  // Map global platform names to the closest local market in the region's market list.
  const local = region.markets.find((m) => m.toLowerCase().startsWith(platform.toLowerCase()));
  if (local) return local;
  // Some defaults
  if (platform === "eBay") {
    const ebayLocal = region.markets.find((m) => m.toLowerCase().startsWith("ebay"));
    return ebayLocal || "eBay";
  }
  if (platform === "Facebook Marketplace" && !region.markets.includes("Facebook Marketplace")) {
    return region.markets[0] || platform;
  }
  return platform;
}

function fmtDays(min: number, max: number): string {
  if (min === max) return `${min} days`;
  return `${min}–${max} days`;
}

function pickPlatforms(category: string): string[] {
  for (const { match, platforms } of CATEGORY_PLATFORMS) {
    if (match.test(category)) return platforms.slice(0, 3);
  }
  return ["eBay", "Mercari", "Facebook Marketplace"];
}

/**
 * Build platform-specific, actionable strategies based on real signals:
 *  - Real price band (priceLow/priceHigh)
 *  - Real sample count (sales velocity proxy)
 *  - Category (drives platform fit)
 *  - User's region (drives local marketplace mapping)
 */
export function buildSellStrategy(rec: ScanRecord, region: Region): PlatformStrategy[] {
  if (rec.unknown || rec.priceLow <= 0 || rec.priceHigh <= 0) return [];

  const lo = rec.priceLow;
  const hi = rec.priceHigh;
  const sample = rec.pricingSampleCount ?? 0;
  const hotness = rec.hotness?.score ?? 0;

  // Demand classification from real signals.
  let demand: PlatformStrategy["demand"];
  if (sample >= 15 || hotness >= 70) demand = "high";
  else if (sample >= 5 || hotness >= 40) demand = "steady";
  else demand = "slow";

  const speedMultiplier = demand === "high" ? 0.7 : demand === "steady" ? 1.0 : 1.6;
  const candidates = pickPlatforms(rec.category);

  return candidates.map((platform) => {
    const meta = PLATFORM_META[platform] ?? PLATFORM_META["eBay"];
    // Recommend a price band that nets the seller close to the market mid after fees.
    // Adjust upward by feePct so net ≈ market band.
    const adj = (n: number) => Math.max(1, Math.round(n / Math.max(0.5, 1 - meta.feePct)));
    const recLo = adj(lo);
    const recHi = adj(hi);
    const days = fmtDays(
      Math.max(1, Math.round(meta.baseDays[0] * speedMultiplier)),
      Math.max(2, Math.round(meta.baseDays[1] * speedMultiplier)),
    );

    let reason = meta.why;
    if (sample >= 15) reason = `${reason} ${sample} recent sold comps confirm demand.`;
    else if (sample > 0) reason = `${reason} Based on ${sample} recent sold listing${sample === 1 ? "" : "s"}.`;
    else if (rec.compsAreEstimates) reason = `${reason} Verify against current sold listings before publishing.`;

    return {
      platform: regionalize(platform, region),
      priceLow: recLo,
      priceHigh: recHi,
      expectedDays: days,
      demand,
      reason,
    };
  });
}

export function formatPrice(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}
