import type {
  OHLCV,
  RiskManagementConfig,
  TradeDirection,
} from "@pinescript-utils/core";
import { calculateStopLossPrice, checkStopLoss } from "./stop-loss.js";
import { calculateTakeProfitPrice, checkTakeProfit } from "./take-profit.js";
import {
  type TrailingStopState,
  initTrailingStop,
  updateTrailingStop,
  checkTrailingStop,
} from "./trailing-stop.js";
import {
  calculatePositionSize,
  type PositionSizeResult,
} from "./position-sizing.js";

export interface PositionRiskState {
  entryPrice: number;
  direction: TradeDirection;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopState?: TrailingStopState;
}

export interface RiskCheckResult {
  triggered: boolean;
  reason?: "stop-loss" | "take-profit" | "trailing-stop";
  exitPrice?: number;
}

/**
 * RiskManager orchestrates all risk management logic for positions.
 * Maintains per-position state for trailing stops.
 */
export class RiskManager {
  private config: RiskManagementConfig;
  private positionStates: Map<string, PositionRiskState> = new Map();

  constructor(config: RiskManagementConfig) {
    this.config = config;
  }

  /**
   * Called when a new position is opened. Sets up stop/TP/trailing state.
   */
  onPositionOpened(
    symbol: string,
    entryPrice: number,
    direction: TradeDirection,
    data: OHLCV[],
    currentIndex: number,
  ): void {
    const state: PositionRiskState = {
      entryPrice,
      direction,
    };

    // Calculate stop-loss price
    if (this.config.stopLoss) {
      state.stopLossPrice = calculateStopLossPrice(
        this.config.stopLoss,
        entryPrice,
        direction,
        data,
        currentIndex,
      );
    }

    // Calculate take-profit price
    if (this.config.takeProfit) {
      let stopDistance: number | undefined;
      if (state.stopLossPrice !== undefined) {
        stopDistance = Math.abs(entryPrice - state.stopLossPrice);
      }
      state.takeProfitPrice = calculateTakeProfitPrice(
        this.config.takeProfit,
        entryPrice,
        direction,
        stopDistance,
      );
    }

    // Initialize trailing stop
    if (this.config.trailingStop) {
      state.trailingStopState = initTrailingStop(
        this.config.trailingStop,
        entryPrice,
        direction,
        data,
        currentIndex,
      );
    }

    this.positionStates.set(symbol, state);
  }

  /**
   * Called when a position is closed (either by signal or risk exit).
   */
  onPositionClosed(symbol: string): void {
    this.positionStates.delete(symbol);
  }

  /**
   * Check all risk conditions for a position on the current candle.
   * Priority: stop-loss first (conservative), then trailing-stop, then take-profit.
   */
  checkRiskConditions(
    symbol: string,
    candle: OHLCV,
    data: OHLCV[],
    currentIndex: number,
  ): RiskCheckResult {
    const state = this.positionStates.get(symbol);
    if (!state) {
      return { triggered: false };
    }

    // Update trailing stop first (ratchet to new extreme)
    if (state.trailingStopState && this.config.trailingStop) {
      state.trailingStopState = updateTrailingStop(
        this.config.trailingStop,
        state.trailingStopState,
        candle,
        state.direction,
        data,
        currentIndex,
      );
    }

    // Check stop-loss (highest priority - check first)
    if (state.stopLossPrice !== undefined) {
      const exitPrice = checkStopLoss(
        state.stopLossPrice,
        candle,
        state.direction,
      );
      if (exitPrice !== null) {
        return { triggered: true, reason: "stop-loss", exitPrice };
      }
    }

    // Check trailing stop
    if (state.trailingStopState) {
      const exitPrice = checkTrailingStop(
        state.trailingStopState,
        candle,
        state.direction,
      );
      if (exitPrice !== null) {
        return { triggered: true, reason: "trailing-stop", exitPrice };
      }
    }

    // Check take-profit
    if (state.takeProfitPrice !== undefined) {
      const exitPrice = checkTakeProfit(
        state.takeProfitPrice,
        candle,
        state.direction,
      );
      if (exitPrice !== null) {
        return { triggered: true, reason: "take-profit", exitPrice };
      }
    }

    return { triggered: false };
  }

  /**
   * Get position size using the configured sizing strategy.
   */
  getPositionSize(
    capital: number,
    entryPrice: number,
    data: OHLCV[],
    currentIndex: number,
    winRate?: number,
    avgWinLossRatio?: number,
    direction: TradeDirection = "long",
  ): PositionSizeResult {
    if (!this.config.positionSizing) {
      const positionValue = capital * 0.95;
      return {
        quantity: positionValue / entryPrice,
        positionValue,
        capitalFraction: 0.95,
      };
    }

    let stopDistance: number | undefined;
    if (this.config.stopLoss) {
      const stopPrice = calculateStopLossPrice(
        this.config.stopLoss,
        entryPrice,
        direction,
        data,
        currentIndex,
      );
      stopDistance = Math.abs(entryPrice - stopPrice);
    }

    return calculatePositionSize(
      this.config.positionSizing,
      capital,
      entryPrice,
      stopDistance,
      winRate,
      avgWinLossRatio,
      data,
      currentIndex,
    );
  }

  /**
   * Check if any risk exit rules are configured
   */
  hasExitRules(): boolean {
    return !!(
      this.config.stopLoss ||
      this.config.takeProfit ||
      this.config.trailingStop
    );
  }

  /**
   * Get the current risk state for a position
   */
  getPositionState(symbol: string): PositionRiskState | undefined {
    return this.positionStates.get(symbol);
  }
}
