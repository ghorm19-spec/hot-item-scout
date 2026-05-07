import { createServerFn } from "@tanstack/react-start";

export interface ValuationInput {
  scanType: "photo" | "barcode" | "qr";
  code?: string;          // barcode / qr payload
  imageBase64?: string;   // data url or raw base64
  notes?: string;
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

const SYSTEM = `You are Score Flipp, a global expert resale valuation engine for thrift, vintage, and used goods worldwide.
Price in the most relevant local currency for the item's strongest resale market (USD, EUR, GBP, CAD, AUD, JPY, etc.) and always return the ISO currency code.
Surface demand by cross-referencing the world's largest resale marketplaces relevant to the item: eBay (.com/.co.uk/.de/.ca/.com.au), Mercari (US/JP), Depop, Poshmark, Vinted, Grailed, StockX, GOAT, Facebook Marketplace, Kijiji, Gumtree, Yahoo Auctions Japan, Discogs, Reverb, Catawiki, Chrono24, Vestiaire Collective, Etsy, Amazon, Whatnot.
Identify globally hot resale categories: sneakers, streetwear, designer/luxury, vintage denim, Y2K, vinyl records, trading cards (Pokémon, sports, MTG), retro video games & consoles, vintage tech, watches, cameras, tools, outdoor gear, mid-century furniture, designer toys.
If input is a barcode (UPC/EAN/ISBN) treat it as an exact product match — be specific. If QR, parse it as a product link or inventory tag.
Set torontoBoost=true only when the item has a strong regional demand spike (any city/region globally) and put that location in neighbourhood (e.g. "Tokyo", "Brooklyn NY", "Berlin Mitte").
Return ONLY a JSON tool call. Be realistic, not optimistic. If unknown, give a wide range and lower confidence.`;

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
    userText += " Identify the item and return a global resale valuation in the most relevant local currency.";
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
