"use client";

import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ScoreRing } from "@/components/level/ScoreRing";
import { CHART, RING } from "@/components/level/types";
import { actionLabel, CHALLENGE, PLAN_RULES } from "@/lib/challenge/config";
import type { ChallengeView } from "@/lib/challenge/types";
import { money, pct } from "@/lib/format";
import { dayNumber } from "./useChallengeSim";

function PartBar({ label, value, max, color, note }: { label: string; value: number; max: number; color: string; note: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm font-black">
        <span style={{ color }}>{label}</span>
        <span style={{ color }} className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full" style={{ background: `${color}38` }}>
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <p className="mt-1 text-xs text-ink-faint">{note}</p>
    </div>
  );
}

export function ChallengeResults({ view }: { view: ChallengeView }) {
  const c = view.challenge;
  const r = c.result!;
  const p = r.parts;
  const beat = Math.round(r.luck.percentile * 100);
  const mine = r.luck.playerReturn;
  const playerBin = r.luck.bins.findIndex((b, i) => mine >= b.from && (mine < b.to || i === r.luck.bins.length - 1));
  const binData = r.luck.bins.map((b, i) => ({ label: pct((b.from + b.to) / 2, { decimals: 1 }), count: b.count, mine: i === playerBin }));
  const luckWord = beat >= 70 ? "a lucky draw" : beat <= 30 ? "an unlucky draw" : "pretty average luck";

  return (
    <div className="animate-rise space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/challenge" className="text-sm font-bold text-ink-faint underline">← Challenge home</Link>
        <span className="chip bg-brand-soft">{c.mode === "live" ? "Live challenge" : "Replay"} · {c.startDate} → {c.endDate}</span>
      </div>

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
          <section className="card flex flex-col items-center text-center">
            <ScoreRing
              label="Challenge"
              score={r.challengeScore}
              parts={[
                { label: "Habits", value: p.habits, max: 60, color: RING.move },
                { label: "Discipline", value: p.planKept + p.lowTrading, max: 25, color: RING.exercise },
                { label: "Reflection", value: p.reflection + p.calibration, max: 15, color: RING.stand },
              ]}
            />
            <p className="mt-3 text-sm font-extrabold uppercase tracking-wider text-ink-faint">Challenge Score</p>
            <p className="mt-1 text-ink-soft">Profit is never part of it. This is the part you controlled.</p>
          </section>

          <section className="card space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Where it came from</h2>
            <PartBar label="Habits Score × 0.6" value={p.habits} max={60} color={RING.move} note={`Your Habits Score was ${r.habits.total}/100 (diversification, composure, fees).`} />
            <PartBar
              label="Kept your rules"
              value={p.planKept}
              max={15}
              color={RING.exercise}
              note={r.violations.length === 0 ? "You kept every rule you set on day 0." : `${r.violations.length} rule${r.violations.length > 1 ? "s" : ""} broken (see below).`}
            />
            <PartBar label="Low trading" value={p.lowTrading} max={10} color={RING.exercise} note={`${r.trades} change${r.trades === 1 ? "" : "s"} made. Fewer is better.`} />
            <PartBar label="Answered check-ins" value={p.reflection} max={10} color={RING.stand} note={`${r.answered} of ${r.checkins} check-ins answered.`} />
            <PartBar
              label="Realistic expectations"
              value={p.calibration}
              max={5}
              color={RING.stand}
              note={`You guessed ${money(c.plan.guessLow)}–${money(c.plan.guessHigh)}; you ended at ${money(r.finalValue)}.`}
            />
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <p className="text-xs font-extrabold uppercase tracking-wider text-brand">The luck reveal</p>
            <h2 className="mt-1 text-xl font-black leading-tight">
              Your mix returned {pct(mine, { decimals: 1 })}. That beat <span className="text-brand">{beat}%</span> of {CHALLENGE.randomPortfolios.toLocaleString()} random portfolios.
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Over two weeks, that&apos;s {luckWord}. Short-term results mostly depend on the market&apos;s mood, which nobody controls. Your Challenge Score of{" "}
              <b className="text-ink">{r.challengeScore}</b> is what you did control.
            </p>
            <div className="mt-3 h-44" role="img" aria-label={`Histogram of random portfolio returns; you beat ${beat}% of them`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={binData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.tick, fontWeight: 700 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: CHART.tick }} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive>
                    {binData.map((b, i) => (
                      <Cell key={i} fill={b.mine ? RING.move : "#48484a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink-faint">
              Gray: random portfolios over the same days. <span style={{ color: RING.move }}>Pink: you.</span> The S&amp;P 500 did{" "}
              {pct(r.benchmarkReturnPct, { decimals: 1 })}.
            </p>
          </section>

          {c.deposit.status !== "none" && (
            <section className={`card ${c.deposit.status === "refunded_mock" ? "ring-2 ring-sun/50" : ""}`}>
              <p className="font-black">
                {c.deposit.status === "refunded_mock"
                  ? `💸 You earned your $${c.deposit.amount} back!`
                  : `💜 Your $${c.deposit.amount} goes to financial-literacy education`}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {c.deposit.status === "refunded_mock"
                  ? `Score of ${CHALLENGE.refundScore}+, every check-in answered and every rule kept. Discipline paid, not luck.`
                  : `The bar was a Challenge Score of ${CHALLENGE.refundScore}+, every check-in answered and every one of your rules kept.`}{" "}
                <b className="text-sun">Demo: no real money moved.</b>
              </p>
            </section>
          )}

          <section className="card">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your rules</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {PLAN_RULES.filter((x) => c.plan.rules.includes(x.id)).map((rule) => {
                const broken = r.violations.filter((v) => v.rule === rule.id);
                return (
                  <li key={rule.id} className="flex gap-2">
                    <span>{broken.length ? "✗" : "✓"}</span>
                    <span>
                      {rule.label}
                      {broken.map((v) => (
                        <span key={v.date} className="block text-xs text-coral">
                          Day {dayNumber(c.startDate, v.date)}: {actionLabel(v.action)}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex gap-3">
            <Link href="/challenge/leaderboard" className="btn-primary flex-1">Leaderboard</Link>
            <Link href="/challenge" className="btn-secondary flex-1">Play again</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
