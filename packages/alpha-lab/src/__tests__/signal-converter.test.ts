import { describe, it, expect } from "vitest";
import {
  signalsToPositionSeries,
  combinePositionSeries,
} from "../signal-converter.js";
import type { Signal, OHLCV } from "@pinescript-utils/core";

function mockData(count: number): OHLCV[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 86400000,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 101 + i,
    volume: 1000000,
  }));
}

describe("signalsToPositionSeries", () => {
  it("returns all zeros for empty signals", () => {
    const data = mockData(5);
    const positions = signalsToPositionSeries([], data);
    expect(positions).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns empty for empty data", () => {
    expect(signalsToPositionSeries([], [])).toEqual([]);
  });

  it("sets position to 1 on buy and 0 on sell", () => {
    const data = mockData(5);
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: 101 },
      { timestamp: data[3].timestamp, action: "sell", price: 103 },
    ];
    const positions = signalsToPositionSeries(signals, data);
    expect(positions).toEqual([0, 1, 1, 0, 0]);
  });

  it("carries position forward between signals", () => {
    const data = mockData(6);
    const signals: Signal[] = [
      { timestamp: data[0].timestamp, action: "buy", price: 100 },
    ];
    const positions = signalsToPositionSeries(signals, data);
    expect(positions).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("handles multiple buy/sell cycles", () => {
    const data = mockData(8);
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: 101 },
      { timestamp: data[3].timestamp, action: "sell", price: 103 },
      { timestamp: data[5].timestamp, action: "buy", price: 105 },
      { timestamp: data[7].timestamp, action: "sell", price: 107 },
    ];
    const positions = signalsToPositionSeries(signals, data);
    expect(positions).toEqual([0, 1, 1, 0, 0, 1, 1, 0]);
  });
});

describe("combinePositionSeries", () => {
  it("returns empty for no factors", () => {
    const data = mockData(5);
    expect(combinePositionSeries([], data)).toEqual([]);
  });

  it("generates signals from weighted positions", () => {
    const data = mockData(5);
    const factors = [
      { positions: [0, 1, 1, 0, 0], weight: 0.6 },
      { positions: [0, 0, 1, 1, 0], weight: 0.4 },
    ];
    const signals = combinePositionSeries(factors, data, 0.3, 0.1);
    // Bar 0: score=0, no signal
    // Bar 1: score=0.6, buy (>0.3)
    // Bar 2: score=1.0, hold
    // Bar 3: score=0.4, hold
    // Bar 4: score=0, sell (<0.1)
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].action).toBe("buy");
  });

  it("generates both buy and sell signals", () => {
    const data = mockData(6);
    const factors = [
      { positions: [0, 1, 1, 0, 0, 0], weight: 0.5 },
    ];
    const signals = combinePositionSeries(factors, data, 0.3, 0.1);
    const buys = signals.filter((s) => s.action === "buy");
    const sells = signals.filter((s) => s.action === "sell");
    expect(buys.length).toBe(1);
    expect(sells.length).toBe(1);
  });

  it("returns empty for empty data", () => {
    const factors = [{ positions: [1, 1, 0], weight: 0.5 }];
    expect(combinePositionSeries(factors, [], 0.3, 0.1)).toEqual([]);
  });

  describe("NaN/Infinity guards", () => {
    it("skips NaN weight contributions without poisoning score", () => {
      const data = mockData(5);
      const factors = [
        { positions: [0, 1, 1, 0, 0], weight: NaN },
        { positions: [0, 1, 1, 0, 0], weight: 0.6 },
      ];
      const signals = combinePositionSeries(factors, data, 0.3, 0.1);
      // NaN factor is skipped, only the 0.6 factor contributes
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals[0].action).toBe("buy");
    });

    it("skips Infinity weight contributions without poisoning score", () => {
      const data = mockData(5);
      const factors = [
        { positions: [0, 1, 1, 0, 0], weight: Infinity },
        { positions: [0, 1, 1, 0, 0], weight: 0.6 },
      ];
      const signals = combinePositionSeries(factors, data, 0.3, 0.1);
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals[0].action).toBe("buy");
    });

    it("handles all-NaN weights gracefully (no entry signals)", () => {
      const data = mockData(5);
      const factors = [{ positions: [0, 1, 1, 0, 0], weight: NaN }];
      // All contributions are NaN → score stays 0 → no entry
      const signals = combinePositionSeries(factors, data, 0.3, 0.1);
      expect(signals.filter((s) => s.action === "buy")).toHaveLength(0);
    });

    it("skips NaN position values", () => {
      const data = mockData(5);
      const factors = [{ positions: [0, NaN, 1, 0, 0], weight: 0.6 }];
      const signals = combinePositionSeries(factors, data, 0.3, 0.1);
      // Bar 1: 0.6 * NaN = NaN → skipped, score = 0
      // Bar 2: 0.6 * 1 = 0.6 → buy
      expect(signals[0]?.action).toBe("buy");
      expect(signals[0]?.timestamp).toBe(data[2].timestamp);
    });

    it("skips -Infinity contributions", () => {
      const data = mockData(5);
      const factors = [
        { positions: [0, 1, 1, 0, 0], weight: -Infinity },
        { positions: [0, 1, 1, 0, 0], weight: 0.6 },
      ];
      const signals = combinePositionSeries(factors, data, 0.3, 0.1);
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals[0].action).toBe("buy");
    });
  });
});
