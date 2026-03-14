"use client";

import { RankedResult, pct, usd } from "./ranked-result";

export function RankingsTable({ results }: { results: RankedResult[] }) {
  return (
    <div className="card overflow-x-auto">
      <h2 className="font-semibold text-white mb-4">Rankings</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-left">
            <th className="pb-3">Rank</th>
            <th className="pb-3">Strategy</th>
            <th className="pb-3 text-right">Score</th>
            <th className="pb-3 text-right">Return</th>
            <th className="pb-3 text-right">Sharpe</th>
            <th className="pb-3 text-right">Max DD</th>
            <th className="pb-3 text-right">Win Rate</th>
            <th className="pb-3 text-right">Trades</th>
            <th className="pb-3 text-right">Final Capital</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.rank}
              className="border-t border-zinc-800 text-zinc-300"
            >
              <td className="py-3">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
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
              </td>
              <td className="py-3 text-white font-medium">{r.name}</td>
              <td className="py-3 text-right">{r.score.toFixed(3)}</td>
              <td
                className={`py-3 text-right font-medium ${
                  r.metrics.totalReturn >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {pct(r.metrics.totalReturn)}
              </td>
              <td className="py-3 text-right">
                {r.metrics.sharpeRatio.toFixed(2)}
              </td>
              <td className="py-3 text-right text-red-400">
                {pct(r.metrics.maxDrawdown)}
              </td>
              <td className="py-3 text-right">{pct(r.metrics.winRate)}</td>
              <td className="py-3 text-right">{r.metrics.totalTrades}</td>
              <td className="py-3 text-right">{usd(r.finalCapital)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
