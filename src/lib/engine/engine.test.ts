import { describe, expect, it } from "vitest";
import {
  buildMarket,
  computeHabitsScore,
  diversificationFor,
  elapsedLabel,
  indexOnOrBefore,
  replayAcrossHistory,
  runBenchmark,
  runSimulation,
  toWeekly,
  weightsAt,
  withAnnualFee,
  type AssetRisk,
  type Market,
  type PricePoint,
} from "./index";

const days = (n: number, start = "2020-01-06") => {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  while (out.length < n) {
    if (d.getUTCDay() % 6 !== 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};
const series = (dates: string[], prices: number[]): PricePoint[] => dates.map((d, i) => [d, prices[i]]);

/** STOCK: 100 -> 50 -> 120.  FUND: 100 -> 80 -> 110.  BOND: flat 100. */
function crashMarket(): Market {
  const d = days(5);
  return buildMarket({
    STOCK: series(d, [100, 70, 50, 90, 120]),
    FUND: series(d, [100, 90, 80, 95, 110]),
    BOND: series(d, [100, 100, 100, 100, 100]),
  });
}

const ASSETS: Record<string, AssetRisk> = {
  STOCK: { kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1 },
  STOCK2: { kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1 },
  FUND: { kind: "broad_fund", expenseRatio: 0.0003, maxSingleCompanyWeight: 0.065 },
  BOND: { kind: "bond_fund", expenseRatio: 0.0003, maxSingleCompanyWeight: 0.01 },
  PRICEY: { kind: "active_fund", expenseRatio: 0.01, maxSingleCompanyWeight: 0.065 },
};

describe("market helpers", () => {
  it("aligns series and forward-fills, NaN before listing", () => {
    const m = buildMarket({
      A: [["2020-01-01", 1], ["2020-01-02", 2], ["2020-01-03", 3]],
      B: [["2020-01-02", 10]],
    });
    expect(m.dates).toEqual(["2020-01-01", "2020-01-02", "2020-01-03"]);
    expect(m.prices.B[0]).toBeNaN();
    expect(m.prices.B[2]).toBe(10);
  });

  it("keeps the last trading day of each week", () => {
    const d = days(10); // Mon 2020-01-06 .. Fri 2020-01-17
    const w = toWeekly(series(d, d.map((_, i) => i)));
    expect(w).toEqual([["2020-01-10", 4], ["2020-01-17", 9]]);
  });

  it("applies an annual fee drag", () => {
    const out = withAnnualFee([["2020-01-01", 100], ["2021-01-01", 100]], 0.01);
    expect(out[1][1]).toBeCloseTo(99, 1);
  });

  it("finds index on or before a date", () => {
    const m = crashMarket();
    expect(indexOnOrBefore(m, "2020-01-08")).toBe(2);
    expect(indexOnOrBefore(m, "2030-01-01")).toBe(4);
  });

  it("labels elapsed time without revealing dates", () => {
    expect(elapsedLabel("2007-10-01", "2007-10-20")).toBe("Year 1, Month 1");
    expect(elapsedLabel("2007-10-01", "2009-03-09")).toBe("Year 2, Month 6");
  });
});

describe("runSimulation", () => {
  it("buy and hold tracks prices", () => {
    const r = runSimulation({ market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000, allocation: { STOCK: 1 } });
    expect(r.values).toEqual([1000, 700, 500, 900, 1200]);
    expect(r.finalValue).toBe(1200);
    expect(r.returnPct).toBeCloseTo(0.2);
    expect(r.maxDrawdown).toBeCloseTo(0.5);
  });

  it("splits money by weight", () => {
    const r = runSimulation({ market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000, allocation: { STOCK: 0.5, BOND: 0.5 } });
    expect(r.values[2]).toBeCloseTo(750);
    expect(r.finalValue).toBeCloseTo(1100);
  });

  it("selling at the bottom locks in the loss", () => {
    const r = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 1 }, decisions: [{ index: 2, action: "sell_all" }],
    });
    expect(r.finalValue).toBeCloseTo(500);
    expect(r.events[0].soldFraction).toBeCloseTo(1);
    expect(r.events[0].drawdown).toBeCloseTo(0.5);
  });

  it("sell_half sells half", () => {
    const r = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 1 }, decisions: [{ index: 2, action: "sell_half" }],
    });
    expect(r.events[0].soldFraction).toBeCloseTo(0.5);
    // 10 shares: sell 5 @ $50 = $250 cash, keep 5 @ $120 = $600
    expect(r.finalValue).toBeCloseTo(250 + 5 * 120);
  });

  it("cut_fees swaps an asset for its twin without selling to cash", () => {
    const r = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 1 }, decisions: [{ index: 2, action: "cut_fees" }], feeSwaps: { STOCK: "BOND" },
    });
    const e = r.events[0];
    expect(e.valueAfter).toBeCloseTo(e.valueBefore);
    expect(e.soldFraction).toBe(0);
    expect(Object.keys(e.weightsAfter)).toEqual(["BOND"]);
  });

  it("buy_more adds a deposit that is tracked separately from growth", () => {
    const r = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 1 }, decisions: [{ index: 2, action: "buy_more" }], contribution: 200,
    });
    expect(r.totalContributed).toBe(1200);
    expect(r.finalValue).toBeCloseTo(1200 + 4 * 120); // 10 units + 4 units
    expect(r.events[0].soldFraction).toBe(0);
    // Growth index should ignore the deposit.
    expect(r.growthIndex[4]).toBeCloseTo(1.2);
  });

  it("rebalance resets to target weights", () => {
    const m = crashMarket();
    const r = runSimulation({
      market: m, startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 0.5, BOND: 0.5 }, decisions: [{ index: 2, action: "rebalance" }],
    });
    expect(r.events[0].weightsAfter.STOCK).toBeCloseTo(0.5);
    expect(r.events[0].weightsAfter.BOND).toBeCloseTo(0.5);
  });

  it("chase_best moves everything into the best performer so far", () => {
    const r = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 0.5, BOND: 0.5 }, decisions: [{ index: 1, action: "chase_best" }],
    });
    expect(r.events[0].chasedAsset).toBe("BOND");
    expect(r.events[0].weightsAfter).toEqual({ BOND: 1 });
  });

  it("hold changes nothing", () => {
    const a = runSimulation({ market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000, allocation: { FUND: 1 } });
    const b = runSimulation({
      market: crashMarket(), startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { FUND: 1 }, decisions: [{ index: 2, action: "hold" }],
    });
    expect(b.values).toEqual(a.values);
    expect(b.snapshots).toHaveLength(1);
  });

  it("benchmark receives the same deposits", () => {
    const m = crashMarket();
    const user = runSimulation({
      market: m, startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { STOCK: 1 }, decisions: [{ index: 2, action: "buy_more" }], contribution: 200,
    });
    const bench = runBenchmark(m, "FUND", 0, 4, 1000, user.events);
    expect(bench.totalContributed).toBe(1200);
    expect(bench.finalValue).toBeCloseTo(10 * 110 + (200 / 80) * 110);
  });

  it("weightsAt lets weights drift with prices", () => {
    const m = crashMarket();
    const r = runSimulation({ market: m, startIndex: 0, endIndex: 4, initialAmount: 1000, allocation: { STOCK: 0.5, BOND: 0.5 } });
    const w = weightsAt(r, m, 2); // stock 250, bond 500
    expect(w.STOCK).toBeCloseTo(1 / 3);
    expect(w.BOND).toBeCloseTo(2 / 3);
  });

  it("rejects invalid input", () => {
    expect(() => runSimulation({ market: crashMarket(), startIndex: 2, endIndex: 2, initialAmount: 1000, allocation: { STOCK: 1 } })).toThrow();
    expect(() => runSimulation({ market: crashMarket(), startIndex: 0, endIndex: 2, initialAmount: 1000, allocation: {} })).toThrow();
  });
});

