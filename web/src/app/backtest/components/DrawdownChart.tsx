"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AreaSeries } from "lightweight-charts";
import { type EquityPoint } from "../types";
import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../../hooks/useLightweightChart";

interface Props {
  equityCurve: EquityPoint[];
}

export function DrawdownChart({ equityCurve }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);

  const drawdownData = useMemo(
    () =>
      equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.drawdown ?? 0,
      })),
    [equityCurve],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const series = chart.addSeries(AreaSeries, {
      topColor: "rgba(239,68,68,0.1)",
      bottomColor: "rgba(239,68,68,0.4)",
      lineColor: "#ef4444",
      lineWidth: 2,
    });

    series.setData(drawdownData);
    chart.timeScale().fitContent();

    return () => {
      chart.removeSeries(series);
    };
  }, [chartRef, drawdownData]);

  const formatTooltip = useCallback(
    (val: number) => `${(val * 100).toFixed(2)}%`,
    [],
  );

  useChartTooltip(chartRef, containerRef, formatTooltip);

  return (
    <div className="card">
      <h2 className="font-semibold text-white mb-4">Drawdown</h2>
      <div style={{ position: "relative" }}>
        <div ref={containerRef} className="h-[400px] w-full" />
      </div>
    </div>
  );
}
