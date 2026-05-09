// Server-only: queries verified product databases.
// All providers are free / no-key required for the default tier.

export interface VerifiedProduct {
  source: string;        // "Open Food Facts" | "Open Library" | "UPCitemdb" | "Google Books"
  title: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  ean?: string;
  raw?: any;
}

const TIMEOUT_MS = 2000;

async function fetchJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function lookupOpenFoodFacts(code: string): Promise<VerifiedProduct | null> {
  const data = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const title = p.product_name || p.generic_name || p.abbreviated_product_name;
  if (!title) return null;
  return {
    source: "Open Food Facts",
    title: String(title).trim(),
    brand: p.brands ? String(p.brands).split(",")[0].trim() : undefined,
    category: p.categories_tags?.[0]?.replace(/^en:/, "").replace(/-/g, " ") || "Food / Grocery",
    imageUrl: p.image_front_url || p.image_url,
    ean: code,
  };
}

async function lookupOpenLibrary(isbn: string): Promise<VerifiedProduct | null> {
  const data = await fetchJson(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
  );
  const key = `ISBN:${isbn}`;
  const book = data?.[key];
  if (!book?.title) return null;
  return {
    source: "Open Library",
    title: book.title,
    brand: book.authors?.[0]?.name,
    category: book.subjects?.[0]?.name ? `Book / ${book.subjects[0].name}` : "Book",
    imageUrl: book.cover?.medium || book.cover?.large,
    ean: isbn,
  };
}

async function lookupGoogleBooks(isbn: string): Promise<VerifiedProduct | null> {
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
  );
  const item = data?.items?.[0]?.volumeInfo;
  if (!item?.title) return null;
  return {
    source: "Google Books",
    title: item.title,
    brand: item.authors?.[0],
    category: item.categories?.[0] ? `Book / ${item.categories[0]}` : "Book",
    imageUrl: item.imageLinks?.thumbnail,
    ean: isbn,
  };
}

async function lookupUpcItemDb(code: string): Promise<VerifiedProduct | null> {
  const data = await fetchJson(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`,
    { headers: { Accept: "application/json" } },
  );
  const item = data?.items?.[0];
  if (!item?.title) return null;
  return {
    source: "UPCitemdb",
    title: item.title,
    brand: item.brand,
    category: item.category,
    imageUrl: item.images?.[0],
    ean: code,
  };
}

/**
 * Race verified product DBs based on barcode kind.
 * Returns the first non-null result with priority order.
 */
export async function lookupVerifiedProduct(
  code: string,
  kind: "EAN13" | "UPC_A" | "EAN8" | "UPC_E" | "ISBN10" | "ISBN13" | "OTHER",
): Promise<VerifiedProduct | null> {
  if (kind === "OTHER") return null;

  if (kind === "ISBN10" || kind === "ISBN13") {
    // Try Open Library first (free, fast), then Google Books fallback
    const ol = await lookupOpenLibrary(code);
    if (ol) return ol;
    return await lookupGoogleBooks(code);
  }

  // For EAN/UPC: race Open Food Facts (great for grocery/supplements) and UPCitemdb (general)
  const [off, upc] = await Promise.all([
    lookupOpenFoodFacts(code),
    lookupUpcItemDb(code),
  ]);

  // Prefer OFF for food/supplements, otherwise prefer whichever has the most data
  if (off && (off.category?.toLowerCase().includes("food") ||
              off.category?.toLowerCase().includes("supplement") ||
              off.category?.toLowerCase().includes("beverage") ||
              !upc)) return off;
  return upc || off;
}
