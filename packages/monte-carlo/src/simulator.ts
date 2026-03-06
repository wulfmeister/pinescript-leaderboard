import type {
  BacktestResult,
  MonteCarloResult,
  PercentileDistribution,
} from "@pinescript-utils/core";
import {
  calculateSharpeRatio,
  calculateMaxDrawdown,
} from "@pinescript-utils/core";
import { buildDistribution, seededShuffle, createSeededRandom } from "./statistics.js";

export interface MonteCarloConfig {
  /** Number of simulations to run */
  simulations?: number;
  /** Initial capital for each simulation */
  initialCapital?: number;
  /** Equity threshold for ruin (as fraction, e.g. 0.5 = 50% of initial capital) */
  ruinThreshold?: number;
  /** Seed for reproducibility (0 = random) */
  seed?: number;
  /** Whether to return all equity curves */
  returnEquityCurves?: boolean;
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Run a Monte Carlo simulation on backtest results.
 * Shuffles the order of trade PnLs to test robustness.
 */
export function runMonteCarloSimulation(
  backtestResult: BacktestResult,
  config: MonteCarloConfig = {},
): MonteCarloResult {
  const startTime = Date.now();

  const {
    simulations = 1000,
    initialCapital = backtestResult.initialCapital,
    ruinThreshold = 0.5,
    seed = 42,
    returnEquityCurves = false,
    onProgress,
  } = config;

  // Extract closing trade PnLs
  const tradePnls = backtestResult.trades
    .filter((t) => t.pnl !== undefined)
    .map((t) => t.pnl!);

  if (tradePnls.length === 0) {
    return {
      simulations,
      finalEquity: buildDistribution([initialCapital]),
      totalReturn: buildDistribution([0]),
      maxDrawdown: buildDistribution([0]),
      sharpeRatio: buildDistribution([0]),
      probabilityOfRuin: 0,
      ruinThreshold,
      expectedMaxDrawdown: 0,
      elapsedMs: Date.now() - startTime,
    };
  }

  const random = createSeededRandom(seed);

  const finalEquities: number[] = [];
  const totalReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  const sharpeRatios: number[] = [];
  const equityCurves: number[][] = [];
  let ruinCount = 0;
  const ruinLevel = initialCapital * ruinThreshold;

  for (let sim = 0; sim < simulations; sim++) {
    // Shuffle trade PnLs
    const shuffledPnls = seededShuffle(tradePnls, random);

    // Replay from initial capital
    let equity = initialCapital;
    let peak = initialCapital;
    let maxDD = 0;
    let ruined = false;
    const curve: number[] = [equity];
    const returns: number[] = [];

    for (const pnl of shuffledPnls) {
      const prevEquity = equity;
      equity += pnl;
      curve.push(equity);

      if (prevEquity > 0) {
        returns.push((equity - prevEquity) / prevEquity);
      }

      if (equity > peak) {
        peak = equity;
      }
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;

      if (equity <= ruinLevel) {
        ruined = true;
      }
    }

    finalEquities.push(equity);
    totalReturns.push((equity - initialCapital) / initialCapital);
    maxDrawdowns.push(maxDD);
    sharpeRatios.push(calculateSharpeRatio(returns));
    if (ruined) ruinCount++;
    if (returnEquityCurves) equityCurves.push(curve);

    if (onProgress && (sim + 1) % 100 === 0) {
      onProgress(sim + 1, simulations);
    }
  }

  if (onProgress) {
    onProgress(simulations, simulations);
  }

  return {
    simulations,
    finalEquity: buildDistribution(finalEquities),
    totalReturn: buildDistribution(totalReturns),
    maxDrawdown: buildDistribution(maxDrawdowns),
    sharpeRatio: buildDistribution(sharpeRatios),
    probabilityOfRuin: ruinCount / simulations,
    ruinThreshold,
    expectedMaxDrawdown: maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length,
    equityCurves: returnEquityCurves ? equityCurves : undefined,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * MonteCarloSimulator class for convenience
 */
export class MonteCarloSimulator {
  private config: MonteCarloConfig;

  constructor(config: MonteCarloConfig = {}) {
    this.config = config;
  }

  simulate(backtestResult: BacktestResult): MonteCarloResult {
    return runMonteCarloSimulation(backtestResult, this.config);
  }

  formatSummary(result: MonteCarloResult): string {
    const lines: string[] = [];
    lines.push("Monte Carlo Simulation Results");
    lines.push("==============================");
    lines.push(`Simulations: ${result.simulations}`);
    lines.push("");

    lines.push("Final Equity Distribution:");
    lines.push(formatDistribution(result.finalEquity, "$"));
    lines.push("");

    lines.push("Total Return Distribution:");
    lines.push(formatDistribution(result.totalReturn, "%"));
    lines.push("");

    lines.push("Max Drawdown Distribution:");
    lines.push(formatDistribution(result.maxDrawdown, "%"));
    lines.push("");

    lines.push("Sharpe Ratio Distribution:");
    lines.push(formatDistribution(result.sharpeRatio));
    lines.push("");

    lines.push(`Probability of Ruin (equity < ${(result.ruinThreshold * 100).toFixed(0)}%): ${(result.probabilityOfRuin * 100).toFixed(1)}%`);
    lines.push(`Expected Max Drawdown: ${(result.expectedMaxDrawdown * 100).toFixed(1)}%`);
    lines.push(`Time: ${result.elapsedMs}ms`);

    return lines.join("\n");
  }
}

function formatDistribution(dist: PercentileDistribution, unit: string = ""): string {
  const fmt = (v: number) => {
    if (unit === "$") return `$${v.toFixed(2)}`;
    if (unit === "%") return `${(v * 100).toFixed(2)}%`;
    return v.toFixed(4);
  };
  return [
    `  P5:   ${fmt(dist.p5)}`,
    `  P25:  ${fmt(dist.p25)}`,
    `  P50:  ${fmt(dist.p50)}  (median)`,
    `  P75:  ${fmt(dist.p75)}`,
    `  P95:  ${fmt(dist.p95)}`,
    `  Mean: ${fmt(dist.mean)}`,
    `  StdDev: ${fmt(dist.stdDev)}`,
  ].join("\n");
}
