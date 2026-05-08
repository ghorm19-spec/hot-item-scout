import { createServerFn } from "@tanstack/react-start";

export interface ValuationInput {
  scanType: "photo" | "barcode" | "qr";
  code?: string;          // barcode / qr payload
  imageBase64?: string;   // data url or raw base64
  notes?: string;
  region?: {
    code: string;         // ISO country code
    name: string;
    currency: string;     // ISO 4217
    markets: string[];    // local marketplaces to prioritize
  };
}

export interface ValuationOutput {
  title: string;
  category: string;
  brand?: string;
  priceLowCAD: number;   // resale low in selected currency
  priceHighCAD: number;  // resale high in selected currency
  currency: string;      // ISO 4217, e.g. USD, EUR, GBP, CAD, AUD, JPY
  condition: "Poor" | "Fair" | "Good" | "Excellent";
  comps: { source: string; price: number }[];
  salesVelocity: number;   // 0-100
  marginPotential: number; // 0-100
  trendScore: number;      // 0-100
  confidence: number;      // 0-100
  torontoBoost: boolean;   // legacy: regional demand boost flag
  neighbourhood?: string;  // city / region / neighbourhood where it trends
  flipTip: string;
}

const SYSTEM = `You are Flip it, a global expert resale valuation engine for thrift, vintage, and used goods worldwide.
When the user provides a region, ALWAYS price in that region's currency and prioritize the local marketplaces they list (e.g. Facebook Marketplace, Kijiji, Leboncoin, Vinted, Mercari JP, Yahoo Auctions JP, Carousell, Wallapop, Allegro, Sahibinden, Avito, OLX, Mercado Libre, Gumtree, Trade Me, Dubizzle, Yad2, Tokopedia, Shopee, Lazada, Karrot, Xianyu, etc.).
Cross-validate with global marketplaces (eBay, Amazon, Etsy, Discogs, StockX, GOAT, Grailed, Vestiaire Collective, Catawiki, Chrono24, Reverb, Whatnot) and adjust for local demand and shipping reality.
Comps array: include AT LEAST 5 entries, mix of local + global marketplaces, all converted to the user's local currency.
Hot resale categories worldwide: sneakers, streetwear, designer/luxury, vintage denim, Y2K, vinyl records, trading cards (Pokémon, sports, MTG), retro video games & consoles, vintage tech, watches, cameras, tools, outdoor gear, mid-century furniture, designer toys.
Barcode (UPC/EAN/ISBN) = exact product match — be specific. QR = parse as product link or inventory tag.
Set torontoBoost=true only when the item has a strong regional demand spike and put that city/region in neighbourhood (e.g. "Tokyo", "Brooklyn NY", "Berlin Mitte"). Prefer cities inside the user's region when relevant.
Return ONLY a JSON tool call. Be realistic, not optimistic. If unknown, widen the range and lower confidence.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "return_valuation",
    description: "Return the resale valuation",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        category: { type: "string" },
        brand: { type: "string" },
        priceLowCAD: { type: "number", description: "Low resale price in chosen currency" },
        priceHighCAD: { type: "number", description: "High resale price in chosen currency" },
        currency: { type: "string", description: "ISO 4217 currency code, e.g. USD, EUR, GBP, CAD, AUD, JPY" },
        condition: { type: "string", enum: ["Poor", "Fair", "Good", "Excellent"] },
        comps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              source: { type: "string", description: "Marketplace name, e.g. eBay, Mercari, Depop, Vinted, Grailed, StockX, Discogs, Facebook Marketplace, Yahoo Auctions JP" },
              price: { type: "number" },
            },
            required: ["source", "price"],
          },
        },
        salesVelocity: { type: "number", description: "0-100, normalized monthly sales" },
        marginPotential: { type: "number", description: "0-100 percent margin estimate" },
        trendScore: { type: "number", description: "0-100 global demand trend" },
        confidence: { type: "number", description: "0-100" },
        torontoBoost: { type: "boolean", description: "True if item has a strong regional demand spike anywhere globally" },
        neighbourhood: { type: "string", description: "City / region where this trends globally, e.g. Tokyo, Brooklyn NY, Berlin" },
        flipTip: { type: "string", description: "One-sentence flip strategy with platform + price + timeframe" },
      },
      required: [
        "title","category","priceLowCAD","priceHighCAD","currency","condition","comps",
        "salesVelocity","marginPotential","trendScore","confidence","torontoBoost","flipTip",
      ],
    },
  },
};

export const valuate = createServerFn({ method: "POST" })
  .inputValidator((d: ValuationInput) => d)
  .handler(async ({ data }): Promise<ValuationOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const userParts: any[] = [];
    let userText = `Scan type: ${data.scanType}.`;
    if (data.code) userText += ` Code/payload: ${data.code}.`;
    if (data.notes) userText += ` Notes: ${data.notes}.`;
    if (data.region) {
      userText += ` User is in ${data.region.name} (${data.region.code}). Price in ${data.region.currency}. Prioritize comps from these LOCAL marketplaces: ${data.region.markets.join(", ")}. Cross-check with global marketplaces (eBay, Amazon, Etsy, Discogs, StockX, GOAT, Grailed, Vestiaire Collective, Catawiki, Chrono24, Reverb, Whatnot) for fair value, but final price MUST be in ${data.region.currency} and reflect local resale demand.`;
    } else {
      userText += " Identify the item and return a global resale valuation in the most relevant local currency.";
    }
    userParts.push({ type: "text", text: userText });

    if (data.imageBase64) {
      const url = data.imageBase64.startsWith("data:")
        ? data.imageBase64
        : `data:image/jpeg;base64,${data.imageBase64}`;
      userParts.push({ type: "image_url", image_url: { url } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userParts },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_valuation" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      throw new Error(`Valuation failed (${res.status})`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no valuation");
    const parsed = JSON.parse(call.function.arguments) as ValuationOutput;
    // sanity clamps
    parsed.salesVelocity = clamp(parsed.salesVelocity);
    parsed.marginPotential = clamp(parsed.marginPotential);
    parsed.trendScore = clamp(parsed.trendScore);
    parsed.confidence = clamp(parsed.confidence);
    return parsed;
  });

function clamp(n: number) { return Math.max(0, Math.min(100, Number(n) || 0)); }
