import type { DecisionAction } from "@/lib/engine/types";
import { ASSETS } from "./assets";
import type { TermId } from "./glossary";

export interface DecisionOption {
  action: DecisionAction;
  label: string;
  description: string;
}

export interface DecisionPoint {
  /** Real date (hidden from the user in blind mode). */
  date: string;
  title: string;
  /** Story shown at the pause. Must not reveal real names or dates. Supports [[term]] links. */
  story: string;
  options: DecisionOption[];
}

export interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface LevelDef {
  id: number;
  title: string;
  concept: string;
  conceptTerm: TermId;
  emoji: string;
  blind: boolean;
  intro: {
    scenario: string;
    terms: TermId[];
    goal: string;
  };
  start: string;
  end: string;
  assets: string[];
  decisionPoints: DecisionPoint[];
  /** Assets "chasing hype" may pile into (defaults to the level's single stocks). */
  chaseUniverse?: string[];
  /** For the cut_fees decision: expensive fund -> its low-cost twin. */
  feeSwaps?: Record<string, string>;
  reveal: {
    periodName: string;
    whatHappened: string;
  };
  takeaway: {
    lesson: string;
    questions: [Question, Question];
  };
}

const HOLD: DecisionOption = {
  action: "hold",
  label: "Stay the course",
  description: "Keep everything exactly as it is.",
};
const REBALANCE: DecisionOption = {
  action: "rebalance",
  label: "Rebalance",
  description: "Reset back to the mix you picked at the start.",
};
const CHASE: DecisionOption = {
  action: "chase_best",
  label: "Go all-in on the hot stock",
  description: "Move everything into the single company that has risen the most lately.",
};

