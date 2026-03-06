import { describe, it, expect } from "vitest";
import { calculateTakeProfitPrice, checkTakeProfit } from "../take-profit.js";
import type { OHLCV, TakeProfitConfig } from "@pinescript-utils/core";

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

describe("calculateTakeProfitPrice", () => {
  it("calculates fixed take-profit for long position", () => {
    const config: TakeProfitConfig = { type: "fixed", value: 0.10 };
    const price = calculateTakeProfitPrice(config, 100, "long");
    expect(price).toBeCloseTo(110);
  });

  it("calculates fixed take-profit for short position", () => {
    const config: TakeProfitConfig = { type: "fixed", value: 0.10 };
    const price = calculateTakeProfitPrice(config, 100, "short");
    expect(price).toBeCloseTo(90);
  });

  it("calculates risk-reward take-profit with stop distance", () => {
    const config: TakeProfitConfig = { type: "risk-reward", value: 2 };
    // Entry 100, stop at 95 → stop distance = 5 → TP at 100 + 5*2 = 110
    const price = calculateTakeProfitPrice(config, 100, "long", 5);
    expect(price).toBeCloseTo(110);
  });

  it("calculates risk-reward take-profit for short with stop distance", () => {
    const config: TakeProfitConfig = { type: "risk-reward", value: 3 };
    // Entry 100, stop at 105 → stop distance = 5 → TP at 100 - 5*3 = 85
    const price = calculateTakeProfitPrice(config, 100, "short", 5);
    expect(price).toBeCloseTo(85);
  });

  it("uses 5% assumed risk when no stop distance provided for risk-reward", () => {
    const config: TakeProfitConfig = { type: "risk-reward", value: 2 };
    const price = calculateTakeProfitPrice(config, 100, "long");
    // Default stop distance = 100 * 0.05 = 5 → TP at 100 + 5*2 = 110
    expect(price).toBeCloseTo(110);
  });
});

describe("checkTakeProfit", () => {
  it("triggers when high reaches target for long", () => {
    const candle = mockCandle({ open: 108, high: 112, low: 107, close: 111 });
    const result = checkTakeProfit(110, candle, "long");
    expect(result).toBe(110);
  });

  it("does not trigger when high stays below target for long", () => {
    const candle = mockCandle({ open: 105, high: 109, low: 104, close: 108 });
    const result = checkTakeProfit(110, candle, "long");
    expect(result).toBeNull();
  });

  it("triggers at open on gap up past target for long", () => {
    const candle = mockCandle({ open: 115, high: 118, low: 114, close: 117 });
    const result = checkTakeProfit(110, candle, "long");
    expect(result).toBe(115);
  });

  it("triggers when low reaches target for short", () => {
    const candle = mockCandle({ open: 92, high: 93, low: 89, close: 91 });
    const result = checkTakeProfit(90, candle, "short");
    expect(result).toBe(90);
  });

  it("triggers at open on gap down past target for short", () => {
    const candle = mockCandle({ open: 85, high: 87, low: 83, close: 86 });
    const result = checkTakeProfit(90, candle, "short");
    expect(result).toBe(85);
  });
});
