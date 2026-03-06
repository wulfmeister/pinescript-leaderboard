import type { OHLCV, PerformanceMetrics, Trade } from "./types.js";

/**
 * Calculate the average of an array of numbers
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}

/**
 * Calculate Sharpe ratio (assuming risk-free rate of 0 for simplicity)
 * @param returns Array of period returns
 */
export function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const avgReturn = average(returns);
  const stdDev = standardDeviation(returns);
  return stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // Annualized
}

/**
 * Calculate Sortino ratio (downside deviation only)
 * @param returns Array of period returns
 */
export function calculateSortinoRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const avgReturn = average(returns);
  const downsideReturns = returns.filter((r) => r < 0);
  const downsideDev =
    downsideReturns.length > 0 ? standardDeviation(downsideReturns) : 0;
  return downsideDev === 0 ? 0 : (avgReturn / downsideDev) * Math.sqrt(252);
}

/**
 * Calculate maximum drawdown from equity curve
 * @param equity Array of equity values
 */
export function calculateMaxDrawdown(equity: number[]): number {
  if (equity.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = equity[0];

  for (const value of equity) {
    if (value > peak) {
      peak = value;
    } else {
      const drawdown = (peak - value) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  return maxDrawdown;
}

/**
 * Calculate performance metrics from trades and equity curve
 */
export function calculateMetrics(
  trades: Trade[],
  equityCurve: number[],
  initialCapital: number,
  finalCapital: number,
  startTime: number,
  endTime: number,
): PerformanceMetrics {
  const closingTrades = trades.filter((t) => t.pnl !== undefined);
  const winningTrades = closingTrades.filter((t) => (t.pnl || 0) > 0);
  const losingTrades = closingTrades.filter((t) => (t.pnl || 0) < 0);

  const wins = winningTrades.map((t) => t.pnl || 0);
  const losses = losingTrades.map((t) => Math.abs(t.pnl || 0));

  const grossProfit = wins.reduce((sum, pnl) => sum + pnl, 0);
  const grossLoss = losses.reduce((sum, pnl) => sum + pnl, 0);

  const years = (endTime - startTime) / (365.25 * 24 * 60 * 60 * 1000);
  const totalReturn = (finalCapital - initialCapital) / initialCapital;

  // Calculate period returns from equity curve
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  return {
    totalReturn,
    annualizedReturn: years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0,
    totalTrades: closingTrades.length,
    sharpeRatio: calculateSharpeRatio(returns),
    sortinoRatio: calculateSortinoRatio(returns),
    maxDrawdown: calculateMaxDrawdown(equityCurve),
    volatility: standardDeviation(returns) * Math.sqrt(252),
    winRate:
      closingTrades.length > 0
        ? winningTrades.length / closingTrades.length
        : 0,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    averageWin: wins.length > 0 ? average(wins) : 0,
    averageLoss: losses.length > 0 ? average(losses) : 0,
    expectancy:
      closingTrades.length > 0
        ? closingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) /
          closingTrades.length
        : 0,
    averageTrade:
      closingTrades.length > 0
        ? closingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) /
          closingTrades.length
        : 0,
    averageTradeDuration: 0, // Would need entry/exit times
    maxTradeDuration: 0,
    minTradeDuration: 0,
  };
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, decimals = 2): string {
  return `$${value.toFixed(decimals)}`;
}

/**
 * Resample OHLCV data to a different timeframe
 * This is a simplified version - production would need proper time bucketing
 */
export function resampleOHLCV(data: OHLCV[], targetTimeframe: string): OHLCV[] {
  // This is a placeholder - actual implementation would parse timeframe
  // and bucket data accordingly
  return data;
}

/**
 * Simple moving average
 */
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = values
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Exponential moving average
 */
export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else {
      const ema = values[i] * multiplier + result[i - 1] * (1 - multiplier);
      result.push(ema);
    }
  }

  return result;
}

/**
 * RSI (Relative Strength Index)
 * @param values Price values (typically close)
 * @param period Lookback period (typically 14)
 */
