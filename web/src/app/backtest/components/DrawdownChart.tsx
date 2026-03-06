"use client";

import { useMemo } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { type EquityPoint } from "../types";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

interface Props {
  equityCurve: EquityPoint[];
}

export function DrawdownChart({ equityCurve }: Props) {
  const labels = useMemo(
    () => equityCurve.map((p) => new Date(p.timestamp).toLocaleDateString()),
    [equityCurve],
  );

  const drawdownData = useMemo(
    () => equityCurve.map((p) => -(p.drawdown * 100)),
    [equityCurve],
  );

  const data: ChartData<"line"> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Drawdown %",
          data: drawdownData,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.15)",
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: true,
          tension: 0.1,
        },
      ],
    }),
    [labels, drawdownData],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      animation: false,
      interaction: { mode: "index", intersect: false },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#18181b",
          titleColor: "#a1a1aa",
          bodyColor: "#e4e4e7",
          callbacks: {
            label: (ctx) => ` ${Number(ctx.raw).toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#71717a", maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
        y: {
          ticks: {
            color: "#71717a",
            callback: (v) => `${Number(v).toFixed(1)}%`,
          },
          grid: { color: "rgba(63,63,70,0.4)" },
        },
      },
    }),
    [],
  );

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Drawdown</h2>
      <Line data={data} options={options} />
    </div>
  );
}
