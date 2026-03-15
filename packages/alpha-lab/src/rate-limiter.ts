/**
 * Token-bucket rate limiter for Venice API calls.
 *
 * Ensures we don't exceed API rate limits during long-running
 * evolution/synthesis jobs that may make dozens of LLM calls.
 * Supports concurrent callers — each awaits acquire() before
 * making an API call.
 */

export interface RateLimiterConfig {
  /** Maximum concurrent tokens available. */
  maxTokens: number;
  /** How many tokens are restored per second. */
  refillRate: number;
}

export const DEFAULT_RATE_LIMITER: RateLimiterConfig = {
  maxTokens: 5,
  refillRate: 2,
};

export class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private waitQueue: (() => void)[] = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    const cfg = { ...DEFAULT_RATE_LIMITER, ...config };
    this.maxTokens = cfg.maxTokens;
    this.refillRate = cfg.refillRate;
    this.tokens = cfg.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Wait until a token is available, then consume it.
   * If tokens are available immediately, resolves instantly.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // No tokens available — queue the caller and wait
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
      // Schedule a check for when the next token should arrive
      const waitMs = Math.ceil(1000 / this.refillRate);
      setTimeout(() => this.drainQueue(), waitMs);
    });
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /** Try to resolve queued callers if tokens have become available. */
  private drainQueue(): void {
    this.refill();
    while (this.waitQueue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const resolve = this.waitQueue.shift()!;
      resolve();
    }

    // If there are still waiters, schedule another drain
    if (this.waitQueue.length > 0) {
      const waitMs = Math.ceil(1000 / this.refillRate);
      setTimeout(() => this.drainQueue(), waitMs);
    }
  }
}
