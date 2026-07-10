export const currencies = [
  { code: "AUD", name: "Australian Dollar", symbol: "A$", localizedName: "澳元" },
  { code: "USD", name: "US Dollar", symbol: "US$", localizedName: "美元" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", localizedName: "人民币" },
  { code: "EUR", name: "Euro", symbol: "€", localizedName: "欧元" },
  { code: "GBP", name: "British Pound", symbol: "£", localizedName: "英镑" },
  { code: "JPY", name: "Japanese Yen", symbol: "JP¥", localizedName: "日元" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", localizedName: "韩元" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", localizedName: "新加坡元" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", localizedName: "马来西亚林吉特" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", localizedName: "加拿大元" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", localizedName: "新西兰元" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", localizedName: "港币" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", localizedName: "瑞士法郎" },
  { code: "THB", name: "Thai Baht", symbol: "฿", localizedName: "泰铢" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", localizedName: "印度卢比" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", localizedName: "阿联酋迪拉姆" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", localizedName: "沙特里亚尔" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$", localizedName: "新台币" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", localizedName: "印尼盾" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", localizedName: "菲律宾比索" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", localizedName: "越南盾" }
] as const;

export type CurrencyCode = (typeof currencies)[number]["code"];

const currencyCodeSet = new Set<string>(currencies.map((currency) => currency.code));

export function isSupportedCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && currencyCodeSet.has(value);
}
