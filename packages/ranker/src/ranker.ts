import type {
  BacktestResult,
  PerformanceMetrics,
  Signal,
  OHLCV,
} from "@pinescript-utils/core";

/**
 * Strategy definition for ranking
 */
export interface StrategyDefinition {
  name: string;
  description?: string;
  signals: Signal[];
}

/**
 * Ranked strategy with results
 */
export interface RankedStrategy {
  name: string;
  description?: string;
  result: BacktestResult;
  score: number;
  rank: number;
}

/**
 * Ranking configuration
 */
export interface RankingConfig {
  /** Weight for total return (0-1) */
  returnWeight: number;
  /** Weight for Sharpe ratio (0-1) */
  sharpeWeight: number;
  /** Weight for max drawdown (0-1) */
  drawdownWeight: number;
  /** Weight for win rate (0-1) */
  winRateWeight: number;
  /** Weight for profit factor (0-1) */
  profitFactorWeight: number;
  /** Minimum number of trades required */
  minTrades: number;
  /** Sort direction */
  sortBy: "score" | "return" | "sharpe" | "drawdown";
}

/**
 * Default ranking configuration
 */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  returnWeight: 0.25,
  sharpeWeight: 0.25,
  drawdownWeight: 0.2,
  winRateWeight: 0.15,
  profitFactorWeight: 0.15,
  minTrades: 5,
  sortBy: "score",
};

/**
 * Strategy ranker - compares multiple strategies
 */
export class StrategyRanker {
  private config: RankingConfig;

  constructor(config: Partial<RankingConfig> = {}) {
    this.config = { ...DEFAULT_RANKING_CONFIG, ...config };
  }

  /**
   * Rank multiple strategies
   */
  async rankStrategies(
    strategies: StrategyDefinition[],
    data: OHLCV[],
    symbol: string
  ): Promise<RankedStrategy[]> {
    const { quickBacktest } = await import("@pinescript-utils/backtester");

    // Backtest all strategies
    const results: RankedStrategy[] = [];

    for (const strategy of strategies) {
      try {
        const result = await quickBacktest(
          strategy.signals,
          data,
          symbol,
          10000
        );

        // Skip strategies with too few trades
        if (result.metrics.totalTrades < this.config.minTrades) {
          continue;
        }

        const score = this.calculateScore(result.metrics);

        results.push({
          name: strategy.name,
          description: strategy.description,
          result,
          score,
          rank: 0, // Will be set after sorting
        });
      } catch (error) {
        console.warn(`Failed to backtest strategy ${strategy.name}:`, error);
      }
    }

    // Sort by the configured criteria
    this.sortResults(results);

    // Assign ranks
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    return results;
  }

  /**
   * Calculate composite score for a strategy
   */
  private calculateScore(metrics: PerformanceMetrics): number {
    // Normalize each metric to 0-1 scale
    const normalizedReturn = this.normalizeReturn(metrics.totalReturn);
    const normalizedSharpe = this.normalizeSharpe(metrics.sharpeRatio);
    const normalizedDrawdown = this.normalizeDrawdown(metrics.maxDrawdown);
    const normalizedWinRate = metrics.winRate;
    const normalizedProfitFactor = this.normalizeProfitFactor(
      metrics.profitFactor
    );

    // Calculate weighted score
    const score =
      normalizedReturn * this.config.returnWeight +
      normalizedSharpe * this.config.sharpeWeight +
      normalizedDrawdown * this.config.drawdownWeight +
      normalizedWinRate * this.config.winRateWeight +
      normalizedProfitFactor * this.config.profitFactorWeight;

    return score;
  }

  /**
   * Normalize return to 0-1 (assuming -50% to +100% range)
   */
  private normalizeReturn(totalReturn: number): number {
    const min = -0.5;
    const max = 1.0;
    return Math.max(0, Math.min(1, (totalReturn - min) / (max - min)));
  }

