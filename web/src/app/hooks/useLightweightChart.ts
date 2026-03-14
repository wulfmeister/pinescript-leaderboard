"use client";

import { useEffect, useRef, MutableRefObject, RefObject } from "react";
import {
  createChart,
  type IChartApi,
  type DeepPartial,
  type ChartOptions,
  ColorType,
  type UTCTimestamp,
  type MouseEventParams,
} from "lightweight-charts";

/**
 * Dark theme defaults for Lightweight Charts
 */
const DARK_THEME_DEFAULTS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: "#18181b" },
    textColor: "#a1a1aa",
  },
  grid: {
    vertLines: { color: "rgba(63,63,70,0.4)" },
    horzLines: { color: "rgba(63,63,70,0.4)" },
  },
};

/**
 * Hook to create and manage a Lightweight Charts instance.
 * Options are captured via ref so callers don't need to memoize them --
 * an unstable options reference will NOT cause the chart to be destroyed
 * and recreated on every render.
 *
 * @param containerRef - Reference to the container DOM element
 * @param options - Optional chart configuration (merged with dark theme defaults)
 * @returns Reference to the IChartApi instance
 */
export function useLightweightChart(
  containerRef: RefObject<HTMLDivElement | null>,
  options?: DeepPartial<ChartOptions>,
): MutableRefObject<IChartApi | null> {
  const chartRef = useRef<IChartApi | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Create chart once when container mounts; options are read from ref
  // so they don't need to be stable across renders.
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const chart = createChart(containerRef.current, {
      autoSize: true,
      ...DARK_THEME_DEFAULTS,
      ...optionsRef.current,
    });

    chartRef.current = chart;
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [containerRef]);
  return chartRef;
}

/**
 * Hook to manage a tooltip that follows the crosshair
 * @param chartRef - Reference to the IChartApi instance
 * @param containerRef - Reference to the container DOM element
 * @param formatValue - Function to format the value for display
 */
export function useChartTooltip(
  chartRef: MutableRefObject<IChartApi | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  formatValue: (val: number) => string,
): void {
  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;

    if (!chart || !container) {
      return;
    }

    // Create tooltip element
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.backgroundColor = "#18181b";
    tooltip.style.color = "#e4e4e7";
    tooltip.style.border = "1px solid #3f3f46";
    tooltip.style.borderRadius = "4px";
    tooltip.style.padding = "4px 8px";
    tooltip.style.fontSize = "12px";
    tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    tooltip.style.pointerEvents = "none";
    tooltip.style.display = "none";
    tooltip.style.zIndex = "1000";

    container.appendChild(tooltip);

    // Named handler for proper unsubscription
    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none";
        return;
      }

      let value: number | undefined;
      for (const [, data] of param.seriesData) {
        if (data && typeof data === "object") {
          const point = data as unknown as Record<string, unknown>;
          if (typeof point.value === "number") {
            value = point.value;
          } else if (typeof point.close === "number") {
            value = point.close;
          }
          if (value !== undefined) break;
        }
      }

      if (value !== undefined) {
        tooltip.textContent = formatValue(value);
        tooltip.style.display = "block";

        let x = param.point.x + 10;
        let y = param.point.y + 10;

        // Clamp to container bounds
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;

        if (x + tw > cw) x = param.point.x - tw - 10;
        if (y + th > ch) y = param.point.y - th - 10;

        tooltip.style.left = `${Math.max(0, x)}px`;
        tooltip.style.top = `${Math.max(0, y)}px`;
      } else {
        tooltip.style.display = "none";
      }
    };

    // Subscribe to crosshair movement
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Cleanup
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    };
  }, [chartRef, containerRef, formatValue]);
}

/**
 * Utility to convert millisecond timestamps to Lightweight Charts UTCTimestamp format
 * @param msTimestamp - Timestamp in milliseconds
 * @returns UTCTimestamp (seconds since epoch)
 */
export function toUTCTimestamp(msTimestamp: number): UTCTimestamp {
  return Math.floor(msTimestamp / 1000) as UTCTimestamp;
}
