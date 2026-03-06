import { describe, it, expect } from "vitest";
import {
  extractParameterValues,
  pivotToMatrix,
  getScoreRange,
  scoreToColor,
} from "../transformHeatmapData";
import type { OptimizationRun } from "../../types";

function makeRun(
  params: Record<string, number>,
  score: number,
): OptimizationRun {
  return {
    params,
    score,
    metrics: {
      totalReturn: score,
      sharpeRatio: score,
      sortinoRatio: score,
      maxDrawdown: 0.1,
      winRate: 0.5,
      profitFactor: 1.5,
      totalTrades: 10,
      expectancy: score,
    },
    finalCapital: 10000 * (1 + score),
  };
}

const RUNS_2P: OptimizationRun[] = [
  makeRun({ fast: 10, slow: 30 }, 1.2),
  makeRun({ fast: 10, slow: 50 }, 0.8),
  makeRun({ fast: 20, slow: 30 }, 1.5),
  makeRun({ fast: 20, slow: 50 }, 0.3),
];

const RUNS_SPARSE: OptimizationRun[] = [
  makeRun({ fast: 10, slow: 30 }, 1.0),
  makeRun({ fast: 20, slow: 50 }, 0.5),
];

describe("extractParameterValues", () => {
  it("returns sorted unique values", () => {
    expect(extractParameterValues(RUNS_2P, "fast")).toEqual([10, 20]);
    expect(extractParameterValues(RUNS_2P, "slow")).toEqual([30, 50]);
  });

  it("returns empty array for unknown param", () => {
    expect(extractParameterValues(RUNS_2P, "unknown")).toEqual([]);
  });

  it("deduplicates identical values", () => {
    const runs = [
      makeRun({ x: 5 }, 1),
      makeRun({ x: 5 }, 2),
      makeRun({ x: 10 }, 3),
    ];
    expect(extractParameterValues(runs, "x")).toEqual([5, 10]);
  });
});

describe("pivotToMatrix", () => {
  it("builds correct 2D matrix from full grid", () => {
    const m = pivotToMatrix(RUNS_2P, "fast", "slow");
    expect(m.xParam).toBe("fast");
    expect(m.yParam).toBe("slow");
    expect(m.xValues).toEqual([10, 20]);
    expect(m.yValues).toEqual([30, 50]);
    expect(m.scores[0][0]).toBeCloseTo(1.2);
    expect(m.scores[0][1]).toBeCloseTo(1.5);
    expect(m.scores[1][0]).toBeCloseTo(0.8);
    expect(m.scores[1][1]).toBeCloseTo(0.3);
  });

  it("fills missing combos with null", () => {
    const m = pivotToMatrix(RUNS_SPARSE, "fast", "slow");
    expect(m.xValues).toEqual([10, 20]);
    expect(m.yValues).toEqual([30, 50]);
    expect(m.scores[0][0]).toBeCloseTo(1.0);
    expect(m.scores[0][1]).toBeNull();
    expect(m.scores[1][0]).toBeNull();
    expect(m.scores[1][1]).toBeCloseTo(0.5);
  });

  it("keeps best score when runs share x/y combo", () => {
    const runs = [
      makeRun({ fast: 10, slow: 30 }, 1.0),
      makeRun({ fast: 10, slow: 30 }, 2.5),
      makeRun({ fast: 10, slow: 30 }, 0.5),
    ];
    const m = pivotToMatrix(runs, "fast", "slow");
    expect(m.scores[0][0]).toBeCloseTo(2.5);
  });

  it("computes correct min/max", () => {
    const m = pivotToMatrix(RUNS_2P, "fast", "slow");
    expect(m.min).toBeCloseTo(0.3);
    expect(m.max).toBeCloseTo(1.5);
  });

  it("returns min=0 max=1 when no data", () => {
    const m = pivotToMatrix([], "fast", "slow");
    expect(m.min).toBe(0);
    expect(m.max).toBe(1);
    expect(m.scores).toHaveLength(0);
  });

  it("handles single-value axes", () => {
    const runs = [makeRun({ fast: 10, slow: 30 }, 0.9)];
    const m = pivotToMatrix(runs, "fast", "slow");
    expect(m.xValues).toEqual([10]);
    expect(m.yValues).toEqual([30]);
    expect(m.scores[0][0]).toBeCloseTo(0.9);
  });

  it("skips runs missing x or y param", () => {
    const runs = [
      makeRun({ fast: 10, slow: 30 }, 1.0),
      makeRun({ fast: 20 }, 0.5),
      makeRun({ slow: 50 }, 0.3),
    ];
    const m = pivotToMatrix(runs, "fast", "slow");
    expect(m.xValues).toEqual([10, 20]);
    expect(m.yValues).toEqual([30, 50]);
    expect(m.scores[0][0]).toBeCloseTo(1.0);
    expect(m.scores[1][1]).toBeNull();
  });
});

describe("getScoreRange", () => {
  it("returns min and max from matrix", () => {
    const m = pivotToMatrix(RUNS_2P, "fast", "slow");
    const range = getScoreRange(m);
    expect(range.min).toBeCloseTo(0.3);
    expect(range.max).toBeCloseTo(1.5);
  });
});

describe("scoreToColor", () => {
  it("returns gray for null", () => {
    expect(scoreToColor(null, 0, 1)).toBe("rgba(63,63,70,0.5)");
  });

  it("returns red-ish for minimum score", () => {
    const color = scoreToColor(0, 0, 1);
    expect(color).toMatch(/^rgb\(/);
    const [r, g, b] = color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map(Number);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("returns green-ish for maximum score", () => {
    const color = scoreToColor(1, 0, 1);
    expect(color).toMatch(/^rgb\(/);
    const [r, g, b] = color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map(Number);
    expect(g).toBeGreaterThan(r);
  });

  it("handles flat range (all same score)", () => {
    const color = scoreToColor(5, 5, 5);
    expect(color).toMatch(/^rgb\(/);
  });

  it("clamps out-of-range scores", () => {
    const low = scoreToColor(-10, 0, 1);
    const high = scoreToColor(10, 0, 1);
    expect(low).toBe(scoreToColor(0, 0, 1));
    expect(high).toBe(scoreToColor(1, 0, 1));
  });
});
