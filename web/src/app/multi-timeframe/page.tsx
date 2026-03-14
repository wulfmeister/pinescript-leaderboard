"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { LineSeries, type ISeriesApi } from "lightweight-charts";
import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../hooks/useLightweightChart";
import { getDefaultDataSettings } from "../components/data-settings";
import { SAMPLE_STRATEGY } from "../lib/sample-strategy";
import { INPUT_CLASS } from "../lib/styles";

const AVAILABLE_TIMEFRAMES = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
];

const TF_COLORS = [
  "#fbbf24",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f97316",
  "#ec4899",
];

interface TimeframeResult {
  timeframe: string;
  metrics?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  equityCurve?: { timestamp: number; equity: number; drawdown: number }[];
  finalCapital?: number;
  initialCapital?: number;
  error?: string;
}

const METRIC_COLUMNS = [
  {
    key: "totalReturn" as const,
    label: "Return",
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    higherBetter: true,
  },
  {
    key: "sharpeRatio" as const,
    label: "Sharpe",
    format: (v: number) => v.toFixed(2),
    higherBetter: true,
  },
  {
    key: "maxDrawdown" as const,
    label: "Max DD",
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    higherBetter: false,
  },
  {
    key: "winRate" as const,
    label: "Win Rate",
    format: (v: number) => `${(v * 100).toFixed(0)}%`,
    higherBetter: true,
  },
  {
    key: "profitFactor" as const,
    label: "P. Factor",
    format: (v: number) => v.toFixed(2),
    higherBetter: true,
  },
  {
    key: "totalTrades" as const,
    label: "Trades",
    format: (v: number) => String(v),
    higherBetter: true,
  },
];

