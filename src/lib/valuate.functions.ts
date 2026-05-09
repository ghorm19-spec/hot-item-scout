import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validateBarcode, titleCategoryCoherence } from "./barcode";
import { lookupVerifiedProduct, type VerifiedProduct } from "./product-lookup.server";
import { ebayProvider } from "./pricing/EbayProvider.server";
import type { PricingResult } from "./pricing/PricingProvider";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as Sentry from "@sentry/react";

// ~2 MB decoded image cap (base64 expands ~33%, so cap raw string at ~2.8 MB)
const MAX_IMAGE_BASE64_CHARS = 2_800_000;

// Strip control chars (incl. newlines) from any free-text field that gets
// concatenated into the AI prompt — defends against prompt-injection.
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(/[\x00-\x1F\x7F]+/g, " ").trim());

const ValuationInputSchema = z.object({
  scanType: z.enum(["photo", "barcode", "qr"]),
  code: z.string().trim().max(128).regex(/^[\x20-\x7E]*$/, "invalid characters").optional(),
  imageBase64: z
    .string()
    .max(MAX_IMAGE_BASE64_CHARS, "image too large")
    .optional(),
  notes: safeText(500).optional(),
  region: z
    .object({
      code: z.string().trim().max(8).regex(/^[A-Za-z0-9-]{2,8}$/, "invalid region code"),
      name: safeText(64).pipe(z.string().regex(/^[\p{L}\p{N} ,.'\-()]{0,64}$/u, "invalid characters")),
      currency: z.string().trim().max(8).regex(/^[A-Za-z]{2,8}$/, "invalid currency"),
      markets: z
        .array(
          safeText(64).pipe(z.string().regex(/^[\p{L}\p{N} ,.'\-()/&]{0,64}$/u, "invalid characters")),
        )
        .max(20),
    })
    .optional(),
});

export interface ValuationInput {
  scanType: "photo" | "barcode" | "qr";
  code?: string;
  imageBase64?: string;
  notes?: string;
  region?: {
    code: string;
    name: string;
    currency: string;
    markets: string[];
  };
}

export type PricingTier = "VERIFIED" | "ESTIMATE" | "SPECULATIVE" | "UNKNOWN";

export interface ValuationOutput {
  title: string;
  category: string;
  brand?: string;
  priceLowCAD: number;
  priceHighCAD: number;
  currency: string;
  condition: "Poor" | "Fair" | "Good" | "Excellent";
  comps: { source: string; price: number }[];
  salesVelocity: number;
  marginPotential: number;
  trendScore: number;
  confidence: number;
  torontoBoost: boolean;
  neighbourhood?: string;
  flipTip: string;
  // Phase 1 + Phase 2 honesty additions
  verified: boolean;
  dataSource: string;
  warnings: string[];
  unknown: boolean;
  imageUrl?: string;
  // NEW — explicit honesty layer
  pricingTier: PricingTier;       // how to render prices in UI
  compsAreEstimates: boolean;     // when true, label comps as AI ESTIMATES not sold listings
  confidenceReasons: string[];    // human-readable explanations
  suggestBarcode?: boolean;       // photo-mode: nudge user to scan barcode
  confidenceGated?: boolean;      // true when server forced unknown due to confidence < 70
  // Real-comp metadata (present only when compsAreEstimates === false)
  pricingSource?: string;
  pricingSampleCount?: number;
  pricingMedian?: number;
  pricingLow?: number;
  pricingHigh?: number;
  pricingRetrievedAt?: string;
}

const SYSTEM_BASE = `You are Flip it, a precise resale-valuation engine for thrift, vintage, collectibles, and used consumer goods worldwide.

ABSOLUTE RULES — anti-hallucination:
1. NEVER invent a product. If you are not at least 70% sure what the item is, set unknown=true, confidence=0, title="Unknown item", and return generic empty comps. Do NOT guess Mario Kart, Pokémon, sneakers, or any branded product without clear visual or barcode evidence.
2. If a VERIFIED PRODUCT block is provided, you MUST use exactly that title, brand, and category. Do not substitute a different product. Your only job then is to price it.
3. Title and category MUST be coherent (a vitamin bottle is "Supplements", not "Video Games").
4. Comps are AI ESTIMATES based on training-data knowledge, not real-time sold listings. Be conservative with the range. If unsure, return fewer comps with a wider price range and lower confidence — do NOT pad with fabricated listings.
5. Confidence reflects YOUR certainty: 90+ only with verified DB match, 60-85 strong visual evidence, 30-55 plausible guess, 0-29 unknown.
6. For PHOTO scans without a verified barcode, default to caution. If the item could be many similar SKUs, set unknown=true rather than guessing one.
7. Price in the user's local currency, prioritizing their local marketplaces. Cross-validate with global marketplaces (eBay, Mercari, StockX, Discogs, Grailed, Vestiaire, Catawiki, Reverb).
8. Hot resale categories: sneakers, streetwear, designer/luxury, vintage denim, Y2K, vinyl, trading cards (Pokémon, sports, MTG), retro games & consoles, vintage tech, watches, cameras, tools, mid-century furniture, designer toys.
9. Return ONLY a JSON tool call.`;

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
        priceLowCAD: { type: "number" },
        priceHighCAD: { type: "number" },
        currency: { type: "string" },
        condition: { type: "string", enum: ["Poor", "Fair", "Good", "Excellent"] },
        comps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              source: { type: "string" },
              price: { type: "number" },
            },
            required: ["source", "price"],
          },
        },
        salesVelocity: { type: "number" },
        marginPotential: { type: "number" },
        trendScore: { type: "number" },
        confidence: { type: "number" },
        torontoBoost: { type: "boolean" },
        neighbourhood: { type: "string" },
        flipTip: { type: "string" },
        unknown: { type: "boolean", description: "true if you cannot identify the item with reasonable certainty" },
      },
      required: [
        "title", "category", "priceLowCAD", "priceHighCAD", "currency", "condition", "comps",
        "salesVelocity", "marginPotential", "trendScore", "confidence", "torontoBoost", "flipTip", "unknown",
      ],
    },
  },
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Number(n) || 0));
}

