import { describe, it, expect } from "vitest";
import { calculateStopLossPrice, checkStopLoss } from "../stop-loss.js";
import type { OHLCV, StopLossConfig } from "@pinescript-utils/core";

function mockCandle(overrides: Partial<OHLCV> = {}): OHLCV {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1000000,
    ...overrides,
  };
}

function mockData(count: number, startPrice: number = 100): OHLCV[] {
  const data: OHLCV[] = [];
  for (let i = 0; i < count; i++) {
    const price = startPrice + i * 0.5;
    data.push({
      timestamp: Date.now() - (count - i) * 86400000,
      open: price - 0.2,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

describe("calculateStopLossPrice", () => {
  it("calculates fixed stop-loss for long position", () => {
    const config: StopLossConfig = { type: "fixed", value: 0.05 };
    const price = calculateStopLossPrice(config, 100, "long", [], 0);
    expect(price).toBeCloseTo(95);
  });

  it("calculates fixed stop-loss for short position", () => {
    const config: StopLossConfig = { type: "fixed", value: 0.05 };
    const price = calculateStopLossPrice(config, 100, "short", [], 0);
    expect(price).toBeCloseTo(105);
  });

  it("calculates ATR-based stop-loss for long position", () => {
    const config: StopLossConfig = { type: "atr", value: 2, atrPeriod: 5 };
    const data = mockData(20);
    const price = calculateStopLossPrice(config, data[19].close, "long", data, 19);
    // Stop should be below entry
    expect(price).toBeLessThan(data[19].close);
  });

  it("calculates ATR-based stop-loss for short position", () => {
    const config: StopLossConfig = { type: "atr", value: 2, atrPeriod: 5 };
    const data = mockData(20);
    const price = calculateStopLossPrice(config, data[19].close, "short", data, 19);
    // Stop should be above entry
    expect(price).toBeGreaterThan(data[19].close);
  });

  it("uses default ATR period of 14 when not specified", () => {
    const config: StopLossConfig = { type: "atr", value: 1.5 };
    const data = mockData(30);
    const price = calculateStopLossPrice(config, data[29].close, "long", data, 29);
    expect(price).toBeLessThan(data[29].close);
  });

  it("handles zero value (no stop distance)", () => {
    const config: StopLossConfig = { type: "fixed", value: 0 };
    const price = calculateStopLossPrice(config, 100, "long", [], 0);
    expect(price).toBe(100);
  });
});

describe("checkStopLoss", () => {
  it("triggers on candle low touching stop for long", () => {
    const candle = mockCandle({ open: 100, high: 105, low: 94, close: 98 });
    const result = checkStopLoss(95, candle, "long");
    expect(result).toBe(95);
  });

  it("does not trigger when low stays above stop for long", () => {
    const candle = mockCandle({ open: 100, high: 105, low: 96, close: 102 });
    const result = checkStopLoss(95, candle, "long");
    expect(result).toBeNull();
  });

  it("triggers at open on gap down for long", () => {
    const candle = mockCandle({ open: 90, high: 92, low: 88, close: 91 });
    const result = checkStopLoss(95, candle, "long");
    expect(result).toBe(90); // Execute at open, not stop price
  });

  it("triggers on candle high touching stop for short", () => {
    const candle = mockCandle({ open: 100, high: 106, low: 98, close: 104 });
    const result = checkStopLoss(105, candle, "short");
    expect(result).toBe(105);
  });

  it("does not trigger when high stays below stop for short", () => {
    const candle = mockCandle({ open: 100, high: 104, low: 98, close: 102 });
    const result = checkStopLoss(105, candle, "short");
    expect(result).toBeNull();
  });

  it("triggers at open on gap up for short", () => {
    const candle = mockCandle({ open: 110, high: 112, low: 108, close: 111 });
    const result = checkStopLoss(105, candle, "short");
    expect(result).toBe(110);
  });

  it("triggers when open equals stop price for long", () => {
    const candle = mockCandle({ open: 95, high: 100, low: 94, close: 98 });
    const result = checkStopLoss(95, candle, "long");
    expect(result).toBe(95);
  });

  it("triggers when open equals stop price for short", () => {
    const candle = mockCandle({ open: 105, high: 107, low: 103, close: 106 });
    const result = checkStopLoss(105, candle, "short");
    expect(result).toBe(105);
  });
});
