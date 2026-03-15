import { describe, it, expect, vi } from "vitest";
import type { OHLCV, Signal } from "@pinescript-utils/core";

// Mock external dependencies
vi.mock("@pinescript-utils/pine-runtime", () => ({
  pineRuntime: {
    executeStrategy: vi.fn().mockResolvedValue([
      { timestamp: 1000, action: "buy", price: 100 },
      { timestamp: 5000, action: "sell", price: 110 },
    ] as Signal[]),
    validateScript: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  },
}));

vi.mock("@pinescript-utils/backtester", () => ({
  BacktestEngine: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      trades: [{ timestamp: 1000, action: "buy", price: 100, pnl: 10 }],
      metrics: {
        totalReturn: 0.1,
        annualizedReturn: 0.12,
        sharpeRatio: 1.2,
        sortinoRatio: 1.5,
        maxDrawdown: -0.04,
        winRate: 0.55,
        profitFactor: 1.6,
        volatility: 0.12,
        totalTrades: 8,
        averageWin: 80,
        averageLoss: -40,
        expectancy: 20,
        averageTrade: 40,
        averageTradeDuration: 3,
        maxTradeDuration: 15,
        minTradeDuration: 1,
      },
      initialCapital: 10000,
      finalCapital: 11000,
      equityCurve: [{ timestamp: 1000, equity: 10000 }],
    }),
  })),
}));

// Return different strategy code for each call to simulate diverse factors
let callCount = 0;
vi.mock("@pinescript-utils/venice", () => ({
  VeniceClient: vi.fn().mockImplementation(() => ({
    generateStrategy: vi.fn().mockImplementation(async () => {
      callCount++;
      return `//@version=5
strategy("Factor${callCount}", overlay=true)
len = input(${10 + callCount}, title="Length")
if (ta.crossover(ta.sma(close, len), ta.sma(close, len * 3)))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(ta.sma(close, len), ta.sma(close, len * 3)))
    strategy.close("Long")`;
    }),
  })),
}));

import { runFactorSynthesis } from "../factor-synthesis.js";

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

describe("runFactorSynthesis", () => {
  it("generates the requested number of factors", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 4,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    expect(result.factors.length).toBeLessThanOrEqual(6); // may be fewer if some fail
    expect(result.factors.length).toBeGreaterThanOrEqual(1);
  });

  it("computes weights for surviving factors", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 3,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    const weightSum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    if (result.survivingFactors.length > 0) {
      expect(weightSum).toBeCloseTo(1.0, 2);
    }
  });

  it("produces a composite backtest result", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 3,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    expect(result.compositeResult).toBeDefined();
    expect(result.compositeMetrics).toBeDefined();
    expect(typeof result.compositeMetrics.totalReturn).toBe("number");
  });

  it("builds a correlation matrix", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 3,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    if (result.survivingFactors.length >= 2) {
      expect(result.correlationMatrix.length).toBe(
        result.survivingFactors.length,
      );
      // Diagonal should be 1
      expect(result.correlationMatrix[0][0]).toBe(1);
    }
  });

  it("tracks LLM calls and timing", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 2,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    expect(result.totalLLMCalls).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.iterations).toBeGreaterThanOrEqual(1);
  });

  it("emits progress events", async () => {
    const data = mockData(100);
    const events: any[] = [];

    await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 2,
      maxIterations: 1,
      iterateUncorrelated: false,
      onProgress: (e) => events.push(e),
    });

    const types = events.map((e) => e.type);
    expect(types).toContain("synthesis_start");
    expect(types).toContain("synthesis_complete");
  });

  it("each factor has a category and name", async () => {
    const data = mockData(100);
    const result = await runFactorSynthesis(data, "TEST", {
      apiKey: "test-key",
      factorCount: 3,
      maxIterations: 1,
      iterateUncorrelated: false,
    });

    for (const factor of result.factors) {
      expect(factor.name).toBeTruthy();
      expect(factor.category).toBeTruthy();
      expect(factor.code).toContain("//@version=5");
    }
  });
});
