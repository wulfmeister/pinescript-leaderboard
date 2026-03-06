import type { OHLCV } from "@pinescript-utils/core";

/**
 * PineTS candle format
 */
export interface PineTSCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openTime: number;
  closeTime: number;
}

/**
 * Detects if a timestamp is in seconds or milliseconds
 * Timestamps in seconds are typically < 10^11, milliseconds are >= 10^12
 */
function isTimestampInSeconds(timestamp: number): boolean {
  return timestamp < 10000000000; // ~2286-11-20 in seconds
}

/**
 * Converts OHLCV data to PineTS candle format
 * - Converts timestamps from seconds to milliseconds if needed
 * - Computes closeTime from adjacent bars
 * - For the last bar, estimates closeTime based on the gap between previous bars
 *
 * @param data - Array of OHLCV bars
 * @returns Array of PineTS candles
 */
export function toCandles(data: OHLCV[]): PineTSCandle[] {
  if (data.length === 0) {
    return [];
  }

  // Detect if timestamps are in seconds or milliseconds
  const isSeconds = isTimestampInSeconds(data[0].timestamp);
  const timeMultiplier = isSeconds ? 1000 : 1;

  return data.map((bar, index) => {
    const openTime = bar.timestamp * timeMultiplier;

    // Compute closeTime from next bar's openTime, or estimate for last bar
    let closeTime: number;
    if (index < data.length - 1) {
      // Use next bar's openTime as closeTime
      closeTime = data[index + 1].timestamp * timeMultiplier;
    } else {
      // For last bar, estimate based on the gap between previous bars
      if (data.length > 1) {
        const prevGap = data[index].timestamp - data[index - 1].timestamp;
        closeTime = bar.timestamp * timeMultiplier + prevGap * timeMultiplier;
      } else {
        // Single bar: estimate 1 hour gap (3600 seconds)
        closeTime = openTime + 3600000; // 1 hour in milliseconds
      }
    }

    return {
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      openTime,
      closeTime,
    };
  });
}
