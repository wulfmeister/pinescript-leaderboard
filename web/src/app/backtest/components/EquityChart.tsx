"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { type EquityPoint, type Trade } from "../types";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

interface Props {
  equityCurve: EquityPoint[];
  trades: Trade[];
  initialCapital: number;
  overlayEquityCurve?: EquityPoint[];
  overlayLabel?: string;
}

function nearestIndex(curve: EquityPoint[], ts: number): number {
  let best = 0;
  let bestDiff = Math.abs(curve[0].timestamp - ts);
  for (let i = 1; i < curve.length; i++) {
    const diff = Math.abs(curve[i].timestamp - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function EquityChart({
  equityCurve,
  trades,
  initialCapital,
  overlayEquityCurve,
  overlayLabel,
}: Props) {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    import("chartjs-plugin-zoom").then((mod) => {
      Chart.register(mod.default);
    });
  }, []);

  const labels = useMemo(
    () => equityCurve.map((p) => new Date(p.timestamp).toLocaleDateString()),
    [equityCurve],
  );

  const equityData = useMemo(
    () => equityCurve.map((p) => p.equity),
    [equityCurve],
  );

  const tradeMarkers = useMemo(() => {
    const pts: (number | null)[] = equityCurve.map(() => null);
    trades
      .filter((t) => t.pnl !== undefined)
      .forEach((t) => {
        const idx = nearestIndex(equityCurve, t.timestamp);
        pts[idx] = equityCurve[idx].equity;
      });
    return pts;
  }, [equityCurve, trades]);

  const overlayData = useMemo(() => {
    if (!overlayEquityCurve || overlayEquityCurve.length === 0) return null;
    return equityCurve.map((p) => {
      const idx = nearestIndex(overlayEquityCurve, p.timestamp);
      return overlayEquityCurve[idx].equity;
    });
  }, [equityCurve, overlayEquityCurve]);

  const data: ChartData<"line"> = useMemo(() => {
    const datasets: ChartData<"line">["datasets"] = [
      {
        label: "Equity",
        data: equityData,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.1,
      },
      {
        label: "Trades",
        data: tradeMarkers,
        borderColor: "transparent",
        backgroundColor: "#f59e0b",
        pointRadius: tradeMarkers.map((v) => (v !== null ? 5 : 0)),
        pointStyle: "circle",
        showLine: false,
        pointHoverRadius: 7,
      },
    ];

    if (overlayData) {
      datasets.push({
        label: overlayLabel || "Comparison",
        data: overlayData,
        borderColor: "#818cf8",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
      });
    }

    return { labels, datasets };
  }, [labels, equityData, tradeMarkers, overlayData, overlayLabel]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: !!overlayData,
          labels: { color: "#a1a1aa", boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#e4e4e7",
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === "Trades") return null as any;
              return ` $${Number(ctx.raw).toFixed(2)}`;
            },
          },
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x",
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#71717a",
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
        y: {
          ticks: {
            color: "#71717a",
            callback: (v) => `$${Number(v).toLocaleString()}`,
          },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
      },
    }),
    [overlayData],
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Equity Curve</h2>
        <button
          onClick={() => chartRef.current?.resetZoom()}
          className="btn btn-ghost text-xs"
        >
          Reset Zoom
        </button>
      </div>
      <Line ref={chartRef} data={data} options={options} />
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan &middot; Yellow dots = trades
      </p>
    </div>
  );
}
