/**
 * OHLCV (Open, High, Low, Close, Volume) data point
 */
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Timeframe options for market data
 */
export type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "1d"
  | "1w"
  | "1M";

/**
 * Asset types supported
 */
export type AssetType = "stock" | "crypto" | "forex";

/**
 * Asset identifier
 */
export interface Asset {
  symbol: string;
  type: AssetType;
  exchange?: string;
}

/**
 * Trade direction
 */
export type TradeDirection = "long" | "short";

/**
 * Trade action
 */
export type TradeAction = "buy" | "sell" | "close";

/**
 * Single trade record
 */
export interface Trade {
  id: string;
  timestamp: number;
  direction: TradeDirection;
  action: TradeAction;
  price: number;
  quantity: number;
  symbol: string;
  pnl?: number; // Profit/loss for closing trades
}

/**
 * Position state
 */
export interface Position {
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  quantity: number;
  entryTime: number;
  unrealizedPnl: number;
}

/**
 * Indicator result
 */
export interface IndicatorValue {
  timestamp: number;
  value: number;
}

/**
 * Multi-value indicator result (e.g., Bollinger Bands)
 */
export interface MultiIndicatorValue {
  timestamp: number;
  values: number[];
}

/**
 * Strategy signal
 */
export interface Signal {
  timestamp: number;
  action: TradeAction;
  price: number;
  metadata?: Record<string, unknown>;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  startTime: number;
  endTime: number;
  initialCapital: number;
  finalCapital: number;
}

/**
 * Equity curve point
 */
export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  // Return metrics
  totalReturn: number;
  annualizedReturn: number;
  totalTrades: number;

  // Risk metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;

  // Trade metrics
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  averageTrade: number;

  // Duration metrics
  averageTradeDuration: number;
  maxTradeDuration: number;
  minTradeDuration: number;
}

/**
 * Indicator configuration
 */
export interface IndicatorConfig {
  name: string;
  params: Record<string, number>;
}

/**
 * Strategy configuration
 */
export interface StrategyConfig {
  name: string;
  indicators: IndicatorConfig[];
  entryRules: string[];
  exitRules: string[];
  riskManagement?: RiskManagementConfig;
}

/**
 * Stop-loss configuration
 */
export interface StopLossConfig {
  type: "fixed" | "atr";
  /** For fixed: percentage (e.g. 0.05 = 5%). For atr: ATR multiplier */
  value: number;
  /** ATR lookback period (only used when type is "atr") */
  atrPeriod?: number;
}

/**
 * Take-profit configuration
 */
export interface TakeProfitConfig {
  type: "fixed" | "risk-reward";
  /** For fixed: percentage (e.g. 0.10 = 10%). For risk-reward: ratio (e.g. 2 = 2:1 R:R) */
  value: number;
}

/**
 * Trailing stop configuration
 */
export interface TrailingStopConfig {
  type: "fixed" | "atr";
  /** For fixed: percentage (e.g. 0.03 = 3%). For atr: ATR multiplier */
  value: number;
  /** ATR lookback period (only used when type is "atr") */
  atrPeriod?: number;
}

/**
 * Position sizing configuration
 */
export interface PositionSizingConfig {
  type: "fixed-fractional" | "kelly" | "atr-based";
  /** Risk fraction of capital (e.g. 0.02 = 2%) */
  value: number;
  /** ATR lookback period (only used when type is "atr-based") */
  atrPeriod?: number;
}

/**
 * Risk management configuration
 */
export interface RiskManagementConfig {
  stopLoss?: StopLossConfig;
  takeProfit?: TakeProfitConfig;
  trailingStop?: TrailingStopConfig;
  positionSizing?: PositionSizingConfig;
}

/**
 * Percentile distribution for Monte Carlo results
 */
export interface PercentileDistribution {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  stdDev: number;
}

/**
 * Monte Carlo simulation result
 */
export interface MonteCarloResult {
  simulations: number;
  finalEquity: PercentileDistribution;
  totalReturn: PercentileDistribution;
  maxDrawdown: PercentileDistribution;
  sharpeRatio: PercentileDistribution;
  probabilityOfRuin: number;
  ruinThreshold: number;
  expectedMaxDrawdown: number;
  equityCurves?: number[][];
  elapsedMs: number;
}
