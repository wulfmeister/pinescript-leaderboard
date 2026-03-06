import type { OptimizationRun, HeatmapMatrix } from "../types";

export function extractParameterValues(
  runs: OptimizationRun[],
  paramName: string,
): number[] {
  const seen = new Set<number>();
  for (const run of runs) {
    const v = run.params[paramName];
    if (v !== undefined) seen.add(v);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

export function pivotToMatrix(
  runs: OptimizationRun[],
  xParam: string,
  yParam: string,
): HeatmapMatrix {
  const xValues = extractParameterValues(runs, xParam);
  const yValues = extractParameterValues(runs, yParam);

  const xIndex = new Map(xValues.map((v, i) => [v, i]));
  const yIndex = new Map(yValues.map((v, i) => [v, i]));

  const scores: (number | null)[][] = yValues.map(() =>
    xValues.map(() => null),
  );
  const cells: (OptimizationRun | null)[][] = yValues.map(() =>
    xValues.map(() => null),
  );

  for (const run of runs) {
    const xv = run.params[xParam];
    const yv = run.params[yParam];
    if (xv === undefined || yv === undefined) continue;
    const col = xIndex.get(xv);
    const row = yIndex.get(yv);
    if (col === undefined || row === undefined) continue;
    const existing = scores[row][col];
    if (existing === null || run.score > existing) {
      scores[row][col] = run.score;
      cells[row][col] = run;
    }
  }

  const allScores = scores.flat().filter((s): s is number => s !== null);
  const min = allScores.length > 0 ? Math.min(...allScores) : 0;
  const max = allScores.length > 0 ? Math.max(...allScores) : 1;

  return { xParam, yParam, xValues, yValues, scores, cells, min, max };
}

export function getScoreRange(matrix: HeatmapMatrix): {
  min: number;
  max: number;
} {
  return { min: matrix.min, max: matrix.max };
}

export function scoreToColor(
  score: number | null,
  min: number,
  max: number,
): string {
  if (score === null) return "rgba(63,63,70,0.5)";

  const range = max - min;
  const t = range === 0 ? 0.5 : Math.max(0, Math.min(1, (score - min) / range));

  if (t < 0.5) {
    const u = t * 2;
    const r = Math.round(220 + (250 - 220) * u);
    const g = Math.round(38 + (204 - 38) * u);
    const b = Math.round(38 + (21 - 38) * u);
    return `rgb(${r},${g},${b})`;
  } else {
    const u = (t - 0.5) * 2;
    const r = Math.round(250 - (250 - 34) * u);
    const g = Math.round(204 - (204 - 197) * u);
    const b = Math.round(21 + (94 - 21) * u);
    return `rgb(${r},${g},${b})`;
  }
}
