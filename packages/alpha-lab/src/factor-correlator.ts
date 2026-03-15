/**
 * Factor correlation analysis and pruning.
 *
 * Computes pairwise Pearson correlations between factor position series,
 * then prunes redundant (highly correlated) factors using a greedy
 * strategy that keeps the higher-scoring factor in each correlated pair.
 */

import { average, standardDeviation } from "@pinescript-utils/core";

/**
 * Compute Pearson correlation between two numeric arrays.
 * Returns 0 if either array is too short or has zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = average(xSlice);
  const meanY = average(ySlice);
  const stdX = standardDeviation(xSlice);
  const stdY = standardDeviation(ySlice);

  if (stdX === 0 || stdY === 0) return 0;

  let covariance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xSlice[i] - meanX) * (ySlice[i] - meanY);
  }
  covariance /= n;

  const corr = covariance / (stdX * stdY);
  return Math.max(-1, Math.min(1, corr));
}

/**
 * Build a full pairwise correlation matrix from named factor position series.
 */
export function calculateFactorCorrelations(
  factors: { name: string; positions: number[] }[],
): { matrix: number[][]; names: string[] } {
  const n = factors.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  const names = factors.map((f) => f.name);

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const corr = pearsonCorrelation(
        factors[i].positions,
        factors[j].positions,
      );
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { matrix, names };
}

/**
 * Greedy pruning of correlated factors.
 *
 * Strategy: sort factors by score descending (best first).
 * For each factor, check all subsequent factors. If the absolute
 * correlation exceeds `threshold`, mark the lower-scored factor
 * as pruned.
 *
 * @returns A copy of the input factors with `pruned` and `prunedReason` set.
 */
export function pruneCorrelatedFactors<
  T extends { name: string; positions: number[]; score: number },
>(
  factors: T[],
  threshold: number,
): (T & { pruned: boolean; prunedReason?: string })[] {
  // Sort by score descending — best factors are kept
  const sorted = [...factors]
    .map((f) => ({
      ...f,
      pruned: false,
      prunedReason: undefined as string | undefined,
    }))
    .sort((a, b) => b.score - a.score);

  const kept = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].pruned) continue;
    kept.add(i);

    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].pruned) continue;

      const corr = Math.abs(
        pearsonCorrelation(sorted[i].positions, sorted[j].positions),
      );

      if (corr > threshold) {
        sorted[j].pruned = true;
        sorted[j].prunedReason =
          `correlated ${corr.toFixed(2)} with ${sorted[i].name}`;
      }
    }
  }

  return sorted;
}
