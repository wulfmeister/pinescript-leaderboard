import type { OHLCV, PositionSizingConfig } from "@pinescript-utils/core";
import { atr } from "@pinescript-utils/core";

export interface PositionSizeResult {
  quantity: number;
  positionValue: number;
  capitalFraction: number;
}

/**
 * Calculate position size based on the configured sizing strategy.
 *
 * @param config Position sizing configuration
 * @param capital Available capital
 * @param entryPrice Entry price
 * @param stopDistance Distance from entry to stop-loss (absolute price units)
 * @param winRate Historical win rate (for Kelly)
 * @param avgWinLossRatio Average win / average loss ratio (for Kelly)
 * @param data OHLCV data (for ATR-based)
 * @param currentIndex Current bar index (for ATR-based)
 */
export function calculatePositionSize(
  config: PositionSizingConfig,
  capital: number,
  entryPrice: number,
  stopDistance?: number,
  winRate?: number,
  avgWinLossRatio?: number,
  data?: OHLCV[],
  currentIndex?: number,
): PositionSizeResult {
  let fraction: number;

  switch (config.type) {
    case "fixed-fractional": {
      // Risk a fixed fraction of capital
      // If we have stop distance, size so that losing the stop = config.value of capital
      if (stopDistance && stopDistance > 0) {
        const riskAmount = capital * config.value;
        const quantity = riskAmount / stopDistance;
        const positionValue = quantity * entryPrice;
        const capitalFraction = Math.min(positionValue / capital, 0.95);
        const adjustedQuantity = capitalFraction < positionValue / capital
          ? (capital * capitalFraction) / entryPrice
          : quantity;
        return {
          quantity: adjustedQuantity,
          positionValue: adjustedQuantity * entryPrice,
          capitalFraction: Math.min((adjustedQuantity * entryPrice) / capital, 0.95),
        };
      }
      // No stop distance: use value as fraction of capital
      fraction = Math.min(config.value, 0.95);
      break;
    }
    case "kelly": {
      // Kelly criterion: f* = W - (1-W)/R
      const W = winRate ?? 0.5;
      const R = avgWinLossRatio ?? 1;
      const kelly = W - (1 - W) / R;
      // Clamp: negative kelly means don't trade, cap at value (max fraction)
      const maxFraction = config.value;
      fraction = Math.min(Math.max(kelly, 0), maxFraction);
      fraction = Math.min(fraction, 0.95);
      break;
    }
    case "atr-based": {
      // Size position so that 1 ATR move = config.value fraction of capital
      if (!data || currentIndex === undefined) {
        fraction = Math.min(config.value, 0.95);
        break;
      }
      const period = config.atrPeriod ?? 14;
      const highs = data.slice(0, currentIndex + 1).map((d) => d.high);
      const lows = data.slice(0, currentIndex + 1).map((d) => d.low);
      const closes = data.slice(0, currentIndex + 1).map((d) => d.close);
      const atrValues = atr(highs, lows, closes, period);
      const currentATR = atrValues[atrValues.length - 1];
      if (!currentATR || currentATR === 0) {
        fraction = Math.min(config.value, 0.95);
        break;
      }
      const riskAmount = capital * config.value;
      const quantity = riskAmount / currentATR;
      const positionValue = quantity * entryPrice;
      fraction = Math.min(positionValue / capital, 0.95);
      break;
    }
    default:
      fraction = 0.95;
  }

  const positionValue = capital * fraction;
  const quantity = positionValue / entryPrice;

  return {
    quantity,
    positionValue,
    capitalFraction: fraction,
  };
}
