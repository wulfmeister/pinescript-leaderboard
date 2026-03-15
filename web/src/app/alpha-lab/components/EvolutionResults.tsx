/**
 * Results display for the Genetic Evolver mode.
 *
 * Shows: evolution timeline chart, before/after comparison,
 * best strategy code, and per-generation breakdown.
 */

"use client";

interface CandidateResult {
  name: string;
  code: string;
  origin: string;
  parentNames?: string[];
  score: number;
  metrics: Record<string, number>;
  equityCurve: { timestamp: number; equity: number }[];
}

interface GenerationResult {
  index: number;
  population: CandidateResult[];
  best: CandidateResult;
  invalidCount: number;
}

interface EvolutionResult {
  generations: GenerationResult[];
  bestStrategy: CandidateResult;
  seed: CandidateResult;
  improvement: number;
  totalLLMCalls: number;
  totalBacktests: number;
  elapsedMs: number;
}

function fmt(val: number, pct = false): string {
  if (pct) return `${(val * 100).toFixed(2)}%`;
  return val.toFixed(3);
}

export function EvolutionResults({ result }: { result: EvolutionResult }) {
  const {
    seed,
    bestStrategy,
    generations,
    improvement,
    totalLLMCalls,
    totalBacktests,
    elapsedMs,
  } = result;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Seed Score" value={fmt(seed.score)} />
        <Card label="Best Score" value={fmt(bestStrategy.score)} highlight />
        <Card
          label="Improvement"
          value={fmt(improvement, true)}
          highlight={improvement > 0}
        />
        <Card label="Time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
        <Card label="Generations" value={String(generations.length)} />
        <Card label="LLM Calls" value={String(totalLLMCalls)} />
        <Card label="Backtests" value={String(totalBacktests)} />
        <Card label="Best Name" value={bestStrategy.name} />
      </div>

      {/* Evolution timeline — score per generation */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">
          Evolution Timeline
        </h3>
        <div className="flex items-end gap-1 h-40">
          {/* Seed bar */}
          <TimelineBar
            label="Seed"
            score={seed.score}
            maxScore={Math.max(seed.score, bestStrategy.score, 0.01)}
            highlight={false}
          />
          {generations.map((gen) => (
            <TimelineBar
              key={gen.index}
              label={`G${gen.index + 1}`}
              score={gen.best.score}
              maxScore={Math.max(seed.score, bestStrategy.score, 0.01)}
              highlight={gen.best.name === bestStrategy.name}
            />
          ))}
        </div>
      </div>

      {/* Before / After comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">
            Seed Strategy
          </h3>
          <MetricsGrid metrics={seed.metrics} />
        </div>
        <div className="card border-brand-500/30">
          <h3 className="text-sm font-semibold text-brand-400 mb-2">
            Best Strategy — {bestStrategy.name}
          </h3>
          <MetricsGrid metrics={bestStrategy.metrics} />
        </div>
      </div>

      {/* Best strategy code */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-2">
          Best Strategy Code
        </h3>
        <pre className="bg-zinc-950 p-3 rounded-md text-xs overflow-x-auto max-h-[400px] overflow-y-auto text-zinc-300">
          {bestStrategy.code}
        </pre>
      </div>

      {/* Generation breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-3">Generations</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">Gen</th>
                <th className="text-left py-2 px-2">Best Name</th>
                <th className="text-right py-2 px-2">Score</th>
                <th className="text-right py-2 px-2">Origin</th>
                <th className="text-right py-2 px-2">Pop Size</th>
                <th className="text-right py-2 px-2">Invalid</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((gen) => (
                <tr key={gen.index} className="border-b border-zinc-800/50">
                  <td className="py-2 px-2 text-zinc-400">{gen.index + 1}</td>
                  <td className="py-2 px-2 text-white font-mono">
                    {gen.best.name}
                  </td>
                  <td className="py-2 px-2 text-right text-green-400">
                    {fmt(gen.best.score)}
                  </td>
                  <td className="py-2 px-2 text-right text-zinc-400">
                    {gen.best.origin}
                  </td>
                  <td className="py-2 px-2 text-right text-zinc-400">
                    {gen.population.length}
                  </td>
                  <td className="py-2 px-2 text-right text-red-400">
                    {gen.invalidCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function TimelineBar({
  label,
  score,
  maxScore,
  highlight,
}: {
  label: string;
  score: number;
  maxScore: number;
  highlight: boolean;
}) {
  const height =
    maxScore > 0 ? Math.max(4, (Math.max(0, score) / maxScore) * 100) : 4;
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="text-[10px] text-zinc-500">{score.toFixed(2)}</div>
      <div
        className={`w-full rounded-t ${highlight ? "bg-brand-500" : "bg-zinc-600"}`}
        style={{ height: `${height}%` }}
      />
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: Record<string, number> }) {
  const items = [
    { label: "Return", value: fmt(metrics.totalReturn ?? 0, true) },
    { label: "Sharpe", value: fmt(metrics.sharpeRatio ?? 0) },
    { label: "Drawdown", value: fmt(metrics.maxDrawdown ?? 0, true) },
    { label: "Win Rate", value: fmt(metrics.winRate ?? 0, true) },
    { label: "Profit Factor", value: fmt(metrics.profitFactor ?? 0) },
    { label: "Trades", value: String(metrics.totalTrades ?? 0) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="text-xs">
          <span className="text-zinc-500">{item.label}: </span>
          <span className="text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
