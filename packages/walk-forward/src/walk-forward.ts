import type {
  OHLCV,
  BacktestResult,
  PerformanceMetrics,
} from "@pinescript-utils/core";
import {
  StrategyOptimizer,
  type OptimizerConfig,
  type OptimizationObjective,
  type ParameterRange,
} from "@pinescript-utils/optimizer";
import { SimplePineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine, DEFAULT_CONFIG } from "@pinescript-utils/backtester";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface WalkForwardConfig {
  /** Number of walk-forward windows. Default: 5 */
  windows: number;
  /** Fraction of each window used for training (optimization). Default: 0.7 */
  trainRatio: number;
  /** Optimization objective. Default: "sharpe" */
  objective: OptimizationObjective;
  /** Min trades per optimization run. Default: 3 */
  minTrades: number;
  /** Initial capital. Default: 10000 */
  initialCapital: number;
  /** Custom parameter ranges */
  parameterRanges?: ParameterRange[];
  /** Progress callback */
  onProgress?: (window: number, total: number, phase: "train" | "test") => void;
}

export interface WindowResult {
  windowIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  trainBars: number;
  testBars: number;
  /** Best parameters found during training */
  bestParams: Record<string, number>;
  /** Training optimization score */
  trainScore: number;
  /** Training metrics (in-sample) */
  trainMetrics: PerformanceMetrics;
  /** Test metrics (out-of-sample) */
  testMetrics: PerformanceMetrics;
  /** Test backtest result */
  testResult: BacktestResult;
}

export interface WalkForwardResult {
  windows: WindowResult[];
  /** Aggregate out-of-sample metrics */
  aggregateMetrics: AggregateMetrics;
  /** Walk-forward efficiency: average(test score) / average(train score) */
  efficiency: number;
  /** Total elapsed time in ms */
  elapsedMs: number;
  /** Configuration used */
  config: WalkForwardConfig;
}

export interface AggregateMetrics {
  avgReturn: number;
  avgSharpe: number;
  avgMaxDrawdown: number;
  avgWinRate: number;
  avgTrades: number;
  totalTrades: number;
  /** % of windows where test was profitable */
  profitableWindows: number;
  /** % of windows where test score > 0 */
  positiveScoreWindows: number;
}

// ──────────────────────────────────────────────
// Default config
// ──────────────────────────────────────────────

export const DEFAULT_WF_CONFIG: WalkForwardConfig = {
  windows: 5,
  trainRatio: 0.7,
  objective: "sharpe",
  minTrades: 3,
  initialCapital: 10000,
};

// ──────────────────────────────────────────────
// Walk-Forward Analyzer
// ──────────────────────────────────────────────

export class WalkForwardAnalyzer {
  private optimizer = new StrategyOptimizer();
  private runtime = new SimplePineRuntime();

  /**
   * Run walk-forward analysis on a strategy.
   *
   * Splits data into `windows` rolling segments. For each window:
   * 1. Train: optimize parameters on the first `trainRatio` of the window
   * 2. Test: backtest with those parameters on the remaining data
   *
   * This validates that optimized parameters generalize to unseen data.
   */
  async analyze(
    script: string,
    data: OHLCV[],
    symbol: string,
    config: Partial<WalkForwardConfig> = {}
  ): Promise<WalkForwardResult> {
    const cfg: WalkForwardConfig = { ...DEFAULT_WF_CONFIG, ...config };
    const startTime = Date.now();

    const totalBars = data.length;
    const windowSize = Math.floor(totalBars / cfg.windows);

    if (windowSize < 20) {
      throw new Error(
        `Not enough data for ${cfg.windows} windows. Need at least ${cfg.windows * 20} bars, got ${totalBars}.`
      );
    }

    const ranges = cfg.parameterRanges ?? this.optimizer.getParameterRanges(script);
    const windows: WindowResult[] = [];

    for (let w = 0; w < cfg.windows; w++) {
      const wStart = w * windowSize;
      const wEnd = w === cfg.windows - 1 ? totalBars : (w + 1) * windowSize;
      const windowData = data.slice(wStart, wEnd);

      const trainSize = Math.floor(windowData.length * cfg.trainRatio);
      const trainData = windowData.slice(0, trainSize);
      const testData = windowData.slice(trainSize);

      if (trainData.length < 10 || testData.length < 5) continue;

      cfg.onProgress?.(w + 1, cfg.windows, "train");

      // ── Train: optimize on training data ──
      let bestParams: Record<string, number> = {};
      let trainScore = -999;
      let trainMetrics: PerformanceMetrics | null = null;

      try {
        const optResult = await this.optimizer.optimize(
          script,
          trainData,
          symbol,
          {
            objective: cfg.objective,
            minTrades: Math.max(1, Math.floor(cfg.minTrades / 2)),
            initialCapital: cfg.initialCapital,
            parameterRanges: ranges,
          }
        );
        bestParams = optResult.best.params;
        trainScore = optResult.best.score;
        trainMetrics = optResult.best.result.metrics;
      } catch {
        // If optimization fails (no valid results), skip this window
        continue;
      }

      cfg.onProgress?.(w + 1, cfg.windows, "test");

      // ── Test: backtest on test data with optimized params ──
      const signals = await this.runtime.executeStrategy(
        script,
        testData,
        cfg.initialCapital,
        bestParams
      );

      const engine = new BacktestEngine({
        ...DEFAULT_CONFIG,
        initialCapital: cfg.initialCapital,
      });
      const testResult = await engine.run(signals, testData, symbol);

      windows.push({
        windowIndex: w,
        trainStart: trainData[0].timestamp,
        trainEnd: trainData[trainData.length - 1].timestamp,
        testStart: testData[0].timestamp,
        testEnd: testData[testData.length - 1].timestamp,
        trainBars: trainData.length,
        testBars: testData.length,
        bestParams,
        trainScore,
        trainMetrics: trainMetrics!,
        testMetrics: testResult.metrics,
        testResult,
      });
    }

    if (windows.length === 0) {
      throw new Error("Walk-forward analysis produced no valid windows.");
    }

    // Compute aggregate metrics
    const aggregateMetrics = this.computeAggregate(windows, cfg.objective);

    // Compute efficiency
    const avgTrainScore =
      windows.reduce((s, w) => s + w.trainScore, 0) / windows.length;
    const avgTestScore =
      windows.reduce((s, w) => s + this.getScore(w.testMetrics, cfg.objective), 0) /
      windows.length;
    const efficiency =
      avgTrainScore !== 0 ? avgTestScore / avgTrainScore : 0;

    return {
      windows,
      aggregateMetrics,
      efficiency,
      elapsedMs: Date.now() - startTime,
      config: cfg,
    };
  }

