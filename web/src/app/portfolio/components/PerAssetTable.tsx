"use client";

import { useMemo, useState } from "react";

interface PerAssetRow {
  symbol: string;
  allocation: number;
  result: {
    metrics: {
      totalReturn: number;
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      totalTrades: number;
    };
    finalCapital: number;
    trades: unknown[];
  };
}

interface Props {
  perAsset: PerAssetRow[];
}

type SortKey =
  | "allocation"
  | "totalReturn"
  | "sharpeRatio"
  | "maxDrawdown"
  | "winRate"
  | "totalTrades"
  | "finalCapital";

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function PerAssetTable({ perAsset }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("allocation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const rows = [...perAsset];
    rows.sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);
      if (aValue === bValue) return 0;
      const direction = sortDir === "asc" ? 1 : -1;
      return aValue > bValue ? direction : -direction;
    });
    return rows;
  }, [perAsset, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-zinc-400">
            <th className="text-left py-2 pr-4">Asset</th>
            <SortableHeader
              label="Allocation ($)"
              onClick={() => handleSort("allocation")}
              active={sortKey === "allocation"}
              direction={sortDir}
            />
            <SortableHeader
              label="Return (%)"
              onClick={() => handleSort("totalReturn")}
              active={sortKey === "totalReturn"}
              direction={sortDir}
            />
            <SortableHeader
              label="Sharpe"
              onClick={() => handleSort("sharpeRatio")}
              active={sortKey === "sharpeRatio"}
              direction={sortDir}
            />
            <SortableHeader
              label="Max DD (%)"
              onClick={() => handleSort("maxDrawdown")}
              active={sortKey === "maxDrawdown"}
              direction={sortDir}
            />
            <SortableHeader
              label="Win Rate (%)"
              onClick={() => handleSort("winRate")}
              active={sortKey === "winRate"}
              direction={sortDir}
            />
            <SortableHeader
              label="Trades"
              onClick={() => handleSort("totalTrades")}
              active={sortKey === "totalTrades"}
              direction={sortDir}
            />
            <SortableHeader
              label="Final Capital ($)"
              onClick={() => handleSort("finalCapital")}
              active={sortKey === "finalCapital"}
              direction={sortDir}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((asset) => {
            const { metrics } = asset.result;
            return (
              <tr key={asset.symbol} className="border-b border-zinc-800">
                <td className="py-2 pr-4 font-medium text-white">
                  {asset.symbol}
                </td>
                <td className="py-2 pr-4 text-zinc-200">
                  {formatCurrency(asset.allocation)}
                </td>
                <td
                  className={`py-2 pr-4 ${
                    metrics.totalReturn >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatPercent(metrics.totalReturn)}
                </td>
                <td
                  className={`py-2 pr-4 ${
                    metrics.sharpeRatio >= 1
                      ? "text-green-400"
                      : metrics.sharpeRatio < 0
                        ? "text-red-400"
                        : "text-zinc-200"
                  }`}
                >
                  {metrics.sharpeRatio.toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-red-400">
                  {formatPercent(metrics.maxDrawdown)}
                </td>
                <td className="py-2 pr-4 text-zinc-200">
                  {formatPercent(metrics.winRate)}
                </td>
                <td className="py-2 pr-4 text-zinc-200">
                  {metrics.totalTrades}
                </td>
                <td className="py-2 pr-4 text-zinc-200">
                  {formatCurrency(asset.result.finalCapital)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  onClick,
  active,
  direction,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  direction: "asc" | "desc";
}) {
  return (
    <th className="text-left py-2 pr-4">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        {label}
        <span className="text-xs">
          {active ? (direction === "asc" ? "^" : "v") : "<>"}
        </span>
      </button>
    </th>
  );
}

function getSortValue(asset: PerAssetRow, key: SortKey): number {
  switch (key) {
    case "allocation":
      return asset.allocation;
    case "totalReturn":
      return asset.result.metrics.totalReturn;
    case "sharpeRatio":
      return asset.result.metrics.sharpeRatio;
    case "maxDrawdown":
      return asset.result.metrics.maxDrawdown;
    case "winRate":
      return asset.result.metrics.winRate;
    case "totalTrades":
      return asset.result.metrics.totalTrades;
    case "finalCapital":
      return asset.result.finalCapital;
    default:
      return 0;
  }
}
