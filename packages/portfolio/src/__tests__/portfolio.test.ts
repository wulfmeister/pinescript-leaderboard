import { describe, it, expect } from "vitest";
import type { OHLCV, EquityPoint } from "@pinescript-utils/core";
import { BacktestEngine } from "@pinescript-utils/backtester";
import { pineRuntime } from "@pinescript-utils/pine-runtime";
import { runPortfolioBacktest } from "../portfolio.js";
import { alignEquityCurves } from "../alignment.js";
import { calculateCorrelationMatrix } from "../correlation.js";

const DAY_MS = 86400000;

const SMA_STRATEGY = `//@version=5
strategy("SMA Cross", overlay=true)
fast = ta.sma(close, 2)
slow = ta.sma(close, 4)
if (ta.crossover(fast, slow))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fast, slow))
    strategy.close("Long")`;

const NO_SIGNAL_STRATEGY = `//@version=5
strategy("No Signal", overlay=true)
v = ta.sma(close, 5)`;

function createData(closes: number[], start: number, offsetMs = 0): OHLCV[] {
  return closes.map((close, i) => ({
    timestamp: start + i * DAY_MS + offsetMs,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000000,
  }));
}

describe("runPortfolioBacktest", () => {
  it("single asset equals standalone backtest result", async () => {
    const data = createData(
      [100, 102, 104, 101, 99, 103, 106, 104, 101],
      1700000000000,
    );

    const standaloneSignals = await pineRuntime.executeStrategy(
      SMA_STRATEGY,
      data,
      10000,
    );
    const standalone = await new BacktestEngine({ initialCapital: 10000 }).run(
      standaloneSignals,
      data,
      "AAPL",
    );

    const portfolio = await runPortfolioBacktest({
      script: SMA_STRATEGY,
      assets: [{ symbol: "AAPL", data }],
      totalCapital: 10000,
    });

    expect(portfolio.perAsset).toHaveLength(1);
    expect(portfolio.perAsset[0].result.finalCapital).toBeCloseTo(
      standalone.finalCapital,
      8,
    );
    expect(portfolio.combined.finalCapital).toBeCloseTo(
      standalone.finalCapital,
      8,
    );
    expect(portfolio.combined.equityCurve).toHaveLength(
      standalone.equityCurve.length,
    );
  });

  it("splits capital equally across two assets", async () => {
    const start = 1700000000000;
    const a = createData([100, 101, 103, 102, 104, 103, 105], start);
    const b = createData([50, 52, 51, 53, 55, 54, 56], start);

    const result = await runPortfolioBacktest({
      script: SMA_STRATEGY,
      assets: [
        { symbol: "AAA", data: a },
        { symbol: "BBB", data: b },
      ],
      totalCapital: 20000,
    });

    expect(result.perAsset[0].allocation).toBe(10000);
    expect(result.perAsset[1].allocation).toBe(10000);
  });

  it("combined equity starts at total capital", async () => {
    const start = 1700000000000;
    const a = createData([100, 102, 101, 103, 105], start);
    const b = createData([80, 81, 82, 81, 83], start + 1000);

    const result = await runPortfolioBacktest({
      script: SMA_STRATEGY,
      assets: [
        { symbol: "AAA", data: a },
        { symbol: "BBB", data: b },
      ],
      totalCapital: 20000,
    });

    expect(result.combined.equityCurve[0].equity).toBeCloseTo(20000, 8);
  });

  it("combined final capital equals sum of per-asset final capitals", async () => {
    const start = 1700000000000;
    const a = createData([100, 103, 105, 104, 106, 108], start);
    const b = createData([200, 198, 201, 203, 205, 204], start + 1000);

    const result = await runPortfolioBacktest({
      script: SMA_STRATEGY,
      assets: [
        { symbol: "AAA", data: a },
        { symbol: "BBB", data: b },
      ],
      totalCapital: 20000,
    });

    const summed = result.perAsset.reduce(
      (
        acc: number,
        item: {
          result: { finalCapital: number };
        },
      ) => acc + item.result.finalCapital,
      0,
    );
    expect(result.combined.finalCapital).toBeCloseTo(summed, 8);
    expect(
      result.combined.equityCurve[result.combined.equityCurve.length - 1]
        .equity,
    ).toBeCloseTo(summed, 8);
  });

  it("includes zero-signal asset with flat equity contribution", async () => {
    const start = 1700000000000;
    const active = createData([100, 98, 101, 103, 102, 105, 104], start);
    const passive = createData(
      [300, 301, 302, 303, 304, 305, 306],
      start + 1000,
    );

    const result = await runPortfolioBacktest({
      script: NO_SIGNAL_STRATEGY,
      assets: [
        { symbol: "ACTIVE", data: active },
        { symbol: "PASSIVE", data: passive },
      ],
      totalCapital: 10000,
    });

    const passiveAsset = result.perAsset.find(
      (x: { symbol: string }) => x.symbol === "PASSIVE",
    );
    expect(passiveAsset).toBeDefined();
    expect(passiveAsset!.result.finalCapital).toBeCloseTo(
      passiveAsset!.allocation,
      8,
    );
    expect(passiveAsset!.signalCount).toBe(0);
  });

  it("throws on zero assets", async () => {
    await expect(
      runPortfolioBacktest({
        script: SMA_STRATEGY,
        assets: [],
        totalCapital: 10000,
      }),
    ).rejects.toThrow(/assets/i);
  });

  it("throws on more than ten assets", async () => {
    const data = createData([100, 101, 102], 1700000000000);
    const assets = Array.from({ length: 11 }, (_, i) => ({
      symbol: `A${i}`,
      data,
    }));

    await expect(
      runPortfolioBacktest({
        script: SMA_STRATEGY,
        assets,
        totalCapital: 10000,
      }),
    ).rejects.toThrow(/assets/i);
  });

  it("throws on empty script", async () => {
    const data = createData([100, 101, 102], 1700000000000);

    await expect(
      runPortfolioBacktest({
        script: "  ",
        assets: [{ symbol: "A", data }],
        totalCapital: 10000,
      }),
    ).rejects.toThrow(/script/i);
  });
});