  private getScore(m: PerformanceMetrics, obj: OptimizationObjective): number {
    switch (obj) {
      case "sharpe": return isFinite(m.sharpeRatio) ? m.sharpeRatio : -999;
      case "sortino": return isFinite(m.sortinoRatio) ? m.sortinoRatio : -999;
      case "return": return isFinite(m.totalReturn) ? m.totalReturn : -999;
      case "winRate": return m.winRate;
      case "profitFactor": return isFinite(m.profitFactor) ? m.profitFactor : -999;
      case "calmar":
        if (m.maxDrawdown === 0) return m.totalReturn > 0 ? 999 : -999;
        return m.totalReturn / m.maxDrawdown;
      case "expectancy": return isFinite(m.expectancy) ? m.expectancy : -999;
    }
  }

  private computeAggregate(
    windows: WindowResult[],
    objective: OptimizationObjective
  ): AggregateMetrics {
    const n = windows.length;
    const testMetrics = windows.map((w) => w.testMetrics);

    return {
      avgReturn: testMetrics.reduce((s, m) => s + m.totalReturn, 0) / n,
      avgSharpe: testMetrics.reduce((s, m) => s + m.sharpeRatio, 0) / n,
      avgMaxDrawdown: testMetrics.reduce((s, m) => s + m.maxDrawdown, 0) / n,
      avgWinRate: testMetrics.reduce((s, m) => s + m.winRate, 0) / n,
      avgTrades: testMetrics.reduce((s, m) => s + m.totalTrades, 0) / n,
      totalTrades: testMetrics.reduce((s, m) => s + m.totalTrades, 0),
      profitableWindows:
        testMetrics.filter((m) => m.totalReturn > 0).length / n,
      positiveScoreWindows:
        testMetrics.filter((m) => this.getScore(m, objective) > 0).length / n,
    };
  }

  /**
   * Format walk-forward results as a text summary.
   */
  formatSummary(result: WalkForwardResult): string {
    const a = result.aggregateMetrics;
    const lines = [
      `Walk-Forward Analysis`,
      `=====================`,
      `Windows: ${result.windows.length}`,
      `Train/Test Split: ${(result.config.trainRatio * 100).toFixed(0)}% / ${((1 - result.config.trainRatio) * 100).toFixed(0)}%`,
      `Objective: ${result.config.objective}`,
      `Time: ${(result.elapsedMs / 1000).toFixed(1)}s`,
      ``,
      `Walk-Forward Efficiency: ${(result.efficiency * 100).toFixed(1)}%`,
      `  (>50% = parameters generalize well)`,
      ``,
      `Out-of-Sample Aggregate:`,
      `  Avg Return: ${(a.avgReturn * 100).toFixed(2)}%`,
      `  Avg Sharpe: ${a.avgSharpe.toFixed(2)}`,
      `  Avg Max Drawdown: ${(a.avgMaxDrawdown * 100).toFixed(2)}%`,
      `  Avg Win Rate: ${(a.avgWinRate * 100).toFixed(1)}%`,
      `  Total Trades: ${a.totalTrades}`,
      `  Profitable Windows: ${(a.profitableWindows * 100).toFixed(0)}%`,
    ];
    return lines.join("\n");
  }

  /**
   * Format window details as a markdown table.
   */
  formatWindowsTable(result: WalkForwardResult): string {
    const paramNames = Object.keys(result.windows[0]?.bestParams ?? {});

    const headers = [
      "Window",
      ...paramNames,
      "Train Score",
      "Test Return",
      "Test Sharpe",
      "Test DD",
      "Test Trades",
    ];
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `|${headers.map(() => "------").join("|")}|`;

    const rows = result.windows.map((w) => {
      const paramVals = paramNames.map((n) => String(w.bestParams[n] ?? "-"));
      const tm = w.testMetrics;
      return `| ${w.windowIndex + 1} | ${paramVals.join(" | ")} | ${w.trainScore.toFixed(3)} | ${(tm.totalReturn * 100).toFixed(2)}% | ${tm.sharpeRatio.toFixed(2)} | ${(tm.maxDrawdown * 100).toFixed(2)}% | ${tm.totalTrades} |`;
    });

    return [headerRow, separator, ...rows].join("\n");
  }
}
