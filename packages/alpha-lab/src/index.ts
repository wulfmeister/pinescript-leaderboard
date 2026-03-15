/**
 * @pinescript-utils/alpha-lab
 *
 * AI-driven strategy optimization with three modes:
 *
 * 1. Genetic Evolver — LLM-driven mutation and crossover of strategies
 * 2. Factor Synthesis — generate + combine uncorrelated alpha factors
 * 3. Adaptive Walk-Forward — LLM-assisted walk-forward failure repair
 */

// Engines
export { runGeneticEvolution } from "./genetic-evolver.js";
export { runFactorSynthesis } from "./factor-synthesis.js";
export { runAdaptiveWalkForward } from "./adaptive-walk-forward.js";

// Shared utilities
export { TokenBucketRateLimiter } from "./rate-limiter.js";
export {
  signalsToPositionSeries,
  combinePositionSeries,
} from "./signal-converter.js";
export {
  pearsonCorrelation,
  calculateFactorCorrelations,
  pruneCorrelatedFactors,
} from "./factor-correlator.js";
export { calculateFactorWeights } from "./factor-weighter.js";
export { scoreMetrics } from "./scoring.js";
export {
  generateName,
  generateChildName,
  generateCrossoverName,
  generateFactorName,
} from "./name-generator.js";

// Types
export type {
  AlphaLabEvent,
  BaseConfig,
  GeneticEvolverConfig,
  CandidateResult,
  GenerationResult,
  EvolutionResult,
  FactorSynthesisConfig,
  FactorResult,
  FactorSynthesisResult,
  FactorCategory,
  WeightingMethod,
  SignalMode,
  AdaptiveWFConfig,
  AdaptationRound,
  AdaptiveWFResult,
} from "./types.js";

export {
  DEFAULT_EVOLVER_CONFIG,
  DEFAULT_SYNTHESIS_CONFIG,
  DEFAULT_ADAPTIVE_WF_CONFIG,
  FACTOR_CATEGORIES,
} from "./types.js";
