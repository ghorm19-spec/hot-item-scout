// Pure types — safe to import from both client and server.
export interface PricingResult {
  sold_prices: number[];
  median: number;
  low: number;
  high: number;
  sample_count: number;
  source: string;
  retrieved_at: string; // ISO
  is_mock: boolean;
  currency: string;
}

export interface PricingProvider {
  name: string;
  lookup(barcode: string, category: string): Promise<PricingResult>;
}

export function emptyResult(opts: { source: string; currency: string; reason?: string }): PricingResult {
  return {
    sold_prices: [],
    median: 0,
    low: 0,
    high: 0,
    sample_count: 0,
    source: opts.source,
    retrieved_at: new Date().toISOString(),
    is_mock: true,
    currency: opts.currency,
  };
}

/** Strip top 10% / bottom 10% by count (after sorting) and recompute stats. */
export function summarize(opts: {
  prices: number[];
  source: string;
  currency: string;
}): PricingResult {
  const cleaned = opts.prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (cleaned.length === 0) {
    return emptyResult({ source: opts.source, currency: opts.currency });
  }
  const trimCount = Math.floor(cleaned.length * 0.1);
  const trimmed = cleaned.length >= 5
    ? cleaned.slice(trimCount, cleaned.length - trimCount)
    : cleaned;
  const sorted = trimmed.length ? trimmed : cleaned;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return {
    sold_prices: sorted,
    median: Math.round(median * 100) / 100,
    low: Math.round(sorted[0] * 100) / 100,
    high: Math.round(sorted[sorted.length - 1] * 100) / 100,
    sample_count: sorted.length,
    source: opts.source,
    retrieved_at: new Date().toISOString(),
    is_mock: false,
    currency: opts.currency,
  };
}