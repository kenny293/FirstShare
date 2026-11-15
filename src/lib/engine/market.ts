import type { Market, PricePoint } from "./types";

/** Keep only the last trading day of each calendar week (Mon-Sun). */
export function toWeekly(prices: PricePoint[]): PricePoint[] {
  const out: PricePoint[] = [];
  let currentKey = "";
  for (const point of prices) {
    const key = weekKey(point[0]);
    if (key === currentKey) out[out.length - 1] = point;
    else {
      out.push(point);
      currentKey = key;
    }
  }
  return out;
}

function weekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Align several series onto the union of their dates. Missing values are
 * forward-filled; values before an asset's first trade are NaN.
 */
export function buildMarket(series: Record<string, PricePoint[]>): Market {
  const dateSet = new Set<string>();
  for (const s of Object.values(series)) for (const [d] of s) dateSet.add(d);
  const dates = [...dateSet].sort();

  const prices: Record<string, number[]> = {};
  for (const [id, s] of Object.entries(series)) {
    const lookup = new Map(s);
    const arr: number[] = new Array(dates.length);
    let last = NaN;
    for (let i = 0; i < dates.length; i++) {
      const p = lookup.get(dates[i]);
      if (p !== undefined && Number.isFinite(p) && p > 0) last = p;
      arr[i] = last;
    }
    prices[id] = arr;
  }
  return { dates, prices };
}

/**
 * Build a synthetic fund that tracks `base` but charges an extra annual fee.
 * Used for the fictional high-fee "active" fund. Real ETF prices already have
 * their expense ratio baked in, so this is only for derived series.
 */
export function withAnnualFee(base: PricePoint[], extraAnnualFee: number): PricePoint[] {
  if (base.length === 0) return [];
  const t0 = Date.parse(base[0][0]);
  const yearMs = 365.25 * 24 * 3600 * 1000;
  return base.map(([d, p]) => {
    const years = (Date.parse(d) - t0) / yearMs;
    return [d, p * Math.pow(1 - extraAnnualFee, years)];
  });
}

/** Index of the last date <= target (or 0). */
export function indexOnOrBefore(market: Market, isoDate: string): number {
  const { dates } = market;
  let lo = 0;
  let hi = dates.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= isoDate) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Index of the first date >= target (or the last index). */
export function indexOnOrAfter(market: Market, isoDate: string): number {
  const i = market.dates.findIndex((d) => d >= isoDate);
  return i < 0 ? market.dates.length - 1 : i;
}

/** First index at which every listed asset has a valid price. */
export function firstCommonIndex(market: Market, ids: string[]): number {
  for (let i = 0; i < market.dates.length; i++) {
    if (ids.every((id) => Number.isFinite(market.prices[id]?.[i]))) return i;
  }
  return -1;
}

/** Simple return of one asset between two indices. */
export function assetReturn(market: Market, id: string, from: number, to: number): number {
  const a = market.prices[id][from];
  const b = market.prices[id][to];
  return b / a - 1;
}

/** "Year 2, Month 3" style label used in blind mode instead of real dates. */
export function elapsedLabel(startIso: string, iso: string): string {
  const s = new Date(startIso + "T00:00:00Z");
  const d = new Date(iso + "T00:00:00Z");
  const months = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth());
  const m = Math.max(0, months);
  return `Year ${Math.floor(m / 12) + 1}, Month ${(m % 12) + 1}`;
}

export function monthsBetween(startIso: string, iso: string): number {
  const s = new Date(startIso + "T00:00:00Z");
  const d = new Date(iso + "T00:00:00Z");
  return (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth());
}
