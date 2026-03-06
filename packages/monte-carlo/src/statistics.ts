/**
 * Calculate a specific percentile from a sorted array of values
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Build a PercentileDistribution from an array of values
 */
export function buildDistribution(values: number[]): {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0, mean: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

  return {
    p5: percentile(sorted, 5),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    mean,
    stdDev: Math.sqrt(variance),
  };
}

/**
 * Fisher-Yates shuffle (in-place, uses Math.random)
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create a seeded PRNG (xoshiro128**)
 */
export function createSeededRandom(seed: number): () => number {
  let s0 = seed | 0;
  let s1 = (seed * 1103515245 + 12345) | 0;
  let s2 = (seed * 214013 + 2531011) | 0;
  let s3 = (seed * 48271) | 0;

  // Ensure non-zero state
  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0) {
    s0 = 1;
  }

  return function (): number {
    const result = (rotl(s1 * 5, 7) * 9) >>> 0;
    const t = s1 << 9;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);

    return result / 4294967296; // 2^32
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Fisher-Yates shuffle with seeded PRNG
 */
export function seededShuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
