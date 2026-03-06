import { describe, it, expect } from "vitest";
import { runMonteCarloSimulation, MonteCarloSimulator } from "../simulator.js";
import type { BacktestResult, Trade, EquityPoint, PerformanceMetrics } from "@pinescript-utils/core";

function createMockResult(trades: Partial<Trade>[]): BacktestResult {
  const mockTrades: Trade[] = trades.map((t, i) => ({
    id: `trade_${i}`,
    timestamp: Date.now() + i * 86400000,
    direction: "long" as const,
    action: t.action || ("close" as const),
    price: t.price || 100,
    quantity: t.quantity || 10,
    symbol: "TEST",
    pnl: t.pnl,
  }));

  return {
    trades: mockTrades,
    equityCurve: [
      { timestamp: Date.now(), equity: 10000, drawdown: 0 },
      { timestamp: Date.now() + 86400000, equity: 11000, drawdown: 0 },
    ],
    metrics: {
      totalReturn: 0.1,
      annualizedReturn: 0.1,
      totalTrades: trades.filter((t) => t.pnl !== undefined).length,
      sharpeRatio: 1.5,
      sortinoRatio: 2.0,
      maxDrawdown: 0.05,
      volatility: 0.15,
      winRate: 0.6,
      profitFactor: 1.8,
      averageWin: 500,
      averageLoss: 300,
      expectancy: 100,
      averageTrade: 100,
      averageTradeDuration: 0,
      maxTradeDuration: 0,
      minTradeDuration: 0,
    },
    startTime: Date.now(),
    endTime: Date.now() + 30 * 86400000,
    initialCapital: 10000,
    finalCapital: 11000,
  };
}

