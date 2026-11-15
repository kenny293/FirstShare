import type {
  Decision,
  DecisionAction,
  Market,
  SimEvent,
  SimResult,
  WeightSnapshot,
  Weights,
} from "./types";

export const DEFAULT_CONTRIBUTION = 200;

export interface SimConfig {
  market: Market;
  startIndex: number;
  endIndex: number;
  initialAmount: number;
  /** Target weights chosen at the start. */
  allocation: Weights;
  decisions?: Decision[];
  /** Money added by a buy_more decision. */
  contribution?: number;
  /** Assets considered by chase_best (defaults to the allocation's assets). */
  universe?: string[];
  /**
   * chase_best looks at returns over this many recent steps (hype = recent
   * momentum). Defaults to the whole time since the start.
   */
  chaseLookback?: number;
  /** For cut_fees: expensive asset id -> its low-cost twin. */
  feeSwaps?: Record<string, string>;
}

interface Holdings {
  units: Record<string, number>;
  cash: number;
}

export function normalizeWeights(w: Weights): Weights {
  const entries = Object.entries(w).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
}

function priceOf(market: Market, id: string, i: number): number {
  const p = market.prices[id]?.[i];
  if (!Number.isFinite(p)) throw new Error(`No price for ${id} on ${market.dates[i]}`);
  return p;
}

function investedValue(h: Holdings, market: Market, i: number): number {
  let v = 0;
  for (const [id, u] of Object.entries(h.units)) if (u > 0) v += u * priceOf(market, id, i);
  return v;
}

function totalValue(h: Holdings, market: Market, i: number): number {
  return investedValue(h, market, i) + h.cash;
}

/** Current weights including cash (as "CASH"). */
export function currentWeights(h: Holdings, market: Market, i: number): Weights {
  const total = totalValue(h, market, i);
  if (total <= 0) return {};
  const w: Weights = {};
  for (const [id, u] of Object.entries(h.units)) {
    if (u > 0) w[id] = (u * priceOf(market, id, i)) / total;
  }
  if (h.cash > 1e-9) w.CASH = h.cash / total;
  return w;
}

/** Spend `amount` buying assets in proportion to `weights`. */
function buy(h: Holdings, weights: Weights, amount: number, market: Market, i: number): void {
  const w = normalizeWeights(weights);
  for (const [id, frac] of Object.entries(w)) {
    if (id === "CASH") {
      h.cash += amount * frac;
      continue;
    }
    h.units[id] = (h.units[id] ?? 0) + (amount * frac) / priceOf(market, id, i);
  }
}

function sellFraction(h: Holdings, fraction: number, market: Market, i: number): void {
  for (const id of Object.keys(h.units)) {
    const u = h.units[id];
    if (u <= 0) continue;
    const sold = u * fraction;
    h.units[id] = u - sold;
    h.cash += sold * priceOf(market, id, i);
  }
}

function liquidate(h: Holdings, market: Market, i: number): number {
  sellFraction(h, 1, market, i);
  h.units = {};
  return h.cash;
}

/** Asset in `universe` with the best return between two indices. */
export function bestPerformer(market: Market, universe: string[], from: number, to: number): string {
  let best = universe[0];
  let bestRet = -Infinity;
  for (const id of universe) {
    const a = market.prices[id]?.[from];
    const b = market.prices[id]?.[to];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const r = b / a - 1;
    if (r > bestRet) {
      bestRet = r;
      best = id;
    }
  }
  return best;
}

function stripCash(w: Weights): Weights {
  const { CASH: _cash, ...rest } = w;
  return rest;
}

/**
 * Run a portfolio through history. Decisions are applied at their index
 * before that day's value is recorded.
 */