function ComparisonTable({
  results,
  timeframes,
}: {
  results: Map<string, TimeframeResult>;
  timeframes: string[];
}) {
  const validResults = timeframes
    .map((tf) => results.get(tf))
    .filter((r): r is TimeframeResult => !!r?.metrics);

  const bestValues = new Map<string, number>();
  for (const col of METRIC_COLUMNS) {
    const values = validResults
      .map((r) => r.metrics![col.key])
      .filter((v) => !isNaN(v));
    if (values.length > 0) {
      bestValues.set(
        col.key,
        col.higherBetter ? Math.max(...values) : Math.min(...values),
      );
    }
  }

  return (
    <div className="card overflow-x-auto">
      <h2 className="font-semibold text-white mb-4">Comparison</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-400 border-b border-zinc-800">
            <th className="text-left py-2 pr-4">Timeframe</th>
            {METRIC_COLUMNS.map((col) => (
              <th key={col.key} className="text-right py-2 px-3">
                {col.label}
              </th>
            ))}
            <th className="text-right py-2 pl-3">Final Capital</th>
          </tr>
        </thead>
        <tbody>
          {timeframes.map((tf) => {
            const r = results.get(tf);
            if (!r) return null;
            if (r.error) {
              return (
                <tr key={tf} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-medium text-white">{tf}</td>
                  <td
                    colSpan={METRIC_COLUMNS.length + 1}
                    className="py-2 text-red-400 text-xs"
                  >
                    {r.error}
                  </td>
                </tr>
              );
            }
            if (!r.metrics) return null;
            return (
              <tr key={tf} className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-medium text-white">{tf}</td>
                {METRIC_COLUMNS.map((col) => {
                  const val = r.metrics![col.key];
                  const isBest = bestValues.get(col.key) === val;
                  return (
                    <td
                      key={col.key}
                      className={`text-right py-2 px-3 ${isBest ? "text-green-400 font-medium" : "text-zinc-300"}`}
                    >
                      {col.format(val)}
                    </td>
                  );
                })}
                <td className="text-right py-2 pl-3 text-zinc-300">
                  ${r.finalCapital?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EquityCurvesOverlay({
  results,
  timeframes,
}: {
  results: Map<string, TimeframeResult>;
  timeframes: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);

  const formatValue = useCallback(
    (val: number) =>
      `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  useChartTooltip(chartRef, containerRef, formatValue);

  const lineData = useMemo(() => {
    return timeframes
      .map((tf, idx) => {
        const r = results.get(tf);
        if (!r?.equityCurve?.length) return null;
        return {
          timeframe: tf,
          color: TF_COLORS[idx % TF_COLORS.length],
          data: r.equityCurve.map((p) => ({
            time: toUTCTimestamp(p.timestamp),
            value: p.equity,
          })),
        };
      })
      .filter(Boolean) as {
      timeframe: string;
      color: string;
      data: { time: any; value: number }[];
    }[];
  }, [results, timeframes]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || lineData.length === 0) return;

    const created: ISeriesApi<"Line">[] = [];
    lineData.forEach((entry) => {
      if (entry.data.length === 0) return;
      const series = chart.addSeries(LineSeries, {
        color: entry.color,
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(entry.data);
      created.push(series);
    });
    seriesRefs.current = created;
    chart.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        seriesRefs.current.forEach((s) => {
          try {
            chartRef.current?.removeSeries(s);
          } catch {}
        });
        seriesRefs.current = [];
      }
    };
  }, [chartRef, lineData]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  if (lineData.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-white">Equity Curves</h2>
        <button onClick={handleResetZoom} className="btn btn-ghost text-xs">
          Reset Zoom
        </button>
      </div>
      <div
        ref={containerRef}
        className="h-[300px] w-full"
        style={{ position: "relative" }}
      />
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan
      </p>
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-800">
        {lineData.map((entry) => (
          <div key={entry.timeframe} className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-zinc-300">{entry.timeframe}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MultiTimeframePage() {
  const defaults = getDefaultDataSettings();
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [useMock, setUseMock] = useState(defaults.useMock);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>([
    "1h",
    "4h",
    "1d",
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Map<string, TimeframeResult> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf],
    );
  };

  const runAll = async () => {
    if (selectedTimeframes.length === 0) return;
    setLoading(true);
    setError("");
    setResults(null);
    setProgress(0);

    try {
      const map = new Map<string, TimeframeResult>();
      let completed = 0;

      const promises = selectedTimeframes.map(async (tf) => {
        try {
          const res = await fetch("/api/backtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              script,
              asset,
              capital: parseFloat(capital),
              timeframe: tf,
              from,
              to,
              mock: useMock,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            map.set(tf, { timeframe: tf, error: data.error });
          } else {
            map.set(tf, { timeframe: tf, ...data });
          }
        } catch (e: any) {
          map.set(tf, { timeframe: tf, error: e.message });
        }
        completed++;
        setProgress(completed);
      });

      await Promise.all(promises);
      setResults(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Multi-Timeframe Comparison
        </h1>
        <p className="text-zinc-400 mt-2">
          Run the same strategy across multiple timeframes to find the best fit.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Settings</h2>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Asset</label>
              <input
                type="text"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className={`w-full ${INPUT_CLASS}`}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                Capital
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className={`w-full ${INPUT_CLASS}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`w-full ${INPUT_CLASS}`}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`w-full ${INPUT_CLASS}`}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                className="rounded"
              />
              Use mock data
            </label>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-white">Timeframes</h2>
            <div className="space-y-2">
              {AVAILABLE_TIMEFRAMES.map((tf) => (
                <label
                  key={tf.value}
                  className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTimeframes.includes(tf.value)}
                    onChange={() => toggleTimeframe(tf.value)}
                    className="rounded"
                  />
                  {tf.label}
                </label>
              ))}
            </div>
            <span className="text-xs text-zinc-500">
              {selectedTimeframes.length}/7 selected
            </span>
            <button
              onClick={runAll}
              disabled={loading || selectedTimeframes.length === 0}
              className="btn btn-primary w-full text-sm"
            >
              {loading
                ? `Running... (${progress}/${selectedTimeframes.length})`
                : `Run ${selectedTimeframes.length} Backtest${selectedTimeframes.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <label className="text-xs text-zinc-400 block mb-2">
              PineScript Strategy
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={14}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono focus:outline-none focus:border-zinc-500 resize-y"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="card border-red-800 bg-red-950/50 text-red-300">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <ComparisonTable results={results} timeframes={selectedTimeframes} />
          <EquityCurvesOverlay
            results={results}
            timeframes={selectedTimeframes}
          />
        </div>
      )}
    </div>
  );
}
