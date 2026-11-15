import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSETS } from "@/lib/content/assets";
import { buildMarket, toWeekly, withAnnualFee } from "@/lib/engine/market";
import type { PriceFile, PricePoint } from "@/lib/engine/types";

const DATA_DIR = path.join(process.cwd(), "data");

/** JSON-safe market: NaN is sent as null. */
export interface MarketPayload {
  dates: string[];
  prices: Record<string, (number | null)[]>;
  /** Data source per file ("yfinance" or "placeholder"). */
  sources: Record<string, string>;
}

async function readPriceFile(ticker: string): Promise<PriceFile> {
  if (!/^[A-Z]{1,5}$/.test(ticker)) throw new Error(`Bad ticker ${ticker}`);
  const raw = await readFile(path.join(DATA_DIR, `${ticker}.json`), "utf8");
  return JSON.parse(raw) as PriceFile;
}

/**
 * Load weekly prices for asset ids (full history, so the skill-vs-luck replay
 * can use other start dates). Synthetic assets are derived here.
 */
export async function loadMarket(ids: string[]): Promise<MarketPayload> {
  const files = new Map<string, PriceFile>();
  for (const id of ids) {
    const asset = ASSETS[id];
    if (!asset) throw new Error(`Unknown asset ${id}`);
    if (!files.has(asset.dataTicker)) files.set(asset.dataTicker, await readPriceFile(asset.dataTicker));
  }

  const series: Record<string, PricePoint[]> = {};
  for (const id of ids) {
    const asset = ASSETS[id];
    const weekly = toWeekly(files.get(asset.dataTicker)!.prices);
    series[id] = asset.extraAnnualFee ? withAnnualFee(weekly, asset.extraAnnualFee) : weekly;
  }

  const market = buildMarket(series);
  const prices: MarketPayload["prices"] = {};
  for (const [id, arr] of Object.entries(market.prices)) {
    prices[id] = arr.map((p) => (Number.isFinite(p) ? Math.round(p * 10000) / 10000 : null));
  }
  const sources: Record<string, string> = {};
  for (const [t, f] of files) sources[t] = f.source;
  return { dates: market.dates, prices, sources };
}
