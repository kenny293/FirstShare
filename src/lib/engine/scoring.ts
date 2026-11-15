import type { AssetRisk, SimResult, Weights } from "./types";

/**
 * HABITS SCORE (0-100) - rewards good habits, not profit.
 *
 *   Diversification  50 pts  How spread out the money was, time-weighted over
 *                            the whole simulation.
 *                              - 20 pts breadth: number of meaningful holdings
 *                                (a broad fund counts as 5)
 *                              - 30 pts concentration: biggest exposure to any
 *                                single company (or one industry)
 *   Composure        30 pts  Lose points for selling after a big drop
 *                            (panic selling) or piling into the recent winner
 *                            (chasing hype).
 *   Fees             20 pts  Time-weighted average expense ratio; 0% fees gets
 *                            all 20, 1%+ gets 0.
 *
 * Profit is never an input.
 */
export const SCORING = {
  diversificationMax: 50,
  breadthMax: 20,
  concentrationMax: 30,
  composureMax: 30,
  feesMax: 20,
  /** Holdings below this weight do not count toward breadth. */
  minMeaningfulWeight: 0.05,
  /** "Effective holdings" needed for full breadth points. */
  fullBreadthHoldings: 5,
  /** Single-company exposure at/below which concentration gets full points. */
  safeSingleExposure: 0.1,
  /** Single-company exposure at/above which concentration gets 0 points. */
  maxSingleExposure: 0.6,
  /** A drop at least this large (from the previous peak) makes selling "panic". */
  panicDrawdown: 0.15,
  /** Selling at least this fraction counts as panic selling. */
  panicMinSold: 0.25,
  /**
   * Money in sector (one-industry) funds counts as this much single-company
   * exposure: 100% in a tech fund scores like 40% in one company.
   */
  sectorExposureFactor: 0.4,
  chasePenalty: 12,
  /** Expense ratio that earns 0 fee points. */
  feeCeiling: 0.01,
  /** Average fee that triggers the high_fees mistake. */
  highFeeThreshold: 0.004,
  /** Diversification score below this counts as concentrated. */
  concentratedBelow: 25,
} as const;

export type MistakeType =
  | "concentration"
  | "panic_selling"
  | "chasing_hype"
  | "high_fees"
  | "none";

export type OutcomeLabel =
  /** made money, but with a risky strategy */
  | "lucky"
  /** made money with good habits */
  | "skilled"
  /** lost money despite good habits - the market was rough */
  | "unlucky"
  /** lost money with a risky strategy */
  | "risky"
  /** sensible mix, but panic selling or high fees undermined it */
  | "shaky";

export interface DiversificationDetail {
  points: number;
  breadthPoints: number;
  concentrationPoints: number;
  effectiveHoldings: number;
  /** Largest exposure to a single company, 0..1 */
  maxSingleExposure: number;
}

