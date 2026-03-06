"use client";

import { useState } from "react";
import type { HeatmapMatrix, HeatmapCell, OptimizationRun } from "../types";
import { scoreToColor } from "../utils/transformHeatmapData";

interface Props {
  matrix: HeatmapMatrix;
  objective: string;
  onCellClick?: (cell: HeatmapCell) => void;
}

function fmt(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

function fmtScore(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(3);
}

interface TooltipState {
  x: number;
  y: number;
  xValue: number;
  yValue: number;
  score: number | null;
  run: OptimizationRun | null;
}

export function ParameterHeatmap({ matrix, objective, onCellClick }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const { xValues, yValues, scores, cells, xParam, yParam, min, max } = matrix;

  if (xValues.length === 0 || yValues.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Not enough parameter combinations to render a heatmap.
      </div>
    );
  }

  const handleMouseEnter = (
    e: React.MouseEvent,
    row: number,
    col: number,
    score: number | null,
    run: OptimizationRun | null,
  ) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      xValue: xValues[col],
      yValue: yValues[row],
      score,
      run,
    });
  };

  const handleClick = (row: number, col: number) => {
    const score = scores[row][col];
    const run = cells[row][col];
    if (score === null || run === null) return;
    setSelectedCell({ row, col });
    onCellClick?.({ xValue: xValues[col], yValue: yValues[row], score, run });
  };

  const CELL_SIZE = Math.max(
    28,
    Math.min(52, Math.floor(480 / Math.max(xValues.length, yValues.length))),
  );
  const LABEL_W = 48;
  const LABEL_H = 36;

  return (
    <div className="relative select-none">
      <div className="overflow-auto">
        <div style={{ paddingLeft: LABEL_W, paddingTop: 0 }}>
          <div className="flex items-center" style={{ gap: 2 }}>
            <div style={{ width: LABEL_W }} />
            {xValues.map((xv) => (
              <div
                key={xv}
                className="text-center text-xs text-zinc-400 truncate"
                style={{
                  width: CELL_SIZE,
                  flexShrink: 0,
                  height: LABEL_H,
                  lineHeight: `${LABEL_H}px`,
                }}
              >
                {fmt(xv)}
              </div>
            ))}
          </div>

          {yValues.map((yv, row) => (
            <div
              key={yv}
              className="flex items-center"
              style={{ gap: 2, marginTop: 2 }}
            >
              <div
                className="text-right text-xs text-zinc-400 pr-2 truncate"
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  height: CELL_SIZE,
                  lineHeight: `${CELL_SIZE}px`,
                }}
              >
                {fmt(yv)}
              </div>
              {xValues.map((xv, col) => {
                const score = scores[row][col];
                const bg = scoreToColor(score, min, max);
                const isSelected =
                  selectedCell?.row === row && selectedCell?.col === col;
                return (
                  <div
                    key={xv}
                    className={`rounded-sm cursor-pointer transition-transform hover:scale-110 ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900" : ""}`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      flexShrink: 0,
                      backgroundColor: bg,
                      opacity: score === null ? 0.35 : 1,
                    }}
                    onMouseEnter={(e) =>
                      handleMouseEnter(e, row, col, score, cells[row][col])
                    }
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => handleClick(row, col)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 ml-2">
          <span className="text-xs text-zinc-500">Low</span>
          <div
            className="h-3 rounded"
            style={{
              width: 160,
              background: `linear-gradient(to right, ${scoreToColor(min, min, max)}, ${scoreToColor((min + max) / 2, min, max)}, ${scoreToColor(max, min, max)})`,
            }}
          />
          <span className="text-xs text-zinc-500">High</span>
          <span className="text-xs text-zinc-600 ml-2">
            ({fmtScore(min)} – {fmtScore(max)})
          </span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded bg-zinc-800 border border-zinc-600 text-xs shadow-xl"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%,-100%)",
          }}
        >
          <div className="font-mono text-zinc-200">
            {xParam}: {fmt(tooltip.xValue)} / {yParam}: {fmt(tooltip.yValue)}
          </div>
          {tooltip.score !== null ? (
            <div className="text-zinc-400">
              {objective}:{" "}
              <span className="text-white font-semibold">
                {fmtScore(tooltip.score)}
              </span>
            </div>
          ) : (
            <div className="text-zinc-600">No data</div>
          )}
        </div>
      )}
    </div>
  );
}
