"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "firstshare.progress.v1";

export interface LevelProgress {
  completed: boolean;
  bestScore: number | null;
  lastScore: number | null;
}

export type Progress = Record<number, LevelProgress>;

export function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    // Ignore anything that isn't a plain object (e.g. corrupted or old formats).
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Progress) : {};
  } catch {
    return {};
  }
}

function write(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode etc.) - progress just won't persist */
  }
}

export function recordScore(levelId: number, score: number): Progress {
  const p = readProgress();
  const prev = p[levelId] ?? { completed: false, bestScore: null, lastScore: null };
  p[levelId] = { ...prev, lastScore: score, bestScore: Math.max(prev.bestScore ?? 0, score) };
  write(p);
  return p;
}

export function markCompleted(levelId: number): Progress {
  const p = readProgress();
  const prev = p[levelId] ?? { completed: false, bestScore: null, lastScore: null };
  p[levelId] = { ...prev, completed: true };
  write(p);
  return p;
}

export function resetProgress() {
  write({});
}

export function isUnlocked(levelId: number, p: Progress): boolean {
  return levelId === 1 || Boolean(p[levelId - 1]?.completed);
}

/** Progress loaded after mount (avoids SSR/localStorage hydration mismatch). */
export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    setProgress(readProgress());
  }, []);
  const refresh = useCallback(() => setProgress(readProgress()), []);
  return { progress, refresh, setProgress };
}
