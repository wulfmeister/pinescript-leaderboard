"use client";

import { useMemo } from "react";
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

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

interface EquityPoint {
  timestamp: number;
  equity: number;
}

interface PerAssetCurve {
  symbol: string;
  equityCurve: EquityPoint[];
}

interface Props {
  combined: EquityPoint[];
  perAsset: PerAssetCurve[];
  initialCapital: number;
}

const ASSET_COLORS = [
  "#60a5fa",
  "#f59e0b",
  "#a78bfa",
  "#f87171",
  "#34d399",
  "#fb923c",
  "#e879f9",
  "#38bdf8",
  "#4ade80",
  "#fbbf24",
];

export function PortfolioEquityChart({
  combined,
  perAsset,
  initialCapital,
}: Props) {
  const labels = useMemo(
    () => combined.map((p) => new Date(p.timestamp).toLocaleDateString()),
    [combined],
  );

  const data: ChartData<"line"> = useMemo(() => {
    const datasets: ChartData<"line">["datasets"] = [
      {
        label: "Portfolio",
        data: combined.map((p) => p.equity),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.1,
      },
    ];

    perAsset.forEach((asset, idx) => {
      const color = ASSET_COLORS[idx % ASSET_COLORS.length];
      datasets.push({
        label: asset.symbol,
        data: asset.equityCurve.map((p) => p.equity),
        borderColor: color,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: false,
        tension: 0.1,
      });
    });

    return { labels, datasets };
  }, [combined, perAsset, labels]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#a1a1aa", boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#e4e4e7",
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}`,
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
          suggestedMin: initialCapital * 0.9,
          grid: { color: "rgba(63,63,70,0.4)" },
        },
      },
    }),
    [initialCapital],
  );

  return <Line data={data} options={options} />;
}