export function rsi(values: number[], period: number = 14): number[] {
  const result: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(NaN);
      continue;
    }

    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      result.push(NaN);
    } else if (i === period) {
      // Calculate initial averages
      let totalGain = 0;
      let totalLoss = 0;
      for (let j = 1; j <= period; j++) {
        const ch = values[j] - values[j - 1];
        totalGain += ch > 0 ? ch : 0;
        totalLoss += ch < 0 ? -ch : 0;
      }
      avgGain = totalGain / period;
      avgLoss = totalLoss / period;
    } else {
      // Smooth averages
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (i >= period) {
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param values Price values
 * @param fastPeriod Fast EMA period (typically 12)
 * @param slowPeriod Slow EMA period (typically 26)
 * @param signalPeriod Signal EMA period (typically 9)
 */
export function macd(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEMA = ema(values, fastPeriod);
  const slowEMA = ema(values, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }

  const signalLine = ema(
    macdLine.filter((v) => !isNaN(v)),
    signalPeriod,
  );

  // Pad signal line with NaN to match length
  const paddedSignal: number[] = new Array(values.length).fill(NaN);
  const offset = values.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    paddedSignal[i + offset] = signalLine[i];
  }

  const histogram: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(paddedSignal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - paddedSignal[i]);
    }
  }

  return { macd: macdLine, signal: paddedSignal, histogram };
}

/**
 * Bollinger Bands
 * @param values Price values
 * @param period SMA period (typically 20)
 * @param stdDev Number of standard deviations (typically 2)
 */
export function bollingerBands(
  values: number[],
  period: number = 20,
  stdDev: number = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const std = standardDeviation(slice);
      upper.push(middle[i] + stdDev * std);
      lower.push(middle[i] - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

/**
 * ATR (Average True Range)
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param period Lookback period (typically 14)
 */
export function atr(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14,
): number[] {
  const tr: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      tr.push(high[i] - low[i]);
    } else {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(tr1, tr2, tr3));
    }
  }

  return ema(tr, period);
}

/**
 * Stochastic Oscillator
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param kPeriod %K period (typically 14)
 * @param dPeriod %D period (typically 3)
 */
export function stochastic(
  high: number[],
  low: number[],
  close: number[],
  kPeriod: number = 14,
  dPeriod: number = 3,
): { k: number[]; d: number[] } {
  const k: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i < kPeriod - 1) {
      k.push(NaN);
    } else {
      const highSlice = high.slice(i - kPeriod + 1, i + 1);
      const lowSlice = low.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);

      if (highestHigh === lowestLow) {
        k.push(50); // Default to middle when no range
      } else {
        k.push((100 * (close[i] - lowestLow)) / (highestHigh - lowestLow));
      }
    }
  }

  const d = sma(
    k.filter((v) => !isNaN(v)),
    dPeriod,
  );

  // Pad d to match length
  const paddedD: number[] = new Array(close.length).fill(NaN);
  const offset = close.length - d.length;
  for (let i = 0; i < d.length; i++) {
    paddedD[i + offset] = d[i];
  }

  return { k, d: paddedD };
}

/**
 * VWAP (Volume-Weighted Average Price)
 * Resets each trading day (approximated by checking if timestamp crosses a day boundary)
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param volume Volume data
 */
export function vwap(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    cumulativeTPV += typicalPrice * volume[i];
    cumulativeVol += volume[i];
    result.push(
      cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : typicalPrice,
    );
  }

  return result;
}

/**
 * Williams %R
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param period Lookback period (typically 14)
 */
export function williamsR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14,
): number[] {
  const result: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const highSlice = high.slice(i - period + 1, i + 1);
      const lowSlice = low.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);

      if (highestHigh === lowestLow) {
        result.push(-50);
      } else {
        result.push(
          (-100 * (highestHigh - close[i])) / (highestHigh - lowestLow),
        );
      }
    }
  }

  return result;
}

/**
 * CCI (Commodity Channel Index)
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param period Lookback period (typically 20)
 */
