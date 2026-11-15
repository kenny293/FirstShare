"use client";

import { useMemo } from "react";
import { simulateChallenge } from "@/lib/challenge/logic";
import type { ChallengeEvent, ChallengeView } from "@/lib/challenge/types";
import { buildMarket, weightsAt } from "@/lib/engine";
import { pct } from "@/lib/format";
import { liveName } from "./PlanBuilder";

const DAY_MS = 24 * 3600 * 1000;
export const dayNumber = (start: string, date: string) => Math.round((Date.parse(date) - Date.parse(start)) / DAY_MS);

/** Rebuild the player's portfolio in the browser from the server's prices + saved actions (display only; the server scores). */
export function useChallengeSim(view: ChallengeView, step: number) {
  const market = useMemo(() => buildMarket(view.series), [view.series]);
  const last = market.dates.length - 1;
  const sim = useMemo(
    () => simulateChallenge(market, { startIdx: 0, endIdx: last }, view.challenge.plan, view.challenge.actions),
    [market, last, view.challenge.plan, view.challenge.actions],
  );
  const s = Math.max(0, Math.min(step, sim.values.length - 1));
  const value = sim.values[s] ?? sim.finalValue;
  const contributed = sim.totalContributed - sim.events.filter((e) => e.index > s).reduce((t, e) => t + e.contribution, 0);
  const chartData = useMemo(() => sim.values.slice(0, s + 1).map((v, t) => ({ t, value: v })), [sim.values, s]);
  const markers = view.challenge.actions
    .map((a) => market.dates.indexOf(a.date))
    .filter((i) => i > 0 && i <= s)
    .map((i) => ({ t: i, value: sim.values[i] }));
  const holdings = useMemo(() => {
    const w = s === 0 ? view.challenge.plan.allocation : weightsAt(sim, market, s);
    return Object.entries(w)
      .sort((a, b) => b[1] - a[1])
      .map(([id, weight]) => ({
        id,
        name: liveName(id),
        weight,
        change: id === "CASH" ? 0 : market.prices[id][s] / market.prices[id][0] - 1,
      }));
  }, [sim, market, s, view.challenge.plan.allocation]);
  const ticks = market.dates.map((_, i) => i);
  const tickFormatter = (t: number) => `D${dayNumber(market.dates[0], market.dates[t] ?? market.dates[0])}`;
  return { market, last, sim, value, contributed, chartData, markers, holdings, ticks, tickFormatter };
}

export function eventStory(e: ChallengeEvent): { title: string; story: string } {
  if (e.kind === "drop")
    return {
      title: "A rough day in the market",
      story: `The S&P 500 just fell ${pct(e.move, { decimals: 1 })} in a single day, and the headlines are loud. What does your plan say?`,
    };
  if (e.kind === "jump")
    return {
      title: "The market is surging",
      story: `The S&P 500 just jumped ${pct(e.move, { decimals: 1 })} in a day. Everyone's talking about what's hot. Do you change anything?`,
    };
  return { title: "Halfway check-in", story: "You're halfway through. Take a breath and look at your plan: is it still the plan?" };
}
