import type { ScanRecord } from "./storage";

export type Marketplace = "ebay" | "mercari" | "facebook" | "depop" | "poshmark" | "generic";

export interface MarketplaceListing {
  marketplace: Marketplace;
  title: string;
  price: number;
  description: string;
  hashtags: string[];
  // Phase 4 — production-grade additions
  fees: { platformPct: number; payment: number; total: number; net: number };
  titleScore: { score: number; tips: string[] };  // 0-100 SEO/title quality
  recommendedPrice: number;                        // accounting for fees + platform norms
  resaleRisk: "low" | "medium" | "high";
  riskReasons: string[];
  conditionGuidance: string;
  templateNotes: string[];                         // category-specific listing tips
}

// ---- Pricing/fee model per platform ----
// Approximate fee structures (subject to change). Used to back out a recommended price
// so the seller actually clears the target net.
const PLATFORM_FEES: Record<Marketplace, { pct: number; flat: number; label: string }> = {
  ebay:     { pct: 0.1325, flat: 0.30, label: "~13.25% + $0.30" },
  mercari:  { pct: 0.10,   flat: 0,    label: "~10%" },
  facebook: { pct: 0.05,   flat: 0,    label: "~5% (shipped)" },
  depop:    { pct: 0.10,   flat: 0,    label: "~10%" },
  poshmark: { pct: 0.20,   flat: 0,    label: "20% (over $15)" },
  generic:  { pct: 0.10,   flat: 0,    label: "~10%" },
};

