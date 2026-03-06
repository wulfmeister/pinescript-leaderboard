import type {
  BacktestResult,
  EquityPoint,
  OHLCV,
  PerformanceMetrics,
  Trade,
} from "@pinescript-utils/core";
import type { BacktestConfig } from "@pinescript-utils/backtester";

export interface PortfolioConfig {
  script: string;
  assets: { symbol: string; data: OHLCV[] }[];
  totalCapital: number;
  backtestConfig?: Partial<BacktestConfig>;
}

export interface AssetResult {
  symbol: string;
  allocation: number;
  result: BacktestResult;
  signalCount: number;
}

export interface CombinedResult {
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  initialCapital: number;
  finalCapital: number;
  trades: Trade[];
}

export interface PortfolioResult {
  perAsset: AssetResult[];
  combined: CombinedResult;
  correlationMatrix: number[][];
  assetSymbols: string[];
  totalCapital: number;
  elapsedMs: number;
}
