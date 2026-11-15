"use client";

import { useEffect, useRef, useState } from "react";
import type { CoachRequest, CoachResponse } from "@/lib/coach";
import { ASSETS } from "@/lib/content/assets";
import { COACH_FALLBACKS } from "@/lib/content/coachFallbacks";
import type { LevelDef } from "@/lib/content/levels";
import type { HabitsScore, SimResult, Weights } from "@/lib/engine";
import { money, pct } from "@/lib/format";
import { recordScore } from "@/lib/progress";
import { Term } from "../Term";
import { MISTAKE_LABELS, OUTCOME_COPY } from "./outcome";
import { ScoreRing, habitsRings } from "./ScoreRing";
import { RING, type RecordedDecision } from "./types";

export function buildCoachRequest(
  level: LevelDef,
  sim: SimResult,
  score: HabitsScore,
  allocation: Weights,
  decisions: RecordedDecision[],
): CoachRequest {
  const name = (id: string) => (level.blind ? ASSETS[id].blindName : ASSETS[id].realName);
  return {
    levelTitle: level.title,
    concept: level.concept,
    startingAmount: 1000,
    totalContributed: sim.totalContributed,
    finalValue: sim.finalValue,
    returnPct: sim.returnPct * 100,
    maxDrawdownPct: sim.maxDrawdown * 100,
    habitsScore: score.total,
    diversificationPoints: score.diversification,
    composurePoints: score.composure,
    feePoints: score.fees,
    biggestSingleCompanyOrIndustryPct: score.detail.diversification.maxSingleExposure * 100,
    averageFeePct: score.detail.averageExpenseRatio * 100,
    outcome: score.outcome,
    detectedMistakes: score.mistakes,
    holdings: Object.entries(allocation).map(([id, w]) => ({
      name: name(id),
      description: ASSETS[id].blindDescription,
      startingPct: w * 100,
    })),
    decisions: decisions.map((d) => ({
      when: d.when,
      situation: level.decisionPoints[d.dpIndex].title,
      portfolioDownFromPeakPct: d.drawdown * 100,
      choice: d.label,
      reasoning: d.reasoning,
    })),
  };
}

function Bar({ label, term, value, max, color }: { label: string; term: Parameters<typeof Term>[0]["id"]; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <Term id={term}>{label}</Term>
        <span className="font-black tabular-nums" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full" style={{ background: `${color}38` }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function ResultsScreen({
  level,
  sim,
  score,
  allocation,
  decisions,
  onNext,
  onRetry,
}: {
  level: LevelDef;
  sim: SimResult;
  score: HabitsScore;
  allocation: Weights;
  decisions: RecordedDecision[];
  onNext: () => void;
  onRetry: () => void;
}) {
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const requested = useRef(false);
  const outcome = OUTCOME_COPY[score.outcome];

  useEffect(() => {
    recordScore(level.id, score.total);
  }, [level.id, score.total]);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const body = buildCoachRequest(level, sim, score, allocation, decisions);
    fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: CoachResponse) => setCoach(data))
      .catch(() => setCoach({ ...COACH_FALLBACKS[score.primaryMistake], source: "fallback", fallbackReason: "couldn't reach server" }));
  }, [level, sim, score, allocation, decisions]);

  return (
    <div className="animate-rise space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
      <section className="card flex flex-col items-center text-center">
        <ScoreRing score={score.total} parts={habitsRings(score)} />
        <p className="mt-3 text-ink-soft">
          Final value <b className="text-ink">{money(sim.finalValue)}</b> ({pct(sim.returnPct, { decimals: 1 })} on {money(sim.totalContributed)})
        </p>
        <div className={`mt-4 w-full rounded-2xl p-4 text-left ${outcome.tone}`}>
          <p className="text-lg font-black">
            {outcome.badge} {outcome.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{outcome.body}</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Where your score came from</h2>
        <Bar label="Diversification" term="diversification" value={score.diversification} max={50} color={RING.move} />
        <Bar label="Composure" term="panic_selling" value={score.composure} max={30} color={RING.exercise} />
        <Bar label="Low fees" term="expense_ratio" value={score.fees} max={20} color={RING.stand} />
        <div className="flex flex-wrap gap-2 pt-1">
          {score.mistakes.map((m) => (
            <span key={m} className={`chip ${m === "none" ? "bg-brand-soft" : "bg-coral-soft"}`}>
              {MISTAKE_LABELS[m]}
            </span>
          ))}
        </div>
        <p className="text-xs text-ink-faint">Your score is about habits, not profit. Making money doesn&apos;t raise it.</p>
      </section>
      </div>

      <div className="space-y-4">

      <section className="card">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-sun-soft text-2xl">🦉</div>
          <div>
            <p className="font-black">Coach Ollie</p>
            <p className="text-xs text-ink-faint">
              {!coach
                ? "Reading your choices…"
                : coach.source === "ai"
                  ? `AI coach · ${coach.model ?? "Gemini"}`
                  : `Coach notes · fallback: ${coach.fallbackReason ?? "coach unavailable"}`}
            </p>
          </div>
        </div>
        {coach ? (
          <div className="mt-4 animate-rise space-y-3">
            <p className="text-lg leading-relaxed">{coach.feedback}</p>
            <p className="rounded-2xl bg-brand-soft p-4 font-bold">💜 {coach.encouragement}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2" aria-busy="true">
            <div className="h-4 w-full animate-pulse rounded bg-line" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-line" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          </div>
        )}
      </section>

      {decisions.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your decisions</h2>
          <ol className="mt-2 space-y-3">
            {decisions.map((d) => (
              <li key={d.dpIndex} className="rounded-2xl bg-cream p-3 text-sm">
                <p className="font-black">
                  {level.decisionPoints[d.dpIndex].title}: {d.label}
                </p>
                <p className="text-ink-soft">
                  {d.when} · portfolio {d.drawdown < 0.005 ? "at its high" : `${pct(-d.drawdown)} from its high`}
                </p>
                <p className="mt-1 italic">“{d.reasoning}”</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="space-y-4">
        <button className="btn-primary" onClick={onNext}>
          Reveal what really happened 👀
        </button>
        <button className="btn-secondary" onClick={onRetry}>
          Try a different mix
        </button>
      </div>
      </div>
    </div>
  );
}
