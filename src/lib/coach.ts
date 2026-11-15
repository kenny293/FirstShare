import type { MistakeType, OutcomeLabel } from "@/lib/engine/scoring";
import { COACH_FALLBACKS, MISTAKE_TYPES, type CoachFeedback } from "@/lib/content/coachFallbacks";

/** Everything the coach is told. All numbers are computed in code beforehand. */
export interface CoachRequest {
  levelTitle: string;
  concept: string;
  startingAmount: number;
  totalContributed: number;
  finalValue: number;
  returnPct: number;
  maxDrawdownPct: number;
  habitsScore: number;
  diversificationPoints: number;
  composurePoints: number;
  feePoints: number;
  biggestSingleCompanyOrIndustryPct: number;
  averageFeePct: number;
  outcome: OutcomeLabel;
  detectedMistakes: MistakeType[];
  holdings: { name: string; description: string; startingPct: number }[];
  decisions: {
    when: string;
    situation: string;
    portfolioDownFromPeakPct: number;
    choice: string;
    reasoning: string;
  }[];
}

export interface CoachResponse extends CoachFeedback {
  source: "ai" | "fallback";
  /** Gemini model used (or that would have been used). */
  model?: string;
  /** Why the fallback was used, e.g. "no API key". */
  fallbackReason?: string;
}

export const COACH_SYSTEM_PROMPT = `You are the friendly coach inside FirstShare, an educational investing simulator for complete beginners who play with fake money on historical data.

Write in plain, warm English a beginner understands. No jargon without a quick explanation.

Rules:
- "feedback" must be 2-4 sentences.
- Reference the user's ACTUAL numbers (e.g. their Habits Score, final value, how far they were down) and quote or paraphrase their OWN written reasoning at least once.
- Every number you mention must come from the data provided. Never calculate new numbers or invent any.
- Focus on habits (diversification, staying calm in drops, avoiding hype, low fees), not on whether they made money. If they made money with a risky strategy, say it was likely luck, not skill.
- Be educational and kind, never preachy or shaming.
- Never tell the user what real investments to buy or sell, and never name real tickers or funds as recommendations.
- Never claim that markets always recover or that losses are always temporary.
- The simulation is in "blind mode": do not guess or mention the real companies, the real years, or historical events.
- "mistake_type" must be one of the mistakes listed in detectedMistakes (choose the most important one), or "none" if that list is ["none"].
- "encouragement" is one short, upbeat sentence.`;

export const COACH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    feedback: { type: "string", description: "2-4 sentence plain-English feedback" },
    mistake_type: { type: "string", enum: MISTAKE_TYPES },
    encouragement: { type: "string", description: "One short encouraging sentence" },
  },
  required: ["feedback", "mistake_type", "encouragement"],
  propertyOrdering: ["feedback", "mistake_type", "encouragement"],
} as const;

export function buildCoachPrompt(req: CoachRequest): string {
  return `Here is the player's result as JSON. Give them feedback.\n\n${JSON.stringify(req, null, 2)}`;
}

export function fallbackFor(mistakes: MistakeType[]): CoachResponse {
  const primary = mistakes[0] ?? "none";
  return { ...COACH_FALLBACKS[primary], source: "fallback" };
}

/**
 * Validate the model's JSON. Returns null if unusable. The mistake type is
 * forced to agree with what the code detected.
 */
export function parseCoachOutput(text: string | undefined, detected: MistakeType[]): CoachResponse | null {
  if (!text) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.feedback !== "string" || typeof o.encouragement !== "string") return null;
  const feedback = o.feedback.trim();
  const encouragement = o.encouragement.trim();
  if (feedback.length < 20 || feedback.length > 1200 || encouragement.length > 400) return null;

  const allowed = detected.length ? detected : (["none"] as MistakeType[]);
  const mt = o.mistake_type as MistakeType;
  const mistake_type = allowed.includes(mt) ? mt : allowed[0];
  return { feedback, encouragement, mistake_type, source: "ai" };
}

const clampStr = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max) : "");
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

/** Sanitize untrusted client input before it goes into the prompt. */
export function sanitizeCoachRequest(body: unknown): CoachRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const detected = Array.isArray(b.detectedMistakes)
    ? (b.detectedMistakes.filter((m) => MISTAKE_TYPES.includes(m as MistakeType)) as MistakeType[])
    : [];
  const outcomes: OutcomeLabel[] = ["lucky", "skilled", "unlucky", "risky", "shaky"];
  return {
    levelTitle: clampStr(b.levelTitle, 80),
    concept: clampStr(b.concept, 80),
    startingAmount: num(b.startingAmount),
    totalContributed: num(b.totalContributed),
    finalValue: num(b.finalValue),
    returnPct: num(b.returnPct),
    maxDrawdownPct: num(b.maxDrawdownPct),
    habitsScore: num(b.habitsScore),
    diversificationPoints: num(b.diversificationPoints),
    composurePoints: num(b.composurePoints),
    feePoints: num(b.feePoints),
    biggestSingleCompanyOrIndustryPct: num(b.biggestSingleCompanyOrIndustryPct),
    averageFeePct: num(b.averageFeePct),
    outcome: outcomes.includes(b.outcome as OutcomeLabel) ? (b.outcome as OutcomeLabel) : "unlucky",
    detectedMistakes: detected.length ? detected : ["none"],
    holdings: (Array.isArray(b.holdings) ? b.holdings : []).slice(0, 12).map((h: Record<string, unknown>) => ({
      name: clampStr(h?.name, 60),
      description: clampStr(h?.description, 120),
      startingPct: num(h?.startingPct),
    })),
    decisions: (Array.isArray(b.decisions) ? b.decisions : []).slice(0, 5).map((d: Record<string, unknown>) => ({
      when: clampStr(d?.when, 40),
      situation: clampStr(d?.situation, 80),
      portfolioDownFromPeakPct: num(d?.portfolioDownFromPeakPct),
      choice: clampStr(d?.choice, 60),
      reasoning: clampStr(d?.reasoning, 500),
    })),
  };
}
