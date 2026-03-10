"use client";

import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
  type MutableRefObject,
} from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts";

import {
  bollingerBands,
  ema,
  macd,
  rsi,
  sma,
  type OHLCV,
} from "@pinescript-utils/core";
import {
  useLightweightChart,
  useChartTooltip,
  toUTCTimestamp,
} from "../../hooks/useLightweightChart";
import {
  ChartTypeToggle,
  type OHLCVBar,
} from "../../components/chart-type-toggle";
import { ChartScreenshotButton } from "../../components/chart-screenshot-button";
import { ChartFullscreenToggle } from "../../components/chart-fullscreen-toggle";
import { ChartDatePresets } from "../../components/chart-date-presets";
import { type Trade } from "../types";
import { type IndicatorConfig } from "./IndicatorToggles";

interface Props {
  ohlcvData: OHLCV[];
  trades: Trade[];
  indicators?: IndicatorConfig[];
}

export function PriceChart({ ohlcvData, trades, indicators = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useLightweightChart(containerRef);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiPaneRef = useRef<ReturnType<IChartApi["addPane"]> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdPaneRef = useRef<ReturnType<IChartApi["addPane"]> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const paneLayoutRef = useRef("");
  const [chartHeight, setChartHeight] = useState(400);

  const formatValue = useCallback((val: number) => val.toFixed(2), []);

  useChartTooltip(chartRef, containerRef, formatValue);

  const ohlcvBars = useMemo<OHLCVBar[]>(
    () =>
      ohlcvData.map((bar) => ({
        time: toUTCTimestamp(bar.timestamp),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    [ohlcvData],
  );

  const tradeMarkers = useMemo((): SeriesMarker<UTCTimestamp>[] => {
    if (!trades || trades.length === 0) return [];

    const markers: SeriesMarker<UTCTimestamp>[] = [];

    trades.forEach((trade) => {
      const action = trade.action.toLowerCase();
      const direction = trade.direction?.toLowerCase();

      const isBuy =
        action === "buy" || (direction === "long" && action === "entry");
      const isSell =
        action === "sell" ||
        (direction === "short" && action === "entry") ||
        trade.pnl !== undefined;

      if (isBuy) {
        markers.push({
          time: toUTCTimestamp(trade.timestamp),
          position: "belowBar",
          color: "#22c55e",
          shape: "arrowUp",
          text: "",
        });
      } else if (isSell) {
        markers.push({
          time: toUTCTimestamp(trade.timestamp),
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: "",
        });
      }
    });

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    return markers;
  }, [trades]);

  const removeLineSeries = useCallback(
    (ref: MutableRefObject<ISeriesApi<"Line"> | null>) => {
      if (!chartRef.current || !ref.current) return;
      try {
        chartRef.current.removeSeries(ref.current);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("PriceChart line series cleanup error:", e);
        }
      } finally {
        ref.current = null;
      }
    },
    [chartRef],
  );

  const removeOverlaySeries = useCallback(() => {
    removeLineSeries(smaSeriesRef);
    removeLineSeries(emaSeriesRef);
    removeLineSeries(bbUpperRef);
    removeLineSeries(bbMiddleRef);
    removeLineSeries(bbLowerRef);
  }, [removeLineSeries]);

  const removeRsiPane = useCallback(() => {
    if (!chartRef.current || !rsiPaneRef.current) {
      rsiPaneRef.current = null;
      rsiSeriesRef.current = null;
      return;
    }

    try {
      const paneIndex = chartRef.current.panes().indexOf(rsiPaneRef.current);
      if (paneIndex >= 0) {
        chartRef.current.removePane(paneIndex);
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("PriceChart RSI pane cleanup error:", e);
      }
    } finally {
      rsiPaneRef.current = null;
      rsiSeriesRef.current = null;
    }
  }, [chartRef]);

  const removeMacdPane = useCallback(() => {
    if (!chartRef.current || !macdPaneRef.current) {
      macdPaneRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      return;
    }

    try {
      const paneIndex = chartRef.current.panes().indexOf(macdPaneRef.current);
      if (paneIndex >= 0) {
        chartRef.current.removePane(paneIndex);
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("PriceChart MACD pane cleanup error:", e);
      }
    } finally {
      macdPaneRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
  }, [chartRef]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (ohlcvBars.length === 0) {
      removeOverlaySeries();
      return;
    }

    const closes = ohlcvData.map((bar) => bar.close);
    const toLineData = (values: number[]) =>
      values
        .map((v, i) => ({ time: ohlcvBars[i].time, value: v }))
        .filter((p) => !isNaN(p.value));

    const byId = new Map(
      indicators.map((indicator) => [indicator.id, indicator]),
    );

    const smaConfig = byId.get("sma");
    if (smaConfig?.enabled) {
      const values = sma(closes, smaConfig.period ?? 20);
      if (!smaSeriesRef.current) {
        smaSeriesRef.current = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 1,
          priceLineVisible: false,
        });
      }
      smaSeriesRef.current.setData(toLineData(values));
    } else {
      removeLineSeries(smaSeriesRef);
    }

    const emaConfig = byId.get("ema");
    if (emaConfig?.enabled) {
      const values = ema(closes, emaConfig.period ?? 20);
      if (!emaSeriesRef.current) {
        emaSeriesRef.current = chart.addSeries(LineSeries, {
          color: "#f97316",
          lineWidth: 1,
          priceLineVisible: false,
        });
      }
      emaSeriesRef.current.setData(toLineData(values));
    } else {
      removeLineSeries(emaSeriesRef);
    }

    const bbConfig = byId.get("bb");
    if (bbConfig?.enabled) {
      const { upper, middle, lower } = bollingerBands(
        closes,
        bbConfig.period ?? 20,
        bbConfig.stdDev ?? 2,
      );

      if (!bbUpperRef.current) {
        bbUpperRef.current = chart.addSeries(LineSeries, {
          color: "#6b7280",
          lineWidth: 1,
          priceLineVisible: false,
        });
      }
      if (!bbMiddleRef.current) {
        bbMiddleRef.current = chart.addSeries(LineSeries, {
          color: "#9ca3af",
          lineWidth: 1,
          priceLineVisible: false,
        });
      }
      if (!bbLowerRef.current) {
        bbLowerRef.current = chart.addSeries(LineSeries, {
          color: "#6b7280",
          lineWidth: 1,
          priceLineVisible: false,
        });
      }

      bbUpperRef.current.setData(toLineData(upper));
      bbMiddleRef.current.setData(toLineData(middle));
      bbLowerRef.current.setData(toLineData(lower));
    } else {
      removeLineSeries(bbUpperRef);
      removeLineSeries(bbMiddleRef);
      removeLineSeries(bbLowerRef);
    }
  }, [
    chartRef,
    indicators,
    ohlcvBars,
    ohlcvData,
    removeLineSeries,
    removeOverlaySeries,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const byId = new Map(
      indicators.map((indicator) => [indicator.id, indicator]),
    );
    const rsiConfig = byId.get("rsi");
    const macdConfig = byId.get("macd");
    const rsiEnabled = Boolean(rsiConfig?.enabled);
    const macdEnabled = Boolean(macdConfig?.enabled);
    const activePanes = (rsiEnabled ? 1 : 0) + (macdEnabled ? 1 : 0);
    const layoutKey = `${rsiEnabled}-${macdEnabled}`;

    setChartHeight(400 + activePanes * 150);

    if (paneLayoutRef.current !== layoutKey) {
      removeMacdPane();
      removeRsiPane();
      paneLayoutRef.current = layoutKey;
    }

    if (ohlcvBars.length === 0) {
      if (!rsiEnabled) removeRsiPane();
      if (!macdEnabled) removeMacdPane();
      return;
    }

    const closes = ohlcvBars.map((bar) => bar.close);

    if (rsiEnabled) {
      if (!rsiPaneRef.current || !rsiSeriesRef.current) {
        rsiPaneRef.current = chart.addPane();
        rsiPaneRef.current.setHeight(150);
        rsiSeriesRef.current = chart.addSeries(
          LineSeries,
          {
            color: "#a78bfa",
            lineWidth: 1,
            priceLineVisible: false,
          },
          1,
        );
        rsiSeriesRef.current.createPriceLine({
          price: 70,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
        });
        rsiSeriesRef.current.createPriceLine({
          price: 30,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: 2,
        });
      }

      const rsiValues = rsi(closes, rsiConfig?.period ?? 14);
      const rsiData = ohlcvBars
        .map((bar, index) => ({
          time: bar.time,
          value: rsiValues[index],
        }))
        .filter((point) => !isNaN(point.value));
      rsiSeriesRef.current.setData(rsiData);
    } else {
      removeRsiPane();
    }

    if (macdEnabled) {
      const macdPaneIndex = rsiEnabled ? 2 : 1;

      if (
        !macdPaneRef.current ||
        !macdLineRef.current ||
        !macdSignalRef.current ||
        !macdHistRef.current
      ) {
        macdPaneRef.current = chart.addPane();
        macdPaneRef.current.setHeight(150);
        macdLineRef.current = chart.addSeries(
          LineSeries,
          {
            color: "#3b82f6",
            lineWidth: 1,
            priceLineVisible: false,
          },
          macdPaneIndex,
        );
        macdSignalRef.current = chart.addSeries(
          LineSeries,
          {
            color: "#f97316",
            lineWidth: 1,
            priceLineVisible: false,
          },
          macdPaneIndex,
        );
        macdHistRef.current = chart.addSeries(
          HistogramSeries,
          {
            color: "#22c55e",
            priceLineVisible: false,
          },
          macdPaneIndex,
        );
      }

      const macdValues = macd(
        closes,
        macdConfig?.fast ?? 12,
        macdConfig?.slow ?? 26,
        macdConfig?.signal ?? 9,
      );

      const macdLineData = ohlcvBars
        .map((bar, index) => ({
          time: bar.time,
          value: macdValues.macd[index],
        }))
        .filter((point) => !isNaN(point.value));
      const macdSignalData = ohlcvBars
        .map((bar, index) => ({
          time: bar.time,
          value: macdValues.signal[index],
        }))
        .filter((point) => !isNaN(point.value));
      const macdHistogramData = ohlcvBars
        .map((bar, index) => ({
          time: bar.time,
          value: macdValues.histogram[index],
          color: macdValues.histogram[index] >= 0 ? "#22c55e" : "#ef4444",
        }))
        .filter((point) => !isNaN(point.value));

      macdLineRef.current.setData(macdLineData);
      macdSignalRef.current.setData(macdSignalData);
      macdHistRef.current.setData(macdHistogramData);
    } else {
      removeMacdPane();
    }
  }, [chartRef, indicators, ohlcvBars, removeMacdPane, removeRsiPane]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || ohlcvBars.length === 0) return;

    const priceSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    priceSeries.setData(ohlcvBars);
    seriesRef.current = priceSeries;

    if (tradeMarkers.length > 0) {
      createSeriesMarkers(priceSeries, tradeMarkers);
    }

    chart.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        try {
          removeOverlaySeries();
          removeMacdPane();
          removeRsiPane();
          if (seriesRef.current) {
            chartRef.current.removeSeries(seriesRef.current);
            seriesRef.current = null;
          }
        } catch (e) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("PriceChart series cleanup error:", e);
          }
        }
      }
    };
  }, [
    chartRef,
    ohlcvBars,
    tradeMarkers,
    removeMacdPane,
    removeOverlaySeries,
    removeRsiPane,
  ]);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [chartRef]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Price Chart</h2>
        <div className="flex items-center gap-4">
          <ChartTypeToggle
            chartRef={chartRef}
            ohlcvData={ohlcvBars}
            seriesRef={seriesRef}
            supportsCandlestick={true}
            defaultType="candlestick"
          />
          <ChartDatePresets
            chartRef={chartRef}
            lastTimestamp={ohlcvData[ohlcvData.length - 1]?.timestamp}
          />
          <ChartScreenshotButton
            chartRef={chartRef}
            filename="price-chart.png"
          />
          <ChartFullscreenToggle containerRef={containerRef} />
          <button onClick={handleResetZoom} className="btn btn-ghost text-xs">
            Reset Zoom
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full"
        style={{ position: "relative", height: chartHeight }}
      />
      <p className="text-xs text-zinc-600 mt-2">
        Scroll to zoom &middot; Drag to pan &middot; Green = buy &middot; Red =
        sell
      </p>
    </div>
  );
}
