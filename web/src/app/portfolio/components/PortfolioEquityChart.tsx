"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { LineSeries, type ISeriesApi } from "lightweight-charts";

import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../../hooks/useLightweightChart";
import { ChartDatePresets } from "../../components/chart-date-presets";
import { ChartScreenshotButton } from "../../components/chart-screenshot-button";
import { ChartFullscreenToggle } from "../../components/chart-fullscreen-toggle";

// Minimal EquityPoint for portfolio data (no drawdown field).
// Intentionally differs from backtest/types.ts EquityPoint which includes drawdown.
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
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#14b8a6",
  "#e879f9",
  "#fb923c",
];

export function PortfolioEquityChart({
  combined,
  perAsset,
  initialCapital,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);
  const combinedSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const assetSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);

  const formatValue = useCallback(
    (val: number) =>
      `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  useChartTooltip(chartRef, containerRef, formatValue);

  const combinedLineData = useMemo(
    () =>
      combined.map((p) => ({
        time: toUTCTimestamp(p.timestamp),
        value: p.equity,
      })),
    [combined],
  );

  const assetLineData = useMemo(
    () =>
      perAsset.map((asset) => ({
        symbol: asset.symbol,
        data: asset.equityCurve.map((p) => ({
          time: toUTCTimestamp(p.timestamp),
          value: p.equity,
        })),
      })),
    [perAsset],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || combinedLineData.length === 0) return;

    const combinedSeries = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
      priceLineVisible: false,
    });
    combinedSeries.setData(combinedLineData);
    combinedSeriesRef.current = combinedSeries;

    const assetSeries: ISeriesApi<"Line">[] = [];
    assetLineData.forEach((asset, idx) => {
      const series = chart.addSeries(LineSeries, {
        color: ASSET_COLORS[idx % ASSET_COLORS.length],
        lineWidth: 1,
        priceLineVisible: false,
      });
      series.setData(asset.data);
      assetSeries.push(series);
    });
    assetSeriesRefs.current = assetSeries;

    chart.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        try {
          if (combinedSeriesRef.current) {
            chartRef.current.removeSeries(combinedSeriesRef.current);
            combinedSeriesRef.current = null;
          }
          assetSeriesRefs.current.forEach((s) => {
            try {
              chartRef.current?.removeSeries(s);
            } catch (e) {
              if (process.env.NODE_ENV !== "production") {
                console.warn(
                  "PortfolioEquityChart per-asset series cleanup:",
                  e,
                );
              }
            }
          });
          assetSeriesRefs.current = [];
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("PortfolioEquityChart series cleanup error:", e);
          }
        }
      }
    };
  }, [chartRef, combinedLineData, assetLineData]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5"
              style={{ backgroundColor: "#22c55e" }}
            />
            <span className="text-zinc-400">Portfolio</span>
          </span>
          {perAsset.map((asset, idx) => (
            <span key={asset.symbol} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-0.5"
                style={{
                  backgroundColor: ASSET_COLORS[idx % ASSET_COLORS.length],
                }}
              />
              <span className="text-zinc-400">{asset.symbol}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ChartDatePresets
            chartRef={chartRef}
            lastTimestamp={combined[combined.length - 1]?.timestamp}
          />
          <ChartScreenshotButton
            chartRef={chartRef}
            filename="portfolio-equity.png"
          />
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
        Scroll to zoom &middot; Drag to pan
      </p>
    </>
  );
}
