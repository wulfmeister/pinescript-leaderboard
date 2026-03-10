"use client";

import { useState, useCallback, type MutableRefObject } from "react";
import {
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";

export type ChartType = "line" | "candlestick" | "area";

export interface OHLCVBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartTypeToggleProps {
  chartRef: MutableRefObject<IChartApi | null>;
  ohlcvData: OHLCVBar[];
  seriesRef: MutableRefObject<ISeriesApi<SeriesType> | null>;
  supportsCandlestick?: boolean;
  defaultType?: ChartType;
  onChange?: (type: ChartType) => void;
}

export function ChartTypeToggle({
  chartRef,
  ohlcvData,
  seriesRef,
  supportsCandlestick = false,
  defaultType = "line",
  onChange,
}: ChartTypeToggleProps) {
  const [currentType, setCurrentType] = useState<ChartType>(defaultType);

  const handleTypeChange = useCallback(
    (newType: ChartType) => {
      if (newType === currentType) return;

      const chart = chartRef.current;
      const currentSeries = seriesRef.current;
      if (!chart) return;

      const visibleRange = chart.timeScale().getVisibleRange();

      if (currentSeries) {
        try {
          chart.removeSeries(currentSeries);
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("ChartTypeToggle: removeSeries failed", e);
          }
        }
        seriesRef.current = null;
      }

      let newSeries: ISeriesApi<SeriesType>;
      if (newType === "candlestick") {
        newSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });
        newSeries.setData(ohlcvData);
      } else if (newType === "area") {
        newSeries = chart.addSeries(AreaSeries, {
          lineColor: "#22c55e",
          topColor: "rgba(34,197,94,0.2)",
          bottomColor: "rgba(34,197,94,0.0)",
          lineWidth: 2,
        });
        newSeries.setData(
          ohlcvData.map((d) => ({ time: d.time, value: d.close })),
        );
      } else {
        newSeries = chart.addSeries(LineSeries, {
          color: "#22c55e",
          lineWidth: 2,
          priceLineVisible: false,
        });
        newSeries.setData(
          ohlcvData.map((d) => ({ time: d.time, value: d.close })),
        );
      }

      seriesRef.current = newSeries;

      if (visibleRange) {
        chart.timeScale().setVisibleRange(visibleRange);
      }

      setCurrentType(newType);
      onChange?.(newType);
    },
    [chartRef, seriesRef, ohlcvData, onChange, currentType],
  );

  const types: { type: ChartType; label: string }[] = [
    { type: "line", label: "Line" },
    ...(supportsCandlestick
      ? [{ type: "candlestick" as ChartType, label: "Candle" }]
      : []),
    { type: "area", label: "Area" },
  ];

  return (
    <div className="flex items-center gap-1">
      {types.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => handleTypeChange(type)}
          className={`btn btn-ghost text-xs px-2 py-0.5 ${
            currentType === type ? "text-white bg-zinc-700" : "text-zinc-400"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
