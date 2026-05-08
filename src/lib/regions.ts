// Global regions: country selection drives local marketplaces + currency.
export interface Region {
  code: string;            // ISO 3166-1 alpha-2
  name: string;
  flag: string;            // emoji
  currency: string;        // ISO 4217
  locale: string;          // BCP 47
  markets: string[];       // local resale marketplaces
}

// Always-available global marketplaces for cross-checking
export const GLOBAL_MARKETS = [
  "eBay", "Amazon", "Etsy", "Discogs", "StockX", "GOAT", "Grailed",
  "Vestiaire Collective", "Catawiki", "Chrono24", "Reverb", "Whatnot",
];

export const REGIONS: Region[] = [
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", locale: "en-US",
    markets: ["eBay US", "Facebook Marketplace", "Mercari US", "Poshmark", "Depop", "OfferUp", "Craigslist", "TheRealReal"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", locale: "en-CA",
    markets: ["eBay CA", "Facebook Marketplace", "Kijiji", "Poshmark CA", "VarageSale", "Bunz"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", locale: "en-GB",
    markets: ["eBay UK", "Facebook Marketplace", "Vinted UK", "Depop", "Gumtree", "Preloved", "Shpock"] },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", locale: "fr-FR",
    markets: ["Leboncoin", "Vinted FR", "eBay FR", "Facebook Marketplace", "Vestiaire Collective", "Rakuten FR"] },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", locale: "de-DE",
    markets: ["eBay DE", "eBay Kleinanzeigen", "Vinted DE", "Facebook Marketplace", "Momox", "Rebuy"] },
  { code: "IT", name: "Italy", flag: "🇮🇹", currency: "EUR", locale: "it-IT",
    markets: ["Subito", "Vinted IT", "eBay IT", "Facebook Marketplace", "Wallapop IT"] },
  { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", locale: "es-ES",
    markets: ["Wallapop", "Vinted ES", "Milanuncios", "eBay ES", "Facebook Marketplace"] },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", currency: "EUR", locale: "nl-NL",
    markets: ["Marktplaats", "Vinted NL", "Facebook Marketplace", "2dehands"] },
  { code: "BE", name: "Belgium", flag: "🇧🇪", currency: "EUR", locale: "nl-BE",
    markets: ["2dehands", "Vinted BE", "Facebook Marketplace", "Marktplaats"] },
  { code: "SE", name: "Sweden", flag: "🇸🇪", currency: "SEK", locale: "sv-SE",
    markets: ["Blocket", "Tradera", "Sellpy", "Facebook Marketplace", "Plick"] },
  { code: "NO", name: "Norway", flag: "🇳🇴", currency: "NOK", locale: "nb-NO",
    markets: ["Finn.no", "Tise", "Facebook Marketplace"] },
  { code: "DK", name: "Denmark", flag: "🇩🇰", currency: "DKK", locale: "da-DK",
    markets: ["DBA", "Trendsales", "Reshopper", "Facebook Marketplace"] },
  { code: "FI", name: "Finland", flag: "🇫🇮", currency: "EUR", locale: "fi-FI",
    markets: ["Tori", "Huuto.net", "Facebook Marketplace"] },
  { code: "PL", name: "Poland", flag: "🇵🇱", currency: "PLN", locale: "pl-PL",
    markets: ["Allegro Lokalnie", "OLX PL", "Vinted PL", "Facebook Marketplace"] },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", currency: "CHF", locale: "de-CH",
    markets: ["Tutti", "Ricardo", "Anibis", "Facebook Marketplace"] },
  { code: "AT", name: "Austria", flag: "🇦🇹", currency: "EUR", locale: "de-AT",
    markets: ["Willhaben", "Shpock", "eBay Kleinanzeigen", "Facebook Marketplace"] },
  { code: "IE", name: "Ireland", flag: "🇮🇪", currency: "EUR", locale: "en-IE",
    markets: ["DoneDeal", "Adverts.ie", "eBay UK", "Facebook Marketplace"] },
  { code: "PT", name: "Portugal", flag: "🇵🇹", currency: "EUR", locale: "pt-PT",
    markets: ["OLX PT", "Vinted PT", "CustoJusto", "Facebook Marketplace"] },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", locale: "en-AU",
    markets: ["eBay AU", "Gumtree AU", "Facebook Marketplace", "Depop", "Catch"] },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", currency: "NZD", locale: "en-NZ",
    markets: ["Trade Me", "Facebook Marketplace", "eBay AU"] },
  { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", locale: "ja-JP",
    markets: ["Mercari JP", "Yahoo Auctions JP", "Rakuma", "Jimoty", "PayPay Flea Market", "Komehyo"] },
  { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", locale: "ko-KR",
    markets: ["Karrot (Danggeun)", "Bunjang", "Joonggonara", "Coupang"] },
  { code: "CN", name: "China", flag: "🇨🇳", currency: "CNY", locale: "zh-CN",
    markets: ["Xianyu (Idle Fish)", "Zhuanzhuan", "Taobao", "JD"] },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", currency: "HKD", locale: "zh-HK",
    markets: ["Carousell HK", "Facebook Marketplace", "HKTVmall"] },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", locale: "en-SG",
    markets: ["Carousell", "Facebook Marketplace", "Shopee SG", "Lazada SG"] },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", currency: "MYR", locale: "en-MY",
    markets: ["Carousell MY", "Mudah", "Shopee MY", "Lazada MY", "Facebook Marketplace"] },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", locale: "en-PH",
    markets: ["Carousell PH", "Facebook Marketplace", "Shopee PH", "Lazada PH"] },
  { code: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", locale: "th-TH",
    markets: ["Kaidee", "Shopee TH", "Lazada TH", "Facebook Marketplace"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", locale: "id-ID",
    markets: ["Tokopedia", "Bukalapak", "OLX ID", "Shopee ID", "Facebook Marketplace"] },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", locale: "en-IN",
    markets: ["OLX India", "Quikr", "Cashify", "Facebook Marketplace", "Flipkart"] },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", locale: "ar-AE",
    markets: ["Dubizzle", "Facebook Marketplace", "Carousell", "OpenSooq"] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR", locale: "ar-SA",
    markets: ["Haraj", "OpenSooq", "Facebook Marketplace", "Souq Mazad"] },
  { code: "QA", name: "Qatar", flag: "🇶🇦", currency: "QAR", locale: "ar-QA",
    markets: ["Qatar Living", "OpenSooq", "Facebook Marketplace"] },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", currency: "KWD", locale: "ar-KW",
    markets: ["4Sale", "OpenSooq", "Facebook Marketplace"] },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", currency: "BHD", locale: "ar-BH",
    markets: ["OpenSooq", "Dubizzle BH", "Facebook Marketplace"] },
  { code: "OM", name: "Oman", flag: "🇴🇲", currency: "OMR", locale: "ar-OM",
    markets: ["OpenSooq", "OLX Oman", "Facebook Marketplace"] },
  { code: "JO", name: "Jordan", flag: "🇯🇴", currency: "JOD", locale: "ar-JO",
    markets: ["OpenSooq JO", "Facebook Marketplace"] },
  { code: "LB", name: "Lebanon", flag: "🇱🇧", currency: "LBP", locale: "ar-LB",
    markets: ["OLX Lebanon", "OpenSooq LB", "Facebook Marketplace"] },
  { code: "IQ", name: "Iraq", flag: "🇮🇶", currency: "IQD", locale: "ar-IQ",
    markets: ["OpenSooq IQ", "Miswag", "Facebook Marketplace"] },
  { code: "SY", name: "Syria", flag: "🇸🇾", currency: "SYP", locale: "ar-SY",
    markets: ["OpenSooq SY", "Facebook Marketplace"] },
  { code: "YE", name: "Yemen", flag: "🇾🇪", currency: "YER", locale: "ar-YE",
    markets: ["OpenSooq YE", "Facebook Marketplace"] },
  { code: "PS", name: "Palestine", flag: "🇵🇸", currency: "ILS", locale: "ar-PS",
    markets: ["OpenSooq PS", "Facebook Marketplace"] },
  { code: "MA", name: "Morocco", flag: "🇲🇦", currency: "MAD", locale: "ar-MA",
    markets: ["Avito MA", "Marocannonces", "Facebook Marketplace"] },
  { code: "DZ", name: "Algeria", flag: "🇩🇿", currency: "DZD", locale: "ar-DZ",
    markets: ["Ouedkniss", "Facebook Marketplace"] },
  { code: "TN", name: "Tunisia", flag: "🇹🇳", currency: "TND", locale: "ar-TN",
    markets: ["Tayara", "Affare", "Facebook Marketplace"] },
  { code: "LY", name: "Libya", flag: "🇱🇾", currency: "LYD", locale: "ar-LY",
    markets: ["OpenSooq LY", "Facebook Marketplace"] },
  { code: "SD", name: "Sudan", flag: "🇸🇩", currency: "SDG", locale: "ar-SD",
    markets: ["OpenSooq SD", "Facebook Marketplace"] },
  { code: "MR", name: "Mauritania", flag: "🇲🇷", currency: "MRU", locale: "ar-MR",
    markets: ["Facebook Marketplace", "OLX"] },
  { code: "SO", name: "Somalia", flag: "🇸🇴", currency: "SOS", locale: "so-SO",
    markets: ["Facebook Marketplace"] },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯", currency: "DJF", locale: "ar-DJ",
    markets: ["Facebook Marketplace"] },
  { code: "KM", name: "Comoros", flag: "🇰🇲", currency: "KMF", locale: "ar-KM",
    markets: ["Facebook Marketplace"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", locale: "en-ZA",
    markets: ["Gumtree ZA", "Facebook Marketplace", "OLX ZA", "bidorbuy"] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", locale: "ar-EG",
    markets: ["OLX Egypt", "Dubizzle Egypt", "Facebook Marketplace"] },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", locale: "en-NG",
    markets: ["Jiji", "Jumia", "Facebook Marketplace"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", locale: "en-KE",
    markets: ["Jiji KE", "Jumia KE", "PigiaMe", "Facebook Marketplace"] },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", locale: "pt-BR",
    markets: ["OLX BR", "Mercado Livre", "Enjoei", "Facebook Marketplace", "Shopee BR"] },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", locale: "es-MX",
    markets: ["Mercado Libre MX", "Facebook Marketplace", "Segundamano", "Vinted MX"] },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", locale: "es-AR",
    markets: ["Mercado Libre AR", "OLX AR", "Facebook Marketplace"] },
  { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", locale: "es-CL",
    markets: ["Mercado Libre CL", "Yapo", "Facebook Marketplace"] },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", locale: "es-CO",
    markets: ["Mercado Libre CO", "OLX CO", "Facebook Marketplace"] },
  { code: "TR", name: "Turkey", flag: "🇹🇷", currency: "TRY", locale: "tr-TR",
    markets: ["Sahibinden", "Letgo", "Dolap", "Facebook Marketplace"] },
  { code: "RU", name: "Russia", flag: "🇷🇺", currency: "RUB", locale: "ru-RU",
    markets: ["Avito", "Yula", "Wildberries"] },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", currency: "UAH", locale: "uk-UA",
    markets: ["OLX UA", "Prom", "Facebook Marketplace"] },
];

const KEY = "flipit.region.v1";

export function getRegion(): Region {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const r = REGIONS.find(x => x.code === saved);
        if (r) return r;
      }
    } catch {}
    // best-effort detection by browser locale
    try {
      const loc = navigator.language || "en-US";
      const cc = loc.split("-")[1]?.toUpperCase();
      const r = REGIONS.find(x => x.code === cc);
      if (r) return r;
    } catch {}
  }
  return REGIONS[0];
}

export function setRegion(code: string) {
  try { localStorage.setItem(KEY, code); } catch {}
}
