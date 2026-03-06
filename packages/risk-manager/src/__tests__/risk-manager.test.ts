import { describe, it, expect } from "vitest";
import { RiskManager } from "../risk-manager.js";
import type { OHLCV, RiskManagementConfig } from "@pinescript-utils/core";

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

describe("RiskManager", () => {
  describe("hasExitRules", () => {
    it("returns true when stop-loss is configured", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      expect(rm.hasExitRules()).toBe(true);
    });

    it("returns true when take-profit is configured", () => {
      const rm = new RiskManager({ takeProfit: { type: "fixed", value: 0.10 } });
      expect(rm.hasExitRules()).toBe(true);
    });

    it("returns true when trailing-stop is configured", () => {
      const rm = new RiskManager({ trailingStop: { type: "fixed", value: 0.03 } });
      expect(rm.hasExitRules()).toBe(true);
    });

    it("returns false when only position sizing is configured", () => {
      const rm = new RiskManager({ positionSizing: { type: "fixed-fractional", value: 0.02 } });
      expect(rm.hasExitRules()).toBe(false);
    });

    it("returns false when no config is provided", () => {
      const rm = new RiskManager({});
      expect(rm.hasExitRules()).toBe(false);
    });
  });

  describe("onPositionOpened / onPositionClosed", () => {
    it("tracks position state after opening", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const state = rm.getPositionState("TEST");
      expect(state).toBeDefined();
      expect(state!.entryPrice).toBe(100);
      expect(state!.direction).toBe("long");
      expect(state!.stopLossPrice).toBeCloseTo(95);
    });

    it("removes position state after closing", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      rm.onPositionClosed("TEST");
      expect(rm.getPositionState("TEST")).toBeUndefined();
    });

    it("sets up take-profit with stop distance when both configured", () => {
      const config: RiskManagementConfig = {
        stopLoss: { type: "fixed", value: 0.05 },
        takeProfit: { type: "risk-reward", value: 2 },
      };
      const rm = new RiskManager(config);
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const state = rm.getPositionState("TEST");
      // Stop at 95 (5% below 100), distance = 5, TP = 100 + 5*2 = 110
      expect(state!.takeProfitPrice).toBeCloseTo(110);
    });

    it("initializes trailing stop state", () => {
      const rm = new RiskManager({ trailingStop: { type: "fixed", value: 0.03 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const state = rm.getPositionState("TEST");
      expect(state!.trailingStopState).toBeDefined();
      expect(state!.trailingStopState!.extremePrice).toBe(100);
    });
  });

  describe("checkRiskConditions", () => {
    it("returns not triggered when no risk events", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const candle = mockCandle({ open: 101, high: 103, low: 99, close: 102 });
      const result = rm.checkRiskConditions("TEST", candle, data, 19);
      expect(result.triggered).toBe(false);
    });

    it("triggers stop-loss when price drops below stop", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const candle = mockCandle({ open: 96, high: 97, low: 93, close: 94 });
      const result = rm.checkRiskConditions("TEST", candle, data, 19);
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe("stop-loss");
      expect(result.exitPrice).toBe(95);
    });

    it("triggers take-profit when price rises above target", () => {
      const rm = new RiskManager({ takeProfit: { type: "fixed", value: 0.10 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      const candle = mockCandle({ open: 108, high: 112, low: 107, close: 111 });
      const result = rm.checkRiskConditions("TEST", candle, data, 19);
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe("take-profit");
      expect(result.exitPrice).toBe(110);
    });

    it("triggers trailing-stop when price reverses", () => {
      const rm = new RiskManager({ trailingStop: { type: "fixed", value: 0.03 } });
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      // First candle pushes price up to update trailing stop
      const candle1 = mockCandle({ open: 105, high: 110, low: 104, close: 108 });
      rm.checkRiskConditions("TEST", candle1, data, 19);
      // Trailing stop should now be around 110 * 0.97 = 106.7
      // Next candle drops below trailing stop
      const candle2 = mockCandle({ open: 107, high: 108, low: 105, close: 106 });
      const result = rm.checkRiskConditions("TEST", candle2, data, 19);
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe("trailing-stop");
    });

    it("stop-loss takes priority over take-profit on same candle", () => {
      const config: RiskManagementConfig = {
        stopLoss: { type: "fixed", value: 0.05 },
        takeProfit: { type: "fixed", value: 0.10 },
      };
      const rm = new RiskManager(config);
      const data = mockData(20);
      rm.onPositionOpened("TEST", 100, "long", data, 19);
      // Candle that triggers both (very wide range)
      const candle = mockCandle({ open: 94, high: 115, low: 90, close: 112 });
      const result = rm.checkRiskConditions("TEST", candle, data, 19);
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe("stop-loss");
    });

    it("returns not triggered for unknown symbol", () => {
      const rm = new RiskManager({ stopLoss: { type: "fixed", value: 0.05 } });
      const candle = mockCandle();
      const result = rm.checkRiskConditions("UNKNOWN", candle, [], 0);
      expect(result.triggered).toBe(false);
    });
  });

  describe("getPositionSize", () => {
    it("returns default 95% when no sizing config", () => {
      const rm = new RiskManager({});
      const data = mockData(20);
      const result = rm.getPositionSize(10000, 100, data, 19);
      expect(result.capitalFraction).toBeCloseTo(0.95);
    });

    it("uses fixed-fractional sizing", () => {
      const rm = new RiskManager({
        positionSizing: { type: "fixed-fractional", value: 0.5 },
      });
      const data = mockData(20);
      const result = rm.getPositionSize(10000, 100, data, 19);
      expect(result.capitalFraction).toBeCloseTo(0.5);
    });

    it("uses stop distance for position sizing when stop-loss configured", () => {
      const rm = new RiskManager({
        stopLoss: { type: "fixed", value: 0.05 },
        positionSizing: { type: "fixed-fractional", value: 0.02 },
      });
      const data = mockData(20);
      const result = rm.getPositionSize(10000, 100, data, 19);
      // Risk 2% of 10000 = 200, stop distance = 5, quantity = 40
      expect(result.quantity).toBeCloseTo(40);
    });

    it("uses Kelly criterion sizing", () => {
      const rm = new RiskManager({
        positionSizing: { type: "kelly", value: 0.5 },
      });
      const data = mockData(20);
      const result = rm.getPositionSize(10000, 100, data, 19, 0.6, 1.5);
      expect(result.capitalFraction).toBeGreaterThan(0);
      expect(result.capitalFraction).toBeLessThanOrEqual(0.5);
    });
  });
});
