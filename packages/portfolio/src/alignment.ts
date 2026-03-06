import type { EquityPoint } from "@pinescript-utils/core";

const DAY_MS = 86400000;

function snapToDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS;
}

export function alignEquityCurves(
  curves: Map<string, EquityPoint[]>,
  totalCapital: number,
): EquityPoint[] {
  const symbols = Array.from(curves.keys());
  const uniqueSnapped = new Set<number>();
  const perAssetDaily = new Map<
    string,
    { timestamp: number; equity: number }[]
  >();

  for (const symbol of symbols) {
    const raw = curves.get(symbol) ?? [];
    const sorted = [...raw].sort((a, b) => a.timestamp - b.timestamp);
    const daily = new Map<number, number>();

    for (const point of sorted) {
      const snapped = snapToDay(point.timestamp);
      daily.set(snapped, point.equity);
      uniqueSnapped.add(snapped);
    }

    perAssetDaily.set(
      symbol,
      Array.from(daily.entries())
        .map(([timestamp, equity]) => ({ timestamp, equity }))
        .sort((a, b) => a.timestamp - b.timestamp),
    );
  }

  const timestamps = Array.from(uniqueSnapped).sort((a, b) => a - b);
  if (timestamps.length === 0) {
    return [{ timestamp: 0, equity: totalCapital, drawdown: 0 }];
  }

  const fallbackPerAsset =
    symbols.length > 0 ? totalCapital / symbols.length : 0;
  const cursors = new Map<string, number>();
  const latest = new Map<string, number>();

  for (const symbol of symbols) {
    const series = perAssetDaily.get(symbol) ?? [];
    cursors.set(symbol, 0);
    latest.set(symbol, series[0]?.equity ?? fallbackPerAsset);
  }

  let peak = -Infinity;
  const combined: EquityPoint[] = [];

  for (const timestamp of timestamps) {
    let total = 0;

    for (const symbol of symbols) {
      const series = perAssetDaily.get(symbol) ?? [];
      let cursor = cursors.get(symbol) ?? 0;

      while (cursor < series.length && series[cursor].timestamp <= timestamp) {
        latest.set(symbol, series[cursor].equity);
        cursor += 1;
      }

      cursors.set(symbol, cursor);
      total += latest.get(symbol) ?? fallbackPerAsset;
    }

    peak = Math.max(peak, total);
    const drawdown = peak > 0 ? (peak - total) / peak : 0;
    combined.push({ timestamp, equity: total, drawdown });
  }

  return combined;
}
