"use client";

import { useState } from "react";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";

const SAMPLE_STRATEGIES = [
  {
    name: "EMA 10/30",
    script: `//@version=2
strategy("EMA 10/30", overlay=true)
fastEMA = ema(close, 10)
slowEMA = ema(close, 30)
if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)
if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },
  {
    name: "EMA 5/20",
    script: `//@version=2
strategy("EMA 5/20", overlay=true)
fastEMA = ema(close, 5)
slowEMA = ema(close, 20)
if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)
if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },
  {
    name: "EMA 20/50",
    script: `//@version=2
strategy("EMA 20/50", overlay=true)
fastEMA = ema(close, 20)
slowEMA = ema(close, 50)
if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)
if (fastEMA < slowEMA)
    strategy.close("Long")`,
  },
];

interface RankedResult {
  rank: number;
  name: string;
  score: number;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  finalCapital: number;
  equityCurve: { timestamp: number; equity: number; drawdown: number }[];
}

export default function RankPage() {
  const [strategies, setStrategies] = useState(SAMPLE_STRATEGIES);
  const [newName, setNewName] = useState("");
  const [newScript, setNewScript] = useState("");
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings()
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RankedResult[] | null>(null);
  const [error, setError] = useState("");

  const addStrategy = () => {
    if (newName && newScript) {
      setStrategies([...strategies, { name: newName, script: newScript }]);
      setNewName("");
      setNewScript("");
    }
  };

  const removeStrategy = (idx: number) => {
    setStrategies(strategies.filter((_, i) => i !== idx));
  };

  const runRanking = async () => {
    setLoading(true);
    setError("");
    setResults(null);

    // Validate date range for real data
    if (!dataSettings.useMock && dataSettings.from && dataSettings.to && 
        new Date(dataSettings.from) > new Date(dataSettings.to)) {
      setError("From date must be before To date");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategies: strategies.map((s) => ({
            name: s.name,
            script: s.script,
          })),
          asset,
          capital: parseFloat(capital),
          timeframe: dataSettings.timeframe,
          from: dataSettings.from,
          to: dataSettings.to,
          mock: dataSettings.useMock,
          mockType: dataSettings.mockType,
          mockBars: dataSettings.mockBars,
          minTrades: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.rankings);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const usd = (v: number) =>
    `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Rank Strategies</h1>

      {/* Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-white">Data Settings</h2>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Asset</label>
            <input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full"
              placeholder="AAPL, BTC-USD"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Capital</label>
            <input
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full"
              type="number"
            />
          </div>
          <DataSettings value={dataSettings} onChange={setDataSettings} />
        </div>

        {/* Strategy list */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-white mb-4">
            Strategies ({strategies.length})
          </h2>
          <div className="space-y-2">
            {strategies.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3"
              >
                <div>
                  <span className="text-white font-medium">{s.name}</span>
                  <span className="text-zinc-500 text-sm ml-3">
                    {s.script.split("\n").length} lines
                  </span>
                </div>
                <button
                  onClick={() => removeStrategy(i)}
                  className="text-zinc-500 hover:text-red-400 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add strategy */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Add Strategy</h2>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Strategy name"
          className="w-full"
        />
        <textarea
          value={newScript}
          onChange={(e) => setNewScript(e.target.value)}
          placeholder="Paste PineScript code here..."
          rows={6}
          className="w-full font-mono text-sm"
          spellCheck={false}
        />
        <button onClick={addStrategy} className="btn btn-ghost">
          Add
        </button>
      </div>

      <button
        onClick={runRanking}
        disabled={loading || strategies.length < 2}
        className="btn btn-primary"
      >
        {loading ? "Ranking..." : `Rank ${strategies.length} Strategies`}
      </button>

      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300">
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-6">
          {/* Data source badge */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-1 rounded ${
                dataSettings.useMock
                  ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700"
                  : "bg-blue-900/30 text-blue-400 border border-blue-700"
              }`}
            >
              {dataSettings.useMock ? "MOCK DATA" : "YAHOO FINANCE"}
            </span>
            <span className="text-zinc-500">
              {formatDataSourceBadge(dataSettings, asset)}
            </span>
          </div>

          {/* Chart 1: Score Comparison */}
          <ScoreComparisonChart results={results} />

          {/* Chart 2: Multi-Metric Comparison */}
          <MetricsComparisonChart results={results} />

          {/* Chart 3: Equity Curves Overlay */}
          <EquityCurvesChart results={results} capital={parseFloat(capital)} />

          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-white mb-4">Rankings</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left">
                  <th className="pb-3">Rank</th>
                  <th className="pb-3">Strategy</th>
                  <th className="pb-3 text-right">Score</th>
                  <th className="pb-3 text-right">Return</th>
                  <th className="pb-3 text-right">Sharpe</th>
                  <th className="pb-3 text-right">Max DD</th>
                  <th className="pb-3 text-right">Win Rate</th>
                  <th className="pb-3 text-right">Trades</th>
                  <th className="pb-3 text-right">Final Capital</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.rank}
                    className="border-t border-zinc-800 text-zinc-300"
                  >
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          r.rank === 1
                            ? "bg-yellow-500/20 text-yellow-400"
                            : r.rank === 2
                              ? "bg-zinc-400/20 text-zinc-300"
                              : r.rank === 3
                                ? "bg-amber-700/20 text-amber-500"
                                : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className="py-3 text-white font-medium">{r.name}</td>
                    <td className="py-3 text-right">{r.score.toFixed(3)}</td>
                    <td
                      className={`py-3 text-right font-medium ${
                        r.metrics.totalReturn >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {pct(r.metrics.totalReturn)}
                    </td>
                    <td className="py-3 text-right">
                      {r.metrics.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="py-3 text-right text-red-400">
                      {pct(r.metrics.maxDrawdown)}
                    </td>
                    <td className="py-3 text-right">{pct(r.metrics.winRate)}</td>
                    <td className="py-3 text-right">{r.metrics.totalTrades}</td>
                    <td className="py-3 text-right">{usd(r.finalCapital)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="card text-zinc-400">
          No strategies produced enough trades to rank. Try using different
          parameters.
        </div>
      )}
    </div>
  );
}

// Chart 1: Score Comparison (Horizontal Bar Chart)
function ScoreComparisonChart({ results }: { results: RankedResult[] }) {
  const maxScore = Math.max(...results.map((r) => r.score));
  const colors = ["#fbbf24", "#9ca3af", "#b45309", "#3f3f46", "#27272a"];

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Score Comparison</h2>
      <div className="space-y-3">
        {results.map((r, i) => {
          const width = maxScore > 0 ? (r.score / maxScore) * 100 : 0;
          const color = colors[Math.min(i, colors.length - 1)];
          return (
            <div key={r.name} className="flex items-center gap-3">
              <div className="w-24 text-sm text-zinc-400 truncate">{r.name}</div>
              <div className="flex-1 h-8 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(width, 5)}%`, backgroundColor: color }}
                >
                  <span className="text-xs text-white font-medium">
                    {r.score.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="w-8 text-center">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    r.rank === 1
                      ? "bg-yellow-500/20 text-yellow-400"
                      : r.rank === 2
                      ? "bg-zinc-400/20 text-zinc-300"
                      : r.rank === 3
                      ? "bg-amber-700/20 text-amber-500"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {r.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chart 2: Multi-Metric Comparison (Grouped Bar Chart)
function MetricsComparisonChart({ results }: { results: RankedResult[] }) {
  const metrics = [
    { key: "totalReturn", label: "Return", format: (v: number) => `${(v * 100).toFixed(0)}%`, color: "#22c55e" },
    { key: "sharpeRatio", label: "Sharpe", format: (v: number) => v.toFixed(1), color: "#3b82f6" },
    { key: "winRate", label: "Win Rate", format: (v: number) => `${(v * 100).toFixed(0)}%`, color: "#8b5cf6" },
    { key: "maxDrawdown", label: "Max DD", format: (v: number) => `${(Math.abs(v) * 100).toFixed(0)}%`, color: "#ef4444" },
    { key: "profitFactor", label: "P.F.", format: (v: number) => v.toFixed(1), color: "#f59e0b" },
  ] as const;

  // Normalize values for display (0-100 scale)
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
  const gap = 4;
  const groupWidth = results.length * (barWidth + gap);

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
                    className="flex flex-col items-center justify-end"
                    style={{ width: barWidth }}
                    title={`${d.name}: ${metric.format(d.raw[metric.key as keyof typeof d.raw] as number)}`}
                  >
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
      {/* Legend */}
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

// Chart 3: Equity Curves Overlay (Line Chart)
function EquityCurvesChart({ results, capital }: { results: RankedResult[]; capital: number }) {
  if (results.length === 0 || !results[0]?.equityCurve?.length) return null;

  const colors = ["#fbbf24", "#9ca3af", "#b45309", "#22c55e", "#3b82f6", "#8b5cf6"];
  const width = 800;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max equity across all curves
  let minEquity = Infinity;
  let maxEquity = -Infinity;
  
  results.forEach((r) => {
    if (r.equityCurve?.length) {
      r.equityCurve.forEach((p) => {
        minEquity = Math.min(minEquity, p.equity);
        maxEquity = Math.max(maxEquity, p.equity);
      });
    }
  });

  // Ensure we have valid range
  if (minEquity === Infinity) {
    minEquity = capital * 0.95;
    maxEquity = capital * 1.05;
  }

  const equityRange = maxEquity - minEquity || 1;

  // Sample points for smoother curves
  const samplePoints = (curve: typeof results[0]['equityCurve'], maxPoints: number) => {
    if (curve.length <= maxPoints) return curve;
    const step = Math.ceil(curve.length / maxPoints);
    return curve.filter((_, i) => i % step === 0);
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Equity Curves Comparison</h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-4xl"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * t}
                x2={width - padding.right}
                y2={padding.top + chartHeight * t}
                stroke="#27272a"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const value = minEquity + equityRange * (1 - t);
            return (
              <text
                key={t}
                x={padding.left - 10}
                y={padding.top + chartHeight * t + 4}
                fill="#71717a"
                fontSize="10"
                textAnchor="end"
              >
                ${(value / 1000).toFixed(1)}k
              </text>
            );
          })}

          {/* Equity curves */}
          {results.map((r, i) => {
            if (!r.equityCurve?.length) return null;
            const points = samplePoints(r.equityCurve, 100);
            const pathData = points
              .map((p, idx) => {
                const x = padding.left + (idx / (points.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((p.equity - minEquity) / equityRange) * chartHeight;
                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            return (
              <g key={r.name}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth="2"
                  opacity={0.8}
                />
              </g>
            );
          })}

          {/* Initial capital reference line */}
          {capital > 0 && (
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - ((capital - minEquity) / equityRange) * chartHeight}
              x2={width - padding.right}
              y2={padding.top + chartHeight - ((capital - minEquity) / equityRange) * chartHeight}
              stroke="#52525b"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-800">
        {results.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-sm text-zinc-300">{r.name}</span>
            <span className="text-xs text-zinc-500">
              ({((r.finalCapital / capital - 1) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-4 h-px border-t border-dashed border-zinc-500" />
          <span className="text-xs text-zinc-500">Initial Capital</span>
        </div>
      </div>
    </div>
  );
}
