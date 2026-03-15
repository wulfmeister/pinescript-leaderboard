import { describe, it, expect, vi } from "vitest";
import type { OHLCV, Signal } from "@pinescript-utils/core";

// Mock all external dependencies before importing the module under test
vi.mock("@pinescript-utils/pine-runtime", () => ({
  pineRuntime: {
    executeStrategy: vi.fn().mockResolvedValue([
      { timestamp: 1000, action: "buy", price: 100 },
      { timestamp: 2000, action: "sell", price: 110 },
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
        sharpeRatio: 1.5,
        sortinoRatio: 2.0,
        maxDrawdown: -0.03,
        winRate: 0.6,
        profitFactor: 1.8,
        volatility: 0.12,
        totalTrades: 5,
        averageWin: 100,
        averageLoss: -50,
        expectancy: 25,
        averageTrade: 50,
        averageTradeDuration: 5,
        maxTradeDuration: 20,
        minTradeDuration: 1,
      },
      initialCapital: 10000,
      finalCapital: 11000,
      equityCurve: [{ timestamp: 1000, equity: 10000 }],
    }),
  })),
}));

vi.mock("@pinescript-utils/venice", () => ({
  VeniceClient: vi.fn().mockImplementation(() => ({
    generateStrategy: vi.fn().mockResolvedValue(
      `//@version=5
strategy("Mutated", overlay=true)
if (ta.crossover(ta.sma(close, 8), ta.sma(close, 25)))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(ta.sma(close, 8), ta.sma(close, 25)))
    strategy.close("Long")`,
    ),
  })),
}));

import { runGeneticEvolution } from "../genetic-evolver.js";

function mockData(count: number): OHLCV[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 86400000,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000000,
  }));
}

const SEED = `//@version=5
strategy("Seed", overlay=true)
if (ta.crossover(ta.sma(close, 10), ta.sma(close, 30)))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(ta.sma(close, 10), ta.sma(close, 30)))
    strategy.close("Long")`;

describe("runGeneticEvolution", () => {
  it("runs the requested number of generations", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 3,
      populationSize: 2,
      crossoverRate: 0,
    });

    expect(result.generations).toHaveLength(3);
  });

  it("returns seed as baseline candidate", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 1,
      populationSize: 1,
    });

    expect(result.seed.origin).toBe("seed");
    expect(result.seed.code).toBe(SEED);
    expect(result.seed.score).toBeGreaterThan(-999);
  });

  it("tracks improvement over seed", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 2,
      populationSize: 2,
    });

    expect(typeof result.improvement).toBe("number");
    expect(result.bestStrategy).toBeDefined();
    expect(result.bestStrategy.score).toBeGreaterThanOrEqual(result.seed.score);
  });

  it("populates each generation with candidates", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 2,
      populationSize: 3,
      crossoverRate: 0,
    });

    for (const gen of result.generations) {
      expect(gen.population.length).toBeGreaterThanOrEqual(1);
      expect(gen.best).toBeDefined();
      expect(gen.best.score).toBeGreaterThan(-999);
    }
  });

  it("tracks LLM calls and backtests", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 2,
      populationSize: 2,
    });

    expect(result.totalLLMCalls).toBeGreaterThan(0);
    expect(result.totalBacktests).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("emits progress events when onProgress is provided", async () => {
    const data = mockData(100);
    const events: any[] = [];

    await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 1,
      populationSize: 1,
      onProgress: (e) => events.push(e),
    });

    expect(events.length).toBeGreaterThan(0);
    const types = events.map((e) => e.type);
    expect(types).toContain("evolution_start");
    expect(types).toContain("generation_start");
    expect(types).toContain("evolution_complete");
  });

  it("includes elite carry-forward", async () => {
    const data = mockData(100);
    const result = await runGeneticEvolution(data, "TEST", {
      seed: SEED,
      apiKey: "test-key",
      generations: 2,
      populationSize: 3,
      eliteCount: 1,
      crossoverRate: 0,
    });

    // First generation should have at least one elite
    const gen0Elites = result.generations[0].population.filter(
      (c) => c.origin === "elite",
    );
    expect(gen0Elites.length).toBeGreaterThanOrEqual(1);
  });
});
