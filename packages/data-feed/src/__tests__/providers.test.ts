import { describe, it, expect } from "vitest";
import { MockDataProvider, DataFeed } from "../providers.js";

describe("MockDataProvider", () => {
  const provider = new MockDataProvider();

  describe("generateRandomWalk", () => {
    it("generates the correct number of bars", () => {
      const data = provider.generateRandomWalk(100, 50);
      expect(data).toHaveLength(50);
    });

    it("each bar has valid OHLCV fields", () => {
      const data = provider.generateRandomWalk(100, 20);
      for (const bar of data) {
        expect(bar).toHaveProperty("timestamp");
        expect(bar).toHaveProperty("open");
        expect(bar).toHaveProperty("high");
        expect(bar).toHaveProperty("low");
        expect(bar).toHaveProperty("close");
        expect(bar).toHaveProperty("volume");
        expect(typeof bar.timestamp).toBe("number");
        expect(typeof bar.open).toBe("number");
        expect(bar.high).toBeGreaterThanOrEqual(bar.low);
        expect(bar.volume).toBeGreaterThan(0);
      }
    });

    it("timestamps are in ascending order", () => {
      const data = provider.generateRandomWalk(100, 100);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].timestamp).toBeGreaterThan(data[i - 1].timestamp);
      }
    });

    it("starts near the given start price", () => {
      const data = provider.generateRandomWalk(200, 10);
      expect(data[0].open).toBeCloseTo(200, -1);
    });

    it("prices stay positive with default volatility", () => {
      const data = provider.generateRandomWalk(100, 500);
      for (const bar of data) {
        expect(bar.close).toBeGreaterThan(0);
        expect(bar.open).toBeGreaterThan(0);
      }
    });

    it("respects custom volatility", () => {
      // Very low volatility → prices stay close to start
      const data = provider.generateRandomWalk(100, 100, 0.001);
      const closes = data.map((d) => d.close);
      const minClose = Math.min(...closes);
      const maxClose = Math.max(...closes);
      expect(maxClose - minClose).toBeLessThan(10); // tight range
    });
  });

  describe("generateTrend", () => {
    it("generates the correct number of bars", () => {
      const data = provider.generateTrend(100, 50, 0.5);
      expect(data).toHaveLength(50);
    });

    it("bull trend ends higher than it starts", () => {
      const data = provider.generateTrend(100, 200, 0.5, 0.005);
      expect(data[data.length - 1].close).toBeGreaterThan(data[0].open);
    });

    it("bear trend ends lower than it starts", () => {
      const data = provider.generateTrend(100, 200, -0.3, 0.005);
      expect(data[data.length - 1].close).toBeLessThan(data[0].open);
    });

    it("timestamps are ascending", () => {
      const data = provider.generateTrend(100, 50, 0.2);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].timestamp).toBeGreaterThan(data[i - 1].timestamp);
      }
    });
  });
});

describe("DataFeed", () => {
  const feed = new DataFeed();

  describe("getMockData", () => {
    it("generates random data", () => {
      const data = feed.getMockData("random", 100, 100);
      expect(data).toHaveLength(100);
    });

    it("generates bull data", () => {
      const data = feed.getMockData("bull", 200, 100);
      expect(data).toHaveLength(200);
      // Bull data should trend upward
      expect(data[data.length - 1].close).toBeGreaterThan(data[0].open);
    });

    it("generates bear data", () => {
      const data = feed.getMockData("bear", 200, 100);
      expect(data).toHaveLength(200);
      // Bear data should trend downward
      expect(data[data.length - 1].close).toBeLessThan(data[0].open);
    });

    it("uses default count when not specified", () => {
      const data = feed.getMockData("random");
      expect(data).toHaveLength(252);
    });

    it("uses default start price when not specified", () => {
      const data = feed.getMockData("random", 10);
      // First bar open should be near 100 (default)
      expect(data[0].open).toBeCloseTo(100, -1);
    });
  });
});