/** "Chasing hype" means piling into the hottest single stock... */
export function chaseUniverse(level: LevelDef): string[] {
  return level.chaseUniverse ?? level.assets.filter((id) => ASSETS[id].kind === "stock");
}
/** ...based on its recent run (~6 months of weekly data). */
export const CHASE_LOOKBACK_STEPS = 26;
const SELL_ALL: DecisionOption = {
  action: "sell_all",
  label: "Sell everything",
  description: "Move it all to cash. No more ups or downs.",
};
const SELL_HALF: DecisionOption = {
  action: "sell_half",
  label: "Sell half",
  description: "Move half of your investments to cash.",
};
const CUT_FEES: DecisionOption = {
  action: "cut_fees",
  label: "Switch to the low-fee twin",
  description: "Move any money in the pricey managed funds into the whole-market fund, which holds the same kind of companies for a tiny fee.",
};
const CHASE_ANYTHING: DecisionOption = {
  action: "chase_best",
  label: "Go all-in on what's hottest",
  description: "Move everything into whichever stock or fund has risen the most lately.",
};
const BUY_MORE: DecisionOption = {
  action: "buy_more",
  label: "Buy more (+$200)",
  description: "Add $200 from your savings into your current mix.",
};

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    title: "All eggs in one basket",
    concept: "Diversification",
    conceptTerm: "diversification",
    emoji: "🧺",
    blind: true,
    intro: {
      scenario:
        "You've saved $1,000 and want to start investing. A friend swears by one company they love. Another friend says to \"just buy the whole market.\" You'll invest for about 4 years and see what happens.",
      terms: ["stock", "etf", "diversification"],
      goal: "Build a mix you'd be comfortable holding for years, not just the one you think will win.",
    },
    start: "2016-01-04",
    end: "2019-12-31",
    assets: ["AAPL", "GE", "F", "XOM", "VTI", "BND", "ACTV"],
    decisionPoints: [
      {
        date: "2017-11-15",
        title: "One company is sinking",
        story:
          "News just broke that one of the companies is cutting its dividend and replacing its leaders, and its stock has been sliding for months. Meanwhile, others are soaring. What do you do with your [[portfolio]]?",
        options: [HOLD, REBALANCE, CHASE, SELL_ALL],
      },
      {
        date: "2018-12-24",
        title: "A sudden market drop",
        story:
          "The whole stock market has dropped almost 20% over the last three months, close to [[bear_market|bear market]] territory, and the news is full of worried headlines. Some people online are saying it's going to get much worse.",
        options: [HOLD, BUY_MORE, REBALANCE, SELL_ALL],
      },
    ],
    reveal: {
      periodName: "January 2016 – December 2019",
      whatHappened:
        "Overall, US stocks rose strongly. But single companies went wildly different ways: Apple roughly tripled, while General Electric (once the most valuable company in America) lost around two-thirds of its value after years of problems, and Ford slid too. A single-company bet could have been a big winner or a big loser, with no way to know in advance.",
    },
    takeaway: {
      lesson: "Spreading your money across many companies means no single surprise can sink you, and a lucky win with one stock doesn't prove it was a good plan.",
      questions: [
        {
          question: "You put all $1,000 into one company and it doubled. What's the best way to describe that?",
          options: [
            "Proof I'm good at picking stocks",
            "It could be luck; one result from a risky bet doesn't show skill",
            "A sign I should put even more into single stocks",
          ],
          correct: 1,
          explanation: "One great outcome from a concentrated bet is hard to tell apart from luck. The same bet could just as easily have halved.",
        },
        {
          question: "Which choice is the most diversified?",
          options: [
            "All your money in 1 famous company",
            "Half in 2 different companies",
            "A broad index fund that owns thousands of companies",
          ],
          correct: 2,
          explanation: "A broad index fund spreads your money across thousands of companies, so no single one can make or break you.",
        },
      ],
    },
  },
  {
    id: 2,
    title: "The crash",
    concept: "Volatility",
    conceptTerm: "volatility",
    emoji: "🌊",
    blind: true,
    intro: {
      scenario:
        "It's a calm, confident time. Stocks have been rising for years in a [[bull_market]] and everyone seems to be making money. You have $1,000 to invest for about 3 years. Dates and names are hidden, so you can't rely on knowing what happened next.",
      terms: ["volatility", "drawdown", "panic_selling"],
      goal: "Decide what you'd actually do when your money is falling fast, and why.",
    },
    start: "2007-10-01",
    end: "2010-12-31",
    assets: ["VTI", "BND", "QQQ", "C", "GE", "XOM"],
    decisionPoints: [
      {
        date: "2008-09-29",
        title: "Panic on the news",
        story:
          "A huge bank just collapsed. TV anchors are using words like \"meltdown.\" The market fell more in one day than you've ever seen. This is a [[bear_market]], and nobody knows how deep it goes.",
        options: [HOLD, SELL_HALF, SELL_ALL, REBALANCE],
      },
      {
        date: "2009-03-09",
        title: "Still falling...",
        story:
          "Months later, prices have kept falling. Your friends say they've sold everything and \"aren't touching stocks again.\" No one can tell you whether this is the bottom or whether there's further to fall. What's your move?",
        options: [SELL_ALL, HOLD, BUY_MORE],
      },
      {
        date: "2009-12-31",
        title: "Things are calmer",
        story:
          "The panic has eased a bit and prices have risen from their lows, though many people are still nervous. Your mix has probably drifted from your original plan.",
        options: [HOLD, REBALANCE, CHASE],
      },
    ],
    reveal: {
      periodName: "October 2007 – December 2010 (the Global Financial Crisis)",
      whatHappened:
        "The US housing bubble burst, big banks failed or needed rescues, and the S&P 500 fell about 55% from its October 2007 peak to its March 9, 2009 low, one of the worst [[bear_market|bear markets]] in modern history. Citigroup lost over 95% of its value. A new [[bull_market]] began from that low, but it took the S&P 500 until 2013 to get back to its old peak. Recoveries are never guaranteed, and some individual companies never came back.",
    },
    takeaway: {
      lesson: "Big drops are a normal (if painful) part of investing. Deciding your plan before the panic, and not selling just because prices fell, protects you from locking in losses.",
      questions: [
        {
          question: "Your investments are down 40% and everyone is scared. What does selling everything right now do?",
          options: [
            "It guarantees you avoid any further losses AND keep any recovery",
            "It locks in the 40% loss, and you'd miss any recovery that might come",
            "It has no effect on your long-term result",
          ],
          correct: 1,
          explanation: "Selling turns a paper loss into a real one. You stop further drops, but you also give up any rebound.",
        },
        {
          question: "What's the best time to decide how you'll react to a market crash?",
          options: [
            "In the middle of the crash, when you have the most information",
            "Before it happens, when you're calm",
            "After prices recover",
          ],
          correct: 1,
          explanation: "Making your plan while you're calm keeps fear from making the decision for you.",
        },
      ],
    },
  },
  {
    id: 3,
    title: "Fee monsters",
    concept: "Fees",
    conceptTerm: "expense_ratio",
    emoji: "🧾",
    blind: true,
    intro: {
      scenario:
        "You have $1,000 to invest for about 10 years. Some funds come with a famous manager or a personal wealth team, and charge a yearly fee for it. Others just buy the whole market and charge almost nothing. Look closely at the fee on each one before you choose.",
      terms: ["expense_ratio", "active_fund", "compounding"],
      goal: "Find out how much a fee that sounds tiny really costs over many years.",
    },
    start: "2010-01-04",
    end: "2019-12-31",
    assets: ["VTI", "BND", "ACTV", "PREM", "MSFT", "XOM"],
    feeSwaps: { ACTV: "VTI", PREM: "VTI" },
    decisionPoints: [
      {
        date: "2011-10-03",
        title: "A sudden scare",
        story:
          "Stocks have dropped sharply over the last few months on worries about government debt and a slowing world economy. The headlines are loud, but your plan is meant to last years. What's your move?",
        options: [HOLD, SELL_HALF, BUY_MORE, REBALANCE],
      },
      {
        date: "2014-06-02",
        title: "A smooth sales pitch",
        story:
          "A friendly advisor calls. They say a 2% yearly fee is \"just two cents on the dollar\" and that their experts will protect you when markets get rough. They suggest you move more money to them. What do you do?",
        options: [HOLD, CUT_FEES, BUY_MORE, REBALANCE],
      },
      {
        date: "2017-12-29",
        title: "Your yearly statement",
        story:
          "Your yearly statement arrives. Tucked away on page 4 is a line showing the [[expense_ratio|fees]] you paid. Every fund's fee comes out every year, whether the fund did well or not. Anything you want to change?",
        options: [HOLD, CUT_FEES, REBALANCE, CHASE],
      },
    ],
    reveal: {
      periodName: "January 2010 – December 2019",
      whatHappened:
        "This was a long [[bull_market]], a mostly calm climb for US stocks after the financial crisis. \"Star Picker\" and \"Premium Wealth\" are made-up funds that hold exactly the same companies as the whole-market fund. The only difference is their 1% and 2% yearly fees. Real studies find that most actively managed funds trail a simple index fund over 10+ years, largely because of fees.",
    },
    takeaway: {
      lesson: "A fee of 1–2% a year sounds tiny, but it comes out every year and compounds, so over a decade it can quietly eat a big slice of your growth.",
      questions: [
        {
          question: "Two funds own the exact same companies. One charges 0.03% a year, the other 2%. Over 10 years, which will most likely leave you with more money?",
          options: [
            "The 2% fund, because you get what you pay for",
            "The 0.03% fund, because less of your money goes to fees every year",
            "They'll end up about the same",
          ],
          correct: 1,
          explanation: "Same holdings means the same raw return. The only difference is the fee, and the bigger fee is taken out every single year.",
        },
        {
          question: "Where do you find out how much a fund charges each year?",
          options: ["Its past returns", "Its expense ratio", "How famous its manager is"],
          correct: 1,
          explanation: "The expense ratio is the yearly fee as a % of your money. It's one of the few things about investing you can know in advance.",
        },
      ],
    },
  },
  {
    id: 4,
    title: "Chasing hype",
    concept: "Hype & bubbles",
    conceptTerm: "chasing_hype",
    emoji: "🚀",
    blind: true,
    intro: {
      scenario:
        "Exciting new technology is changing the world, and tech stocks have soared for years in a roaring [[bull_market]]. Your coworker says they doubled their money last year and \"it's different this time.\" You have $1,000 to invest for about 6 years.",
      terms: ["chasing_hype", "bubble", "concentration"],
      goal: "Choose a plan you'd still be happy with if the excitement fades, and resist the urge to pile into whatever's hot.",
    },
    start: "2000-01-03",
    end: "2005-12-30",
    assets: ["SPX", "QQQ", "MSFT", "AAPL", "C", "GE", "XOM"],
    chaseUniverse: ["QQQ", "MSFT", "AAPL", "C", "GE", "XOM"],
    decisionPoints: [
      {
        date: "2000-03-10",
        title: "Everyone's getting rich",
        story:
          "Tech prices keep rocketing. The tech-heavy fund just hit a new record, magazines call it a \"new economy\", and your coworker asks why you're still playing it safe. What do you do?",
        options: [HOLD, CHASE_ANYTHING, BUY_MORE, REBALANCE],
      },
      {
        date: "2001-09-21",
        title: "The bubble has burst",
        story:
          "The tech excitement has collapsed. Many hot companies have lost most of their value and some have gone out of business. Prices are still sliding in a deep [[bear_market]], and the news is grim. What's your move?",
        options: [HOLD, SELL_ALL, BUY_MORE, REBALANCE],
      },
      {
        date: "2003-12-31",
        title: "A new winner",
        story:
          "Prices have been climbing again for most of the year, and the hottest names are rising fastest. People online are calling it \"the comeback of the decade.\" Do you pile into whatever's up the most?",
        options: [HOLD, CHASE_ANYTHING, REBALANCE, BUY_MORE],
      },
    ],
    reveal: {
      periodName: "January 2000 – December 2005 (the dot-com bust)",
      whatHappened:
        "This was the end of the dot-com [[bubble]], when a long [[bull_market]] turned into a brutal [[bear_market]]. The Nasdaq-100 peaked in March 2000 and fell about 80% by October 2002, and it still hadn't recovered by the end of 2005 (that took until 2015). The broad S&P 500 fell about 49%: painful, but far less. Some old-economy companies like ExxonMobil held up well, while former high-flyers crashed. Buying the hottest thing near the top was the costliest move of all.",
    },
    takeaway: {
      lesson: "When everyone is excited about something that has already soared, most of the gains may be behind it, so stick to a diversified plan instead of chasing what's hot.",
      questions: [
        {
          question: "A fund doubled last year and everyone's talking about it. What does that tell you about next year?",
          options: [
            "It will probably double again",
            "Very little; past gains don't predict future ones, and hype can mean you're buying high",
            "It's guaranteed to crash",
          ],
          correct: 1,
          explanation: "Past winners often slow down or reverse. Buying after a big run means paying a high price for gains that already happened.",
        },
        {
          question: "What's a good defence against getting swept up in hype?",
          options: [
            "Moving everything into the newest hot stock",
            "Checking social media more often",
            "A diversified plan you decided on ahead of time, and sticking to it",
          ],
          correct: 2,
          explanation: "A plan made while calm, spread across many companies, keeps excitement (and fear) from making the decisions.",
        },
      ],
    },
  },
];

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}