function cleanTitle(t: string) { return t.replace(/\s+/g, " ").trim(); }
function fmtPrice(n: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${Math.round(n)}`; }
}
function midPrice(rec: ScanRecord): number { return Math.round((rec.priceLow + rec.priceHigh) / 2); }
function cat(rec: ScanRecord) { return rec.category.split("/")[0].trim(); }

// ---- Hashtag bank ----
const HASHTAG_BANK = (rec: ScanRecord): string[] => {
  const c = rec.category.toLowerCase();
  const base = ["thrift", "thriftfind", "resell", "resale", "vintage", "preloved"];
  const map: Array<[string, string[]]> = [
    ["sneaker", ["sneakers", "sneakerhead", "kicks", "hypebeast"]],
    ["denim",   ["vintagedenim", "y2k", "selvedge"]],
    ["camera",  ["filmphotography", "vintagecamera", "analog"]],
    ["vinyl",   ["vinylcommunity", "records", "nowspinning"]],
    ["watch",   ["watches", "watchesofinstagram", "horology"]],
    ["card",    ["tcg", "trading", "collectibles"]],
    ["game",    ["retrogaming", "gamer", "collectibles"]],
    ["food",    ["pantry", "groceryflip"]],
    ["book",    ["bookstagram", "rarebooks"]],
  ];
  const extras = map.find(([k]) => c.includes(k))?.[1] ?? ["fashion", "style"];
  return [...new Set([...base, ...extras])].slice(0, 8);
};

// ---- Condition grading guidance ----
function conditionGuidance(rec: ScanRecord): string {
  const c = rec.condition;
  const cat = rec.category.toLowerCase();
  const basics: Record<string, string> = {
    Excellent: "Photograph from 4 angles in natural light. Note 'no flaws' explicitly — buyers reward proof.",
    Good:      "Show any wear close-up. Honest defect photos build trust and reduce returns.",
    Fair:      "List as 'pre-owned with visible wear'. Highlight what still works and price 15–25% below 'Good'.",
    Poor:      "Sell as 'for parts/repair' or 'as-is'. State all defects in title to avoid disputes.",
  };
  const cuesByCat: Array<[string, string]> = [
    ["sneaker", "Buyers expect sole, heel, and inner tag photos."],
    ["denim",   "Measurements (waist flat, inseam, rise) outperform tagged size."],
    ["camera",  "Confirm shutter fires + light seals; buyers ask both."],
    ["vinyl",   "Grade sleeve and disc separately (M/NM/VG+/VG)."],
    ["card",    "Use a clear sleeve; show centering, edges, surface, corners."],
    ["watch",   "State movement, last service, and box/papers presence."],
    ["book",    "Note edition, dust jacket, inscriptions, and any foxing."],
  ];
  const cue = cuesByCat.find(([k]) => cat.includes(k))?.[1];
  return cue ? `${basics[c]} ${cue}` : basics[c];
}

// ---- Title score: rewards brand, model, condition cues, length sweet spot ----
function scoreTitle(title: string, rec: ScanRecord): { score: number; tips: string[] } {
  const t = title.toLowerCase();
  const tips: string[] = [];
  let score = 50;
  if (rec.brand && t.includes(rec.brand.toLowerCase())) score += 15; else tips.push("Add the brand name early.");
  if (/\b(20\d{2}|19\d{2})\b/.test(t)) score += 5;
  if (/\b(new|nwt|nib|sealed|mint|vintage|rare|y2k)\b/.test(t)) score += 8; else tips.push("Add a condition or scarcity cue (NWT, Vintage, Sealed).");
  if (title.length >= 35 && title.length <= 80) score += 12; else tips.push("Aim for 35–80 chars — long enough to load keywords, short enough to scan.");
  if (/[A-Z]{2,}/.test(title)) score += 3;
  if (rec.condition && t.includes(rec.condition.toLowerCase())) score += 5;
  return { score: Math.min(100, score), tips };
}

// ---- Resale risk: combines confidence, comp spread, pricing tier ----
function assessRisk(rec: ScanRecord): { level: "low" | "medium" | "high"; reasons: string[] } {
  const reasons: string[] = [];
  let risk = 0;
  if (!rec.verified) { risk += 1; reasons.push("Identity not database-verified."); }
  if ((rec.confidence ?? 0) < 60) { risk += 2; reasons.push("Low identification confidence."); }
  if (rec.pricingTier === "ESTIMATE") { risk += 1; reasons.push("Prices are AI estimates, not real sold listings."); }
  if (rec.pricingTier === "SPECULATIVE" || rec.pricingTier === "UNKNOWN") { risk += 3; reasons.push("Pricing is speculative — verify on the platform before listing."); }
  if (rec.comps.length < 3) { risk += 1; reasons.push("Few comparable sales found."); }
  if (rec.comps.length >= 2) {
    const ps = rec.comps.map(c => c.price);
    const spread = Math.max(...ps) / Math.max(Math.min(...ps), 0.01);
    if (spread > 5) { risk += 2; reasons.push("Wide price spread between comps."); }
  }
  const level = risk >= 4 ? "high" : risk >= 2 ? "medium" : "low";
  if (level === "low") reasons.unshift("Comps and identity look consistent.");
  return { level, reasons };
}

// ---- Per-platform pricing recommendation that nets the seller's mid-target ----
function recommendPrice(targetNet: number, m: Marketplace): number {
  const f = PLATFORM_FEES[m];
  // gross such that gross - gross*pct - flat = targetNet → gross = (targetNet + flat) / (1 - pct)
  const gross = (targetNet + f.flat) / Math.max(0.01, 1 - f.pct);
  return Math.round(gross);
}

function feeBreakdown(price: number, m: Marketplace) {
  const f = PLATFORM_FEES[m];
  const platformPct = f.pct;
  const payment = f.flat;
  const total = Math.round((price * platformPct + payment) * 100) / 100;
  return { platformPct, payment, total, net: Math.round((price - total) * 100) / 100 };
}

// ---- Category-specific listing template notes ----
function templateNotes(rec: ScanRecord, m: Marketplace): string[] {
  const c = rec.category.toLowerCase();
  const notes: string[] = [];
  if (c.includes("sneaker") || c.includes("shoe")) notes.push("List size + men's/women's. Include box presence (with/without).");
  if (c.includes("denim")) notes.push("Always list flat measurements; tagged size is not enough.");
  if (c.includes("card") || c.includes("tcg")) notes.push("Use clear card sleeves on photos; mention centering.");
  if (c.includes("watch")) notes.push("State case material, movement type, and box/papers status.");
  if (c.includes("book")) notes.push("List edition, printing, dust-jacket presence.");
  if (m === "ebay") notes.push("Use eBay item specifics — they drive search ranking more than the title.");
  if (m === "mercari") notes.push("Mercari rewards 12 photos and a 1-line bold opener.");
  if (m === "poshmark") notes.push("Poshmark is share-driven — share to parties for visibility.");
  if (m === "depop") notes.push("Depop favors 4 well-styled square photos and short title.");
  if (m === "facebook") notes.push("Facebook Marketplace prioritizes local pickup; price for cash buyers.");
  return notes;
}

// ---- Main generator ----
export function generateListings(rec: ScanRecord): Record<Marketplace, MarketplaceListing> {
  const title = cleanTitle(rec.title);
  const targetNet = midPrice(rec);
  const cur = rec.currency || "USD";
  const tags = HASHTAG_BANK(rec);
  const cond = rec.condition;
  const brand = rec.brand ? `${rec.brand} ` : "";
  const condNote = conditionGuidance(rec);
  const risk = assessRisk(rec);

  const pricingDisclaimer =
    rec.pricingTier && rec.pricingTier !== "VERIFIED"
      ? "\n\nNote: This price was generated from AI estimates — verify against current sold listings on the platform before publishing."
      : "";

  const make = (m: Marketplace, baseTitle: string, descBody: string): MarketplaceListing => {
    const recommendedPrice = recommendPrice(targetNet, m);
    const fees = feeBreakdown(recommendedPrice, m);
    const ts = scoreTitle(baseTitle, rec);
    return {
      marketplace: m,
      title: baseTitle,
      price: recommendedPrice,
      description: descBody + pricingDisclaimer,
      hashtags: tags,
      fees,
      titleScore: ts,
      recommendedPrice,
      resaleRisk: risk.level,
      riskReasons: risk.reasons,
      conditionGuidance: condNote,
      templateNotes: templateNotes(rec, m),
    };
  };

  const baseDesc = `${brand}${title} — ${cond} condition. Authentic, sourced and inspected.`;
  const ship = "Ships within 1–2 business days. Smoke-free home.";
  const tagLine = tags.map((t) => `#${t}`).join(" ");

  return {
    ebay:     make("ebay",     `${brand}${title} — ${cond} (${cat(rec)})`.slice(0, 80),
                   `${baseDesc}\n\nCondition: ${cond}.\n${condNote}\n\nFair offers welcome. ${ship}`),
    mercari:  make("mercari",  `${brand}${title}`.slice(0, 60),
                   `${baseDesc}\n\n${condNote}\n\n${ship}\n${tagLine}`),
    facebook: make("facebook", `${brand}${title} — ${fmtPrice(recommendPrice(targetNet, "facebook"), cur)}`,
                   `${baseDesc}\n${condNote}\nLocal pickup or shipping available. DM with offers.`),
    depop:    make("depop",    `${brand}${title}`.slice(0, 65),
                   `${baseDesc} ✨\n\n${condNote}\n\n${tagLine}`),
    poshmark: make("poshmark", `${brand}${title}`.slice(0, 50),
                   `${baseDesc}\nCondition: ${cond}. ${condNote}\nBundle to save. ${ship}`),
    generic:  make("generic",  `${brand}${title}`,
                   `${baseDesc}\n\n${condNote}\n\n${ship}\n${tagLine}`),
  };
}

export function listingToText(l: MarketplaceListing, currency: string): string {
  return `${l.title}\n${fmtPrice(l.price, currency)}\n\n${l.description}`;
}

export function shareText(rec: ScanRecord): string {
  const price = midPrice(rec);
  const tierTag = rec.pricingTier === "VERIFIED" ? "Verified" : "Est.";
  return `${rec.title} — ${rec.hotness.emoji} ${rec.hotness.label} (score ${rec.hotness.score})\n${tierTag} resale ${fmtPrice(rec.priceLow, rec.currency)}–${fmtPrice(rec.priceHigh, rec.currency)} (mid ${fmtPrice(price, rec.currency)})\nFlipped with Flip it`;
}

export function platformFeeLabel(m: Marketplace): string { return PLATFORM_FEES[m].label; }
