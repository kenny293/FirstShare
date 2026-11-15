"use client";

import { useEffect, useState } from "react";
import { RING } from "./types";

export interface RingPart {
  label: string;
  value: number;
  max: number;
  color: string;
}

/** The three Habits Score parts as Apple Fitness-style concentric rings. */
export function habitsRings(score: { diversification: number; composure: number; fees: number }): RingPart[] {
  return [
    { label: "Diversification", value: score.diversification, max: 50, color: RING.move },
    { label: "Composure", value: score.composure, max: 30, color: RING.exercise },
    { label: "Low fees", value: score.fees, max: 20, color: RING.stand },
  ];
}

function useCountUp(target: number, durationMs = 1200) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return t;
}

export function ScoreRing({ score, parts, size = 200, label = "Habits" }: { score: number; parts: RingPart[]; size?: number; label?: string }) {
  const progress = useCountUp(score);
  const stroke = 18;
  const gap = 4;
  const center = 100;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} Score ${score} out of 100. ${parts.map((p) => `${p.label} ${p.value} of ${p.max}`).join(", ")}.`}
    >
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        {parts.map((part, i) => {
          const r = center - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const frac = part.max > 0 ? (part.value / part.max) * progress : 0;
          return (
            <g key={part.label}>
              <circle cx={center} cy={center} r={r} fill="none" stroke={part.color} strokeOpacity={0.22} strokeWidth={stroke} />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={part.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - Math.max(frac, 0.001))}
                style={{ filter: `drop-shadow(0 0 6px ${part.color}66)` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-black tabular-nums leading-none">{Math.round(score * progress)}</p>
          <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">{label}</p>
        </div>
      </div>
    </div>
  );
}
