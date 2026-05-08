// Lightweight i18n: pick a language, persist it, get translated strings.
// Falls back to English for any missing key/language.
import { useEffect, useSyncExternalStore } from "react";

export interface Language {
  code: string;
  name: string;       // English name
  native: string;     // Native name
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English",    native: "English" },
  { code: "ar", name: "Arabic",     native: "العربية", rtl: true },
  { code: "es", name: "Spanish",    native: "Español" },
  { code: "fr", name: "French",     native: "Français" },
  { code: "de", name: "German",     native: "Deutsch" },
  { code: "it", name: "Italian",    native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "nl", name: "Dutch",      native: "Nederlands" },
  { code: "pl", name: "Polish",     native: "Polski" },
  { code: "ru", name: "Russian",    native: "Русский" },
  { code: "tr", name: "Turkish",    native: "Türkçe" },
  { code: "fa", name: "Persian",    native: "فارسی", rtl: true },
  { code: "ur", name: "Urdu",       native: "اردو", rtl: true },
  { code: "he", name: "Hebrew",     native: "עברית", rtl: true },
  { code: "hi", name: "Hindi",      native: "हिन्दी" },
  { code: "bn", name: "Bengali",    native: "বাংলা" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay",      native: "Bahasa Melayu" },
  { code: "th", name: "Thai",       native: "ไทย" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "ja", name: "Japanese",   native: "日本語" },
  { code: "ko", name: "Korean",     native: "한국어" },
  { code: "zh", name: "Chinese",    native: "中文" },
  { code: "sw", name: "Swahili",    native: "Kiswahili" },
  { code: "uk", name: "Ukrainian",  native: "Українська" },
  { code: "el", name: "Greek",      native: "Ελληνικά" },
  { code: "sv", name: "Swedish",    native: "Svenska" },
  { code: "no", name: "Norwegian",  native: "Norsk" },
  { code: "da", name: "Danish",     native: "Dansk" },
  { code: "fi", name: "Finnish",    native: "Suomi" },
];

type Dict = Record<string, string>;

// Only English + Arabic are fully localized today; others fall back to English.
const TRANSLATIONS: Record<string, Dict> = {
  en: {
    "app.tagline_global": "Global · Local currency",
    "home.badge": "AI-powered · Worldwide",
    "home.title.scan": "Scan it.",
    "home.title.score": "Score it.",
    "home.title.flip": "Flip it.",
    "home.lead": "Snap a thrift find anywhere in the world — get a real local-currency price, demand Hotness, and a flip plan in seconds.",
    "home.cta": "Scan Now",
    "mode.photo": "Photo",
    "mode.barcode": "Barcode",
    "mode.qr": "QR",
    "tier.high": "HIGH",
    "tier.med": "MED",
    "tier.low": "LOW",
    "tier.high.sub": ">70 score",
    "tier.med.sub": "35–70",
    "tier.low.sub": "<35",
    "home.hot_title": "Hot worldwide right now",
    "home.footer": "Add to Home Screen for the full app · Unlimited scans",
    "scan.title": "Scan",
    "scan.hint.photo": "Frame the item, then tap SNAP.",
    "scan.hint.barcode": "Hold steady — barcode auto-detects.",
    "scan.hint.qr": "Point at the QR code — auto-detects.",
    "scan.scoring": "Scoring your find…",
    "scan.scoring.sub": "Cross-checking local + global comps",
    "region.title": "Choose your region",
    "region.search": "Search country or currency",
    "region.help": "We use your region to price in local currency and prioritize nearby resale markets.",
    "region.none": "No matches",
    "lang.title": "Choose your language",
    "lang.search": "Search language",
    "lang.none": "No matches",
  },
  ar: {
    "app.tagline_global": "عالمي · بالعملة المحلية",
    "home.badge": "مدعوم بالذكاء الاصطناعي · حول العالم",
    "home.title.scan": "صوّر.",
    "home.title.score": "قيّم.",
    "home.title.flip": "ابِع بربح.",
    "home.lead": "صوّر أي قطعة مستعملة في أي مكان بالعالم — احصل على سعر بالعملة المحلية، مؤشر الطلب وخطة بيع خلال ثوانٍ.",
    "home.cta": "ابدأ المسح",
    "mode.photo": "صورة",
    "mode.barcode": "باركود",
    "mode.qr": "رمز QR",
    "tier.high": "مرتفع",
    "tier.med": "متوسط",
    "tier.low": "منخفض",
    "tier.high.sub": "أكثر من 70",
    "tier.med.sub": "35–70",
    "tier.low.sub": "أقل من 35",
    "home.hot_title": "الأكثر رواجاً عالمياً الآن",
    "home.footer": "أضِف إلى الشاشة الرئيسية لتجربة كاملة · مسح غير محدود",
    "scan.title": "مسح",
    "scan.hint.photo": "وجّه الكاميرا نحو القطعة ثم اضغط التقط.",
    "scan.hint.barcode": "ثبّت الكاميرا — يتم اكتشاف الباركود تلقائياً.",
    "scan.hint.qr": "وجّه نحو رمز QR — يتم الاكتشاف تلقائياً.",
    "scan.scoring": "جاري تقييم القطعة…",
    "scan.scoring.sub": "مقارنة الأسعار محلياً وعالمياً",
    "region.title": "اختر منطقتك",
    "region.search": "ابحث عن دولة أو عملة",
    "region.help": "نستخدم منطقتك لعرض الأسعار بالعملة المحلية وإبراز أسواق إعادة البيع القريبة.",
    "region.none": "لا توجد نتائج",
    "lang.title": "اختر لغتك",
    "lang.search": "ابحث عن لغة",
    "lang.none": "لا توجد نتائج",
  },
};

const KEY = "flipit.lang.v1";
let listeners = new Set<() => void>();

function detect(): string {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGUAGES.find(l => l.code === saved)) return saved;
    const nav = (navigator.language || "en").split("-")[0].toLowerCase();
    if (LANGUAGES.find(l => l.code === nav)) return nav;
  } catch {}
  return "en";
}

let current = "en";
if (typeof window !== "undefined") current = detect();

export function getLang(): Language {
  return LANGUAGES.find(l => l.code === current) || LANGUAGES[0];
}

export function setLang(code: string) {
  if (!LANGUAGES.find(l => l.code === code)) return;
  current = code;
  try { localStorage.setItem(KEY, code); } catch {}
  applyDir();
  listeners.forEach(fn => fn());
}

export function applyDir() {
  if (typeof document === "undefined") return;
  const lang = getLang();
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function t(key: string): string {
  const lang = getLang().code;
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function useT() {
  useSyncExternalStore(subscribe, () => current, () => "en");
  useEffect(() => { applyDir(); }, []);
  return { t, lang: getLang() };
}
