import type {
  OHLCV,
  Signal,
  Trade,
  Position,
  BacktestResult,
  EquityPoint,
  PerformanceMetrics,
  RiskManagementConfig,
} from "@pinescript-utils/core";
import { calculateMetrics } from "@pinescript-utils/core";
import { RiskManager } from "@pinescript-utils/risk-manager";

/**
 * Backtest configuration options
 */
export interface BacktestConfig {
  /** Initial capital */
  initialCapital: number;
  /** Position sizing: percentage of capital per trade (0-1) */
  positionSize: number;
  /** Commission per trade (percentage, e.g., 0.001 = 0.1%) */
  commission: number;
  /** Slippage (percentage) */
  slippage: number;
  /** Enable short selling */
  allowShorts: boolean;
  /** Risk management */
  riskManagement?: RiskManagementConfig;
}

/**
 * Default backtest configuration
 */
export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 10000,
  positionSize: 0.95,
  commission: 0.001,
  slippage: 0.0005,
  allowShorts: false,
};

/**
 * Position tracking for backtesting
 */
class PositionTracker {
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private tradeId = 0;

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  openPosition(
    symbol: string,
    direction: "long" | "short",
    price: number,
    quantity: number,
    timestamp: number,
  ): void {
    const position: Position = {
      symbol,
      direction,
      entryPrice: price,
      quantity,
      entryTime: timestamp,
      unrealizedPnl: 0,
    };
    this.positions.set(symbol, position);

    // Record entry trade
    this.trades.push({
      id: `trade_${this.tradeId++}`,
      timestamp,
      direction,
      action: "buy",
      price,
      quantity,
      symbol,
    });
  }

  closePosition(symbol: string, price: number, timestamp: number): number {
    return this.closePositionWithPnl(symbol, price, timestamp);
  }

  closePositionWithPnl(
    symbol: string,
    price: number,
    timestamp: number,
    pnl?: number,
  ): number {
    const position = this.positions.get(symbol);
    if (!position) return 0;

    // Calculate P&L if not provided
    let finalPnl = pnl ?? 0;
    if (pnl === undefined) {
      if (position.direction === "long") {
        finalPnl = (price - position.entryPrice) * position.quantity;
      } else {
        finalPnl = (position.entryPrice - price) * position.quantity;
      }
    }

    // Record exit trade
    this.trades.push({
      id: `trade_${this.tradeId++}`,
      timestamp,
      direction: position.direction,
      action: "close",
      price,
      quantity: position.quantity,
      symbol,
      pnl: finalPnl,
    });

    this.positions.delete(symbol);
    return finalPnl;
  }

  updateUnrealizedPnl(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (!position) return;

    if (position.direction === "long") {
      position.unrealizedPnl =
        (currentPrice - position.entryPrice) * position.quantity;
    } else {
      position.unrealizedPnl =
        (position.entryPrice - currentPrice) * position.quantity;
    }
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getAllTrades(): Trade[] {
    return [...this.trades];
  }

  getOpenTradeCount(): number {
    return this.positions.size;
  }
}

/**
 * Sophisticated backtesting engine
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private positions: PositionTracker;
  private cash: number;
  private equity: number;
  private equityCurve: EquityPoint[] = [];
  private peakEquity: number;

  constructor(config: Partial<BacktestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.positions = new PositionTracker();
    this.cash = this.config.initialCapital;
    this.equity = this.config.initialCapital;
    this.peakEquity = this.config.initialCapital;
  }

  /**
   * Run a complete backtest
   */
  async run(
    signals: Signal[],
    data: OHLCV[],
    symbol: string,
  ): Promise<BacktestResult> {
    // Sort signals by timestamp
    const sortedSignals = [...signals].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    const riskManager = this.config.riskManagement
      ? new RiskManager(this.config.riskManagement)
      : null;

    if (riskManager && riskManager.hasExitRules()) {
      // NEW PATH: iterate ALL candles to check risk exits between signals
      await this.runWithRiskManagement(
        sortedSignals,
        data,
        symbol,
        riskManager,
      );
    } else {
      // ORIGINAL PATH: iterate only signal timestamps (backward compatible)
      await this.runSignalsOnly(sortedSignals, data, symbol, riskManager);
    }

    // Close any remaining positions at the last price
    const lastCandle = data[data.length - 1];
    if (lastCandle) {
      if (riskManager) {
        for (const position of this.positions.getAllPositions()) {
          riskManager.onPositionClosed(position.symbol);
        }
      }
      for (const position of this.positions.getAllPositions()) {
        this.positions.closePosition(
          position.symbol,
          lastCandle.close,
          lastCandle.timestamp,
        );
      }
      this.updateEquity(lastCandle);
    }

    // Calculate final metrics
    const trades = this.positions.getAllTrades();
    const firstData = data[0];
    const lastData = data[data.length - 1];

    const metrics = calculateMetrics(
      trades,
      this.equityCurve.map((e) => e.equity),
      this.config.initialCapital,
      this.equity,
      firstData?.timestamp || 0,
      lastData?.timestamp || 0,
    );

    return {
      trades,
      equityCurve: this.equityCurve,
      metrics,
      startTime: firstData?.timestamp || 0,
      endTime: lastData?.timestamp || 0,
      initialCapital: this.config.initialCapital,
      finalCapital: this.equity,
    };
  }

