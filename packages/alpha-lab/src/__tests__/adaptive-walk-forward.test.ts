import { describe, it, expect, vi } from "vitest";
import type { OHLCV, Signal } from "@pinescript-utils/core";

// Mock external dependencies
vi.mock("@pinescript-utils/pine-runtime", () => ({
  pineRuntime: {
    executeStrategy: vi.fn().mockResolvedValue([
      { timestamp: 1000, action: "buy", price: 100 },
      { timestamp: 5000, action: "sell", price: 105 },
    ] as Signal[]),
    validateScript: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  },
}));

vi.mock("@pinescript-utils/walk-forward", () => ({
  WalkForwardAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      windows: [
        {
          windowIndex: 0,
          trainStart: 1000,
          trainEnd: 5000,
          testStart: 5000,
          testEnd: 9000,
          trainBars: 50,
          testBars: 20,
          bestParams: { fastLen: 10, slowLen: 30 },
          trainScore: 1.5,
          trainMetrics: {
            totalReturn: 0.15,
            annualizedReturn: 0.18,
            sharpeRatio: 1.5,
            sortinoRatio: 2.0,
            maxDrawdown: -0.03,
            winRate: 0.6,
            profitFactor: 1.8,
            volatility: 0.1,
            totalTrades: 10,
            averageWin: 80,
            averageLoss: -40,
            expectancy: 20,
            averageTrade: 40,
            averageTradeDuration: 3,
            maxTradeDuration: 10,
            minTradeDuration: 1,
          },
          testMetrics: {
            totalReturn: -0.05, // failing window
            annualizedReturn: -0.06,
            sharpeRatio: -0.3,
            sortinoRatio: -0.4,
            maxDrawdown: -0.08,
            winRate: 0.35,
            profitFactor: 0.7,
            volatility: 0.15,
            totalTrades: 5,
            averageWin: 40,
            averageLoss: -60,
            expectancy: -10,
            averageTrade: -20,
            averageTradeDuration: 4,
            maxTradeDuration: 12,
            minTradeDuration: 1,
          },
          testResult: {
            trades: [],
            metrics: {},
            equityCurve: [],
            initialCapital: 10000,
            finalCapital: 9500,
          },
        },
      ],
      aggregateMetrics: {
        avgReturn: -0.05,
        avgSharpe: -0.3,
        avgMaxDrawdown: -0.08,
        avgWinRate: 0.35,
        avgTrades: 5,
        totalTrades: 5,
        profitableWindows: 0,
        positiveScoreWindows: 0,
      },
      efficiency: 0.3,
      elapsedMs: 100,
      config: { windows: 1, trainRatio: 0.7, objective: "sharpe" },
    }),
  })),
}));

vi.mock("@pinescript-utils/venice", () => ({
  VeniceClient: vi.fn().mockImplementation(() => ({
    prompt: vi
      .fn()
      .mockResolvedValue(
        "The strategy uses fixed SMA periods that don't adapt to changing volatility regimes.",
      ),
    generateStrategy: vi.fn().mockResolvedValue(
      `//@version=5
strategy("Fixed", overlay=true)
len = input(14, title="Length")
if (ta.crossover(ta.sma(close, len), ta.sma(close, len * 2)))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(ta.sma(close, len), ta.sma(close, len * 2)))
    strategy.close("Long")`,
    ),
  })),
}));

import { runAdaptiveWalkForward } from "../adaptive-walk-forward.js";

function mockData(count: number): OHLCV[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 86400000,
    open: 100 + i * 0.5,
    high: 102 + i * 0.5,
    low: 98 + i * 0.5,
    close: 101 + i * 0.5,
    volume: 1000000,
  }));
}

const SEED_SCRIPT = `//@version=5
strategy("Seed", overlay=true)
if (ta.crossover(ta.sma(close, 10), ta.sma(close, 30)))
    strategy.entry("Long", strategy.long)`;

describe("runAdaptiveWalkForward", () => {
  it("runs baseline walk-forward first", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    expect(result.originalResult).toBeDefined();
    expect(result.originalResult.windows.length).toBeGreaterThan(0);
  });

  it("identifies failing windows and attempts adaptations", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
      failureThreshold: 0, // sharpe < 0 = failure
    });

    // The mock has a failing window (sharpe = -0.3)
    expect(result.adaptations.length).toBeGreaterThanOrEqual(1);
  });

  it("stores diagnosis from LLM", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    if (result.adaptations.length > 0) {
      expect(result.adaptations[0].diagnosis).toBeTruthy();
      expect(result.adaptations[0].fixedCode).toContain("//@version=5");
    }
  });

  it("tracks original vs best code", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    expect(result.originalCode).toBe(SEED_SCRIPT);
    expect(result.bestCode).toBeTruthy();
  });

  it("tracks LLM calls and timing", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    expect(result.totalLLMCalls).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("emits progress events", async () => {
    const data = mockData(200);
    const events: any[] = [];

    await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
      onProgress: (e) => events.push(e),
    });

    const types = events.map((e) => e.type);
    expect(types).toContain("adaptive_start");
    expect(types).toContain("baseline_complete");
    expect(types).toContain("adaptive_complete");
  });

  it("computes improvement ratio", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    expect(typeof result.improvement).toBe("number");
  });

  it("each adaptation round has efficiency before and after", async () => {
    const data = mockData(200);
    const result = await runAdaptiveWalkForward(data, "TEST", {
      script: SEED_SCRIPT,
      apiKey: "test-key",
      maxAdaptations: 1,
    });

    for (const round of result.adaptations) {
      expect(typeof round.efficiencyBefore).toBe("number");
      expect(typeof round.efficiencyAfter).toBe("number");
      expect(typeof round.improved).toBe("boolean");
    }
  });
});
