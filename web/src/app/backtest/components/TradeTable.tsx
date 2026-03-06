"use client";

import { useState } from "react";
import { type Trade } from "../types";

type SortKey = "timestamp" | "price" | "pnl";
type SortDir = "asc" | "desc";
type Filter = "all" | "wins" | "losses";

const usd = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface Props {
  trades: Trade[];
}

export function TradeTable({ trades }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const closedTrades = trades.filter((t) => t.pnl !== undefined);

  const filtered = closedTrades.filter((t) => {
    if (filter === "wins") return (t.pnl ?? 0) >= 0;
    if (filter === "losses") return (t.pnl ?? 0) < 0;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number;
    if (sortKey === "timestamp") {
      av = a.timestamp;
      bv = b.timestamp;
    } else if (sortKey === "price") {
      av = a.price;
      bv = b.price;
    } else {
      av = a.pnl ?? 0;
      bv = b.pnl ?? 0;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 text-zinc-600">
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">
          Trades
          <span className="ml-2 text-sm font-normal text-zinc-500">
            {filtered.length}/{closedTrades.length}
          </span>
        </h2>
        <div className="flex gap-1">
          {(["all", "wins", "losses"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn text-xs px-3 py-1 ${
                filter === f ? "btn-primary" : "btn-ghost"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500 py-4 text-center">
          {closedTrades.length === 0
            ? "No closed trades in this backtest."
            : "No trades match the current filter."}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left">
              <th
                className="pb-2 cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort("timestamp")}
              >
                Date <SortIcon k="timestamp" />
              </th>
              <th className="pb-2">Action</th>
              <th
                className="pb-2 text-right cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort("price")}
              >
                Price <SortIcon k="price" />
              </th>
              <th
                className="pb-2 text-right cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort("pnl")}
              >
                P&amp;L <SortIcon k="pnl" />
              </th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {sorted.map((t, i) => (
              <>
                <tr
                  key={i}
                  className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-800/30"
                  onClick={() => setExpandedId(expandedId === i ? null : i)}
                >
                  <td className="py-2">
                    {new Date(t.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-2">{t.action.toUpperCase()}</td>
                  <td className="py-2 text-right">{usd(t.price)}</td>
                  <td
                    className={`py-2 text-right font-medium ${
                      (t.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {usd(t.pnl ?? 0)}
                  </td>
                </tr>
                {expandedId === i && (
                  <tr
                    key={`exp-${i}`}
                    className="border-t border-zinc-800 bg-zinc-800/20"
                  >
                    <td colSpan={4} className="py-3 px-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {t.direction && (
                          <div>
                            <span className="text-zinc-500">Direction: </span>
                            <span className="text-zinc-200">
                              {t.direction.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {t.quantity !== undefined && (
                          <div>
                            <span className="text-zinc-500">Qty: </span>
                            <span className="text-zinc-200">{t.quantity}</span>
                          </div>
                        )}
                        {t.symbol && (
                          <div>
                            <span className="text-zinc-500">Symbol: </span>
                            <span className="text-zinc-200">{t.symbol}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-zinc-500">Time: </span>
                          <span className="text-zinc-200">
                            {new Date(t.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
