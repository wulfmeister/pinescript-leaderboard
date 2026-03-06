"use client";

import { type BacktestResult } from "../types";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fixedOrNA = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "N/A";

interface Props {
  result: BacktestResult;
}

export function BacktestMetricsTable({ result }: Props) {
  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-3 gap-x-6 text-sm">
        <Row label="Initial Capital" value={usd(result.initialCapital)} />
        <Row label="Final Capital" value={usd(result.finalCapital)} />
        <Row label="Total Trades" value={String(result.metrics.totalTrades)} />
        <Row
          label="Profit Factor"
          value={fixedOrNA(result.metrics.profitFactor)}
        />
        <Row
          label="Sortino Ratio"
          value={result.metrics.sortinoRatio.toFixed(2)}
        />
        <Row label="Volatility" value={pct(result.metrics.volatility)} />
        <Row label="Average Win" value={usd(result.metrics.averageWin)} />
        <Row label="Average Loss" value={usd(result.metrics.averageLoss)} />
        <Row label="Expectancy" value={usd(result.metrics.expectancy)} />
        <Row label="Signals" value={String(result.signalCount)} />
        <Row label="Data Points" value={String(result.dataPoints)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500">{label}:</span>{" "}
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