export const valuate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ValuationInputSchema.parse(d) as ValuationInput)
  .handler(async ({ data }): Promise<ValuationOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const warnings: string[] = [];
    let verified: VerifiedProduct | null = null;
    let invalidBarcode = false;

    // --------- STEP 1: Barcode validation + verified product lookup ---------
    if ((data.scanType === "barcode" || data.scanType === "qr") && data.code) {
      const { valid, kind, normalized } = validateBarcode(data.code);
      if (data.scanType === "barcode") {
        if (!valid && kind !== "OTHER") {
          invalidBarcode = true;
          warnings.push(`Barcode checksum failed (${kind}). Likely a misread — please rescan.`);
        } else if (valid) {
          verified = await lookupVerifiedProduct(normalized, kind);
          if (!verified) {
            warnings.push("Barcode is valid but not found in product databases.");
          }
        }
      } else if (data.scanType === "qr") {
        // QR may carry a URL or a UPC payload — try lookup if it looks like a barcode
        if (valid) verified = await lookupVerifiedProduct(normalized, kind);
      }
    }

    // If barcode was clearly garbage AND no image, fail fast — don't let AI hallucinate
    if (invalidBarcode && !data.imageBase64) {
      return unknownResult({
        currency: data.region?.currency || "USD",
        warnings,
        dataSource: "barcode-invalid",
      });
    }

    // --------- STEP 2: Build AI prompt with verified context ---------
    const userParts: any[] = [];
    let userText = `Scan type: ${data.scanType}.`;
    if (data.code) userText += ` Code: ${data.code}.`;
    if (data.notes) userText += ` Notes: ${data.notes}.`;

    if (verified) {
      userText += `\n\n=== VERIFIED PRODUCT (authoritative — use this exact identity) ===
Source: ${verified.source}
Title: ${verified.title}${verified.brand ? `\nBrand: ${verified.brand}` : ""}${verified.category ? `\nCategory: ${verified.category}` : ""}
Your job: price THIS exact product for resale. Do not substitute a different item.`;
    } else if (data.scanType === "barcode" && data.code) {
      userText += `\n\nBarcode was readable but no verified product DB match. Treat with caution — only identify if you are confident; otherwise set unknown=true.`;
    }

    if (data.region) {
      userText += `\n\nUser region: ${data.region.name} (${data.region.code}). Price in ${data.region.currency}. Local marketplaces: ${data.region.markets.join(", ")}.`;
    }

    userParts.push({ type: "text", text: userText });

    if (data.imageBase64) {
      const url = data.imageBase64.startsWith("data:")
        ? data.imageBase64
        : `data:image/jpeg;base64,${data.imageBase64}`;
      userParts.push({ type: "image_url", image_url: { url } });
    }

    // --------- STEP 3: Call AI ---------
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_BASE },
          { role: "user", content: userParts },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_valuation" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      throw new Error(`Valuation failed (${res.status})`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("AI returned no valuation");
    const parsed = JSON.parse(call.function.arguments) as Partial<ValuationOutput> & { unknown?: boolean };

    // --------- STEP 4: Post-validation + confidence adjustment ---------
    let confidence = clamp(parsed.confidence ?? 0);
    const aiUnknown = !!parsed.unknown || (parsed.title || "").toLowerCase().includes("unknown");

    // If AI flagged unknown, force a clean unknown result
    if (aiUnknown && !verified) {
      return unknownResult({
        currency: data.region?.currency || parsed.currency || "USD",
        warnings: [...warnings, "AI could not confidently identify this item."],
        dataSource: "ai-unknown",
      });
    }

    // Verified DB match → pin identity to verified product, boost confidence
    let title = parsed.title || verified?.title || "Unknown item";
    let category = parsed.category || verified?.category || "Uncategorized";
    let brand = parsed.brand || verified?.brand;

    if (verified) {
      // Force-override AI title if it drifted away from verified product
      title = verified.title;
      if (verified.brand) brand = verified.brand;
      if (verified.category && !category.toLowerCase().includes(verified.category.toLowerCase().split(" ")[0])) {
        category = verified.category;
      }
      confidence = Math.max(confidence, 85);
    } else {
      // Sanity check: title vs category coherence
      const coh = titleCategoryCoherence(title, category);
      if (coh < 0.5) {
        confidence = Math.min(confidence, 45);
        warnings.push("Title and category do not appear to match — result may be inaccurate.");
      }
    }

    // Sanity check comps spread (extreme spread = low certainty)
    const comps = (parsed.comps || []).filter((c) => c && typeof c.price === "number" && c.price > 0);
    if (comps.length >= 2) {
      const prices = comps.map((c) => c.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max / Math.max(min, 0.01) > 50) {
        confidence = Math.min(confidence, 50);
        warnings.push("Comparable prices vary wildly — pricing is uncertain.");
      }
    }
    if (comps.length < 2 && !verified) {
      confidence = Math.min(confidence, 40);
      warnings.push("Few comparable sales found — confidence reduced.");
    }

    // Photo-only scans without verified data: cap confidence harder
    let suggestBarcode = false;
    if (data.scanType === "photo" && !verified) {
      confidence = Math.min(confidence, 65);
      suggestBarcode = true;
    }

    confidence = clamp(confidence);

    // Hard server-side confidence gate: anything in 1-69 is suppressed to "unknown"
    // so partially-identified items never reach the display layer as products.
    // Items already at 0 stay 0; items >= 70 proceed normally.
    if (confidence > 0 && confidence < 70) {
      try {
        Sentry.addBreadcrumb({
          category: "confidence",
          message: "confidence_gated",
          data: { confidence, barcode: data.code },
        });
      } catch {}
      const gated = unknownResult({
        currency: parsed.currency || data.region?.currency || "USD",
        warnings: [...warnings, `Identification confidence ${confidence}/100 is below the 70 threshold — result hidden.`],
        dataSource: verified ? verified.source : "AI vision",
      });
      return { ...gated, confidenceGated: true };
    }

    // Derive pricing tier honestly
    const reasons: string[] = [];
    let pricingTier: PricingTier;
    if (verified && confidence >= 75) {
      pricingTier = "VERIFIED";
      reasons.push(`Identity confirmed by ${verified.source}.`);
      reasons.push("Prices are AI estimates calibrated against the verified product.");
    } else if (confidence >= 60) {
      pricingTier = "ESTIMATE";
      reasons.push("Identity inferred by AI vision — not database-verified.");
      reasons.push("Prices are AI estimates, not real-time sold listings.");
    } else if (confidence >= 30) {
      pricingTier = "SPECULATIVE";
      reasons.push("Low identification confidence — pricing should not be trusted as factual.");
    } else {
      pricingTier = "UNKNOWN";
    }
    if (suggestBarcode) reasons.push("Scan the barcode for a verified, more reliable result.");
    if (data.scanType === "photo") reasons.push("Photo-only scans are inherently less reliable than barcode scans.");

    // Suppress speculative prices entirely so we don't lie with numbers
    let priceLow = Number(parsed.priceLowCAD) || 0;
    let priceHigh = Number(parsed.priceHighCAD) || 0;
    if (pricingTier === "SPECULATIVE" || pricingTier === "UNKNOWN") {
      priceLow = 0; priceHigh = 0;
    }

    // ------- Real sold-listing comps (eBay) -------
    // Only attempt for barcode/qr scans with a usable code AND when we trust the identity.
    let realComps: PricingResult | null = null;
    let compsAreEstimates = true;
    let comps2 = comps;
    let dataSource = verified ? verified.source : "AI vision";
    let pricingSource: string | undefined;
    let pricingSampleCount: number | undefined;
    let pricingMedian: number | undefined;
    let pricingLow: number | undefined;
    let pricingHigh: number | undefined;
    let pricingRetrievedAt: string | undefined;

    const eligibleForRealComps =
      (data.scanType === "barcode" || data.scanType === "qr") &&
      !!data.code &&
      pricingTier !== "UNKNOWN" &&
      pricingTier !== "SPECULATIVE";

    if (eligibleForRealComps) {
      try {
        realComps = await ebayProvider.lookup(data.code!, category);
      } catch (e) {
        console.warn("[valuate] ebay lookup failed", e);
        realComps = null;
      }

      if (realComps && !realComps.is_mock && realComps.sample_count >= 5) {
        compsAreEstimates = false;
        dataSource = "ebay-sold-comps";
        pricingSource = realComps.source;
        pricingSampleCount = realComps.sample_count;
        pricingMedian = realComps.median;
        pricingLow = realComps.low;
        pricingHigh = realComps.high;
        pricingRetrievedAt = realComps.retrieved_at;

        // Override price band with real low/high; keep AI band as a sanity floor when sensible.
        priceLow = realComps.low;
        priceHigh = realComps.high;

        // Replace comps array with up to 6 real sold prices.
        const sample = realComps.sold_prices.slice(0, 6).map((price, i) => ({
          source: `eBay sold #${i + 1}`,
          price,
        }));
        comps2 = sample;

        // Real comps boost confidence floor.
        confidence = Math.max(confidence, 80);

        reasons.push(`Pricing based on ${realComps.sample_count} recent sold listings on eBay (median ${realComps.median} ${realComps.currency}).`);
      } else if (realComps && realComps.is_mock) {
        reasons.push("eBay sold-listing API not connected — comps are AI estimates only.");
      } else if (realComps) {
        reasons.push(`Only ${realComps.sample_count} eBay sold comp${realComps.sample_count === 1 ? "" : "s"} found — using AI estimates instead.`);
      }
    }

    return {
      title,
      category,
      brand,
      priceLowCAD: priceLow,
      priceHighCAD: priceHigh,
      currency: parsed.currency || data.region?.currency || "USD",
      condition: parsed.condition || "Good",
      comps: comps2,
      salesVelocity: clamp(parsed.salesVelocity ?? 0),
      marginPotential: clamp(parsed.marginPotential ?? 0),
      trendScore: clamp(parsed.trendScore ?? 0),
      confidence,
      torontoBoost: !!parsed.torontoBoost,
      neighbourhood: parsed.neighbourhood,
      flipTip: parsed.flipTip || "Insufficient data to suggest a flip strategy.",
      verified: !!verified,
      dataSource,
      warnings,
      unknown: false,
      imageUrl: verified?.imageUrl,
      pricingTier,
      compsAreEstimates,
      confidenceReasons: reasons,
      suggestBarcode,
      pricingSource,
      pricingSampleCount,
      pricingMedian,
      pricingLow,
      pricingHigh,
      pricingRetrievedAt,
    };
  });

function unknownResult(opts: { currency: string; warnings: string[]; dataSource: string }): ValuationOutput {
  return {
    title: "Unknown item",
    category: "Unidentified",
    priceLowCAD: 0,
    priceHighCAD: 0,
    currency: opts.currency,
    condition: "Good",
    comps: [],
    salesVelocity: 0,
    marginPotential: 0,
    trendScore: 0,
    confidence: 0,
    torontoBoost: false,
    flipTip: "Could not identify this item with confidence. Try a clearer photo, better lighting, or rescanning the barcode.",
    verified: false,
    dataSource: opts.dataSource,
    warnings: opts.warnings,
    unknown: true,
    pricingTier: "UNKNOWN",
    compsAreEstimates: true,
    confidenceReasons: ["The AI was not confident enough to identify this item.", "Try a clearer photo, better lighting, or scanning the barcode instead."],
    suggestBarcode: opts.dataSource !== "barcode-invalid",
  };
}
