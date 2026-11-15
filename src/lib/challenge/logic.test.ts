import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/engine/types";
import { CHALLENGE } from "./config";
import {
  addDays,
  buildChallengeMarket,
  challengeWindow,
  detectEvents,
  findViolations,
  luckReveal,
  parsePlan,
  randomPortfolioReturns,
  scoreChallenge,
  simulateChallenge,
} from "./logic";
import type { ChallengeDoc } from "./types";

/** 11 weekdays starting Mon 2026-03-02, with a chosen daily move for the benchmark. */
function makeSeries(benchMoves: number[]): Record<string, PricePoint[]> {
  const dates: string[] = [];
  let d = "2026-03-02";
  while (dates.length < benchMoves.length + 1) {
    const day = new Date(d + "T00:00:00Z").getUTCDay();
    if (day !== 0 && day !== 6) dates.push(d);
    d = addDays(d, 1);
  }
  const path = (moves: number[], start = 100) => {
    let p = start;
    return dates.map((date, i) => {
      if (i > 0) p *= 1 + (moves[i - 1] ?? 0);
      return [date, p] as PricePoint;
    });
  };
  const flat = benchMoves.map(() => 0.001);
  return {
    VOO: path(benchMoves),
    VTI: path(benchMoves),
    BND: path(flat),
    QQQ: path(benchMoves.map((m) => m * 1.5)),
    AAPL: path(benchMoves.map((m) => m * 2)),
    MSFT: path(flat),
    XOM: path(flat.map(() => -0.002)),
    F: path(flat),
  };
}

const baseDoc = (over: Partial<ChallengeDoc> = {}): ChallengeDoc => ({
  uid: "u1", displayName: "Tester", mode: "replay", status: "active",
  startDate: "2026-03-02", endDate: "2026-03-16",
  plan: { allocation: { VTI: 0.7, BND: 0.3 }, rules: ["no_panic", "no_chase"], note: "", guessLow: 950, guessHigh: 1050 },
  actions: [], deposit: { status: "paid_mock", amount: 10 }, dataSource: "test",
  createdAt: "", updatedAt: "", ...over,
});

describe("challenge check-ins", () => {
  it("adds a midway check-in on a calm fortnight", () => {
    const m = buildChallengeMarket(makeSeries(new Array(10).fill(0.002)));
    const ev = detectEvents(m, 0, 10);
    expect(ev).toHaveLength(1);
    expect(ev[0].kind).toBe("midway");
    expect(ev[0].date >= "2026-03-09").toBe(true);
  });

  it("flags big market days, at most 3 check-ins in total", () => {
    const moves = [0.002, -0.02, 0.002, 0.02, -0.03, 0.002, -0.025, 0.002, 0.002, 0.002];
    const m = buildChallengeMarket(makeSeries(moves));
    const ev = detectEvents(m, 0, 10);
    expect(ev.length).toBeLessThanOrEqual(CHALLENGE.maxCheckins);
    expect(ev[0]).toMatchObject({ kind: "drop", date: m.dates[2] });
    expect(ev[1]).toMatchObject({ kind: "jump", date: m.dates[4] });
    expect(ev.some((e) => e.kind === "midway")).toBe(true);
  });

  it("earlier check-ins don't change as new days arrive (live mode)", () => {
    const moves = [0.002, -0.02, 0.002, 0.002, 0.002, 0.002, -0.03, 0.002, 0.002, 0.002];
    const m = buildChallengeMarket(makeSeries(moves));
    const early = detectEvents(m, 0, 4);
    const later = detectEvents(m, 0, 10);
    expect(later.slice(0, early.length)).toEqual(early);
  });
});

