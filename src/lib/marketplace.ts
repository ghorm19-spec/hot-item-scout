import type { ScanRecord } from "./storage";

export interface MarketplaceListing {
  marketplace: "ebay" | "mercari" | "facebook" | "depop" | "poshmark" | "generic";
  title: string;
  price: number;
  description: string;
  hashtags: string[];
}

function cleanTitle(t: string) { return t.replace(/\s+/g, " ").trim(); }

function fmtPrice(n: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${Math.round(n)}`; }
}

function midPrice(rec: ScanRecord): number {
  return Math.round((rec.priceLow + rec.priceHigh) / 2);
}

const HASHTAG_BANK = (rec: ScanRecord): string[] => {
  const cat = rec.category.toLowerCase();
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
  const extras = map.find(([k]) => cat.includes(k))?.[1] ?? ["fashion", "style"];
  return [...new Set([...base, ...extras])].slice(0, 8);
};

export function generateListings(rec: ScanRecord): Record<MarketplaceListing["marketplace"], MarketplaceListing> {
  const title = cleanTitle(rec.title);
  const price = midPrice(rec);
  const cur = rec.currency || "USD";
  const tags = HASHTAG_BANK(rec);
  const cond = rec.condition;
  const brand = rec.brand ? `${rec.brand} ` : "";

  const baseDesc = `${brand}${title} — ${cond} condition. Authentic, sourced and inspected.`;
  const ship = "Ships within 1–2 business days. Smoke-free home.";
  const tagLine = tags.map((t) => `#${t}`).join(" ");

  return {
    ebay: {
      marketplace: "ebay",
      title: `${brand}${title} — ${cond} (${cat(rec)})`.slice(0, 80),
      price,
      description: `${baseDesc}\n\nCondition: ${cond}.\nFair offers welcome. ${ship}`,
      hashtags: tags,
    },
    mercari: {
      marketplace: "mercari",
      title: `${brand}${title}`.slice(0, 60),
      price,
      description: `${baseDesc}\n\n${ship}\n${tagLine}`,
      hashtags: tags,
    },
    facebook: {
      marketplace: "facebook",
      title: `${brand}${title} — ${fmtPrice(price, cur)}`,
      price,
      description: `${baseDesc}\nLocal pickup or shipping available. DM with offers.`,
      hashtags: tags,
    },
    depop: {
      marketplace: "depop",
      title: `${brand}${title}`.slice(0, 65),
      price,
      description: `${baseDesc} ✨\n\n${tagLine}`,
      hashtags: tags,
    },
    poshmark: {
      marketplace: "poshmark",
      title: `${brand}${title}`.slice(0, 50),
      price,
      description: `${baseDesc}\nCondition: ${cond}. Bundle to save. ${ship}`,
      hashtags: tags,
    },
    generic: {
      marketplace: "generic",
      title: `${brand}${title}`,
      price,
      description: `${baseDesc}\n\n${ship}\n${tagLine}`,
      hashtags: tags,
    },
  };
}

function cat(rec: ScanRecord) {
  return rec.category.split("/")[0].trim();
}

export function listingToText(l: MarketplaceListing, currency: string): string {
  return `${l.title}\n${fmtPrice(l.price, currency)}\n\n${l.description}`;
}

export function shareText(rec: ScanRecord): string {
  const price = midPrice(rec);
  return `${rec.title} — ${rec.hotness.emoji} ${rec.hotness.label} (score ${rec.hotness.score})\nEst. resale ${fmtPrice(rec.priceLow, rec.currency)}–${fmtPrice(rec.priceHigh, rec.currency)} (mid ${fmtPrice(price, rec.currency)})\nFlipped with Flip it`;
}