describe("alignEquityCurves", () => {
  it("snaps timestamps to day boundaries and forward-fills values", () => {
    const day0 = 1700000000000;
    const day1 = day0 + DAY_MS;
    const day2 = day0 + DAY_MS * 2;

    const curves = new Map<string, EquityPoint[]>([
      [
        "AAA",
        [
          { timestamp: day0 + 1000, equity: 100, drawdown: 0 },
          { timestamp: day2 + 1000, equity: 120, drawdown: 0 },
        ],
      ],
      [
        "BBB",
        [
          { timestamp: day1 + 5000, equity: 200, drawdown: 0 },
          { timestamp: day2 + 5000, equity: 180, drawdown: 0.1 },
        ],
      ],
    ]);

    const aligned = alignEquityCurves(curves, 300);
    const snapped = aligned.map((p: EquityPoint) => p.timestamp);

    expect(snapped).toEqual([
      Math.floor(day0 / DAY_MS) * DAY_MS,
      Math.floor(day1 / DAY_MS) * DAY_MS,
      Math.floor(day2 / DAY_MS) * DAY_MS,
    ]);

    expect(aligned[0].equity).toBe(300);
    expect(aligned[1].equity).toBe(300);
    expect(aligned[2].equity).toBe(300);
  });
});

describe("calculateCorrelationMatrix", () => {
  it("returns NxN symmetric matrix with diagonal of one", () => {
    const start = 1700000000000;
    const assetData = new Map<string, OHLCV[]>([
      ["AAA", createData([100, 105, 110, 108, 112], start)],
      ["BBB", createData([50, 53, 54, 57, 60], start)],
      ["CCC", createData([80, 79, 81, 83, 82], start)],
    ]);

    const matrix = calculateCorrelationMatrix(assetData);

    expect(matrix).toHaveLength(3);
    for (let i = 0; i < matrix.length; i++) {
      expect(matrix[i]).toHaveLength(3);
      expect(matrix[i][i]).toBeCloseTo(1, 10);
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 10);
      }
    }
  });

  it("returns self correlation as one", () => {
    const start = 1700000000000;
    const assetData = new Map<string, OHLCV[]>([
      ["AAA", createData([100, 102, 104, 103], start)],
    ]);

    const matrix = calculateCorrelationMatrix(assetData);
    expect(matrix[0][0]).toBe(1);
  });
});
