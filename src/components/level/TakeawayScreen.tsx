"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS, type LevelDef } from "@/lib/content/levels";
import { markCompleted } from "@/lib/progress";

export function TakeawayScreen({ level, onRetry }: { level: LevelDef; onRetry: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null]);
  const allCorrect = level.takeaway.questions.every((q, i) => answers[i] === q.correct);
  const next = LEVELS.find((l) => l.id === level.id + 1);

  useEffect(() => {
    if (allCorrect) markCompleted(level.id);
  }, [allCorrect, level.id]);

  return (
    <div className="animate-rise space-y-4 lg:mx-auto lg:max-w-5xl">
      <section className="rounded-3xl bg-brand p-6 text-white shadow-[0_4px_0_0_var(--color-brand-dark)] lg:p-8">
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">Today&apos;s lesson</p>
        <p className="mt-2 text-xl font-black leading-snug lg:text-3xl">{level.takeaway.lesson}</p>
      </section>

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      {level.takeaway.questions.map((q, qi) => {
        const picked = answers[qi];
        const correct = picked === q.correct;
        return (
          <section key={qi} className="card">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Question {qi + 1} of 2</p>
            <h2 className="mt-1 text-lg font-black leading-snug">{q.question}</h2>
            <div className="mt-3 space-y-2">
              {q.options.map((o, oi) => {
                const isPicked = picked === oi;
                const style = isPicked
                  ? correct
                    ? "bg-brand-soft ring-brand"
                    : "bg-coral-soft ring-coral"
                  : "bg-paper ring-line";
                return (
                  <button
                    key={oi}
                    className={`flex min-h-14 w-full items-center rounded-2xl px-4 py-3 text-left font-bold ring-2 transition disabled:cursor-default ${style}`}
                    onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                    disabled={correct}
                    aria-pressed={isPicked}
                  >
                    {o}
                    {isPicked && <span className="ml-auto pl-2">{correct ? "✓" : "↺"}</span>}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <p className={`mt-3 animate-rise rounded-2xl p-3 text-sm ${correct ? "bg-brand-soft" : "bg-coral-soft"}`}>
                {correct ? "Exactly! " : "Not quite. Try again! "}
                {correct && q.explanation}
              </p>
            )}
          </section>
        );
      })}
      </div>

      {allCorrect ? (
        <section className="card animate-pop text-center lg:mx-auto lg:max-w-md">
          <p className="text-5xl">🎉</p>
          <p className="mt-2 text-xl font-black">Level {level.id} complete!</p>
          {next && <p className="text-ink-soft">Level {next.id}, &quot;{next.title},&quot; is unlocked.</p>}
          <div className="mt-4 space-y-3">
            {next ? (
              <Link href={`/level/${next.id}`} className="btn-primary">
                Play level {next.id} →
              </Link>
            ) : null}
            <Link href="/" className={next ? "btn-secondary" : "btn-primary"}>
              Back to map
            </Link>
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-ink-faint">Answer both questions to unlock the next level.</p>
      )}
      <button className="mx-auto block text-sm font-bold text-ink-faint underline" onClick={onRetry}>
        Replay this level with a different mix
      </button>
    </div>
  );
}
