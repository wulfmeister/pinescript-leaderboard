"use client";

import { useState } from "react";
import {
  DataSettings,
  getDefaultDataSettings,
  formatDataSourceBadge,
  type DataSettingsValue,
} from "../components/data-settings";
import type { RankedResult } from "../components/ranked-result";
import { ScoreComparisonChart } from "../components/score-comparison-chart";
import { MetricsComparisonChart } from "../components/metrics-comparison-chart";
import { EquityCurvesChart } from "../components/equity-curves-chart";
import { RankingsTable } from "../components/rankings-table";

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

          <ScoreComparisonChart results={results} />
          <MetricsComparisonChart results={results} />
          <EquityCurvesChart results={results} capital={parseFloat(capital)} />
          <RankingsTable results={results} />
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
