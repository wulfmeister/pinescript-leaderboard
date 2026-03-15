/**
 * Genetic Evolver — Mode 1
 *
 * Evolves a seed PineScript strategy across multiple generations
 * using LLM-driven mutation and crossover. Each generation:
 *
 * 1. Elite carry-forward: best performers survive unchanged
 * 2. Mutation: LLM improves the current best with targeted changes
 * 3. Crossover: LLM combines logic from two top-performing parents
 * 4. Validation + backtest: invalid scripts are discarded
 * 5. Selection: best scorer becomes the next generation's parent
 */

import type { OHLCV } from "@pinescript-utils/core";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { VeniceClient } from "@pinescript-utils/venice";

import type {
  GeneticEvolverConfig,
  EvolutionResult,
  GenerationResult,
  CandidateResult,
  AlphaLabEvent,
} from "./types.js";
import { DEFAULT_EVOLVER_CONFIG } from "./types.js";
import { TokenBucketRateLimiter } from "./rate-limiter.js";
import { scoreMetrics } from "./scoring.js";
import { mutatePrompt, crossoverPrompt, analyzeWeakness } from "./prompts.js";
import {
  generateName,
  generateChildName,
  generateCrossoverName,
} from "./name-generator.js";

/**
 * Run a full genetic evolution session.
 *
 * @param data - OHLCV market data for backtesting
 * @param symbol - Asset symbol (e.g., "AAPL")
 * @param config - Evolution configuration
 * @returns The full evolution history and best strategy found
 */
