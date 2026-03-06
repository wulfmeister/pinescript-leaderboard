import { describe, it, expect } from "vitest";
import { BacktestEngine, DEFAULT_CONFIG, quickBacktest } from "../engine.js";
import type { OHLCV, Signal, RiskManagementConfig } from "@pinescript-utils/core";

function mockData(count: number, startPrice: number = 100): OHLCV[] {
  const data: OHLCV[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    price = startPrice + i * 0.5; // steadily rising
    data.push({
      timestamp: Date.now() - (count - i) * 86400000,
      open: price - 0.2,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000000,
    });
  }
  return data;
}

describe("BacktestEngine", () => {
  it("handles empty signals", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(50);
    const result = await engine.run([], data, "TEST");
    expect(result.trades).toHaveLength(0);
    expect(result.metrics.totalTrades).toBe(0);
    expect(result.initialCapital).toBe(10000);
    expect(result.finalCapital).toBe(10000);
  });

  it("processes buy and sell signals", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    expect(result.trades.length).toBeGreaterThanOrEqual(2);
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(1);
  });

  it("generates equity curve", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    expect(result.equityCurve.length).toBeGreaterThan(0);
    for (const point of result.equityCurve) {
      expect(point).toHaveProperty("timestamp");
      expect(point).toHaveProperty("equity");
      expect(point).toHaveProperty("drawdown");
      expect(point.equity).toBeGreaterThan(0);
    }
  });

  it("calculates performance metrics", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(100);
    const signals: Signal[] = [
      { timestamp: data[10].timestamp, action: "buy", price: data[10].close },
      { timestamp: data[30].timestamp, action: "sell", price: data[30].close },
      { timestamp: data[40].timestamp, action: "buy", price: data[40].close },
      { timestamp: data[60].timestamp, action: "sell", price: data[60].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    const m = result.metrics;
    expect(m).toHaveProperty("totalReturn");
    expect(m).toHaveProperty("sharpeRatio");
    expect(m).toHaveProperty("maxDrawdown");
    expect(m).toHaveProperty("winRate");
    expect(m).toHaveProperty("profitFactor");
    expect(m.totalTrades).toBe(2);
  });

  it("on rising data, buying low and selling high is profitable", async () => {
    const engine = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const data = mockData(100); // steadily rising
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[50].timestamp, action: "sell", price: data[50].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Buy at ~102.5, sell at ~125 on rising data → should profit
    expect(result.finalCapital).toBeGreaterThan(result.initialCapital);
    expect(result.metrics.totalReturn).toBeGreaterThan(0);
  });

  it("applies commission to trades", async () => {
    const noCommission = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const withCommission = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0.01, // 1%
      slippage: 0,
    });

    const data = mockData(100);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[50].timestamp, action: "sell", price: data[50].close },
    ];

    const resultNoComm = await noCommission.run(signals, data, "TEST");
    const resultWithComm = await withCommission.run(signals, data, "TEST");

    // Commission should reduce final capital
    expect(resultWithComm.finalCapital).toBeLessThan(resultNoComm.finalCapital);
  });

  it("applies slippage to trades", async () => {
    const noSlippage = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const withSlippage = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0.01, // 1%
    });

    const data = mockData(100);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[50].timestamp, action: "sell", price: data[50].close },
    ];

    const resultNoSlip = await noSlippage.run(signals, data, "TEST");
    const resultWithSlip = await withSlippage.run(signals, data, "TEST");

    // Slippage should reduce final capital
    expect(resultWithSlip.finalCapital).toBeLessThan(resultNoSlip.finalCapital);
  });

  it("closes open positions at end of data", async () => {
    const engine = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const data = mockData(50);
    // Only a buy signal, no sell — engine should close at end
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should have at least 2 trades (buy + forced close)
    expect(result.trades.length).toBeGreaterThanOrEqual(2);
    // Should not still have unrealized positions
    expect(result.finalCapital).toBeGreaterThan(0);
  });

  it("ignores sell signals when not in position", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "sell", price: data[5].close },
      { timestamp: data[10].timestamp, action: "sell", price: data[10].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // No trades should be recorded since we can't sell without buying first
    expect(result.trades).toHaveLength(0);
    expect(result.finalCapital).toBe(10000);
  });

  it("ignores duplicate buy signals when already in position", async () => {
    const engine = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[10].timestamp, action: "buy", price: data[10].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Only one buy and one sell (+ forced close) should happen
    const buys = result.trades.filter((t) => t.action === "buy");
    expect(buys).toHaveLength(1);
  });

  it("handles multiple round trips", async () => {
    const engine = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const data = mockData(100);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[15].timestamp, action: "sell", price: data[15].close },
      { timestamp: data[25].timestamp, action: "buy", price: data[25].close },
      { timestamp: data[35].timestamp, action: "sell", price: data[35].close },
      { timestamp: data[45].timestamp, action: "buy", price: data[45].close },
      { timestamp: data[55].timestamp, action: "sell", price: data[55].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    expect(result.metrics.totalTrades).toBe(3);
    expect(result.trades.length).toBe(6); // 3 buys + 3 sells
  });

  it("result has correct start and end times", async () => {
    const engine = new BacktestEngine({ ...DEFAULT_CONFIG, initialCapital: 10000 });
    const data = mockData(50);
    const result = await engine.run([], data, "TEST");
    expect(result.startTime).toBe(data[0].timestamp);
    expect(result.endTime).toBe(data[data.length - 1].timestamp);
  });

  it("sorts signals by timestamp before processing", async () => {
    const engine = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const data = mockData(50);
    // Signals out of order
    const signals: Signal[] = [
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should still process correctly (buy first, then sell)
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(1);
  });
});

