import { describe, it, expect } from "vitest";
import {
  initTrailingStop,
  updateTrailingStop,
  checkTrailingStop,
} from "../trailing-stop.js";
import type { OHLCV, TrailingStopConfig } from "@pinescript-utils/core";

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

describe("initTrailingStop", () => {
  it("initializes trailing stop for long position", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "long", [], 0);
    expect(state.extremePrice).toBe(100);
    expect(state.stopPrice).toBeCloseTo(97);
  });

  it("initializes trailing stop for short position", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "short", [], 0);
    expect(state.extremePrice).toBe(100);
    expect(state.stopPrice).toBeCloseTo(103);
  });

  it("initializes ATR-based trailing stop", () => {
    const config: TrailingStopConfig = { type: "atr", value: 2, atrPeriod: 5 };
    const data = mockData(20);
    const entry = data[19].close;
    const state = initTrailingStop(config, entry, "long", data, 19);
    expect(state.extremePrice).toBe(entry);
    expect(state.stopPrice).toBeLessThan(entry);
  });
});

describe("updateTrailingStop", () => {
  it("ratchets stop up when price makes new high for long", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "long", [], 0);
    const candle = mockCandle({ high: 110, low: 105, close: 108 });
    const updated = updateTrailingStop(config, state, candle, "long", [], 0);
    expect(updated.extremePrice).toBe(110);
    expect(updated.stopPrice).toBeCloseTo(110 * 0.97);
    expect(updated.stopPrice).toBeGreaterThan(state.stopPrice);
  });

  it("does not loosen stop when price drops for long", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    let state = initTrailingStop(config, 100, "long", [], 0);
    // Price rises to 110
    const candle1 = mockCandle({ high: 110, low: 105, close: 108 });
    state = updateTrailingStop(config, state, candle1, "long", [], 0);
    const stopAfterRise = state.stopPrice;
    // Price drops
    const candle2 = mockCandle({ high: 106, low: 102, close: 104 });
    state = updateTrailingStop(config, state, candle2, "long", [], 0);
    // Stop should not have moved down
    expect(state.stopPrice).toBe(stopAfterRise);
  });

  it("ratchets stop down when price makes new low for short", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "short", [], 0);
    const candle = mockCandle({ high: 95, low: 90, close: 92 });
    const updated = updateTrailingStop(config, state, candle, "short", [], 0);
    expect(updated.extremePrice).toBe(90);
    expect(updated.stopPrice).toBeCloseTo(90 * 1.03);
    expect(updated.stopPrice).toBeLessThan(state.stopPrice);
  });

  it("does not loosen stop when price rises for short", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    let state = initTrailingStop(config, 100, "short", [], 0);
    // Price drops to 90
    const candle1 = mockCandle({ high: 95, low: 90, close: 92 });
    state = updateTrailingStop(config, state, candle1, "short", [], 0);
    const stopAfterDrop = state.stopPrice;
    // Price rises
    const candle2 = mockCandle({ high: 98, low: 93, close: 96 });
    state = updateTrailingStop(config, state, candle2, "short", [], 0);
    expect(state.stopPrice).toBe(stopAfterDrop);
  });

  it("handles ATR-based trailing stop update", () => {
    const config: TrailingStopConfig = { type: "atr", value: 1.5, atrPeriod: 5 };
    const data = mockData(20);
    const state = initTrailingStop(config, data[19].close, "long", data, 19);
    const candle = mockCandle({ high: data[19].close + 5, low: data[19].close + 2, close: data[19].close + 3 });
    const updated = updateTrailingStop(config, state, candle, "long", data, 19);
    expect(updated.extremePrice).toBeGreaterThan(state.extremePrice);
  });
});

describe("checkTrailingStop", () => {
  it("triggers when price drops below trailing stop for long", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "long", [], 0);
    // Stop is at 97, candle goes below
    const candle = mockCandle({ open: 98, high: 99, low: 96, close: 97 });
    const result = checkTrailingStop(state, candle, "long");
    expect(result).toBeCloseTo(97);
  });

  it("returns null when price stays above trailing stop for long", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "long", [], 0);
    const candle = mockCandle({ open: 102, high: 105, low: 100, close: 103 });
    const result = checkTrailingStop(state, candle, "long");
    expect(result).toBeNull();
  });

  it("triggers at open on gap down for long", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "long", [], 0);
    // Stop is at 97, opens at 95
    const candle = mockCandle({ open: 95, high: 96, low: 93, close: 94 });
    const result = checkTrailingStop(state, candle, "long");
    expect(result).toBe(95);
  });

  it("triggers when price rises above trailing stop for short", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "short", [], 0);
    // Stop is at 103, candle goes above
    const candle = mockCandle({ open: 102, high: 104, low: 101, close: 103 });
    const result = checkTrailingStop(state, candle, "short");
    expect(result).toBeCloseTo(103);
  });

  it("triggers at open on gap up for short", () => {
    const config: TrailingStopConfig = { type: "fixed", value: 0.03 };
    const state = initTrailingStop(config, 100, "short", [], 0);
    // Stop is at 103, opens at 106
    const candle = mockCandle({ open: 106, high: 108, low: 105, close: 107 });
    const result = checkTrailingStop(state, candle, "short");
    expect(result).toBe(106);
  });
});
