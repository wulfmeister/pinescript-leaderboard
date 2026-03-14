export interface RankedResult {
  rank: number;
  name: string;
  score: number;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  finalCapital: number;
  equityCurve: { timestamp: number; equity: number; drawdown: number }[];
}

export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export const usd = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