export function cci(
  high: number[],
  low: number[],
  close: number[],
  period: number = 20,
): number[] {
  const result: number[] = [];
  const tp: number[] = [];

  for (let i = 0; i < close.length; i++) {
    tp.push((high[i] + low[i] + close[i]) / 3);
  }

  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = tp.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const meanDev =
        slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
      if (meanDev === 0) {
        result.push(0);
      } else {
        result.push((tp[i] - mean) / (0.015 * meanDev));
      }
    }
  }

  return result;
}

/**
 * Ichimoku Cloud
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param tenkanPeriod Tenkan-sen period (typically 9)
 * @param kijunPeriod Kijun-sen period (typically 26)
 * @param senkouBPeriod Senkou Span B period (typically 52)
 */
export function ichimoku(
  high: number[],
  low: number[],
  close: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
): {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
} {
  const len = close.length;

  const midpoint = (
    h: number[],
    l: number[],
    start: number,
    period: number,
  ): number => {
    const hSlice = h.slice(start, start + period);
    const lSlice = l.slice(start, start + period);
    return (Math.max(...hSlice) + Math.min(...lSlice)) / 2;
  };

  const tenkan: number[] = [];
  const kijun: number[] = [];
  const senkouA: number[] = [];
  const senkouB: number[] = [];
  const chikou: number[] = [];

  for (let i = 0; i < len; i++) {
    // Tenkan-sen
    if (i < tenkanPeriod - 1) {
      tenkan.push(NaN);
    } else {
      tenkan.push(midpoint(high, low, i - tenkanPeriod + 1, tenkanPeriod));
    }

    // Kijun-sen
    if (i < kijunPeriod - 1) {
      kijun.push(NaN);
    } else {
      kijun.push(midpoint(high, low, i - kijunPeriod + 1, kijunPeriod));
    }

    // Senkou Span A = (Tenkan + Kijun) / 2, displaced forward by kijunPeriod
    // For simplicity, we compute it at current bar (user can shift if needed)
    if (i < kijunPeriod - 1) {
      senkouA.push(NaN);
    } else {
      senkouA.push((tenkan[i] + kijun[i]) / 2);
    }

    // Senkou Span B
    if (i < senkouBPeriod - 1) {
      senkouB.push(NaN);
    } else {
      senkouB.push(midpoint(high, low, i - senkouBPeriod + 1, senkouBPeriod));
    }

    // Chikou Span = close shifted back by kijunPeriod
    // At bar i, chikou[i] = close[i] (would be plotted at i - kijunPeriod)
    chikou.push(close[i]);
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

/**
 * Detect crossover (a crosses above b)
 * @param a Primary series
 * @param b Secondary series
 * @returns Boolean array, true at crossover bars
 */
export function crossover(a: number[], b: number[]): boolean[] {
  const result: boolean[] = [];

  for (let i = 0; i < a.length; i++) {
    if (i === 0) {
      result.push(false);
    } else {
      const crossed = a[i - 1] <= b[i - 1] && a[i] > b[i];
      result.push(crossed);
    }
  }

  return result;
}

/**
 * Detect crossunder (a crosses below b)
 * @param a Primary series
 * @param b Secondary series
 * @returns Boolean array, true at crossunder bars
 */
export function crossunder(a: number[], b: number[]): boolean[] {
  const result: boolean[] = [];

  for (let i = 0; i < a.length; i++) {
    if (i === 0) {
      result.push(false);
    } else {
      const crossed = a[i - 1] >= b[i - 1] && a[i] < b[i];
      result.push(crossed);
    }
  }

  return result;
}

/**
 * ADX (Average Directional Index)
 * Measures trend strength without regard to direction
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param period Lookback period (typically 14)
 */
export function adx(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14,
): { adx: number[]; plusDi: number[]; minusDi: number[] } {
  if (close.length === 0) return { adx: [], plusDi: [], minusDi: [] };

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      tr.push(high[i] - low[i]);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const highDiff = high[i] - high[i - 1];
      const lowDiff = low[i - 1] - low[i];
      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(tr1, tr2, tr3));
    }
  }

  const smoothedTR = ema(tr, period);
  const smoothedPlusDM = ema(plusDM, period);
  const smoothedMinusDM = ema(minusDM, period);

  const plusDi: number[] = [];
  const minusDi: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i < period || smoothedTR[i] === 0 || isNaN(smoothedTR[i])) {
      plusDi.push(NaN);
      minusDi.push(NaN);
      dx.push(NaN);
    } else {
      const pdi = 100 * (smoothedPlusDM[i] / smoothedTR[i]);
      const mdi = 100 * (smoothedMinusDM[i] / smoothedTR[i]);
      plusDi.push(pdi);
      minusDi.push(mdi);

      const diSum = pdi + mdi;
      dx.push(diSum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / diSum);
    }
  }

  const dxValues = dx.filter((v) => !isNaN(v));
  const adx = ema(dxValues, period);

  const paddedAdx: number[] = new Array(close.length).fill(NaN);
  const offset = close.length - adx.length;
  for (let i = 0; i < adx.length; i++) {
    paddedAdx[i + offset] = adx[i];
  }

  return { adx: paddedAdx, plusDi, minusDi };
}

