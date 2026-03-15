/**
 * Factor weight calculation.
 *
 * Computes portfolio-style weights for surviving alpha factors.
 * Supports three methods:
 * - equal: all factors get the same weight
 * - inverse-volatility: less volatile factors get more weight
 * - sharpe-weighted: factors with higher Sharpe get more weight
 */

import type { PerformanceMetrics } from "@pinescript-utils/core";
import type { WeightingMethod } from "./types.js";

interface WeightableItem {
  name: string;
  metrics: PerformanceMetrics;
}

/**
 * Calculate normalized weights for a set of factors.
 * All weights sum to 1.0.
 */
export function calculateFactorWeights(
  factors: WeightableItem[],
  method: WeightingMethod,
): Record<string, number> {
  if (factors.length === 0) return {};
  if (factors.length === 1) return { [factors[0].name]: 1 };

  let rawWeights: number[];

  switch (method) {
    case "equal":
      rawWeights = factors.map(() => 1);
      break;

    case "inverse-volatility":
      rawWeights = factors.map((f) => {
        const vol = Math.abs(f.metrics.volatility);
        if (!isFinite(vol)) return 1;
        // Avoid division by zero; low-vol factors get high weight
        return vol > 0.001 ? 1 / vol : 1000;
      });
      break;

    case "sharpe-weighted":
      rawWeights = factors.map((f) => {
        const sharpe = f.metrics.sharpeRatio;
        if (!isFinite(sharpe)) return 1;
        // Floor at 0.01 to avoid negative or zero weights.
        // Negative-Sharpe factors still participate (they survived pruning)
        // but get minimal weight rather than inverting the signal.
        return Math.max(0.01, sharpe);
      });
      break;

    default:
      rawWeights = factors.map(() => 1);
  }

  // Normalize so weights sum to 1.0
  const total = rawWeights.reduce((sum, w) => sum + w, 0);
  const weights: Record<string, number> = {};
  for (let i = 0; i < factors.length; i++) {
    weights[factors[i].name] =
      total > 0 ? rawWeights[i] / total : 1 / factors.length;
  }

  return weights;
}
