import type {
  OHLCV,
  BacktestResult,
  PerformanceMetrics,
} from "@pinescript-utils/core";
import {
  SimplePineRuntime,
  type StrategyParameter,
} from "@pinescript-utils/pine-runtime";
import { BacktestEngine, DEFAULT_CONFIG } from "@pinescript-utils/backtester";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Range definition for a single parameter */
export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

/** Result of a single optimization run */
export interface OptimizationRun {
  params: Record<string, number>;
  result: BacktestResult;
  score: number;
}

/** Configuration for the optimizer */
export interface OptimizerConfig {
  /** Metric to optimize for. Default: "sharpe" */
  objective: OptimizationObjective;
  /** Minimum trades required for a valid result. Default: 3 */
  minTrades: number;
  /** Initial capital for backtests. Default: 10000 */
  initialCapital: number;
  /** Custom parameter ranges — overrides what extractParameters() finds */
  parameterRanges?: ParameterRange[];
  /** Position size fraction (0-1). Default: uses BacktestEngine defaults */
  positionSize?: number;
  /** Commission rate. Default: uses BacktestEngine defaults */
  commission?: number;
  /** Progress callback — called after each run */
  onProgress?: (completed: number, total: number, best: OptimizationRun | null) => void;
}

export type OptimizationObjective =
  | "sharpe"
  | "sortino"
  | "return"
  | "winRate"
  | "profitFactor"
  | "calmar"    // return / maxDrawdown
  | "expectancy";

/** Summary of optimization results */
export interface OptimizationResult {
  /** All runs sorted by score descending */
  runs: OptimizationRun[];
  /** Best run */
  best: OptimizationRun;
  /** Strategy parameters with their ranges */
  parameters: StrategyParameter[];
  /** Total combinations tested */
  totalCombinations: number;
  /** Time elapsed in ms */
  elapsedMs: number;
  /** Objective function used */
  objective: OptimizationObjective;
}

// ──────────────────────────────────────────────
// Default config
// ──────────────────────────────────────────────

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  objective: "sharpe",
  minTrades: 3,
  initialCapital: 10000,
};

// ──────────────────────────────────────────────
// Optimizer
// ──────────────────────────────────────────────

export class StrategyOptimizer {
  private runtime = new SimplePineRuntime();

  /**
   * Extract parameters from a script and generate default ranges.
   * If the parameter has minval/maxval from input(), use those.
   * Otherwise, generate a range around the default value.
   */
  getParameterRanges(script: string): ParameterRange[] {
    const params = this.runtime.extractParameters(script);
    return params.map((p) => {
      const min = p.minval ?? Math.max(1, Math.round(p.defaultValue * 0.25));
      const max = p.maxval ?? Math.round(p.defaultValue * 4);
      const step = p.step ?? Math.max(1, Math.round((max - min) / 10));
      return { name: p.name, min, max, step };
    });
  }

  /**
   * Run grid-search optimization over a strategy's input() parameters.
   */
  async optimize(
    script: string,
    data: OHLCV[],
    symbol: string,
    config: Partial<OptimizerConfig> = {}
  ): Promise<OptimizationResult> {
    const cfg: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };
    const startTime = Date.now();

    // Get parameter ranges
    const ranges = cfg.parameterRanges ?? this.getParameterRanges(script);

    // Generate all combinations
    const combinations = this.generateCombinations(ranges);
    const totalCombinations = combinations.length;

    if (totalCombinations === 0) {
      throw new Error(
        "No parameter combinations to test. Ensure the strategy has input() parameters."
      );
    }

    // Set up backtest engine config
    const engineConfig = {
      ...DEFAULT_CONFIG,
      initialCapital: cfg.initialCapital,
    };
    if (cfg.positionSize !== undefined)
      engineConfig.positionSize = cfg.positionSize;
    if (cfg.commission !== undefined) engineConfig.commission = cfg.commission;

    // Run all combinations in batches for better throughput
    const runs: OptimizationRun[] = [];
    let best: OptimizationRun | null = null;
    const batchSize = Math.min(16, Math.max(1, Math.ceil(combinations.length / 4)));
    let completed = 0;

    for (let batchStart = 0; batchStart < combinations.length; batchStart += batchSize) {
      const batch = combinations.slice(batchStart, batchStart + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (params) => {
          try {
            const signals = await this.runtime.executeStrategy(
              script,
              data,
              cfg.initialCapital,
              params
            );

            // Each batch item gets its own engine instance to avoid state leaks
            const batchEngine = new BacktestEngine(engineConfig);
            const result = await batchEngine.run(signals, data, symbol);

            if (result.metrics.totalTrades < cfg.minTrades) return null;

            const score = this.scoreResult(result.metrics, cfg.objective);
            return { params, result, score } as OptimizationRun;
          } catch {
            return null;
          }
        })
      );

