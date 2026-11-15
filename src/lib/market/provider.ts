import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PricePoint, PriceFile } from "@/lib/engine/types";

/**
 * Daily closing prices for the live challenge.
 *  - Alpaca Market Data API (IEX feed, free plan) when ALPACA_API_KEY_ID and
 *    ALPACA_API_SECRET_KEY are set. Keys stay on the server.
 *  - Otherwise the local /data snapshot, so the app still works offline.
 */
export interface DailyBars {
  series: Record<string, PricePoint[]>;
  source: string;
}

const ALPACA_URL = process.env.ALPACA_DATA_URL || "https://data.alpaca.markets";
const ALPACA_FEED = process.env.ALPACA_FEED || "iex";
const CACHE_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; value: DailyBars }>();

export function alpacaConfigured(): boolean {
  return Boolean(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY);
}

export function dataSourceLabel(): string {
  return alpacaConfigured() ? `Alpaca (${ALPACA_FEED.toUpperCase()} feed)` : "Local snapshot (no Alpaca keys set)";
}

interface AlpacaBar {
  t: string;
  c: number;
}

async function fetchAlpaca(symbols: string[], start: string): Promise<DailyBars> {
  const series: Record<string, PricePoint[]> = Object.fromEntries(symbols.map((s) => [s, []]));
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      symbols: symbols.join(","),
      timeframe: "1Day",
      start,
      adjustment: "all",
      feed: ALPACA_FEED,
      limit: "10000",
    });
    if (pageToken) params.set("page_token", pageToken);
    const res = await fetch(`${ALPACA_URL}/v2/stocks/bars?${params}`, {
      headers: {
        "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID!,
        "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY!,
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`Alpaca ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { bars: Record<string, AlpacaBar[]> | null; next_page_token: string | null };
    for (const [sym, bars] of Object.entries(json.bars ?? {})) {
      for (const b of bars) series[sym]?.push([b.t.slice(0, 10), b.c]);
    }
    pageToken = json.next_page_token ?? undefined;
    if (!pageToken) break;
  }
  return { series, source: dataSourceLabel() };
}

async function fromLocal(symbols: string[], start: string): Promise<DailyBars> {
  const series: Record<string, PricePoint[]> = {};
  for (const sym of symbols) {
    if (!/^[A-Z]{1,5}$/.test(sym)) throw new Error(`Bad ticker ${sym}`);
    const raw = await readFile(path.join(process.cwd(), "data", `${sym}.json`), "utf8");
    const file = JSON.parse(raw) as PriceFile;
    series[sym] = file.prices.filter(([d]) => d >= start);
  }
  return { series, source: dataSourceLabel() };
}

/** Daily closes for `symbols` from `start` (inclusive) to the latest available day. */
export async function getDailyBars(symbols: readonly string[], start: string): Promise<DailyBars> {
  const key = `${symbols.join(",")}|${start}|${alpacaConfigured()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = alpacaConfigured() ? await fetchAlpaca([...symbols], start) : await fromLocal([...symbols], start);
  for (const s of symbols) {
    if (!value.series[s]?.length) throw new Error(`No price data for ${s} since ${start}`);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}