/**
 * ROC (Rate of Change)
 * Measures the percentage change in price over a period
 * @param values Price values
 * @param period Lookback period (typically 12)
 */
export function roc(values: number[], period: number = 12): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      const change =
        ((values[i] - values[i - period]) / values[i - period]) * 100;
      result.push(change);
    }
  }

  return result;
}

/**
 * Keltner Channels
 * Volatility-based channels using ATR
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param emaPeriod EMA period (typically 20)
 * @param atrPeriod ATR period (typically 10)
 * @param multiplier ATR multiplier (typically 2)
 */
export function keltnerChannels(
  high: number[],
  low: number[],
  close: number[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = ema(close, emaPeriod);
  const atrValue = atr(high, low, close, atrPeriod);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (isNaN(middle[i]) || isNaN(atrValue[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + multiplier * atrValue[i]);
      lower.push(middle[i] - multiplier * atrValue[i]);
    }
  }

  return { upper, middle, lower };
}

/**
 * Parabolic SAR (Stop and Reverse)
 * Trend reversal indicator
 * @param high High prices
 * @param low Low prices
 * @param afInit Initial acceleration factor (typically 0.02)
 * @param afMax Maximum acceleration factor (typically 0.2)
 */
export function parabolicSar(
  high: number[],
  low: number[],
  afInit: number = 0.02,
  afMax: number = 0.2,
): number[] {
  if (high.length === 0 || low.length === 0) return [];

  const result: number[] = [];
  let sar = low[0];
  let trend = 1;
  let af = afInit;
  let ep = high[0];

  result.push(sar);

  for (let i = 1; i < high.length; i++) {
    const prevSar = sar;

    sar = sar + af * (ep - sar);

    if (trend === 1) {
      if (low[i] < sar) {
        trend = -1;
        sar = ep;
        ep = low[i];
        af = afInit;
      } else {
        if (high[i] > ep) {
          ep = high[i];
          af = Math.min(af + afInit, afMax);
        }
      }
    } else {
      if (high[i] > sar) {
        trend = 1;
        sar = ep;
        ep = high[i];
        af = afInit;
      } else {
        if (low[i] < ep) {
          ep = low[i];
          af = Math.min(af + afInit, afMax);
        }
      }
    }

    if (trend === 1) {
      sar = Math.min(sar, low[i - 1], low[i]);
    } else {
      sar = Math.max(sar, high[i - 1], high[i]);
    }

    result.push(sar);
  }

  return result;
}

/**
 * OBV (On Balance Volume)
 * Cumulative volume indicator
 * @param close Close prices
 * @param volume Volume data
 */
export function obv(close: number[], volume: number[]): number[] {
  const result: number[] = [];
  let cumulative = 0;

  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      cumulative = volume[i];
    } else {
      if (close[i] > close[i - 1]) {
        cumulative += volume[i];
      } else if (close[i] < close[i - 1]) {
        cumulative -= volume[i];
      }
    }
    result.push(cumulative);
  }

  return result;
}

/**
 * MFI (Money Flow Index)
 * Volume-weighted RSI
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param volume Volume data
 * @param period Lookback period (typically 14)
 */
