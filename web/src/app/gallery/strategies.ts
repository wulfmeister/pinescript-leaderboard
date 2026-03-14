export type Category =
  | "Trend Following"
  | "Mean Reversion"
  | "Momentum"
  | "Volatility"
  | "Breakout";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface GalleryStrategy {
  id: string;
  name: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  tags: string[];
  script: string;
}

export const CATEGORIES: Category[] = [
  "Trend Following",
  "Mean Reversion",
  "Momentum",
  "Volatility",
  "Breakout",
];

export const GALLERY_STRATEGIES: GalleryStrategy[] = [
  // ── Trend Following ──────────────────────────────────────────
  {
    id: "sma-crossover",
    name: "SMA Crossover",
    description:
      "Classic simple moving average crossover. Goes long when the fast SMA crosses above the slow SMA.",
    category: "Trend Following",
    difficulty: "beginner",
    tags: ["moving-average", "crossover", "trend"],
    script: `//@version=5
strategy("SMA Crossover", overlay=true)

fastLength = input(10, title="Fast SMA Length")
slowLength = input(30, title="Slow SMA Length")

fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`,
  },
  {
    id: "ema-crossover",
    name: "EMA Crossover",
    description:
      "Exponential moving average crossover that reacts faster to price changes than SMA.",
    category: "Trend Following",
    difficulty: "beginner",
    tags: ["moving-average", "crossover", "ema"],
    script: `//@version=5
strategy("EMA Crossover", overlay=true)

fastLength = input(10, title="Fast EMA Length")
slowLength = input(30, title="Slow EMA Length")

fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)

if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)

if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },
  {
    id: "triple-ema",
    name: "Triple EMA Filter",
    description:
      "Uses three EMAs as a trend filter. Only enters when fast > medium > slow, confirming strong trend alignment.",
    category: "Trend Following",
    difficulty: "intermediate",
    tags: ["ema", "multi-timeframe", "filter"],
    script: `//@version=5
strategy("Triple EMA Filter", overlay=true)

fastLen = input(8, title="Fast EMA")
medLen = input(21, title="Medium EMA")
slowLen = input(55, title="Slow EMA")

fastEMA = ta.ema(close, fastLen)
medEMA = ta.ema(close, medLen)
slowEMA = ta.ema(close, slowLen)

if (fastEMA > medEMA and medEMA > slowEMA)
    strategy.entry("Long", strategy.long)

if (fastEMA < medEMA)
    strategy.close("Long")`,
  },
  {
    id: "slow-ema-crossover",
    name: "Slow EMA Crossover",
    description:
      "Long-term trend following with 20/50 EMAs. Fewer signals but catches major moves.",
    category: "Trend Following",
    difficulty: "beginner",
    tags: ["ema", "long-term", "trend"],
    script: `//@version=5
strategy("Slow EMA Crossover", overlay=true)

fastEMA = ta.ema(close, 20)
slowEMA = ta.ema(close, 50)

if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)

if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },

  // ── Mean Reversion ────────────────────────────────────────────
  {
    id: "rsi-mean-reversion",
    name: "RSI Overbought/Oversold",
    description:
      "Buys when RSI drops below oversold level and sells when it rises above overbought. Classic mean reversion.",
    category: "Mean Reversion",
    difficulty: "beginner",
    tags: ["rsi", "oscillator", "oversold"],
    script: `//@version=5
strategy("RSI Overbought/Oversold", overlay=false)

rsiPeriod = input(14, title="RSI Period")
overbought = input(70, title="Overbought Level")
oversold = input(30, title="Oversold Level")

rsiVal = ta.rsi(close, rsiPeriod)

if (rsiVal < oversold)
    strategy.entry("Long", strategy.long)

if (rsiVal > overbought)
    strategy.close("Long")`,
  },
  {
    id: "bb-mean-reversion",
    name: "Bollinger Bands Mean Reversion",
    description:
      "Buys at the lower Bollinger Band and sells at the upper band, betting on price returning to the mean.",
    category: "Mean Reversion",
    difficulty: "beginner",
    tags: ["bollinger", "bands", "volatility"],
    script: `//@version=5
strategy("Bollinger Bands Mean Reversion", overlay=true)

bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)

if (close < bbLower)
    strategy.entry("Long", strategy.long)

if (close > bbUpper)
    strategy.close("Long")`,
  },
  {
    id: "rsi-bb-combo",
    name: "RSI + Bollinger Bands",
    description:
      "Combines RSI oversold with Bollinger Band lower touch for higher-confidence mean reversion entries.",
    category: "Mean Reversion",
    difficulty: "intermediate",
    tags: ["rsi", "bollinger", "combo"],
    script: `//@version=5
strategy("RSI + Bollinger Bands", overlay=true)

rsiPeriod = input(14, title="RSI Period")
bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

rsiVal = ta.rsi(close, rsiPeriod)
[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)

if (rsiVal < 30 and close < bbLower)
    strategy.entry("Long", strategy.long)

if (rsiVal > 70 or close > bbUpper)
    strategy.close("Long")`,
  },
  {
    id: "sma-pullback",
    name: "SMA Pullback",
    description:
      "Enters on pullbacks to the 20-SMA during an uptrend (price above 50-SMA). Combines trend and mean reversion.",
    category: "Mean Reversion",
    difficulty: "intermediate",
    tags: ["pullback", "sma", "trend-filter"],
    script: `//@version=5
strategy("SMA Pullback", overlay=true)

shortLen = input(20, title="Short SMA")
longLen = input(50, title="Long SMA")

shortSMA = ta.sma(close, shortLen)
longSMA = ta.sma(close, longLen)

if (close < shortSMA and shortSMA > longSMA)
    strategy.entry("Long", strategy.long)

if (close > shortSMA)
    strategy.close("Long")`,
  },

  // ── Momentum ──────────────────────────────────────────────────
  {
    id: "macd-crossover",
    name: "MACD Signal Crossover",
    description:
      "Enters when the MACD line crosses above the signal line, indicating upward momentum.",
    category: "Momentum",
    difficulty: "beginner",
    tags: ["macd", "signal", "crossover"],
    script: `//@version=5
strategy("MACD Signal Crossover", overlay=false)

fastLen = input(12, title="Fast Length")
slowLen = input(26, title="Slow Length")
signalLen = input(9, title="Signal Length")

[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)

if (ta.crossover(macdLine, signalLine))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(macdLine, signalLine))
    strategy.close("Long")`,
  },
  {
    id: "macd-zero-cross",
    name: "MACD Zero Line Cross",
    description:
      "Enters when the MACD line crosses above zero, confirming positive momentum. More conservative than signal crossover.",
    category: "Momentum",
    difficulty: "beginner",
    tags: ["macd", "zero-line", "momentum"],
    script: `//@version=5
strategy("MACD Zero Line Cross", overlay=false)

fastLen = input(12, title="Fast Length")
slowLen = input(26, title="Slow Length")
signalLen = input(9, title="Signal Length")

[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)

if (macdLine > 0 and ta.crossover(macdLine, signalLine))
    strategy.entry("Long", strategy.long)

if (macdLine < 0)
    strategy.close("Long")`,
  },
  {
    id: "rsi-momentum",
    name: "RSI Momentum",
    description:
      "Uses RSI crossing above 50 as a momentum signal. Stays in while RSI remains above 40.",
    category: "Momentum",
    difficulty: "beginner",
    tags: ["rsi", "momentum", "midline"],
    script: `//@version=5
strategy("RSI Momentum", overlay=false)

rsiPeriod = input(14, title="RSI Period")

rsiVal = ta.rsi(close, rsiPeriod)

if (rsiVal > 50)
    strategy.entry("Long", strategy.long)

if (rsiVal < 40)
    strategy.close("Long")`,
  },
  {
    id: "ema-rsi-momentum",
    name: "EMA + RSI Momentum",
    description:
      "Combines EMA trend direction with RSI momentum confirmation. Enters when both align bullish.",
    category: "Momentum",
    difficulty: "intermediate",
    tags: ["ema", "rsi", "combo", "momentum"],
    script: `//@version=5
strategy("EMA + RSI Momentum", overlay=true)

emaLen = input(20, title="EMA Length")
rsiPeriod = input(14, title="RSI Period")
rsiEntry = input(55, title="RSI Entry Level")

emaVal = ta.ema(close, emaLen)
rsiVal = ta.rsi(close, rsiPeriod)

if (close > emaVal and rsiVal > rsiEntry)
    strategy.entry("Long", strategy.long)

if (close < emaVal or rsiVal < 40)
    strategy.close("Long")`,
  },

  // ── Volatility ────────────────────────────────────────────────
  {
    id: "bb-squeeze",
    name: "Bollinger Band Squeeze",
    description:
      "Detects low-volatility squeezes when bands narrow, then enters on the breakout above the upper band.",
    category: "Volatility",
    difficulty: "intermediate",
    tags: ["bollinger", "squeeze", "breakout"],
    script: `//@version=5
strategy("BB Squeeze Breakout", overlay=true)

bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")
sqLen = input(50, title="Squeeze Lookback")

[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)
bbWidth = (bbUpper - bbLower) / bbMiddle
avgWidth = ta.sma(bbWidth, sqLen)

if (bbWidth < avgWidth and close > bbUpper)
    strategy.entry("Long", strategy.long)

if (close < bbMiddle)
    strategy.close("Long")`,
  },
  {
    id: "bb-width-trend",
    name: "BB Width Trend Filter",
    description:
      "Trades in the direction of expanding volatility. Goes long when bands widen and price is above the middle band.",
    category: "Volatility",
    difficulty: "intermediate",
    tags: ["bollinger", "width", "expansion"],
    script: `//@version=5
strategy("BB Width Trend Filter", overlay=true)

bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)
bbWidth = (bbUpper - bbLower) / bbMiddle
prevWidth = ta.sma(bbWidth, 5)

if (bbWidth > prevWidth and close > bbMiddle)
    strategy.entry("Long", strategy.long)

if (close < bbMiddle)
    strategy.close("Long")`,
  },
  {
    id: "rsi-volatility-filter",
    name: "RSI with Volatility Filter",
    description:
      "Standard RSI strategy but only trades when Bollinger Band width indicates sufficient volatility.",
    category: "Volatility",
    difficulty: "advanced",
    tags: ["rsi", "bollinger", "filter", "volatility"],
    script: `//@version=5
strategy("RSI Volatility Filter", overlay=false)

rsiPeriod = input(14, title="RSI Period")
bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")
minWidth = input(2, title="Min BB Width %")

rsiVal = ta.rsi(close, rsiPeriod)
[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)
bbWidth = ((bbUpper - bbLower) / bbMiddle) * 100

if (rsiVal < 30 and bbWidth > minWidth)
    strategy.entry("Long", strategy.long)

if (rsiVal > 70)
    strategy.close("Long")`,
  },
  {
    id: "mean-reversion-tight-bb",
    name: "Tight Band Mean Reversion",
    description:
      "Enters when bands are tight and price touches the lower band. Expects a quick snap back to the mean.",
    category: "Volatility",
    difficulty: "advanced",
    tags: ["bollinger", "tight", "mean-reversion"],
    script: `//@version=5
strategy("Tight Band Mean Reversion", overlay=true)

bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)
bbWidth = (bbUpper - bbLower) / bbMiddle
avgWidth = ta.sma(bbWidth, 50)

if (bbWidth < avgWidth and close < bbLower)
    strategy.entry("Long", strategy.long)

if (close > bbMiddle)
    strategy.close("Long")`,
  },

  // ── Breakout ──────────────────────────────────────────────────
  {
    id: "high-low-breakout",
    name: "High/Low Breakout",
    description:
      "Enters when price breaks above the highest high of the lookback period. Classic channel breakout.",
    category: "Breakout",
    difficulty: "beginner",
    tags: ["breakout", "channel", "high-low"],
    script: `//@version=5
strategy("High/Low Breakout", overlay=true)

lookback = input(20, title="Lookback Period")

highestHigh = ta.highest(close, lookback)
lowestLow = ta.lowest(close, lookback)

if (close > highestHigh)
    strategy.entry("Long", strategy.long)

if (close < lowestLow)
    strategy.close("Long")`,
  },
  {
    id: "ema-breakout",
    name: "EMA Breakout",
    description:
      "Enters when price breaks above the EMA after being below it. Uses distance from EMA as a momentum filter.",
    category: "Breakout",
    difficulty: "beginner",
    tags: ["ema", "breakout", "trend"],
    script: `//@version=5
strategy("EMA Breakout", overlay=true)

emaLen = input(20, title="EMA Length")

emaVal = ta.ema(close, emaLen)

if (ta.crossover(close, emaVal))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(close, emaVal))
    strategy.close("Long")`,
  },
  {
    id: "sma-range-breakout",
    name: "SMA Range Breakout",
    description:
      "Waits for price to consolidate near the SMA, then enters on a breakout above. Combines range and trend signals.",
    category: "Breakout",
    difficulty: "intermediate",
    tags: ["sma", "range", "breakout"],
    script: `//@version=5
strategy("SMA Range Breakout", overlay=true)

smaLen = input(20, title="SMA Length")
threshold = input(1, title="Breakout % Threshold")

smaVal = ta.sma(close, smaLen)
pctAbove = ((close - smaVal) / smaVal) * 100

if (pctAbove > threshold)
    strategy.entry("Long", strategy.long)

if (close < smaVal)
    strategy.close("Long")`,
  },
  {
    id: "macd-bb-breakout",
    name: "MACD + BB Breakout",
    description:
      "Enters when MACD is positive and price breaks above the upper Bollinger Band. Double confirmation breakout.",
    category: "Breakout",
    difficulty: "advanced",
    tags: ["macd", "bollinger", "breakout", "combo"],
    script: `//@version=5
strategy("MACD + BB Breakout", overlay=true)

fastLen = input(12, title="MACD Fast")
slowLen = input(26, title="MACD Slow")
signalLen = input(9, title="MACD Signal")
bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)
[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)

if (macdLine > 0 and close > bbUpper)
    strategy.entry("Long", strategy.long)

if (macdLine < 0 or close < bbMiddle)
    strategy.close("Long")`,
  },
];
