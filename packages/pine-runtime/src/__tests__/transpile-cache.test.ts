import { describe, it, expect, beforeEach } from "vitest";
import {
  TranspileCache,
  getGlobalTranspileCache,
  resetGlobalTranspileCache,
} from "../transpile-cache.js";
import type { TranspiledResult } from "../transpile-cache.js";

function makeMockResult(): TranspiledResult {
  return {
    scriptHash: "",
    indicators: new Map(),
    rules: new Map(),
    inputs: new Map(),
    timestamp: Date.now(),
  };
}

describe("TranspileCache", () => {
  let cache: TranspileCache;
  let callCount: number;
  let transpileFn: (script: string) => TranspiledResult;

  beforeEach(() => {
    cache = new TranspileCache(3);
    callCount = 0;
    transpileFn = (_script: string) => {
      callCount++;
      return makeMockResult();
    };
  });

  it("calls transpile function on cache miss", () => {
    cache.getOrTranspile("script A", transpileFn);
    expect(callCount).toBe(1);
  });

  it("returns cached result on cache hit", () => {
    const first = cache.getOrTranspile("script A", transpileFn);
    const second = cache.getOrTranspile("script A", transpileFn);
    expect(callCount).toBe(1);
    expect(second).toBe(first);
  });

  it("caches different scripts separately", () => {
    cache.getOrTranspile("script A", transpileFn);
    cache.getOrTranspile("script B", transpileFn);
    expect(callCount).toBe(2);
  });

  it("evicts LRU entry when over capacity", () => {
    cache.getOrTranspile("A", transpileFn); // slot 1
    cache.getOrTranspile("B", transpileFn); // slot 2
    cache.getOrTranspile("C", transpileFn); // slot 3 (full)
    cache.getOrTranspile("D", transpileFn); // slot 4 -> evicts A
    expect(callCount).toBe(4);

    // A should be evicted — re-transpile required
    cache.getOrTranspile("A", transpileFn);
    expect(callCount).toBe(5);

    // C and D should still be cached
    cache.getOrTranspile("C", transpileFn);
    cache.getOrTranspile("D", transpileFn);
    expect(callCount).toBe(5);
  });

  it("refreshes LRU position on cache hit", () => {
    cache.getOrTranspile("A", transpileFn);
    cache.getOrTranspile("B", transpileFn);
    cache.getOrTranspile("C", transpileFn);

    // Access A to make it most recently used
    cache.getOrTranspile("A", transpileFn);
    expect(callCount).toBe(3);

    // Add D — should evict B (oldest), not A
    cache.getOrTranspile("D", transpileFn);
    expect(callCount).toBe(4);

    // A should still be cached
    cache.getOrTranspile("A", transpileFn);
    expect(callCount).toBe(4);

    // B should be evicted
    cache.getOrTranspile("B", transpileFn);
    expect(callCount).toBe(5);
  });

  it("sets scriptHash on transpiled result", () => {
    const result = cache.getOrTranspile("test script", transpileFn);
    expect(result.scriptHash).toBeTruthy();
    expect(typeof result.scriptHash).toBe("string");
  });

  it("clear removes all entries", () => {
    cache.getOrTranspile("A", transpileFn);
    cache.getOrTranspile("B", transpileFn);
    cache.clear();
    expect(cache.getStats().size).toBe(0);

    cache.getOrTranspile("A", transpileFn);
    expect(callCount).toBe(3); // had to re-transpile
  });

  it("getStats returns correct size and maxSize", () => {
    expect(cache.getStats()).toEqual({ size: 0, maxSize: 3 });
    cache.getOrTranspile("A", transpileFn);
    expect(cache.getStats()).toEqual({ size: 1, maxSize: 3 });
  });
});

describe("global transpile cache", () => {
  beforeEach(() => {
    resetGlobalTranspileCache();
  });

  it("returns the same instance on repeated calls", () => {
    const a = getGlobalTranspileCache();
    const b = getGlobalTranspileCache();
    expect(a).toBe(b);
  });

  it("resetGlobalTranspileCache creates a fresh instance", () => {
    const first = getGlobalTranspileCache();
    first.getOrTranspile("test", () => makeMockResult());
    expect(first.getStats().size).toBe(1);

    resetGlobalTranspileCache();
    const second = getGlobalTranspileCache();
    expect(second.getStats().size).toBe(0);
    expect(second).not.toBe(first);
  });
});