export async function runGeneticEvolution(
  data: OHLCV[],
  symbol: string,
  config: Partial<GeneticEvolverConfig> & { seed: string; apiKey: string },
): Promise<EvolutionResult> {
  const cfg: GeneticEvolverConfig = { ...DEFAULT_EVOLVER_CONFIG, ...config };
  const startTime = Date.now();

  const venice = new VeniceClient({ apiKey: cfg.apiKey, model: cfg.model });
  const limiter = new TokenBucketRateLimiter();

  let totalLLMCalls = 0;
  let totalBacktests = 0;

  const emit = (type: string, eventData: Record<string, unknown>) => {
    cfg.onProgress?.({
      type,
      data: eventData,
      timestamp: Date.now(),
    });
  };

  // Helper: check if the job has been cancelled
  const isCancelled = () => cfg.signal?.aborted ?? false;

  // -- Evaluate the seed strategy first ---------------------------------
  const seedResult = await evaluateCandidate(
    cfg.seed,
    data,
    symbol,
    cfg,
    "seed",
  );
  totalBacktests++;

  const seedCandidate: CandidateResult = {
    name: generateName(),
    code: cfg.seed,
    origin: "seed",
    score: seedResult.score,
    metrics: seedResult.metrics,
    equityCurve: seedResult.equityCurve,
  };

  emit("evolution_start", {
    generations: cfg.generations,
    populationSize: cfg.populationSize,
    seedScore: seedCandidate.score,
    seedName: seedCandidate.name,
  });

  // -- Evolve across generations ----------------------------------------
  const generations: GenerationResult[] = [];
  let currentBest = seedCandidate;

  for (let gen = 0; gen < cfg.generations; gen++) {
    if (isCancelled()) break;

    emit("generation_start", {
      index: gen,
      parentScore: currentBest.score,
      parentName: currentBest.name,
    });

    const population: CandidateResult[] = [];
    let invalidCount = 0;

    // Elite carry-forward (capped to populationSize - 1 to leave room for mutations)
    const maxElites = Math.min(cfg.eliteCount, cfg.populationSize - 1);
    for (let e = 0; e < maxElites; e++) {
      population.push({ ...currentBest, origin: "elite" });
    }

    // Determine how many mutations vs crossovers
    const remaining = cfg.populationSize - population.length;
    const crossoverCount = Math.floor(remaining * cfg.crossoverRate);
    const mutationCount = remaining - crossoverCount;

    // Generate mutations
    for (let m = 0; m < mutationCount; m++) {
      if (isCancelled()) break;

      emit("candidate_generating", {
        index: population.length,
        origin: "mutation",
        generation: gen,
      });

      try {
        await limiter.acquire();
        totalLLMCalls++;

        const weakness = analyzeWeakness(
          currentBest.metrics as unknown as Record<string, number>,
        );
        const metricsJson = formatMetrics(currentBest.metrics);
        const prompt = mutatePrompt(currentBest.code, metricsJson, weakness);
        const newCode = await venice.generateStrategy(prompt);

        // Validate and backtest
        const validation = pineRuntime.validateScript(newCode);
        if (!validation.valid) {
          invalidCount++;
          emit("candidate_failed", {
            index: population.length,
            error: "Invalid PineScript",
          });
          continue;
        }

        const result = await evaluateCandidate(
          newCode,
          data,
          symbol,
          cfg,
          "mutation",
        );
        totalBacktests++;

        if (result.score <= -999) {
          invalidCount++;
          emit("candidate_failed", {
            index: population.length,
            error: "Backtest produced no valid trades",
          });
          continue;
        }

        const candidate: CandidateResult = {
          name: generateChildName(currentBest.name),
          code: newCode,
          origin: "mutation",
          parentNames: [currentBest.name],
          score: result.score,
          metrics: result.metrics,
          equityCurve: result.equityCurve,
        };

        population.push(candidate);
        emit("candidate_backtested", {
          index: population.length - 1,
          name: candidate.name,
          score: candidate.score,
          origin: "mutation",
        });
      } catch (err) {
        invalidCount++;
        emit("candidate_failed", {
          index: population.length,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Generate crossovers (only if we have enough population)
    if (crossoverCount > 0 && generations.length > 0) {
      const previousPop = generations[generations.length - 1].population;
      const topCandidates = previousPop
        .filter((c) => c.score > -999)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(2, Math.ceil(previousPop.length / 2)));

      for (let c = 0; c < crossoverCount && topCandidates.length >= 2; c++) {
        const parent1 = topCandidates[0];
        const parent2 =
          topCandidates[Math.min(c + 1, topCandidates.length - 1)];

        emit("candidate_generating", {
          index: population.length,
          origin: "crossover",
          generation: gen,
        });

        try {
          await limiter.acquire();
          totalLLMCalls++;

          const prompt = crossoverPrompt(
            parent1.code,
            formatMetrics(parent1.metrics),
            parent2.code,
            formatMetrics(parent2.metrics),
          );
          const newCode = await venice.generateStrategy(prompt);

          const validation = pineRuntime.validateScript(newCode);
          if (!validation.valid) {
            invalidCount++;
            emit("candidate_failed", {
              index: population.length,
              error: "Invalid PineScript",
            });
            continue;
          }

          const result = await evaluateCandidate(
            newCode,
            data,
            symbol,
            cfg,
            "crossover",
          );
          totalBacktests++;

          if (result.score <= -999) {
            invalidCount++;
            continue;
          }

          const candidate: CandidateResult = {
            name: generateCrossoverName(parent1.name, parent2.name),
            code: newCode,
            origin: "crossover",
            parentNames: [parent1.name, parent2.name],
            score: result.score,
            metrics: result.metrics,
            equityCurve: result.equityCurve,
          };

          population.push(candidate);
          emit("candidate_backtested", {
            index: population.length - 1,
            name: candidate.name,
            score: candidate.score,
            origin: "crossover",
          });
        } catch (err) {
          invalidCount++;
          emit("candidate_failed", {
            index: population.length,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    // Select the best from this generation
    const sortedPop = [...population].sort((a, b) => b.score - a.score);
    const genBest = sortedPop[0] ?? currentBest;

    if (genBest.score > currentBest.score) {
      currentBest = genBest;
    }

    const genResult: GenerationResult = {
      index: gen,
      population: sortedPop,
      best: genBest,
      invalidCount,
    };
    generations.push(genResult);

    emit("generation_complete", {
      index: gen,
      bestScore: genBest.score,
      bestName: genBest.name,
      populationSize: population.length,
      invalidCount,
      overallBestScore: currentBest.score,
    });
  }

  emit("evolution_complete", {
    bestScore: currentBest.score,
    seedScore: seedCandidate.score,
    improvement:
      seedCandidate.score !== 0
        ? (currentBest.score - seedCandidate.score) /
          Math.abs(seedCandidate.score)
        : 0,
  });

  return {
    generations,
    bestStrategy: currentBest,
    seed: seedCandidate,
    improvement:
      seedCandidate.score !== 0
        ? (currentBest.score - seedCandidate.score) /
          Math.abs(seedCandidate.score)
        : 0,
    totalLLMCalls,
    totalBacktests,
    elapsedMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EvalResult {
  score: number;
  metrics: CandidateResult["metrics"];
  equityCurve: CandidateResult["equityCurve"];
}

async function evaluateCandidate(
  code: string,
  data: OHLCV[],
  symbol: string,
  cfg: GeneticEvolverConfig,
  _origin: string,
): Promise<EvalResult> {
  const signals = await pineRuntime.executeStrategy(
    code,
    data,
    cfg.initialCapital,
  );
  const engine = new BacktestEngine({ initialCapital: cfg.initialCapital });
  const result = await engine.run(signals, data, symbol);

  if (result.metrics.totalTrades < cfg.minTrades) {
    return {
      score: -999,
      metrics: result.metrics,
      equityCurve: result.equityCurve,
    };
  }

  return {
    score: scoreMetrics(result.metrics, cfg.objective),
    metrics: result.metrics,
    equityCurve: result.equityCurve,
  };
}

function formatMetrics(metrics: CandidateResult["metrics"]): string {
  return JSON.stringify(
    {
      totalReturn: metrics.totalReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      totalTrades: metrics.totalTrades,
    },
    null,
    2,
  );
}
