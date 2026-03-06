import type { OHLCV, TakeProfitConfig, TradeDirection } from "@pinescript-utils/core";

/**
 * Calculate the absolute take-profit price for a position.
 * For "risk-reward" type, stopDistance is needed. If not provided, assumes 5% risk.
 */
export function calculateTakeProfitPrice(
  config: TakeProfitConfig,
  entryPrice: number,
  direction: TradeDirection,
  stopDistance?: number,
): number {
  let distance: number;

  if (config.type === "fixed") {
    distance = entryPrice * config.value;
  } else {
    // Risk-reward: target = stopDistance * ratio
    const effectiveStopDist = stopDistance ?? entryPrice * 0.05;
    distance = effectiveStopDist * config.value;
  }

  if (direction === "long") {
    return entryPrice + distance;
  } else {
    return entryPrice - distance;
  }
}

/**
 * Check if a take-profit has been triggered on a given candle.
 * Returns the execution price if triggered, null otherwise.
 * Gap handling: if the candle opens past the target, executes at the open.
 */
export function checkTakeProfit(
  targetPrice: number,
  candle: OHLCV,
  direction: TradeDirection,
): number | null {
  if (direction === "long") {
    // For longs, TP triggers when price rises to or above target
    if (candle.open >= targetPrice) {
      return candle.open;
    }
    if (candle.high >= targetPrice) {
      return targetPrice;
    }
  } else {
    // For shorts, TP triggers when price falls to or below target
    if (candle.open <= targetPrice) {
      return candle.open;
    }
    if (candle.low <= targetPrice) {
      return targetPrice;
    }
  }
  return null;
}
