import { firstCommonIndex } from "./market";
import { normalizeWeights, runSimulation } from "./simulate";
import type { Market, Weights } from "./types";

export interface ReplayTrial {
  startDate: string;
  endDate: string;
  userReturn: number;
  benchmarkReturn: number;
  beat: boolean;
}

export interface ReplayResult {
  trials: ReplayTrial[];
  beatCount: number;
  /** Spread between best and worst user outcome - a big spread means luck matters a lot. */
  userBest: number;
  userWorst: number;
  benchmarkBest: number;
  benchmarkWorst: number;
}

/**
 * Replay the user's starting allocation (buy and hold) from `trials`
 * evenly spaced start dates across the dataset, each for the same length of
 * time as the level, and compare with a benchmark over the same windows.
 */
export function replayAcrossHistory(opts: {
  market: Market;
  allocation: Weights;
  benchmark: string;
  durationSteps: number;
  initialAmount?: number;
  trials?: number;
}): ReplayResult {
  const { market, benchmark, durationSteps } = opts;
  const initialAmount = opts.initialAmount ?? 1000;
  const n = opts.trials ?? 10;
  const allocation = normalizeWeights(opts.allocation);
  const ids = [...Object.keys(allocation), benchmark];

  const first = firstCommonIndex(market, ids);
  const lastStart = market.dates.length - 1 - durationSteps;
  if (first < 0 || lastStart < first) {
    return { trials: [], beatCount: 0, userBest: 0, userWorst: 0, benchmarkBest: 0, benchmarkWorst: 0 };
  }

  const count = Math.min(n, lastStart - first + 1);
  const starts: number[] = [];
  for (let k = 0; k < count; k++) {
    starts.push(count === 1 ? first : Math.round(first + ((lastStart - first) * k) / (count - 1)));
  }

  const trials: ReplayTrial[] = starts.map((s) => {
    const end = s + durationSteps;
    const user = runSimulation({ market, startIndex: s, endIndex: end, initialAmount, allocation });
    const bench = runSimulation({ market, startIndex: s, endIndex: end, initialAmount, allocation: { [benchmark]: 1 } });
    return {
      startDate: market.dates[s],
      endDate: market.dates[end],
      userReturn: user.returnPct,
      benchmarkReturn: bench.returnPct,
      beat: user.returnPct > bench.returnPct,
    };
  });

  const u = trials.map((t) => t.userReturn);
  const b = trials.map((t) => t.benchmarkReturn);
  return {
    trials,
    beatCount: trials.filter((t) => t.beat).length,
    userBest: Math.max(...u),
    userWorst: Math.min(...u),
    benchmarkBest: Math.max(...b),
    benchmarkWorst: Math.min(...b),
  };
}
