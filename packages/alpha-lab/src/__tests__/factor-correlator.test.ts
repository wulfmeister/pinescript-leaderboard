import { describe, it, expect } from "vitest";
import {
  pearsonCorrelation,
  calculateFactorCorrelations,
  pruneCorrelatedFactors,
} from "../factor-correlator.js";

describe("pearsonCorrelation", () => {
  it("returns 1 for identical arrays", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfectly inversely correlated arrays", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it("returns 0 for uncorrelated arrays", () => {
    // Orthogonal signals
    const corr = pearsonCorrelation([1, 0, -1, 0], [0, 1, 0, -1]);
    expect(Math.abs(corr)).toBeLessThan(0.1);
  });

  it("returns 0 for arrays shorter than 2", () => {
    expect(pearsonCorrelation([1], [2])).toBe(0);
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it("returns 0 for zero-variance arrays", () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
  });

  it("handles different length arrays by truncating", () => {
    const corr = pearsonCorrelation([1, 2, 3, 4, 5], [1, 2, 3]);
    expect(corr).toBeCloseTo(1, 5);
  });
});

describe("calculateFactorCorrelations", () => {
  it("builds a symmetric matrix with 1s on diagonal", () => {
    const factors = [
      { name: "A", positions: [1, 0, 1, 0] },
      { name: "B", positions: [0, 1, 0, 1] },
    ];
    const { matrix, names } = calculateFactorCorrelations(factors);
    expect(names).toEqual(["A", "B"]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBe(matrix[1][0]); // symmetric
  });
});

describe("pruneCorrelatedFactors", () => {
  it("prunes lower-scored factor in a correlated pair", () => {
    const factors = [
      { name: "A", positions: [1, 1, 0, 0, 1, 0], score: 2.0 },
      { name: "B", positions: [1, 1, 0, 0, 1, 0], score: 1.0 }, // identical to A but lower score
      { name: "C", positions: [1, 0, 1, 0, 0, 1], score: 1.5 }, // uncorrelated with A
    ];
    const result = pruneCorrelatedFactors(factors, 0.7);
    const surviving = result.filter((f) => !f.pruned);
    const pruned = result.filter((f) => f.pruned);

    expect(surviving.map((f) => f.name)).toContain("A");
    expect(surviving.map((f) => f.name)).toContain("C");
    expect(pruned.map((f) => f.name)).toContain("B");
  });

  it("keeps all factors if none are correlated", () => {
    const factors = [
      { name: "A", positions: [1, 0, -1, 0], score: 2.0 },
      { name: "B", positions: [0, 1, 0, -1], score: 1.5 },
    ];
    const result = pruneCorrelatedFactors(factors, 0.7);
    expect(result.filter((f) => f.pruned)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(pruneCorrelatedFactors([], 0.7)).toHaveLength(0);
  });
});