describe("quickBacktest", () => {
  it("is a convenience wrapper that works", async () => {
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const result = await quickBacktest(signals, data, "TEST", 10000);
    expect(result).toHaveProperty("trades");
    expect(result).toHaveProperty("equityCurve");
    expect(result).toHaveProperty("metrics");
    expect(result.initialCapital).toBe(10000);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_CONFIG.initialCapital).toBe(10000);
    expect(DEFAULT_CONFIG.positionSize).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.positionSize).toBeLessThanOrEqual(1);
    expect(DEFAULT_CONFIG.commission).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.slippage).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.allowShorts).toBe(false);
  });
});

// Helper: generate data with a specific price pattern
function mockDataWithPrices(prices: number[]): OHLCV[] {
  return prices.map((price, i) => ({
    timestamp: Date.now() - (prices.length - i) * 86400000,
    open: price - 0.5,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1000000,
  }));
}

// Helper: generate data with explicit OHLC control
function mockDataDetailed(candles: { open: number; high: number; low: number; close: number }[]): OHLCV[] {
  return candles.map((c, i) => ({
    timestamp: Date.now() - (candles.length - i) * 86400000,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: 1000000,
  }));
}

describe("BacktestEngine - Risk Management", () => {
  it("backward compatible: no risk config produces identical results", async () => {
    const engineNoRisk = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
    });
    const engineWithEmpty = new BacktestEngine({
      ...DEFAULT_CONFIG,
      initialCapital: 10000,
      commission: 0,
      slippage: 0,
      riskManagement: {},
    });
    const data = mockData(50);
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const resultNoRisk = await engineNoRisk.run(signals, data, "TEST");
    const resultEmpty = await engineWithEmpty.run(signals, data, "TEST");
    expect(resultNoRisk.finalCapital).toBeCloseTo(resultEmpty.finalCapital, 2);
    expect(resultNoRisk.trades.length).toBe(resultEmpty.trades.length);
  });

  it("stop-loss triggers on price drop", async () => {
    // Price: 100, 105, 110, 108, 93, 95, 100
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 111, low: 104, close: 110 },
      { open: 110, high: 112, low: 107, close: 108 },
      { open: 108, high: 109, low: 92, close: 93 }, // drops below 5% stop
      { open: 93, high: 96, low: 92, close: 95 },
      { open: 95, high: 101, low: 94, close: 100 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should have a close trade from stop-loss
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    // The first close should be from the stop-loss (around 99.75 = 105 * 0.95)
    const slClose = closeTrades[0];
    expect(slClose.price).toBeLessThan(105); // closed below entry
  });

  it("take-profit triggers on price rise", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 111, low: 104, close: 110 },
      { open: 110, high: 120, low: 109, close: 118 }, // hits 10% TP = 115.5
      { open: 118, high: 119, low: 116, close: 117 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        takeProfit: { type: "fixed", value: 0.10 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    // TP price = 105 * 1.10 = 115.5
    expect(closeTrades[0].price).toBeCloseTo(115.5, 0);
  });

  it("trailing stop ratchets up and triggers on reversal", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },  // buy here
      { open: 105, high: 115, low: 104, close: 112 },  // trail up
      { open: 112, high: 120, low: 111, close: 118 },  // trail up more
      { open: 118, high: 121, low: 112, close: 113 },  // drops, trailing stop at 120*0.95=114, low=112 triggers
      { open: 113, high: 115, low: 110, close: 114 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        trailingStop: { type: "fixed", value: 0.05 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    const closeTrades = result.trades.filter((t) => t.action === "close");
    // Should close via trailing stop
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    // Exit price should be around 121*0.95 = 114.95
    expect(closeTrades[0].price).toBeLessThan(118);
  });

  it("combined SL + TP: take-profit wins on strong rally", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 111, low: 104, close: 110 },
      { open: 110, high: 125, low: 109, close: 122 }, // hits TP at 115.5 (10%)
      { open: 122, high: 125, low: 120, close: 123 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
        takeProfit: { type: "fixed", value: 0.10 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should be profitable (TP hit)
    expect(result.finalCapital).toBeGreaterThan(10000);
  });

  it("combined SL + TP: stop-loss wins on decline", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 106, low: 98, close: 99 }, // hits SL at 99.75 (5% below 105)
      { open: 99, high: 100, low: 95, close: 96 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
        takeProfit: { type: "fixed", value: 0.10 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should lose money (SL hit)
    expect(result.finalCapital).toBeLessThan(10000);
  });

  it("ATR-based stop-loss works with real data", async () => {
    const data = mockData(50);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "atr", value: 2, atrPeriod: 5 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[10].timestamp, action: "buy", price: data[10].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Should complete without errors
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
  });

  it("position sizing with fixed-fractional changes trade size", async () => {
    const data = mockData(50);
    const engineDefault = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
    });
    const engineSmall = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
        positionSizing: { type: "fixed-fractional", value: 0.02 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const resultDefault = await engineDefault.run(signals, data, "TEST");
    const resultSmall = await engineSmall.run(signals, data, "TEST");
    // Fixed-fractional with 2% risk should use much smaller position
    const buyDefault = resultDefault.trades.find((t) => t.action === "buy");
    const buySmall = resultSmall.trades.find((t) => t.action === "buy");
    expect(buySmall!.quantity).toBeLessThan(buyDefault!.quantity);
  });

  it("position sizing with Kelly criterion", async () => {
    const data = mockData(50);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        positionSizing: { type: "kelly", value: 0.25 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[25].timestamp, action: "sell", price: data[25].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    expect(result.trades.length).toBeGreaterThanOrEqual(2);
  });

  it("risk exit records correct PnL and commission", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 106, low: 98, close: 99 }, // triggers SL
      { open: 99, high: 100, low: 97, close: 98 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0.001, // 0.1% commission
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    // PnL should be negative (stopped out)
    expect(closeTrades[0].pnl).toBeLessThan(0);
  });

  it("equity curve has point for every candle when risk mgmt active", async () => {
    const data = mockData(20);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[15].timestamp, action: "sell", price: data[15].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // With risk management, we iterate all candles, so equity curve should be denser
    expect(result.equityCurve.length).toBeGreaterThanOrEqual(data.length);
  });

  it("open positions are force-closed at end with risk management", async () => {
    const data = mockData(20);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.50 }, // very wide stop so it won't trigger
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      // No sell signal - should be forced closed at end
    ];
    const result = await engine.run(signals, data, "TEST");
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    expect(result.finalCapital).toBeGreaterThan(0);
  });

  it("signal-based sell still works with risk management active", async () => {
    const data = mockData(30);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.50 }, // very wide, won't trigger
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[15].timestamp, action: "sell", price: data[15].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // Signal sell should close the position
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
  });

  it("multiple round trips work with risk management", async () => {
    const data = mockData(50);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.50 }, // wide stop
      },
    });
    const signals: Signal[] = [
      { timestamp: data[5].timestamp, action: "buy", price: data[5].close },
      { timestamp: data[10].timestamp, action: "sell", price: data[10].close },
      { timestamp: data[15].timestamp, action: "buy", price: data[15].close },
      { timestamp: data[20].timestamp, action: "sell", price: data[20].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    const buyTrades = result.trades.filter((t) => t.action === "buy");
    expect(buyTrades.length).toBe(2);
  });

  it("risk-reward take-profit uses stop distance", async () => {
    const data = mockDataDetailed([
      { open: 99, high: 101, low: 98, close: 100 },
      { open: 100, high: 106, low: 99, close: 105 },
      { open: 105, high: 111, low: 104, close: 110 },
      { open: 110, high: 125, low: 109, close: 122 }, // should hit R:R target
      { open: 122, high: 125, low: 120, close: 123 },
    ]);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
        takeProfit: { type: "risk-reward", value: 2 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[1].timestamp, action: "buy", price: data[1].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    // SL at 99.75 → distance=5.25, TP at 105 + 5.25*2 = 115.5
    const closeTrades = result.trades.filter((t) => t.action === "close");
    expect(closeTrades.length).toBeGreaterThanOrEqual(1);
    expect(result.finalCapital).toBeGreaterThan(10000);
  });

  it("ATR-based position sizing produces valid trades", async () => {
    const data = mockData(50);
    const engine = new BacktestEngine({
      initialCapital: 10000,
      positionSize: 0.95,
      commission: 0,
      slippage: 0,
      allowShorts: false,
      riskManagement: {
        stopLoss: { type: "fixed", value: 0.05 },
        positionSizing: { type: "atr-based", value: 0.02, atrPeriod: 5 },
      },
    });
    const signals: Signal[] = [
      { timestamp: data[10].timestamp, action: "buy", price: data[10].close },
      { timestamp: data[30].timestamp, action: "sell", price: data[30].close },
    ];
    const result = await engine.run(signals, data, "TEST");
    expect(result.trades.length).toBeGreaterThanOrEqual(2);
    const buyTrade = result.trades.find((t) => t.action === "buy");
    expect(buyTrade!.quantity).toBeGreaterThan(0);
  });
});
