import type { DecisionAction } from "@/lib/engine/types";

/** Assets you can pick in the live challenge (real tickers; ACTV is the fictional high-fee fund). */
export const CHALLENGE_ASSETS = ["VTI", "BND", "QQQ", "AAPL", "MSFT", "XOM", "F", "ACTV"] as const;
/** Benchmark used to detect "big market day" check-ins. */
export const CHALLENGE_BENCHMARK = "VOO";
/** Real tickers fetched from the data provider (ACTV is derived from VTI). */
export const CHALLENGE_TICKERS = ["VTI", "BND", "QQQ", "AAPL", "MSFT", "XOM", "F", "VOO"] as const;

export const CHALLENGE = {
  startingCash: 1000,
  /** Live challenges run this many calendar days. */
  calendarDays: 14,
  /** Demo replays cover this many recent trading days (~14 calendar days). */
  replayTradingDays: 10,
  /** A benchmark daily move at least this big triggers a check-in. */
  bigMoveDown: -0.012,
  bigMoveUp: 0.015,
  maxCheckins: 3,
  /** Short-horizon panic threshold: selling 25%+ after a drop of at least this much from the peak. */
  panicDrawdown: 0.01,
  depositAmount: 10,
  /** Challenge score needed (plus every check-in answered and every rule kept) to earn the deposit back. */
  refundScore: 70,
  randomPortfolios: 1000,
} as const;

export interface ActionOption {
  action: DecisionAction;
  label: string;
  description: string;
}

export const CHALLENGE_ACTIONS: ActionOption[] = [
  { action: "hold", label: "Stick with my plan", description: "Change nothing." },
  { action: "rebalance", label: "Rebalance", description: "Reset to the mix you picked on day 0." },
  { action: "buy_more", label: "Add $200", description: "Put another $200 of practice money into your current mix." },
  { action: "sell_half", label: "Sell half", description: "Move half of your investments to cash." },
  { action: "sell_all", label: "Sell everything", description: "Move it all to cash." },
  { action: "chase_best", label: "Go all-in on what's hottest", description: "Move everything into whichever pick rose the most lately." },
];

export type RuleId = "no_panic" | "no_chase" | "stay_invested" | "rebalance_only";

export const PLAN_RULES: { id: RuleId; label: string; hint: string }[] = [
  { id: "no_panic", label: "I won't sell just because prices dropped", hint: "Selling while your portfolio is down breaks this rule." },
  { id: "no_chase", label: "I won't pile into whatever's hot", hint: "Going all-in on the hottest pick breaks this rule." },
  { id: "stay_invested", label: "I'll stay invested for the whole challenge", hint: "Selling everything breaks this rule." },
  { id: "rebalance_only", label: "The only change I'll make is rebalancing", hint: "Selling or chasing breaks this rule (adding money is fine)." },
];

export function actionLabel(action: DecisionAction): string {
  return CHALLENGE_ACTIONS.find((a) => a.action === action)?.label ?? action;
}