  /**
   * Original path: iterate only signal timestamps
   */
  private async runSignalsOnly(
    sortedSignals: Signal[],
    data: OHLCV[],
    symbol: string,
    riskManager: RiskManager | null,
  ): Promise<void> {
    const priceMap = new Map<number, OHLCV>();
    const indexMap = new Map<number, number>();
    for (let i = 0; i < data.length; i++) {
      priceMap.set(data[i].timestamp, data[i]);
      indexMap.set(data[i].timestamp, i);
    }

    // Process each signal
    for (const signal of sortedSignals) {
      const candle = priceMap.get(signal.timestamp);
      if (!candle) continue;

      // Apply slippage to execution price
      let executionPrice = signal.price;
      if (signal.action === "buy") {
        executionPrice *= 1 + this.config.slippage;
      } else {
        executionPrice *= 1 - this.config.slippage;
      }

      // Process the signal
      await this.processSignal(
        signal,
        executionPrice,
        candle,
        symbol,
        signal.timestamp,
        riskManager,
        data,
        indexMap.get(candle.timestamp) ?? 0,
      );

      // Update equity and record curve point
      this.updateEquity(candle);
    }
  }

  /**
   * New path: iterate ALL candles for risk management checks
   */
  private async runWithRiskManagement(
    sortedSignals: Signal[],
    data: OHLCV[],
    symbol: string,
    riskManager: RiskManager,
  ): Promise<void> {
    // Build signal lookup by timestamp
    const signalMap = new Map<number, Signal>();
    for (const signal of sortedSignals) {
      signalMap.set(signal.timestamp, signal);
    }

    // Iterate ALL candles in order
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];

      // 1. Check risk exits first (stop/TP/trailing)
      if (this.positions.hasPosition(symbol)) {
        const riskResult = riskManager.checkRiskConditions(
          symbol,
          candle,
          data,
          i,
        );
        if (riskResult.triggered && riskResult.exitPrice !== undefined) {
          this.executeRiskExit(
            symbol,
            riskResult.exitPrice,
            candle.timestamp,
            riskResult.reason!,
          );
          riskManager.onPositionClosed(symbol);
        }
      }

      // 2. Process any signal at this timestamp
      const signal = signalMap.get(candle.timestamp);
      if (signal) {
        let executionPrice = signal.price;
        if (signal.action === "buy") {
          executionPrice *= 1 + this.config.slippage;
        } else {
          executionPrice *= 1 - this.config.slippage;
        }

        await this.processSignal(
          signal,
          executionPrice,
          candle,
          symbol,
          signal.timestamp,
          riskManager,
          data,
          i,
        );
      }

