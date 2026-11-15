import type { OutcomeLabel } from "@/lib/engine/scoring";

export const OUTCOME_COPY: Record<OutcomeLabel, { badge: string; title: string; body: string; tone: string }> = {
  lucky: {
    badge: "🍀",
    title: "Lucky, not skilled",
    body: "You made money, but with a risky, concentrated strategy. The same bet could just as easily have lost. We'll test it against 10 other time periods in the reveal.",
    tone: "bg-sun-soft",
  },
  skilled: {
    badge: "🎯",
    title: "Skilled habits",
    body: "You made money and did it the sensible way: spread out, low fees, steady hands.",
    tone: "bg-brand-soft",
  },
  unlucky: {
    badge: "🌧️",
    title: "Good habits, rough market",
    body: "You lost money, but your habits were solid. Sometimes the whole market falls, and that isn't a mistake on your part.",
    tone: "bg-sky-soft",
  },
  risky: {
    badge: "⚠️",
    title: "A risky bet that didn't pay",
    body: "Your money was concentrated, and this time it went the wrong way. That's the danger of putting your eggs in one basket.",
    tone: "bg-coral-soft",
  },
  shaky: {
    badge: "🫨",
    title: "Good plan, shaky follow-through",
    body: "Your mix was sensible, but later choices, like selling during a drop or paying high fees, worked against you.",
    tone: "bg-coral-soft",
  },
};

export const MISTAKE_LABELS = {
  concentration: "Too concentrated",
  panic_selling: "Panic selling",
  chasing_hype: "Chasing hype",
  high_fees: "High fees",
  none: "No big mistakes",
} as const;
