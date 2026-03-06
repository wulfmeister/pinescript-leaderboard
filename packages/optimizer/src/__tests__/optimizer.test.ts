import { describe, it, expect } from "vitest";
import { StrategyOptimizer } from "../optimizer.js";
import type { OHLCV } from "@pinescript-utils/core";

function mockData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price += (Math.random() - 0.48) * 2; // slight upward drift
    data.push({
      timestamp: Date.now() - (count - i) * 86400000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

const SMA_STRATEGY = `//@version=5
strategy("SMA Cross", overlay=true)
fastLen = input(10, title="Fast SMA")
slowLen = input(30, title="Slow SMA")
fast = ta.sma(close, fastLen)
slow = ta.sma(close, slowLen)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fast, slow))
    strategy.close("Long")`;

describe("StrategyOptimizer", () => {
  const optimizer = new StrategyOptimizer();

  describe("getParameterRanges", () => {
    it("extracts parameter ranges from script", () => {
      const ranges = optimizer.getParameterRanges(SMA_STRATEGY);
      expect(ranges).toHaveLength(2);
      expect(ranges[0].name).toBe("fastLen");
      expect(ranges[1].name).toBe("slowLen");
      expect(ranges[0].min).toBeLessThan(ranges[0].max);
      expect(ranges[0].step).toBeGreaterThan(0);
    });

    it("returns empty for script without inputs", () => {
      const ranges = optimizer.getParameterRanges(`fastEMA = ema(close, 10)`);
      expect(ranges).toHaveLength(0);
    });
  });

  describe("optimize", () => {
    it("runs grid search and returns results", async () => {
      const data = mockData(200);
      const result = await optimizer.optimize(SMA_STRATEGY, data, "TEST", {
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 15, step: 5 },
          { name: "slowLen", min: 20, max: 40, step: 10 },
        ],
      });
      expect(result.totalCombinations).toBe(9); // 3 * 3
      expect(result.runs.length).toBeGreaterThan(0);
      expect(result.best).toBeDefined();
      expect(result.best.params).toHaveProperty("fastLen");
      expect(result.best.params).toHaveProperty("slowLen");
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("throws for script without parameters", async () => {
      const data = mockData(50);
      await expect(
        optimizer.optimize(`fastEMA = ema(close, 10)`, data, "TEST")
      ).rejects.toThrow();
    });

    it("sorts results by score descending", async () => {
      const data = mockData(200);
      const result = await optimizer.optimize(SMA_STRATEGY, data, "TEST", {
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 15, step: 5 },
          { name: "slowLen", min: 20, max: 40, step: 10 },
        ],
      });
      for (let i = 1; i < result.runs.length; i++) {
        expect(result.runs[i - 1].score).toBeGreaterThanOrEqual(result.runs[i].score);
      }
    });
  });

  describe("formatResultsTable", () => {
    it("generates a valid markdown table", async () => {
      const data = mockData(200);
      const result = await optimizer.optimize(SMA_STRATEGY, data, "TEST", {
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 10, step: 5 },
          { name: "slowLen", min: 20, max: 30, step: 10 },
        ],
      });
      const table = optimizer.formatResultsTable(result, 5);
      expect(table).toContain("Rank");
      expect(table).toContain("fastLen");
      expect(table).toContain("slowLen");
      expect(table).toContain("|");
    });
  });
});
