"use client";

interface Metrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
}

interface Props {
  metrics: Metrics;
  initialCapital: number;
  finalCapital: number;
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function PortfolioSummaryCards({
  metrics,
  initialCapital,
  finalCapital,
}: Props) {
  const effectiveReturn =
    initialCapital > 0 ? (finalCapital - initialCapital) / initialCapital : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        label="Total Return"
        value={pct(metrics.totalReturn ?? effectiveReturn)}
        positive={(metrics.totalReturn ?? effectiveReturn) >= 0}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={metrics.sharpeRatio.toFixed(2)}
        positive={metrics.sharpeRatio >= 0}
      />
      <MetricCard
        label="Max Drawdown"
        value={pct(metrics.maxDrawdown)}
        positive={false}
      />
      <MetricCard
        label="Total Trades"
        value={metrics.totalTrades.toLocaleString()}
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
