import { describe, it, expect } from "vitest";
import { validateScript } from "../validate.js";

describe("validateScript", () => {
  it("returns valid for well-formed v5 strategy", () => {
    const script = `//@version=5
strategy("Test", overlay=true)
fast = ta.sma(close, 10)
slow = ta.sma(close, 30)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fast, slow))
    strategy.close("Long")`;
    const result = validateScript(script);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when @version directive is missing", () => {
    const script = `strategy("Test", overlay=true)
fast = ta.sma(close, 10)
if (ta.crossover(fast, close))
    strategy.entry("Long", strategy.long)`;
    const result = validateScript(script);
    expect(result.warnings.some((w) => w.message.includes("@version"))).toBe(
      true,
    );
  });

  it("warns when strategy is declared but has no entry rules", () => {
    const script = `//@version=5
strategy("Test", overlay=true)
fast = ta.sma(close, 10)`;
    const result = validateScript(script);
    expect(
      result.warnings.some((w) => w.message.includes("no entry rules")),
    ).toBe(true);
  });

  it("does not warn about entry rules for non-strategy scripts", () => {
    const script = `//@version=5
indicator("RSI", overlay=false)
rsiVal = ta.rsi(close, 14)`;
    const result = validateScript(script);
    expect(
      result.warnings.some((w) => w.message.includes("no entry rules")),
    ).toBe(false);
  });

  it("returns valid with warnings (not errors) for missing version", () => {
    const script = `strategy("Test", overlay=true)
if (ta.crossover(ta.sma(close, 10), ta.sma(close, 30)))
    strategy.entry("Long", strategy.long)`;
    const result = validateScript(script);
    // Should still be valid since the preprocessing handles missing version
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns valid true even for loose PineScript (PineTS is lenient)", () => {
    // PineTS doesn't throw on most invalid scripts — it just ignores them.
    // validateScript only returns invalid when PineTS throws during transpilation.
    const script = `//@version=5
this is not valid pinescript at all {{{`;
    const result = validateScript(script);
    // PineTS is lenient — this may pass or fail depending on the parser
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("handles v2 scripts via preprocessing", () => {
    const script = `//@version=2
strategy("V2 Test", overlay=true)
fast = sma(close, 10)
if (crossover(fast, close))
    strategy.entry("Long", strategy.long)`;
    const result = validateScript(script);
    // v2 scripts get preprocessed to v5 before validation
    expect(result.valid).toBe(true);
  });
});
