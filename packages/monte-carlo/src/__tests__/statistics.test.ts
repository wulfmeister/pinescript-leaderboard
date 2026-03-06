import { describe, it, expect } from "vitest";
import {
  percentile,
  buildDistribution,
  shuffle,
  seededShuffle,
  createSeededRandom,
} from "../statistics.js";

describe("percentile", () => {
  it("returns the correct median for odd-length array", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it("returns interpolated value for even-length array", () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 50)).toBe(2.5);
  });

  it("returns first element for p=0", () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });

  it("returns last element for p=100", () => {
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });

  it("returns 0 for empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the single value for single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it("correctly computes p25 and p75", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const p25 = percentile(sorted, 25);
    const p75 = percentile(sorted, 75);
    expect(p25).toBeCloseTo(3.25, 1);
    expect(p75).toBeCloseTo(7.75, 1);
  });
});

describe("buildDistribution", () => {
  it("builds correct distribution from values", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const dist = buildDistribution(values);
    expect(dist.mean).toBeCloseTo(50.5, 1);
    expect(dist.p50).toBeCloseTo(50.5, 1);
    expect(dist.p5).toBeLessThan(dist.p25);
    expect(dist.p25).toBeLessThan(dist.p50);
    expect(dist.p50).toBeLessThan(dist.p75);
    expect(dist.p75).toBeLessThan(dist.p95);
    expect(dist.stdDev).toBeGreaterThan(0);
  });

  it("returns zeros for empty array", () => {
    const dist = buildDistribution([]);
    expect(dist.mean).toBe(0);
    expect(dist.stdDev).toBe(0);
    expect(dist.p50).toBe(0);
  });

  it("handles single value", () => {
    const dist = buildDistribution([42]);
    expect(dist.mean).toBe(42);
    expect(dist.p50).toBe(42);
    expect(dist.stdDev).toBe(0);
  });
});

describe("shuffle", () => {
  it("returns array of same length", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("createSeededRandom", () => {
  it("produces deterministic output for same seed", () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(12345);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it("produces different output for different seeds", () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(54321);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).not.toEqual(values2);
  });

  it("produces values between 0 and 1", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe("seededShuffle", () => {
  it("produces deterministic shuffles", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const result1 = seededShuffle(arr, rng1);
    const result2 = seededShuffle(arr, rng2);
    expect(result1).toEqual(result2);
  });

  it("preserves all elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const rng = createSeededRandom(42);
    const result = seededShuffle(arr, rng);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
