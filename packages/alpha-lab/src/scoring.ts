/**
 * Centralized scoring function for Alpha Lab.
 *
 * Extracts the scoring logic used by optimizer/walk-forward/arena
 * into a single place so all three modes score consistently.
 */

import type { PerformanceMetrics } from "@pinescript-utils/core";
import type { OptimizationObjective } from "@pinescript-utils/optimizer";

/**
 * Score a backtest result by the chosen objective.
 * Returns a single numeric value where higher = better.
 */
export function scoreMetrics(
  metrics: PerformanceMetrics,
  objective: OptimizationObjective,
): number {
  let score: number;

  switch (objective) {
    case "sharpe":
      score = metrics.sharpeRatio;
      break;
    case "sortino":
      score = metrics.sortinoRatio;
      break;
    case "return":
      score = metrics.totalReturn;
      break;
    case "winRate":
      score = metrics.winRate;
      break;
    case "profitFactor":
      score = metrics.profitFactor;
      break;
    case "calmar":
      score =
        metrics.maxDrawdown !== 0
          ? metrics.totalReturn / Math.abs(metrics.maxDrawdown)
          : metrics.totalReturn > 0
            ? 100
            : -100;
      break;
    case "expectancy":
      score = metrics.expectancy;
      break;
    default:
      score = metrics.sharpeRatio;
  }

  return Number.isFinite(score) ? score : -999;
}
