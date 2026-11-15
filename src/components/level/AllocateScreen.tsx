"use client";

import { ASSETS, formatER } from "@/lib/content/assets";
import type { LevelDef } from "@/lib/content/levels";
import { money } from "@/lib/format";
import { Term } from "../Term";
import { ASSET_COLORS } from "./types";

const STEP = 100;

export function AllocateScreen({
  level,
  dollars,
  total,
  onChange,
  onStart,
}: {
  level: LevelDef;
  dollars: Record<string, number>;
  total: number;
  onChange: (d: Record<string, number>) => void;
  onStart: () => void;
}) {
  const used = Object.values(dollars).reduce((s, v) => s + v, 0);
  const left = total - used;
  const set = (id: string, v: number) => onChange({ ...dollars, [id]: Math.max(0, Math.min(v, (dollars[id] ?? 0) + left)) });

  return (
    <div className="animate-rise">
      <div className="sticky top-[74px] z-20 -mx-4 bg-cream/95 px-4 pb-3 pt-1 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black">Build your mix</h1>
            <p className="text-sm text-ink-soft">Split your $1,000 in $100 chunks.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-ink-faint">Left</p>
            <p className={`text-2xl font-black tabular-nums ${left === 0 ? "text-brand" : ""}`}>{money(left)}</p>
          </div>
        </div>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-line" aria-hidden>
          {level.assets.map((id, i) =>
            (dollars[id] ?? 0) > 0 ? (
              <div
                key={id}
                className="h-full transition-all duration-300"
                style={{ width: `${((dollars[id] ?? 0) / total) * 100}%`, background: ASSET_COLORS[i % ASSET_COLORS.length] }}
              />
            ) : null,
          )}
        </div>
      </div>

      <ul className="mt-2 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {level.assets.map((id, i) => {
          const a = ASSETS[id];
          const amt = dollars[id] ?? 0;
          return (
            <li key={id} className={`card !p-4 transition ${amt > 0 ? "ring-2 !ring-brand/40" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black leading-tight">{a.blindName}</p>
                  <p className="text-sm text-ink-soft">{a.blindDescription}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="chip bg-brand-soft">
                      <Term id={a.typeTerm}>{a.typeLabel}</Term>
                    </span>
                    <span className={`chip ${a.expenseRatio >= 0.005 ? "bg-coral-soft" : "bg-cream"}`}>
                      <Term id="expense_ratio">Fee</Term>: {formatER(a.expenseRatio)}/yr
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  className="grid size-12 place-items-center rounded-2xl bg-cream text-2xl font-black ring-1 ring-line disabled:opacity-30"
                  onClick={() => set(id, amt - STEP)}
                  disabled={amt === 0}
                  aria-label={`Remove $100 from ${a.blindName}`}
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <p className="text-xl font-black tabular-nums">{money(amt)}</p>
                  <p className="text-xs text-ink-faint">{Math.round((amt / total) * 100)}% of your money</p>
                </div>
                <button
                  className="grid size-12 place-items-center rounded-2xl bg-brand text-2xl font-black text-white disabled:opacity-30"
                  onClick={() => set(id, amt + STEP)}
                  disabled={left === 0}
                  aria-label={`Add $100 to ${a.blindName}`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-cream via-cream to-transparent px-4 pb-4 pt-6 lg:-mx-8 lg:px-8">
        <button className="btn-primary lg:mx-auto lg:flex lg:max-w-md" disabled={left !== 0} onClick={onStart}>
          {left === 0 ? "Start the clock ▶" : `Invest the remaining ${money(left)}`}
        </button>
      </div>
    </div>
  );
}
