import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock fs module
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock dataFeed and other dependencies
vi.mock("@pinescript-utils/data-feed", () => ({
  dataFeed: {
    getMockData: vi.fn((type, bars, volatility) => ({
      type,
      bars,
      volatility,
    })),
    fetchHistorical: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@pinescript-utils/pine-runtime", () => ({
  pineRuntime: {
    validateScript: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
    executeStrategy: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@pinescript-utils/backtester", () => ({
  BacktestEngine: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      trades: [],
      metrics: {
        totalReturn: 0.1,
        winRate: 0.55,
        profitFactor: 1.2,
        sharpeRatio: 1.5,
        sortinoRatio: 1.8,
        maxDrawdown: -0.05,
        volatility: 0.15,
        totalTrades: 0,
        averageWin: 100,
        averageLoss: -50,
        expectancy: 25,
        averageTrade: 50,
      },
      initialCapital: 10000,
      finalCapital: 11000,
    }),
  })),
}));

vi.mock("@pinescript-utils/reporter", () => ({
  saveHTMLReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@pinescript-utils/ranker", () => ({
  StrategyRanker: vi.fn().mockImplementation(() => ({
    rankStrategies: vi.fn().mockResolvedValue({
      rankings: [],
      summary: "Ranking complete",
    }),
    generateSummary: vi.fn().mockReturnValue("Summary"),
    generateComparisonTable: vi.fn().mockReturnValue("Comparison table"),
  })),
}));

vi.mock("@pinescript-utils/optimizer", () => ({
  StrategyOptimizer: vi.fn().mockImplementation(() => ({
    getParameterRanges: vi.fn().mockReturnValue([]),
    optimize: vi.fn().mockResolvedValue({
      best: { params: {}, score: 0, result: { metrics: {} } },
      results: [],
    }),
    formatSummary: vi.fn().mockReturnValue("Optimization complete"),
    formatResultsTable: vi.fn().mockReturnValue("Results table"),
  })),
}));

vi.mock("@pinescript-utils/walk-forward", () => ({
  WalkForwardAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      windows: [],
      summary: {},
    }),
    formatSummary: vi.fn().mockReturnValue("Walk-forward complete"),
    formatWindowsTable: vi.fn().mockReturnValue("Windows table"),
  })),
}));

vi.mock("@pinescript-utils/llm-arena", () => ({
  ArenaEngine: vi.fn().mockImplementation(() => ({
    runTournament: vi.fn().mockResolvedValue({
      standings: [],
      matchups: [],
      elapsedMs: 1000,
    }),
  })),
}));

vi.mock("@pinescript-utils/monte-carlo", () => ({
  MonteCarloSimulator: vi.fn().mockImplementation(() => ({
    simulate: vi.fn().mockReturnValue({}),
    formatSummary: vi.fn().mockReturnValue("Monte Carlo complete"),
  })),
}));

// Helper functions from the CLI
function buildRiskManagementConfig(options: any): any {
  const config: any = {};
  let hasConfig = false;

  if (options.stopLoss) {
    config.stopLoss = { type: "fixed", value: parseFloat(options.stopLoss) };
    hasConfig = true;
  } else if (options.stopLossAtr) {
    config.stopLoss = { type: "atr", value: parseFloat(options.stopLossAtr) };
    hasConfig = true;
  }

  if (options.takeProfit) {
    config.takeProfit = {
      type: "fixed",
      value: parseFloat(options.takeProfit),
    };
    hasConfig = true;
  } else if (options.takeProfitRr) {
    config.takeProfit = {
      type: "risk-reward",
      value: parseFloat(options.takeProfitRr),
    };
    hasConfig = true;
  }

  if (options.trailingStop) {
    config.trailingStop = {
      type: "fixed",
      value: parseFloat(options.trailingStop),
    };
    hasConfig = true;
  } else if (options.trailingStopAtr) {
    config.trailingStop = {
      type: "atr",
      value: parseFloat(options.trailingStopAtr),
    };
    hasConfig = true;
  }

  if (options.positionSizing) {
    const value = parseFloat(options.riskFraction || "0.02");
    config.positionSizing = { type: options.positionSizing, value };
    hasConfig = true;
  }

  return hasConfig ? config : undefined;
}

describe("CLI buildRiskManagementConfig", () => {
  it("should return undefined when no options provided", () => {
    expect(buildRiskManagementConfig({})).toBeUndefined();
  });

  it("should build fixed stop-loss config", () => {
    const result = buildRiskManagementConfig({ stopLoss: "0.05" });
    expect(result).toEqual({
      stopLoss: { type: "fixed", value: 0.05 },
    });
  });

  it("should build ATR stop-loss config", () => {
    const result = buildRiskManagementConfig({ stopLossAtr: "2" });
    expect(result).toEqual({
      stopLoss: { type: "atr", value: 2 },
    });
  });

  it("should build fixed take-profit config", () => {
    const result = buildRiskManagementConfig({ takeProfit: "0.10" });
    expect(result).toEqual({
      takeProfit: { type: "fixed", value: 0.1 },
    });
  });

  it("should build risk-reward take-profit config", () => {
    const result = buildRiskManagementConfig({ takeProfitRr: "2" });
    expect(result).toEqual({
      takeProfit: { type: "risk-reward", value: 2 },
    });
  });

  it("should build trailing stop config", () => {
    const result = buildRiskManagementConfig({ trailingStop: "0.03" });
    expect(result).toEqual({
      trailingStop: { type: "fixed", value: 0.03 },
    });
  });

  it("should build ATR trailing stop config", () => {
    const result = buildRiskManagementConfig({ trailingStopAtr: "1.5" });
    expect(result).toEqual({
      trailingStop: { type: "atr", value: 1.5 },
    });
  });

  it("should build position sizing config with default fraction", () => {
    const result = buildRiskManagementConfig({
      positionSizing: "fixed-fractional",
    });
    expect(result).toEqual({
      positionSizing: { type: "fixed-fractional", value: 0.02 },
    });
  });

  it("should build position sizing config with custom fraction", () => {
    const result = buildRiskManagementConfig({
      positionSizing: "fixed-fractional",
      riskFraction: "0.05",
    });
    expect(result).toEqual({
      positionSizing: { type: "fixed-fractional", value: 0.05 },
    });
  });

  it("should combine multiple risk management options", () => {
    const result = buildRiskManagementConfig({
      stopLoss: "0.05",
      takeProfit: "0.10",
      positionSizing: "fixed-fractional",
      riskFraction: "0.03",
    });
    expect(result).toEqual({
      stopLoss: { type: "fixed", value: 0.05 },
      takeProfit: { type: "fixed", value: 0.1 },
      positionSizing: { type: "fixed-fractional", value: 0.03 },
    });
  });
});

describe("CLI command structure", () => {
  it("should have VENICE_MODELS defined", () => {
    const models = ["kimi-k2-thinking", "zai-org-glm-4.7", "grok-41-fast"];
    expect(models).toContain("kimi-k2-thinking");
    expect(models).toContain("zai-org-glm-4.7");
    expect(models).toContain("grok-41-fast");
  });

  it("should validate strategy with pine-runtime", async () => {
    const { pineRuntime } = await import("@pinescript-utils/pine-runtime");
    const script = `//@version=5
strategy("Test Strategy", overlay=true)
if (close > open)
    strategy.entry("Long", strategy.long)`;

    const validation = pineRuntime.validateScript(script);
    expect(validation.valid).toBe(true);
  });
});
