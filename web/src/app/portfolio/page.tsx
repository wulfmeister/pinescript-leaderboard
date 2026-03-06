"use client";

import { useState } from "react";
import {
  getDefaultDataSettings,
  DataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";
import { PortfolioSummaryCards } from "./components/PortfolioSummaryCards";
import { PortfolioEquityChart } from "./components/PortfolioEquityChart";
import { CorrelationHeatmap } from "./components/CorrelationHeatmap";
import { PerAssetTable } from "./components/PerAssetTable";
import { PortfolioExportButtons } from "./components/PortfolioExportButtons";

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

export default function PortfolioPage() {
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [assets, setAssets] = useState("AAPL, MSFT, GOOG");
  const [capital, setCapital] = useState("30000");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings(),
  );
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState("");

  const runPortfolio = async () => {
    const parsed = assets
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      setError("Enter at least one asset symbol");
      return;
    }
    if (parsed.length > 10) {
      setError("Maximum 10 assets allowed");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          assets: parsed,
          capital: Number(capital),
          mock: dataSettings.useMock,
          mockType: dataSettings.mockType,
          mockBars: dataSettings.mockBars,
          timeframe: dataSettings.timeframe,
          from: dataSettings.from,
          to: dataSettings.to,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Portfolio backtest failed");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Backtest</h1>
        <p className="text-gray-400 mt-1">
          Run a single strategy across multiple assets with equal-weight capital
          allocation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Editor */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-3">
              Strategy Script
            </h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full h-64 bg-gray-900 text-green-300 font-mono text-sm p-3 rounded border border-gray-700 focus:outline-none focus:border-green-500 resize-y"
              placeholder="Enter your PineScript strategy..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Settings Panel */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-3">
              Portfolio Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Assets (comma-separated, max 10)
                </label>
                <input
                  type="text"
                  value={assets}
                  onChange={(e) => setAssets(e.target.value)}
                  placeholder="AAPL, MSFT, GOOG"
                  className="w-full bg-gray-900 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Total Capital ($)
                </label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  min="1"
                  className="w-full bg-gray-900 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>

          <DataSettings value={dataSettings} onChange={setDataSettings} />

          <button
            onClick={runPortfolio}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? "Running..." : "Run Portfolio Backtest"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 card border-red-800 bg-red-950/50">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
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
              {formatDataSourceBadge(
                dataSettings,
                assets
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join(", "),
              )}
            </span>
          </div>
          {result.warnings && result.warnings.length > 0 && (
            <div className="card border-yellow-700 bg-yellow-950/30">
              <p className="text-yellow-400 text-sm">
                ⚠ Warnings: {result.warnings.join(", ")}
              </p>
            </div>
          )}
          <PortfolioSummaryCards
            metrics={result.combined.metrics}
            initialCapital={result.combined.initialCapital}
            finalCapital={result.combined.finalCapital}
          />
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Portfolio Equity
            </h2>
            <PortfolioEquityChart
              combined={result.combined.equityCurve}
              perAsset={result.perAsset.map((a: any) => ({
                symbol: a.symbol,
                equityCurve: a.result.equityCurve,
              }))}
              initialCapital={result.combined.initialCapital}
            />
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Per-Asset Breakdown
            </h2>
            <PerAssetTable perAsset={result.perAsset} />
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Correlation Matrix
              {result.combined.metrics && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  (daily returns)
                </span>
              )}
            </h2>
            <CorrelationHeatmap
              matrix={result.correlationMatrix}
              symbols={result.assetSymbols}
              isMockData={dataSettings.useMock}
            />
          </div>
          <PortfolioExportButtons result={result} />
        </div>
      )}
    </div>
  );
}
