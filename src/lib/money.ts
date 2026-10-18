/** Whole amounts print without pence (£450); fractional ones keep two places (£49.99). */
export function formatMoney(amount?: number | null, currency = "GBP") {
  const value = Number(amount || 0);
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
