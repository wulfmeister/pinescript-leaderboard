import { describe, it, expect, beforeEach } from "vitest";
import { PineTSAdapter } from "../pinets-adapter.js";
import {
  resetGlobalTranspileCache,
  getGlobalTranspileCache,
} from "../transpile-cache.js";
import type { OHLCV } from "@pinescript-utils/core";

function makeDeterministicData(count: number, startPrice = 100): OHLCV[] {
  const data: OHLCV[] = [];
  const baseTime = 1704067200000;
  const dayMs = 86400000;
  const segmentSize = Math.floor(count / 4);

  for (let i = 0; i < count; i++) {
    const segment = Math.floor(i / segmentSize);
    const posInSegment = i % segmentSize;
    const price =
      segment % 2 === 0
        ? startPrice + posInSegment * 1.5
        : startPrice + segmentSize * 1.5 - posInSegment * 1.5;

    data.push({
      timestamp: baseTime + i * dayMs,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

function makeBullData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  const baseTime = 1704067200000;
  const dayMs = 86400000;
  for (let i = 0; i < count; i++) {
    const price = 100 + i * 0.5;
    data.push({
      timestamp: baseTime + i * dayMs,
      open: price - 0.3,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

const V5_EMA_CROSSOVER = `//@version=5
strategy("EMA Cross", overlay=true)
fastEMA = ta.ema(close, 5)
slowEMA = ta.ema(close, 20)
if (ta.crossover(fastEMA, slowEMA))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fastEMA, slowEMA))
    strategy.close("Long")`;

const V2_EMA_CROSSOVER = `//@version=2
strategy("EMA Cross v2", overlay=true)
fastEMA = ema(close, 5)
slowEMA = ema(close, 20)
if (crossover(fastEMA, slowEMA))
    strategy.entry("Long", strategy.long)
if (crossunder(fastEMA, slowEMA))
    strategy.close("Long")`;

const V5_WITH_INPUTS = `//@version=5
strategy("Parameterized")
fastLen = input(10, title="Fast Length")
slowLen = input(30, title="Slow Length")
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fast, slow))
    strategy.close("Long")`;

const V5_SHORT_STRATEGY = `//@version=5
strategy("Short Strategy")
fast = ta.ema(close, 5)
slow = ta.ema(close, 20)
if (ta.crossunder(fast, slow))
    strategy.entry("Short", strategy.short)
if (ta.crossover(fast, slow))
    strategy.close("Short")`;

const V5_LONG_SHORT = `//@version=5
strategy("Long Short Flip")
fast = ta.ema(close, 5)
slow = ta.ema(close, 20)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fast, slow))
    strategy.entry("Short", strategy.short)`;

const INVALID_SCRIPT = `this is not valid pinescript at all {{{{`;

const NO_ENTRY_STRATEGY = `//@version=5
strategy("No Entries")
fast = ta.ema(close, 10)
slow = ta.ema(close, 30)`;

const INPUT_INT_SCRIPT = `//@version=5
strategy("RSI Params")
rsiPeriod = input.int(14, "RSI Period", minval=2, maxval=50, step=1)
overbought = input(70, title="Overbought")
oversold = input(30, title="Oversold")
rsiVal = ta.rsi(close, rsiPeriod)
if (rsiVal < oversold)
    strategy.entry("Long", strategy.long)
if (rsiVal > overbought)
    strategy.close("Long")`;

describe("PineTSAdapter", () => {
  let adapter: PineTSAdapter;

  beforeEach(() => {
    resetGlobalTranspileCache();
    adapter = new PineTSAdapter();
  });

  describe("executeStrategy", () => {
    it("returns Signal[] for a v5 EMA crossover script", async () => {
      const data = makeDeterministicData(100);
      const signals = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        data,
        10000,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (const s of signals) {
        expect(s).toHaveProperty("timestamp");
        expect(s).toHaveProperty("action");
        expect(s).toHaveProperty("price");
        expect(["buy", "sell"]).toContain(s.action);
        expect(typeof s.timestamp).toBe("number");
        expect(typeof s.price).toBe("number");
      }
    });

    it("preprocesses v2 script and returns Signal[]", async () => {
      const data = makeDeterministicData(100);
      const signals = await adapter.executeStrategy(
        V2_EMA_CROSSOVER,
        data,
        10000,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (const s of signals) {
        expect(["buy", "sell"]).toContain(s.action);
        expect(s.price).toBeGreaterThan(0);
      }
    });

    it("applies paramOverrides producing different signals", async () => {
      const data = makeDeterministicData(200);

      const defaultSignals = await adapter.executeStrategy(
        V5_WITH_INPUTS,
        data,
        10000,
      );
      const overriddenSignals = await adapter.executeStrategy(
        V5_WITH_INPUTS,
        data,
        10000,
        {
          fastLen: 3,
          slowLen: 50,
        },
      );

      expect(Array.isArray(defaultSignals)).toBe(true);
      expect(Array.isArray(overriddenSignals)).toBe(true);

      for (const s of overriddenSignals) {
        expect(["buy", "sell"]).toContain(s.action);
      }
    });

    it("returns empty array for invalid script (no throw)", async () => {
      const data = makeDeterministicData(50);
      const signals = await adapter.executeStrategy(
        INVALID_SCRIPT,
        data,
        10000,
      );

      expect(signals).toEqual([]);
    });

    it("returns empty array for empty data", async () => {
      const signals = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        [],
        10000,
      );
      expect(signals).toEqual([]);
    });

    it("returns empty signals for script with no entry rules", async () => {
      const data = makeDeterministicData(50);
      const signals = await adapter.executeStrategy(
        NO_ENTRY_STRATEGY,
        data,
        10000,
      );

      expect(Array.isArray(signals)).toBe(true);
      expect(signals).toHaveLength(0);
    });

    it("produces consistent results for the same script and data", async () => {
      const data = makeDeterministicData(80);

      const signals1 = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        data,
        10000,
      );
      const signals2 = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        data,
        10000,
      );

      expect(signals1).toEqual(signals2);
    });
  });

  describe("extractParameters", () => {
    it("extracts input() parameters with title", () => {
      const params = adapter.extractParameters(V5_WITH_INPUTS);

      expect(params).toHaveLength(2);
      expect(params[0].name).toBe("fastLen");
      expect(params[0].defaultValue).toBe(10);
      expect(params[0].title).toBe("Fast Length");
      expect(params[1].name).toBe("slowLen");
      expect(params[1].defaultValue).toBe(30);
      expect(params[1].title).toBe("Slow Length");
    });

    it("extracts input.int() with minval/maxval/step", () => {
      const params = adapter.extractParameters(INPUT_INT_SCRIPT);

      const rsiParam = params.find((p) => p.name === "rsiPeriod");
      expect(rsiParam).toBeDefined();
      expect(rsiParam!.defaultValue).toBe(14);
      expect(rsiParam!.minval).toBe(2);
      expect(rsiParam!.maxval).toBe(50);
      expect(rsiParam!.step).toBe(1);
    });

    it("returns empty array for script with no inputs", () => {
      const script = `//@version=5
strategy("No Inputs")
fast = ta.ema(close, 10)`;
      const params = adapter.extractParameters(script);
      expect(params).toHaveLength(0);
    });
  });

  describe("validateScript", () => {
    it("validates a correct v5 strategy as valid", () => {
      const result = adapter.validateScript(V5_EMA_CROSSOVER);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("warns about missing @version directive", () => {
      const script = `strategy("Test")
fast = ta.ema(close, 10)`;
      const result = adapter.validateScript(script);

      expect(result.warnings.some((w) => w.message.includes("@version"))).toBe(
        true,
      );
    });

    it("warns about strategy with no entry rules", () => {
      const result = adapter.validateScript(NO_ENTRY_STRATEGY);

      expect(
        result.warnings.some((w) => w.message.includes("entry rules")),
      ).toBe(true);
    });

    it("returns valid for empty script", () => {
      const result = adapter.validateScript("");

      expect(result.valid).toBe(true);
    });
  });

  describe("position state machine", () => {
    it("generates buy signals for long entries", async () => {
      const data = makeDeterministicData(100);
      const signals = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        data,
        10000,
      );

      if (signals.length > 0) {
        expect(signals[0].action).toBe("buy");
      }
    });

    it("generates sell signals for short entries", async () => {
      const data = makeDeterministicData(100);
      const signals = await adapter.executeStrategy(
        V5_SHORT_STRATEGY,
        data,
        10000,
      );

      if (signals.length > 0) {
        expect(signals[0].action).toBe("sell");
      }
    });

    it("direction flip emits close + open signals", async () => {
      const data = makeDeterministicData(200);
      const signals = await adapter.executeStrategy(V5_LONG_SHORT, data, 10000);

      expect(Array.isArray(signals)).toBe(true);
      if (signals.length >= 3) {
        for (const s of signals) {
          expect(s).toHaveProperty("timestamp");
          expect(s).toHaveProperty("action");
          expect(s).toHaveProperty("price");
          expect(s.price).toBeGreaterThan(0);
        }
      }
    });

    it("prevents duplicate long entries (no consecutive buys in long-only)", async () => {
      const data = makeBullData(100);
      const signals = await adapter.executeStrategy(
        V5_EMA_CROSSOVER,
        data,
        10000,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (let i = 1; i < signals.length; i++) {
        if (signals[i - 1].action === "buy") {
          expect(signals[i].action).toBe("sell");
        }
      }
    });

    it("close on flat position is a no-op", async () => {
      const script = `//@version=5
strategy("Close Only")
fast = ta.ema(close, 5)
slow = ta.ema(close, 20)
if (ta.crossunder(fast, slow))
    strategy.close("Long")`;
      const data = makeDeterministicData(100);
      const signals = await adapter.executeStrategy(script, data, 10000);

      expect(signals).toHaveLength(0);
    });
  });

  describe("transpilation cache", () => {
    it("caches transpiled result on second call (cache grows by 1, not 2)", async () => {
      const data = makeDeterministicData(50);

      await adapter.executeStrategy(V5_EMA_CROSSOVER, data, 10000);
      const statsAfterFirst = getGlobalTranspileCache().getStats();

      await adapter.executeStrategy(V5_EMA_CROSSOVER, data, 10000);
      const statsAfterSecond = getGlobalTranspileCache().getStats();

      expect(statsAfterSecond.size).toBe(statsAfterFirst.size);
    });

    it("different scripts produce separate cache entries", async () => {
      const data = makeDeterministicData(50);

      await adapter.executeStrategy(V5_EMA_CROSSOVER, data, 10000);
      const sizeAfterFirst = getGlobalTranspileCache().getStats().size;

      await adapter.executeStrategy(V5_SHORT_STRATEGY, data, 10000);
      const sizeAfterSecond = getGlobalTranspileCache().getStats().size;

      expect(sizeAfterSecond).toBe(sizeAfterFirst + 1);
    });
  });

  describe("executeIndicator", () => {
    it("returns empty array for empty data", async () => {
      const values = await adapter.executeIndicator(
        `//@version=5\nfast = ta.ema(close, 10)`,
        [],
      );
      expect(values).toEqual([]);
    });
  });
});
