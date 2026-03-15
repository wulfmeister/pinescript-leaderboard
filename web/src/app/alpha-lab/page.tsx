/**
 * Alpha Lab — AI-driven strategy optimization.
 *
 * Three modes selectable via tabs:
 * 1. Genetic Evolver: LLM mutates a seed strategy across generations
 * 2. Factor Synthesis: generate + combine uncorrelated alpha factors
 * 3. Adaptive Walk-Forward: LLM-assisted walk-forward failure repair
 *
 * All modes support long-running jobs with SSE progress streaming,
 * cancellation, and IndexedDB persistence for saving results.
 */

"use client";

import { useState, useCallback } from "react";
import {
  DataSettings,
  getDefaultDataSettings,
  type DataSettingsValue,
} from "../components/data-settings";
import { useJob } from "./hooks/useJob";
import { useSavedResults, type SavedResult } from "./hooks/useIndexedDB";
import { JobProgress } from "./components/JobProgress";
import { EvolutionResults } from "./components/EvolutionResults";
import { SynthesisResults } from "./components/SynthesisResults";
import { AdaptiveResults } from "./components/AdaptiveResults";

// Venice models available for selection
// Keep aligned with arena/page.tsx, cli/src/index.ts, and packages/venice/src/client.ts
const VENICE_MODELS = [
  { value: "kimi-k2-thinking", label: "Kimi K2 Thinking" },
  { value: "zai-org-glm-4.7", label: "GLM 4.7" },
  { value: "grok-41-fast", label: "Grok 4.1 Fast" },
];

const OBJECTIVES = [
  { value: "sharpe", label: "Sharpe Ratio" },
  { value: "sortino", label: "Sortino Ratio" },
  { value: "return", label: "Total Return" },
  { value: "winRate", label: "Win Rate" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "calmar", label: "Calmar Ratio" },
];

const MODE_TABS: { key: Mode; label: string }[] = [
  { key: "evolve", label: "Genetic Evolver" },
  { key: "synthesize", label: "Factor Synthesis" },
  { key: "adaptive-wf", label: "Adaptive Walk-Forward" },
];

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

type Mode = "evolve" | "synthesize" | "adaptive-wf";

