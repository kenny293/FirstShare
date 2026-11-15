"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { replayAcrossHistory, type Market, type Weights } from "@/lib/engine";
import { pct } from "@/lib/format";
import { Term } from "../Term";
import { CHART, SERIES } from "./types";

export function SkillVsLuck({
  market,
  allocation,
  durationSteps,
  years,
}: {
  market: Market;
  allocation: Weights;
  durationSteps: number;
  years: number;
}) {
  const result = useMemo(
    () => replayAcrossHistory({ market, allocation, benchmark: "VOO", durationSteps, trials: 10 }),
    [market, allocation, durationSteps],
  );

  if (result.trials.length === 0) return null;

  const data = result.trials.map((t) => ({
    label: `${t.startDate.slice(0, 4)}–${t.endDate.slice(2, 4)}`,
    you: Math.round(t.userReturn * 100),
    voo: Math.round(t.benchmarkReturn * 100),
  }));
  const n = result.trials.length;
  const spreadYou = result.userBest - result.userWorst;
  const spreadVoo = result.benchmarkBest - result.benchmarkWorst;
  const smoother = result.userWorst > result.benchmarkWorst + 0.1 && spreadYou < spreadVoo;
  const verdict = smoother
    ? `Your mix grew less than VOO in most periods, but its worst case was much milder (${pct(result.userWorst)} vs. ${pct(result.benchmarkWorst)}). That's the trade-off of steadier holdings like bonds: a smoother ride for less growth.`
    : result.beatCount >= Math.ceil(n * 0.7)
      ? "Your mix did well in most periods. That's a sign of a sturdy strategy, not just one lucky draw."
      : result.beatCount <= Math.floor(n * 0.3)
        ? "Your mix usually trailed the simple index fund. If it did well in the level, that was mostly the timing."
        : "Sometimes your mix won, sometimes it lost. That's what luck looks like: the result depended on when you started.";

  return (
    <section className="card">
      <p className="text-xs font-extrabold uppercase tracking-wider text-brand">
        <Term id="luck_vs_skill">Skill or luck?</Term>
      </p>
      <h2 className="mt-1 text-xl font-black leading-tight">
        Your starting mix beat VOO in{" "}
        <span className="text-brand">
          {result.beatCount} of {n}
        </span>{" "}
        other periods
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        We replayed the exact mix you chose, bought and held for {years.toFixed(1)} years, from {n} different starting points in history.
      </p>

      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-center lg:gap-8">
      <div className="mt-4" style={{ height: 44 + n * 38 }} role="img" aria-label={`Bar chart: your mix versus VOO across ${n} start dates`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barGap={1} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke={CHART.grid} strokeDasharray="4 4" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={62} tick={{ fontSize: 11, fill: CHART.tickStrong, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={0} stroke={CHART.guide} />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
            <Bar dataKey="you" name="Your mix" fill={SERIES.user} radius={[0, 6, 6, 0]} animationDuration={900} />
            <Bar dataKey="voo" name="VOO (S&P 500)" fill={SERIES.VOO} radius={[0, 6, 6, 0]} animationDuration={900} animationBegin={300} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-2xl bg-brand-soft p-3">
          <p className="font-bold text-ink-soft">Your mix ranged</p>
          <p className="font-black tabular-nums">
            {pct(result.userWorst)} to {pct(result.userBest)}
          </p>
        </div>
        <div className="rounded-2xl bg-sun-soft p-3">
          <p className="font-bold text-ink-soft">VOO ranged</p>
          <p className="font-black tabular-nums">
            {pct(result.benchmarkWorst)} to {pct(result.benchmarkBest)}
          </p>
        </div>
      </div>
      <p className="mt-3 leading-relaxed">
        {verdict}
        {!smoother && spreadYou > spreadVoo * 1.5 && " Notice how much wider your range is: concentration makes outcomes swing far more."}
      </p>
      </div>
      </div>
    </section>
  );
}
