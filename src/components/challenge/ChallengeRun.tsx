"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, useAuth } from "@/components/auth/AuthProvider";
import { SignInCard } from "@/components/auth/SignInCard";
import { PortfolioChart } from "@/components/level/PortfolioChart";
import { TREND } from "@/components/level/types";
import { actionLabel } from "@/lib/challenge/config";
import type { ChallengeEvent, ChallengeView } from "@/lib/challenge/types";
import type { DecisionAction } from "@/lib/engine/types";
import { money, pct } from "@/lib/format";
import { ActionSheet } from "./ActionSheet";
import { ChallengeResults } from "./ChallengeResults";
import { dayNumber, eventStory, useChallengeSim } from "./useChallengeSim";

const REPLAY_MS_PER_DAY = 1100;

export function ChallengeRun({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [view, setView] = useState<ChallengeView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const v = await apiFetch<ChallengeView>(user, `/api/challenges/${id}`);
    setView(v);
  }, [user, id]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  if (loading) return <div className="card mt-8 h-64 animate-pulse" />;
  if (!user) return <div className="pt-8"><SignInCard /></div>;
  if (error)
    return (
      <div className="card mt-8 space-y-3">
        <p className="font-black">Couldn&apos;t load this challenge</p>
        <p className="text-sm text-ink-soft">{error}</p>
        <Link href="/challenge" className="btn-secondary">Back</Link>
      </div>
    );
  if (!view) return <div className="card mt-8 h-64 animate-pulse" />;
  if (view.challenge.status === "finished") return <ChallengeResults view={view} />;
  return view.challenge.mode === "replay" ? <ReplayPlayer view={view} reload={load} /> : <LiveDashboard view={view} reload={load} />;
}

