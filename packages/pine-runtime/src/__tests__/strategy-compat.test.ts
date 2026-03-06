import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pineRuntime } from "../pinets-adapter.js";
import type { OHLCV, Signal } from "@pinescript-utils/core";

function makeSinusoidalData(count: number): OHLCV[] {
  const data: OHLCV[] = [];
  const basePrice = 100;
  const amplitude = 20;
  const barsPerCycle = 40;
  const fixedEpochMs = 1_700_000_000_000;

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / barsPerCycle;
    const mid = basePrice + amplitude * Math.sin(angle);
    const deterministicNoise = Math.sin(i * 7.3) * 0.5;
    const close = mid + deterministicNoise;
    const open = close - Math.sin(i * 3.1) * 0.3;
    const high = Math.max(open, close) + Math.abs(Math.sin(i * 2.7)) * 1.5;
    const low = Math.min(open, close) - Math.abs(Math.sin(i * 4.3)) * 1.5;

    data.push({
      timestamp: fixedEpochMs + i * 86_400_000,
      open,
      high,
      low,
      close,
      volume: 1_000_000 + Math.floor(Math.sin(i * 1.9) * 200_000),
    });
  }
  return data;
}

const MOCK_DATA = makeSinusoidalData(200);
const STRATEGIES_DIR = resolve(__dirname, "../../../../strategies");
const VALID_ACTIONS = new Set(["buy", "sell", "close"]);

function loadStrategy(filename: string): string {
  return readFileSync(resolve(STRATEGIES_DIR, filename), "utf-8");
}

function assertValidSignals(signals: Signal[]): void {
  expect(Array.isArray(signals)).toBe(true);
  expect(signals.length).toBeGreaterThan(0);

  for (const signal of signals) {
    expect(signal).toHaveProperty("timestamp");
    expect(signal).toHaveProperty("action");
    expect(signal).toHaveProperty("price");

    expect(typeof signal.timestamp).toBe("number");
    expect(typeof signal.price).toBe("number");
    expect(signal.price).toBeGreaterThan(0);
    expect(VALID_ACTIONS.has(signal.action)).toBe(true);
  }
}

describe("Strategy file compatibility (PineTS)", () => {
  const strategyFiles = [
    "sma_crossover.pine",
    "ema_hardcoded.pine",
    "ema_simple.pine",
    "fast_ema.pine",
    "slow_ema.pine",
    "rsi_strategy.pine",
    "macd_strategy.pine",
    "bb_strategy.pine",
  ] as const;

  for (const filename of strategyFiles) {
    describe(filename, () => {
      it("executes without error and produces valid signals", async () => {
        const script = loadStrategy(filename);
        const signals = await pineRuntime.executeStrategy(
          script,
          MOCK_DATA,
          10_000,
        );

        assertValidSignals(signals);
      });
    });
  }
});