describe("habits score", () => {
  const m = crashMarket();
  const sim = (allocation: Record<string, number>, decisions: { index: number; action: "sell_all" | "hold" | "buy_more" | "chase_best" | "sell_half" }[] = []) =>
    runSimulation({ market: m, startIndex: 0, endIndex: 4, initialAmount: 1000, allocation, decisions });

  it("a single stock scores 0 on concentration", () => {
    const d = diversificationFor({ STOCK: 1 }, ASSETS);
    expect(d.concentrationPoints).toBe(0);
    expect(d.breadthPoints).toBeCloseTo(4);
  });

  it("a broad fund gets full diversification", () => {
    const d = diversificationFor({ FUND: 1 }, ASSETS);
    expect(d.points).toBeCloseTo(50);
  });

  it("all-in on one stock that went UP is labelled lucky, not skilled", () => {
    const s = computeHabitsScore(sim({ STOCK: 1 }), ASSETS);
    expect(s.outcome).toBe("lucky");
    expect(s.mistakes).toContain("concentration");
    expect(s.total).toBeLessThan(60);
  });

  it("diversified, cheap and calm scores high and is labelled skilled", () => {
    const s = computeHabitsScore(sim({ FUND: 0.7, BOND: 0.3 }), ASSETS);
    expect(s.total).toBeGreaterThanOrEqual(95);
    expect(s.primaryMistake).toBe("none");
    expect(s.outcome).toBe("skilled");
  });

  it("profit does not raise the score", () => {
    // Same diversified mix, one ends higher - score must be identical.
    const d = days(3);
    const up = buildMarket({ FUND: series(d, [100, 120, 150]), BOND: series(d, [100, 100, 100]) });
    const down = buildMarket({ FUND: series(d, [100, 90, 80]), BOND: series(d, [100, 100, 100]) });
    const a = computeHabitsScore(runSimulation({ market: up, startIndex: 0, endIndex: 2, initialAmount: 1000, allocation: { FUND: 0.6, BOND: 0.4 } }), ASSETS);
    const b = computeHabitsScore(runSimulation({ market: down, startIndex: 0, endIndex: 2, initialAmount: 1000, allocation: { FUND: 0.6, BOND: 0.4 } }), ASSETS);
    expect(a.total).toBe(b.total);
    expect(b.outcome).toBe("unlucky");
  });

  it("panic selling after a big drop costs composure points", () => {
    const calm = computeHabitsScore(sim({ FUND: 1 }, [{ index: 2, action: "hold" }]), ASSETS);
    const panic = computeHabitsScore(sim({ FUND: 1 }, [{ index: 2, action: "sell_all" }]), ASSETS);
    expect(calm.composure).toBe(30);
    expect(panic.composure).toBe(0);
    expect(panic.primaryMistake).toBe("panic_selling");
    expect(panic.detail.panicSells[0].drawdown).toBeCloseTo(0.2);
    // A diversified mix that panic-sold must NOT be called "good habits".
    expect(panic.outcome).toBe("shaky");
  });

  it("chase_best can be limited to recent momentum", () => {
    // STOCK: 100,70,50,90,120 - over the last 1 step (50->90) it's the hottest.
    const r = runSimulation({
      market: m, startIndex: 0, endIndex: 4, initialAmount: 1000,
      allocation: { BOND: 1 }, universe: ["STOCK", "FUND"], chaseLookback: 1,
      decisions: [{ index: 3, action: "chase_best" }],
    });
    expect(r.events[0].chasedAsset).toBe("STOCK");
  });

  it("selling after a small dip is not panic", () => {
    const s = computeHabitsScore(sim({ FUND: 1 }, [{ index: 1, action: "sell_all" }]), ASSETS); // -10%
    expect(s.mistakes).not.toContain("panic_selling");
  });

  it("buying more at the bottom keeps full composure", () => {
    const s = computeHabitsScore(sim({ FUND: 1 }, [{ index: 2, action: "buy_more" }]), ASSETS);
    expect(s.composure).toBe(30);
  });

  it("chasing the hot asset is flagged", () => {
    const s = computeHabitsScore(sim({ STOCK: 0.5, BOND: 0.5 }, [{ index: 1, action: "chase_best" }]), ASSETS);
    expect(s.mistakes).toContain("chasing_hype");
  });

  it("high fees are flagged and cost fee points", () => {
    const d = days(3);
    const mk = buildMarket({ PRICEY: series(d, [100, 101, 102]) });
    const s = computeHabitsScore(runSimulation({ market: mk, startIndex: 0, endIndex: 2, initialAmount: 1000, allocation: { PRICEY: 1 } }), ASSETS);
    expect(s.fees).toBe(0);
    expect(s.mistakes).toContain("high_fees");
  });

  it("score stays within 0-100", () => {
    const worst = computeHabitsScore(sim({ STOCK: 1 }, [{ index: 1, action: "chase_best" }, { index: 2, action: "sell_all" }]), ASSETS);
    expect(worst.total).toBeGreaterThanOrEqual(0);
    expect(worst.total).toBeLessThanOrEqual(100);
  });
});

