import type { AssetRisk } from "@/lib/engine/types";

export interface AssetDef extends AssetRisk {
  id: string;
  /** File in /data the prices come from. */
  dataTicker: string;
  /** Extra annual fee applied on top of dataTicker's prices (synthetic funds only). */
  extraAnnualFee?: number;
  realTicker: string;
  realName: string;
  /** Blind-mode label shown during the simulation. */
  blindName: string;
  /** One-line plain-English description (no names, no dates). */
  blindDescription: string;
  /** Glossary term for the asset's type. */
  typeTerm: "stock" | "etf" | "bond_fund" | "active_fund";
  typeLabel: string;
}

export const ASSETS: Record<string, AssetDef> = {
  AAPL: {
    id: "AAPL", dataTicker: "AAPL", realTicker: "AAPL", realName: "Apple",
    blindName: "Company A", blindDescription: "Consumer tech hardware maker (phones, computers)",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  MSFT: {
    id: "MSFT", dataTicker: "MSFT", realTicker: "MSFT", realName: "Microsoft",
    blindName: "Company B", blindDescription: "Software maker for businesses and homes",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  GE: {
    id: "GE", dataTicker: "GE", realTicker: "GE", realName: "General Electric",
    blindName: "Company C", blindDescription: "Giant industrial company (jet engines, power plants, lending arm)",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  F: {
    id: "F", dataTicker: "F", realTicker: "F", realName: "Ford Motor",
    blindName: "Company D", blindDescription: "Car and truck maker",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  XOM: {
    id: "XOM", dataTicker: "XOM", realTicker: "XOM", realName: "ExxonMobil",
    blindName: "Company E", blindDescription: "Oil and gas producer",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  C: {
    id: "C", dataTicker: "C", realTicker: "C", realName: "Citigroup",
    blindName: "Company F", blindDescription: "Large global bank",
    kind: "stock", expenseRatio: 0, maxSingleCompanyWeight: 1, typeTerm: "stock", typeLabel: "Single stock",
  },
  VTI: {
    id: "VTI", dataTicker: "VTI", realTicker: "VTI", realName: "Vanguard Total Stock Market ETF",
    blindName: "Fund 1: Whole Market", blindDescription: "Owns ~3,500 US companies of every size in one fund",
    kind: "broad_fund", expenseRatio: 0.0003, maxSingleCompanyWeight: 0.065, typeTerm: "etf", typeLabel: "Broad index fund",
  },
  BND: {
    id: "BND", dataTicker: "BND", realTicker: "BND", realName: "Vanguard Total Bond Market ETF",
    blindName: "Fund 2: Bonds", blindDescription: "Lends money to governments and companies; steadier, slower growth",
    kind: "bond_fund", expenseRatio: 0.0003, maxSingleCompanyWeight: 0.01, typeTerm: "bond_fund", typeLabel: "Bond fund",
  },
  QQQ: {
    id: "QQQ", dataTicker: "QQQ", realTicker: "QQQ", realName: "Invesco QQQ (Nasdaq-100)",
    blindName: "Fund 3: Big Tech 100", blindDescription: "Owns 100 large companies, mostly technology",
    kind: "sector_fund", expenseRatio: 0.002, maxSingleCompanyWeight: 0.09, typeTerm: "etf", typeLabel: "Index fund (tech-heavy)",
  },
  ACTV: {
    id: "ACTV", dataTicker: "VTI", extraAnnualFee: 0.0097, realTicker: "(fictional)",
    realName: "Fictional 'Star Picker' fund: the whole-market fund minus a 1% yearly fee",
    blindName: "Fund 4: Star Picker", blindDescription: "A famous manager hand-picks stocks for you",
    kind: "active_fund", expenseRatio: 0.01, maxSingleCompanyWeight: 0.065, typeTerm: "active_fund", typeLabel: "Actively managed fund",
  },
  PREM: {
    id: "PREM", dataTicker: "VTI", extraAnnualFee: 0.0197, realTicker: "(fictional)",
    realName: "Fictional 'Premium Wealth' fund: the whole-market fund minus a 2% yearly fee",
    blindName: "Fund 5: Premium Wealth", blindDescription: "A wealth team builds and watches your portfolio for you",
    kind: "active_fund", expenseRatio: 0.02, maxSingleCompanyWeight: 0.065, typeTerm: "active_fund", typeLabel: "Actively managed fund",
  },
  SPX: {
    id: "SPX", dataTicker: "VOO", realTicker: "SPY", realName: "SPDR S&P 500 ETF (an S&P 500 index fund)",
    blindName: "Fund 6: Top 500", blindDescription: "Owns the 500 biggest US companies in one fund",
    kind: "broad_fund", expenseRatio: 0.0009, maxSingleCompanyWeight: 0.07, typeTerm: "etf", typeLabel: "Broad index fund",
  },
  // Benchmarks (only shown on the reveal screen)
  VOO: {
    id: "VOO", dataTicker: "VOO", realTicker: "VOO", realName: "Vanguard S&P 500 ETF",
    blindName: "S&P 500 index fund", blindDescription: "The 500 biggest US companies",
    kind: "broad_fund", expenseRatio: 0.0003, maxSingleCompanyWeight: 0.07, typeTerm: "etf", typeLabel: "Index fund",
  },
  QQQM: {
    id: "QQQM", dataTicker: "QQQM", realTicker: "QQQM", realName: "Invesco Nasdaq-100 ETF (QQQM)",
    blindName: "Nasdaq-100 index fund", blindDescription: "100 big, mostly-tech companies",
    kind: "sector_fund", expenseRatio: 0.0015, maxSingleCompanyWeight: 0.09, typeTerm: "etf", typeLabel: "Index fund",
  },
};

export const BENCHMARKS = ["VOO", "QQQM"] as const;

export function riskTable(): Record<string, AssetRisk> {
  return ASSETS;
}

export function formatER(er: number): string {
  return `${(er * 100).toFixed(2).replace(/0$/, "")}%`;
}
