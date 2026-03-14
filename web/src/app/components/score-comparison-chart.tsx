"use client";

import { RankedResult } from "./ranked-result";

export function ScoreComparisonChart({ results }: { results: RankedResult[] }) {
  if (results.length === 0) return null;
  const maxScore = Math.max(...results.map((r) => r.score));
  const colors = ["#fbbf24", "#9ca3af", "#b45309", "#3f3f46", "#27272a"];

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Score Comparison</h2>
      <div className="space-y-3">
        {results.map((r, i) => {
          const width = maxScore > 0 ? (r.score / maxScore) * 100 : 0;
          const color = colors[Math.min(i, colors.length - 1)];
          return (
            <div key={r.name} className="relative group flex items-center gap-3">
              <div className="w-24 text-sm text-zinc-400 truncate">{r.name}</div>
              <div className="flex-1 h-8 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(width, 5)}%`, backgroundColor: color }}
                >
                  <span className="text-xs text-white font-medium">
                    {r.score.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="w-8 text-center">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    r.rank === 1
                      ? "bg-yellow-500/20 text-yellow-400"
                      : r.rank === 2
                      ? "bg-zinc-400/20 text-zinc-300"
                      : r.rank === 3
                      ? "bg-amber-700/20 text-amber-500"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {r.rank}
                </span>
              </div>
              <div className="absolute left-28 -top-7 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap invisible group-hover:visible z-10 pointer-events-none">
                {r.name}: {r.score.toFixed(4)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
