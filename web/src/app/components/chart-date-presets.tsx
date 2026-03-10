"use client";

import { useState, useCallback, type MutableRefObject } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";

type Preset = "1M" | "3M" | "6M" | "YTD" | "1Y" | "All";

interface Props {
  chartRef: MutableRefObject<IChartApi | null>;
  lastTimestamp?: number; // last data point timestamp in ms
}

const PRESETS: Preset[] = ["1M", "3M", "6M", "YTD", "1Y", "All"];

function monthsAgo(months: number, fromMs: number): UTCTimestamp {
  const d = new Date(fromMs);
  d.setMonth(d.getMonth() - months);
  return Math.floor(d.getTime() / 1000) as UTCTimestamp;
}

function startOfYear(fromMs: number): UTCTimestamp {
  const d = new Date(fromMs);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000) as UTCTimestamp;
}

export function ChartDatePresets({ chartRef, lastTimestamp }: Props) {
  const [active, setActive] = useState<Preset | null>(null);

  const handlePreset = useCallback(
    (preset: Preset) => {
      const chart = chartRef.current;
      if (!chart) return;
      setActive(preset);

      if (preset === "All") {
        chart.timeScale().fitContent();
        return;
      }

      const toMs = lastTimestamp ?? Date.now();
      const toTs = Math.floor(toMs / 1000) as UTCTimestamp;
      let fromTs: UTCTimestamp;

      switch (preset) {
        case "1M":
          fromTs = monthsAgo(1, toMs);
          break;
        case "3M":
          fromTs = monthsAgo(3, toMs);
          break;
        case "6M":
          fromTs = monthsAgo(6, toMs);
          break;
        case "YTD":
          fromTs = startOfYear(toMs);
          break;
        case "1Y":
          fromTs = monthsAgo(12, toMs);
          break;
      }

      chart.timeScale().setVisibleRange({ from: fromTs, to: toTs });
    },
    [chartRef, lastTimestamp],
  );

  return (
    <div className="flex items-center gap-1">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => handlePreset(preset)}
          className={`btn btn-ghost text-xs px-2 py-0.5 ${
            active === preset ? "text-white bg-zinc-700" : "text-zinc-400"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
