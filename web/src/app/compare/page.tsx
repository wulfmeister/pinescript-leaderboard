"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineSeries, AreaSeries } from "lightweight-charts";
import {
  useLightweightChart,
  toUTCTimestamp,
} from "../hooks/useLightweightChart";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";

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

  const equityContainerRef = useRef<HTMLDivElement>(null);
  const drawdownContainerRef = useRef<HTMLDivElement>(null);


  const equityChartOptions = useMemo(
    () => ({
      localization: {
        priceFormatter: (price: number) =>
          "$" +
          price.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
    }),
    [],
  );

  const drawdownChartOptions = useMemo(
    () => ({
      handleScroll: false,
      handleScale: false,
      localization: {
        priceFormatter: (price: number) => `${price.toFixed(2)}%`,
      },
    }),
    [],
  );


  const equityChartRef = useLightweightChart(
    equityContainerRef,
    equityChartOptions,
  );
  const drawdownChartRef = useLightweightChart(
    drawdownContainerRef,
    drawdownChartOptions,
  );

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


  useEffect(() => {
    const chart = equityChartRef.current;
    if (!chart || !stratA || !stratB) return;

    const cap = parseFloat(capital) || 10000;

    // Strategy A line
    const seriesA = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
    });
    seriesA.setData(
      stratA.equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.equity,
      })),
    );

    // Initial Capital baseline (dashed zinc line)
    seriesA.createPriceLine({
      price: cap,
      color: "#52525b",
      lineStyle: 2, // Dashed
      lineWidth: 1,
      axisLabelVisible: false,
    });

    // Strategy B line
    const seriesB = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
    });
    seriesB.setData(
      stratB.equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.equity,
      })),
    );

    chart.timeScale().fitContent();

    return () => {
      try {
        chart.removeSeries(seriesA);
        chart.removeSeries(seriesB);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Compare equity chart series cleanup:", e);
        }
      }
    };
  }, [equityChartRef, stratA, stratB, capital]);


  useEffect(() => {
    const chart = drawdownChartRef.current;
    if (!chart || !stratA || !stratB) return;

    // Strategy A drawdown
    const ddA = chart.addSeries(AreaSeries, {
      lineColor: "#ef4444",
      topColor: "rgba(239,68,68,0.05)",
      bottomColor: "rgba(239,68,68,0.2)",
      lineWidth: 1,
    });
    ddA.setData(
      stratA.equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.drawdown ?? 0,
      })),
    );

    // Strategy B drawdown
    const ddB = chart.addSeries(AreaSeries, {
      lineColor: "#f97316",
      topColor: "rgba(249,115,22,0.05)",
      bottomColor: "rgba(249,115,22,0.2)",
      lineWidth: 1,
    });
    ddB.setData(
      stratB.equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.drawdown ?? 0,
      })),
    );

    chart.timeScale().fitContent();

    return () => {
      try {
        chart.removeSeries(ddA);
        chart.removeSeries(ddB);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Compare drawdown chart series cleanup:", e);
        }
      }
    };
  }, [drawdownChartRef, stratA, stratB]);

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

  const handleEquityResetZoom = useCallback(() => {
    if (equityChartRef.current) {
      equityChartRef.current.timeScale().resetTimeScale();
      equityChartRef.current
        .priceScale("right")
        .applyOptions({ autoScale: true });
    }
  }, [equityChartRef]);

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
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Equity Curves</h2>
              <button
                onClick={handleEquityResetZoom}
                className="btn btn-ghost text-xs"
              >
                Reset Zoom
              </button>
            </div>
            <div
              ref={equityContainerRef}
              className="h-[400px] w-full"
              style={{ position: "relative" }}
            />
            <p className="text-xs text-zinc-600 mt-2">
              Scroll to zoom &middot; Drag to pan
            </p>
          </div>

          {/* Drawdown comparison chart */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">
              Drawdown Comparison
            </h2>
            <div
              ref={drawdownContainerRef}
              className="h-[300px] w-full"
              style={{ position: "relative" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
