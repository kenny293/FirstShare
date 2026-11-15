"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ASSETS } from "@/lib/content/assets";
import type { LevelDef } from "@/lib/content/levels";
import { elapsedLabel, monthsBetween, weightsAt, type Market, type SimResult } from "@/lib/engine";
import { money, monthYear, pct } from "@/lib/format";
import { DecisionSheet } from "./DecisionSheet";
import { PortfolioChart } from "./PortfolioChart";
import { TREND } from "./types";
import type { RecordedDecision } from "./types";

const STEPS_PER_SECOND = 14;

export function SimScreen({
  level,
  market,
  sim,
  startIndex,
  endIndex,
  dpIndices,
  decisions,
  onDecide,
  onFinish,
}: {
  level: LevelDef;
  market: Market;
  sim: SimResult;
  startIndex: number;
  endIndex: number;
  dpIndices: number[];
  decisions: RecordedDecision[];
  onDecide: (d: RecordedDecision) => void;
  onFinish: () => void;
}) {
  const totalSteps = endIndex - startIndex;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const stepRef = useRef(0);

  const startDate = market.dates[startIndex];
  const nextDp = decisions.length < dpIndices.length ? decisions.length : -1;
  const nextDpStep = nextDp >= 0 ? dpIndices[nextDp] - startIndex : Infinity;
  const pausedAtDecision = nextDp >= 0 && step >= nextDpStep;
  const finished = step >= totalSteps;

  // Animation loop: advance the playhead, stopping at the next decision point.
  useEffect(() => {
    if (!playing || pausedAtDecision || finished) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const target = Math.min(stepRef.current + dt * STEPS_PER_SECOND * speed, nextDpStep, totalSteps);
      stepRef.current = target;
      const whole = Math.floor(target);
      setStep((s) => (s !== whole ? whole : s));
      if (target < Math.min(nextDpStep, totalSteps)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, pausedAtDecision, finished, speed, nextDpStep, totalSteps]);

  const chartData = useMemo(
    () => sim.values.slice(0, step + 1).map((value, t) => ({ t, value })),
    [sim.values, step],
  );

  const yearTicks = useMemo(() => {
    const ticks: number[] = [];
    let lastYear = -1;
    for (let t = 0; t <= totalSteps; t++) {
      const y = Math.floor(monthsBetween(startDate, market.dates[startIndex + t]) / 12);
      if (y !== lastYear) {
        ticks.push(t);
        lastYear = y;
      }
    }
    return ticks;
  }, [market.dates, startDate, startIndex, totalSteps]);

  // Clamp in case the playhead and a freshly recomputed simulation are briefly out of sync.
  const safeStep = Math.min(step, sim.values.length - 1);
  const index = startIndex + safeStep;
  const value = sim.values[safeStep] ?? sim.finalValue;
  const contributedSoFar = 1000 + sim.events.filter((e) => e.index <= index).reduce((s, e) => s + e.contribution, 0);
  const change = value / contributedSoFar - 1;
  const timeLabel = level.blind ? elapsedLabel(startDate, market.dates[index]) : monthYear(market.dates[index]);

  const peak = Math.max(...sim.growthIndex.slice(0, step + 1));
  const drawdown = 1 - sim.growthIndex[step] / peak;

  const holdings = useMemo(() => {
    const w = weightsAt(sim, market, index);
    return Object.entries(w)
      .sort((a, b) => b[1] - a[1])
      .map(([id, weight]) => ({
        id,
        weight,
        name: id === "CASH" ? "Cash" : level.blind ? ASSETS[id].blindName : ASSETS[id].realName,
        change: id === "CASH" ? 0 : market.prices[id][index] / market.prices[id][startIndex] - 1,
      }));
  }, [sim, market, index, startIndex, level.blind]);

  const markers = decisions.map((d) => ({ t: d.index - startIndex, value: sim.values[d.index - startIndex] }));

  return (
    <div className="animate-rise space-y-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
      <section className="card !px-3 !pb-2 lg:!px-5 lg:!pt-6">
        <div className="flex items-start justify-between px-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your portfolio</p>
            <p className="text-4xl font-black tabular-nums lg:text-5xl">{money(value)}</p>
            <p className="text-sm font-bold" style={{ color: change >= 0 ? TREND.up : TREND.down }}>
              {pct(change, { decimals: 1 })} vs. {money(contributedSoFar)} put in
            </p>
          </div>
          <div className="text-right">
            <p className="chip bg-sky-soft text-sky">⏱ {timeLabel}</p>
            {drawdown > 0.1 && (
              <p className="mt-2 text-xs font-bold text-coral">
                {pct(-drawdown)} from its high
              </p>
            )}
          </div>
        </div>
        <PortfolioChart data={chartData} totalSteps={totalSteps} yearTicks={yearTicks} contributed={contributedSoFar} markers={markers} />
      </section>

      <div className="flex gap-3">
        {!finished ? (
          <>
            <button className="btn-secondary !min-h-12 flex-1 !text-base" onClick={() => setPlaying((p) => !p)} disabled={pausedAtDecision}>
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              className="btn-secondary !min-h-12 !w-28 !text-base"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
              aria-label="Change playback speed"
            >
              {speed}× speed
            </button>
          </>
        ) : (
          <button className="btn-primary animate-pop" onClick={onFinish}>
            See how you did →
          </button>
        )}
      </div>
      </div>

      <section className="card !p-4 lg:sticky lg:top-24">
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">What you own right now</h2>
        <ul className="divide-y divide-line">
          {holdings.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2">
              <span className="font-bold">{h.name}</span>
              <span className="text-right text-sm tabular-nums">
                <b>{Math.round(h.weight * 100)}%</b>
                {h.id !== "CASH" && (
                  <span className="ml-2 text-ink-soft">({pct(h.change)} since start)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {pausedAtDecision && nextDp >= 0 && (
        <DecisionSheet
          key={nextDp}
          number={nextDp + 1}
          total={dpIndices.length}
          point={level.decisionPoints[nextDp]}
          timeLabel={timeLabel}
          value={value}
          contributed={contributedSoFar}
          drawdown={drawdown}
          holdings={holdings}
          onConfirm={(action, label, reasoning) => {
            onDecide({ dpIndex: nextDp, index, action, label, reasoning, drawdown, when: elapsedLabel(startDate, market.dates[index]) });
            setPlaying(true);
          }}
        />
      )}
    </div>
  );
}
