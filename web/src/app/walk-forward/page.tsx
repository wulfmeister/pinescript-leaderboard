"use client";

import { useState } from "react";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";

const SAMPLE_STRATEGY = `//@version=5
strategy("SMA Crossover", overlay=true)

fastLength = input(10, title="Fast SMA Length")
slowLength = input(30, title="Slow SMA Length")

fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`;

const OBJECTIVES = [
  { value: "sharpe", label: "Sharpe Ratio" },
  { value: "sortino", label: "Sortino Ratio" },
  { value: "return", label: "Total Return" },
  { value: "winRate", label: "Win Rate" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "calmar", label: "Calmar Ratio" },
  { value: "expectancy", label: "Expectancy" },
];

interface WindowResult {
  windowIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  trainBars: number;
  testBars: number;
  bestParams: Record<string, number>;
  trainScore: number;
  trainMetrics: {
    totalReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  testMetrics: {
    totalReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  testEquityCurve: { timestamp: number; equity: number }[];
  testFinalCapital: number;
}

interface AggregateMetrics {
  avgReturn: number;
  avgSharpe: number;
  avgMaxDrawdown: number;
  avgWinRate: number;
  avgTrades: number;
  totalTrades: number;
  profitableWindows: number;
  positiveScoreWindows: number;
}

interface WFResult {
  windows: WindowResult[];
  aggregateMetrics: AggregateMetrics;
  efficiency: number;
  elapsedMs: number;
  dataPoints: number;
}

export default function WalkForwardPage() {
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(() => ({
    ...getDefaultDataSettings(),
    mockBars: 500, // Default more bars for walk-forward
  }));
  const [windows, setWindows] = useState("5");
  const [trainRatio, setTrainRatio] = useState("0.7");
  const [objective, setObjective] = useState("sharpe");
  const [minTrades, setMinTrades] = useState("3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WFResult | null>(null);
  const [error, setError] = useState("");

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    // Validate date range for real data
    if (!dataSettings.useMock && dataSettings.from && dataSettings.to && 
        new Date(dataSettings.from) > new Date(dataSettings.to)) {
      setError("From date must be before To date");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/walk-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          asset,
          capital: parseFloat(capital),
          timeframe: dataSettings.timeframe,
          from: dataSettings.from,
          to: dataSettings.to,
          mock: dataSettings.useMock,
          mockType: dataSettings.mockType,
          mockBars: dataSettings.mockBars,
          windows: parseInt(windows),
          trainRatio: parseFloat(trainRatio),
          objective,
          minTrades: parseInt(minTrades),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
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
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString();

  const efficiencyColor =
    result && result.efficiency > 0.5
      ? "text-green-400"
      : result && result.efficiency > 0.25
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Walk-Forward Analysis</h1>
      <p className="text-zinc-400">
        Validate that optimized parameters generalize to unseen data using
        rolling train/test windows.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <label className="block text-sm text-zinc-400 mb-2">
              PineScript Strategy (must have input() parameters)
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={14}
              className="w-full font-mono text-sm"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Settings</h2>
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
              <label className="block text-sm text-zinc-400 mb-1">
                Capital
              </label>
              <input
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full"
                type="number"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Windows
              </label>
              <input
                value={windows}
                onChange={(e) => setWindows(e.target.value)}
                className="w-full"
                type="number"
                min="2"
                max="20"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Train Ratio ({(parseFloat(trainRatio) * 100).toFixed(0)}% /{" "}
                {((1 - parseFloat(trainRatio)) * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0.5"
                max="0.9"
                step="0.05"
                value={trainRatio}
                onChange={(e) => setTrainRatio(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Objective
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              >
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Min Trades
              </label>
              <input
                value={minTrades}
                onChange={(e) => setMinTrades(e.target.value)}
                className="w-full"
                type="number"
              />
            </div>
            <DataSettings value={dataSettings} onChange={setDataSettings} />
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Analyzing..." : "Run Walk-Forward"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300">
          {error}
        </div>
      )}

      {result && (
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

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              label="Efficiency"
              value={pct(result.efficiency)}
              positive={result.efficiency > 0.5}
            />
            <MetricCard
              label="Avg OOS Return"
              value={pct(result.aggregateMetrics.avgReturn)}
              positive={result.aggregateMetrics.avgReturn >= 0}
            />
            <MetricCard
              label="Avg OOS Sharpe"
              value={result.aggregateMetrics.avgSharpe.toFixed(2)}
              positive={result.aggregateMetrics.avgSharpe > 0}
            />
            <MetricCard
              label="Profitable Windows"
              value={pct(result.aggregateMetrics.profitableWindows)}
              positive={result.aggregateMetrics.profitableWindows > 0.5}
            />
            <MetricCard label="Time" value={`${(result.elapsedMs / 1000).toFixed(1)}s`} />
          </div>

          {/* Efficiency gauge */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3">
              Walk-Forward Efficiency
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.efficiency > 0.5
                      ? "bg-green-500"
                      : result.efficiency > 0.25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, result.efficiency * 100))}%`,
                  }}
                />
              </div>
              <span className={`text-xl font-bold ${efficiencyColor}`}>
                {pct(result.efficiency)}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              &gt;50% = parameters generalize well to unseen data. &lt;25% =
              likely overfitting.
            </p>
          </div>

          {/* Aggregate OOS metrics */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">
              Aggregate Out-of-Sample Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
              <Row
                label="Avg Return"
                value={pct(result.aggregateMetrics.avgReturn)}
              />
              <Row
                label="Avg Sharpe"
                value={result.aggregateMetrics.avgSharpe.toFixed(2)}
              />
              <Row
                label="Avg Max DD"
                value={pct(result.aggregateMetrics.avgMaxDrawdown)}
              />
              <Row
                label="Avg Win Rate"
                value={pct(result.aggregateMetrics.avgWinRate)}
              />
              <Row
                label="Total Trades"
                value={String(result.aggregateMetrics.totalTrades)}
              />
              <Row
                label="Avg Trades/Window"
                value={result.aggregateMetrics.avgTrades.toFixed(1)}
              />
              <Row
                label="Profitable Windows"
                value={pct(result.aggregateMetrics.profitableWindows)}
              />
              <Row
                label="+Score Windows"
                value={pct(result.aggregateMetrics.positiveScoreWindows)}
              />
            </div>
          </div>

          {/* Window details table */}
          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-white mb-4">Window Details</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left">
                  <th className="pb-2">Window</th>
                  <th className="pb-2">Train Period</th>
                  <th className="pb-2">Test Period</th>
                  <th className="pb-2">Parameters</th>
                  <th className="pb-2 text-right">Train Score</th>
                  <th className="pb-2 text-right">Test Return</th>
                  <th className="pb-2 text-right">Test Sharpe</th>
                  <th className="pb-2 text-right">Test DD</th>
                  <th className="pb-2 text-right">Trades</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {result.windows.map((w) => (
                  <tr key={w.windowIndex} className="border-t border-zinc-800">
                    <td className="py-2 text-zinc-500">{w.windowIndex + 1}</td>
                    <td className="py-2 text-xs">
                      {fmtDate(w.trainStart)} - {fmtDate(w.trainEnd)}
                      <span className="text-zinc-600 ml-1">
                        ({w.trainBars})
                      </span>
                    </td>
                    <td className="py-2 text-xs">
                      {fmtDate(w.testStart)} - {fmtDate(w.testEnd)}
                      <span className="text-zinc-600 ml-1">({w.testBars})</span>
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {Object.entries(w.bestParams)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td className="py-2 text-right">
                      {w.trainScore.toFixed(3)}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        w.testMetrics.totalReturn >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {pct(w.testMetrics.totalReturn)}
                    </td>
                    <td className="py-2 text-right">
                      {w.testMetrics.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      {pct(w.testMetrics.maxDrawdown)}
                    </td>
                    <td className="py-2 text-right">
                      {w.testMetrics.totalTrades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-window equity curves */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">
              Out-of-Sample Equity Curves
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.windows.map((w) => (
                <div
                  key={w.windowIndex}
                  className="bg-zinc-800/50 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">
                      Window {w.windowIndex + 1}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        w.testMetrics.totalReturn >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {pct(w.testMetrics.totalReturn)}
                    </span>
                  </div>
                  <div className="flex items-end gap-px h-20">
                    {sampleCurve(w.testEquityCurve || [], 40).map(
                      (point, i, arr) => {
                        const min = Math.min(...arr.map((p) => p.equity));
                        const max = Math.max(...arr.map((p) => p.equity));
                        const range = max - min || 1;
                        const height = ((point.equity - min) / range) * 100;
                        const isPositive = point.equity >= parseFloat(capital);
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-t ${
                              isPositive
                                ? "bg-green-500/70"
                                : "bg-red-500/70"
                            }`}
                            style={{
                              height: `${Math.max(2, height)}%`,
                            }}
                            title={`$${point.equity.toFixed(2)}`}
                          />
                        );
                      }
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500">{label}:</span>{" "}
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function sampleCurve(
  curve: { timestamp: number; equity: number }[],
  maxPoints: number
) {
  if (curve.length <= maxPoints) return curve;
  const step = Math.ceil(curve.length / maxPoints);
  return curve.filter((_, i) => i % step === 0);
}
