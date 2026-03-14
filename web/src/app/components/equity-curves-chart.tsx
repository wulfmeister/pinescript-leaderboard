"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { LineSeries, type ISeriesApi } from "lightweight-charts";
import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../hooks/useLightweightChart";
import { RankedResult } from "./ranked-result";

export function EquityCurvesChart({ results, capital }: { results: RankedResult[]; capital: number }) {
  const hasData = results.length > 0 && !!results[0]?.equityCurve?.length;

  const colors = ["#fbbf24", "#9ca3af", "#b45309", "#22c55e", "#3b82f6", "#8b5cf6"];
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);

  const formatValue = useCallback(
    (val: number) =>
      `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  useChartTooltip(chartRef, containerRef, formatValue);

  const lineData = useMemo(
    () =>
      results.map((r) => ({
        name: r.name,
        data: (r.equityCurve ?? []).map((p) => ({
          time: toUTCTimestamp(p.timestamp),
          value: p.equity,
        })),
      })),
    [results],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || lineData.length === 0) return;

    const created: ISeriesApi<"Line">[] = [];
    lineData.forEach((entry, idx) => {
      if (entry.data.length === 0) return;
      const series = chart.addSeries(LineSeries, {
        color: colors[idx % colors.length],
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(entry.data);
      created.push(series);
    });
    seriesRefs.current = created;

    chart.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        seriesRefs.current.forEach((s) => {
          try {
            chartRef.current?.removeSeries(s);
          } catch (e) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("EquityCurvesChart series cleanup:", e);
            }
          }
        });
        seriesRefs.current = [];
      }
    };
  }, [chartRef, lineData]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  if (!hasData) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-white">Equity Curves Comparison</h2>
        <button onClick={handleResetZoom} className="btn btn-ghost text-xs">
          Reset Zoom
        </button>
      </div>
      <div
        ref={containerRef}
        className="h-[300px] w-full"
        style={{ position: "relative" }}
      />
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan
      </p>
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-800">
        {results.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2">
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-sm text-zinc-300">{r.name}</span>
            <span className="text-xs text-zinc-500">
              ({((r.finalCapital / capital - 1) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
