import { describe, it, expect } from "vitest";
import { TokenBucketRateLimiter } from "../rate-limiter.js";

describe("TokenBucketRateLimiter", () => {
  it("allows immediate acquisition up to maxTokens", async () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 3, refillRate: 1 });
    // Should all resolve immediately
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
  });

  it("delays acquisition when bucket is empty", async () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 1,
      refillRate: 10,
    });
    await limiter.acquire(); // drains the bucket

    const start = Date.now();
    await limiter.acquire(); // should wait for refill
    const elapsed = Date.now() - start;

    // Should have waited at least ~100ms for refill (10 tokens/sec = 100ms per token)
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("uses default config when none provided", async () => {
    const limiter = new TokenBucketRateLimiter();
    // Default: 5 tokens, should not block for 5 calls
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
  });
});
