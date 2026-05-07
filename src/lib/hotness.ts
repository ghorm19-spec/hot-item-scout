export type HotTier = "HOT" | "WARM" | "COLD";

export interface HotnessInput {
  salesVelocity: number;   // 0-100 (sales/mo normalized)
  marginPotential: number; // 0-100 (% margin)
  trendScore: number;      // 0-100
  exactMatch?: boolean;    // barcode/QR exact id
  torontoBoost?: boolean;  // local hot category
}

export interface HotnessResult {
  score: number;
  tier: HotTier;
  emoji: string;
  label: string;
  confidenceBonus: number;
}

export function computeHotness(i: HotnessInput): HotnessResult {
  const trend = i.torontoBoost ? Math.min(100, i.trendScore * 1.1) : i.trendScore;
  const raw =
    i.salesVelocity * 0.4 +
    i.marginPotential * 0.4 +
    trend * 0.2;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  let tier: HotTier = "COLD";
  let emoji = "❄️";
  let label = "LOW";
  if (score > 70) { tier = "HOT"; emoji = "🚀"; label = "HIGH"; }
  else if (score >= 35) { tier = "WARM"; emoji = "⚡"; label = "MEDIUM"; }
  return { score, tier, emoji, label, confidenceBonus: i.exactMatch ? 15 : 0 };
}

export function tierClass(tier: HotTier) {
  if (tier === "HOT") return "glow-hot text-hot border-hot/40";
  if (tier === "WARM") return "glow-warm text-warm border-warm/40";
  return "glow-cold text-cold border-cold/40";
}
