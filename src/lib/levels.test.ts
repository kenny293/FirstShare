/**
 * Integration tests: play each level's real config against the data in /data
 * (placeholder or real) and check the lessons land the way they're meant to.
 * These assertions hold for both the placeholder data and real yfinance data.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { ASSETS, BENCHMARKS } from "@/lib/content/assets";
import { CHASE_LOOKBACK_STEPS, LEVELS, chaseUniverse, getLevel, type LevelDef } from "@/lib/content/levels";
import { isTermId } from "@/lib/content/glossary";
import { loadMarket } from "@/lib/data";
import {
  computeHabitsScore,
  indexOnOrAfter,
  indexOnOrBefore,
  replayAcrossHistory,
  runSimulation,
  type DecisionAction,
  type Market,
  type Weights,
} from "@/lib/engine";

async function setup(level: LevelDef) {
  const payload = await loadMarket([...level.assets, ...BENCHMARKS]);
  const prices: Market["prices"] = {};
  for (const [id, arr] of Object.entries(payload.prices)) prices[id] = arr.map((p) => (p === null ? NaN : p));
  const market: Market = { dates: payload.dates, prices };
  const start = indexOnOrAfter(market, level.start);
  const end = indexOnOrBefore(market, level.end);
  const dps = level.decisionPoints.map((d) => indexOnOrBefore(market, d.date));
  const play = (allocation: Weights, actions: DecisionAction[] = []) => {
    const sim = runSimulation({
      market, startIndex: start, endIndex: end, initialAmount: 1000, allocation,
      decisions: actions.map((action, i) => ({ index: dps[i], action })),
      universe: chaseUniverse(level),
      chaseLookback: CHASE_LOOKBACK_STEPS,
      feeSwaps: level.feeSwaps,
    });
    return { sim, score: computeHabitsScore(sim, ASSETS) };
  };
  return { market, start, end, dps, play };
}

describe("level configs", () => {
  it.each(LEVELS)("level $id only links to glossary terms that exist", (level) => {
    const texts = [level.intro.scenario, level.reveal.whatHappened, ...level.decisionPoints.map((d) => d.story)];
    for (const text of texts) {
      for (const [, id] of text.matchAll(/\[\[([a-z_]+)(?:\|[^\]]+)?\]\]/g)) expect(isTermId(id), `unknown term ${id}`).toBe(true);
    }
    for (const id of level.intro.terms) expect(isTermId(id)).toBe(true);
  });

  it.each(LEVELS)("level $id has valid assets, dates and decision points", async (level) => {
    const { market, start, end, dps } = await setup(level);
    expect(end - start).toBeGreaterThan(100); // ~2+ years of weekly data
    for (const id of [...level.assets, ...BENCHMARKS]) {
      expect(Number.isFinite(market.prices[id][start]), `${id} has a price at level start`).toBe(true);
    }
    expect(dps.length).toBeGreaterThanOrEqual(2);
    expect(dps.length).toBeLessThanOrEqual(3);
    for (let i = 0; i < dps.length; i++) {
      expect(dps[i]).toBeGreaterThan(i === 0 ? start : dps[i - 1]);
      expect(dps[i]).toBeLessThan(end);
    }
    // Blind mode: stories must not leak names or years.
    for (const dp of level.decisionPoints) {
      expect(dp.story).not.toMatch(/(19|20)\d\d/);
      for (const id of level.assets) expect(dp.story).not.toContain(ASSETS[id].realName);
    }
  });
});

describe("Level 1: All eggs in one basket", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(getLevel(1)!);
  });

  it("all-in on the hot tech stock makes money but is labelled lucky", () => {
    const { sim, score } = ctx.play({ AAPL: 1 });
    expect(sim.gain).toBeGreaterThan(0);
    expect(score.outcome).toBe("lucky");
    expect(score.primaryMistake).toBe("concentration");
  });

  it("all-in on the industrial giant shows concentration amplifying losses", () => {
    const { sim, score } = ctx.play({ GE: 1 });
    const whole = ctx.play({ VTI: 1 });
    expect(sim.returnPct).toBeLessThan(-0.4);
    expect(sim.maxDrawdown).toBeGreaterThan(whole.sim.maxDrawdown * 2);
    expect(score.outcome).toBe("risky");
  });

  it("a diversified, cheap mix scores far higher than any single stock", () => {
    const good = ctx.play({ VTI: 0.7, BND: 0.3 }, ["hold", "hold"]);
    const single = ctx.play({ AAPL: 1 }, ["hold", "hold"]);
    expect(good.score.total).toBeGreaterThanOrEqual(90);
    expect(good.score.total - single.score.total).toBeGreaterThan(30);
  });

  it("the Star Picker fund's 1% fee costs real money vs the whole-market fund", () => {
    const active = ctx.play({ ACTV: 1 });
    const index = ctx.play({ VTI: 1 });
    expect(active.sim.finalValue).toBeLessThan(index.sim.finalValue);
    expect(active.score.mistakes).toContain("high_fees");
  });

  it("chasing the hot stock moves you into a single company and is flagged", () => {
    const { sim, score } = ctx.play({ VTI: 0.7, BND: 0.3 }, ["chase_best", "hold"]);
    const chased = sim.events[0].chasedAsset!;
    expect(ASSETS[chased].kind).toBe("stock");
    expect(sim.events[0].weightsAfter).toEqual({ [chased]: 1 });
    expect(score.mistakes).toContain("chasing_hype");
    expect(score.outcome === "lucky" || score.outcome === "risky").toBe(true);
  });

  it("all-in on one stock plus chasing scores low", () => {
    const { score } = ctx.play({ AAPL: 1 }, ["chase_best", "hold"]);
    expect(score.total).toBeLessThan(50);
  });

  it("skill-vs-luck: a single stock has a much wider spread than VOO", () => {
    const r = replayAcrossHistory({ market: ctx.market, allocation: { AAPL: 1 }, benchmark: "VOO", durationSteps: ctx.end - ctx.start });
    expect(r.trials).toHaveLength(10);
    expect(r.userBest - r.userWorst).toBeGreaterThan(r.benchmarkBest - r.benchmarkWorst);
  });
});

describe("Level 2: The crash", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(getLevel(2)!);
  });

  it("decision 2 happens deep in the crash", () => {
    const { sim } = ctx.play({ VTI: 1 });
    const event = ctx.play({ VTI: 1 }, ["hold", "hold"]).sim.events[1];
    expect(event.drawdown).toBeGreaterThan(0.4);
    expect(sim.maxDrawdown).toBeGreaterThan(0.4);
  });

  it("panic selling at the bottom locks in losses and tanks composure", () => {
    const panic = ctx.play({ VTI: 1 }, ["hold", "sell_all", "hold"]);
    const calm = ctx.play({ VTI: 1 }, ["hold", "hold", "hold"]);
    expect(panic.sim.finalValue).toBeLessThan(calm.sim.finalValue);
    expect(panic.score.primaryMistake).toBe("panic_selling");
    expect(panic.score.composure).toBe(0);
    expect(panic.score.outcome).toBe("shaky");
    expect(calm.score.composure).toBe(30);
  });

  it("buying more at the bottom is not penalised", () => {
    const { score, sim } = ctx.play({ VTI: 0.6, BND: 0.4 }, ["hold", "buy_more", "hold"]);
    expect(sim.totalContributed).toBe(1200);
    expect(score.composure).toBe(30);
    expect(score.mistakes).toEqual(["none"]);
  });

  it("the big bank was a disaster for a concentrated holder", () => {
    const { sim, score } = ctx.play({ C: 1 });
    expect(sim.returnPct).toBeLessThan(-0.7);
    expect(score.outcome).toBe("risky");
  });

  it("bonds cushion the fall", () => {
    const mix = ctx.play({ VTI: 0.6, BND: 0.4 });
    const allStocks = ctx.play({ VTI: 1 });
    expect(mix.sim.maxDrawdown).toBeLessThan(allStocks.sim.maxDrawdown);
  });
});

describe("Level 3: Fee monsters", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(getLevel(3)!);
  });

  it("same holdings, higher fee: the 2% fund ends well behind the whole-market fund", () => {
    const cheap = ctx.play({ VTI: 1 });
    const pricey = ctx.play({ PREM: 1 });
    expect(pricey.sim.finalValue).toBeLessThan(cheap.sim.finalValue * 0.85);
    expect(pricey.score.fees).toBe(0);
    expect(pricey.score.primaryMistake).toBe("high_fees");
    expect(pricey.score.outcome).toBe("shaky");
  });

  it("decision 1 is a real scare (big enough that selling counts as panic)", () => {
    const { sim, score } = ctx.play({ VTI: 1 }, ["sell_half", "hold", "hold"]);
    expect(sim.events[0].drawdown).toBeGreaterThan(0.15);
    expect(score.mistakes).toContain("panic_selling");
  });

  it("switching to the low-fee twin mid-way recovers fee points without counting as selling", () => {
    const stay = ctx.play({ PREM: 0.5, ACTV: 0.5 }, ["hold", "hold", "hold"]);
    const cut = ctx.play({ PREM: 0.5, ACTV: 0.5 }, ["hold", "cut_fees", "hold"]);
    expect(cut.sim.events[1].soldFraction).toBe(0);
    expect(cut.sim.events[1].weightsAfter).toEqual({ VTI: 1 });
    expect(cut.score.fees).toBeGreaterThan(stay.score.fees + 5);
    expect(cut.score.composure).toBe(30);
    expect(cut.sim.finalValue).toBeGreaterThan(stay.sim.finalValue);
  });

  it("a cheap, diversified mix scores highly", () => {
    const { score } = ctx.play({ VTI: 0.7, BND: 0.3 }, ["hold", "hold", "hold"]);
    expect(score.total).toBeGreaterThanOrEqual(90);
    expect(score.mistakes).toEqual(["none"]);
  });
});

describe("Level 4: Chasing hype", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(getLevel(4)!);
  });

  it("all-in on the tech-heavy fund crashes hard and is not called good habits", () => {
    const { sim, score } = ctx.play({ QQQ: 1 });
    expect(sim.maxDrawdown).toBeGreaterThan(0.7);
    expect(sim.returnPct).toBeLessThan(-0.4);
    expect(score.mistakes).toContain("concentration");
    expect(score.outcome).toBe("risky");
  });

  it("chasing at the first decision piles into the hot tech fund", () => {
    const { sim } = ctx.play({ SPX: 1 }, ["chase_best", "hold", "hold"]);
    expect(sim.events[0].chasedAsset).toBe("QQQ");
  });

  it("chasing at the peak does much worse than staying in the broad fund", () => {
    const chase = ctx.play({ SPX: 1 }, ["chase_best", "hold", "hold"]);
    const calm = ctx.play({ SPX: 1 }, ["hold", "hold", "hold"]);
    expect(chase.score.mistakes).toContain("chasing_hype");
    expect(chase.sim.finalValue).toBeLessThan(calm.sim.finalValue);
    expect(calm.score.composure).toBe(30);
  });

  it("selling everything after the bust is flagged as panic", () => {
    const { score } = ctx.play({ SPX: 1 }, ["hold", "sell_all", "hold"]);
    expect(score.mistakes).toContain("panic_selling");
  });

  it("skill-vs-luck works with the early-2000s start", () => {
    const r = replayAcrossHistory({ market: ctx.market, allocation: { SPX: 1 }, benchmark: "VOO", durationSteps: ctx.end - ctx.start });
    expect(r.trials.length).toBe(10);
  });
});
