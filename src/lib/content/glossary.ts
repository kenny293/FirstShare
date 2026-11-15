export interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
}

/**
 * Plain-English definitions. Reference them inside content strings with
 * [[id]] or [[id|custom label]] and they become tappable.
 */
export const GLOSSARY = {
  stock: {
    term: "Stock",
    definition: "A tiny slice of ownership in one company. If the company does well, your slice can grow. If it struggles, your slice can shrink, sometimes to almost nothing.",
    example: "Owning 1 share of a company with 1 million shares means you own one-millionth of it.",
  },
  etf: {
    term: "ETF (exchange-traded fund)",
    definition: "A basket of many investments you can buy in one go, like buying a fruit salad instead of one apple.",
  },
  index_fund: {
    term: "Index fund",
    definition: "A fund that simply buys everything in a list (an \"index\"), like the 500 biggest US companies. No one is guessing which ones will win, so fees are usually tiny.",
  },
  bond_fund: {
    term: "Bond fund",
    definition: "A fund that lends money to governments and companies, who pay interest back. Usually much steadier than stocks, but grows more slowly.",
  },
  active_fund: {
    term: "Actively managed fund",
    definition: "A fund where a manager picks which investments to buy. You pay them a higher fee for that, and most don't beat a simple index fund over time.",
  },
  diversification: {
    term: "Diversification",
    definition: "Spreading your money across many different investments so one bad one can't sink you. The \"don't put all your eggs in one basket\" rule.",
  },
  concentration: {
    term: "Concentration",
    definition: "Having a big chunk of your money in just one or two investments. It makes your results swing much more, in both directions.",
  },
  expense_ratio: {
    term: "Expense ratio (fee)",
    definition: "The yearly fee a fund charges, as a % of your money. 0.03% on $1,000 is 30 cents a year; 1% is $10 a year. Over decades the difference adds up a lot.",
  },
  portfolio: {
    term: "Portfolio",
    definition: "Everything you've invested in, taken together.",
  },
  volatility: {
    term: "Volatility",
    definition: "How much and how fast prices jump up and down. High volatility means a bumpier ride.",
  },
  drawdown: {
    term: "Drawdown",
    definition: "How far your investments have fallen from their highest point. Down from $1,000 to $700 is a 30% drawdown.",
  },
  bear_market: {
    term: "Bear market",
    definition: "When stock prices fall 20% or more from their recent high. They happen every several years and can last months or years.",
    example: "Think of a bear swiping its paws down. The opposite is a bull market.",
  },
  bull_market: {
    term: "Bull market",
    definition: "A long stretch when stock prices keep rising, usually 20% or more up from a low. They can last for years and feel great, which can make people overconfident and forget that drops still happen.",
    example: "Think of a bull tossing its horns up. The opposite is a bear market.",
  },
  panic_selling: {
    term: "Panic selling",
    definition: "Selling because prices dropped and it feels scary, rather than because your plan changed. It turns a temporary paper loss into a permanent real one.",
  },
  rebalancing: {
    term: "Rebalancing",
    definition: "Resetting your mix back to your original plan, e.g. back to 60% stocks / 40% bonds after one part grew faster than the other.",
  },
  buy_the_dip: {
    term: "Buying more in a downturn",
    definition: "Adding money while prices are low. It only works if you can afford to leave that money invested for years. Prices can always fall further first.",
  },
  benchmark: {
    term: "Benchmark",
    definition: "A simple yardstick to compare your results to, like \"what if I'd just bought an index fund?\"",
  },
  sp500: {
    term: "S&P 500",
    definition: "A list of about 500 of the largest US companies. VOO is a fund that owns all of them.",
  },
  nasdaq100: {
    term: "Nasdaq-100",
    definition: "A list of 100 large companies on the Nasdaq exchange, mostly technology. QQQM is a fund that owns all of them.",
  },
  chasing_hype: {
    term: "Chasing hype",
    definition: "Piling into whatever just went up the most. Past winners often don't keep winning, and you end up buying high.",
  },
  compounding: {
    term: "Compounding",
    definition: "Growth on top of growth: your gains earn their own gains over time. It works in reverse for fees too, since money taken out in fees can't grow for you.",
    example: "$1,000 growing 7% a year becomes about $1,970 in 10 years. At 5% a year (7% minus a 2% fee) it's only about $1,630.",
  },
  bubble: {
    term: "Bubble",
    definition: "When excitement pushes prices far above what the businesses are really worth. Bubbles are usually only obvious afterwards, when prices fall back down, often very fast.",
  },
  luck_vs_skill: {
    term: "Luck vs. skill",
    definition: "A risky bet that paid off once might just be luck. Skill shows up as decisions that work out well across many different situations.",
  },
} satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;

export function isTermId(id: string): id is TermId {
  return id in GLOSSARY;
}