describe("challenge scoring", () => {
  const moves = [0.002, -0.02, 0.002, 0.02, -0.03, 0.002, 0.002, 0.002, 0.002, 0.002];
  const m = buildChallengeMarket(makeSeries(moves));
  const w = challengeWindow(m, baseDoc());
  const events = detectEvents(m, w.startIdx, w.endIdx);

  it("a calm, diversified player who answers every check-in scores high and gets the deposit back", () => {
    const doc = baseDoc({
      actions: events.map((e) => ({ date: e.date, eventDate: e.date, action: "hold" as const, reasoning: "sticking to my plan", createdAt: "" })),
    });
    const r = scoreChallenge(m, w, doc, events, "seed");
    expect(r.violations).toEqual([]);
    expect(r.parts.planKept).toBe(15);
    expect(r.parts.reflection).toBe(10);
    expect(r.challengeScore).toBeGreaterThanOrEqual(85);
    expect(r.depositRefunded).toBe(true);
  });

  it("selling after a drop breaks the no-panic rule and counts as panic selling", () => {
    const drop = events.find((e) => e.kind === "drop")!;
    const doc = baseDoc({ actions: [{ date: drop.date, eventDate: drop.date, action: "sell_all", reasoning: "scared", createdAt: "" }] });
    const sim = simulateChallenge(m, w, doc.plan, doc.actions);
    expect(findViolations(doc.plan.rules, sim).map((v) => v.rule)).toContain("no_panic");
    const r = scoreChallenge(m, w, doc, events, "seed");
    expect(r.habits.mistakes).toContain("panic_selling");
    expect(r.depositRefunded).toBe(false);
  });

  it("return never raises the score: same habits, different luck, same score", () => {
    const up = buildChallengeMarket(makeSeries(new Array(10).fill(0.01)));
    const down = buildChallengeMarket(makeSeries(new Array(10).fill(-0.004)));
    const doc = baseDoc({ plan: { ...baseDoc().plan, guessLow: 0, guessHigh: 100000 } });
    const score = (mk: typeof up) => {
      const win = challengeWindow(mk, doc);
      const ev = detectEvents(mk, win.startIdx, win.endIdx);
      return scoreChallenge(mk, win, { ...doc, actions: ev.map((e) => ({ date: e.date, eventDate: e.date, action: "hold" as const, reasoning: "plan", createdAt: "" })) }, ev, "s");
    };
    const a = score(up);
    const b = score(down);
    expect(a.returnPct).toBeGreaterThan(0);
    expect(b.returnPct).toBeLessThan(0);
    expect(a.challengeScore - a.parts.calibration).toBe(b.challengeScore - b.parts.calibration);
  });

  it("chasing breaks the no-chase rule", () => {
    const jump = events.find((e) => e.kind === "jump")!;
    const doc = baseDoc({ actions: [{ date: jump.date, eventDate: jump.date, action: "chase_best", reasoning: "hot", createdAt: "" }] });
    const r = scoreChallenge(m, w, doc, events, "seed");
    expect(r.violations.map((v) => v.rule)).toContain("no_chase");
    expect(r.habits.mistakes).toContain("chasing_hype");
    expect(r.depositRefunded).toBe(false); // breaking your own rule always forfeits the deposit
  });
});

describe("luck reveal", () => {
  it("is seeded and puts the player in the distribution", () => {
    const m = buildChallengeMarket(makeSeries([0.01, -0.02, 0.01, 0.005, 0.002, -0.01, 0.01, 0.002, 0.002, 0.003]));
    const w = { startIdx: 0, endIdx: 10 };
    const a = randomPortfolioReturns(m, w, "abc", 200);
    expect(randomPortfolioReturns(m, w, "abc", 200)).toEqual(a);
    const luck = luckReveal(a, 0);
    expect(luck.bins.reduce((s, b) => s + b.count, 0)).toBe(200);
    expect(luck.percentile).toBeGreaterThanOrEqual(0);
    expect(luck.percentile).toBeLessThanOrEqual(1);
  });
});

describe("plan validation", () => {
  it("accepts a good plan and rejects bad ones", () => {
    expect(parsePlan({ allocation: { VTI: 0.5, BND: 0.5 }, rules: ["no_panic"], guessLow: 900, guessHigh: 1100, note: "x" })).toMatchObject({ rules: ["no_panic"] });
    expect(parsePlan({ allocation: { TSLA: 1 }, rules: ["no_panic"], guessLow: 1, guessHigh: 2 })).toMatch(/Unknown/);
    expect(parsePlan({ allocation: { VTI: 0.5 }, rules: ["no_panic"], guessLow: 1, guessHigh: 2 })).toMatch(/100%/);
    expect(parsePlan({ allocation: { VTI: 1 }, rules: [], guessLow: 1, guessHigh: 2 })).toMatch(/rule/);
    expect(parsePlan({ allocation: { VTI: 1 }, rules: ["no_chase"], guessLow: 2, guessHigh: 1 })).toMatch(/range/);
  });
});