describe("skill vs luck replay", () => {
  // A stock that zig-zags wildly and a steady fund.
  const n = 60;
  const d = days(n);
  const stock = d.map((_, i) => 100 * (1 + 0.6 * Math.sin(i / 3)));
  const fund = d.map((_, i) => 100 * Math.pow(1.002, i));
  const m = buildMarket({ STOCK: series(d, stock), FUND: series(d, fund) });

  it("runs 10 evenly spaced windows of the same length", () => {
    const r = replayAcrossHistory({ market: m, allocation: { STOCK: 1 }, benchmark: "FUND", durationSteps: 10 });
    expect(r.trials).toHaveLength(10);
    expect(r.trials[0].startDate).toBe(d[0]);
    expect(r.trials[9].endDate).toBe(d[n - 1]);
    expect(r.beatCount).toBe(r.trials.filter((t) => t.beat).length);
  });

  it("a concentrated mix has a much wider spread than the index", () => {
    const r = replayAcrossHistory({ market: m, allocation: { STOCK: 1 }, benchmark: "FUND", durationSteps: 10 });
    expect(r.userBest - r.userWorst).toBeGreaterThan(5 * (r.benchmarkBest - r.benchmarkWorst));
  });

  it("returns no trials when the window does not fit", () => {
    const r = replayAcrossHistory({ market: m, allocation: { STOCK: 1 }, benchmark: "FUND", durationSteps: 500 });
    expect(r.trials).toHaveLength(0);
  });
});