export default function AlphaLabPage() {
  // Shared state
  const [mode, setMode] = useState<Mode>("evolve");
  const [script, setScript] = useState(SAMPLE_STRATEGY);
  const [asset, setAsset] = useState("AAPL");
  const [capital, setCapital] = useState("10000");
  const [objective, setObjective] = useState("sharpe");
  const [model, setModel] = useState("kimi-k2-thinking");
  const [dataSettings, setDataSettings] = useState<DataSettingsValue>(
    getDefaultDataSettings(),
  );

  // Mode-specific state
  const [generations, setGenerations] = useState("10");
  const [populationSize, setPopulationSize] = useState("5");
  const [crossoverRate, setCrossoverRate] = useState("0.2");
  const [factorCount, setFactorCount] = useState("15");
  const [correlationThreshold, setCorrelationThreshold] = useState("0.7");
  const [weightingMethod, setWeightingMethod] = useState("sharpe-weighted");
  const [windows, setWindows] = useState("5");
  const [trainRatio, setTrainRatio] = useState("0.7");
  const [maxAdaptations, setMaxAdaptations] = useState("3");

  // Job management
  const [jobId, setJobId] = useState<string | null>(null);
  const { status, events, result, error, cancel } = useJob(jobId);
  const { results: savedResults, save, remove } = useSavedResults(mode);

  // Start a job for the current mode
  const runJob = useCallback(async () => {
    const routeMap: Record<Mode, string> = {
      evolve: "/api/alpha-lab/evolve",
      synthesize: "/api/alpha-lab/synthesize",
      "adaptive-wf": "/api/alpha-lab/adaptive-wf",
    };

    // Build common payload
    const payload: Record<string, unknown> = {
      asset,
      capital: parseFloat(capital),
      objective,
      model,
      mock: dataSettings.useMock,
      mockType: dataSettings.mockType,
      mockBars: dataSettings.mockBars,
    };

    if (!dataSettings.useMock) {
      payload.from = dataSettings.from;
      payload.to = dataSettings.to;
      payload.timeframe = dataSettings.timeframe;
    }

    // Mode-specific fields
    if (mode === "evolve") {
      payload.script = script;
      payload.generations = parseInt(generations);
      payload.populationSize = parseInt(populationSize);
      payload.crossoverRate = parseFloat(crossoverRate);
    } else if (mode === "synthesize") {
      payload.factorCount = parseInt(factorCount);
      payload.correlationThreshold = parseFloat(correlationThreshold);
      payload.weightingMethod = weightingMethod;
    } else if (mode === "adaptive-wf") {
      payload.script = script;
      payload.windows = parseInt(windows);
      payload.trainRatio = parseFloat(trainRatio);
      payload.maxAdaptations = parseInt(maxAdaptations);
    }

    // Client-side validation matching server-side bounds
    const cap = payload.capital as number;
    if (!isFinite(cap) || cap <= 0) {
      alert("Capital must be a positive number");
      return;
    }

    if (mode === "evolve") {
      const gen = payload.generations as number;
      const pop = payload.populationSize as number;
      const cross = payload.crossoverRate as number;
      if (!isFinite(gen) || gen < 1 || gen > 100) {
        alert("Generations must be 1-100");
        return;
      }
      if (!isFinite(pop) || pop < 1 || pop > 20) {
        alert("Population size must be 1-20");
        return;
      }
      if (!isFinite(cross) || cross < 0 || cross > 1) {
        alert("Crossover rate must be 0-1");
        return;
      }
    } else if (mode === "synthesize") {
      const fc = payload.factorCount as number;
      const ct = payload.correlationThreshold as number;
      if (!isFinite(fc) || fc < 2 || fc > 50) {
        alert("Factor count must be 2-50");
        return;
      }
      if (!isFinite(ct) || ct < 0 || ct > 1) {
        alert("Correlation threshold must be 0-1");
        return;
      }
    } else if (mode === "adaptive-wf") {
      const w = payload.windows as number;
      const tr = payload.trainRatio as number;
      const ma = payload.maxAdaptations as number;
      if (!isFinite(w) || w < 1 || w > 20) {
        alert("Windows must be 1-20");
        return;
      }
      if (!isFinite(tr) || tr <= 0 || tr >= 1) {
        alert("Train ratio must be between 0 and 1 (exclusive)");
        return;
      }
      if (!isFinite(ma) || ma < 1 || ma > 10) {
        alert("Max adaptations must be 1-10");
        return;
      }
    }

    try {
      const res = await fetch(routeMap[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start job");
        return;
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start job");
    }
  }, [
    mode,
    script,
    asset,
    capital,
    objective,
    model,
    dataSettings,
    generations,
    populationSize,
    crossoverRate,
    factorCount,
    correlationThreshold,
    weightingMethod,
    windows,
    trainRatio,
    maxAdaptations,
  ]);

  // Save the current result to IndexedDB
  const handleSave = useCallback(async () => {
    if (!result) return;
    const entry: SavedResult = {
      id: `${mode}-${Date.now()}`,
      mode,
      name: `${mode} run ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      result,
    };
    await save(entry);
  }, [result, mode, save]);

  const isRunning = status === "connecting" || status === "running";
  const needsScript = mode === "evolve" || mode === "adaptive-wf";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Alpha Lab</h1>
      <p className="text-zinc-400">
        AI-driven strategy optimization. Choose a mode below to evolve
        strategies, synthesize alpha factors, or adaptively fix walk-forward
        failures.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 w-fit">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setMode(tab.key);
              setJobId(null);
            }}
            disabled={isRunning}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              mode === tab.key
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Configuration form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: strategy + data */}
        <div className="space-y-4">
          {/* Strategy editor — only for modes that need a seed script */}
          {needsScript && (
            <div className="card">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {mode === "evolve" ? "Seed Strategy" : "Strategy to Optimize"}
              </label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={12}
                className="w-full bg-zinc-900 text-zinc-200 font-mono text-xs rounded-md p-3 border border-zinc-700 focus:border-brand-500 focus:outline-none"
                disabled={isRunning}
              />
            </div>
          )}

          <DataSettings value={dataSettings} onChange={setDataSettings} />
        </div>

        {/* Right column: mode-specific + shared controls */}
        <div className="space-y-4">
          {/* Shared controls */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Asset"
                value={asset}
                onChange={setAsset}
                disabled={isRunning}
              />
              <Field
                label="Capital"
                value={capital}
                onChange={setCapital}
                disabled={isRunning}
              />
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Objective
                </label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-zinc-900 text-zinc-200 text-sm rounded-md px-2 py-1.5 border border-zinc-700"
                >
                  {OBJECTIVES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  Venice Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-zinc-900 text-zinc-200 text-sm rounded-md px-2 py-1.5 border border-zinc-700"
                >
                  {VENICE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Mode-specific controls */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">
              {mode === "evolve"
                ? "Evolution Settings"
                : mode === "synthesize"
                  ? "Synthesis Settings"
                  : "Adaptive Walk-Forward Settings"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {mode === "evolve" ? (
                <>
                  <Field
                    label="Generations"
                    value={generations}
                    onChange={setGenerations}
                    disabled={isRunning}
                  />
                  <Field
                    label="Population Size"
                    value={populationSize}
                    onChange={setPopulationSize}
                    disabled={isRunning}
                  />
                  <Field
                    label="Crossover Rate"
                    value={crossoverRate}
                    onChange={setCrossoverRate}
                    disabled={isRunning}
                  />
                </>
              ) : mode === "synthesize" ? (
                <>
                  <Field
                    label="Factor Count"
                    value={factorCount}
                    onChange={setFactorCount}
                    disabled={isRunning}
                  />
                  <Field
                    label="Correlation Threshold"
                    value={correlationThreshold}
                    onChange={setCorrelationThreshold}
                    disabled={isRunning}
                  />
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Weighting
                    </label>
                    <select
                      value={weightingMethod}
                      onChange={(e) => setWeightingMethod(e.target.value)}
                      disabled={isRunning}
                      className="w-full bg-zinc-900 text-zinc-200 text-sm rounded-md px-2 py-1.5 border border-zinc-700"
                    >
                      <option value="sharpe-weighted">Sharpe Weighted</option>
                      <option value="inverse-volatility">
                        Inverse Volatility
                      </option>
                      <option value="equal">Equal Weight</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <Field
                    label="Windows"
                    value={windows}
                    onChange={setWindows}
                    disabled={isRunning}
                  />
                  <Field
                    label="Train Ratio"
                    value={trainRatio}
                    onChange={setTrainRatio}
                    disabled={isRunning}
                  />
                  <Field
                    label="Max Adaptations"
                    value={maxAdaptations}
                    onChange={setMaxAdaptations}
                    disabled={isRunning}
                  />
                </>
              )}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runJob}
            disabled={isRunning || (needsScript && !script.trim())}
            className="w-full btn btn-primary py-3 text-sm font-semibold disabled:opacity-50"
          >
            {isRunning
              ? "Running..."
              : `Run ${mode === "evolve" ? "Evolution" : mode === "synthesize" ? "Synthesis" : "Adaptive WF"}`}
          </button>
        </div>
      </div>

      {/* Progress */}
      <JobProgress
        status={status}
        events={events}
        error={error}
        onCancel={cancel}
      />

      {/* Results */}
      {status === "completed" && result != null ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Results</h2>
            <button onClick={handleSave} className="btn btn-ghost text-sm">
              Save Result
            </button>
          </div>

          {mode === "evolve" ? (
            <EvolutionResults result={result as any} />
          ) : mode === "synthesize" ? (
            <SynthesisResults result={result as any} />
          ) : (
            <AdaptiveResults result={result as any} />
          )}
        </div>
      ) : null}

      {/* Saved results */}
      {savedResults.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">
            Saved Results
          </h3>
          <div className="space-y-2">
            {savedResults.map((saved) => (
              <div
                key={saved.id}
                className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3"
              >
                <div>
                  <div className="text-sm text-white">{saved.name}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(saved.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => remove(saved.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple labeled input field. */
function Field({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-zinc-900 text-zinc-200 text-sm rounded-md px-2 py-1.5 border border-zinc-700 focus:border-brand-500 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
