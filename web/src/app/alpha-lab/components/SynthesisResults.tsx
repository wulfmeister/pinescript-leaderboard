/**
 * Results display for the Factor Synthesis mode.
 *
 * Shows: factor list with scores, correlation matrix heatmap,
 * weight distribution, and composite strategy metrics.
 */

"use client";

interface FactorResult {
  name: string;
  category: string;
  code: string;
  score: number;
  pruned: boolean;
  prunedReason?: string;
  metrics: Record<string, number>;
}

interface SynthesisResult {
  factors: FactorResult[];
  survivingFactors: FactorResult[];
  correlationMatrix: number[][];
  weights: Record<string, number>;
  compositeMetrics: Record<string, number>;
  iterations: number;
  totalLLMCalls: number;
  elapsedMs: number;
}

function fmt(val: number, pct = false): string {
  if (pct) return `${(val * 100).toFixed(2)}%`;
  return val.toFixed(3);
}

export function SynthesisResults({ result }: { result: SynthesisResult }) {
  const {
    factors,
    survivingFactors,
    correlationMatrix,
    weights,
    compositeMetrics,
    iterations,
    totalLLMCalls,
    elapsedMs,
  } = result;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Factors Generated" value={String(factors.length)} />
        <Card
          label="Surviving"
          value={String(survivingFactors.length)}
          highlight
        />
        <Card
          label="Pruned"
          value={String(factors.filter((f) => f.pruned).length)}
        />
        <Card label="Iterations" value={String(iterations)} />
        <Card
          label="Composite Return"
          value={fmt(compositeMetrics.totalReturn ?? 0, true)}
          highlight
        />
        <Card
          label="Composite Sharpe"
          value={fmt(compositeMetrics.sharpeRatio ?? 0)}
        />
        <Card label="LLM Calls" value={String(totalLLMCalls)} />
        <Card label="Time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
      </div>

      {/* Factor list */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">Factors</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Category</th>
                <th className="text-right py-2 px-2">Score</th>
                <th className="text-right py-2 px-2">Weight</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {factors
                .sort((a, b) => b.score - a.score)
                .map((factor) => (
                  <tr
                    key={factor.name}
                    className={`border-b border-zinc-800/50 ${factor.pruned ? "opacity-40" : ""}`}
                  >
                    <td className="py-2 px-2 font-mono text-white">
                      {factor.name}
                    </td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-300">
                        {factor.category}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-green-400">
                      {fmt(factor.score)}
                    </td>
                    <td className="py-2 px-2 text-right text-brand-400">
                      {factor.pruned
                        ? "—"
                        : fmt(weights[factor.name] ?? 0, true)}
                    </td>
                    <td className="py-2 px-2">
                      {factor.pruned ? (
                        <span
                          className="text-red-400"
                          title={factor.prunedReason}
                        >
                          Pruned
                        </span>
                      ) : (
                        <span className="text-green-400">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correlation matrix */}
      {correlationMatrix.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">
            Factor Correlation Matrix (Surviving)
          </h3>
          <div className="overflow-x-auto">
            <table className="text-[10px]">
              <thead>
                <tr>
                  <th className="px-1 py-1" />
                  {survivingFactors.map((f) => (
                    <th
                      key={f.name}
                      className="px-1 py-1 text-zinc-500 font-normal max-w-[60px] truncate"
                      title={f.name}
                    >
                      {f.name.split("-").slice(-1)[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {survivingFactors.map((row, i) => (
                  <tr key={row.name}>
                    <td
                      className="px-1 py-1 text-zinc-500 font-mono max-w-[80px] truncate"
                      title={row.name}
                    >
                      {row.name.split("-").slice(-1)[0]}
                    </td>
                    {survivingFactors.map((_, j) => {
                      const val = correlationMatrix[i]?.[j] ?? 0;
                      return (
                        <td
                          key={j}
                          className="px-1 py-1 text-center"
                          style={{ backgroundColor: corrColor(val) }}
                          title={`${row.name} vs ${survivingFactors[j].name}: ${val.toFixed(2)}`}
                        >
                          {i === j ? "" : val.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weight distribution */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">
          Weight Distribution
        </h3>
        <div className="space-y-2">
          {survivingFactors
            .sort((a, b) => (weights[b.name] ?? 0) - (weights[a.name] ?? 0))
            .map((f) => {
              const w = weights[f.name] ?? 0;
              return (
                <div key={f.name} className="flex items-center gap-2">
                  <div
                    className="text-xs text-zinc-400 w-40 truncate font-mono"
                    title={f.name}
                  >
                    {f.name}
                  </div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-3">
                    <div
                      className="bg-brand-500 h-3 rounded-full"
                      style={{ width: `${w * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-400 w-14 text-right">
                    {(w * 100).toFixed(1)}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Composite metrics */}
      <div className="card border-brand-500/30">
        <h3 className="text-sm font-semibold text-brand-400 mb-2">
          Composite Strategy Metrics
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { l: "Return", v: fmt(compositeMetrics.totalReturn ?? 0, true) },
            { l: "Sharpe", v: fmt(compositeMetrics.sharpeRatio ?? 0) },
            { l: "Drawdown", v: fmt(compositeMetrics.maxDrawdown ?? 0, true) },
            { l: "Win Rate", v: fmt(compositeMetrics.winRate ?? 0, true) },
            { l: "Profit Factor", v: fmt(compositeMetrics.profitFactor ?? 0) },
            { l: "Trades", v: String(compositeMetrics.totalTrades ?? 0) },
          ].map((item) => (
            <div key={item.l} className="text-xs">
              <div className="text-zinc-500">{item.l}</div>
              <div className="text-white font-semibold">{item.v}</div>
            </div>
          ))}
        </div>
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

/** Map correlation value to a background color. */
function corrColor(val: number): string {
  const abs = Math.abs(val);
  if (abs > 0.7) return "rgba(239, 68, 68, 0.3)"; // red — highly correlated
  if (abs > 0.4) return "rgba(234, 179, 8, 0.2)"; // yellow — moderate
  if (abs > 0.1) return "rgba(34, 197, 94, 0.15)"; // green — low
  return "transparent";
}
