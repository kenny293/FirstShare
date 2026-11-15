// Check that ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY work: fetches the last week of daily bars for VOO.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

const id = process.env.ALPACA_API_KEY_ID;
const secret = process.env.ALPACA_API_SECRET_KEY;
if (!id || !secret) {
  console.log("✗ ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY aren't set. The app will use the local /data snapshot instead.");
  process.exit(1);
}
const base = process.env.ALPACA_DATA_URL || "https://data.alpaca.markets";
const feed = process.env.ALPACA_FEED || "iex";
const start = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
const url = `${base}/v2/stocks/bars?symbols=VOO&timeframe=1Day&start=${start}&adjustment=all&feed=${feed}`;
console.log(`Key …${id.slice(-4)} · feed=${feed}`);
const t = Date.now();
const res = await fetch(url, { headers: { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret } });
const body = await res.text();
if (!res.ok) {
  console.log(`✗ HTTP ${res.status} in ${Date.now() - t}ms: ${body.slice(0, 300)}`);
  process.exit(1);
}
const bars = JSON.parse(body).bars?.VOO ?? [];
console.log(`✓ ${bars.length} daily bars in ${Date.now() - t}ms`);
for (const b of bars) console.log(`  ${b.t.slice(0, 10)}  close ${b.c}`);
