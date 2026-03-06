"use client";

import { useMemo } from "react";
import { type Trade } from "../types";

const usd = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface MonthBucket {
  label: string;
  pnl: number;
  wins: number;
  losses: number;
  trades: number;
}

interface Props {
  trades: Trade[];
}

export function MonthlyPnL({ trades }: Props) {
  const months = useMemo(() => {
    const closed = trades.filter((t) => t.pnl !== undefined);
    if (closed.length === 0) return [];

    const buckets = new Map<string, MonthBucket>();

    closed.forEach((t) => {
      const d = new Date(t.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      if (!buckets.has(key)) {
        buckets.set(key, { label, pnl: 0, wins: 0, losses: 0, trades: 0 });
      }
      const b = buckets.get(key)!;
      b.pnl += t.pnl ?? 0;
      b.trades += 1;
      if ((t.pnl ?? 0) >= 0) b.wins += 1;
      else b.losses += 1;
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [trades]);

  if (months.length === 0) return null;

  return (
    <div className="card overflow-x-auto">
      <h2 className="font-semibold text-white mb-4">Monthly P&amp;L</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-left">
            <th className="pb-2">Month</th>
            <th className="pb-2 text-right">P&amp;L</th>
            <th className="pb-2 text-right">Trades</th>
            <th className="pb-2 text-right">W / L</th>
          </tr>
        </thead>
        <tbody className="text-zinc-300">
          {months.map((m) => (
            <tr key={m.label} className="border-t border-zinc-800">
              <td className="py-2 font-medium">{m.label}</td>
              <td
                className={`py-2 text-right font-medium ${
                  m.pnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {usd(m.pnl)}
              </td>
              <td className="py-2 text-right text-zinc-400">{m.trades}</td>
              <td className="py-2 text-right">
                <span className="text-green-400">{m.wins}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-red-400">{m.losses}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
