/**
 * Adaptive Walk-Forward — Mode 3
 *
 * Runs standard walk-forward analysis, identifies failing out-of-sample
 * windows, then uses the LLM to diagnose and fix the strategy.
 *
 * Pipeline:
 * 1. Run baseline walk-forward analysis
 * 2. Find windows where OOS score < failureThreshold
 * 3. For each failing window, ask LLM to diagnose the failure
 * 4. Ask LLM to generate a fixed version
 * 5. Re-run full walk-forward on the fixed version
 * 6. Keep the fix if it improves overall efficiency
 * 7. Repeat up to maxAdaptations times
 */

import type { OHLCV } from "@pinescript-utils/core";
import { WalkForwardAnalyzer } from "@pinescript-utils/walk-forward";
import type { WalkForwardResult } from "@pinescript-utils/walk-forward";
import { VeniceClient } from "@pinescript-utils/venice";

import type {
  AdaptiveWFConfig,
  AdaptiveWFResult,
  AdaptationRound,
  AlphaLabEvent,
} from "./types.js";
import { DEFAULT_ADAPTIVE_WF_CONFIG } from "./types.js";
import { TokenBucketRateLimiter } from "./rate-limiter.js";
import { scoreMetrics } from "./scoring.js";
import { diagnoseFailurePrompt, fixStrategyPrompt } from "./prompts.js";

/**
 * Run an adaptive walk-forward session.
 */
