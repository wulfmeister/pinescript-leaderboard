"use client";

import { type Metrics } from "../types";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface Props {
  metrics: Metrics;
}

export function BacktestSummaryCards({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label="Total Return"
        value={pct(metrics.totalReturn)}
        positive={metrics.totalReturn >= 0}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={metrics.sharpeRatio.toFixed(2)}
        positive={metrics.sharpeRatio >= 1}
      />
      <MetricCard
        label="Max Drawdown"
        value={pct(metrics.maxDrawdown)}
        positive={false}
      />
      <MetricCard
        label="Win Rate"
        value={pct(metrics.winRate)}
        positive={metrics.winRate >= 0.5}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          positive === true
            ? "text-green-400"
            : positive === false
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
