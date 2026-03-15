import { describe, it, expect } from "vitest";
import {
  mutatePrompt,
  crossoverPrompt,
  analyzeWeakness,
  generateFactorPrompt,
  generateIndicatorFactorPrompt,
  diagnoseFailurePrompt,
  fixStrategyPrompt,
} from "../prompts.js";

const SAMPLE_CODE = `//@version=5
strategy("Test", overlay=true)
if (ta.crossover(ta.sma(close, 10), ta.sma(close, 30)))
    strategy.entry("Long", strategy.long)`;

const SAMPLE_METRICS = '{"sharpeRatio": 1.5, "maxDrawdown": -0.05}';

describe("mutatePrompt", () => {
  it("includes the strategy code", () => {
    const prompt = mutatePrompt(SAMPLE_CODE, SAMPLE_METRICS, "Low win rate");
    expect(prompt).toContain(SAMPLE_CODE);
  });

  it("includes the metrics", () => {
    const prompt = mutatePrompt(SAMPLE_CODE, SAMPLE_METRICS, "Low win rate");
    expect(prompt).toContain(SAMPLE_METRICS);
  });

  it("includes the failure hint", () => {
    const prompt = mutatePrompt(SAMPLE_CODE, SAMPLE_METRICS, "High drawdown");
    expect(prompt).toContain("High drawdown");
  });

  it("instructs for PineScript v5 output", () => {
    const prompt = mutatePrompt(SAMPLE_CODE, SAMPLE_METRICS, "");
    expect(prompt).toContain("//@version=5");
    expect(prompt).toContain("strategy()");
  });
});

describe("crossoverPrompt", () => {
  it("includes both parent codes", () => {
    const code2 = `//@version=5\nstrategy("B")`;
    const prompt = crossoverPrompt(SAMPLE_CODE, "metrics1", code2, "metrics2");
    expect(prompt).toContain(SAMPLE_CODE);
    expect(prompt).toContain(code2);
  });

  it("includes both metrics", () => {
    const prompt = crossoverPrompt(
      SAMPLE_CODE,
      "metricsA",
      SAMPLE_CODE,
      "metricsB",
    );
    expect(prompt).toContain("metricsA");
    expect(prompt).toContain("metricsB");
  });
});

describe("analyzeWeakness", () => {
  it("flags high drawdown", () => {
    const result = analyzeWeakness({ maxDrawdown: -0.25 });
    expect(result).toContain("drawdown");
  });

  it("flags low win rate", () => {
    const result = analyzeWeakness({ winRate: 0.3 });
    expect(result).toContain("win rate");
  });

  it("flags low profit factor", () => {
    const result = analyzeWeakness({ profitFactor: 0.9 });
    expect(result).toContain("profit factor");
  });

  it("flags low Sharpe", () => {
    const result = analyzeWeakness({ sharpeRatio: 0.2 });
    expect(result).toContain("Sharpe");
  });

  it("flags too few trades", () => {
    const result = analyzeWeakness({ totalTrades: 2 });
    expect(result).toContain("few trades");
  });

  it("flags too many trades", () => {
    const result = analyzeWeakness({ totalTrades: 300 });
    expect(result).toContain("overtrading");
  });

  it("returns default message when metrics are fine", () => {
    const result = analyzeWeakness({
      maxDrawdown: -0.03,
      winRate: 0.6,
      profitFactor: 2.0,
      sharpeRatio: 1.5,
      totalTrades: 50,
    });
    expect(result).toContain("room for improvement");
  });

  it("combines multiple issues", () => {
    const result = analyzeWeakness({
      maxDrawdown: -0.3,
      winRate: 0.2,
    });
    expect(result).toContain("drawdown");
    expect(result).toContain("win rate");
  });
});

describe("generateFactorPrompt", () => {
  it("includes the category", () => {
    const prompt = generateFactorPrompt("momentum", []);
    expect(prompt).toContain("momentum");
  });

  it("includes category-specific indicator hints", () => {
    const prompt = generateFactorPrompt("momentum", []);
    expect(prompt).toContain("RSI");
  });

  it("mentions existing factors to avoid duplication", () => {
    const prompt = generateFactorPrompt("trend", ["momentum-swift-hawk"]);
    expect(prompt).toContain("momentum-swift-hawk");
  });

  it("works without existing factors", () => {
    const prompt = generateFactorPrompt("volatility", []);
    expect(prompt).toContain("volatility");
    expect(prompt).not.toContain("Avoid duplicating");
  });
});

describe("generateIndicatorFactorPrompt", () => {
  it("includes the category", () => {
    const prompt = generateIndicatorFactorPrompt("mean-reversion");
    expect(prompt).toContain("mean-reversion");
  });

  it("requests indicator mode (not strategy)", () => {
    const prompt = generateIndicatorFactorPrompt("trend");
    expect(prompt).toContain("INDICATOR");
    expect(prompt).toContain("indicator()");
  });
});

describe("diagnoseFailurePrompt", () => {
  it("includes the strategy code", () => {
    const prompt = diagnoseFailurePrompt(
      SAMPLE_CODE,
      "2023-01 to 2023-06",
      SAMPLE_METRICS,
    );
    expect(prompt).toContain(SAMPLE_CODE);
  });

  it("includes the failing period", () => {
    const prompt = diagnoseFailurePrompt(
      SAMPLE_CODE,
      "2023-01 to 2023-06",
      SAMPLE_METRICS,
    );
    expect(prompt).toContain("2023-01 to 2023-06");
  });

  it("includes the metrics", () => {
    const prompt = diagnoseFailurePrompt(SAMPLE_CODE, "period", SAMPLE_METRICS);
    expect(prompt).toContain(SAMPLE_METRICS);
  });

  it("asks for analysis, not code", () => {
    const prompt = diagnoseFailurePrompt(SAMPLE_CODE, "period", SAMPLE_METRICS);
    expect(prompt).toContain("Do NOT provide code");
  });
});

describe("fixStrategyPrompt", () => {
  it("includes the strategy code", () => {
    const prompt = fixStrategyPrompt(
      SAMPLE_CODE,
      "Strategy overtrades in ranging markets",
    );
    expect(prompt).toContain(SAMPLE_CODE);
  });

  it("includes the diagnosis", () => {
    const prompt = fixStrategyPrompt(
      SAMPLE_CODE,
      "Strategy overtrades in ranging markets",
    );
    expect(prompt).toContain("overtrades in ranging markets");
  });

  it("asks for PineScript v5 output", () => {
    const prompt = fixStrategyPrompt(SAMPLE_CODE, "diagnosis");
    expect(prompt).toContain("//@version=5");
  });
});
