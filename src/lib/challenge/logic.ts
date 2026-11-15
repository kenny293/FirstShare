import { ASSETS } from "@/lib/content/assets";
import { buildMarket, indexOnOrAfter, indexOnOrBefore, withAnnualFee } from "@/lib/engine/market";
import { computeHabitsScore } from "@/lib/engine/scoring";
import { normalizeWeights, runSimulation } from "@/lib/engine/simulate";
import type { DecisionAction, Market, PricePoint, SimResult } from "@/lib/engine/types";
import { CHALLENGE, CHALLENGE_ASSETS, CHALLENGE_BENCHMARK, PLAN_RULES, type RuleId } from "./config";
import type { ChallengeAction, ChallengeDoc, ChallengeEvent, ChallengePlan, ChallengeResult } from "./types";

const DAY_MS = 24 * 3600 * 1000;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

/** Daily market for the challenge, with the fictional high-fee fund derived from VTI. */
export function buildChallengeMarket(series: Record<string, PricePoint[]>): Market {
  const all: Record<string, PricePoint[]> = { ...series };
  if (series.VTI) all.ACTV = withAnnualFee(series.VTI, ASSETS.ACTV.extraAnnualFee ?? 0);
  return buildMarket(all);
}

/** Single stocks and the tech fund: what "go all-in on what's hottest" can pick. */
export const CHASE_UNIVERSE = CHALLENGE_ASSETS.filter((id) => ["stock", "sector_fund"].includes(ASSETS[id].kind));

/**
 * Check-ins: one midway (first trading day 7+ days in), plus the first two
 * days where the S&P 500 moved a lot. Chosen chronologically so a live
 * challenge's earlier check-ins never change as new days arrive.
 */
export function detectEvents(market: Market, startIdx: number, lastIdx: number): ChallengeEvent[] {
  const bench = market.prices[CHALLENGE_BENCHMARK];
  const startDate = market.dates[startIdx];
  const midDate = addDays(startDate, 7);
  const events: ChallengeEvent[] = [];
  let bigMoves = 0;
  let midAdded = false;
  for (let i = startIdx + 1; i <= lastIdx; i++) {
    const r = bench[i] / bench[i - 1] - 1;
    const date = market.dates[i];
    const big = r <= CHALLENGE.bigMoveDown || r >= CHALLENGE.bigMoveUp;
    const pastMid = date >= midDate;
    if (big && bigMoves < CHALLENGE.maxCheckins - 1) {
      events.push({ date, kind: r < 0 ? "drop" : "jump", move: r });
      bigMoves++;
      if (pastMid) midAdded = true; // a big day after the midpoint doubles as the midway check-in
    } else if (pastMid && !midAdded) {
      events.push({ date, kind: "midway", move: r });
      midAdded = true;
    }
  }
  return events;
}

export interface Window {
  startIdx: number;
  endIdx: number;
}

/** Index range of a challenge in a market that starts on/after its start date. */
export function challengeWindow(market: Market, doc: Pick<ChallengeDoc, "startDate" | "endDate">): Window {
  const startIdx = indexOnOrAfter(market, doc.startDate);
  const endIdx = Math.max(startIdx, indexOnOrBefore(market, doc.endDate));
  return { startIdx, endIdx };
}

export function simulateChallenge(market: Market, w: Window, plan: ChallengePlan, actions: ChallengeAction[]): SimResult {
  // "Hold" changes nothing; leaving it out also stops a same-day hold from
  // replacing a real trade (the engine keeps one decision per day).
  const decisions = actions
    .filter((a) => a.action !== "hold")
    .map((a) => ({ index: indexOnOrBefore(market, a.date), action: a.action }))
    .filter((d) => d.index > w.startIdx && d.index <= w.endIdx);
  if (w.endIdx <= w.startIdx) {
    // A brand-new live challenge has only day 0: nothing has moved yet.
    return {
      dates: [market.dates[w.startIdx]], values: [CHALLENGE.startingCash], growthIndex: [1], events: [],
      snapshots: [{ fromIndex: w.startIdx, toIndex: w.startIdx, weights: plan.allocation }],
      totalContributed: CHALLENGE.startingCash, finalValue: CHALLENGE.startingCash, gain: 0, returnPct: 0, maxDrawdown: 0,
    };
  }
  return runSimulation({
    market,
    startIndex: w.startIdx,
    endIndex: w.endIdx,
    initialAmount: CHALLENGE.startingCash,
    allocation: plan.allocation,
    decisions,
    universe: [...CHASE_UNIVERSE],
  });
}

/** Which of the player's own day-0 rules each action broke. */
export function findViolations(rules: RuleId[], sim: SimResult): ChallengeResult["violations"] {
  const out: ChallengeResult["violations"] = [];
  for (const e of sim.events) {
    const a = e.action;
    const selling = a === "sell_all" || a === "sell_half";
    const broke: Record<RuleId, boolean> = {
      no_panic: selling && e.drawdown > 0.005,
      no_chase: a === "chase_best",
      stay_invested: a === "sell_all",
      rebalance_only: !(["hold", "rebalance", "buy_more"] as DecisionAction[]).includes(a),
    };
    for (const r of rules) if (broke[r]) out.push({ date: e.date, rule: r, action: a });
  }
  return out;
}

