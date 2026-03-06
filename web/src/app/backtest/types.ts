
export interface Metrics {
  totalReturn: number;
  annualizedReturn: number;
  totalTrades: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  averageTrade: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

export interface Trade {
  id?: string;
  timestamp: number;
  direction?: string;
  action: string;
  price: number;
  quantity?: number;
  symbol?: string;
  pnl?: number;
}

export interface BacktestResult {
  metrics: Metrics;
  initialCapital: number;
  finalCapital: number;
  dataPoints: number;
  signalCount: number;
  equityCurve: EquityPoint[];
  trades: Trade[];
}

export interface SavedStrategy {
  id: string;
  name: string;
  script: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastResult?: {
    metrics: Record<string, number>;
    finalCapital: number;
    asset?: string;
    equityCurve?: EquityPoint[];
    context?: {
      asset?: string;
      timeframe?: string;
      from?: string;
      to?: string;
      mock?: boolean;
      mockType?: string;
      mockBars?: number;
    };
  };
}