export function runSimulation(cfg: SimConfig): SimResult {
  const { market, startIndex, endIndex, initialAmount } = cfg;
  if (endIndex <= startIndex) throw new Error("endIndex must be after startIndex");
  const allocation = normalizeWeights(cfg.allocation);
  if (Object.keys(allocation).length === 0) throw new Error("Allocation is empty");
  const contribution = cfg.contribution ?? DEFAULT_CONTRIBUTION;
  const universe = cfg.universe ?? Object.keys(allocation).filter((k) => k !== "CASH");
  const decisions = new Map<number, DecisionAction>();
  for (const d of cfg.decisions ?? []) decisions.set(d.index, d.action);

  const h: Holdings = { units: {}, cash: 0 };
  buy(h, allocation, initialAmount, market, startIndex);

  const dates: string[] = [];
  const values: number[] = [];
  const growthIndex: number[] = [];
  const events: SimEvent[] = [];
  const snapshots: WeightSnapshot[] = [];
  let snapshotStart = startIndex;
  let snapshotWeights: Weights = currentWeights(h, market, startIndex);

  let contributed = initialAmount;
  let prevValue = initialAmount;
  let growth = 1;
  let peakGrowth = 1;
  let maxDrawdown = 0;

  for (let i = startIndex; i <= endIndex; i++) {
    // 1. Market moves since the previous step.
    const valueBeforeTrades = totalValue(h, market, i);
    if (i > startIndex && prevValue > 0) growth *= valueBeforeTrades / prevValue;
    peakGrowth = Math.max(peakGrowth, growth);
    const drawdown = peakGrowth > 0 ? 1 - growth / peakGrowth : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    // 2. Apply a decision, if any.
    const action = decisions.get(i);
    if (action && i !== startIndex) {
      const weightsBefore = currentWeights(h, market, i);
      const investedBefore = investedValue(h, market, i);
      let added = 0;
      let chasedAsset: string | undefined;

      switch (action) {
        case "hold":
          break;
        case "sell_all":
          liquidate(h, market, i);
          break;
        case "sell_half":
          sellFraction(h, 0.5, market, i);
          break;
        case "buy_more": {
          const invested = stripCash(weightsBefore);
          const target = Object.keys(invested).length > 0 ? invested : stripCash(allocation);
          buy(h, target, contribution, market, i);
          added = contribution;
          contributed += contribution;
          break;
        }
        case "rebalance": {
          const cash = liquidate(h, market, i);
          h.cash = 0;
          buy(h, allocation, cash, market, i);
          break;
        }
        case "cut_fees": {
          for (const [from, to] of Object.entries(cfg.feeSwaps ?? {})) {
            const u = h.units[from] ?? 0;
            if (u <= 0) continue;
            const proceeds = u * priceOf(market, from, i);
            delete h.units[from];
            h.units[to] = (h.units[to] ?? 0) + proceeds / priceOf(market, to, i);
          }
          break;
        }
        case "chase_best": {
          const from = cfg.chaseLookback ? Math.max(startIndex, i - cfg.chaseLookback) : startIndex;
          chasedAsset = bestPerformer(market, universe, from, i);
          const cash = liquidate(h, market, i);
          h.cash = 0;
          buy(h, { [chasedAsset]: 1 }, cash, market, i);
          break;
        }
      }

      const investedAfter = investedValue(h, market, i);
      const soldFraction =
        investedBefore > 0 ? Math.max(0, Math.min(1, 1 - (investedAfter - added) / investedBefore)) : 0;
      const weightsAfter = currentWeights(h, market, i);

      events.push({
        index: i,
        date: market.dates[i],
        action,
        valueBefore: valueBeforeTrades,
        valueAfter: totalValue(h, market, i),
        contribution: added,
        drawdown,
        soldFraction: soldFraction < 1e-9 ? 0 : soldFraction,
        weightsBefore,
        weightsAfter,
        chasedAsset,
      });

      if (action !== "hold") {
        snapshots.push({ fromIndex: snapshotStart, toIndex: i, weights: snapshotWeights });
        snapshotStart = i;
        snapshotWeights = weightsAfter;
      }
    }

    const v = totalValue(h, market, i);
    dates.push(market.dates[i]);
    values.push(v);
    growthIndex.push(growth);
    prevValue = v;
  }
  snapshots.push({ fromIndex: snapshotStart, toIndex: endIndex, weights: snapshotWeights });

  const finalValue = values[values.length - 1];
  const gain = finalValue - contributed;
  return {
    dates,
    values,
    growthIndex,
    events,
    snapshots,
    totalContributed: contributed,
    finalValue,
    gain,
    returnPct: gain / contributed,
    maxDrawdown,
  };
}

/**
 * The portfolio's weights at `index`, letting the weights from the active
 * snapshot drift with prices (cash stays flat).
 */
export function weightsAt(sim: SimResult, market: Market, index: number): Weights {
  const snap =
    [...sim.snapshots].reverse().find((s) => s.fromIndex <= index) ?? sim.snapshots[0];
  const raw: Weights = {};
  for (const [id, w] of Object.entries(snap.weights)) {
    if (id === "CASH") raw[id] = w;
    else raw[id] = (w * market.prices[id][index]) / market.prices[id][snap.fromIndex];
  }
  return normalizeWeights(raw);
}

/**
 * Buy-and-hold one benchmark fund with the same cash flows the user had
 * (initial amount + any buy_more deposits at the same moments), so the
 * comparison is fair.
 */
export function runBenchmark(
  market: Market,
  ticker: string,
  startIndex: number,
  endIndex: number,
  initialAmount: number,
  userEvents: SimEvent[] = [],
): SimResult {
  const deposits = userEvents.filter((e) => e.contribution > 0);
  return runSimulation({
    market,
    startIndex,
    endIndex,
    initialAmount,
    allocation: { [ticker]: 1 },
    decisions: deposits.map((e) => ({ index: e.index, action: "buy_more" as const })),
    contribution: deposits[0]?.contribution ?? DEFAULT_CONTRIBUTION,
  });
}
