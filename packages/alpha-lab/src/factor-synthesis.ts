/**
 * Factor Synthesis — Mode 2
 *
 * Generates many small, focused alpha factors via LLM, evaluates
 * each one independently, prunes correlated factors, and combines
 * the survivors into a single composite strategy using weighted voting.
 *
 * Pipeline:
 * 1. Generate diverse factors across categories (momentum, trend, etc.)
 * 2. Validate and backtest each factor independently
 * 3. Convert signals to position time-series
 * 4. Build correlation matrix and prune redundant factors
 * 5. Calculate optimal weights for surviving factors
 * 6. Combine into a single signal stream and backtest the composite
 * 7. Optionally iterate to fill gaps left by pruned factors
 */

import type { OHLCV, Signal } from "@pinescript-utils/core";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { VeniceClient } from "@pinescript-utils/venice";

import type {
  FactorSynthesisConfig,
  FactorSynthesisResult,
  FactorResult,
  FactorCategory,
  AlphaLabEvent,
} from "./types.js";
import { DEFAULT_SYNTHESIS_CONFIG, FACTOR_CATEGORIES } from "./types.js";
import { TokenBucketRateLimiter } from "./rate-limiter.js";
import { scoreMetrics } from "./scoring.js";
import {
  signalsToPositionSeries,
  combinePositionSeries,
} from "./signal-converter.js";
import {
  calculateFactorCorrelations,
  pruneCorrelatedFactors,
} from "./factor-correlator.js";
import { calculateFactorWeights } from "./factor-weighter.js";
import { generateFactorPrompt } from "./prompts.js";
import { generateFactorName } from "./name-generator.js";

/**
 * Run a full factor synthesis session.
 */