  /**
   * Normalize Sharpe ratio to 0-1 (assuming 0 to 3 range)
   */
  private normalizeSharpe(sharpe: number): number {
    const min = 0;
    const max = 3;
    return Math.max(0, Math.min(1, (sharpe - min) / (max - min)));
  }

  /**
   * Normalize drawdown (lower is better, so we invert)
   */
  private normalizeDrawdown(drawdown: number): number {
    // Drawdown is negative (e.g., -0.2 for 20% drawdown)
    // We want lower drawdown to give higher score
    const absDrawdown = Math.abs(drawdown);
    const maxAcceptable = 0.5; // 50% drawdown
    return Math.max(0, 1 - absDrawdown / maxAcceptable);
  }

  /**
   * Normalize profit factor to 0-1 (assuming 0 to 3 range)
   */
  private normalizeProfitFactor(profitFactor: number): number {
    const max = 3;
    return Math.min(1, profitFactor / max);
  }

  /**
   * Sort results based on configuration
   */
  private sortResults(results: RankedStrategy[]): void {
    switch (this.config.sortBy) {
      case "return":
        results.sort(
          (a, b) => b.result.metrics.totalReturn - a.result.metrics.totalReturn
        );
        break;
      case "sharpe":
        results.sort(
          (a, b) => b.result.metrics.sharpeRatio - a.result.metrics.sharpeRatio
        );
        break;
      case "drawdown":
        // Lower drawdown is better
        results.sort(
          (a, b) =>
            Math.abs(a.result.metrics.maxDrawdown) -
            Math.abs(b.result.metrics.maxDrawdown)
        );
        break;
      case "score":
      default:
        results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * Generate a comparison table
   */
  generateComparisonTable(results: RankedStrategy[]): string {
    const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
    const formatNumber = (v: number, decimals = 2) => v.toFixed(decimals);

    let table = `
| Rank | Strategy | Return | Sharpe | Max DD | Win Rate | Trades | Score |
|------|----------|--------|--------|--------|----------|--------|-------|
`;

    for (const r of results.slice(0, 20)) {
      // Top 20
      table += `| ${r.rank} | ${r.name} | ${formatPercent(
        r.result.metrics.totalReturn
      )} | ${formatNumber(r.result.metrics.sharpeRatio)} | ${formatPercent(
        r.result.metrics.maxDrawdown
      )} | ${formatPercent(r.result.metrics.winRate)} | ${
        r.result.metrics.totalTrades
      } | ${formatNumber(r.score)} |\n`;
    }

    return table;
  }

  /**
   * Generate a summary report
   */
  generateSummary(results: RankedStrategy[]): string {
    if (results.length === 0) {
      return "No strategies met the minimum criteria.";
    }

    const winner = results[0];
    const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;

    return `
🏆 Strategy Ranking Results
=============================

Winner: ${winner.name}
Score: ${winner.score.toFixed(3)}

Key Metrics:
- Total Return: ${formatPercent(winner.result.metrics.totalReturn)}
- Sharpe Ratio: ${winner.result.metrics.sharpeRatio.toFixed(2)}
- Max Drawdown: ${formatPercent(winner.result.metrics.maxDrawdown)}
- Win Rate: ${formatPercent(winner.result.metrics.winRate)}
- Total Trades: ${winner.result.metrics.totalTrades}

Top 3 Strategies:
${results
  .slice(0, 3)
  .map(
    (r, i) =>
      `${i + 1}. ${r.name} (Score: ${r.score.toFixed(
        3
      )}, Return: ${formatPercent(r.result.metrics.totalReturn)})`
  )
  .join("\n")}

Analyzed ${results.length} strategies total.
`;
  }
}

/**
 * Quick rank multiple strategies
 */
export async function rankStrategies(
  strategies: StrategyDefinition[],
  data: OHLCV[],
  symbol: string,
  config?: Partial<RankingConfig>
): Promise<RankedStrategy[]> {
  const ranker = new StrategyRanker(config);
  return ranker.rankStrategies(strategies, data, symbol);
}

export default StrategyRanker;
