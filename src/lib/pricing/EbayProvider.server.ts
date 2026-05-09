import { type PricingProvider, type PricingResult, emptyResult, summarize } from "./PricingProvider";

const ENDPOINT = "https://svcs.ebay.com/services/search/FindingService/v1";
const SOURCE = "ebay-finding-completed";

export class EbayProvider implements PricingProvider {
  name = "ebay";

  async lookup(barcode: string, _category: string): Promise<PricingResult> {
    const key = process.env.EBAY_API_KEY;
    const currency = process.env.EBAY_CURRENCY || "CAD";
    if (!key || !key.trim()) {
      return emptyResult({ source: SOURCE, currency });
    }
    if (!barcode || !barcode.trim()) {
      return emptyResult({ source: SOURCE, currency });
    }

    const params = new URLSearchParams();
    params.set("OPERATION-NAME", "findCompletedItems");
    params.set("SERVICE-VERSION", "1.13.0");
    params.set("SECURITY-APPNAME", key);
    params.set("RESPONSE-DATA-FORMAT", "JSON");
    params.set("REST-PAYLOAD", "true");
    params.set("keywords", barcode.trim());
    params.set("itemFilter(0).name", "SoldItemsOnly");
    params.set("itemFilter(0).value", "true");
    params.set("itemFilter(1).name", "Currency");
    params.set("itemFilter(1).value", currency);
    params.set("sortOrder", "EndTimeSoonest");
    params.set("paginationInput.entriesPerPage", "30");

    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      console.warn("[EbayProvider] network error", err);
      return emptyResult({ source: SOURCE, currency });
    }

    if (!res.ok) {
      console.warn("[EbayProvider] non-OK response", res.status);
      return emptyResult({ source: SOURCE, currency });
    }

    let json: any;
    try { json = await res.json(); } catch { return emptyResult({ source: SOURCE, currency }); }

    const items: any[] =
      json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

    const prices: number[] = [];
    for (const it of items) {
      try {
        const sellingState = it?.sellingStatus?.[0];
        const status = sellingState?.sellingState?.[0];
        // Only include items that actually sold.
        if (status && String(status).toLowerCase() !== "endedwithsales") continue;
        const priceObj = sellingState?.currentPrice?.[0] ?? sellingState?.convertedCurrentPrice?.[0];
        const cur = priceObj?.["@currencyId"];
        const value = parseFloat(priceObj?.["__value__"]);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (cur && cur !== currency) continue; // only same-currency comps to keep math honest
        prices.push(value);
      } catch { /* skip */ }
    }

    return summarize({ prices, source: SOURCE, currency });
  }
}

export const ebayProvider = new EbayProvider();