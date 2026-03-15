import { describe, it, expect } from "vitest";
import { scoreMetrics } from "../scoring.js";
import type { PerformanceMetrics } from "@pinescript-utils/core";

// Helper to build a PerformanceMetrics object with overrides
function makeMetrics(
  overrides: Partial<PerformanceMetrics> = {},
): PerformanceMetrics {
  return {
    totalReturn: 0.1,
    annualizedReturn: 0.12,
    sharpeRatio: 1.5,
    sortinoRatio: 2.0,
    maxDrawdown: -0.05,
    winRate: 0.55,
    profitFactor: 1.8,
    volatility: 0.15,
    totalTrades: 20,
    averageWin: 100,
    averageLoss: -50,
    expectancy: 25,
    averageTrade: 50,
    averageTradeDuration: 5,
    maxTradeDuration: 20,
    minTradeDuration: 1,
    ...overrides,
  };
}

describe("scoreMetrics", () => {
  it("returns sharpeRatio for 'sharpe' objective", () => {
    const m = makeMetrics({ sharpeRatio: 2.3 });
    expect(scoreMetrics(m, "sharpe")).toBe(2.3);
  });

  it("returns sortinoRatio for 'sortino' objective", () => {
    const m = makeMetrics({ sortinoRatio: 3.1 });
    expect(scoreMetrics(m, "sortino")).toBe(3.1);
  });

  it("returns totalReturn for 'return' objective", () => {
    const m = makeMetrics({ totalReturn: 0.42 });
    expect(scoreMetrics(m, "return")).toBe(0.42);
  });

  it("returns winRate for 'winRate' objective", () => {
    const m = makeMetrics({ winRate: 0.65 });
    expect(scoreMetrics(m, "winRate")).toBe(0.65);
  });

  it("returns profitFactor for 'profitFactor' objective", () => {
    const m = makeMetrics({ profitFactor: 2.5 });
    expect(scoreMetrics(m, "profitFactor")).toBe(2.5);
  });

  it("returns expectancy for 'expectancy' objective", () => {
    const m = makeMetrics({ expectancy: 42 });
    expect(scoreMetrics(m, "expectancy")).toBe(42);
  });

  it("computes calmar ratio (return / |drawdown|)", () => {
    const m = makeMetrics({ totalReturn: 0.2, maxDrawdown: -0.04 });
    expect(scoreMetrics(m, "calmar")).toBeCloseTo(0.2 / 0.04, 5);
  });

  it("returns 100 for calmar when drawdown is 0 and return positive", () => {
    const m = makeMetrics({ totalReturn: 0.1, maxDrawdown: 0 });
    expect(scoreMetrics(m, "calmar")).toBe(100);
  });

  it("returns -100 for calmar when drawdown is 0 and return negative", () => {
    const m = makeMetrics({ totalReturn: -0.1, maxDrawdown: 0 });
    expect(scoreMetrics(m, "calmar")).toBe(-100);
  });

  it("returns -999 for NaN metric values", () => {
    const m = makeMetrics({ sharpeRatio: NaN });
    expect(scoreMetrics(m, "sharpe")).toBe(-999);
  });

  it("returns -999 for Infinity metric values", () => {
    const m = makeMetrics({ sharpeRatio: Infinity });
    expect(scoreMetrics(m, "sharpe")).toBe(-999);
  });

  it("returns -999 for -Infinity metric values", () => {
    const m = makeMetrics({ sharpeRatio: -Infinity });
    expect(scoreMetrics(m, "sharpe")).toBe(-999);
  });

  it("defaults to sharpeRatio for unknown objective", () => {
    const m = makeMetrics({ sharpeRatio: 1.7 });
    expect(scoreMetrics(m, "unknown" as any)).toBe(1.7);
  });

  it("handles negative metric values correctly", () => {
    const m = makeMetrics({ sharpeRatio: -0.5 });
    expect(scoreMetrics(m, "sharpe")).toBe(-0.5);
  });

  it("handles zero metric values correctly", () => {
    const m = makeMetrics({ sharpeRatio: 0 });
    expect(scoreMetrics(m, "sharpe")).toBe(0);
  });
});
