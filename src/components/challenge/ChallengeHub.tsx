"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/auth/AuthProvider";
import { SignInCard } from "@/components/auth/SignInCard";

interface MyChallenge {
  id: string;
  mode: "live" | "replay";
  status: "active" | "finished";
  startDate: string;
  endDate: string;
  challengeScore: number | null;
}

export function UserBar() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const name = user.displayName || user.email || (user.isAnonymous ? "Guest" : "Player");
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-2.5 ring-1 ring-line">
      <span className="truncate text-sm font-bold text-ink-soft">
        Signed in as <span className="text-ink">{name}</span>
        {user.isAnonymous && " (guest)"}
      </span>
      <button className="shrink-0 text-sm font-bold text-ink-faint underline" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

export function ChallengeHub() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<MyChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMine(null);
      return;
    }
    apiFetch<{ challenges: MyChallenge[] }>(user, "/api/challenges")
      .then((d) => setMine(d.challenges))
      .catch((e: Error) => setError(e.message));
  }, [user]);

  return (
    <div className="animate-rise space-y-5 pt-6 lg:grid lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-10 lg:space-y-0 lg:pt-12">
      <header className="space-y-4">
        <Link href="/" className="text-sm font-bold text-ink-faint underline">
          ← Back to levels
        </Link>
        <p className="text-sm font-extrabold uppercase tracking-wider text-brand">Live challenge</p>
        <h1 className="text-4xl font-black leading-tight lg:text-5xl">Steady Hands Challenge</h1>
        <p className="text-lg text-ink-soft">
          14 days. Real, live market prices. $1,000 of practice money. You&apos;re scored on <b className="text-ink">discipline</b>, never on
          profit, and at the end we show how much of your result was luck.
        </p>
        <ol className="space-y-3">
          {[
            ["Day 0: make a plan", "Pick a mix, write your own rules, and guess where you'll end up."],
            ["Days 1–14: stay steady", "When the market makes a big move, your coach checks in. Holding is often the right answer."],
            ["Day 14: the luck reveal", "Your return vs. 1,000 random portfolios, next to the score you actually controlled."],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft font-black text-brand">{i + 1}</span>
              <div>
                <p className="font-black">{t}</p>
                <p className="text-sm text-ink-soft">{b}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/challenge/leaderboard" className="inline-block font-bold text-brand underline">
          See the leaderboard (ranked by discipline) →
        </Link>
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="card h-48 animate-pulse" />
        ) : !user ? (
          <SignInCard subtitle="Your challenges and leaderboard spot are saved to your account." />
        ) : (
          <>
            <UserBar />
            <section className="card space-y-3">
              <h2 className="text-xl font-black">Start a challenge</h2>
              <Link href="/challenge/new?mode=live" className="btn-primary">
                Start the live 14-day challenge
              </Link>
              <Link href="/challenge/new?mode=replay" className="btn-secondary">
                ⏩ Try the 2-minute replay
              </Link>
              <p className="text-xs text-ink-faint">
                The replay plays back the last two weeks of real prices so you can try it right now. It has its own leaderboard.
              </p>
            </section>

            <section className="card">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Your challenges</h2>
              {error && <p className="mt-2 rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
              {!mine && !error && <div className="mt-3 h-12 animate-pulse rounded-2xl bg-line" />}
              {mine && mine.length === 0 && <p className="mt-2 text-sm text-ink-soft">None yet. Start one above!</p>}
              {mine && mine.length > 0 && (
                <ul className="mt-2 divide-y divide-line">
                  {mine.map((c) => (
                    <li key={c.id}>
                      <Link href={`/challenge/${c.id}`} className="flex items-center justify-between gap-3 py-3">
                        <span>
                          <span className="block font-black">{c.mode === "live" ? "Live challenge" : "Replay"}</span>
                          <span className="block text-xs text-ink-soft">
                            {c.startDate} → {c.endDate}
                          </span>
                        </span>
                        <span className={`chip ${c.status === "finished" ? "bg-brand-soft" : "bg-sky-soft text-sky"}`}>
                          {c.status === "finished" ? `Score ${c.challengeScore}` : "In progress"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