/** Posts an action and reloads; shared by both modes. */
function useActions(id: string, reload: () => Promise<void>) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = async (path: string, body?: object) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(user, `/api/challenges/${id}${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      await reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, post };
}

function Header({ view, value, contributed, dayLabel }: { view: ChallengeView; value: number; contributed: number; dayLabel: string }) {
  const change = value / contributed - 1;
  return (
    <div className="flex items-start justify-between px-2">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your practice portfolio</p>
        <p className="text-4xl font-black tabular-nums lg:text-5xl">{money(value)}</p>
        <p className="text-sm font-bold" style={{ color: change >= 0 ? TREND.up : TREND.down }}>
          {pct(change, { decimals: 1 })} vs. {money(contributed)} put in
        </p>
      </div>
      <div className="text-right">
        <p className="chip bg-sky-soft text-sky">{dayLabel}</p>
        <p className="mt-2 text-[11px] text-ink-faint">{view.dataSource}</p>
      </div>
    </div>
  );
}

function Holdings({ holdings }: { holdings: { id: string; name: string; weight: number; change: number }[] }) {
  return (
    <section className="card !p-4">
      <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">What you own right now</h2>
      <ul className="divide-y divide-line">
        {holdings.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="font-bold">{h.name}</span>
            <span className="shrink-0 tabular-nums">
              <b>{Math.round(h.weight * 100)}%</b>
              {h.id !== "CASH" && <span className="ml-2 text-ink-soft">({pct(h.change, { decimals: 1 })})</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionLog({ view }: { view: ChallengeView }) {
  const acts = view.challenge.actions;
  if (!acts.length) return null;
  return (
    <section className="card !p-4">
      <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your moves</h2>
      <ol className="space-y-2 text-sm">
        {acts.map((a, i) => (
          <li key={i} className="rounded-2xl bg-cream p-3">
            <p className="font-black">
              Day {dayNumber(view.challenge.startDate, a.date)}: {actionLabel(a.action)}
              {a.eventDate && <span className="ml-2 chip bg-sun-soft">check-in</span>}
            </p>
            <p className="mt-1 italic text-ink-soft">“{a.reasoning}”</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- replay ------------------------------------------------------------------

function ReplayPlayer({ view, reload }: { view: ChallengeView; reload: () => Promise<void> }) {
  const c = view.challenge;
  const { busy, error, setError, post } = useActions(view.id, reload);
  const [step, setStep] = useState(() => {
    // Resume where the player left off.
    const dates = Object.values(view.series)[0].map(([d]) => d);
    const lastAct = c.actions.reduce((m, a) => (a.date > m ? a.date : m), "");
    return lastAct ? Math.max(0, dates.indexOf(lastAct)) : 0;
  });
  const [changing, setChanging] = useState(false);
  const sim = useChallengeSim(view, step);
  const dates = sim.market.dates;

  const answered = useMemo(() => new Set(c.actions.map((a) => a.eventDate).filter(Boolean)), [c.actions]);
  const pending: ChallengeEvent | undefined = view.events.find((e) => e.date === dates[step] && !answered.has(e.date));
  const done = step >= sim.last;

  useEffect(() => {
    if (pending || changing || done || busy) return;
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, sim.last)), REPLAY_MS_PER_DAY);
    return () => clearTimeout(t);
  }, [step, pending, changing, done, busy, sim.last]);

  const confirm = async (action: DecisionAction, reasoning: string, eventDate?: string) => {
    const ok = await post("/actions", { action, reasoning, date: dates[step], ...(eventDate ? { eventDate } : {}) });
    if (ok) setChanging(false);
  };

  const dayLabel = `Day ${dayNumber(dates[0], dates[step])} of ${dayNumber(dates[0], dates[sim.last])}`;
  return (
    <div className="animate-rise space-y-4 pt-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/challenge" className="text-sm font-bold text-ink-faint underline">← Challenge home</Link>
          <span className="chip bg-sun-soft">⏩ Replay of {c.startDate} → {c.endDate}</span>
        </div>
        <section className="card !px-3 !pb-2 lg:!px-5 lg:!pt-6">
          <Header view={view} value={sim.value} contributed={sim.contributed} dayLabel={dayLabel} />
          <PortfolioChart data={sim.chartData} totalSteps={sim.last} yearTicks={sim.ticks} contributed={sim.contributed} markers={sim.markers} tickFormatter={sim.tickFormatter} />
        </section>
        {done ? (
          <button className="btn-primary animate-pop" disabled={busy} onClick={() => post("/finish")}>
            {busy ? "Scoring…" : "Finish & see my results →"}
          </button>
        ) : (
          <button className="btn-secondary" disabled={busy || step === 0 || Boolean(pending)} onClick={() => setChanging(true)}>
            ✋ Pause &amp; make a change
          </button>
        )}
        {error && !pending && !changing && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
      </div>
      <div className="space-y-4 lg:sticky lg:top-6">
        <Holdings holdings={sim.holdings} />
        <ActionLog view={view} />
      </div>

      {pending && (
        <ActionSheet
          key={pending.date}
          kicker={`Check-in · Day ${dayNumber(dates[0], pending.date)}`}
          {...eventStory(pending)}
          rules={c.plan.rules}
          busy={busy}
          error={error}
          onConfirm={(a, r) => confirm(a, r, pending.date)}
        />
      )}
      {changing && !pending && (
        <ActionSheet
          kicker={`Your call · Day ${dayNumber(dates[0], dates[step])}`}
          title="Make a change"
          story="Nobody's asking you to. Changes are counted, and fewer is better. Still want to?"
          rules={c.plan.rules}
          busy={busy}
          error={error}
          onConfirm={(a, r) => confirm(a, r)}
          onClose={() => {
            setChanging(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

// --- live ------------------------------------------------------------------

function LiveDashboard({ view, reload }: { view: ChallengeView; reload: () => Promise<void> }) {
  const c = view.challenge;
  const { busy, error, setError, post } = useActions(view.id, reload);
  const [sheet, setSheet] = useState<{ event?: ChallengeEvent } | null>(null);
  const sim = useChallengeSim(view, Number.MAX_SAFE_INTEGER);
  const answered = new Set(c.actions.map((a) => a.eventDate).filter(Boolean));
  const pending = view.events.filter((e) => !answered.has(e.date));
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = Math.max(0, dayNumber(today, c.endDate));

  return (
    <div className="animate-rise space-y-4 pt-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/challenge" className="text-sm font-bold text-ink-faint underline">← Challenge home</Link>
          <span className="chip bg-brand-soft">🔴 Live · ends {c.endDate}</span>
        </div>
        <section className="card !px-3 !pb-2 lg:!px-5 lg:!pt-6">
          <Header
            view={view}
            value={sim.value}
            contributed={sim.contributed}
            dayLabel={daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Final day"}
          />
          {sim.last > 0 ? (
            <PortfolioChart data={sim.chartData} totalSteps={Math.max(sim.last, 9)} yearTicks={sim.ticks} contributed={sim.contributed} markers={sim.markers} tickFormatter={sim.tickFormatter} />
          ) : (
            <p className="px-2 py-10 text-center text-ink-soft">
              You bought in at the {view.latestDate} close. Your chart starts after the next trading day closes.
            </p>
          )}
          <p className="px-2 pb-2 text-xs text-ink-faint">Prices are daily closes, latest {view.latestDate}. Any change you make uses the latest close.</p>
        </section>

        {pending.length > 0 && (
          <section className="card space-y-2 ring-2 ring-sun/40">
            <h2 className="font-black">🔔 Your coach wants to check in</h2>
            {pending.map((e) => (
              <button key={e.date} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-cream p-3 text-left" onClick={() => setSheet({ event: e })}>
                <span>
                  <span className="block font-black">{eventStory(e).title}</span>
                  <span className="block text-xs text-ink-soft">{e.date}{e.kind !== "midway" && ` · S&P 500 ${pct(e.move, { decimals: 1 })}`}</span>
                </span>
                <span className="chip bg-sun-soft">Answer →</span>
              </button>
            ))}
          </section>
        )}

        {view.canFinish ? (
          <button className="btn-primary animate-pop" disabled={busy} onClick={() => post("/finish")}>
            {busy ? "Scoring…" : "Finish & see my results →"}
          </button>
        ) : (
          <button className="btn-secondary" disabled={busy || sim.last === 0} onClick={() => setSheet({})}>
            ✋ Make a change
          </button>
        )}
        {error && !sheet && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
      </div>
      <div className="space-y-4 lg:sticky lg:top-6">
        <Holdings holdings={sim.holdings} />
        <ActionLog view={view} />
      </div>

      {sheet && (
        <ActionSheet
          kicker={sheet.event ? `Check-in · ${sheet.event.date}` : "Your call"}
          {...(sheet.event ? eventStory(sheet.event) : { title: "Make a change", story: "Nobody's asking you to. Changes are counted, and fewer is better. Still want to?" })}
          rules={c.plan.rules}
          busy={busy}
          error={error}
          onConfirm={async (action, reasoning) => {
            const ok = await post("/actions", { action, reasoning, ...(sheet.event ? { eventDate: sheet.event.date } : {}) });
            if (ok) setSheet(null);
          }}
          onClose={() => {
            setSheet(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
