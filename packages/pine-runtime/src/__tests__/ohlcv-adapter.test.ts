import { describe, it, expect } from "vitest";
import { toCandles } from "../ohlcv-adapter.js";
import type { OHLCV } from "@pinescript-utils/core";

function makeBar(timestamp: number, close: number): OHLCV {
  return {
    timestamp,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
  };
}

describe("toCandles", () => {
  it("returns empty array for empty input", () => {
    expect(toCandles([])).toEqual([]);
  });

  it("converts timestamps from seconds to milliseconds", () => {
    const data: OHLCV[] = [
      makeBar(1704067200, 100), // seconds (2024-01-01)
      makeBar(1704153600, 105), // +1 day
    ];
    const candles = toCandles(data);
    expect(candles[0].openTime).toBe(1704067200000);
    expect(candles[1].openTime).toBe(1704153600000);
  });

  it("preserves timestamps already in milliseconds", () => {
    const data: OHLCV[] = [
      makeBar(1704067200000, 100),
      makeBar(1704153600000, 105),
    ];
    const candles = toCandles(data);
    expect(candles[0].openTime).toBe(1704067200000);
    expect(candles[1].openTime).toBe(1704153600000);
  });

  it("sets closeTime to next bar openTime for non-last bars", () => {
    const data: OHLCV[] = [
      makeBar(1704067200000, 100),
      makeBar(1704153600000, 105),
      makeBar(1704240000000, 110),
    ];
    const candles = toCandles(data);
    expect(candles[0].closeTime).toBe(1704153600000);
    expect(candles[1].closeTime).toBe(1704240000000);
  });

  it("estimates closeTime for last bar from previous gap", () => {
    const gap = 86400000; // 1 day
    const data: OHLCV[] = [
      makeBar(1704067200000, 100),
      makeBar(1704067200000 + gap, 105),
    ];
    const candles = toCandles(data);
    expect(candles[1].closeTime).toBe(1704067200000 + gap * 2);
  });

  it("estimates 1 hour closeTime for single bar", () => {
    const data: OHLCV[] = [makeBar(1704067200000, 100)];
    const candles = toCandles(data);
    expect(candles[0].closeTime).toBe(1704067200000 + 3600000);
  });

  it("preserves OHLCV price data", () => {
    const data: OHLCV[] = [
      { timestamp: 1704067200000, open: 99, high: 102, low: 98, close: 100, volume: 5000 },
      { timestamp: 1704153600000, open: 100, high: 107, low: 99, close: 105, volume: 6000 },
    ];
    const candles = toCandles(data);
    expect(candles[0]).toMatchObject({ open: 99, high: 102, low: 98, close: 100, volume: 5000 });
    expect(candles[1]).toMatchObject({ open: 100, high: 107, low: 99, close: 105, volume: 6000 });
  });

  it("handles seconds timestamps for gap estimation", () => {
    const data: OHLCV[] = [
      makeBar(1704067200, 100),  // seconds
      makeBar(1704153600, 105),  // +1 day in seconds
    ];
    const candles = toCandles(data);
    // Last bar closeTime should be estimated from the gap
    const gap = (1704153600 - 1704067200) * 1000;
    expect(candles[1].closeTime).toBe(1704153600000 + gap);
  });
});
