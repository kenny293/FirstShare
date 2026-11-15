"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, useAuth } from "@/components/auth/AuthProvider";
import { SignInCard } from "@/components/auth/SignInCard";
import { ASSET_COLORS } from "@/components/level/types";
import { Term } from "@/components/Term";
import { CHALLENGE, CHALLENGE_ASSETS, PLAN_RULES, type RuleId } from "@/lib/challenge/config";
import { ASSETS, formatER } from "@/lib/content/assets";
import { money } from "@/lib/format";

const STEP = 100;
const TOTAL = CHALLENGE.startingCash;

/** Plain-English names for the live challenge (it isn't blind: these are real funds and companies). */
export function liveName(id: string): string {
  if (id === "CASH") return "Cash";
  if (id === "ACTV") return "Star Picker Fund (fictional, 1% fee)";
  return `${ASSETS[id].realName} (${ASSETS[id].realTicker})`;
}

export function PlanBuilder() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const mode = useSearchParams().get("mode") === "live" ? "live" : "replay";
  const [dollars, setDollars] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<RuleId[]>(["no_panic"]);
  const [note, setNote] = useState("");
  const [guessLow, setGuessLow] = useState("950");
  const [guessHigh, setGuessHigh] = useState("1050");
  const [deposit, setDeposit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div className="card mt-8 h-64 animate-pulse" />;
  if (!user) return <div className="pt-8"><SignInCard /></div>;

  const used = Object.values(dollars).reduce((s, v) => s + v, 0);
  const left = TOTAL - used;
  const set = (id: string, v: number) => setDollars({ ...dollars, [id]: Math.max(0, Math.min(v, (dollars[id] ?? 0) + left)) });
  const toggleRule = (id: RuleId) => setRules((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const allocation = Object.fromEntries(Object.entries(dollars).filter(([, d]) => d > 0).map(([id, d]) => [id, d / TOTAL]));
      const { id } = await apiFetch<{ id: string }>(user, "/api/challenges", {
        method: "POST",
        body: JSON.stringify({ mode, deposit, plan: { allocation, rules, note, guessLow: Number(guessLow), guessHigh: Number(guessHigh) } }),
      });
      router.push(`/challenge/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="animate-rise space-y-5 pt-6">
      <div>
        <Link href="/challenge" className="text-sm font-bold text-ink-faint underline">
          ← Challenge home
        </Link>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-wider text-brand">
          Day 0 · {mode === "live" ? "Live 14-day challenge" : "2-minute replay of the last two weeks"}
        </p>
        <h1 className="text-3xl font-black lg:text-4xl">Make your plan</h1>
      </div>

      <div className="space-y-5 lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:gap-8 lg:space-y-0">
        <section className="card">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black">1. Split your $1,000</h2>
              <p className="text-sm text-ink-soft">In $100 chunks. Bought at the {mode === "live" ? "latest" : "starting"} real closing prices.</p>
            </div>
            <p className={`text-2xl font-black tabular-nums ${left === 0 ? "text-brand" : ""}`}>{money(left)}</p>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
            {CHALLENGE_ASSETS.map((id, i) =>
              (dollars[id] ?? 0) > 0 ? (
                <div key={id} className="h-full transition-all" style={{ width: `${((dollars[id] ?? 0) / TOTAL) * 100}%`, background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
              ) : null,
            )}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {CHALLENGE_ASSETS.map((id, i) => {
              const a = ASSETS[id];
              const amt = dollars[id] ?? 0;
              return (
                <li key={id} className="flex items-center gap-3 py-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-tight">{liveName(id)}</p>
                    <p className="text-xs text-ink-soft">
                      <Term id={a.typeTerm}>{a.typeLabel}</Term> · <Term id="expense_ratio">fee</Term> {formatER(a.expenseRatio)}/yr
                    </p>
                  </div>
                  <button
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream text-xl font-black ring-1 ring-line disabled:opacity-30"
                    onClick={() => set(id, amt - STEP)}
                    disabled={amt === 0}
                    aria-label={`Remove $100 from ${a.realTicker}`}
                  >
                    −
                  </button>
                  <span className="w-14 text-center font-black tabular-nums">{money(amt)}</span>
                  <button
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-xl font-black text-white disabled:opacity-30"
                    onClick={() => set(id, amt + STEP)}
                    disabled={left === 0}
                    aria-label={`Add $100 to ${a.realTicker}`}
                  >
                    +
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-5">
          <section className="card space-y-3">
            <h2 className="text-xl font-black">2. Set your own rules</h2>
            <p className="text-sm text-ink-soft">You&apos;ll earn points for keeping them. Pick at least one.</p>
            {PLAN_RULES.map((r) => (
              <label key={r.id} className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-2 ${rules.includes(r.id) ? "bg-brand-soft ring-brand" : "bg-cream ring-line"}`}>
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" checked={rules.includes(r.id)} onChange={() => toggleRule(r.id)} />
                <span>
                  <span className="block font-bold">{r.label}</span>
                  <span className="block text-xs text-ink-soft">{r.hint}</span>
                </span>
              </label>
            ))}
            <textarea
              className="w-full rounded-2xl bg-cream p-3 ring-2 ring-line outline-none focus:ring-brand"
              rows={2}
              maxLength={280}
              placeholder="Anything else? e.g. I'm investing for the long run, so I'll ignore daily news."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </section>

          <section className="card space-y-3">
            <h2 className="text-xl font-black">3. Guess where you&apos;ll end up</h2>
            <p className="text-sm text-ink-soft">
              A realistic range earns a few points. A tighter range that turns out right earns more. This rewards realistic expectations, not profit.
            </p>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="text-xs font-bold text-ink-faint">Between</span>
                <input className="w-full rounded-2xl bg-cream p-3 text-lg font-black ring-2 ring-line outline-none focus:ring-brand" inputMode="numeric" value={guessLow} onChange={(e) => setGuessLow(e.target.value.replace(/[^\d]/g, ""))} />
              </label>
              <label className="flex-1">
                <span className="text-xs font-bold text-ink-faint">and</span>
                <input className="w-full rounded-2xl bg-cream p-3 text-lg font-black ring-2 ring-line outline-none focus:ring-brand" inputMode="numeric" value={guessHigh} onChange={(e) => setGuessHigh(e.target.value.replace(/[^\d]/g, ""))} />
              </label>
            </div>
          </section>

          <section className="card space-y-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" checked={deposit} onChange={(e) => setDeposit(e.target.checked)} />
              <span>
                <span className="block font-black">Put ${CHALLENGE.depositAmount} on yourself (demo)</span>
                <span className="block text-sm text-ink-soft">
                  Earn it back with a Challenge Score of {CHALLENGE.refundScore}+, every check-in answered and every one of your rules kept. Otherwise it goes to a financial-literacy
                  charity. Your return never decides it.
                </span>
                <span className="mt-1 block text-xs font-bold text-sun">Demo mode: no real payment is taken.</span>
              </span>
            </label>
          </section>

          {error && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
          <button className="btn-primary" disabled={busy || left !== 0 || rules.length === 0} onClick={submit}>
            {left !== 0 ? `Invest the remaining ${money(left)}` : busy ? "Starting…" : mode === "live" ? "Lock in my plan & start" : "Lock in my plan & start the replay"}
          </button>
        </div>
      </div>
    </div>
  );
}
