/**
 * Results display for the Adaptive Walk-Forward mode.
 *
 * Shows: before/after efficiency comparison, adaptation rounds,
 * code diff, and per-window metrics.
 */

"use client";

import { useState } from "react";

interface WindowResult {
  windowIndex: number;
  trainBars: number;
  testBars: number;
  trainScore: number;
  testMetrics: Record<string, number>;
}

interface WalkForwardResult {
  windows: WindowResult[];
  efficiency: number;
  aggregateMetrics: Record<string, number>;
}

interface AdaptationRound {
  round: number;
  failingWindows: number[];
  diagnosis: string;
  fixedCode: string;
  efficiencyBefore: number;
  efficiencyAfter: number;
  improved: boolean;
}

interface AdaptiveWFResult {
  originalResult: WalkForwardResult;
  adaptations: AdaptationRound[];
  bestResult: WalkForwardResult;
  bestCode: string;
  originalCode: string;
  improvement: number;
  totalLLMCalls: number;
  elapsedMs: number;
}

function fmt(val: number, pct = false): string {
  if (pct) return `${(val * 100).toFixed(2)}%`;
  return val.toFixed(3);
}

export function AdaptiveResults({ result }: { result: AdaptiveWFResult }) {
  const [showCode, setShowCode] = useState<"original" | "best">("best");

  const {
    originalResult,
    bestResult,
    adaptations,
    bestCode,
    originalCode,
    improvement,
    totalLLMCalls,
    elapsedMs,
  } = result;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="Original Efficiency"
          value={fmt(originalResult.efficiency)}
        />
        <Card
          label="Best Efficiency"
          value={fmt(bestResult.efficiency)}
          highlight
        />
        <Card
          label="Improvement"
          value={fmt(improvement, true)}
          highlight={improvement > 0}
        />
        <Card label="Time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
        <Card label="Adaptation Rounds" value={String(adaptations.length)} />
        <Card label="LLM Calls" value={String(totalLLMCalls)} />
        <Card
          label="Original Failing"
          value={`${originalResult.windows.filter((w) => (w.testMetrics?.totalReturn ?? 0) < 0).length} / ${originalResult.windows.length}`}
        />
        <Card
          label="Best Failing"
          value={`${bestResult.windows.filter((w) => (w.testMetrics?.totalReturn ?? 0) < 0).length} / ${bestResult.windows.length}`}
        />
      </div>

      {/* Efficiency timeline across adaptation rounds */}
      {adaptations.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">
            Adaptation Rounds
          </h3>
          <div className="space-y-3">
            {adaptations.map((round) => (
              <div key={round.round} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">
                    Round {round.round + 1}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      round.improved
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {round.improved ? "Improved" : "No improvement"}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mb-2">
                  Efficiency: {fmt(round.efficiencyBefore)} &rarr;{" "}
                  {fmt(round.efficiencyAfter)}
                </div>
                <div className="text-xs text-zinc-500 mb-1">
                  Failing windows:{" "}
                  {round.failingWindows.map((w) => `#${w + 1}`).join(", ")}
                </div>
                <div className="text-xs text-zinc-400 italic bg-zinc-900 rounded p-2">
                  {round.diagnosis}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Walk-Forward comparison: before vs after per-window metrics */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">
          Window Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">Window</th>
                <th className="text-right py-2 px-2">Orig Return</th>
                <th className="text-right py-2 px-2">Best Return</th>
                <th className="text-right py-2 px-2">Orig Sharpe</th>
                <th className="text-right py-2 px-2">Best Sharpe</th>
                <th className="text-right py-2 px-2">Orig Trades</th>
                <th className="text-right py-2 px-2">Best Trades</th>
              </tr>
            </thead>
            <tbody>
              {originalResult.windows.map((origWin, i) => {
                const bestWin = bestResult.windows[i];
                const origRet = origWin?.testMetrics?.totalReturn ?? 0;
                const bestRet = bestWin?.testMetrics?.totalReturn ?? 0;
                return (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="py-2 px-2 text-zinc-400">{i + 1}</td>
                    <td
                      className={`py-2 px-2 text-right ${origRet >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {fmt(origRet, true)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right ${bestRet >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {fmt(bestRet, true)}
                    </td>
                    <td className="py-2 px-2 text-right text-zinc-400">
                      {fmt(origWin?.testMetrics?.sharpeRatio ?? 0)}
                    </td>
                    <td className="py-2 px-2 text-right text-zinc-400">
                      {fmt(bestWin?.testMetrics?.sharpeRatio ?? 0)}
                    </td>
                    <td className="py-2 px-2 text-right text-zinc-400">
                      {origWin?.testMetrics?.totalTrades ?? 0}
                    </td>
                    <td className="py-2 px-2 text-right text-zinc-400">
                      {bestWin?.testMetrics?.totalTrades ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code viewer */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-white">Strategy Code</h3>
          <div className="flex bg-zinc-800 rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setShowCode("original")}
              className={`px-3 py-1 ${showCode === "original" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
            >
              Original
            </button>
            <button
              onClick={() => setShowCode("best")}
              className={`px-3 py-1 ${showCode === "best" ? "bg-brand-600 text-white" : "text-zinc-400"}`}
            >
              Best
            </button>
          </div>
        </div>
        <pre className="bg-zinc-950 p-3 rounded-md text-xs overflow-x-auto max-h-[400px] overflow-y-auto text-zinc-300">
          {showCode === "original" ? originalCode : bestCode}
        </pre>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div
        className={`text-lg font-semibold ${highlight ? "text-brand-400" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}
