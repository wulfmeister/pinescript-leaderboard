import { describe, it, expect, beforeEach } from "vitest";
import { StrategyNamespace } from "../strategy-namespace.js";

describe("StrategyNamespace", () => {
  let ns: StrategyNamespace;

  beforeEach(() => {
    ns = new StrategyNamespace();
    ns.setCurrentBar(1000, 100);
  });

  describe("entry", () => {
    it("generates buy signal for long entry", () => {
      ns.entry("Long", "long");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        timestamp: 1000,
        action: "buy",
        price: 100,
        metadata: { ruleId: "Long", direction: "long" },
      });
    });

    it("generates sell signal for short entry", () => {
      ns.entry("Short", "short");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        action: "sell",
        metadata: { ruleId: "Short", direction: "short" },
      });
    });

    it("ignores duplicate long entry when already long", () => {
      ns.entry("Long", "long");
      ns.setCurrentBar(2000, 110);
      ns.entry("Long", "long");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(1);
    });

    it("ignores duplicate short entry when already short", () => {
      ns.entry("Short", "short");
      ns.setCurrentBar(2000, 90);
      ns.entry("Short", "short");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(1);
    });

    it("closes short before opening long (position flip)", () => {
      ns.entry("Short", "short");
      ns.setCurrentBar(2000, 95);
      ns.entry("Long", "long");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(3);
      // 1: open short
      expect(signals[0].action).toBe("sell");
      // 2: close short (buy)
      expect(signals[1]).toMatchObject({
        action: "buy",
        metadata: { ruleId: "Long", closeShort: true },
      });
      // 3: open long (buy)
      expect(signals[2]).toMatchObject({
        action: "buy",
        metadata: { ruleId: "Long", direction: "long" },
      });
    });

    it("closes long before opening short (position flip)", () => {
      ns.entry("Long", "long");
      ns.setCurrentBar(2000, 105);
      ns.entry("Short", "short");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(3);
      // 1: open long
      expect(signals[0].action).toBe("buy");
      // 2: close long (sell)
      expect(signals[1]).toMatchObject({
        action: "sell",
        metadata: { ruleId: "Short", closeLong: true },
      });
      // 3: open short (sell)
      expect(signals[2]).toMatchObject({
        action: "sell",
        metadata: { ruleId: "Short", direction: "short" },
      });
    });
  });

  describe("close", () => {
    it("generates sell signal to close long position", () => {
      ns.entry("Long", "long");
      ns.setCurrentBar(2000, 110);
      ns.close("CloseLong");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(2);
      expect(signals[1]).toMatchObject({
        timestamp: 2000,
        action: "sell",
        price: 110,
        metadata: { ruleId: "CloseLong" },
      });
    });

    it("generates buy signal to close short position", () => {
      ns.entry("Short", "short");
      ns.setCurrentBar(2000, 90);
      ns.close("CloseShort");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(2);
      expect(signals[1]).toMatchObject({
        action: "buy",
        metadata: { ruleId: "CloseShort", closeShort: true },
      });
    });

    it("does nothing when no position is open", () => {
      ns.close("NoOp");
      expect(ns.getSignals()).toHaveLength(0);
    });
  });

  describe("exit", () => {
    it("delegates to close", () => {
      ns.entry("Long", "long");
      ns.setCurrentBar(2000, 110);
      ns.exit("ExitLong");
      const signals = ns.getSignals();
      expect(signals).toHaveLength(2);
      expect(signals[1].action).toBe("sell");
    });
  });

  describe("strategy callable", () => {
    it("exposes long and short direction constants", () => {
      expect(ns.strategy.long).toBe("long");
      expect(ns.strategy.short).toBe("short");
    });

    it("exposes entry, close, exit methods", () => {
      expect(typeof ns.strategy.entry).toBe("function");
      expect(typeof ns.strategy.close).toBe("function");
      expect(typeof ns.strategy.exit).toBe("function");
    });

    it("strategy function is callable (no-op)", () => {
      expect(() => ns.strategy("Test", true)).not.toThrow();
    });
  });

  describe("context resolution", () => {
    it("uses setCurrentBar values by default", () => {
      ns.setCurrentBar(5000, 200);
      ns.entry("Long", "long");
      const signals = ns.getSignals();
      expect(signals[0].timestamp).toBe(5000);
      expect(signals[0].price).toBe(200);
    });

    it("allows context override on entry", () => {
      ns.entry("Long", "long", { timestamp: 9999, price: 500 });
      const signals = ns.getSignals();
      expect(signals[0].timestamp).toBe(9999);
      expect(signals[0].price).toBe(500);
    });

    it("uses context provider when provided", () => {
      const provider = () => ({ timestamp: 7777, price: 300 });
      const nsWithProvider = new StrategyNamespace(provider);
      nsWithProvider.entry("Long", "long");
      const signals = nsWithProvider.getSignals();
      expect(signals[0].timestamp).toBe(7777);
      expect(signals[0].price).toBe(300);
    });
  });

  describe("param", () => {
    it("returns scalar value directly", () => {
      expect(ns.param(42)).toBe(42);
    });

    it("returns indexed value from array", () => {
      expect(ns.param([10, 20, 30], 1)).toBe(20);
    });

    it("defaults to index 0 for arrays", () => {
      expect(ns.param([10, 20, 30])).toBe(10);
    });
  });

  describe("getSignals", () => {
    it("returns a copy of signals array", () => {
      ns.entry("Long", "long");
      const signals1 = ns.getSignals();
      const signals2 = ns.getSignals();
      expect(signals1).toEqual(signals2);
      expect(signals1).not.toBe(signals2);
    });
  });
});
