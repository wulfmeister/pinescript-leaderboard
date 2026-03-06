import { describe, it, expect } from "vitest";
import {
  StrategyRanker,
  DEFAULT_RANKING_CONFIG,
  rankStrategies,
  type StrategyDefinition,
} from "../ranker.js";
import type { OHLCV, Signal } from "@pinescript-utils/core";

function mockData(count: number, startPrice: number = 100): OHLCV[] {
  const data: OHLCV[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    price = startPrice + i * 0.5; // steadily rising
    data.push({
      timestamp: Date.now() - (count - i) * 86400000,
      open: price - 0.2,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

function makeSignals(data: OHLCV[], buyIndices: number[], sellIndices: number[]): Signal[] {
  const signals: Signal[] = [];
  for (const i of buyIndices) {
    if (i < data.length) {
      signals.push({ timestamp: data[i].timestamp, action: "buy", price: data[i].close });
    }
  }
  for (const i of sellIndices) {
    if (i < data.length) {
      signals.push({ timestamp: data[i].timestamp, action: "sell", price: data[i].close });
    }
  }
  return signals.sort((a, b) => a.timestamp - b.timestamp);
}

describe("StrategyRanker", () => {
  const data = mockData(200);

  describe("rankStrategies", () => {
    it("ranks strategies and assigns ranks", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "Strategy A",
          signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
        },
        {
          name: "Strategy B",
          signals: makeSignals(data, [10, 40, 70, 100, 130, 160], [25, 55, 85, 115, 145, 180]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 3 });
      const results = await ranker.rankStrategies(strategies, data, "TEST");

      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const r of results) {
        expect(r.rank).toBeGreaterThan(0);
        expect(r.score).toBeDefined();
        expect(r.result).toBeDefined();
        expect(r.result.metrics).toBeDefined();
      }

      // Ranks should be sequential
      for (let i = 0; i < results.length; i++) {
        expect(results[i].rank).toBe(i + 1);
      }
    });

    it("filters out strategies with too few trades", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "Too Few",
          signals: makeSignals(data, [5], [20]), // 1 round trip
        },
        {
          name: "Enough",
          signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 5 });
      const results = await ranker.rankStrategies(strategies, data, "TEST");

      const names = results.map((r) => r.name);
      expect(names).not.toContain("Too Few");
    });

    it("handles empty strategies list", async () => {
      const ranker = new StrategyRanker();
      const results = await ranker.rankStrategies([], data, "TEST");
      expect(results).toHaveLength(0);
    });

    it("higher-scoring strategies rank first", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "Frequent Trader",
          signals: makeSignals(
            data,
            [5, 25, 45, 65, 85, 105, 125, 145, 165],
            [15, 35, 55, 75, 95, 115, 135, 155, 185]
          ),
        },
        {
          name: "Moderate Trader",
          signals: makeSignals(data, [5, 40, 80, 120, 160], [30, 60, 100, 140, 180]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 3 });
      const results = await ranker.rankStrategies(strategies, data, "TEST");

      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  describe("generateComparisonTable", () => {
    it("generates a markdown table", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "Strategy A",
          signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 3 });
      const results = await ranker.rankStrategies(strategies, data, "TEST");
      const table = ranker.generateComparisonTable(results);

      expect(table).toContain("Rank");
      expect(table).toContain("Strategy");
      expect(table).toContain("Return");
      expect(table).toContain("|");
    });
  });

  describe("generateSummary", () => {
    it("returns 'no strategies' message for empty results", () => {
      const ranker = new StrategyRanker();
      const summary = ranker.generateSummary([]);
      expect(summary).toContain("No strategies");
    });

    it("shows winner for non-empty results", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "Winner Strat",
          signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 3 });
      const results = await ranker.rankStrategies(strategies, data, "TEST");
      const summary = ranker.generateSummary(results);

      expect(summary).toContain("Winner");
      expect(summary).toContain("Winner Strat");
    });
  });

  describe("sortBy options", () => {
    it("sorts by return when configured", async () => {
      const strategies: StrategyDefinition[] = [
        {
          name: "A",
          signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
        },
        {
          name: "B",
          signals: makeSignals(data, [10, 40, 70, 100, 130, 160], [25, 55, 85, 115, 145, 180]),
        },
      ];

      const ranker = new StrategyRanker({ minTrades: 3, sortBy: "return" });
      const results = await ranker.rankStrategies(strategies, data, "TEST");

      if (results.length >= 2) {
        expect(results[0].result.metrics.totalReturn)
          .toBeGreaterThanOrEqual(results[1].result.metrics.totalReturn);
      }
    });
  });
});

describe("rankStrategies convenience function", () => {
  it("works as a standalone function", async () => {
    const data = mockData(200);
    const strategies: StrategyDefinition[] = [
      {
        name: "Simple",
        signals: makeSignals(data, [5, 30, 55, 80, 105, 130], [20, 45, 70, 95, 120, 150]),
      },
    ];

    const results = await rankStrategies(strategies, data, "TEST", { minTrades: 3 });
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe("DEFAULT_RANKING_CONFIG", () => {
  it("has weights that sum to approximately 1", () => {
    const cfg = DEFAULT_RANKING_CONFIG;
    const totalWeight =
      cfg.returnWeight +
      cfg.sharpeWeight +
      cfg.drawdownWeight +
      cfg.winRateWeight +
      cfg.profitFactorWeight;
    expect(totalWeight).toBeCloseTo(1.0);
  });

  it("has reasonable defaults", () => {
    expect(DEFAULT_RANKING_CONFIG.minTrades).toBeGreaterThan(0);
    expect(DEFAULT_RANKING_CONFIG.sortBy).toBe("score");
  });
});
