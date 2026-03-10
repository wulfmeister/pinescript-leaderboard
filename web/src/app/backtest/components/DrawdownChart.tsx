"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AreaSeries } from "lightweight-charts";
import { type EquityPoint } from "../types";
import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../../hooks/useLightweightChart";

import { ChartScreenshotButton } from "../../components/chart-screenshot-button";
import { ChartFullscreenToggle } from "../../components/chart-fullscreen-toggle";
import { ChartDatePresets } from "../../components/chart-date-presets";

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

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Drawdown</h2>
        <div className="flex items-center gap-4">
          <ChartDatePresets chartRef={chartRef} lastTimestamp={equityCurve[equityCurve.length - 1]?.timestamp} />
          <ChartScreenshotButton chartRef={chartRef} filename="drawdown-chart.png" />
          <ChartFullscreenToggle containerRef={containerRef} />
          <button onClick={handleResetZoom} className="btn btn-ghost text-xs">
            Reset Zoom
          </button>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div ref={containerRef} className="h-[400px] w-full" />
      </div>
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan
      </p>
    </div>
  );
}
