import type { OHLCV, StopLossConfig, TradeDirection } from "@pinescript-utils/core";
import { atr } from "@pinescript-utils/core";

/**
 * Calculate the absolute stop-loss price for a position
 */
export function calculateStopLossPrice(
  config: StopLossConfig,
  entryPrice: number,
  direction: TradeDirection,
  data: OHLCV[],
  currentIndex: number,
): number {
  let distance: number;

  if (config.type === "fixed") {
    distance = entryPrice * config.value;
  } else {
    // ATR-based
    const period = config.atrPeriod ?? 14;
    const highs = data.slice(0, currentIndex + 1).map((d) => d.high);
    const lows = data.slice(0, currentIndex + 1).map((d) => d.low);
    const closes = data.slice(0, currentIndex + 1).map((d) => d.close);
    const atrValues = atr(highs, lows, closes, period);
    const currentATR = atrValues[atrValues.length - 1] || 0;
    distance = currentATR * config.value;
  }

  if (direction === "long") {
    return entryPrice - distance;
  } else {
    return entryPrice + distance;
  }
}

/**
 * Check if a stop-loss has been triggered on a given candle.
 * Returns the execution price if triggered, null otherwise.
 * Gap handling: if the candle opens past the stop, executes at the open.
 */
export function checkStopLoss(
  stopPrice: number,
  candle: OHLCV,
  direction: TradeDirection,
): number | null {
  if (direction === "long") {
    // For longs, stop triggers when price falls to or below stop
    if (candle.open <= stopPrice) {
      // Gap down past stop - execute at open
      return candle.open;
    }
    if (candle.low <= stopPrice) {
      return stopPrice;
    }
  } else {
    // For shorts, stop triggers when price rises to or above stop
    if (candle.open >= stopPrice) {
      // Gap up past stop - execute at open
      return candle.open;
    }
    if (candle.high >= stopPrice) {
      return stopPrice;
    }
  }
  return null;
}
