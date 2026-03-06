import type {
  OHLCV,
  BacktestResult,
  PerformanceMetrics,
} from "@pinescript-utils/core";
import { SimplePineRuntime } from "@pinescript-utils/pine-runtime";
import { BacktestEngine, DEFAULT_CONFIG } from "@pinescript-utils/backtester";
import {
  VeniceClient,
  type VeniceConfig,
  type VeniceModel,
  VENICE_MODELS,
} from "@pinescript-utils/venice";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ArenaConfig {
  /** Venice API key */
  apiKey?: string;
  /** Venice API base URL override */
  baseUrl?: string;
  /** Models to compete */
  models: string[];
  /** Number of rounds per matchup. Default: 1 */
  rounds?: number;
  /** Initial capital for backtests. Default: 10000 */
  initialCapital?: number;
  /** K-factor for Elo updates. Default: 32 */
  eloK?: number;
  /** Starting Elo for all models. Default: 1500 */
  eloStart?: number;
  /** Progress callback */
  onProgress?: (event: ArenaEvent) => void;
  /** Test mode: provide pre-defined strategies instead of calling LLM */
  testStrategies?: Record<string, string>;
}

export type ArenaEvent =
  | { type: "round_start"; round: number; totalRounds: number; model: string; prompt: string }
  | { type: "generation_done"; model: string; codeLength: number }
  | { type: "generation_failed"; model: string; error: string }
  | { type: "backtest_done"; model: string; trades: number }
  | { type: "matchup_done"; model1: string; model2: string; winner: string | null }
  | { type: "tournament_done"; };

export interface CompetitorResult {
  model: string;
  prompt: string;
  generatedCode: string;
  backtestResult: BacktestResult | null;
  score: number;
  error?: string;
}

export interface MatchupResult {
  prompt: string;
  competitors: CompetitorResult[];
  winner: string | null; // model name or null for tie
}

export interface ArenaStandings {
  model: string;
  elo: number;
  wins: number;
  losses: number;
  ties: number;
  totalMatches: number;
  avgReturn: number;
  avgSharpe: number;
  avgTrades: number;
}

export interface ArenaResult {
  matchups: MatchupResult[];
  standings: ArenaStandings[];
  elapsedMs: number;
}

// ──────────────────────────────────────────────
// Default prompts for strategy generation
// ──────────────────────────────────────────────

export const ARENA_PROMPTS = [
  "Create a PineScript v5 strategy that uses RSI to identify overbought/oversold conditions. Buy when RSI crosses below 30, sell when it crosses above 70. Use a 14-period RSI with input() parameters.",
  "Create a PineScript v5 strategy that uses MACD crossovers. Buy when the MACD line crosses above the signal line, sell on the opposite cross. Include input() parameters for fast, slow, and signal lengths.",
  "Create a PineScript v5 strategy that uses Bollinger Bands for mean reversion. Buy when price touches the lower band, sell at the upper band. Include input() parameters for period and standard deviation.",
  "Create a PineScript v5 strategy using EMA crossover. Buy when the fast EMA crosses above the slow EMA, sell on the opposite cross. Use input() parameters for both EMA periods.",
  "Create a PineScript v5 strategy combining RSI and SMA. Only buy when RSI < 40 AND price is above the 50-period SMA. Sell when RSI > 60. Use input() parameters.",
];

// ──────────────────────────────────────────────
// Default config
// ──────────────────────────────────────────────

export const DEFAULT_ARENA_CONFIG: Omit<ArenaConfig, "apiKey"> = {
  models: [...VENICE_MODELS],
  rounds: 1,
  initialCapital: 10000,
  eloK: 32,
  eloStart: 1500,
};

// ──────────────────────────────────────────────
// Elo Rating System
// ──────────────────────────────────────────────

export class EloRating {
  private ratings: Map<string, number>;
  private k: number;

  constructor(players: string[], startRating: number, k: number) {
    this.ratings = new Map();
    for (const p of players) {
      this.ratings.set(p, startRating);
    }
    this.k = k;
  }

  getRating(player: string): number {
    return this.ratings.get(player) ?? 1500;
  }

  /**
   * Update ratings after a match.
   * result: 1 = player1 wins, 0 = player2 wins, 0.5 = draw
   */
  update(player1: string, player2: string, result: number): void {
    const r1 = this.getRating(player1);
    const r2 = this.getRating(player2);

    const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));

    this.ratings.set(player1, r1 + this.k * (result - e1));
    this.ratings.set(player2, r2 + this.k * ((1 - result) - e2));
  }

  getAll(): Map<string, number> {
    return new Map(this.ratings);
  }
}

// ──────────────────────────────────────────────
// Arena Engine
// ──────────────────────────────────────────────

type ResolvedArenaConfig = Required<Pick<ArenaConfig, "models" | "rounds" | "initialCapital" | "eloK" | "eloStart">> & ArenaConfig;

export class ArenaEngine {
  private runtime = new SimplePineRuntime();
  private client?: VeniceClient;
  private config: ResolvedArenaConfig;

  constructor(config: ArenaConfig) {
    this.config = { ...DEFAULT_ARENA_CONFIG, ...config } as ResolvedArenaConfig;
    if (config.apiKey) {
      this.client = new VeniceClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
    }
  }

  /**
   * Run a full tournament.
   * Each round picks a prompt, each model generates a strategy,
   * strategies are backtested, and Elo ratings are updated.
   */
  async runTournament(
    data: OHLCV[],
    symbol: string,
    prompts?: string[]
  ): Promise<ArenaResult> {
    const startTime = Date.now();
    const tournamentPrompts = prompts ?? ARENA_PROMPTS;
    const elo = new EloRating(
      this.config.models,
      this.config.eloStart,
      this.config.eloK
    );

    // Track wins/losses/ties
    const stats = new Map<string, { wins: number; losses: number; ties: number; returns: number[]; sharpes: number[]; trades: number[] }>();
    for (const m of this.config.models) {
      stats.set(m, { wins: 0, losses: 0, ties: 0, returns: [], sharpes: [], trades: [] });
    }

    const matchups: MatchupResult[] = [];

    for (let round = 0; round < this.config.rounds; round++) {
      const prompt = tournamentPrompts[round % tournamentPrompts.length];

      // Each model generates a strategy
      const competitors: CompetitorResult[] = [];

      for (const model of this.config.models) {
        this.config.onProgress?.({
          type: "round_start",
          round: round + 1,
          totalRounds: this.config.rounds,
          model,
          prompt,
        });

        let generatedCode = "";
        let backtestResult: BacktestResult | null = null;
        let score = -Infinity;
        let error: string | undefined;

        try {
          // Use test strategy if in test mode, otherwise call LLM
          if (this.config.testStrategies?.[model]) {
            generatedCode = this.config.testStrategies[model];
            // Add slight delay to simulate API call
            await new Promise(resolve => setTimeout(resolve, 100));
          } else if (!this.client) {
            throw new Error("No API key provided and no test strategy available");
          } else {
            generatedCode = await this.client.generateStrategy(prompt, { model });
          }
          this.config.onProgress?.({
            type: "generation_done",
            model,
            codeLength: generatedCode.length,
          });

          // Backtest the generated strategy
          const signals = await this.runtime.executeStrategy(
            generatedCode,
            data,
            this.config.initialCapital
          );

          const engine = new BacktestEngine({
            ...DEFAULT_CONFIG,
            initialCapital: this.config.initialCapital,
          });
          backtestResult = await engine.run(signals, data, symbol);
          score = this.scoreBacktest(backtestResult.metrics);

          this.config.onProgress?.({
            type: "backtest_done",
            model,
            trades: backtestResult.metrics.totalTrades,
          });

          // Track stats
          const s = stats.get(model)!;
          s.returns.push(backtestResult.metrics.totalReturn);
          s.sharpes.push(backtestResult.metrics.sharpeRatio);
          s.trades.push(backtestResult.metrics.totalTrades);
        } catch (e: any) {
          error = e.message;
          this.config.onProgress?.({
            type: "generation_failed",
            model,
            error: e.message,
          });
        }

        competitors.push({
          model,
          prompt,
          generatedCode,
          backtestResult,
          score,
          error,
        });
      }

      // Do pairwise Elo updates
      for (let i = 0; i < competitors.length; i++) {
        for (let j = i + 1; j < competitors.length; j++) {
          const c1 = competitors[i];
          const c2 = competitors[j];
          let result: number;
          let winner: string | null;

          if (c1.score > c2.score) {
            result = 1;
            winner = c1.model;
            stats.get(c1.model)!.wins++;
            stats.get(c2.model)!.losses++;
          } else if (c2.score > c1.score) {
            result = 0;
            winner = c2.model;
            stats.get(c2.model)!.wins++;
            stats.get(c1.model)!.losses++;
          } else {
            result = 0.5;
            winner = null;
            stats.get(c1.model)!.ties++;
            stats.get(c2.model)!.ties++;
          }

          elo.update(c1.model, c2.model, result);

          this.config.onProgress?.({
            type: "matchup_done",
            model1: c1.model,
            model2: c2.model,
            winner,
          });
        }
      }

      // Sort competitors by score for this round
      competitors.sort((a, b) => b.score - a.score);
      matchups.push({
        prompt,
        competitors,
        winner: competitors[0]?.score > -Infinity ? competitors[0].model : null,
      });
    }

    this.config.onProgress?.({ type: "tournament_done" });

    // Build standings
    const standings: ArenaStandings[] = this.config.models.map((model) => {
      const s = stats.get(model)!;
      const eloRating = elo.getRating(model);
      return {
        model,
        elo: Math.round(eloRating),
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        totalMatches: s.wins + s.losses + s.ties,
        avgReturn: s.returns.length > 0
          ? s.returns.reduce((a, b) => a + b, 0) / s.returns.length
          : 0,
        avgSharpe: s.sharpes.length > 0
          ? s.sharpes.reduce((a, b) => a + b, 0) / s.sharpes.length
          : 0,
        avgTrades: s.trades.length > 0
          ? s.trades.reduce((a, b) => a + b, 0) / s.trades.length
          : 0,
      };
    });

    // Sort by Elo descending
    standings.sort((a, b) => b.elo - a.elo);

    return {
      matchups,
      standings,
      elapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Composite scoring for a single backtest result.
   * Weights: Sharpe 30%, Return 25%, Win Rate 20%, Drawdown 15%, Trades 10%
   */
  private scoreBacktest(m: PerformanceMetrics): number {
    if (m.totalTrades === 0) return -Infinity;

    // Normalize components to reasonable ranges
    const sharpeScore = Math.max(-5, Math.min(5, m.sharpeRatio));
    const returnScore = Math.max(-1, Math.min(5, m.totalReturn));
    const winRateScore = m.winRate * 5;
    const ddPenalty = Math.min(1, m.maxDrawdown) * -5;
    const tradeBonus = Math.min(1, m.totalTrades / 20);

    return (
      sharpeScore * 0.3 +
      returnScore * 0.25 +
      winRateScore * 0.2 +
      ddPenalty * 0.15 +
      tradeBonus * 0.1
    );
  }

  /**
   * Format standings as a text summary.
   */
  formatStandings(result: ArenaResult): string {
    const lines = [
      "LLM Arena Standings",
      "===================",
      "",
    ];

    for (let i = 0; i < result.standings.length; i++) {
      const s = result.standings[i];
      lines.push(
        `${i + 1}. ${s.model}`,
        `   Elo: ${s.elo} | W:${s.wins} L:${s.losses} D:${s.ties}`,
        `   Avg Return: ${(s.avgReturn * 100).toFixed(2)}% | Avg Sharpe: ${s.avgSharpe.toFixed(2)} | Avg Trades: ${s.avgTrades.toFixed(0)}`,
        ""
      );
    }

    lines.push(`Time: ${(result.elapsedMs / 1000).toFixed(1)}s`);
    return lines.join("\n");
  }

  /**
   * Format standings as a markdown table.
   */
  formatStandingsTable(result: ArenaResult): string {
    const headers = ["Rank", "Model", "Elo", "W", "L", "D", "Avg Return", "Avg Sharpe"];
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `|${headers.map(() => "------").join("|")}|`;

    const rows = result.standings.map((s, i) =>
      `| ${i + 1} | ${s.model} | ${s.elo} | ${s.wins} | ${s.losses} | ${s.ties} | ${(s.avgReturn * 100).toFixed(2)}% | ${s.avgSharpe.toFixed(2)} |`
    );

    return [headerRow, separator, ...rows].join("\n");
  }
}
