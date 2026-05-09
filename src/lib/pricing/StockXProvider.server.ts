import { type PricingProvider, type PricingResult, emptyResult } from "./PricingProvider";

/**
 * Stub. StockX has no public API; partner access only.
 * Returns is_mock: true until STOCKX_API_KEY (and a real integration) lands.
 */
export class StockXProvider implements PricingProvider {
  name = "stockx";
  async lookup(_barcode: string, _category: string): Promise<PricingResult> {
    const currency = process.env.STOCKX_CURRENCY || "USD";
    const _key = process.env.STOCKX_API_KEY;
    return emptyResult({ source: "stockx-unwired", currency });
  }
}

export const stockxProvider = new StockXProvider();