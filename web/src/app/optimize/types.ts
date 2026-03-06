

export interface OptimizationRunMetrics {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  expectancy: number;
}

export interface OptimizationRun {
  params: Record<string, number>;
  score: number;
  metrics: OptimizationRunMetrics;
  finalCapital: number;
  equityCurve?: { timestamp: number; equity: number }[];
}


/**
 * 2D matrix representation of parameter sensitivity.
 * xValues and yValues are the sorted unique values for each param axis.
 * scores[row][col] maps yValues[row] x xValues[col] → score (null = no data).
 * cells[row][col] preserves the original run for click-to-load.
 */
export interface HeatmapMatrix {
  xParam: string;
  yParam: string;
  xValues: number[];
  yValues: number[];
  scores: (number | null)[][];
  cells: (OptimizationRun | null)[][];
  min: number;
  max: number;
}


export interface HeatmapCell {
  xValue: number;
  yValue: number;
  score: number;
  run: OptimizationRun;
}


export interface HeatmapConfig {
  xParam: string;
  yParam: string;
}
