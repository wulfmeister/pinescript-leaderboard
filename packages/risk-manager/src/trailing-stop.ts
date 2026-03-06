import type { OHLCV, TrailingStopConfig, TradeDirection } from "@pinescript-utils/core";
import { atr } from "@pinescript-utils/core";

/**
 * State for a trailing stop on a single position
 */
export interface TrailingStopState {
  extremePrice: number; // Best price seen (highest for long, lowest for short)
  stopPrice: number;
}

/**
 * Initialize a trailing stop state from position entry
 */
export function initTrailingStop(
  config: TrailingStopConfig,
  entryPrice: number,
  direction: TradeDirection,
  data: OHLCV[],
  currentIndex: number,
): TrailingStopState {
  const distance = calculateTrailingDistance(config, entryPrice, data, currentIndex);

  if (direction === "long") {
    return {
      extremePrice: entryPrice,
      stopPrice: entryPrice - distance,
    };
  } else {
    return {
      extremePrice: entryPrice,
      stopPrice: entryPrice + distance,
    };
  }
}

/**
 * Update the trailing stop: ratchets only — stop tightens, never loosens.
 * Returns the updated state.
 */
export function updateTrailingStop(
  config: TrailingStopConfig,
  state: TrailingStopState,
  candle: OHLCV,
  direction: TradeDirection,
  data: OHLCV[],
  currentIndex: number,
): TrailingStopState {
  const newState = { ...state };

  if (direction === "long") {
    // Track new highs
    if (candle.high > newState.extremePrice) {
      newState.extremePrice = candle.high;
      const distance = calculateTrailingDistance(config, newState.extremePrice, data, currentIndex);
      const newStop = newState.extremePrice - distance;
      // Only tighten (move up), never loosen
      if (newStop > newState.stopPrice) {
        newState.stopPrice = newStop;
      }
    }
  } else {
    // Track new lows for shorts
    if (candle.low < newState.extremePrice) {
      newState.extremePrice = candle.low;
      const distance = calculateTrailingDistance(config, newState.extremePrice, data, currentIndex);
      const newStop = newState.extremePrice + distance;
      // Only tighten (move down), never loosen
      if (newStop < newState.stopPrice) {
        newState.stopPrice = newStop;
      }
    }
  }

  return newState;
}

/**
 * Check if the trailing stop has been triggered.
 * Returns execution price if triggered, null otherwise.
 */
export function checkTrailingStop(
  state: TrailingStopState,
  candle: OHLCV,
  direction: TradeDirection,
): number | null {
  if (direction === "long") {
    if (candle.open <= state.stopPrice) {
      return candle.open;
    }
    if (candle.low <= state.stopPrice) {
      return state.stopPrice;
    }
  } else {
    if (candle.open >= state.stopPrice) {
      return candle.open;
    }
    if (candle.high >= state.stopPrice) {
      return state.stopPrice;
    }
  }
  return null;
}

function calculateTrailingDistance(
  config: TrailingStopConfig,
  referencePrice: number,
  data: OHLCV[],
  currentIndex: number,
): number {
  if (config.type === "fixed") {
    return referencePrice * config.value;
  } else {
    const period = config.atrPeriod ?? 14;
    const highs = data.slice(0, currentIndex + 1).map((d) => d.high);
    const lows = data.slice(0, currentIndex + 1).map((d) => d.low);
    const closes = data.slice(0, currentIndex + 1).map((d) => d.close);
    const atrValues = atr(highs, lows, closes, period);
    const currentATR = atrValues[atrValues.length - 1] || 0;
    return currentATR * config.value;
  }
}
