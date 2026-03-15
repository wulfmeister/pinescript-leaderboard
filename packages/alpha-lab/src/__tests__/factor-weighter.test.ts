import { describe, it, expect } from "vitest";
import { calculateFactorWeights } from "../factor-weighter.js";
import type { PerformanceMetrics } from "@pinescript-utils/core";

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

describe("calculateFactorWeights", () => {
  describe("equal weighting", () => {
    it("assigns equal weights to all factors", () => {
      const factors = [
        { name: "A", metrics: makeMetrics({ sharpeRatio: 2.0 }) },
        { name: "B", metrics: makeMetrics({ sharpeRatio: 1.0 }) },
        { name: "C", metrics: makeMetrics({ sharpeRatio: 0.5 }) },
      ];
      const weights = calculateFactorWeights(factors, "equal");
      expect(weights.A).toBeCloseTo(1 / 3, 5);
      expect(weights.B).toBeCloseTo(1 / 3, 5);
      expect(weights.C).toBeCloseTo(1 / 3, 5);
    });
  });

  describe("sharpe-weighted", () => {
    it("gives higher weight to higher Sharpe factors", () => {
      const factors = [
        { name: "high", metrics: makeMetrics({ sharpeRatio: 3.0 }) },
        { name: "low", metrics: makeMetrics({ sharpeRatio: 1.0 }) },
      ];
      const weights = calculateFactorWeights(factors, "sharpe-weighted");
      expect(weights.high).toBeGreaterThan(weights.low);
    });

    it("clamps negative Sharpe to 0.01", () => {
      const factors = [
        { name: "good", metrics: makeMetrics({ sharpeRatio: 2.0 }) },
        { name: "bad", metrics: makeMetrics({ sharpeRatio: -1.0 }) },
      ];
      const weights = calculateFactorWeights(factors, "sharpe-weighted");
      // "bad" should get a very small weight (0.01 / (2.0 + 0.01))
      expect(weights.bad).toBeLessThan(0.02);
      expect(weights.good).toBeGreaterThan(0.98);
    });
  });

  describe("inverse-volatility", () => {
    it("gives higher weight to lower volatility factors", () => {
      const factors = [
        { name: "calm", metrics: makeMetrics({ volatility: 0.05 }) },
        { name: "wild", metrics: makeMetrics({ volatility: 0.2 }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      expect(weights.calm).toBeGreaterThan(weights.wild);
    });

    it("handles zero volatility gracefully", () => {
      const factors = [
        { name: "zero", metrics: makeMetrics({ volatility: 0 }) },
        { name: "normal", metrics: makeMetrics({ volatility: 0.1 }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      // Zero vol gets a very high raw weight (1000) vs 10, so it dominates
      expect(weights.zero).toBeGreaterThan(0.9);
    });
  });

  describe("edge cases", () => {
    it("returns empty object for empty input", () => {
      expect(calculateFactorWeights([], "equal")).toEqual({});
    });

    it("returns weight 1 for single factor", () => {
      const factors = [{ name: "solo", metrics: makeMetrics() }];
      const weights = calculateFactorWeights(factors, "equal");
      expect(weights.solo).toBe(1);
    });

    it("weights sum to approximately 1.0", () => {
      const factors = [
        {
          name: "A",
          metrics: makeMetrics({ sharpeRatio: 1.5, volatility: 0.1 }),
        },
        {
          name: "B",
          metrics: makeMetrics({ sharpeRatio: 2.0, volatility: 0.2 }),
        },
        {
          name: "C",
          metrics: makeMetrics({ sharpeRatio: 0.8, volatility: 0.05 }),
        },
      ];

      for (const method of [
        "equal",
        "sharpe-weighted",
        "inverse-volatility",
      ] as const) {
        const weights = calculateFactorWeights(factors, method);
        const sum = Object.values(weights).reduce((s, w) => s + w, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });
  });

  describe("NaN/Infinity guards", () => {
    it("falls back to equal weight for NaN volatility", () => {
      const factors = [
        { name: "nanvol", metrics: makeMetrics({ volatility: NaN }) },
        { name: "normal", metrics: makeMetrics({ volatility: 0.1 }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      expect(isFinite(weights.nanvol)).toBe(true);
      expect(isFinite(weights.normal)).toBe(true);
      const sum = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("falls back to equal weight for Infinity volatility", () => {
      const factors = [
        { name: "infvol", metrics: makeMetrics({ volatility: Infinity }) },
        { name: "normal", metrics: makeMetrics({ volatility: 0.1 }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      expect(isFinite(weights.infvol)).toBe(true);
      expect(isFinite(weights.normal)).toBe(true);
      const sum = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("falls back to equal weight for NaN Sharpe", () => {
      const factors = [
        { name: "nansharpe", metrics: makeMetrics({ sharpeRatio: NaN }) },
        { name: "normal", metrics: makeMetrics({ sharpeRatio: 2.0 }) },
      ];
      const weights = calculateFactorWeights(factors, "sharpe-weighted");
      expect(isFinite(weights.nansharpe)).toBe(true);
      expect(isFinite(weights.normal)).toBe(true);
      const sum = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("falls back to equal weight for Infinity Sharpe", () => {
      const factors = [
        { name: "infsharpe", metrics: makeMetrics({ sharpeRatio: Infinity }) },
        { name: "normal", metrics: makeMetrics({ sharpeRatio: 2.0 }) },
      ];
      const weights = calculateFactorWeights(factors, "sharpe-weighted");
      expect(isFinite(weights.infsharpe)).toBe(true);
      expect(isFinite(weights.normal)).toBe(true);
      const sum = Object.values(weights).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("handles all NaN Sharpe inputs without producing NaN weights", () => {
      const factors = [
        { name: "a", metrics: makeMetrics({ sharpeRatio: NaN }) },
        { name: "b", metrics: makeMetrics({ sharpeRatio: NaN }) },
      ];
      const weights = calculateFactorWeights(factors, "sharpe-weighted");
      // Both get fallback weight 1, normalized: 0.5 each
      expect(weights.a).toBeCloseTo(0.5, 5);
      expect(weights.b).toBeCloseTo(0.5, 5);
    });

    it("handles all NaN volatility inputs without producing NaN weights", () => {
      const factors = [
        { name: "a", metrics: makeMetrics({ volatility: NaN }) },
        { name: "b", metrics: makeMetrics({ volatility: NaN }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      expect(weights.a).toBeCloseTo(0.5, 5);
      expect(weights.b).toBeCloseTo(0.5, 5);
    });

    it("negative volatility uses absolute value", () => {
      const factors = [
        { name: "neg", metrics: makeMetrics({ volatility: -0.1 }) },
        { name: "pos", metrics: makeMetrics({ volatility: 0.1 }) },
      ];
      const weights = calculateFactorWeights(factors, "inverse-volatility");
      // Math.abs(-0.1) === 0.1 === Math.abs(0.1), so equal weights
      expect(weights.neg).toBeCloseTo(weights.pos, 5);
    });
  });
});
