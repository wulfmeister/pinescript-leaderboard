"use client";

import { type BacktestResult } from "../types";

interface Props {
  result: BacktestResult;
  asset: string;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(result: BacktestResult): string {
  const header = "date,direction,action,price,quantity,symbol,pnl";
  const rows = result.trades
    .filter((t) => t.pnl !== undefined)
    .map((t) =>
      [
        new Date(t.timestamp).toISOString(),
        t.direction ?? "",
        t.action,
        t.price.toFixed(4),
        t.quantity ?? "",
        t.symbol ?? "",
        (t.pnl ?? 0).toFixed(4),
      ].join(","),
    );
  return [header, ...rows].join("\n");
}

export function ExportButtons({ result, asset }: Props) {
  const slug = asset.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  const handleTradesCSV = () => {
    downloadBlob(toCSV(result), `trades_${slug}.csv`, "text/csv");
  };

  const handleMetricsJSON = () => {
    const payload = {
      asset,
      initialCapital: result.initialCapital,
      finalCapital: result.finalCapital,
      dataPoints: result.dataPoints,
      signalCount: result.signalCount,
      metrics: result.metrics,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `metrics_${slug}.json`,
      "application/json",
    );
  };

  return (
    <div className="flex gap-2">
      <button onClick={handleTradesCSV} className="btn btn-ghost text-xs">
        Export Trades CSV
      </button>
      <button onClick={handleMetricsJSON} className="btn btn-ghost text-xs">
        Export Metrics JSON
      </button>
    </div>
  );
}
