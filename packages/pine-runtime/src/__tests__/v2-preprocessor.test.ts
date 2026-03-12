import { describe, it, expect } from "vitest";
import { preprocessV2 } from "../v2-preprocessor.js";

describe("preprocessV2", () => {
  it("passes v5 scripts through unchanged", () => {
    const script = `//@version=5
strategy("Test", overlay=true)
fast = ta.sma(close, 10)`;
    expect(preprocessV2(script)).toBe(script);
  });

  it("rewrites v2 bare TA calls to ta.* prefix", () => {
    const script = `//@version=2
strategy("Test", overlay=true)
fast = sma(close, 10)
slow = ema(close, 30)`;
    const result = preprocessV2(script);
    expect(result).toContain("ta.sma(close, 10)");
    expect(result).toContain("ta.ema(close, 30)");
    expect(result).toContain("//@version=5");
    expect(result).not.toContain("//@version=2");
  });

  it("rewrites crossover and crossunder", () => {
    const script = `//@version=2
if (crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (crossunder(fast, slow))
    strategy.close("Long")`;
    const result = preprocessV2(script);
    expect(result).toContain("ta.crossover(fast, slow)");
    expect(result).toContain("ta.crossunder(fast, slow)");
  });

  it("does not rewrite variables that contain TA function names", () => {
    const script = `//@version=2
fastSMA = sma(close, 10)`;
    const result = preprocessV2(script);
    expect(result).toContain("fastSMA = ta.sma(close, 10)");
    // fastSMA should NOT become fastta.SMA
    expect(result).not.toContain("fastta.sma");
  });

  it("does not rewrite already-prefixed ta.* calls", () => {
    const script = `//@version=2
fast = ta.sma(close, 10)`;
    const result = preprocessV2(script);
    // Should not become ta.ta.sma
    expect(result).not.toContain("ta.ta.sma");
    expect(result).toContain("ta.sma(close, 10)");
  });

  it("adds version=5 header if no version directive exists", () => {
    const script = `strategy("Test", overlay=true)
fast = sma(close, 10)`;
    const result = preprocessV2(script);
    expect(result).toMatch(/^\/\/@version=5\n/);
    expect(result).toContain("ta.sma(close, 10)");
  });

  it("rewrites all supported TA functions", () => {
    const functions = [
      "sma", "ema", "rsi", "macd", "bb", "atr", "stoch", "vwap",
      "cci", "wpr", "ichimoku", "adx", "obv", "roc", "mom", "supertrend",
    ];
    for (const fn of functions) {
      const script = `//@version=2\nresult = ${fn}(close, 14)`;
      const result = preprocessV2(script);
      expect(result).toContain(`ta.${fn}(close, 14)`);
    }
  });

  it("does not rewrite function names that are object properties", () => {
    const script = `//@version=2
val = obj.sma(close, 10)`;
    const result = preprocessV2(script);
    // obj.sma should stay as obj.sma, not obj.ta.sma
    expect(result).toContain("obj.sma(close, 10)");
  });

  it("upgrades v3 and v4 scripts to v5", () => {
    for (const version of ["3", "4"]) {
      const script = `//@version=${version}\nfast = sma(close, 10)`;
      const result = preprocessV2(script);
      expect(result).toContain("//@version=5");
      expect(result).toContain("ta.sma(close, 10)");
    }
  });
});
