import type { DecisionAction, PricePoint, Weights } from "@/lib/engine/types";
import type { HabitsScore } from "@/lib/engine/scoring";
import type { RuleId } from "./config";

export type ChallengeMode = "live" | "replay";
export type DepositStatus = "none" | "paid_mock" | "refunded_mock" | "donated_mock";

export interface ChallengePlan {
  /** Target weights chosen on day 0 (sum to 1). */
  allocation: Weights;
  rules: RuleId[];
  note: string;
  /** Guessed range for the final value, in dollars. */
  guessLow: number;
  guessHigh: number;
}

export interface ChallengeAction {
  /** Trading date the action is applied at (close price). */
  date: string;
  action: DecisionAction;
  reasoning: string;
  /** Set when this answers a check-in. */
  eventDate?: string;
  createdAt: string;
}

export interface ChallengeEvent {
  date: string;
  kind: "drop" | "jump" | "midway";
  /** Benchmark move that day (0 for midway). */
  move: number;
}

export interface ChallengeScoreParts {
  habits: number; // /60
  planKept: number; // /15
  lowTrading: number; // /10
  reflection: number; // /10
  calibration: number; // /5
}

export interface ChallengeResult {
  challengeScore: number;
  parts: ChallengeScoreParts;
  habits: HabitsScore;
  finalValue: number;
  totalContributed: number;
  returnPct: number;
  benchmarkReturnPct: number;
  violations: { date: string; rule: RuleId; action: DecisionAction }[];
  trades: number;
  answered: number;
  checkins: number;
  inGuessRange: boolean;
  luck: {
    /** The player's time-weighted return used for the comparison (ignores added cash). */
    playerReturn: number;
    /** Share of random portfolios the player beat, 0..1. */
    percentile: number;
    /** Histogram of random-portfolio returns. */
    bins: { from: number; to: number; count: number }[];
  };
  depositRefunded: boolean;
  finishedAt: string;
}

/** Firestore document: challenges/{id} */
export interface ChallengeDoc {
  uid: string;
  displayName: string;
  mode: ChallengeMode;
  status: "active" | "finished";
  startDate: string;
  /** Live: target calendar end date. Replay: last trading date of the window. */
  endDate: string;
  plan: ChallengePlan;
  actions: ChallengeAction[];
  deposit: { status: DepositStatus; amount: number };
  dataSource: string;
  result?: ChallengeResult;
  createdAt: string;
  updatedAt: string;
}

/** What GET /api/challenges/[id] returns. */
export interface ChallengeView {
  id: string;
  challenge: ChallengeDoc;
  /** Daily closes from the start date up to today / the end of the window. */
  series: Record<string, PricePoint[]>;
  events: ChallengeEvent[];
  /** Last trading date with data (where a live action would be applied). */
  latestDate: string;
  canFinish: boolean;
  dataSource: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  challengeScore: number;
  habitsScore: number;
  finishedAt: string;
}
