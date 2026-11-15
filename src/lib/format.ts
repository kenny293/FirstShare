export function money(n: number | null | undefined, decimals = 0): string {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    // Never crash the UI over a missing number; flag it in development so the source can be found.
    if (process.env.NODE_ENV !== "production") console.warn("[money] invalid value:", n, new Error().stack);
    return "$—";
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function pct(n: number, opts: { signed?: boolean; decimals?: number } = {}): string {
  const { signed = true, decimals = 0 } = opts;
  const v = (n * 100).toFixed(decimals);
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${v}%`.replace("-", "−");
}

export function monthYear(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
