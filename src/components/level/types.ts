import type { DecisionAction } from "@/lib/engine/types";

export interface RecordedDecision {
  /** Which of the level's decision points this answers. */
  dpIndex: number;
  /** Market index where it happens. */
  index: number;
  action: DecisionAction;
  label: string;
  reasoning: string;
  /** Portfolio drawdown from peak when deciding, 0..1 */
  drawdown: number;
  /** Blind-mode time label ("Year 2, Month 6"). */
  when: string;
}

/** Apple Fitness ring colours. */
export const RING = { move: "#fa114f", exercise: "#a6ff00", stand: "#00d8fe" } as const;

/** Series colours for allocations (ring colours first, then Apple system colours). */
export const ASSET_COLORS = [RING.move, RING.exercise, RING.stand, "#bf5af2", "#ff9f0a", "#64d2ff", "#ffd60a", "#ff375f"];
export const SERIES = { user: RING.move, VOO: RING.exercise, QQQM: RING.stand } as const;

/** Up/down colors for the live simulation line (Apple system green/red, dark mode). */
export const TREND = { up: "#30d158", down: "#ff453a", flat: "#8e8e93" } as const;

/** Chart chrome on the dark background. */
export const CHART = {
  grid: "#2c2c2e",
  tick: "#8e8e93",
  tickStrong: "#aeaeb2",
  guide: "#636366",
  dotStroke: "#000000",
  tooltip: { background: "#1c1c1e", border: "1px solid #38383a", borderRadius: 16, fontWeight: 700, color: "#fff" },
} as const;
