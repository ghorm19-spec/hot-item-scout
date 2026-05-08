// Client+server safe. No runtime deps.

export type BarcodeKind = "EAN13" | "UPC_A" | "EAN8" | "UPC_E" | "ISBN10" | "ISBN13" | "OTHER";

export function classifyBarcode(raw: string): BarcodeKind {
  const c = (raw || "").replace(/\s+/g, "");
  if (/^\d{13}$/.test(c)) {
    if (c.startsWith("978") || c.startsWith("979")) return "ISBN13";
    return "EAN13";
  }
  if (/^\d{12}$/.test(c)) return "UPC_A";
  if (/^\d{8}$/.test(c)) return "EAN8";
  if (/^\d{6}$/.test(c)) return "UPC_E";
  if (/^\d{9}[\dXx]$/.test(c)) return "ISBN10";
  return "OTHER";
}

// EAN/UPC mod-10 check
function eanCheck(code: string): boolean {
  const digits = code.split("").map((d) => parseInt(d, 10));
  if (digits.some(isNaN)) return false;
  const check = digits.pop()!;
  // From rightmost data digit, alternate weights 3,1,3,1...
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

function isbn10Check(code: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(code[i], 10) * (10 - i);
  const last = code[9].toUpperCase() === "X" ? 10 : parseInt(code[9], 10);
  sum += last * 1;
  return sum % 11 === 0;
}

export function validateBarcode(raw: string): { valid: boolean; kind: BarcodeKind; normalized: string } {
  const normalized = (raw || "").replace(/\s+/g, "");
  const kind = classifyBarcode(normalized);
  let valid = false;
  switch (kind) {
    case "EAN13":
    case "ISBN13":
    case "UPC_A":
    case "EAN8":
      valid = eanCheck(kind === "UPC_A" ? "0" + normalized : normalized);
      break;
    case "ISBN10":
      valid = isbn10Check(normalized);
      break;
    default:
      valid = false;
  }
  return { valid, kind, normalized };
}

// Loose category coherence: returns 0..1 score of how well title looks like category
export function titleCategoryCoherence(title: string, category: string): number {
  if (!title || !category) return 0.5;
  const t = title.toLowerCase();
  const c = category.toLowerCase();
  // Direct word overlap
  const tw = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const cw = c.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (cw.some((w) => tw.has(w))) return 1;
  // Common category cues
  const cues: Record<string, string[]> = {
    food: ["chocolate", "cookie", "snack", "drink", "soda", "candy", "bar", "chips"],
    supplement: ["vitamin", "capsule", "tablet", "protein", "omega", "biotin", "magnesium"],
    book: ["novel", "guide", "isbn", "edition", "vol", "volume"],
    game: ["game", "switch", "playstation", "xbox", "nintendo"],
    card: ["pokemon", "pokémon", "magic", "yugioh", "card", "tcg"],
    sneaker: ["nike", "adidas", "jordan", "yeezy", "sneaker", "shoe"],
    electronics: ["iphone", "samsung", "tv", "laptop", "headphone", "earbud"],
  };
  for (const [k, words] of Object.entries(cues)) {
    if (c.includes(k) && words.some((w) => t.includes(w))) return 1;
  }
  return 0.4;
}