// --- luck reveal ------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Buy-and-hold returns of random portfolios over the same window (seeded, so results are stable). */
export function randomPortfolioReturns(market: Market, w: Window, seed: string, n: number = CHALLENGE.randomPortfolios): number[] {
  const rand = mulberry32(hashString(seed));
  const ids = CHALLENGE_ASSETS.filter((id) => Number.isFinite(market.prices[id]?.[w.startIdx]) && Number.isFinite(market.prices[id]?.[w.endIdx]));
  const growth = ids.map((id) => market.prices[id][w.endIdx] / market.prices[id][w.startIdx]);
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const picks = 1 + Math.floor(rand() * 4);
    const weights = new Array(ids.length).fill(0);
    for (let j = 0; j < picks; j++) weights[Math.floor(rand() * ids.length)] += -Math.log(1 - rand());
    const total = weights.reduce((s, x) => s + x, 0);
    out.push(weights.reduce((s, x, i) => s + (x / total) * growth[i], 0) - 1);
  }
  return out;
}

export function luckReveal(randomReturns: number[], playerReturn: number, binCount = 12): ChallengeResult["luck"] {
  const sorted = [...randomReturns].sort((a, b) => a - b);
  const below = sorted.filter((r) => r < playerReturn).length;
  const lo = Math.min(sorted[0], playerReturn);
  const hi = Math.max(sorted[sorted.length - 1], playerReturn);
  const width = (hi - lo) / binCount || 0.001;
  const bins = Array.from({ length: binCount }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  for (const r of sorted) bins[Math.min(binCount - 1, Math.floor((r - lo) / width))].count++;
  return { playerReturn, percentile: below / sorted.length, bins };
}

// --- scoring ---------------------------------------------------------------

/**
 * Challenge score (0-100). Profit is never an input:
 *   60  Habits Score (diversification, composure, fees) x 0.6
 *   15  kept the rules you wrote on day 0
 *   10  low trading (fewer changes is better)
 *   10  answered every check-in
 *    5  realistic expectations (your guessed range held the final value)
 */
export function scoreChallenge(market: Market, w: Window, doc: ChallengeDoc, events: ChallengeEvent[], seed: string): ChallengeResult {
  const sim = simulateChallenge(market, w, doc.plan, doc.actions);
  const habits = computeHabitsScore(sim, ASSETS, { panicDrawdown: CHALLENGE.panicDrawdown });
  const violations = findViolations(doc.plan.rules, sim);
  const trades = sim.events.filter((e) => e.action !== "hold").length;
  const answered = events.filter((ev) => doc.actions.some((a) => a.eventDate === ev.date)).length;
  const width = doc.plan.guessHigh - doc.plan.guessLow;
  const inGuessRange = sim.finalValue >= doc.plan.guessLow && sim.finalValue <= doc.plan.guessHigh;

  const parts = {
    habits: Math.round(habits.total * 0.6),
    planKept: violations.length === 0 ? 15 : violations.length === 1 ? 7 : 0,
    lowTrading: trades <= 1 ? 10 : trades === 2 ? 5 : 0,
    reflection: events.length === 0 ? 10 : Math.round((10 * answered) / events.length),
    calibration: !inGuessRange ? 0 : width <= 100 ? 5 : width <= 250 ? 3 : 1,
  };
  const challengeScore = parts.habits + parts.planKept + parts.lowTrading + parts.reflection + parts.calibration;

  // Compare like with like: the player's time-weighted growth (ignores added cash).
  const playerReturn = sim.growthIndex[sim.growthIndex.length - 1] - 1;
  const bench = market.prices[CHALLENGE_BENCHMARK];
  const depositPaid = doc.deposit.status === "paid_mock";

  return {
    challengeScore,
    parts,
    habits,
    finalValue: sim.finalValue,
    totalContributed: sim.totalContributed,
    returnPct: sim.returnPct,
    benchmarkReturnPct: bench[w.endIdx] / bench[w.startIdx] - 1,
    violations,
    trades,
    answered,
    checkins: events.length,
    inGuessRange,
    luck: luckReveal(randomPortfolioReturns(market, w, seed), playerReturn),
    depositRefunded: depositPaid && challengeScore >= CHALLENGE.refundScore && answered === events.length && violations.length === 0,
    finishedAt: new Date().toISOString(),
  };
}

// --- input validation ------------------------------------------------------

const RULE_IDS = new Set(PLAN_RULES.map((r) => r.id));

export function parsePlan(input: unknown): ChallengePlan | string {
  if (!input || typeof input !== "object") return "Missing plan";
  const p = input as Record<string, unknown>;
  const alloc: Record<string, number> = {};
  if (!p.allocation || typeof p.allocation !== "object") return "Pick at least one investment";
  for (const [id, v] of Object.entries(p.allocation as Record<string, unknown>)) {
    if (!(CHALLENGE_ASSETS as readonly string[]).includes(id)) return `Unknown investment ${id}`;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "Bad allocation";
    if (v > 0) alloc[id] = v;
  }
  const total = Object.values(alloc).reduce((s, v) => s + v, 0);
  if (total <= 0) return "Pick at least one investment";
  if (Math.abs(total - 1) > 0.001) return "Your allocation must add up to 100%";
  const rules = Array.isArray(p.rules) ? [...new Set(p.rules.filter((r): r is RuleId => typeof r === "string" && RULE_IDS.has(r as RuleId)))] : [];
  if (rules.length === 0) return "Pick at least one rule for yourself";
  const guessLow = Number(p.guessLow);
  const guessHigh = Number(p.guessHigh);
  if (!Number.isFinite(guessLow) || !Number.isFinite(guessHigh) || guessLow < 0 || guessHigh > 100000 || guessLow >= guessHigh)
    return "Your guessed range needs a low and a higher high";
  const note = typeof p.note === "string" ? p.note.trim().slice(0, 280) : "";
  return { allocation: normalizeWeights(alloc), rules, note, guessLow: Math.round(guessLow), guessHigh: Math.round(guessHigh) };
}

export const VALID_ACTIONS: DecisionAction[] = ["hold", "rebalance", "buy_more", "sell_half", "sell_all", "chase_best"];
