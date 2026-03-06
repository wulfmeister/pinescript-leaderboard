import { createHash } from "crypto";

/**
 * Result of transpiling a PineScript strategy
 */
export interface TranspiledResult {
  scriptHash: string;
  indicators: Map<string, unknown>;
  rules: Map<string, unknown>;
  inputs: Map<string, number>;
  timestamp: number;
}

/**
 * LRU cache for PineScript transpilation results.
 * Prevents re-transpiling the same script multiple times during optimization.
 *
 * Used by: StrategyOptimizer (grid search calls executeStrategy() hundreds of times
 * with the same script but different parameter overrides)
 */
export class TranspileCache {
  private cache: Map<string, TranspiledResult> = new Map();
  private accessOrder: string[] = []; // Track LRU order
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Get or transpile a script.
   * Returns cached result if exists, otherwise returns null (caller must transpile).
   */
  getOrTranspile(
    script: string,
    transpileFn: (script: string) => TranspiledResult,
  ): TranspiledResult {
    const hash = this.hashScript(script);

    // Cache hit: move to end (most recently used)
    if (this.cache.has(hash)) {
      this.accessOrder = this.accessOrder.filter((h) => h !== hash);
      this.accessOrder.push(hash);
      return this.cache.get(hash)!;
    }

    // Cache miss: transpile and store
    const result = transpileFn(script);
    result.scriptHash = hash;

    this.cache.set(hash, result);
    this.accessOrder.push(hash);

    // LRU eviction: remove oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    return result;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Hash script content for cache key
   */
  private hashScript(script: string): string {
    return createHash("sha256").update(script).digest("hex");
  }
}

/**
 * Global singleton cache instance
 */
let globalCache: TranspileCache | null = null;

/**
 * Get or create the global transpile cache
 */
export function getGlobalTranspileCache(maxSize?: number): TranspileCache {
  if (!globalCache) {
    globalCache = new TranspileCache(maxSize);
  }
  return globalCache;
}

/**
 * Reset the global cache (useful for testing)
 */
export function resetGlobalTranspileCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
  globalCache = null;
}
