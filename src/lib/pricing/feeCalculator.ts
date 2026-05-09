// Pure, dependency-free fee math. Safe in both client and server bundles.
export type ShippingTier = "lightweight" | "medium" | "heavy";

const HEAVY_HINTS = ["furniture", "console", "audio", "amplifier", "tv", "monitor", "tool"];
const MEDIUM_HINTS = ["sneaker", "shoe", "denim", "jacket", "bag", "boot", "camera", "lego"];

export function getShippingTier(category?: string): ShippingTier {
  const c = (category || "").toLowerCase();
  if (HEAVY_HINTS.some((k) => c.includes(k))) return "heavy";
  if (MEDIUM_HINTS.some((k) => c.includes(k))) return "medium";
  return "lightweight";
}

export function getShippingEstimate(category?: string): number {
  const tier = getShippingTier(category);
  return tier === "heavy" ? 14.99 : tier === "medium" ? 8.99 : 4.99;
}

export interface FeeBreakdown {
  grossSalePrice: number;
  ebayFee: number;       // marketplace final value fee
  paymentFee: number;    // payments processing
  shipping: number;
  netProceeds: number;
}

export function calculateNetProceeds(salePrice: number, category?: string): FeeBreakdown {
  const gross = Math.max(0, Number(salePrice) || 0);
  const ebayFee = gross > 0 ? gross * 0.1325 + 0.30 : 0;
  const paymentFee = gross > 0 ? gross * 0.029 + 0.30 : 0;
  const shipping = gross > 0 ? getShippingEstimate(category) : 0;
  const netProceeds = Math.max(0, gross - ebayFee - paymentFee - shipping);
  return {
    grossSalePrice: round2(gross),
    ebayFee: round2(ebayFee),
    paymentFee: round2(paymentFee),
    shipping: round2(shipping),
    netProceeds: round2(netProceeds),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }