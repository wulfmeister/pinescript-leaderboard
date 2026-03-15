/**
 * Alpha Lab shared types
 *
 * Types used across all three optimization modes:
 * - Genetic Evolver: mutate strategies across generations
 * - Factor Synthesis: generate + combine uncorrelated alpha factors
 * - Adaptive Walk-Forward: LLM-assisted walk-forward failure repair
 */

import type {
  OHLCV,
  Signal,
  PerformanceMetrics,
  BacktestResult,
} from "@pinescript-utils/core";
import type { OptimizationObjective } from "@pinescript-utils/optimizer";
import type { WalkForwardResult } from "@pinescript-utils/walk-forward";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Progress event emitted by all engines via onProgress callback. */
export interface AlphaLabEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/** Common config fields shared by all three modes. */
export interface BaseConfig {
  objective: OptimizationObjective;
  minTrades: number;
  initialCapital: number;
  apiKey: string;
  model?: string;
  onProgress?: (event: AlphaLabEvent) => void;
  /** AbortSignal for cancellation. When aborted, the engine stops ASAP. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Mode 1: Genetic Evolver
// ---------------------------------------------------------------------------

export interface GeneticEvolverConfig extends BaseConfig {
  /** Initial PineScript strategy to evolve. */
  seed: string;
  /** Number of evolutionary generations. Default: 10. */
  generations: number;
  /** Mutations per generation. Default: 5. */
  populationSize: number;
  /** Fraction of population created via crossover vs mutation. Default: 0.2. */
  crossoverRate: number;
  /** Top performers that carry over unchanged each generation. Default: 1. */
  eliteCount: number;
}

export const DEFAULT_EVOLVER_CONFIG: Omit<
  GeneticEvolverConfig,
  "seed" | "apiKey"
> = {
  generations: 10,
  populationSize: 5,
  crossoverRate: 0.2,
  eliteCount: 1,
  objective: "sharpe",
  minTrades: 3,
  initialCapital: 10000,
};

export interface CandidateResult {
  name: string;
  code: string;
  origin: "mutation" | "crossover" | "elite" | "seed";
  parentNames?: string[];
  score: number;
  metrics: PerformanceMetrics;
  equityCurve: { timestamp: number; equity: number }[];
}

export interface GenerationResult {
  index: number;
  population: CandidateResult[];
  best: CandidateResult;
  invalidCount: number;
}

export interface EvolutionResult {
  generations: GenerationResult[];
  bestStrategy: CandidateResult;
  seed: CandidateResult;
  improvement: number;
  totalLLMCalls: number;
  totalBacktests: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Mode 2: Factor Synthesis
// ---------------------------------------------------------------------------

export type WeightingMethod =
  | "equal"
  | "inverse-volatility"
  | "sharpe-weighted";
export type SignalMode = "position" | "indicator";

export interface FactorSynthesisConfig extends BaseConfig {
  /** How many factors to generate. Default: 15. */
  factorCount: number;
  /** Max allowed pairwise correlation before pruning. Default: 0.7. */
  correlationThreshold: number;
  /** How to weight surviving factors. Default: "sharpe-weighted". */
  weightingMethod: WeightingMethod;
  /** How to extract combinable signals. Default: "position". */
  signalMode: SignalMode;
  /** Generate replacements for pruned factors. Default: true. */
  iterateUncorrelated: boolean;
  /** Max generate-prune iterations. Default: 3. */
  maxIterations: number;
}

export const DEFAULT_SYNTHESIS_CONFIG: Omit<FactorSynthesisConfig, "apiKey"> = {
  factorCount: 15,
  correlationThreshold: 0.7,
  weightingMethod: "sharpe-weighted",
  signalMode: "position",
  iterateUncorrelated: true,
  maxIterations: 3,
  objective: "sharpe",
  minTrades: 3,
  initialCapital: 10000,
};

/** Factor categories for diversity in LLM prompts. */
export const FACTOR_CATEGORIES = [
  "momentum",
  "mean-reversion",
  "trend",
  "volatility",
  "volume",
  "breakout",
] as const;

export type FactorCategory = (typeof FACTOR_CATEGORIES)[number];

export interface FactorResult {
  name: string;
  category: FactorCategory;
  code: string;
  positions: number[];
  signals: Signal[];
  metrics: PerformanceMetrics;
  score: number;
  pruned: boolean;
  prunedReason?: string;
}

export interface FactorSynthesisResult {
  factors: FactorResult[];
  survivingFactors: FactorResult[];
  correlationMatrix: number[][];
  weights: Record<string, number>;
  compositeResult: BacktestResult;
  compositeMetrics: PerformanceMetrics;
  iterations: number;
  totalLLMCalls: number;
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Mode 3: Adaptive Walk-Forward
// ---------------------------------------------------------------------------

export interface AdaptiveWFConfig extends BaseConfig {
  /** Initial PineScript strategy. */
  script: string;
  /** Number of walk-forward windows. Default: 5. */
  windows: number;
  /** Train/test split ratio. Default: 0.7. */
  trainRatio: number;
  /** OOS score below this = failure. Default: 0. */
  failureThreshold: number;
  /** Max LLM fix attempts. Default: 3. */
  maxAdaptations: number;
}

export const DEFAULT_ADAPTIVE_WF_CONFIG: Omit<
  AdaptiveWFConfig,
  "script" | "apiKey"
> = {
  windows: 5,
  trainRatio: 0.7,
  failureThreshold: 0,
  maxAdaptations: 3,
  objective: "sharpe",
  minTrades: 3,
  initialCapital: 10000,
};

export interface AdaptationRound {
  round: number;
  failingWindows: number[];
  diagnosis: string;
  fixedCode: string;
  walkForwardResult: WalkForwardResult;
  efficiencyBefore: number;
  efficiencyAfter: number;
  improved: boolean;
}

export interface AdaptiveWFResult {
  originalResult: WalkForwardResult;
  adaptations: AdaptationRound[];
  bestResult: WalkForwardResult;
  bestCode: string;
  originalCode: string;
  improvement: number;
  totalLLMCalls: number;
  elapsedMs: number;
}
