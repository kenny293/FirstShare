"use client";

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ASSETS } from "@/lib/content/assets";
import type { LevelDef } from "@/lib/content/levels";
import { runBenchmark, type HabitsScore, type Market, type SimResult, type Weights } from "@/lib/engine";
import { money, monthYear, pct } from "@/lib/format";
import { RichText, Term } from "../Term";
import { SkillVsLuck } from "./SkillVsLuck";
import { CHART, SERIES, type RecordedDecision } from "./types";

export function RevealScreen({
  level,
  market,
  sim,
  score,
  allocation,
  startIndex,
  endIndex,
  decisions,
  isPlaceholder,
  onNext,
}: {
  level: LevelDef;
  market: Market;
  sim: SimResult;
  score: HabitsScore;
  allocation: Weights;
  startIndex: number;
  endIndex: number;
  decisions: RecordedDecision[];
  isPlaceholder: boolean;
  onNext: () => void;
}) {
  const voo = useMemo(() => runBenchmark(market, "VOO", startIndex, endIndex, 1000, sim.events), [market, startIndex, endIndex, sim.events]);
  const qqqm = useMemo(() => runBenchmark(market, "QQQM", startIndex, endIndex, 1000, sim.events), [market, startIndex, endIndex, sim.events]);

  const chartData = useMemo(
    () => sim.dates.map((date, i) => ({ date, you: Math.round(sim.values[i]), VOO: Math.round(voo.values[i]), QQQM: Math.round(qqqm.values[i]) })),
    [sim, voo, qqqm],
  );
  const yearTicks = useMemo(() => {
    const t: string[] = [];
    let y = "";
    for (const d of sim.dates) if (d.slice(0, 4) !== y) { y = d.slice(0, 4); t.push(d); }
    return t;
  }, [sim.dates]);

  const rows = [
    { key: "you", label: "You", sim, color: SERIES.user },
    { key: "VOO", label: "VOO", term: "sp500" as const, sim: voo, color: SERIES.VOO },
    { key: "QQQM", label: "QQQM", term: "nasdaq100" as const, sim: qqqm, color: SERIES.QQQM },
  ];
  const beatBoth = sim.finalValue > voo.finalValue && sim.finalValue > qqqm.finalValue;
  const owned = new Set(Object.keys(allocation));
  const fictional = level.assets
    .filter((id) => ASSETS[id].realTicker === "(fictional)")
    .map((id) => `"${ASSETS[id].blindName.replace(/^Fund \d+: /, "")}"`);
  const years = (endIndex - startIndex) / 52.18;

  return (
    <div className="animate-rise space-y-4">
      <header className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-wider text-brand">The reveal</p>
        <h1 className="mt-1 text-2xl font-black leading-tight lg:text-4xl">{level.reveal.periodName}</h1>
      </header>

      <div className="space-y-4 lg:grid lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
      <section className="card">
        <p className="leading-relaxed">
          <RichText text={level.reveal.whatHappened} />
        </p>
      </section>

      <section className="card">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Who was who</h2>
        <ul className="mt-2 divide-y divide-line">
          {level.assets.map((id) => {
            const a = ASSETS[id];
            const r = market.prices[id][endIndex] / market.prices[id][startIndex] - 1;
            return (
              <li key={id} className={`flex items-center justify-between gap-3 py-2.5 ${owned.has(id) ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">{a.blindName}{owned.has(id) && " · you owned this"}</p>
                  <p className="font-black leading-tight">
                    {a.realName} <span className="text-ink-faint">{a.realTicker.startsWith("(") ? "" : a.realTicker}</span>
                  </p>
                </div>
                <span className="shrink-0 font-black tabular-nums">{pct(r)}</span>
              </li>
            );
          })}
        </ul>
      </section>
      </div>

      <section className="card !px-2">
        <h2 className="px-3 text-xs font-extrabold uppercase tracking-wide text-ink-faint">
          You vs. two simple <Term id="index_fund">index funds</Term>
        </h2>
        <div className="mt-2 h-64 lg:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="4 4" />
              <XAxis dataKey="date" ticks={yearTicks} tickFormatter={(d: string) => d.slice(0, 4)} tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis width={48} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 700 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => money(typeof v === "number" ? v : Number(v))} labelFormatter={(d: string) => monthYear(d)} contentStyle={CHART.tooltip} labelStyle={{ color: CHART.tickStrong }} cursor={{ stroke: CHART.guide }} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              <Line type="monotone" dataKey="you" name="You" stroke={SERIES.user} strokeWidth={3} dot={false} animationDuration={1500} />
              <Line type="monotone" dataKey="VOO" stroke={SERIES.VOO} strokeWidth={2} dot={false} animationDuration={1500} animationBegin={400} />
              <Line type="monotone" dataKey="QQQM" stroke={SERIES.QQQM} strokeWidth={2} dot={false} strokeDasharray="6 3" animationDuration={1500} animationBegin={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-faint">
              <th className="px-3 py-1 font-extrabold" />
              <th className="py-1 text-right font-extrabold">Final</th>
              <th className="px-3 py-1 text-right font-extrabold">Return</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-3 py-2 font-black">
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: r.color }} />
                  {r.term ? <Term id={r.term}>{r.label}</Term> : r.label}
                </td>
                <td className="py-2 text-right font-bold tabular-nums">{money(r.sim.finalValue)}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{pct(r.sim.returnPct, { decimals: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {decisions.some((d) => d.action === "buy_more") && (
          <p className="px-3 pt-2 text-xs text-ink-faint">The index funds got the same extra $200 deposits at the same moments, to keep it fair.</p>
        )}
        {beatBoth && score.outcome === "lucky" && (
          <p className="mx-3 mt-3 rounded-2xl bg-sun-soft p-3 text-sm">
            🍀 You beat both index funds, but with a risky strategy, so we call this <b>lucky</b>, not skilled. Let&apos;s test it below.
          </p>
        )}
      </section>
      </div>

      <SkillVsLuck market={market} allocation={allocation} durationSteps={endIndex - startIndex} years={years} />

      <p className="px-1 text-xs leading-relaxed text-ink-faint">
        Prices include dividends. VOO launched in 2010 and QQQM in 2020; earlier dates use the S&amp;P 500 (SPY) and
        Nasdaq-100 (QQQ) funds they track. {fictional.length > 0 && ` ${fictional.join(" and ")} ${fictional.length > 1 ? "are made-up funds" : "is a made-up fund"}: the whole-market fund minus a bigger yearly fee.`}
        {isPlaceholder && " ⚠️ This build is using placeholder sample data shaped like real history. Run scripts/fetch-data.py for real prices."}
      </p>

      <button className="btn-primary lg:mx-auto lg:flex lg:max-w-md" onClick={onNext}>
        What&apos;s the lesson? →
      </button>
    </div>
  );
}