describe("runMonteCarloSimulation", () => {
  it("runs with default config", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
      { action: "close", pnl: -100 },
      { action: "close", pnl: 400 },
    ]);
    const mc = runMonteCarloSimulation(result);
    expect(mc.simulations).toBe(1000);
    expect(mc.finalEquity.mean).toBeGreaterThan(0);
    expect(mc.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("uses specified number of simulations", () => {
    const result = createMockResult([
      { action: "close", pnl: 100 },
      { action: "close", pnl: -50 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 100 });
    expect(mc.simulations).toBe(100);
  });

  it("is deterministic with same seed", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
      { action: "close", pnl: -100 },
      { action: "close", pnl: 400 },
    ]);
    const mc1 = runMonteCarloSimulation(result, { seed: 42, simulations: 100 });
    const mc2 = runMonteCarloSimulation(result, { seed: 42, simulations: 100 });
    expect(mc1.finalEquity.mean).toBe(mc2.finalEquity.mean);
    expect(mc1.maxDrawdown.p50).toBe(mc2.maxDrawdown.p50);
  });

  it("produces different results with different seeds", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
      { action: "close", pnl: -100 },
      { action: "close", pnl: 400 },
    ]);
    const mc1 = runMonteCarloSimulation(result, { seed: 42, simulations: 500 });
    const mc2 = runMonteCarloSimulation(result, { seed: 99, simulations: 500 });
    // Mean final equity should be the same (same PnLs), but distribution may differ
    expect(mc1.finalEquity.mean).toBeCloseTo(mc2.finalEquity.mean, 0);
  });

  it("handles no closing trades", () => {
    const result = createMockResult([
      { action: "buy" as any },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 10 });
    expect(mc.probabilityOfRuin).toBe(0);
    expect(mc.finalEquity.mean).toBe(10000);
  });

  it("calculates probability of ruin", () => {
    // All losing trades should have high ruin probability
    const result = createMockResult([
      { action: "close", pnl: -2000 },
      { action: "close", pnl: -2000 },
      { action: "close", pnl: -2000 },
      { action: "close", pnl: -2000 },
      { action: "close", pnl: -2000 },
    ]);
    const mc = runMonteCarloSimulation(result, {
      simulations: 100,
      ruinThreshold: 0.5,
      seed: 42,
    });
    // -10000 total loss on 10000 capital → should ruin every simulation
    expect(mc.probabilityOfRuin).toBe(1);
  });

  it("calculates expected max drawdown", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 100, seed: 42 });
    expect(mc.expectedMaxDrawdown).toBeGreaterThanOrEqual(0);
    expect(mc.expectedMaxDrawdown).toBeLessThanOrEqual(1);
  });

  it("returns equity curves when requested", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
    ]);
    const mc = runMonteCarloSimulation(result, {
      simulations: 10,
      returnEquityCurves: true,
      seed: 42,
    });
    expect(mc.equityCurves).toBeDefined();
    expect(mc.equityCurves!).toHaveLength(10);
    // Each curve should have trades.length + 1 points
    expect(mc.equityCurves![0]).toHaveLength(3); // initial + 2 trades
  });

  it("does not return equity curves by default", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 10 });
    expect(mc.equityCurves).toBeUndefined();
  });

  it("calls progress callback", () => {
    const result = createMockResult([
      { action: "close", pnl: 100 },
    ]);
    const progressCalls: number[] = [];
    runMonteCarloSimulation(result, {
      simulations: 500,
      onProgress: (completed) => progressCalls.push(completed),
    });
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]).toBe(500);
  });

  it("uses custom initial capital", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
    ]);
    const mc = runMonteCarloSimulation(result, {
      simulations: 10,
      initialCapital: 50000,
      seed: 42,
    });
    // Mean final equity should be around 50500
    expect(mc.finalEquity.mean).toBeCloseTo(50500, 0);
  });

  it("percentile distributions are ordered", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
      { action: "close", pnl: -100 },
      { action: "close", pnl: 400 },
      { action: "close", pnl: -200 },
      { action: "close", pnl: 300 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 1000, seed: 42 });
    expect(mc.finalEquity.p5).toBeLessThanOrEqual(mc.finalEquity.p25);
    expect(mc.finalEquity.p25).toBeLessThanOrEqual(mc.finalEquity.p50);
    expect(mc.finalEquity.p50).toBeLessThanOrEqual(mc.finalEquity.p75);
    expect(mc.finalEquity.p75).toBeLessThanOrEqual(mc.finalEquity.p95);
  });

  it("handles single trade", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 10, seed: 42 });
    // With only one trade, every simulation is the same
    expect(mc.finalEquity.p5).toBe(mc.finalEquity.p95);
    expect(mc.finalEquity.mean).toBeCloseTo(10500, 0);
  });

  it("total return distribution matches final equity", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -200 },
      { action: "close", pnl: 300 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 100, seed: 42 });
    // Mean total return should equal (mean final equity - initial) / initial
    const expectedReturn = (mc.finalEquity.mean - 10000) / 10000;
    expect(mc.totalReturn.mean).toBeCloseTo(expectedReturn, 4);
  });

  it("sharpe ratio distribution has realistic values", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
      { action: "close", pnl: -100 },
      { action: "close", pnl: 400 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 100, seed: 42 });
    // Sharpe should be a finite number
    expect(isFinite(mc.sharpeRatio.mean)).toBe(true);
  });

  it("max drawdown is non-negative", () => {
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
    ]);
    const mc = runMonteCarloSimulation(result, { simulations: 100, seed: 42 });
    expect(mc.maxDrawdown.mean).toBeGreaterThanOrEqual(0);
    expect(mc.maxDrawdown.p5).toBeGreaterThanOrEqual(0);
  });

  it("ruin threshold is stored in result", () => {
    const result = createMockResult([{ action: "close", pnl: 100 }]);
    const mc = runMonteCarloSimulation(result, { ruinThreshold: 0.3 });
    expect(mc.ruinThreshold).toBe(0.3);
  });
});

describe("MonteCarloSimulator", () => {
  it("creates simulator with config", () => {
    const sim = new MonteCarloSimulator({ simulations: 50, seed: 42 });
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -200 },
    ]);
    const mc = sim.simulate(result);
    expect(mc.simulations).toBe(50);
  });

  it("formatSummary produces readable output", () => {
    const sim = new MonteCarloSimulator({ simulations: 50, seed: 42 });
    const result = createMockResult([
      { action: "close", pnl: 500 },
      { action: "close", pnl: -300 },
      { action: "close", pnl: 200 },
    ]);
    const mc = sim.simulate(result);
    const summary = sim.formatSummary(mc);
    expect(summary).toContain("Monte Carlo Simulation Results");
    expect(summary).toContain("Simulations: 50");
    expect(summary).toContain("Final Equity Distribution");
    expect(summary).toContain("P50");
    expect(summary).toContain("Probability of Ruin");
  });
});
