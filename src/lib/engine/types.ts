/** [ISO date, adjusted close] */
export type PricePoint = [string, number];

export interface PriceFile {
  ticker: string;
  source: string;
  note?: string;
  prices: PricePoint[];
}

/**
 * Price series aligned on one shared date grid. `prices[id][i]` is the price of
 * asset `id` on `dates[i]`, or NaN if it did not trade yet.
 */
export interface Market {
  dates: string[];
  prices: Record<string, number[]>;
}

/** Fraction of the portfolio in each asset id. Values sum to 1. */
export type Weights = Record<string, number>;

export type AssetKind =
  | "stock"
  | "broad_fund"
  | "sector_fund"
  | "bond_fund"
  | "active_fund";

/** The facts the scoring code needs about each asset. */
export interface AssetRisk {
  kind: AssetKind;
  /** Annual expense ratio as a fraction, e.g. 0.0003 = 0.03% */
  expenseRatio: number;
  /** Largest single company inside the asset (1 for a single stock). */
  maxSingleCompanyWeight: number;
}

export type DecisionAction =
  | "hold"
  | "sell_all"
  | "sell_half"
  | "buy_more"
  | "rebalance"
  | "chase_best"
  /** Swap each high-fee fund for its low-cost twin (same holdings, lower fee). */
  | "cut_fees";

export interface Decision {
  /** Index into market.dates where the decision happens. */
  index: number;
  action: DecisionAction;
}

export interface SimEvent {
  index: number;
  date: string;
  action: DecisionAction;
  valueBefore: number;
  valueAfter: number;
  /** Money added at this event (buy_more). */
  contribution: number;
  /** How far the portfolio was below its previous peak, 0..1 (time-weighted, ignores deposits). */
  drawdown: number;
  /** Fraction of invested (non-cash) money that was sold at this event, 0..1. */
  soldFraction: number;
  weightsBefore: Weights;
  weightsAfter: Weights;
  /** For chase_best: which asset it moved into. */
  chasedAsset?: string;
}

/** A period during which the portfolio held (roughly) one set of target weights. */
export interface WeightSnapshot {
  fromIndex: number;
  toIndex: number;
  weights: Weights;
}

export interface SimResult {
  dates: string[];
  values: number[];
  /** Growth of $1 ignoring deposits (time-weighted) - used for drawdowns. */
  growthIndex: number[];
  events: SimEvent[];
  snapshots: WeightSnapshot[];
  totalContributed: number;
  finalValue: number;
  /** final - contributed */
  gain: number;
  /** gain / contributed */
  returnPct: number;
  maxDrawdown: number;
}
