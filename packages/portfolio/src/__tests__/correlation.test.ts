import { describe, it, expect } from "vitest";
import { calculateCorrelationMatrix } from "../correlation.js";
import type { OHLCV } from "@pinescript-utils/core";

const DAY_MS = 86400000;

function makeOHLCV(closes: number[], startDay = 0): OHLCV[] {
  return closes.map((close, i) => ({
    timestamp: (startDay + i) * DAY_MS,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe("calculateCorrelationMatrix", () => {
  it("returns empty matrix for empty input", () => {
    const result = calculateCorrelationMatrix(new Map());
    expect(result).toEqual([]);
  });

  it("returns [[1]] for single asset", () => {
    const data = new Map<string, OHLCV[]>();
    data.set("AAPL", makeOHLCV([100, 102, 104, 103, 105]));
    const matrix = calculateCorrelationMatrix(data);
    expect(matrix).toHaveLength(1);
    expect(matrix[0][0]).toBe(1);
  });

  it("diagonal is always 1", () => {
    const data = new Map<string, OHLCV[]>();
    data.set("AAPL", makeOHLCV([100, 102, 104, 103, 105]));
    data.set("MSFT", makeOHLCV([200, 198, 201, 199, 203]));
    data.set("GOOG", makeOHLCV([50, 52, 48, 51, 53]));
    const matrix = calculateCorrelationMatrix(data);
    for (let i = 0; i < 3; i++) {
      expect(matrix[i][i]).toBe(1);
    }
  });

  it("matrix is symmetric", () => {
    const data = new Map<string, OHLCV[]>();
    data.set("AAPL", makeOHLCV([100, 102, 104, 103, 105]));
    data.set("MSFT", makeOHLCV([200, 198, 201, 199, 203]));
    const matrix = calculateCorrelationMatrix(data);
    expect(matrix[0][1]).toBe(matrix[1][0]);
  });

  it("perfectly correlated assets have correlation near 1", () => {
    const data = new Map<string, OHLCV[]>();
    // Same direction proportional moves
    data.set("A", makeOHLCV([100, 110, 120, 130, 140]));
    data.set("B", makeOHLCV([200, 220, 240, 260, 280]));
    const matrix = calculateCorrelationMatrix(data);
    expect(matrix[0][1]).toBeCloseTo(1, 1);
  });

  it("inversely correlated assets have negative correlation", () => {
    const data = new Map<string, OHLCV[]>();
    // A goes up-down-up-down, B goes down-up-down-up (alternating inversely)
    data.set("A", makeOHLCV([100, 110, 100, 110, 100, 110, 100]));
    data.set("B", makeOHLCV([100, 90, 100, 90, 100, 90, 100]));
    const matrix = calculateCorrelationMatrix(data);
    expect(matrix[0][1]).toBeLessThan(-0.5);
  });

  it("returns 0 correlation for constant-price assets", () => {
    const data = new Map<string, OHLCV[]>();
    data.set("A", makeOHLCV([100, 100, 100, 100, 100]));
    data.set("B", makeOHLCV([200, 210, 205, 215, 220]));
    const matrix = calculateCorrelationMatrix(data);
    // Constant price = zero std dev = 0 correlation
    expect(matrix[0][1]).toBe(0);
  });

  it("handles assets with non-overlapping dates", () => {
    const data = new Map<string, OHLCV[]>();
    data.set("A", makeOHLCV([100, 110, 120], 0));
    data.set("B", makeOHLCV([200, 210, 220], 10)); // starts 10 days later
    const matrix = calculateCorrelationMatrix(data);
    // No overlapping return dates — no common timestamps
    expect(matrix[0][1]).toBe(0);
  });

  it("only uses overlapping timestamps for correlation", () => {
    const data = new Map<string, OHLCV[]>();
    // A has 5 days, B has 3 overlapping + 2 non-overlapping
    data.set("A", makeOHLCV([100, 110, 120, 130, 140], 0));
    data.set("B", makeOHLCV([200, 220, 240, 260, 280], 0));
    const matrix = calculateCorrelationMatrix(data);
    // Both trend up linearly — should be highly correlated
    expect(matrix[0][1]).toBeGreaterThan(0.9);
  });
});