export async function runFactorSynthesis(
  data: OHLCV[],
  symbol: string,
  config: Partial<FactorSynthesisConfig> & { apiKey: string },
): Promise<FactorSynthesisResult> {
  const cfg: FactorSynthesisConfig = { ...DEFAULT_SYNTHESIS_CONFIG, ...config };
  const startTime = Date.now();

  const venice = new VeniceClient({ apiKey: cfg.apiKey, model: cfg.model });
  const limiter = new TokenBucketRateLimiter();

  let totalLLMCalls = 0;
  let iterations = 0;

  const emit = (type: string, eventData: Record<string, unknown>) => {
    cfg.onProgress?.({
      type,
      data: eventData,
      timestamp: Date.now(),
    });
  };

  const isCancelled = () => cfg.signal?.aborted ?? false;

  emit("synthesis_start", {
    factorCount: cfg.factorCount,
    categories: [...FACTOR_CATEGORIES],
  });

  // -- Generate and evaluate factors across iterations ------------------
  let allFactors: FactorResult[] = [];

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    if (isCancelled()) break;
    iterations = iter + 1;

    // How many factors do we still need?
    const surviving = allFactors.filter((f) => !f.pruned);
    const needed =
      iter === 0
        ? cfg.factorCount
        : Math.max(0, cfg.factorCount - surviving.length);

    if (needed === 0) break;

    // Distribute factors across categories for diversity
    const assignments = assignCategories(needed);

    emit("iteration_start", { iteration: iter, factorsToGenerate: needed });

    const existingNames = allFactors.map((f) => f.name);

    for (let i = 0; i < assignments.length; i++) {
      if (isCancelled()) break;

      const category = assignments[i];

      emit("factor_generating", {
        index: allFactors.length + i,
        category,
        iteration: iter,
      });

      try {
        await limiter.acquire();
        totalLLMCalls++;

        const prompt = generateFactorPrompt(category, existingNames);
        const code = await venice.generateStrategy(prompt);

        // Validate
        const validation = pineRuntime.validateScript(code);
        if (!validation.valid) {
          emit("factor_failed", {
            index: allFactors.length,
            category,
            error: "Invalid PineScript",
          });
          continue;
        }

        // Execute and backtest
        const signals = await pineRuntime.executeStrategy(
          code,
          data,
          cfg.initialCapital,
        );
        const engine = new BacktestEngine({
          initialCapital: cfg.initialCapital,
        });
        const result = await engine.run(signals, data, symbol);

        // Convert to position series for correlation analysis
        const positions = signalsToPositionSeries(signals, data);
        const score = scoreMetrics(result.metrics, cfg.objective);

        const factorName = generateFactorName(category);

        const factor: FactorResult = {
          name: factorName,
          category,
          code,
          positions,
          signals,
          metrics: result.metrics,
          score,
          pruned: false,
        };

        allFactors.push(factor);
        existingNames.push(factorName);

        emit("factor_backtested", {
          index: allFactors.length - 1,
          name: factorName,
          category,
          score,
          trades: result.metrics.totalTrades,
        });
      } catch (err) {
        emit("factor_failed", {
          index: allFactors.length,
          category,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // -- Correlation analysis and pruning --------------------------------
    const validFactors = allFactors.filter((f) => f.score > -999);
    if (validFactors.length < 2) continue;

    const { matrix, names } = calculateFactorCorrelations(
      validFactors.map((f) => ({ name: f.name, positions: f.positions })),
    );

    const pruned = pruneCorrelatedFactors(
      validFactors.map((f) => ({
        name: f.name,
        positions: f.positions,
        score: f.score,
      })),
      cfg.correlationThreshold,
    );

    // Apply pruning decisions back to allFactors
    for (const p of pruned) {
      const factor = allFactors.find((f) => f.name === p.name);
      if (factor) {
        factor.pruned = p.pruned;
        factor.prunedReason = p.prunedReason;
      }
    }

    const survivingCount = allFactors.filter((f) => !f.pruned).length;
    const prunedCount = allFactors.filter((f) => f.pruned).length;

    emit("correlation_computed", {
      iteration: iter,
      matrixSize: names.length,
      survivingCount,
      prunedCount,
    });

    // If we have enough surviving factors and iteration is enabled, stop
    if (!cfg.iterateUncorrelated || survivingCount >= cfg.factorCount) break;
  }

  // -- Calculate weights for surviving factors --------------------------
  const survivingFactors = allFactors.filter(
    (f) => !f.pruned && f.score > -999,
  );

  const weights = calculateFactorWeights(
    survivingFactors.map((f) => ({ name: f.name, metrics: f.metrics })),
    cfg.weightingMethod,
  );

  emit("weights_computed", { weights, method: cfg.weightingMethod });

  // -- Combine factors and backtest composite ---------------------------
  const compositeSignals = combinePositionSeries(
    survivingFactors.map((f) => ({
      positions: f.positions,
      weight: weights[f.name] ?? 0,
    })),
    data,
  );

  const compositeEngine = new BacktestEngine({
    initialCapital: cfg.initialCapital,
  });
  const compositeResult = await compositeEngine.run(
    compositeSignals,
    data,
    symbol,
  );

  // Build final correlation matrix (surviving factors only)
  const { matrix: finalMatrix } = calculateFactorCorrelations(
    survivingFactors.map((f) => ({ name: f.name, positions: f.positions })),
  );

  emit("synthesis_complete", {
    survivingCount: survivingFactors.length,
    totalGenerated: allFactors.length,
    compositeScore: scoreMetrics(compositeResult.metrics, cfg.objective),
    compositeTrades: compositeResult.metrics.totalTrades,
  });

  return {
    factors: allFactors,
    survivingFactors,
    correlationMatrix: finalMatrix,
    weights,
    compositeResult,
    compositeMetrics: compositeResult.metrics,
    iterations,
    totalLLMCalls,
    elapsedMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Distribute N factor generation slots across categories as evenly as possible.
 */
function assignCategories(count: number): FactorCategory[] {
  const categories = [...FACTOR_CATEGORIES];
  const result: FactorCategory[] = [];
  for (let i = 0; i < count; i++) {
    result.push(categories[i % categories.length]);
  }
  return result;
}
