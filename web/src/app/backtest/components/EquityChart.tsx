"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import {
  LineSeries,
  createSeriesMarkers,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";

import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../../hooks/useLightweightChart";
import { type EquityPoint, type Trade } from "../types";

import { ChartScreenshotButton } from "../../components/chart-screenshot-button";
import { ChartFullscreenToggle } from "../../components/chart-fullscreen-toggle";
import { ChartDatePresets } from "../../components/chart-date-presets";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);
  const equitySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const formatValue = useCallback(
    (val: number) =>
      `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  useChartTooltip(chartRef, containerRef, formatValue);


  const equityLineData = useMemo(
    () =>
      equityCurve.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.equity,
      })),
    [equityCurve],
  );


  const tradeMarkers = useMemo((): SeriesMarker<UTCTimestamp>[] => {
    if (!trades || trades.length === 0) return [];

    const seen = new Set<number>();
    const markers: SeriesMarker<UTCTimestamp>[] = [];

    trades
      .filter((t) => t.pnl !== undefined)
      .forEach((t) => {
        const idx = nearestIndex(equityCurve, t.timestamp);
        if (!seen.has(idx)) {
          seen.add(idx);
          markers.push({
            time: toUTCTimestamp(equityCurve[idx].timestamp),
            position: "aboveBar" as const,
            color: "#f59e0b",
            shape: "circle" as const,
            text: "",
          });
        }
      });


    markers.sort((a, b) => (a.time as number) - (b.time as number));
    return markers;
  }, [equityCurve, trades]);


  const overlayLineData = useMemo(() => {
    if (!overlayEquityCurve || overlayEquityCurve.length === 0) return null;
    return overlayEquityCurve.map((p) => ({
      time: toUTCTimestamp(p.timestamp),
      value: p.equity,
    }));
  }, [overlayEquityCurve]);


  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || equityLineData.length === 0) return;


    const equitySeries = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
      priceLineVisible: false,
    });
    equitySeries.setData(equityLineData);
    equitySeriesRef.current = equitySeries;


    if (tradeMarkers.length > 0) {
      createSeriesMarkers(equitySeries, tradeMarkers);
    }


    if (overlayLineData) {
      const overlaySeries = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
        priceLineVisible: false,
      });
      overlaySeries.setData(overlayLineData);
      overlaySeriesRef.current = overlaySeries;
    }


    chart.timeScale().fitContent();


    return () => {
      if (chartRef.current) {
        try {
          if (equitySeriesRef.current) {
            chartRef.current.removeSeries(equitySeriesRef.current);
            equitySeriesRef.current = null;
          }
          if (overlaySeriesRef.current) {
            chartRef.current.removeSeries(overlaySeriesRef.current);
            overlaySeriesRef.current = null;
          }
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("EquityChart series cleanup error:", e);
          }
        }
      }
    };
  }, [chartRef, equityLineData, tradeMarkers, overlayLineData]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Equity Curve</h2>
        <div className="flex items-center gap-4">
          {overlayLineData && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-0.5"
                  style={{ backgroundColor: "#22c55e" }}
                />
                <span className="text-zinc-400">Equity</span>
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-0.5"
                  style={{ backgroundColor: "#3b82f6" }}
                />
                <span className="text-zinc-400">
                  {overlayLabel || "Comparison"}
                </span>
              </span>
            </div>
          )}
          <ChartDatePresets chartRef={chartRef} lastTimestamp={equityCurve[equityCurve.length - 1]?.timestamp} />
          <ChartScreenshotButton chartRef={chartRef} filename="equity-chart.png" />
          <ChartFullscreenToggle containerRef={containerRef} />
          <button onClick={handleResetZoom} className="btn btn-ghost text-xs">
            Reset Zoom
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[400px] w-full"
        style={{ position: "relative" }}
      />
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan &middot; Yellow dots = trades
      </p>
    </div>
  );
}
