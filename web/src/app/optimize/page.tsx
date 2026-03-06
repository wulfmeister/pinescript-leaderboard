"use client";

import { useState, useRef, useEffect } from "react";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";
import { ParameterHeatmap } from "./components/ParameterHeatmap";
import { pivotToMatrix } from "./utils/transformHeatmapData";
import type { HeatmapCell, HeatmapConfig, OptimizationRun } from "./types";

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

interface ParameterDef {
  name: string;
  defaultValue: number;
  title?: string;
  minval?: number;
  maxval?: number;
  step?: number;
}

interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

interface RunResult {
  params: Record<string, number>;
  score: number;
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    expectancy: number;
  };
  finalCapital: number;
}

interface OptResult {
  best: RunResult & { equityCurve: { timestamp: number; equity: number }[] };
  runs: RunResult[];
  parameters: ParameterDef[];
  totalCombinations: number;
  validResults: number;
  elapsedMs: number;
  objective: string;
  dataPoints: number;
}

export default function OptimizePage() {
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings(),
  );
  const [objective, setObjective] = useState("sharpe");
  const [minTrades, setMinTrades] = useState("3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptResult | null>(null);
  const [error, setError] = useState("");

  const [customRanges, setCustomRanges] = useState<ParameterRange[] | null>(
    null,
  );
  const [showRangeEditor, setShowRangeEditor] = useState(false);

  const [heatmapConfig, setHeatmapConfig] = useState<HeatmapConfig | null>(
    null,
  );
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);

  const runOptimize = async (useCustomRanges = false) => {
    setLoading(true);
    setError("");
    if (!useCustomRanges) {
      setResult(null);
      setCustomRanges(null);
    }

    // Validate date range for real data
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
      const body: any = {
        script,
        asset,
        capital: parseFloat(capital),
        timeframe: dataSettings.timeframe,
        from: dataSettings.from,
        to: dataSettings.to,
        mock: dataSettings.useMock,
        mockType: dataSettings.mockType,
        mockBars: dataSettings.mockBars,
        objective,
        minTrades: parseInt(minTrades),
      };

      if (useCustomRanges && customRanges) {
        body.parameterRanges = customRanges;
      }

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setSelectedRun(null);

      if (data.parameters && data.parameters.length >= 2 && !heatmapConfig) {
        setHeatmapConfig({
          xParam: data.parameters[0].name,
          yParam: data.parameters[1].name,
        });
      }

      if (!customRanges && data.parameters) {
        setCustomRanges(
          data.parameters.map((p: ParameterDef) => ({
            name: p.name,
            min: p.minval ?? Math.max(1, Math.round(p.defaultValue * 0.25)),
            max: p.maxval ?? Math.round(p.defaultValue * 4),
            step: p.step ?? Math.max(1, Math.round((p.defaultValue * 3) / 10)),
          })),
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRange = (
    index: number,
    field: keyof ParameterRange,
    value: number,
  ) => {
    if (!customRanges) return;
    const updated = [...customRanges];
    updated[index] = { ...updated[index], [field]: value };
    setCustomRanges(updated);
  };

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const usd = (v: number) =>
    `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fixedOrNA = (v: number | null | undefined, digits = 2) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "N/A";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Parameter Optimizer</h1>

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
              onClick={() => runOptimize(false)}
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Optimizing..." : "Run Optimization"}
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

          {/* Parameter Range Editor */}
          {customRanges && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Parameter Ranges</h2>
                <button
                  onClick={() => setShowRangeEditor(!showRangeEditor)}
                  className="btn btn-ghost text-xs"
                >
                  {showRangeEditor ? "Hide Editor" : "Edit Ranges"}
                </button>
              </div>

              {showRangeEditor && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Drag the handles to adjust min/max range. Adjust step size
                    to control granularity.
                  </p>
                  {customRanges.map((range, i) => (
                    <ParameterRangeSlider
                      key={range.name}
                      range={range}
                      index={i}
                      onChange={updateRange}
                    />
                  ))}
                  <button
                    onClick={() => runOptimize(true)}
                    disabled={loading}
                    className="btn btn-primary w-full"
                  >
                    {loading ? "Re-running..." : "Re-run with Custom Ranges"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Best Score"
              value={result.best.score.toFixed(3)}
              positive={result.best.score > 0}
            />
            <MetricCard
              label="Combinations"
              value={`${result.validResults}/${result.totalCombinations}`}
            />
            <MetricCard
              label="Time"
              value={`${(result.elapsedMs / 1000).toFixed(1)}s`}
            />
            <MetricCard
              label="Best Return"
              value={pct(result.best.metrics.totalReturn)}
              positive={result.best.metrics.totalReturn >= 0}
            />
          </div>

          {/* Best parameters */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Best Parameters</h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(result.best.params).map(([name, val]) => (
                <div
                  key={name}
                  className="bg-zinc-800 rounded-lg px-4 py-2 border border-zinc-700"
                >
                  <div className="text-xs text-zinc-500">{name}</div>
                  <div className="text-xl font-bold text-green-400">{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Best run metrics */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">
              Best Run Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
              <Row
                label="Return"
                value={pct(result.best.metrics.totalReturn)}
              />
              <Row
                label="Sharpe"
                value={result.best.metrics.sharpeRatio.toFixed(2)}
              />
              <Row
                label="Sortino"
                value={result.best.metrics.sortinoRatio.toFixed(2)}
              />
              <Row
                label="Max Drawdown"
                value={pct(result.best.metrics.maxDrawdown)}
              />
              <Row label="Win Rate" value={pct(result.best.metrics.winRate)} />
              <Row
                label="Profit Factor"
                value={fixedOrNA(result.best.metrics.profitFactor)}
              />
              <Row
                label="Trades"
                value={String(result.best.metrics.totalTrades)}
              />
              <Row
                label="Final Capital"
                value={usd(result.best.finalCapital)}
              />
            </div>
          </div>

          {/* Equity curve of best run */}
          {result.best.equityCurve && result.best.equityCurve.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white mb-4">
                Best Run Equity Curve
              </h2>
              <div className="flex items-end gap-px h-40">
                {sampleCurve(result.best.equityCurve, 80).map(
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
                          isPositive ? "bg-green-500/70" : "bg-red-500/70"
                        }`}
                        style={{ height: `${Math.max(2, height)}%` }}
                        title={`$${point.equity.toFixed(2)}`}
                      />
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Parameter Sensitivity Heatmap */}
          {result.runs.length > 0 &&
            result.parameters.length >= 2 &&
            heatmapConfig && (
              <div className="card space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-semibold text-white">
                    Parameter Sensitivity Heatmap
                  </h2>
                  <button
                    onClick={() => setShowHeatmap((v) => !v)}
                    className="btn btn-ghost text-xs"
                  >
                    {showHeatmap ? "Hide" : "Show"}
                  </button>
                </div>

                {showHeatmap && (
                  <>
                    {result.parameters.length > 2 && (
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">
                            X axis
                          </label>
                          <select
                            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
                            value={heatmapConfig.xParam}
                            onChange={(e) =>
                              setHeatmapConfig((c) =>
                                c ? { ...c, xParam: e.target.value } : c,
                              )
                            }
                          >
                            {result.parameters.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.title || p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">
                            Y axis
                          </label>
                          <select
                            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
                            value={heatmapConfig.yParam}
                            onChange={(e) =>
                              setHeatmapConfig((c) =>
                                c ? { ...c, yParam: e.target.value } : c,
                              )
                            }
                          >
                            {result.parameters.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.title || p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <ParameterHeatmap
                      matrix={pivotToMatrix(
                        result.runs.map((r) => ({
                          params: r.params,
                          score: r.score,
                          metrics: r.metrics,
                          finalCapital: r.finalCapital,
                        })),
                        heatmapConfig.xParam,
                        heatmapConfig.yParam,
                      )}
                      objective={objective}
                      onCellClick={(cell: HeatmapCell) =>
                        setSelectedRun(cell.run)
                      }
                    />

                    {selectedRun && (
                      <div className="pt-3 border-t border-zinc-700 space-y-3">
                        <h3 className="text-sm font-medium text-zinc-300">
                          Selected Run —{" "}
                          {Object.entries(selectedRun.params)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(", ")}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm">
                          <Row
                            label="Return"
                            value={pct(selectedRun.metrics.totalReturn)}
                          />
                          <Row
                            label="Sharpe"
                            value={selectedRun.metrics.sharpeRatio.toFixed(2)}
                          />
                          <Row
                            label="Max DD"
                            value={pct(selectedRun.metrics.maxDrawdown)}
                          />
                          <Row
                            label="Win Rate"
                            value={pct(selectedRun.metrics.winRate)}
                          />
                          <Row
                            label="Trades"
                            value={String(selectedRun.metrics.totalTrades)}
                          />
                          <Row
                            label="Score"
                            value={selectedRun.score.toFixed(3)}
                          />
                          <Row
                            label="Final Capital"
                            value={usd(selectedRun.finalCapital)}
                          />
                        </div>
                        {selectedRun.equityCurve &&
                          selectedRun.equityCurve.length > 0 && (
                            <div className="flex items-end gap-px h-24">
                              {sampleCurve(selectedRun.equityCurve, 80).map(
                                (pt, i, arr) => {
                                  const mn = Math.min(
                                    ...arr.map((p) => p.equity),
                                  );
                                  const mx = Math.max(
                                    ...arr.map((p) => p.equity),
                                  );
                                  const rng = mx - mn || 1;
                                  const h = ((pt.equity - mn) / rng) * 100;
                                  return (
                                    <div
                                      key={i}
                                      className={`flex-1 rounded-t ${
                                        pt.equity >= parseFloat(capital)
                                          ? "bg-blue-500/70"
                                          : "bg-red-500/70"
                                      }`}
                                      style={{ height: `${Math.max(2, h)}%` }}
                                    />
                                  );
                                },
                              )}
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          {/* Results table */}
          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-white mb-4">
              Top {result.runs.length} Results
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left">
                  <th className="pb-2">#</th>
                  {result.parameters.map((p) => (
                    <th key={p.name} className="pb-2">
                      {p.title || p.name}
                    </th>
                  ))}
                  <th className="pb-2 text-right">Return</th>
                  <th className="pb-2 text-right">Sharpe</th>
                  <th className="pb-2 text-right">Max DD</th>
                  <th className="pb-2 text-right">Win Rate</th>
                  <th className="pb-2 text-right">Trades</th>
                  <th className="pb-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {result.runs.map((run, i) => (
                  <tr
                    key={i}
                    className={`border-t border-zinc-800 ${
                      i === 0 ? "bg-green-950/20" : ""
                    }`}
                  >
                    <td className="py-2 text-zinc-500">{i + 1}</td>
                    {result.parameters.map((p) => (
                      <td key={p.name} className="py-2 font-mono">
                        {run.params[p.name]}
                      </td>
                    ))}
                    <td
                      className={`py-2 text-right ${
                        run.metrics.totalReturn >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {pct(run.metrics.totalReturn)}
                    </td>
                    <td className="py-2 text-right">
                      {run.metrics.sharpeRatio.toFixed(2)}
                    </td>
                    <td className="py-2 text-right">
                      {pct(run.metrics.maxDrawdown)}
                    </td>
                    <td className="py-2 text-right">
                      {pct(run.metrics.winRate)}
                    </td>
                    <td className="py-2 text-right">
                      {run.metrics.totalTrades}
                    </td>
                    <td className="py-2 text-right font-medium text-white">
                      {run.score.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  maxPoints: number,
) {
  if (curve.length <= maxPoints) return curve;
  const step = Math.ceil(curve.length / maxPoints);
  return curve.filter((_, i) => i % step === 0);
}

// Dual-range slider component for parameter editing
function ParameterRangeSlider({
  range,
  index,
  onChange,
}: {
  range: ParameterRange;
  index: number;
  onChange: (index: number, field: keyof ParameterRange, value: number) => void;
}) {
  const [dragging, setDragging] = useState<"min" | "max" | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Calculate absolute min/max for the slider bounds (use wider range for flexibility)
  const absoluteMin = Math.max(1, Math.floor(range.min * 0.2));
  const absoluteMax = Math.ceil(range.max * 3);
  const rangeSize = absoluteMax - absoluteMin;

  const minPercent = ((range.min - absoluteMin) / rangeSize) * 100;
  const maxPercent = ((range.max - absoluteMin) / rangeSize) * 100;

  const handleMouseDown = (handle: "min" | "max") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(handle);
  };

  const handleTouchStart = (handle: "min" | "max") => (e: React.TouchEvent) => {
    setDragging(handle);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (clientX: number) => {
      if (!trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100),
      );
      const value = Math.round(absoluteMin + (percent / 100) * rangeSize);

      if (dragging === "min") {
        const newMin = Math.min(value, range.max - range.step);
        if (newMin !== range.min) {
          onChange(index, "min", newMin);
        }
      } else {
        const newMax = Math.max(value, range.min + range.step);
        if (newMax !== range.max) {
          onChange(index, "max", newMax);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onEnd = () => setDragging(null);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [
    dragging,
    range.min,
    range.max,
    range.step,
    absoluteMin,
    absoluteMax,
    rangeSize,
    index,
    onChange,
  ]);

  const comboCount = Math.floor((range.max - range.min) / range.step) + 1;

  return (
    <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-zinc-300">{range.name}</span>
        <span className="text-xs text-zinc-500">{comboCount} combinations</span>
      </div>

      {/* Dual-range slider */}
      <div className="relative h-8 select-none">
        {/* Track background */}
        <div
          ref={trackRef}
          className="absolute top-1/2 left-0 right-0 h-2 bg-zinc-700 rounded-full -translate-y-1/2"
        >
          {/* Selected range highlight */}
          <div
            className="absolute h-full bg-blue-500/50 rounded-full"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />
        </div>

        {/* Min handle */}
        <div
          className="absolute top-1/2 w-5 h-5 bg-blue-500 rounded-full cursor-ew-resize -translate-y-1/2 -translate-x-1/2 shadow-lg hover:scale-110 transition-transform z-10"
          style={{ left: `${minPercent}%` }}
          onMouseDown={handleMouseDown("min")}
          onTouchStart={handleTouchStart("min")}
        />

        {/* Max handle */}
        <div
          className="absolute top-1/2 w-5 h-5 bg-blue-500 rounded-full cursor-ew-resize -translate-y-1/2 -translate-x-1/2 shadow-lg hover:scale-110 transition-transform z-10"
          style={{ left: `${maxPercent}%` }}
          onMouseDown={handleMouseDown("max")}
          onTouchStart={handleTouchStart("max")}
        />
      </div>

      {/* Value display and step input */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>
              Min: <span className="text-zinc-300 font-mono">{range.min}</span>
            </span>
            <span>
              Max: <span className="text-zinc-300 font-mono">{range.max}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Step:</label>
          <input
            type="number"
            value={range.step}
            onChange={(e) =>
              onChange(
                index,
                "step",
                Math.max(1, parseInt(e.target.value) || 1),
              )
            }
            className="w-16 text-sm text-center"
            min={1}
          />
        </div>
      </div>

      {/* Quick preset buttons */}
      <div className="flex gap-2 pt-2 border-t border-zinc-700/50">
        <button
          onClick={() => {
            const center = (range.min + range.max) / 2;
            const width = (range.max - range.min) * 0.5;
            onChange(index, "min", Math.max(1, Math.round(center - width / 2)));
            onChange(index, "max", Math.round(center + width / 2));
          }}
          className="text-xs px-2 py-1 bg-zinc-700/50 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
        >
          Narrow
        </button>
        <button
          onClick={() => {
            const center = (range.min + range.max) / 2;
            const width = (range.max - range.min) * 1.5;
            onChange(index, "min", Math.max(1, Math.round(center - width / 2)));
            onChange(index, "max", Math.round(center + width / 2));
          }}
          className="text-xs px-2 py-1 bg-zinc-700/50 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
        >
          Wide
        </button>
        <button
          onClick={() => {
            onChange(index, "min", absoluteMin);
            onChange(index, "max", absoluteMax);
          }}
          className="text-xs px-2 py-1 bg-zinc-700/50 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
        >
          Full Range
        </button>
      </div>
    </div>
  );
}
