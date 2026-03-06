import { describe, it, expect } from "vitest";
import { WalkForwardAnalyzer, DEFAULT_WF_CONFIG } from "../walk-forward.js";
import type { OHLCV } from "@pinescript-utils/core";

function mockData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price += (Math.random() - 0.48) * 2;
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

describe("WalkForwardAnalyzer", () => {
  const analyzer = new WalkForwardAnalyzer();

  describe("analyze", () => {
    it("runs walk-forward analysis and returns windows", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 3,
        trainRatio: 0.7,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 15, step: 5 },
          { name: "slowLen", min: 20, max: 40, step: 10 },
        ],
      });

      expect(result.windows.length).toBeGreaterThanOrEqual(1);
      expect(result.windows.length).toBeLessThanOrEqual(3);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(result.config.windows).toBe(3);
      expect(result.config.trainRatio).toBe(0.7);
    });

    it("each window has valid structure", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 2,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 15, step: 5 },
          { name: "slowLen", min: 20, max: 40, step: 10 },
        ],
      });

      for (const w of result.windows) {
        expect(w.windowIndex).toBeGreaterThanOrEqual(0);
        expect(w.trainBars).toBeGreaterThan(0);
        expect(w.testBars).toBeGreaterThan(0);
        expect(w.bestParams).toBeDefined();
        expect(w.bestParams).toHaveProperty("fastLen");
        expect(w.bestParams).toHaveProperty("slowLen");
        expect(w.trainMetrics).toBeDefined();
        expect(w.testMetrics).toBeDefined();
        expect(w.testResult).toBeDefined();
        expect(w.trainStart).toBeLessThan(w.trainEnd);
        expect(w.testStart).toBeLessThan(w.testEnd);
      }
    });

    it("computes aggregate metrics", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 2,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 10, step: 5 },
          { name: "slowLen", min: 20, max: 30, step: 10 },
        ],
      });

      const a = result.aggregateMetrics;
      expect(a).toHaveProperty("avgReturn");
      expect(a).toHaveProperty("avgSharpe");
      expect(a).toHaveProperty("avgMaxDrawdown");
      expect(a).toHaveProperty("avgWinRate");
      expect(a).toHaveProperty("totalTrades");
      expect(a).toHaveProperty("profitableWindows");
      expect(a.profitableWindows).toBeGreaterThanOrEqual(0);
      expect(a.profitableWindows).toBeLessThanOrEqual(1);
    });

    it("computes efficiency ratio", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 2,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 10, step: 5 },
          { name: "slowLen", min: 20, max: 30, step: 10 },
        ],
      });

      expect(typeof result.efficiency).toBe("number");
      expect(isFinite(result.efficiency)).toBe(true);
    });

    it("throws for insufficient data", async () => {
      const data = mockData(10); // too little for 5 windows
      await expect(
        analyzer.analyze(SMA_STRATEGY, data, "TEST", { windows: 5 })
      ).rejects.toThrow();
    });
  });

  describe("formatSummary", () => {
    it("generates a text summary", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 2,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 10, step: 5 },
          { name: "slowLen", min: 20, max: 30, step: 10 },
        ],
      });

      const summary = analyzer.formatSummary(result);
      expect(summary).toContain("Walk-Forward Analysis");
      expect(summary).toContain("Efficiency");
      expect(summary).toContain("Out-of-Sample");
    });
  });

  describe("formatWindowsTable", () => {
    it("generates a markdown table", async () => {
      const data = mockData(500);
      const result = await analyzer.analyze(SMA_STRATEGY, data, "TEST", {
        windows: 2,
        minTrades: 1,
        parameterRanges: [
          { name: "fastLen", min: 5, max: 10, step: 5 },
          { name: "slowLen", min: 20, max: 30, step: 10 },
        ],
      });

      const table = analyzer.formatWindowsTable(result);
      expect(table).toContain("Window");
      expect(table).toContain("Train Score");
      expect(table).toContain("|");
    });
  });
});

describe("DEFAULT_WF_CONFIG", () => {
  it("has reasonable defaults", () => {
    expect(DEFAULT_WF_CONFIG.windows).toBe(5);
    expect(DEFAULT_WF_CONFIG.trainRatio).toBeGreaterThan(0);
    expect(DEFAULT_WF_CONFIG.trainRatio).toBeLessThan(1);
    expect(DEFAULT_WF_CONFIG.objective).toBe("sharpe");
    expect(DEFAULT_WF_CONFIG.minTrades).toBeGreaterThan(0);
    expect(DEFAULT_WF_CONFIG.initialCapital).toBeGreaterThan(0);
  });
});
