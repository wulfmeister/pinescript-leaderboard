"use client";

import { useCallback, type MutableRefObject } from "react";
import type { IChartApi } from "lightweight-charts";

interface Props {
  chartRef: MutableRefObject<IChartApi | null>;
  filename?: string;
}

export function ChartScreenshotButton({
  chartRef,
  filename = "chart-screenshot.png",
}: Props) {
  const handleScreenshot = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [chartRef, filename]);

  return (
    <button
      onClick={handleScreenshot}
      className="btn btn-ghost text-xs"
      title="Download chart as PNG"
    >
      ↓ PNG
    </button>
  );
}
