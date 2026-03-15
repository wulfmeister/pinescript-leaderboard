/**
 * LLM prompt templates for Alpha Lab.
 *
 * Each prompt is designed to produce valid PineScript v5 code.
 * The prompts are structured to:
 * 1. Give the LLM clear context about the existing code and metrics
 * 2. Request a specific, targeted change (not a rewrite)
 * 3. Require the output to be a complete, working PineScript strategy
 */

import type { FactorCategory } from "./types.js";

// ---------------------------------------------------------------------------
// Mode 1: Genetic Evolver prompts
// ---------------------------------------------------------------------------

/**
 * Prompt the LLM to mutate a strategy by making a targeted improvement.
 */
export function mutatePrompt(
  code: string,
  metricsJson: string,
  failureHint: string,
): string {
  return `You are an expert PineScript v5 quant developer.

Here is a trading strategy and its backtest metrics:

STRATEGY CODE:
\`\`\`pinescript
${code}
\`\`\`

BACKTEST METRICS:
${metricsJson}

KNOWN WEAKNESS:
${failureHint}

Your task: Create an IMPROVED version of this strategy that addresses the weakness.
Make ONE targeted change — do not rewrite the entire strategy. Examples of changes:
- Add a filter (volume, ADX, volatility regime)
- Adjust entry/exit logic
- Add a confirmation indicator
- Modify position management

Requirements:
- Output ONLY the complete PineScript v5 strategy code
- Must include //@version=5 and strategy() declaration
- Must use strategy.entry() and strategy.close() for trades
- Must be a self-contained, compilable script
- Use input() for any new parameters you add`;
}

/**
 * Prompt the LLM to combine the best aspects of two parent strategies.
 */
export function crossoverPrompt(
  code1: string,
  metrics1: string,
  code2: string,
  metrics2: string,
): string {
  return `You are an expert PineScript v5 quant developer.

Here are two trading strategies with their backtest metrics:

STRATEGY A:
\`\`\`pinescript
${code1}
\`\`\`
Metrics: ${metrics1}

STRATEGY B:
\`\`\`pinescript
${code2}
\`\`\`
Metrics: ${metrics2}

Your task: Create a NEW strategy that combines the strengths of both.
Take the best aspects of each — for example, the entry logic from one
and the exit/filter logic from the other.

Requirements:
- Output ONLY the complete PineScript v5 strategy code
- Must include //@version=5 and strategy() declaration
- Must use strategy.entry() and strategy.close() for trades
- Must be a self-contained, compilable script
- Use input() for parameters`;
}

/**
 * Generate a failure analysis hint based on metrics.
 * Used as context in the mutation prompt.
 */
export function analyzeWeakness(metrics: Record<string, number>): string {
  const issues: string[] = [];

  if ((metrics.maxDrawdown ?? 0) < -0.15) {
    issues.push("High drawdown — needs better risk control or exit logic");
  }
  if ((metrics.winRate ?? 0) < 0.4) {
    issues.push("Low win rate — entry signals are not selective enough");
  }
  if ((metrics.profitFactor ?? 0) < 1.2) {
    issues.push(
      "Low profit factor — average wins are too small relative to losses",
    );
  }
  if ((metrics.sharpeRatio ?? 0) < 0.5) {
    issues.push("Low Sharpe ratio — returns are inconsistent relative to risk");
  }
  if ((metrics.totalTrades ?? 0) < 5) {
    issues.push("Very few trades — strategy may be too conservative");
  }
  if ((metrics.totalTrades ?? 0) > 200) {
    issues.push("Too many trades — strategy may be overtrading (high noise)");
  }

  return issues.length > 0
    ? issues.join(". ")
    : "Generally decent metrics but room for improvement in overall risk-adjusted returns";
}

// ---------------------------------------------------------------------------
// Mode 2: Factor Synthesis prompts
// ---------------------------------------------------------------------------

/**
 * Prompt the LLM to generate a micro-strategy for a specific factor category.
 */
