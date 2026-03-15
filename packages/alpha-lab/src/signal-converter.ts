/**
 * Signal-to-position converter.
 *
 * Converts discrete Signal[] (buy/sell events) into a per-bar position
 * time-series that can be used for cross-factor correlation analysis
 * and weighted combination.
 *
 * Position values: +1 = long, 0 = flat, -1 = short
 */

import type { Signal, OHLCV } from "@pinescript-utils/core";

/**
 * Convert a Signal array into a per-bar position series.
 *
 * Walks through each bar chronologically. When a buy signal occurs,
 * position becomes +1. When a sell signal occurs, position becomes 0.
 * Between signals the previous position is carried forward.
 *
 * @returns Array of numbers with one entry per bar in `data`.
 */
export function signalsToPositionSeries(
  signals: Signal[],
  data: OHLCV[],
): number[] {
  if (data.length === 0) return [];

  // Index signals by timestamp for fast lookup
  const signalMap = new Map<number, Signal>();
  for (const signal of signals) {
    // If multiple signals on the same bar, last one wins
    signalMap.set(signal.timestamp, signal);
  }

  const positions: number[] = new Array(data.length).fill(0);
  let currentPosition = 0;

  for (let i = 0; i < data.length; i++) {
    const signal = signalMap.get(data[i].timestamp);
    if (signal) {
      if (signal.action === "buy") {
        currentPosition = 1;
      } else if (signal.action === "sell") {
        currentPosition = 0;
      }
    }
    positions[i] = currentPosition;
  }

  return positions;
}

/**
 * Combine multiple position series into a single signal stream using
 * weighted voting.
 *
 * At each bar, the combined score = sum(weight_i * position_i).
 * If the score exceeds `entryThreshold`, generate a buy signal.
 * If the score drops below `exitThreshold`, generate a sell signal.
 *
 * @param factors - Array of { positions, weight } for each factor
 * @param data - OHLCV data to attach timestamps/prices to signals
 * @param entryThreshold - Score above which we go long. Default: 0.3
 * @param exitThreshold - Score below which we exit. Default: 0.1
 */
export function combinePositionSeries(
  factors: { positions: number[]; weight: number }[],
  data: OHLCV[],
  entryThreshold = 0.3,
  exitThreshold = 0.1,
): Signal[] {
  if (data.length === 0 || factors.length === 0) return [];

  const barCount = data.length;
  const signals: Signal[] = [];
  let inPosition = false;

  for (let i = 0; i < barCount; i++) {
    // Weighted vote across all factors for this bar
    let score = 0;
    for (const factor of factors) {
      if (i < factor.positions.length) {
        const contribution = factor.weight * factor.positions[i];
        if (!isFinite(contribution)) continue;
        score += contribution;
      }
    }

    if (!inPosition && score >= entryThreshold) {
      signals.push({
        timestamp: data[i].timestamp,
        action: "buy",
        price: data[i].close,
      });
      inPosition = true;
    } else if (inPosition && score < exitThreshold) {
      signals.push({
        timestamp: data[i].timestamp,
        action: "sell",
        price: data[i].close,
      });
      inPosition = false;
    }
  }

  return signals;
}