export function mfi(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  period: number = 14,
): number[] {
  const result: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    rawMoneyFlow.push(typicalPrice * volume[i]);
  }

  for (let i = 0; i < close.length; i++) {
    if (i < period) {
      result.push(NaN);
    } else {
      let positiveFlow = 0;
      let negativeFlow = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const tp = (high[j] + low[j] + close[j]) / 3;
        const prevTp =
          j > 0 ? (high[j - 1] + low[j - 1] + close[j - 1]) / 3 : tp;

        if (tp > prevTp) {
          positiveFlow += rawMoneyFlow[j];
        } else if (tp < prevTp) {
          negativeFlow += rawMoneyFlow[j];
        }
      }

      if (negativeFlow === 0) {
        result.push(100);
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        result.push(100 - 100 / (1 + moneyRatio));
      }
    }
  }

  return result;
}

/**
 * Ultimate Oscillator
 * Multi-timeframe momentum indicator
 * @param high High prices
 * @param low Low prices
 * @param close Close prices
 * @param period1 Short period (typically 7)
 * @param period2 Medium period (typically 14)
 * @param period3 Long period (typically 28)
 */
export function ultimateOscillator(
  high: number[],
  low: number[],
  close: number[],
  period1: number = 7,
  period2: number = 14,
  period3: number = 28,
): number[] {
  const result: number[] = [];
  const buyingPressure: number[] = [];
  const trueRange: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      buyingPressure.push(close[i] - low[i]);
      trueRange.push(high[i] - low[i]);
    } else {
      buyingPressure.push(close[i] - Math.min(low[i], close[i - 1]));
      trueRange.push(
        Math.max(high[i], close[i - 1]) - Math.min(low[i], close[i - 1]),
      );
    }
  }

  for (let i = 0; i < close.length; i++) {
    if (i < period3) {
      result.push(NaN);
    } else {
      const avg1 =
        sumRange(buyingPressure, i, period1) / sumRange(trueRange, i, period1);
      const avg2 =
        sumRange(buyingPressure, i, period2) / sumRange(trueRange, i, period2);
      const avg3 =
        sumRange(buyingPressure, i, period3) / sumRange(trueRange, i, period3);

      const uo = (100 * (4 * avg1 + 2 * avg2 + avg3)) / (4 + 2 + 1);
      result.push(uo);
    }
  }

  return result;
}

function sumRange(arr: number[], endIdx: number, period: number): number {
  let sum = 0;
  for (let j = endIdx - period + 1; j <= endIdx; j++) {
    sum += arr[j];
  }
  return sum;
}

export function mom(values: number[], period: number = 10): number[] {
  return values.map((v, i) => (i < period ? NaN : v - values[i - period]));
}

export function supertrend(
  high: number[],
  low: number[],
  close: number[],
  atrPeriod: number = 10,
  multiplier: number = 3,
): { supertrend: number[]; direction: number[] } {
  const len = close.length;
  const atrValues = atr(high, low, close, atrPeriod);
  const st: number[] = new Array(len).fill(NaN);
  const dir: number[] = new Array(len).fill(1);

  let upperBand = NaN;
  let lowerBand = NaN;

  for (let i = 1; i < len; i++) {
    if (isNaN(atrValues[i])) continue;
    const hl2 = (high[i] + low[i]) / 2;
    const newUpper = hl2 + multiplier * atrValues[i];
    const newLower = hl2 - multiplier * atrValues[i];

    upperBand = isNaN(upperBand)
      ? newUpper
      : newUpper < upperBand || close[i - 1] > upperBand
        ? newUpper
        : upperBand;
    lowerBand = isNaN(lowerBand)
      ? newLower
      : newLower > lowerBand || close[i - 1] < lowerBand
        ? newLower
        : lowerBand;

    const prevDir = dir[i - 1];
    if (prevDir === 1 && close[i] < lowerBand) {
      dir[i] = -1;
    } else if (prevDir === -1 && close[i] > upperBand) {
      dir[i] = 1;
    } else {
      dir[i] = prevDir;
    }

    st[i] = dir[i] === 1 ? lowerBand : upperBand;
  }

  return { supertrend: st, direction: dir };
}
