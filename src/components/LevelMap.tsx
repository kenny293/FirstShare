"use client";

import Link from "next/link";
import { isUnlocked, resetProgress, useProgress } from "@/lib/progress";

interface LevelSummary {
  id: number;
  title: string;
  concept: string;
  emoji: string;
}


export function LevelMap({ levels }: { levels: LevelSummary[] }) {
  const { progress, refresh } = useProgress();
  const p = progress ?? {};
  const totalDone = levels.filter((l) => p[l.id]?.completed).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between rounded-2xl bg-paper px-4 py-3 ring-1 ring-line">
        <span className="text-sm font-bold text-ink-soft">Your progress</span>
        <span className="text-sm font-black">
          {totalDone} / {levels.length} levels
        </span>
      </div>

      <ol className="relative flex flex-col gap-5">
        {/* the path */}
        <div className="absolute bottom-10 left-1/2 top-10 -z-0 w-1.5 -translate-x-1/2 rounded-full bg-line" aria-hidden />
        {levels.map((level, i) => {
          const unlocked = progress ? isUnlocked(level.id, p) : level.id === 1;
          const lp = p[level.id];
          const offset = i % 2 === 0 ? "self-start" : "self-end";
          const node = (
            <div
              className={`relative z-10 w-[78%] rounded-3xl p-4 transition ${
                unlocked
                  ? "bg-paper ring-2 ring-brand/20 shadow-[0_4px_0_0_var(--color-line)] active:translate-y-0.5"
                  : "border-2 border-dashed border-line bg-cream opacity-70"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-14 shrink-0 place-items-center rounded-2xl text-2xl ${
                    lp?.completed ? "bg-sun-soft" : unlocked ? "bg-brand-soft" : "bg-line/60"
                  }`}
                >
                  {unlocked ? level.emoji : "🔒"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                    Level {level.id} · {level.concept}
                  </p>
                  <p className="truncate text-lg font-black leading-tight">{level.title}</p>
                  {lp?.bestScore != null ? (
                    <p className="mt-0.5 text-sm font-bold text-brand">Habits Score {lp.bestScore}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {unlocked ? "Tap to play" : `Finish level ${level.id - 1} to unlock`}
                    </p>
                  )}
                </div>
                {lp?.completed && <span className="ml-auto text-xl" aria-label="completed">⭐</span>}
              </div>
            </div>
          );
          return (
            <li key={level.id} className={`flex ${offset} w-full ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              {unlocked ? (
                <Link href={`/level/${level.id}`} className="contents" aria-label={`Play level ${level.id}: ${level.title}`}>
                  {node}
                </Link>
              ) : (
                node
              )}
            </li>
          );
        })}
      </ol>

      {totalDone > 0 && (
        <button
          className="mx-auto mt-8 block text-sm font-bold text-ink-faint underline"
          onClick={() => {
            if (confirm("Reset all progress and scores?")) {
              resetProgress();
              refresh();
            }
          }}
        >
          Reset progress
        </button>
      )}
    </div>
  );
}