export function generateFactorPrompt(
  category: FactorCategory,
  existingFactorNames: string[],
): string {
  const categoryDescriptions: Record<FactorCategory, string> = {
    momentum:
      "momentum indicators (RSI, MACD, ROC, Stochastic, CCI, Williams %R)",
    "mean-reversion":
      "mean-reversion signals (Bollinger Bands, Keltner Channels, Z-score of price, RSI extremes)",
    trend:
      "trend-following indicators (SMA/EMA crossovers, ADX, Ichimoku, Supertrend, MESA)",
    volatility:
      "volatility-based signals (ATR breakout, Bollinger Band width, historical vs implied vol)",
    volume:
      "volume analysis (OBV, VWAP crossover, volume profile, Chaikin Money Flow, Accumulation/Distribution)",
    breakout:
      "breakout detection (Donchian Channel, pivot point breaks, range expansion, opening range)",
  };

  const existing =
    existingFactorNames.length > 0
      ? `\nAvoid duplicating these existing factors: ${existingFactorNames.join(", ")}`
      : "";

  return `You are an expert PineScript v5 quant developer.

Create a SIMPLE trading strategy focused on ${category} using ${categoryDescriptions[category]}.
${existing}

Requirements:
- Output ONLY the complete PineScript v5 strategy code
- Must include //@version=5 and strategy() declaration
- Keep it focused — use 1-2 indicators maximum for signal generation
- Must use strategy.entry() and strategy.close() for trades
- Must be a self-contained, compilable script
- Use input() for all parameters
- The strategy name should describe the specific indicator used`;
}

/**
 * Prompt the LLM to generate an indicator-mode factor (outputs a numeric value).
 */
export function generateIndicatorFactorPrompt(
  category: FactorCategory,
): string {
  return `You are an expert PineScript v5 quant developer.

Create a simple PineScript v5 INDICATOR that outputs a conviction score for ${category}.

The indicator should:
1. Calculate a ${category}-based signal
2. Output a single numeric value via plot() where:
   - Positive values = bullish conviction
   - Negative values = bearish conviction
   - Values near 0 = neutral
3. Normalize the output to roughly -100 to +100 range

Requirements:
- Output ONLY the complete PineScript v5 indicator code
- Must include //@version=5 and indicator() declaration
- Use plot() for the output value
- Use input() for parameters
- Keep it simple — one clear signal calculation`;
}

// ---------------------------------------------------------------------------
// Mode 3: Adaptive Walk-Forward prompts
// ---------------------------------------------------------------------------

/**
 * Ask the LLM to diagnose why a strategy failed during a specific period.
 */
export function diagnoseFailurePrompt(
  code: string,
  failingPeriodDesc: string,
  metricsJson: string,
): string {
  return `You are an expert quantitative analyst reviewing a trading strategy.

STRATEGY CODE:
\`\`\`pinescript
${code}
\`\`\`

FAILING PERIOD: ${failingPeriodDesc}

OUT-OF-SAMPLE METRICS FOR THIS PERIOD:
${metricsJson}

The strategy performed well in the training period but failed in the test period above.
Analyze WHY the strategy likely failed. Consider:
- What market conditions would cause this type of strategy to underperform?
- Is the strategy's logic fundamentally flawed or just not robust to certain regimes?
- What specific aspect of the code is most vulnerable?

Provide a concise diagnosis (2-3 sentences) of the root cause.
Do NOT provide code — just the analysis.`;
}

/**
 * Ask the LLM to fix a strategy based on a diagnosis.
 */
export function fixStrategyPrompt(code: string, diagnosis: string): string {
  return `You are an expert PineScript v5 quant developer.

Here is a trading strategy that needs improvement:

STRATEGY CODE:
\`\`\`pinescript
${code}
\`\`\`

DIAGNOSIS OF FAILURE:
${diagnosis}

Your task: Create an IMPROVED version that addresses the diagnosed issues.
Focus on making the strategy more ROBUST — it should work across different
market conditions, not just the training period.

Common fixes include:
- Adding regime filters (trending vs ranging detection)
- Using adaptive parameters instead of fixed ones
- Adding volatility-based position sizing or stop-losses
- Using multiple timeframe confirmation

Requirements:
- Output ONLY the complete PineScript v5 strategy code
- Must include //@version=5 and strategy() declaration
- Must use strategy.entry() and strategy.close() for trades
- Must be a self-contained, compilable script
- Use input() for any new parameters`;
}
