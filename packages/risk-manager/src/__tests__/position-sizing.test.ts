import { describe, it, expect } from "vitest";
import { calculatePositionSize } from "../position-sizing.js";
import type { OHLCV, PositionSizingConfig } from "@pinescript-utils/core";

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

describe("calculatePositionSize - fixed-fractional", () => {
  it("sizes position as fraction of capital without stop distance", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.5 };
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.capitalFraction).toBeCloseTo(0.5);
    expect(result.positionValue).toBeCloseTo(5000);
    expect(result.quantity).toBeCloseTo(50);
  });

  it("sizes position based on risk and stop distance", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.02 };
    // Risk 2% of 10000 = 200, stop distance = 5 → quantity = 200/5 = 40
    const result = calculatePositionSize(config, 10000, 100, 5);
    expect(result.quantity).toBeCloseTo(40);
    expect(result.positionValue).toBeCloseTo(4000);
  });

  it("caps position at 95% of capital", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.99 };
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.95);
  });

  it("caps position at 95% when stop distance would exceed limit", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.10 };
    // Risk 10% of 10000 = 1000, stop distance = 1 → quantity = 1000, value = 100000
    // This exceeds 95% of capital, so should be capped
    const result = calculatePositionSize(config, 10000, 100, 1);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.95);
  });

  it("handles zero stop distance", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.02 };
    const result = calculatePositionSize(config, 10000, 100, 0);
    // Zero stop distance falls through to using value as fraction
    expect(result.capitalFraction).toBeCloseTo(0.02);
  });
});

describe("calculatePositionSize - kelly", () => {
  it("calculates Kelly criterion position size", () => {
    const config: PositionSizingConfig = { type: "kelly", value: 0.5 };
    // W=0.6, R=1.5 → f* = 0.6 - (1-0.6)/1.5 = 0.6 - 0.267 = 0.333
    const result = calculatePositionSize(config, 10000, 100, undefined, 0.6, 1.5);
    expect(result.capitalFraction).toBeCloseTo(0.333, 2);
  });

  it("caps Kelly at max fraction (config.value)", () => {
    const config: PositionSizingConfig = { type: "kelly", value: 0.25 };
    // W=0.8, R=2 → f* = 0.8 - 0.2/2 = 0.7 → capped at 0.25
    const result = calculatePositionSize(config, 10000, 100, undefined, 0.8, 2);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.25);
  });

  it("returns zero when Kelly is negative (don't trade)", () => {
    const config: PositionSizingConfig = { type: "kelly", value: 0.5 };
    // W=0.2, R=0.5 → f* = 0.2 - 0.8/0.5 = 0.2 - 1.6 = -1.4 → clamped to 0
    const result = calculatePositionSize(config, 10000, 100, undefined, 0.2, 0.5);
    expect(result.capitalFraction).toBe(0);
    expect(result.quantity).toBe(0);
  });

  it("uses default win rate of 0.5 and ratio of 1 when not provided", () => {
    const config: PositionSizingConfig = { type: "kelly", value: 0.5 };
    // W=0.5, R=1 → f* = 0.5 - 0.5/1 = 0 → no bet
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.capitalFraction).toBe(0);
  });

  it("handles perfect win rate", () => {
    const config: PositionSizingConfig = { type: "kelly", value: 0.5 };
    // W=1.0, R=2 → f* = 1.0 - 0/2 = 1.0 → capped at 0.5
    const result = calculatePositionSize(config, 10000, 100, undefined, 1.0, 2);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.5);
  });
});

describe("calculatePositionSize - atr-based", () => {
  it("sizes position based on ATR", () => {
    const config: PositionSizingConfig = { type: "atr-based", value: 0.02, atrPeriod: 5 };
    const data = mockData(20);
    const result = calculatePositionSize(config, 10000, data[19].close, undefined, undefined, undefined, data, 19);
    expect(result.quantity).toBeGreaterThan(0);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.95);
  });

  it("falls back to value as fraction when no data provided", () => {
    const config: PositionSizingConfig = { type: "atr-based", value: 0.5 };
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.capitalFraction).toBeCloseTo(0.5);
  });

  it("caps at 95% of capital", () => {
    const config: PositionSizingConfig = { type: "atr-based", value: 0.99, atrPeriod: 5 };
    const data = mockData(20);
    const result = calculatePositionSize(config, 10000, data[19].close, undefined, undefined, undefined, data, 19);
    expect(result.capitalFraction).toBeLessThanOrEqual(0.95);
  });

  it("handles ATR period longer than data", () => {
    const config: PositionSizingConfig = { type: "atr-based", value: 0.02, atrPeriod: 50 };
    const data = mockData(5);
    const result = calculatePositionSize(config, 10000, data[4].close, undefined, undefined, undefined, data, 4);
    // Should still return a valid position
    expect(result.quantity).toBeGreaterThan(0);
  });
});

describe("calculatePositionSize - general", () => {
  it("returns positive values for valid inputs", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.5 };
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.quantity).toBeGreaterThan(0);
    expect(result.positionValue).toBeGreaterThan(0);
    expect(result.capitalFraction).toBeGreaterThan(0);
  });

  it("position value equals quantity times price", () => {
    const config: PositionSizingConfig = { type: "fixed-fractional", value: 0.5 };
    const result = calculatePositionSize(config, 10000, 100);
    expect(result.positionValue).toBeCloseTo(result.quantity * 100);
  });
});
