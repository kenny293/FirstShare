"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/challenge/types";

export function Leaderboard() {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore a slower response for the tab you just left.
    let stale = false;
    setEntries(null);
    setError(null);
    fetch(`/api/leaderboard?mode=${mode}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn't load the leaderboard");
        if (!stale) setEntries(d.entries);
      })
      .catch((e: Error) => {
        if (!stale) setError(e.message);
      });
    return () => {
      stale = true;
    };
  }, [mode]);

  return (
    <div className="animate-rise mx-auto max-w-2xl space-y-4 pt-6">
      <Link href="/challenge" className="text-sm font-bold text-ink-faint underline">← Challenge home</Link>
      <h1 className="text-3xl font-black">Leaderboard</h1>
      <p className="text-ink-soft">Ranked by Challenge Score: discipline, not profit. The luckiest player doesn&apos;t win here; the steadiest one does.</p>
      <div className="flex gap-2" role="tablist">
        {(["live", "replay"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`chip !px-4 !py-2 !text-sm ${mode === m ? "bg-brand text-white" : "bg-paper ring-1 ring-line"}`}
            onClick={() => setMode(m)}
          >
            {m === "live" ? "Live challenges" : "Replays"}
          </button>
        ))}
      </div>
      <section className="card">
        {error && <p className="rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
        {!entries && !error && <div className="h-40 animate-pulse rounded-2xl bg-line" />}
        {entries && entries.length === 0 && <p className="text-ink-soft">No finished {mode === "live" ? "live challenges" : "replays"} yet. Be the first!</p>}
        {entries && entries.length > 0 && (
          <ol className="divide-y divide-line">
            {entries.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="w-8 text-center text-lg font-black text-ink-faint">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-black">{e.displayName}</span>
                <span className="text-xs text-ink-faint">Habits {e.habitsScore}</span>
                <span className="w-12 text-right text-xl font-black tabular-nums text-brand">{e.challengeScore}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