export async function runAdaptiveWalkForward(
  data: OHLCV[],
  symbol: string,
  config: Partial<AdaptiveWFConfig> & { script: string; apiKey: string },
): Promise<AdaptiveWFResult> {
  const cfg: AdaptiveWFConfig = { ...DEFAULT_ADAPTIVE_WF_CONFIG, ...config };
  const startTime = Date.now();

  const venice = new VeniceClient({ apiKey: cfg.apiKey, model: cfg.model });
  const limiter = new TokenBucketRateLimiter();
  const analyzer = new WalkForwardAnalyzer();

  let totalLLMCalls = 0;

  const emit = (type: string, eventData: Record<string, unknown>) => {
    cfg.onProgress?.({
      type,
      data: eventData,
      timestamp: Date.now(),
    });
  };

  const isCancelled = () => cfg.signal?.aborted ?? false;

  emit("adaptive_start", {
    windows: cfg.windows,
    failureThreshold: cfg.failureThreshold,
    maxAdaptations: cfg.maxAdaptations,
  });

  // -- Run baseline walk-forward ----------------------------------------
  emit("baseline_running", { windows: cfg.windows });

  const baselineResult = await analyzer.analyze(cfg.script, data, symbol, {
    windows: cfg.windows,
    trainRatio: cfg.trainRatio,
    objective: cfg.objective,
    minTrades: cfg.minTrades,
    initialCapital: cfg.initialCapital,
  });

  // Find failing windows
  const failingWindows = findFailingWindows(baselineResult, cfg);

  emit("baseline_complete", {
    efficiency: baselineResult.efficiency,
    failingWindowCount: failingWindows.length,
    failingWindows,
    totalWindows: baselineResult.windows.length,
  });

  // -- Iterative adaptation loop ----------------------------------------
  const adaptations: AdaptationRound[] = [];
  let currentCode = cfg.script;
  let currentResult = baselineResult;

  for (let round = 0; round < cfg.maxAdaptations; round++) {
    if (isCancelled()) break;

    const currentFailing = findFailingWindows(currentResult, cfg);

    // Stop if no more failing windows
    if (currentFailing.length === 0) {
      emit("no_failures_remaining", { round });
      break;
    }

    emit("adaptation_start", {
      round,
      failingWindowCount: currentFailing.length,
      failingWindows: currentFailing,
    });

    // -- Diagnose: pick the worst failing window and ask LLM why --------
    const worstWindowIdx = currentFailing[0];
    const worstWindow = currentResult.windows[worstWindowIdx];

    const periodDesc = buildPeriodDescription(worstWindow);
    const metricsJson = JSON.stringify(
      {
        totalReturn: worstWindow.testMetrics.totalReturn,
        sharpeRatio: worstWindow.testMetrics.sharpeRatio,
        maxDrawdown: worstWindow.testMetrics.maxDrawdown,
        winRate: worstWindow.testMetrics.winRate,
        totalTrades: worstWindow.testMetrics.totalTrades,
      },
      null,
      2,
    );

    await limiter.acquire();
    totalLLMCalls++;

    const diagnosis = await venice.prompt(
      diagnoseFailurePrompt(currentCode, periodDesc, metricsJson),
    );

    emit("diagnosis_complete", { round, diagnosis });

    // -- Fix: ask LLM to improve the strategy based on diagnosis --------
    await limiter.acquire();
    totalLLMCalls++;

    const fixedCode = await venice.generateStrategy(
      fixStrategyPrompt(currentCode, diagnosis),
    );

    emit("fix_generated", { round, codeLength: fixedCode.length });

    // -- Re-run full walk-forward on the fixed version ------------------
    let fixedResult: WalkForwardResult;
    try {
      fixedResult = await analyzer.analyze(fixedCode, data, symbol, {
        windows: cfg.windows,
        trainRatio: cfg.trainRatio,
        objective: cfg.objective,
        minTrades: cfg.minTrades,
        initialCapital: cfg.initialCapital,
      });
    } catch (err) {
      // Walk-forward may fail if the fixed code is too broken
      emit("adaptation_failed", {
        round,
        error:
          err instanceof Error
            ? err.message
            : "Walk-forward failed on fixed code",
      });

      adaptations.push({
        round,
        failingWindows: currentFailing,
        diagnosis,
        fixedCode,
        walkForwardResult: currentResult,
        efficiencyBefore: currentResult.efficiency,
        efficiencyAfter: currentResult.efficiency,
        improved: false,
      });
      continue;
    }

    const improved = fixedResult.efficiency > currentResult.efficiency;

    const adaptation: AdaptationRound = {
      round,
      failingWindows: currentFailing,
      diagnosis,
      fixedCode,
      walkForwardResult: fixedResult,
      efficiencyBefore: currentResult.efficiency,
      efficiencyAfter: fixedResult.efficiency,
      improved,
    };
    adaptations.push(adaptation);

    emit("adaptation_complete", {
      round,
      efficiencyBefore: currentResult.efficiency,
      efficiencyAfter: fixedResult.efficiency,
      improved,
      failingBefore: currentFailing.length,
      failingAfter: findFailingWindows(fixedResult, cfg).length,
    });

    // Accept the fix if it improved things
    if (improved) {
      currentCode = fixedCode;
      currentResult = fixedResult;
    }
  }

  emit("adaptive_complete", {
    totalRounds: adaptations.length,
    originalEfficiency: baselineResult.efficiency,
    bestEfficiency: currentResult.efficiency,
    improved: currentResult.efficiency > baselineResult.efficiency,
  });

  return {
    originalResult: baselineResult,
    adaptations,
    bestResult: currentResult,
    bestCode: currentCode,
    originalCode: cfg.script,
    improvement:
      baselineResult.efficiency !== 0
        ? (currentResult.efficiency - baselineResult.efficiency) /
          Math.abs(baselineResult.efficiency)
        : 0,
    totalLLMCalls,
    elapsedMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find window indices where OOS performance is below the failure threshold.
 * Returns indices sorted by score ascending (worst first).
 */
function findFailingWindows(
  result: WalkForwardResult,
  cfg: AdaptiveWFConfig,
): number[] {
  return result.windows
    .map((w, i) => ({
      index: i,
      score: scoreMetrics(w.testMetrics, cfg.objective),
    }))
    .filter((w) => w.score < cfg.failureThreshold)
    .sort((a, b) => a.score - b.score)
    .map((w) => w.index);
}

/**
 * Build a human-readable description of a window's test period.
 */
function buildPeriodDescription(
  window: WalkForwardResult["windows"][number],
): string {
  const testStart = new Date(window.testStart).toISOString().split("T")[0];
  const testEnd = new Date(window.testEnd).toISOString().split("T")[0];
  return `${testStart} to ${testEnd} (${window.testBars} bars)`;
}
