"use client";

import { RankedResult } from "./ranked-result";

export function MetricsComparisonChart({ results }: { results: RankedResult[] }) {
  const metrics = [
    { key: "totalReturn", label: "Return", format: (v: number) => `${(v * 100).toFixed(0)}%`, color: "#22c55e" },
    { key: "sharpeRatio", label: "Sharpe", format: (v: number) => v.toFixed(1), color: "#3b82f6" },
    { key: "winRate", label: "Win Rate", format: (v: number) => `${(v * 100).toFixed(0)}%`, color: "#8b5cf6" },
    { key: "maxDrawdown", label: "Max DD", format: (v: number) => `${(Math.abs(v) * 100).toFixed(0)}%`, color: "#ef4444" },
    { key: "profitFactor", label: "P.F.", format: (v: number) => v.toFixed(1), color: "#f59e0b" },
  ] as const;

  const normalizedData = results.map((r) => ({
    name: r.name,
    values: {
      totalReturn: Math.max(0, Math.min(100, r.metrics.totalReturn * 100)),
      sharpeRatio: Math.max(0, Math.min(100, (r.metrics.sharpeRatio / 3) * 100)),
      winRate: r.metrics.winRate * 100,
      maxDrawdown: Math.max(0, Math.min(100, (1 - Math.abs(r.metrics.maxDrawdown) / 0.5) * 100)),
      profitFactor: Math.max(0, Math.min(100, (r.metrics.profitFactor / 3) * 100)),
    },
    raw: r.metrics,
  }));

  const barWidth = 12;

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Metrics Comparison</h2>
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="flex items-center gap-3">
            <div className="w-20 text-sm text-zinc-400">{metric.label}</div>
            <div className="flex-1 flex items-end gap-1 h-16 bg-zinc-800/50 rounded-lg px-2 py-2">
              {normalizedData.map((d, i) => {
                const height = d.values[metric.key as keyof typeof d.values];
                return (
                  <div
                    key={i}
                    className="relative group flex flex-col items-center justify-end"
                    style={{ width: barWidth }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap invisible group-hover:visible z-10 pointer-events-none">
                      {d.name}: {metric.format(d.raw[metric.key as keyof typeof d.raw] as number)}
                    </div>
                    <div
                      className="w-full rounded-t transition-all duration-500"
                      style={{
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: metric.color,
                        opacity: 0.7 + (i === 0 ? 0.3 : 0),
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="w-12 text-right text-xs text-zinc-500">
              {metric.format((results[0]?.metrics[metric.key as keyof typeof results[0]['metrics']] as number) || 0)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-zinc-800">
        {results.map((r, i) => (
          <div key={r.name} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: ["#fbbf24", "#9ca3af", "#b45309"][i] || "#3f3f46",
              }}
            />
            <span className="text-xs text-zinc-400">{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
