#!/usr/bin/env node
/**
 * Lists the Gemini models your GEMINI_API_KEY can use for text generation,
 * so you can choose GEMINI_MODEL / GEMINI_BACKUP_MODEL.
 *
 * Usage: npm run gemini:models
 */
import nextEnv from "@next/env";
import { GoogleGenAI } from "@google/genai";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in .env or .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const current = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash (default)";
const backup = process.env.GEMINI_BACKUP_MODEL?.trim() || "none (default)";

try {
  const rows = [];
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    const actions = m.supportedActions ?? [];
    if (!actions.includes("generateContent")) continue;
    rows.push({ id: (m.name ?? "").replace(/^models\//, ""), name: m.displayName ?? "" });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log(`Models your key can use for generateContent (${rows.length}):\n`);
  for (const r of rows) console.log(`  ${r.id.padEnd(40)} ${r.name}`);
  console.log(`\nCurrently: GEMINI_MODEL=${current}  GEMINI_BACKUP_MODEL=${backup}`);
  console.log("Tip: a '-flash' or '-flash-lite' model is fast and cheap enough for the coach.");
} catch (err) {
  console.error("Could not list models:", err?.message ?? err);
  process.exit(1);
}
