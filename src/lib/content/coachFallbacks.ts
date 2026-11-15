import type { MistakeType } from "@/lib/engine/scoring";

export interface CoachFeedback {
  feedback: string;
  mistake_type: MistakeType;
  encouragement: string;
}

export const MISTAKE_TYPES: MistakeType[] = [
  "concentration",
  "panic_selling",
  "chasing_hype",
  "high_fees",
  "none",
];

/** Pre-written messages used when the Gemini API is unavailable. */
export const COACH_FALLBACKS: Record<MistakeType, CoachFeedback> = {
  concentration: {
    mistake_type: "concentration",
    feedback:
      "Most of your money sat in just one or two investments, so your result depended on how those few companies happened to do. Concentration makes the swings bigger in both directions. Even when it works out, it is hard to tell whether that was a good plan or a good roll of the dice.",
    encouragement: "Next time, try spreading your money so no single company can make or break your result.",
  },
  panic_selling: {
    mistake_type: "panic_selling",
    feedback:
      "You sold after a big drop. That feels safe in the moment, but it turns a temporary paper loss into a real, locked-in one, and you miss any recovery that might follow. Markets don't always bounce back quickly, which is why it helps to decide your plan before the scary moment arrives.",
    encouragement: "Feeling nervous during a drop is completely normal. The skill is noticing the feeling without letting it make the decision.",
  },
  chasing_hype: {
    mistake_type: "chasing_hype",
    feedback:
      "You moved money into whatever had gone up the most. Past winners often slow down or reverse, so chasing them usually means buying after the big gains already happened. A steady plan tends to beat jumping between hot picks.",
    encouragement: "Noticing what's been rising is natural. Sticking to your plan anyway is the habit worth building.",
  },
  high_fees: {
    mistake_type: "high_fees",
    feedback:
      "A good chunk of your money was in a fund with a high yearly fee. A 1% fee sounds small, but it comes out every single year whether the fund does well or not, and over decades it can eat a big share of your growth.",
    encouragement: "Checking the expense ratio before you invest is one of the easiest wins in investing. You're already learning to look for it.",
  },
  none: {
    mistake_type: "none",
    feedback:
      "You spread your money out, kept fees low, and stuck with your plan when things got bumpy. Those are exactly the habits that tend to work across many different market periods, not just this one.",
    encouragement: "Great habits! Keep practising them, especially when the market gets scary.",
  },
};
