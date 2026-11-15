import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentResponse, type ThinkingConfig } from "@google/genai";
import { NextResponse } from "next/server";
import {
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  buildCoachPrompt,
  fallbackFor,
  parseCoachOutput,
  sanitizeCoachRequest,
  type CoachRequest,
  type CoachResponse,
} from "@/lib/coach";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
/**
 * Optional model tried if the main one is still busy after a retry.
 * Off by default: model availability varies by key (run `npm run gemini:models`).
 */
const BACKUP_MODEL = process.env.GEMINI_BACKUP_MODEL?.trim() || "none";
/** Pause before retrying a busy model. */
const BUSY_RETRY_DELAY_MS = 1500;
/** Total time budget for ALL attempts, so players never wait longer than this. */
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 30_000;

/** Show only the last 4 characters so logs never contain the real key. */
const maskKey = (key: string) => (key.length > 8 ? `…${key.slice(-4)}` : "(set)");

/**
 * The coach writes 2-4 sentences, so deep "thinking" only adds latency
 * (and eats output tokens). Ask for as little as each model family allows.
 */
function thinkingFor(model: string): ThinkingConfig | undefined {
  const m = model.toLowerCase();
  if (/gemini-2\.5-flash/.test(m)) return { thinkingBudget: 0 }; // flash & flash-lite can disable it
  if (/gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 }; // pro's minimum
  if (/gemini-([3-9]|\d{2,})/.test(m)) return { thinkingLevel: ThinkingLevel.LOW };
  return undefined;
}

class TimeoutError extends Error {}

function statusOf(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  const m = err instanceof Error ? err.message.match(/"code"\s*:\s*(\d{3})/) : null;
  return m ? Number(m[1]) : undefined;
}

const describe = (err: unknown) =>
  err instanceof TimeoutError
    ? "timed out"
    : `${statusOf(err) ?? "error"}: ${(err instanceof Error ? err.message : String(err)).slice(0, 250)}`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const req = sanitizeCoachRequest(body);
  if (!req) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const fallback = (reason: string): NextResponse => {
    console.log(`[coach] ✗ using fallback message (${reason}) mistake=${req.detectedMistakes[0]}`);
    const res: CoachResponse = { ...fallbackFor(req.detectedMistakes), model: MODEL, fallbackReason: reason };
    return NextResponse.json(res);
  };

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.log("[coach] GEMINI_API_KEY not found in .env / .env.local");
    return fallback("no API key");
  }

  const ai = new GoogleGenAI({ apiKey });
  const started = Date.now();
  const deadline = started + TIMEOUT_MS;
  const elapsed = () => `${Date.now() - started}ms`;

  /** One Gemini call, limited to whatever is left of the overall time budget. */
  const attempt = (model: string, thinkingConfig: ThinkingConfig | undefined, r: CoachRequest) => {
    const remaining = deadline - Date.now();
    if (remaining <= 500) return Promise.reject(new TimeoutError());
    console.log(`[coach] → ${model} thinking=${JSON.stringify(thinkingConfig ?? "default")} (${Math.round(remaining / 1000)}s left)`);
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      ai.models.generateContent({
        model,
        contents: buildCoachPrompt(r),
        config: {
          systemInstruction: COACH_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: COACH_RESPONSE_SCHEMA,
          temperature: 0.6,
          maxOutputTokens: 2048,
          ...(thinkingConfig ? { thinkingConfig } : {}),
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError()), remaining);
      }),
    ]).finally(() => clearTimeout(timer));
  };

  /** Try a model; if it rejects the thinking setting (HTTP 400), retry it once without. */
  const tryModel = async (model: string): Promise<GenerateContentResponse> => {
    const thinking = thinkingFor(model);
    try {
      return await attempt(model, thinking, req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (thinking && statusOf(err) === 400 && /think/i.test(msg)) {
        console.warn(`[coach] ${model} rejected the thinking setting; retrying with its default`);
        return attempt(model, undefined, req);
      }
      throw err;
    }
  };

  console.log(`[coach] calling Gemini model=${MODEL} key=${maskKey(apiKey)} budget=${TIMEOUT_MS}ms`);
  let response: GenerateContentResponse;
  let usedModel = MODEL;
  const isBusy = (err: unknown) => [429, 500, 503, 504].includes(statusOf(err) ?? 0);
  try {
    try {
      response = await tryModel(MODEL);
    } catch (err) {
      console.warn(`[coach] ${MODEL} failed after ${elapsed()} (${describe(err)})`);
      if (!isBusy(err)) throw err;
      // Busy spikes are usually brief: wait a moment and retry the same model once.
      if (deadline - Date.now() > BUSY_RETRY_DELAY_MS + 2000) {
        console.log(`[coach] ${MODEL} is busy; retrying in ${BUSY_RETRY_DELAY_MS}ms`);
        await new Promise((r) => setTimeout(r, BUSY_RETRY_DELAY_MS));
        try {
          response = await tryModel(MODEL);
        } catch (err2) {
          console.warn(`[coach] ${MODEL} retry failed after ${elapsed()} (${describe(err2)})`);
          if (!isBusy(err2) || BACKUP_MODEL === "none" || BACKUP_MODEL === MODEL) throw err2;
          console.log(`[coach] trying backup model ${BACKUP_MODEL}`);
          usedModel = BACKUP_MODEL;
          response = await tryModel(BACKUP_MODEL);
        }
      } else throw err;
    }
  } catch (err) {
    console.warn(`[coach] giving up after ${elapsed()} (${describe(err)})`);
    const status = statusOf(err);
    return fallback(
      err instanceof TimeoutError
        ? `Gemini timed out after ${Math.round(TIMEOUT_MS / 1000)}s`
        : status === 503 || status === 429
          ? "Gemini is busy right now"
          : status === 404
            ? `model "${usedModel}" isn't available to this key (run npm run gemini:models)`
            : status === 400
            ? "Gemini rejected the request (check GEMINI_MODEL)"
            : status === 401 || status === 403
              ? "Gemini rejected the API key"
              : "Gemini request failed",
    );
  }

  const parsed = parseCoachOutput(response.text, req.detectedMistakes);
  if (parsed) {
    const model = response.modelVersion ?? usedModel;
    console.log(`[coach] ✓ Gemini responded in ${elapsed()} (model=${model}, mistake=${parsed.mistake_type})`);
    return NextResponse.json({ ...parsed, model });
  }
  console.warn(
    `[coach] output unusable after ${elapsed()}. finishReason=${response.candidates?.[0]?.finishReason} text=${JSON.stringify(response.text?.slice(0, 200))}`,
  );
  return fallback("Gemini output was invalid");
}
