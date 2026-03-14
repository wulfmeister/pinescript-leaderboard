export const LEADERBOARD_STRATEGIES = [
  {
    name: "SMA Crossover",
    script: `//@version=5
strategy("SMA Crossover", overlay=true)

// Input parameters
fastLength = input(10, title="Fast SMA Length")
slowLength = input(30, title="Slow SMA Length")

// Calculate indicators
fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

// Plot indicators
plot(fastSMA, color=red, title="Fast SMA")
plot(slowSMA, color=blue, title="Slow SMA")

// Trading logic
if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`,
  },
  {
    name: "EMA Crossover Simple",
    script: `//@version=5
strategy("EMA Crossover Simple", overlay=true)

// Input parameters
fastLength = input(10, title="Fast EMA Length")
slowLength = input(30, title="Slow EMA Length")

// Calculate indicators
fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)

// Plot indicators
plot(fastEMA, color=red, title="Fast EMA")
plot(slowEMA, color=blue, title="Slow EMA")

// Trading logic - simple comparison
if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)

if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },
  {
    name: "RSI Overbought/Oversold",
    script: `//@version=5
strategy("RSI Overbought/Oversold", overlay=false)

// Parameters
rsiPeriod = input(14, title="RSI Period")
overbought = input(70, title="Overbought Level")
oversold = input(30, title="Oversold Level")

// Calculate RSI
rsiVal = ta.rsi(close, rsiPeriod)

// Buy when RSI crosses below oversold, sell when RSI crosses above overbought
if (rsiVal < oversold)
    strategy.entry("Long", strategy.long)

if (rsiVal > overbought)
    strategy.close("Long")`,
  },
  {
    name: "MACD Signal Crossover",
    script: `//@version=5
strategy("MACD Signal Crossover", overlay=false)

// Parameters
fastLen = input(12, title="Fast Length")
slowLen = input(26, title="Slow Length")
signalLen = input(9, title="Signal Length")

// Calculate MACD
[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)

// Buy when MACD line crosses above signal line
if (ta.crossover(macdLine, signalLine))
    strategy.entry("Long", strategy.long)

// Sell when MACD line crosses below signal line
if (ta.crossunder(macdLine, signalLine))
    strategy.close("Long")`,
  },
  {
    name: "Bollinger Bands Mean Reversion",
    script: `//@version=5
strategy("Bollinger Bands Mean Reversion", overlay=true)

// Parameters
bbPeriod = input(20, title="BB Period")
bbStdDev = input(2, title="BB Std Dev")

// Calculate Bollinger Bands
[bbUpper, bbMiddle, bbLower] = ta.bb(close, bbPeriod, bbStdDev)

// Buy when price touches lower band
if (close < bbLower)
    strategy.entry("Long", strategy.long)

// Sell when price touches upper band
if (close > bbUpper)
    strategy.close("Long")`,
  },
];

export const LEADERBOARD_CONFIG = {
  asset: "BTC-USD",
  capital: 10000,
  timeframe: "5m",
  lookbackDays: 30,
  mock: false,
} as const;
