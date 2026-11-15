"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { CHALLENGE_ACTIONS, PLAN_RULES, type RuleId } from "@/lib/challenge/config";
import type { DecisionAction } from "@/lib/engine/types";

export function ActionSheet({
  kicker,
  title,
  story,
  rules,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  kicker: string;
  title: string;
  story: string;
  rules: RuleId[];
  busy: boolean;
  error: string | null;
  onConfirm: (action: DecisionAction, reasoning: string) => void;
  /** Omit to make the sheet mandatory (e.g. a replay check-in). */
  onClose?: () => void;
}) {
  const [choice, setChoice] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const ready = choice !== null && reason.trim().length >= 3 && !busy;

  return (
    <Sheet labelledBy="action-title" onClose={onClose}>
      <p className="text-xs font-extrabold uppercase tracking-wider text-sun">{kicker}</p>
      <h2 id="action-title" className="mt-1 text-2xl font-black">{title}</h2>
      <p className="mt-2 leading-relaxed text-ink-soft">{story}</p>

      <div className="mt-4 rounded-2xl bg-cream p-3 text-sm">
        <p className="font-black">Your rules from day 0</p>
        <ul className="mt-1 list-inside list-disc text-ink-soft">
          {PLAN_RULES.filter((r) => rules.includes(r.id)).map((r) => (
            <li key={r.id}>{r.label}</li>
          ))}
        </ul>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink-faint">What do you do?</legend>
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {CHALLENGE_ACTIONS.map((o) => (
            <label
              key={o.action}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl p-3 ring-2 transition ${choice === o.action ? "bg-brand-soft ring-brand" : "bg-paper ring-line"}`}
            >
              <input type="radio" name="challenge-action" className="size-5 shrink-0 accent-[var(--color-brand)]" checked={choice === o.action} onChange={() => setChoice(o.action)} />
              <span>
                <span className="block font-black">{o.label}</span>
                <span className="block text-xs text-ink-soft">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-extrabold uppercase tracking-wide text-ink-faint">Why?</span>
        <textarea
          className="mt-2 w-full rounded-2xl bg-cream p-3 text-base ring-2 ring-line outline-none focus:ring-brand"
          rows={2}
          maxLength={500}
          placeholder="e.g. My plan is for the long run, so one day doesn't change it."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {error && <p className="mt-2 rounded-2xl bg-coral-soft p-3 text-sm font-bold">{error}</p>}
      <div className="mt-3 flex gap-3">
        {onClose && (
          <button className="btn-secondary !w-auto px-5" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!ready} onClick={() => choice && onConfirm(choice, reason.trim())}>
          {busy ? "Saving…" : "Lock it in"}
        </button>
      </div>
    </Sheet>
  );
}
