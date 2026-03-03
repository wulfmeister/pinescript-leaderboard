"use client";

interface TradeRow {
  timestamp: number;
  direction?: string;
  action: string;
  price: number;
  quantity?: number;
  pnl?: number;
}

interface Props {
  result: {
    perAsset: {
      symbol: string;
      result: {
        trades: TradeRow[];
      };
    }[];
    combined: {
      metrics: unknown;
      initialCapital: number;
      finalCapital: number;
    };
    totalCapital: number;
    elapsedMs: number;
    assetSymbols: string[];
  };
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

function toTradesCSV(result: Props["result"]): string {
  const header = "date,symbol,direction,action,price,quantity,pnl";
  const rows = result.perAsset
    .flatMap((asset) =>
      asset.result.trades.map((trade) => ({
        symbol: asset.symbol,
        ...trade,
      })),
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((trade) =>
      [
        new Date(trade.timestamp).toISOString(),
        trade.symbol,
        trade.direction ?? "",
        trade.action,
        trade.price.toFixed(4),
        trade.quantity ?? "",
        trade.pnl ?? "",
      ].join(","),
    );

  return [header, ...rows].join("\n");
}

export function PortfolioExportButtons({ result }: Props) {
  const handleTradesCSV = () => {
    downloadBlob(toTradesCSV(result), "portfolio_trades.csv", "text/csv");
  };

  const handleMetricsJSON = () => {
    downloadBlob(
      JSON.stringify(result, null, 2),
      "portfolio_metrics.json",
      "application/json",
    );
  };

  return (
    <div className="card">
      <div className="flex gap-2">
        <button onClick={handleTradesCSV} className="btn btn-ghost text-xs">
          Export Combined Trades CSV
        </button>
        <button onClick={handleMetricsJSON} className="btn btn-ghost text-xs">
          Export Metrics JSON
        </button>
      </div>
    </div>
  );
}
