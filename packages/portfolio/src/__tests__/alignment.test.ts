import { describe, it, expect } from "vitest";
import { alignEquityCurves } from "../alignment.js";
import type { EquityPoint } from "@pinescript-utils/core";

const DAY_MS = 86400000;

function makeEquity(
  startDay: number,
  equities: number[],
): EquityPoint[] {
  return equities.map((equity, i) => ({
    timestamp: startDay * DAY_MS + i * DAY_MS,
    equity,
    drawdown: 0,
  }));
}

describe("alignEquityCurves", () => {
  it("returns fallback for empty curves map", () => {
    const result = alignEquityCurves(new Map(), 10000);
    expect(result).toEqual([{ timestamp: 0, equity: 10000, drawdown: 0 }]);
  });

  it("aligns single asset curve", () => {
    const curves = new Map<string, EquityPoint[]>();
    curves.set("AAPL", makeEquity(0, [5000, 5500, 5200]));
    const result = alignEquityCurves(curves, 10000);
    expect(result).toHaveLength(3);
    expect(result[0].equity).toBe(5000);
    expect(result[1].equity).toBe(5500);
    expect(result[2].equity).toBe(5200);
  });

  it("sums equity across multiple assets on overlapping days", () => {
    const curves = new Map<string, EquityPoint[]>();
    curves.set("AAPL", makeEquity(0, [5000, 5500]));
    curves.set("MSFT", makeEquity(0, [5000, 4800]));
    const result = alignEquityCurves(curves, 10000);
    expect(result).toHaveLength(2);
    expect(result[0].equity).toBe(10000);
    expect(result[1].equity).toBe(10300); // 5500 + 4800
  });

  it("carries forward last known equity for missing days", () => {
    const curves = new Map<string, EquityPoint[]>();
    // AAPL has days 0,1,2
    curves.set("AAPL", makeEquity(0, [5000, 5500, 5200]));
    // MSFT only has day 0
    curves.set("MSFT", makeEquity(0, [5000]));
    const result = alignEquityCurves(curves, 10000);
    expect(result).toHaveLength(3);
    // Day 1 and 2: MSFT carries forward 5000
    expect(result[1].equity).toBe(10500); // 5500 + 5000
    expect(result[2].equity).toBe(10200); // 5200 + 5000
  });

  it("calculates drawdown from peak", () => {
    const curves = new Map<string, EquityPoint[]>();
    curves.set("AAPL", makeEquity(0, [10000, 12000, 9000]));
    const result = alignEquityCurves(curves, 10000);
    expect(result[0].drawdown).toBe(0); // first point is peak
    expect(result[1].drawdown).toBe(0); // new peak at 12000
    expect(result[2].drawdown).toBeCloseTo(0.25); // (12000-9000)/12000
  });

  it("snaps timestamps to day boundaries", () => {
    const curves = new Map<string, EquityPoint[]>();
    // Two points on the same day (different hours) — should merge
    curves.set("AAPL", [
      { timestamp: DAY_MS + 3600000, equity: 5000, drawdown: 0 },
      { timestamp: DAY_MS + 7200000, equity: 5100, drawdown: 0 },
      { timestamp: DAY_MS * 2 + 3600000, equity: 5200, drawdown: 0 },
    ]);
    const result = alignEquityCurves(curves, 10000);
    // Two unique days, second intraday point overwrites first
    expect(result).toHaveLength(2);
    expect(result[0].equity).toBe(5100); // last value on day 1
    expect(result[1].equity).toBe(5200);
  });

  it("handles unsorted input", () => {
    const curves = new Map<string, EquityPoint[]>();
    curves.set("AAPL", [
      { timestamp: 2 * DAY_MS, equity: 5200, drawdown: 0 },
      { timestamp: 0, equity: 5000, drawdown: 0 },
      { timestamp: DAY_MS, equity: 5500, drawdown: 0 },
    ]);
    const result = alignEquityCurves(curves, 10000);
    expect(result[0].equity).toBe(5000);
    expect(result[1].equity).toBe(5500);
    expect(result[2].equity).toBe(5200);
  });
});