      for (const run of batchResults) {
        completed++;
        if (run) {
          runs.push(run);
          if (!best || run.score > best.score) {
            best = run;
          }
        }
        cfg.onProgress?.(completed, totalCombinations, best);
      }
    }

    // Sort by score descending
    runs.sort((a, b) => b.score - a.score);

    if (runs.length === 0 || !best) {
      throw new Error(
        `No valid optimization results. Tested ${totalCombinations} combinations, ` +
          `but none produced >= ${cfg.minTrades} trades.`
      );
    }

    return {
      runs,
      best,
      parameters: this.runtime.extractParameters(script),
      totalCombinations,
      elapsedMs: Date.now() - startTime,
      objective: cfg.objective,
    };
  }

  /**
   * Generate all parameter combinations from ranges (cartesian product).
   */
  private generateCombinations(
    ranges: ParameterRange[]
  ): Record<string, number>[] {
    if (ranges.length === 0) return [];

    // Generate value arrays for each parameter
    const paramValues: { name: string; values: number[] }[] = ranges.map(
      (r) => {
        const values: number[] = [];
        for (let v = r.min; v <= r.max; v += r.step) {
          values.push(Math.round(v * 1000) / 1000); // avoid float drift
        }
        // Ensure max is included
        if (values.length > 0 && values[values.length - 1] < r.max) {
          values.push(r.max);
        }
        return { name: r.name, values };
      }
    );

    // Cartesian product
    let combos: Record<string, number>[] = [{}];
    for (const pv of paramValues) {
      const next: Record<string, number>[] = [];
      for (const combo of combos) {
        for (const val of pv.values) {
          next.push({ ...combo, [pv.name]: val });
        }
      }
      combos = next;
    }

    return combos;
  }

  /**
   * Score a backtest result based on the chosen objective.
   */
  private scoreResult(
    m: PerformanceMetrics,
    objective: OptimizationObjective
  ): number {
    switch (objective) {
      case "sharpe":
        return isFinite(m.sharpeRatio) ? m.sharpeRatio : -999;
      case "sortino":
        return isFinite(m.sortinoRatio) ? m.sortinoRatio : -999;
      case "return":
        return isFinite(m.totalReturn) ? m.totalReturn : -999;
      case "winRate":
        return m.winRate;
      case "profitFactor":
        return isFinite(m.profitFactor) ? m.profitFactor : -999;
      case "calmar":
        if (m.maxDrawdown === 0) return m.totalReturn > 0 ? 999 : -999;
        return m.totalReturn / m.maxDrawdown;
      case "expectancy":
        return isFinite(m.expectancy) ? m.expectancy : -999;
    }
  }

  /**
   * Format optimization results as a markdown table.
   */
  formatResultsTable(
    result: OptimizationResult,
    topN: number = 10
  ): string {
    const top = result.runs.slice(0, topN);
    const paramNames = result.parameters.map((p) => p.name);

    // Header
    const headers = [
      "Rank",
      ...paramNames,
      "Return",
      "Sharpe",
      "Max DD",
      "Win Rate",
      "Trades",
      "Score",
    ];
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `|${headers.map(() => "------").join("|")}|`;

    // Rows
    const rows = top.map((run, i) => {
      const paramVals = paramNames.map((n) => String(run.params[n] ?? "-"));
      const m = run.result.metrics;
      return `| ${i + 1} | ${paramVals.join(" | ")} | ${(m.totalReturn * 100).toFixed(2)}% | ${m.sharpeRatio.toFixed(2)} | ${(m.maxDrawdown * 100).toFixed(2)}% | ${(m.winRate * 100).toFixed(1)}% | ${m.totalTrades} | ${run.score.toFixed(3)} |`;
    });

    return [headerRow, separator, ...rows].join("\n");
  }

  /**
   * Generate a text summary of optimization results.
   */
  formatSummary(result: OptimizationResult): string {
    const b = result.best;
    const m = b.result.metrics;
    const paramStr = Object.entries(b.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");

    return [
      `Optimization Complete`,
      `=====================`,
      `Objective: ${result.objective}`,
      `Tested: ${result.totalCombinations} combinations`,
      `Valid: ${result.runs.length} results (>= minTrades)`,
      `Time: ${(result.elapsedMs / 1000).toFixed(1)}s`,
      ``,
      `Best Parameters: ${paramStr}`,
      `Best Score: ${b.score.toFixed(4)}`,
      `Return: ${(m.totalReturn * 100).toFixed(2)}%`,
      `Sharpe: ${m.sharpeRatio.toFixed(2)}`,
      `Max Drawdown: ${(m.maxDrawdown * 100).toFixed(2)}%`,
      `Win Rate: ${(m.winRate * 100).toFixed(1)}%`,
      `Trades: ${m.totalTrades}`,
    ].join("\n");
  }
}
