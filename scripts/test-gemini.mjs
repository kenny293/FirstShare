#!/usr/bin/env node
/**
 * Diagnoses slow / hanging Gemini calls by timing a few small requests with
 * different settings. Usage: npm run gemini:test [model]
 */
import nextEnv from "@next/env";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in .env or .env.local");
  process.exit(1);
}
const model = process.argv[2] || process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
const TIMEOUT = 60_000;
const ai = new GoogleGenAI({ apiKey });

const schema = {
  type: "object",
  properties: { feedback: { type: "string" }, encouragement: { type: "string" } },
  required: ["feedback", "encouragement"],
};

const tests = [
  ["1. plain text, default settings", {}],
  ["2. plain text, thinking LOW", { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }],
  ["3. JSON schema, default thinking", { responseMimeType: "application/json", responseJsonSchema: schema }],
  ["4. JSON schema + thinking LOW (what the app sends)", { responseMimeType: "application/json", responseJsonSchema: schema, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }],
];

// Quick connectivity check that doesn't involve the model at all.
{
  const t = Date.now();
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/", { signal: AbortSignal.timeout(10_000) });
    console.log(`Network: reached Google API host in ${Date.now() - t}ms (HTTP ${r.status})`);
  } catch (e) {
    console.log(`Network: could NOT reach Google API host (${e.message}). Check VPN / firewall / proxy.`);
  }
}

console.log(`\nTesting model "${model}" (each test waits up to ${TIMEOUT / 1000}s)\n`);
for (const [label, config] of tests) {
  const t = Date.now();
  let timer;
  try {
    const r = await Promise.race([
      ai.models.generateContent({
        model,
        contents: "In one short sentence, why is diversification useful for beginner investors?",
        config: { maxOutputTokens: 1024, ...config },
      }),
      new Promise((_, rej) => (timer = setTimeout(() => rej(new Error("TIMED OUT")), TIMEOUT))),
    ]);
    const text = (r.text ?? "").replace(/\s+/g, " ").slice(0, 90);
    console.log(`✓ ${label}: ${Date.now() - t}ms  finish=${r.candidates?.[0]?.finishReason}  "${text}"`);
  } catch (e) {
    console.log(`✗ ${label}: ${Date.now() - t}ms  ${String(e.message ?? e).slice(0, 160)}`);
  } finally {
    clearTimeout(timer);
  }
}
console.log("\nPaste this output back if you'd like help interpreting it.");
