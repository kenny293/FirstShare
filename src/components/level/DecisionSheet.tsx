"use client";

import { useState } from "react";
import type { DecisionPoint } from "@/lib/content/levels";
import type { DecisionAction } from "@/lib/engine/types";
import { money, pct } from "@/lib/format";
import { Sheet } from "../Sheet";
import { RichText } from "../Term";

const MIN_REASON = 8;

export function DecisionSheet({
  number,
  total,
  point,
  timeLabel,
  value,
  contributed,
  drawdown,
  holdings,
  onConfirm,
}: {
  number: number;
  total: number;
  point: DecisionPoint;
  timeLabel: string;
  value: number;
  contributed: number;
  drawdown: number;
  holdings: { id: string; name: string; weight: number; change: number }[];
  onConfirm: (action: DecisionAction, label: string, reasoning: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const ready = choice !== null && reason.trim().length >= MIN_REASON;

  return (
    <Sheet labelledBy="decision-title">
      <p className="text-xs font-extrabold uppercase tracking-wider text-sun">
        Decision {number} of {total} · {timeLabel}
      </p>
      <h2 id="decision-title" className="mt-1 text-2xl font-black">{point.title}</h2>
      <p className="mt-2 leading-relaxed text-ink-soft">
        <RichText text={point.story} />
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-brand-soft p-3">
          <p className="text-xs font-bold text-ink-soft">Worth now</p>
          <p className="text-xl font-black tabular-nums">{money(value)}</p>
          <p className="text-xs text-ink-soft">you put in {money(contributed)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${drawdown >= 0.15 ? "bg-coral-soft" : "bg-cream"}`}>
          <p className="text-xs font-bold text-ink-soft">From its highest</p>
          <p className="text-xl font-black tabular-nums">{drawdown < 0.005 ? "At the high" : pct(-drawdown)}</p>
          <p className="text-xs text-ink-soft">so far</p>
        </div>
      </div>

      <details className="mt-3 rounded-2xl bg-cream p-3 text-sm">
        <summary className="cursor-pointer font-bold">Your holdings since the start</summary>
        <ul className="mt-2 space-y-1">
          {holdings.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span>{h.name} ({Math.round(h.weight * 100)}%)</span>
              <span className="font-bold tabular-nums">{h.id === "CASH" ? "-" : pct(h.change)}</span>
            </li>
          ))}
        </ul>
      </details>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-faint">What do you do?</legend>
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {point.options.map((o, i) => (
            <label
              key={o.action}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl p-4 ring-2 transition ${
                choice === i ? "bg-brand-soft ring-brand" : "bg-paper ring-line"
              }`}
            >
              <input
                type="radio"
                name="decision"
                className="size-5 shrink-0 accent-[var(--color-brand)]"
                checked={choice === i}
                onChange={() => setChoice(i)}
              />
              <span>
                <span className="block font-black">{o.label}</span>
                <span className="block text-sm text-ink-soft">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">Why are you making this choice?</span>
        <textarea
          className="mt-2 w-full rounded-2xl bg-cream p-4 text-base ring-2 ring-line outline-none focus:ring-brand"
          rows={3}
          maxLength={500}
          placeholder="e.g. I'm worried it will keep falling, so..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <span className="text-xs text-ink-faint">
          Your coach will read this. {reason.trim().length < MIN_REASON && "A few words is enough."}
        </span>
      </label>

      <button
        className="btn-primary mt-4"
        disabled={!ready}
        onClick={() => choice !== null && onConfirm(point.options[choice].action, point.options[choice].label, reason.trim())}
      >
        Lock it in &amp; keep going
      </button>
    </Sheet>
  );
}