      // 3. Update equity on every candle
      this.updateEquity(candle);
    }
  }

  /**
   * Execute a risk-based exit (stop-loss, take-profit, or trailing stop)
   */
  private executeRiskExit(
    symbol: string,
    price: number,
    timestamp: number,
    reason: string,
  ): void {
    const position = this.positions.getPosition(symbol);
    if (!position) return;

    const positionValue = position.quantity * price;
    const commission = positionValue * this.config.commission;

    // Let closePosition compute direction-aware PnL
    this.positions.closePosition(symbol, price, timestamp);
    this.cash += positionValue - commission;
  }

  /**
   * Process a single trading signal
   */
  private async processSignal(
    signal: Signal,
    price: number,
    candle: OHLCV,
    symbol: string,
    timestamp: number,
    riskManager?: RiskManager | null,
    data?: OHLCV[],
    currentIndex?: number,
  ): Promise<void> {
    const hasPosition = this.positions.hasPosition(symbol);

    if (signal.action === "buy" && !hasPosition) {
      // Calculate position size
      let positionValue: number;
      let quantity: number;

      if (
        riskManager &&
        riskManager.hasExitRules() &&
        this.config.riskManagement?.positionSizing &&
        data &&
        currentIndex !== undefined
      ) {
        const sizing = riskManager.getPositionSize(
          this.cash,
          price,
          data,
          currentIndex,
        );
        positionValue = Math.min(sizing.positionValue, this.cash * 0.95);
        quantity = positionValue / price;
      } else if (
        riskManager &&
        this.config.riskManagement?.positionSizing &&
        data &&
        currentIndex !== undefined
      ) {
        const sizing = riskManager.getPositionSize(
          this.cash,
          price,
          data,
          currentIndex,
        );
        positionValue = Math.min(sizing.positionValue, this.cash * 0.95);
        quantity = positionValue / price;
      } else {
        positionValue = this.cash * this.config.positionSize;
        quantity = positionValue / price;
      }

      // Apply commission
      const commission = positionValue * this.config.commission;
      this.cash -= commission;

      // Open position
      this.positions.openPosition(symbol, "long", price, quantity, timestamp);
      this.cash -= positionValue;

      // Notify risk manager
      if (riskManager && data && currentIndex !== undefined) {
        riskManager.onPositionOpened(symbol, price, "long", data, currentIndex);
      }
    } else if (signal.action === "sell" && hasPosition) {
      const position = this.positions.getPosition(symbol)!;
      const positionValue = position.quantity * price;
      const commission = positionValue * this.config.commission;

      this.positions.closePosition(symbol, price, timestamp);
      this.cash += positionValue - commission;

      // Notify risk manager
      if (riskManager) {
        riskManager.onPositionClosed(symbol);
      }
    }
  }

  /**
   * Update equity and track drawdown
   */
  private updateEquity(candle: OHLCV): void {
    // Calculate total equity (cash + current position values)
    // Position value = quantity * current price (includes unrealized PnL implicitly)
    let totalEquity = this.cash;

    for (const position of this.positions.getAllPositions()) {
      this.positions.updateUnrealizedPnl(position.symbol, candle.close);
      totalEquity += position.quantity * candle.close;
    }

    this.equity = totalEquity;

    // Track peak and drawdown
    if (this.equity > this.peakEquity) {
      this.peakEquity = this.equity;
    }

    const drawdown = (this.peakEquity - this.equity) / this.peakEquity;

    this.equityCurve.push({
      timestamp: candle.timestamp,
      equity: this.equity,
      drawdown,
    });
  }

  /**
   * Get current cash balance
   */
  getCash(): number {
    return this.cash;
  }

  /**
   * Get current equity
   */
  getEquity(): number {
    return this.equity;
  }

  /**
   * Get all positions
   */
  getPositions(): Position[] {
    return this.positions.getAllPositions();
  }
}

/**
 * Run a quick backtest with default settings
 */
export async function quickBacktest(
  signals: Signal[],
  data: OHLCV[],
  symbol: string,
  initialCapital = 10000,
): Promise<BacktestResult> {
  const engine = new BacktestEngine({ initialCapital });
  return engine.run(signals, data, symbol);
}

export default BacktestEngine;
