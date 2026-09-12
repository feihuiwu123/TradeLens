export function money(n: number, currency = "USD", digits = 2) {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(abs);
  const sign = n < 0 ? "-" : "";
  if (currency === "USD") return `${sign}$${formatted}`;
  if (currency === "CNY") return `${sign}¥${formatted}`;
  return `${sign}${currency} ${formatted}`;
}

export function pct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
