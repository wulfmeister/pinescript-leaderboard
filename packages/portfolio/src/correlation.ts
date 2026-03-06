import { average, standardDeviation } from "@pinescript-utils/core";
import type { OHLCV } from "@pinescript-utils/core";

const DAY_MS = 86400000;

function snapToDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS;
}

function toDailyReturns(data: OHLCV[]): Map<number, number> {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const dailyClose = new Map<number, number>();

  for (const candle of sorted) {
    dailyClose.set(snapToDay(candle.timestamp), candle.close);
  }

  const entries = Array.from(dailyClose.entries()).sort((a, b) => a[0] - b[0]);
  const returns = new Map<number, number>();

  for (let i = 1; i < entries.length; i++) {
    const prevClose = entries[i - 1][1];
    const close = entries[i][1];
    if (prevClose !== 0) {
      returns.set(entries[i][0], (close - prevClose) / prevClose);
    }
  }

  return returns;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length < 2 || y.length < 2 || x.length !== y.length) return 0;

  const meanX = average(x);
  const meanY = average(y);
  const stdX = standardDeviation(x);
  const stdY = standardDeviation(y);

  if (stdX === 0 || stdY === 0) return 0;

  let covariance = 0;
  for (let i = 0; i < x.length; i++) {
    covariance += (x[i] - meanX) * (y[i] - meanY);
  }
  covariance /= x.length;

  const corr = covariance / (stdX * stdY);
  if (corr > 1) return 1;
  if (corr < -1) return -1;
  return corr;
}

export function calculateCorrelationMatrix(
  assetData: Map<string, OHLCV[]>,
): number[][] {
  const symbols = Array.from(assetData.keys());
  const size = symbols.length;
  const matrix: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0),
  );

  const returnSeries = new Map<string, Map<number, number>>();
  for (const symbol of symbols) {
    returnSeries.set(symbol, toDailyReturns(assetData.get(symbol) ?? []));
  }

  for (let i = 0; i < size; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < size; j++) {
      const left = returnSeries.get(symbols[i]) ?? new Map<number, number>();
      const right = returnSeries.get(symbols[j]) ?? new Map<number, number>();

      const commonTimestamps = Array.from(left.keys()).filter((ts) =>
        right.has(ts),
      );
      const leftReturns = commonTimestamps.map((ts) => left.get(ts) as number);
      const rightReturns = commonTimestamps.map(
        (ts) => right.get(ts) as number,
      );

      const corr = pearsonCorrelation(leftReturns, rightReturns);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return matrix;
}