export interface HabitsScore {
  total: number;
  diversification: number;
  composure: number;
  fees: number;
  detail: {
    diversification: DiversificationDetail;
    averageExpenseRatio: number;
    panicSells: { date: string; drawdown: number; soldFraction: number }[];
    chases: { date: string; asset: string }[];
  };
  mistakes: MistakeType[];
  primaryMistake: MistakeType;
  outcome: OutcomeLabel;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const BREADTH_WEIGHT: Record<AssetRisk["kind"], number> = {
  stock: 1,
  broad_fund: 5,
  bond_fund: 5,
  active_fund: 5,
  sector_fund: 3,
};

/** Diversification points for one set of weights. */
export function diversificationFor(weights: Weights, assets: Record<string, AssetRisk>): DiversificationDetail {
  let effectiveHoldings = 0;
  let maxSingleExposure = 0;
  let sectorWeight = 0;
  for (const [id, w] of Object.entries(weights)) {
    if (id === "CASH" || w <= 0) continue;
    const a = assets[id];
    if (!a) throw new Error(`Unknown asset ${id}`);
    if (w >= SCORING.minMeaningfulWeight) effectiveHoldings += BREADTH_WEIGHT[a.kind];
    maxSingleExposure = Math.max(maxSingleExposure, w * a.maxSingleCompanyWeight);
    if (a.kind === "sector_fund") sectorWeight += w;
  }
  // A one-industry fund owns many companies that tend to rise and fall
  // together, so a big position in it counts like a sizeable single bet.
  maxSingleExposure = Math.max(maxSingleExposure, sectorWeight * SCORING.sectorExposureFactor);
  const breadthPoints = SCORING.breadthMax * clamp01(effectiveHoldings / SCORING.fullBreadthHoldings);
  const concentrationPoints =
    SCORING.concentrationMax *
    clamp01(
      (SCORING.maxSingleExposure - maxSingleExposure) / (SCORING.maxSingleExposure - SCORING.safeSingleExposure),
    );
  return {
    points: breadthPoints + concentrationPoints,
    breadthPoints,
    concentrationPoints,
    effectiveHoldings,
    maxSingleExposure,
  };
}

/** Weighted average annual expense ratio (cash costs nothing). */
export function expenseRatioFor(weights: Weights, assets: Record<string, AssetRisk>): number {
  let er = 0;
  for (const [id, w] of Object.entries(weights)) {
    if (id === "CASH") continue;
    er += w * (assets[id]?.expenseRatio ?? 0);
  }
  return er;
}

export interface ScoreOptions {
  /** Override the drop (from the peak) that makes selling count as panic. Short challenges use a smaller one. */
  panicDrawdown?: number;
}

export function computeHabitsScore(sim: SimResult, assets: Record<string, AssetRisk>, opts: ScoreOptions = {}): HabitsScore {
  const panicDrawdown = opts.panicDrawdown ?? SCORING.panicDrawdown;
  // --- time-weighted diversification & fees across snapshots ---------------
  const totalSpan = Math.max(1, sim.snapshots.reduce((s, x) => s + Math.max(0, x.toIndex - x.fromIndex), 0));
  let divPoints = 0;
  let breadthPts = 0;
  let concPts = 0;
  let effHoldings = 0;
  let maxExposure = 0;
  let avgER = 0;
  const allCash = (w: Weights) => Object.keys(w).every((k) => k === "CASH");
  for (const snap of sim.snapshots) {
    const span = Math.max(0, snap.toIndex - snap.fromIndex);
    const share = sim.snapshots.length === 1 ? 1 : span / totalSpan;
    if (share === 0) continue;
    // Sitting fully in cash is not "concentrated" - give it the
    // diversification of whatever it held before (composure covers the sale).
    const d = allCash(snap.weights)
      ? diversificationFor(sim.snapshots[0].weights, assets)
      : diversificationFor(snap.weights, assets);
    divPoints += share * d.points;
    breadthPts += share * d.breadthPoints;
    concPts += share * d.concentrationPoints;
    effHoldings += share * d.effectiveHoldings;
    maxExposure = Math.max(maxExposure, d.maxSingleExposure);
    avgER += share * expenseRatioFor(snap.weights, assets);
  }

  // --- composure -------------------------------------------------------------
  const panicSells: HabitsScore["detail"]["panicSells"] = [];
  const chases: HabitsScore["detail"]["chases"] = [];
  let composurePenalty = 0;
  for (const e of sim.events) {
    if (e.drawdown >= panicDrawdown && e.soldFraction >= SCORING.panicMinSold) {
      panicSells.push({ date: e.date, drawdown: e.drawdown, soldFraction: e.soldFraction });
      composurePenalty += SCORING.composureMax * e.soldFraction;
    }
    if (e.action === "chase_best" && e.chasedAsset) {
      chases.push({ date: e.date, asset: e.chasedAsset });
      composurePenalty += SCORING.chasePenalty;
    }
  }
  const composure = Math.max(0, SCORING.composureMax - composurePenalty);

  // --- fees ------------------------------------------------------------------
  const fees = SCORING.feesMax * clamp01(1 - avgER / SCORING.feeCeiling);

  const total = Math.round(divPoints + composure + fees);

  // --- mistakes, ordered by points lost --------------------------------------
  const lost: [MistakeType, number][] = [];
  if (divPoints < SCORING.concentratedBelow) lost.push(["concentration", SCORING.diversificationMax - divPoints]);
  if (panicSells.length) lost.push(["panic_selling", panicSells.reduce((s, p) => s + SCORING.composureMax * p.soldFraction, 0)]);
  if (chases.length) lost.push(["chasing_hype", chases.length * SCORING.chasePenalty]);
  if (avgER >= SCORING.highFeeThreshold) lost.push(["high_fees", SCORING.feesMax - fees]);
  lost.sort((a, b) => b[1] - a[1]);
  const mistakes: MistakeType[] = lost.length ? lost.map(([m]) => m) : ["none"];

  // --- skill vs luck label ---------------------------------------------------
  // Risky strategy (concentration / hype) -> "lucky" if it made money.
  // Otherwise "skilled"/"unlucky" are only for players with no mistakes at all.
  const risky = mistakes.includes("concentration") || mistakes.includes("chasing_hype");
  const clean = mistakes[0] === "none";
  const madeMoney = sim.gain > 0;
  const outcome: OutcomeLabel = risky
    ? madeMoney ? "lucky" : "risky"
    : !clean ? "shaky"
    : madeMoney ? "skilled" : "unlucky";

  return {
    total,
    diversification: Math.round(divPoints),
    composure: Math.round(composure),
    fees: Math.round(fees),
    detail: {
      diversification: {
        points: divPoints,
        breadthPoints: breadthPts,
        concentrationPoints: concPts,
        effectiveHoldings: effHoldings,
        maxSingleExposure: maxExposure,
      },
      averageExpenseRatio: avgER,
      panicSells,
      chases,
    },
    mistakes,
    primaryMistake: mistakes[0],
    outcome,
  };
}
