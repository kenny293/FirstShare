"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ASSETS } from "@/lib/content/assets";
import { CHASE_LOOKBACK_STEPS, chaseUniverse, getLevel } from "@/lib/content/levels";
import type { MarketPayload } from "@/lib/data";
import { computeHabitsScore, indexOnOrAfter, indexOnOrBefore, runSimulation, type Market } from "@/lib/engine";
import { isUnlocked, readProgress } from "@/lib/progress";
import { AllocateScreen } from "./AllocateScreen";
import { IntroScreen } from "./IntroScreen";
import { ResultsScreen } from "./ResultsScreen";
import { RevealScreen } from "./RevealScreen";
import { SimScreen } from "./SimScreen";
import { TakeawayScreen } from "./TakeawayScreen";
import type { RecordedDecision } from "./types";

type Phase = "intro" | "allocate" | "sim" | "results" | "reveal" | "takeaway";

const STEPS: { label: string; phases: Phase[] }[] = [
  { label: "Intro", phases: ["intro"] },
  { label: "Simulate", phases: ["allocate", "sim"] },
  { label: "Coach", phases: ["results"] },
  { label: "Reveal", phases: ["reveal"] },
  { label: "Takeaway", phases: ["takeaway"] },
];

export const STARTING_CASH = 1000;

function hydrate(payload: MarketPayload): Market {
  const prices: Market["prices"] = {};
  for (const [id, arr] of Object.entries(payload.prices)) prices[id] = arr.map((p) => (p === null ? NaN : p));
  return { dates: payload.dates, prices };
}

export function LevelPlayer({ levelId, market: payload }: { levelId: number; market: MarketPayload }) {
  const level = getLevel(levelId)!;
  const market = useMemo(() => hydrate(payload), [payload]);
  const isPlaceholder = Object.values(payload.sources).some((s) => s !== "yfinance");

  const [locked, setLocked] = useState<boolean | null>(null);
  useEffect(() => {
    setLocked(!isUnlocked(levelId, readProgress()));
  }, [levelId]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [dollars, setDollars] = useState<Record<string, number>>({});
  const [decisions, setDecisions] = useState<RecordedDecision[]>([]);

  const startIndex = useMemo(() => indexOnOrAfter(market, level.start), [market, level.start]);
  const endIndex = useMemo(() => indexOnOrBefore(market, level.end), [market, level.end]);
  const dpIndices = useMemo(
    () => level.decisionPoints.map((dp) => Math.max(startIndex + 1, indexOnOrBefore(market, dp.date))),
    [market, level.decisionPoints, startIndex],
  );

  const allocation = useMemo(() => {
    const w: Record<string, number> = {};
    for (const [id, d] of Object.entries(dollars)) if (d > 0) w[id] = d / STARTING_CASH;
    return w;
  }, [dollars]);

  const sim = useMemo(() => {
    if (Object.keys(allocation).length === 0) return null;
    return runSimulation({
      market,
      startIndex,
      endIndex,
      initialAmount: STARTING_CASH,
      allocation,
      decisions: decisions.map((d) => ({ index: d.index, action: d.action })),
      universe: chaseUniverse(level),
      chaseLookback: CHASE_LOOKBACK_STEPS,
      feeSwaps: level.feeSwaps,
    });
  }, [market, startIndex, endIndex, allocation, decisions, level]);

  const score = useMemo(() => (sim && phase !== "sim" ? computeHabitsScore(sim, ASSETS) : null), [sim, phase]);

  // Braces matter: newer browsers return a Promise from scrollTo, and React
  // would try to call an effect's return value as a cleanup function.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  if (locked) {
    return (
      <div className="pt-16 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="mt-4 text-2xl font-black">Level {levelId} is locked</h1>
        <p className="mt-2 text-ink-soft">Finish level {levelId - 1} first to unlock it.</p>
        <Link href="/" className="btn-primary mt-8">Back to map</Link>
      </div>
    );
  }

  const stepIdx = STEPS.findIndex((s) => s.phases.includes(phase));
  const restart = () => {
    setDecisions([]);
    setPhase("allocate");
  };

  return (
    <div className="pt-4">
      <nav className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 bg-cream/90 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <Link href="/" className="grid size-11 place-items-center rounded-full bg-paper text-xl ring-1 ring-line" aria-label="Back to level map">
          ✕
        </Link>
        <ol className="flex flex-1 gap-1.5" aria-label="Level progress">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex-1" aria-current={i === stepIdx ? "step" : undefined}>
              <div className={`h-2.5 rounded-full transition-colors ${i <= stepIdx ? "bg-brand" : "bg-line"}`} />
              <span className={`mt-1 block text-center text-[10px] font-bold ${i === stepIdx ? "text-brand" : "text-ink-faint"}`}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {phase === "intro" && <IntroScreen level={level} onNext={() => setPhase("allocate")} />}

      {phase === "allocate" && (
        <AllocateScreen
          level={level}
          dollars={dollars}
          total={STARTING_CASH}
          onChange={setDollars}
          onStart={() => {
            setDecisions([]);
            setPhase("sim");
          }}
        />
      )}

      {phase === "sim" && sim && (
        <SimScreen
          level={level}
          market={market}
          sim={sim}
          startIndex={startIndex}
          endIndex={endIndex}
          dpIndices={dpIndices}
          decisions={decisions}
          onDecide={(d) => setDecisions((prev) => [...prev, d])}
          onFinish={() => setPhase("results")}
        />
      )}

      {phase === "results" && sim && score && (
        <ResultsScreen
          level={level}
          sim={sim}
          score={score}
          allocation={allocation}
          decisions={decisions}
          onNext={() => setPhase("reveal")}
          onRetry={restart}
        />
      )}

      {phase === "reveal" && sim && score && (
        <RevealScreen
          level={level}
          market={market}
          sim={sim}
          score={score}
          allocation={allocation}
          startIndex={startIndex}
          endIndex={endIndex}
          decisions={decisions}
          isPlaceholder={isPlaceholder}
          onNext={() => setPhase("takeaway")}
        />
      )}

      {phase === "takeaway" && <TakeawayScreen level={level} onRetry={restart} />}
    </div>
  );
}
