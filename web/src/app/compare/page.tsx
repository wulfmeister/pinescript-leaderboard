"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

const SAMPLE_STRATEGY_A = `//@version=5
strategy("SMA Crossover", overlay=true)

fastLength = input(10, title="Fast SMA Length")
slowLength = input(30, title="Slow SMA Length")

fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`;

const SAMPLE_STRATEGY_B = `//@version=2
strategy("EMA 10/30", overlay=true)
fastEMA = ema(close, 10)
slowEMA = ema(close, 30)
if (fastEMA > slowEMA)
    strategy.entry("Long", strategy.long)
if (fastEMA < slowEMA)
    strategy.close("Long")`;

interface CompareResult {
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

const METRICS = [
  {
    key: "totalReturn" as const,
    label: "Total Return",
    format: "pct",
    higherIsBetter: true,
  },
  {
    key: "sharpeRatio" as const,
    label: "Sharpe Ratio",
    format: "fixed2",
    higherIsBetter: true,
  },
  {
    key: "maxDrawdown" as const,
    label: "Max Drawdown",
    format: "pct",
    higherIsBetter: false,
  },
  {
    key: "winRate" as const,
    label: "Win Rate",
    format: "pct",
    higherIsBetter: true,
  },
  {
    key: "profitFactor" as const,
    label: "Profit Factor",
    format: "fixed2",
    higherIsBetter: true,
  },
  {
    key: "totalTrades" as const,
    label: "Total Trades",
    format: "int",
    higherIsBetter: null,
  },
];

export default function ComparePage() {
  const [scriptA, setScriptA] = useState(SAMPLE_STRATEGY_A);
  const [scriptB, setScriptB] = useState(SAMPLE_STRATEGY_B);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings(),
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [error, setError] = useState("");

  const equityChartRef = useRef<any>(null);

  useEffect(() => {
    import("chartjs-plugin-zoom").then((mod) => {
      Chart.register(mod.default);
    });
  }, []);

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const usd = (v: number) =>
    `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stratA = results?.find((r) => r.name === "Strategy A");
  const stratB = results?.find((r) => r.name === "Strategy B");

  const formatMetric = (key: string, value: number) => {
    const m = METRICS.find((m) => m.key === key);
    if (!m) return String(value);
    if (m.format === "pct") return pct(value);
    if (m.format === "fixed2") return value.toFixed(2);
    return String(value);
  };

  const getWinner = (
    key: string,
    valA: number,
    valB: number,
  ): "A" | "B" | "tie" => {
    const m = METRICS.find((m) => m.key === key);
    if (!m || m.higherIsBetter === null) return "tie";
    if (m.higherIsBetter) {
      return valA > valB ? "A" : valA < valB ? "B" : "tie";
    }
    return Math.abs(valA) < Math.abs(valB)
      ? "A"
      : Math.abs(valA) > Math.abs(valB)
        ? "B"
        : "tie";
  };

  // Equity chart data
  const equityChartData: ChartData<"line"> | null = useMemo(() => {
    if (!stratA || !stratB) return null;
    const curveA = stratA.equityCurve;
    const curveB = stratB.equityCurve;
    const longer = curveA.length >= curveB.length ? curveA : curveB;
    const labels = longer.map((p) =>
      new Date(p.timestamp).toLocaleDateString(),
    );
    const cap = parseFloat(capital) || 10000;

    return {
      labels,
      datasets: [
        {
          label: "Strategy A",
          data: curveA.map((p) => p.equity),
          borderColor: "#22c55e",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1,
        },
        {
          label: "Strategy B",
          data: curveB.map((p) => p.equity),
          borderColor: "#818cf8",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1,
        },
        {
          label: "Initial Capital",
          data: longer.map(() => cap),
          borderColor: "#52525b",
          backgroundColor: "transparent",
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    };
  }, [stratA, stratB, capital]);

  const equityChartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#a1a1aa", boxWidth: 12 } },
        tooltip: {
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#e4e4e7",
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}`,
          },
        },
        zoom: {
          pan: { enabled: true, mode: "x" as const },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x" as const,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#71717a", maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
        y: {
          ticks: {
            color: "#71717a",
            callback: (v) => `$${Number(v).toLocaleString()}`,
          },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
      },
    }),
    [],
  );

  // Drawdown chart data
  const drawdownChartData: ChartData<"line"> | null = useMemo(() => {
    if (!stratA || !stratB) return null;
    const curveA = stratA.equityCurve;
    const curveB = stratB.equityCurve;
    const longer = curveA.length >= curveB.length ? curveA : curveB;
    const labels = longer.map((p) =>
      new Date(p.timestamp).toLocaleDateString(),
    );

    return {
      labels,
      datasets: [
        {
          label: "Strategy A",
          data: curveA.map((p) => -(p.drawdown * 100)),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.15)",
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: true,
          tension: 0.1,
        },
        {
          label: "Strategy B",
          data: curveB.map((p) => -(p.drawdown * 100)),
          borderColor: "#f97316",
          backgroundColor: "transparent",
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: false,
          tension: 0.1,
        },
      ],
    };
  }, [stratA, stratB]);

  const drawdownChartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#a1a1aa", boxWidth: 12 } },
        tooltip: {
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#e4e4e7",
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#71717a", maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
        y: {
          ticks: {
            color: "#71717a",
            callback: (v) => `${Number(v).toFixed(1)}%`,
          },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
      },
    }),
    [],
  );

  const runCompare = async () => {
    setLoading(true);
    setError("");
    setResults(null);

    if (!scriptA.trim()) {
      setError("Strategy A script cannot be empty");
      setLoading(false);
      return;
    }

    if (!scriptB.trim()) {
      setError("Strategy B script cannot be empty");
      setLoading(false);
      return;
    }

    if (
      !dataSettings.useMock &&
      dataSettings.from &&
      dataSettings.to &&
      new Date(dataSettings.from) > new Date(dataSettings.to)
    ) {
      setError("From date must be before To date");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategies: [
            { name: "Strategy A", script: scriptA },
            { name: "Strategy B", script: scriptB },
          ],
          asset,
          capital: parseFloat(capital),
          timeframe: dataSettings.timeframe,
          from: dataSettings.from,
          to: dataSettings.to,
          mock: dataSettings.useMock,
          mockType: dataSettings.mockType,
          mockBars: dataSettings.mockBars,
          minTrades: 0,
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

  // Count metric wins for overall winner
  const overallWinner = useMemo(() => {
    if (!stratA || !stratB) return null;
    let aWins = 0;
    let bWins = 0;
    for (const m of METRICS) {
      if (m.higherIsBetter === null) continue;
      const w = getWinner(m.key, stratA.metrics[m.key], stratB.metrics[m.key]);
      if (w === "A") aWins++;
      if (w === "B") bWins++;
    }
    if (aWins > bWins) return "A";
    if (bWins > aWins) return "B";
    return "tie";
  }, [stratA, stratB]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Compare Strategies</h1>

      {/* Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-white">Data Settings</h2>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Asset</label>
            <input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="input w-full"
              placeholder="e.g., AAPL"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Initial Capital
            </label>
            <input
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="input w-full"
              type="number"
              placeholder="10000"
            />
          </div>
          <DataSettings value={dataSettings} onChange={setDataSettings} />
          <button
            onClick={runCompare}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? "Comparing..." : "Compare Strategies"}
          </button>
        </div>

        {/* Editors */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card space-y-2">
            <label className="block text-sm font-semibold text-white">
              Strategy A
            </label>
            <textarea
              value={scriptA}
              onChange={(e) => setScriptA(e.target.value)}
              className="input w-full h-96 font-mono text-sm"
              placeholder="Enter PineScript code for Strategy A..."
            />
          </div>
          <div className="card space-y-2">
            <label className="block text-sm font-semibold text-white">
              Strategy B
            </label>
            <textarea
              value={scriptB}
              onChange={(e) => setScriptB(e.target.value)}
              className="input w-full h-96 font-mono text-sm"
              placeholder="Enter PineScript code for Strategy B..."
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300 p-4">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Partial results: both failed */}
      {results && results.length === 0 && (
        <div className="card border-red-800 bg-red-950/50 text-red-300 p-4">
          <p className="font-semibold">Comparison Failed</p>
          <p className="text-sm">
            Both strategies failed to produce results. Check your PineScript
            code.
          </p>
        </div>
      )}

      {/* Partial results: one failed */}
      {results && results.length === 1 && (
        <div className="card border-yellow-800 bg-yellow-950/50 text-yellow-300 p-4">
          <p className="font-semibold">Partial Results</p>
          <p className="text-sm">
            {results[0].name === "Strategy A"
              ? "Strategy B failed to produce results."
              : "Strategy A failed to produce results."}{" "}
            Only {results[0].name} completed successfully.
          </p>
        </div>
      )}

      {/* Full results dashboard */}
      {results && results.length === 2 && stratA && stratB && (
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

          {/* Overall winner */}
          <div className="card text-center py-6">
            <p className="text-sm text-zinc-400 mb-1">Overall Winner</p>
            <p className="text-2xl font-bold">
              {overallWinner === "A" && (
                <span className="text-green-400">Strategy A</span>
              )}
              {overallWinner === "B" && (
                <span className="text-indigo-400">Strategy B</span>
              )}
              {overallWinner === "tie" && (
                <span className="text-zinc-300">Tie</span>
              )}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Based on {METRICS.filter((m) => m.higherIsBetter !== null).length}{" "}
              metric comparisons
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              A final: {usd(stratA.finalCapital)} | B final:{" "}
              {usd(stratB.finalCapital)}
            </p>
          </div>

          {/* Metric delta cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {METRICS.map((m) => {
              const valA = stratA.metrics[m.key];
              const valB = stratB.metrics[m.key];
              const winner = getWinner(m.key, valA, valB);
              const delta =
                m.key === "maxDrawdown"
                  ? Math.abs(valA) - Math.abs(valB)
                  : valA - valB;

              return (
                <div key={m.key} className="card p-4 space-y-2">
                  <p className="text-xs text-zinc-500 font-medium">{m.label}</p>
                  <div className="flex justify-between text-sm">
                    <span
                      className={
                        winner === "A"
                          ? "text-green-400 font-semibold"
                          : winner === "B"
                            ? "text-red-400"
                            : "text-zinc-400"
                      }
                    >
                      {formatMetric(m.key, valA)}
                    </span>
                    <span
                      className={
                        winner === "B"
                          ? "text-green-400 font-semibold"
                          : winner === "A"
                            ? "text-red-400"
                            : "text-zinc-400"
                      }
                    >
                      {formatMetric(m.key, valB)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600">Delta</span>
                    <span
                      className={`text-xs font-medium ${
                        winner === "tie" || m.higherIsBetter === null
                          ? "text-zinc-500"
                          : winner === "A"
                            ? "text-green-400"
                            : "text-red-400"
                      }`}
                    >
                      {m.format === "pct"
                        ? pct(delta)
                        : m.format === "fixed2"
                          ? delta.toFixed(2)
                          : String(delta)}
                    </span>
                  </div>
                  {winner !== "tie" && m.higherIsBetter !== null && (
                    <div className="text-center">
                      <span
                        className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                          winner === "A"
                            ? "bg-green-900/30 text-green-400"
                            : "bg-red-900/30 text-red-400"
                        }`}
                      >
                        {winner === "A" ? "A wins" : "B wins"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Equity overlay chart */}
          {equityChartData && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Equity Curves</h2>
                <button
                  onClick={() => equityChartRef.current?.resetZoom()}
                  className="btn btn-ghost text-xs"
                >
                  Reset Zoom
                </button>
              </div>
              <Line
                ref={equityChartRef}
                data={equityChartData}
                options={equityChartOptions}
              />
              <p className="text-xs text-zinc-600 mt-2">
                Scroll to zoom &middot; Drag to pan
              </p>
            </div>
          )}

          {/* Drawdown comparison chart */}
          {drawdownChartData && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4">
                Drawdown Comparison
              </h2>
              <Line data={drawdownChartData} options={drawdownChartOptions} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
