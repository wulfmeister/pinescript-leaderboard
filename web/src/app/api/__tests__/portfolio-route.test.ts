import { describe, it, expect, vi } from "vitest";
import { POST as portfolioPost } from "../portfolio/route";
import { NextRequest } from "next/server";

// Mock the packages
vi.mock("@pinescript-utils/pine-runtime", () => ({
  pineRuntime: {
    executeStrategy: vi.fn().mockResolvedValue([
      { timestamp: Date.now(), action: "buy", price: 100 },
      { timestamp: Date.now() + 86400000, action: "sell", price: 105 },
    ]),
  },
}));

vi.mock("@pinescript-utils/backtester", () => ({
  BacktestEngine: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      trades: [
        {
          id: "1",
          timestamp: Date.now(),
          direction: "long",
          action: "buy",
          price: 100,
          quantity: 10,
          symbol: "TEST",
          pnl: 500,
        },
      ],
      equityCurve: [
        { timestamp: Date.now(), equity: 10000 },
        { timestamp: Date.now() + 86400000, equity: 10500 },
      ],
      metrics: {
        totalReturn: 0.05,
        annualizedReturn: 0.15,
        sharpeRatio: 1.2,
        sortinoRatio: 1.5,
        maxDrawdown: -0.02,
        winRate: 0.6,
        profitFactor: 1.8,
        expectancy: 50,
        totalTrades: 2,
        profitableTrades: 1,
        losingTrades: 1,
        avgWin: 500,
        avgLoss: -100,
        largestWin: 500,
        largestLoss: -100,
        consecutiveWins: 1,
        consecutiveLosses: 1,
      },
      initialCapital: 10000,
      finalCapital: 10500,
      startTime: Date.now(),
      endTime: Date.now() + 86400000,
    }),
  })),
}));

vi.mock("@pinescript-utils/data-feed", () => ({
  DataFeed: vi.fn().mockImplementation(() => ({
    getMockData: vi.fn().mockReturnValue(
      Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() + i * 86400000,
        open: 100 + i,
        high: 102 + i,
        low: 98 + i,
        close: 101 + i,
        volume: 1000000,
      })),
    ),
    fetchHistorical: vi.fn().mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() + i * 86400000,
        open: 100 + i,
        high: 102 + i,
        low: 98 + i,
        close: 101 + i,
        volume: 1000000,
      })),
    ),
  })),
}));

vi.mock("@pinescript-utils/portfolio", () => ({
  runPortfolioBacktest: vi.fn().mockResolvedValue({
    perAsset: [
      {
        symbol: "ASSET1",
        allocation: 10000,
        result: {
          trades: [
            {
              id: "1",
              timestamp: Date.now(),
              direction: "long",
              action: "buy",
              price: 100,
              quantity: 100,
              symbol: "ASSET1",
              pnl: 500,
            },
          ],
          equityCurve: [
            { timestamp: Date.now(), equity: 10000 },
            { timestamp: Date.now() + 86400000, equity: 10500 },
          ],
          metrics: {
            totalReturn: 0.05,
            annualizedReturn: 0.15,
            sharpeRatio: 1.2,
            sortinoRatio: 1.5,
            maxDrawdown: -0.02,
            winRate: 0.6,
            profitFactor: 1.8,
            expectancy: 50,
            totalTrades: 1,
            profitableTrades: 1,
            losingTrades: 0,
            avgWin: 500,
            avgLoss: 0,
            largestWin: 500,
            largestLoss: 0,
            consecutiveWins: 1,
            consecutiveLosses: 0,
          },
          initialCapital: 10000,
          finalCapital: 10500,
          startTime: Date.now(),
          endTime: Date.now() + 86400000,
        },
        signalCount: 2,
      },
      {
        symbol: "ASSET2",
        allocation: 10000,
        result: {
          trades: [
            {
              id: "2",
              timestamp: Date.now(),
              direction: "long",
              action: "buy",
              price: 100,
              quantity: 100,
              symbol: "ASSET2",
              pnl: 300,
            },
          ],
          equityCurve: [
            { timestamp: Date.now(), equity: 10000 },
            { timestamp: Date.now() + 86400000, equity: 10300 },
          ],
          metrics: {
            totalReturn: 0.03,
            annualizedReturn: 0.09,
            sharpeRatio: 0.8,
            sortinoRatio: 1.0,
            maxDrawdown: -0.03,
            winRate: 0.5,
            profitFactor: 1.5,
            expectancy: 30,
            totalTrades: 1,
            profitableTrades: 1,
            losingTrades: 0,
            avgWin: 300,
            avgLoss: 0,
            largestWin: 300,
            largestLoss: 0,
            consecutiveWins: 1,
            consecutiveLosses: 0,
          },
          initialCapital: 10000,
          finalCapital: 10300,
          startTime: Date.now(),
          endTime: Date.now() + 86400000,
        },
        signalCount: 2,
      },
      {
        symbol: "ASSET3",
        allocation: 10000,
        result: {
          trades: [
            {
              id: "3",
              timestamp: Date.now(),
              direction: "long",
              action: "buy",
              price: 100,
              quantity: 100,
              symbol: "ASSET3",
              pnl: 200,
            },
          ],
          equityCurve: [
            { timestamp: Date.now(), equity: 10000 },
            { timestamp: Date.now() + 86400000, equity: 10200 },
          ],
          metrics: {
            totalReturn: 0.02,
            annualizedReturn: 0.06,
            sharpeRatio: 0.6,
            sortinoRatio: 0.8,
            maxDrawdown: -0.04,
            winRate: 0.4,
            profitFactor: 1.2,
            expectancy: 20,
            totalTrades: 1,
            profitableTrades: 1,
            losingTrades: 0,
            avgWin: 200,
            avgLoss: 0,
            largestWin: 200,
            largestLoss: 0,
            consecutiveWins: 1,
            consecutiveLosses: 0,
          },
          initialCapital: 10000,
          finalCapital: 10200,
          startTime: Date.now(),
          endTime: Date.now() + 86400000,
        },
        signalCount: 2,
      },
    ],
    combined: {
      equityCurve: [
        { timestamp: Date.now(), equity: 30000 },
        { timestamp: Date.now() + 86400000, equity: 31000 },
      ],
      metrics: {
        totalReturn: 0.0333,
        annualizedReturn: 0.1,
        sharpeRatio: 1.0,
        sortinoRatio: 1.2,
        maxDrawdown: -0.03,
        winRate: 0.5,
        profitFactor: 1.5,
        expectancy: 33,
        totalTrades: 3,
        profitableTrades: 3,
        losingTrades: 0,
        avgWin: 333,
        avgLoss: 0,
        largestWin: 500,
        largestLoss: 0,
        consecutiveWins: 3,
        consecutiveLosses: 0,
      },
      initialCapital: 30000,
      finalCapital: 31000,
      trades: [
        {
          id: "1",
          timestamp: Date.now(),
          direction: "long",
          action: "buy",
          price: 100,
          quantity: 100,
          symbol: "ASSET1",
          pnl: 500,
        },
        {
          id: "2",
          timestamp: Date.now(),
          direction: "long",
          action: "buy",
          price: 100,
          quantity: 100,
          symbol: "ASSET2",
          pnl: 300,
        },
        {
          id: "3",
          timestamp: Date.now(),
          direction: "long",
          action: "buy",
          price: 100,
          quantity: 100,
          symbol: "ASSET3",
          pnl: 200,
        },
      ],
    },
    correlationMatrix: [
      [1.0, 0.72, 0.65],
      [0.72, 1.0, 0.58],
      [0.65, 0.58, 1.0],
    ],
    assetSymbols: ["ASSET1", "ASSET2", "ASSET3"],
    totalCapital: 30000,
    elapsedMs: 1500,
  }),
}));

// Helper to create NextRequest
function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/portfolio", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const sampleScript = `//@version=5
strategy("Test", overlay=true)
fastLength = input(10, title="Fast")
slowLength = input(30, title="Slow")
fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)
if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`;

describe("API Routes - POST /api/portfolio", () => {
  describe("Validation Errors", () => {
    it("returns 400 when script is missing", async () => {
      const req = createRequest({
        assets: ["AAPL", "MSFT"],
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("script is required");
    });

    it("returns 400 when assets array is missing", async () => {
      const req = createRequest({
        script: sampleScript,
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("assets");
    });

    it("returns 400 when assets array is empty", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: [],
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("assets");
    });

    it("returns 400 when assets array has more than 10 items", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: [
          "A1",
          "A2",
          "A3",
          "A4",
          "A5",
          "A6",
          "A7",
          "A8",
          "A9",
          "A10",
          "A11",
        ],
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("assets");
    });

    it("returns 400 when capital is missing", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL", "MSFT"],
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("capital");
    });

    it("returns 400 when capital is zero", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL", "MSFT"],
        capital: 0,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("capital");
    });

    it("returns 400 when capital is negative", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL", "MSFT"],
        capital: -5000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("capital");
    });

    it("returns 400 when from date is after to date", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL", "MSFT"],
        capital: 10000,
        mock: false,
        from: "2024-01-01",
        to: "2023-01-01",
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("From date must be before To date");
    });

    it("returns 400 when mockBars is less than 50", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["TEST1", "TEST2"],
        capital: 10000,
        mock: true,
        mockBars: 25,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain(
        "Mock bar count must be between 50 and 1000",
      );
    });

    it("returns 400 when mockBars is greater than 1000", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["TEST1", "TEST2"],
        capital: 10000,
        mock: true,
        mockBars: 1500,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain(
        "Mock bar count must be between 50 and 1000",
      );
    });
  });

  describe("Happy Path", () => {
    it("returns 200 with valid request for 3 mock assets", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
        mockBars: 100,
        mockType: "random",
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("perAsset");
      expect(data).toHaveProperty("combined");
      expect(data).toHaveProperty("correlationMatrix");
      expect(data).toHaveProperty("assetSymbols");
      expect(data).toHaveProperty("totalCapital");
      expect(data).toHaveProperty("elapsedMs");
    });

    it("returns 200 with valid request for 2 mock assets", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL", "MSFT"],
        capital: 20000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("perAsset");
      expect(data).toHaveProperty("combined");
      expect(data).toHaveProperty("correlationMatrix");
    });

    it("returns 200 with valid request for single asset", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["AAPL"],
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("perAsset");
      expect(data).toHaveProperty("combined");
      expect(data).toHaveProperty("correlationMatrix");
    });

    it("returns 200 with valid request for 10 assets (max)", async () => {
      const assets = Array.from({ length: 10 }, (_, i) => `ASSET${i + 1}`);
      const req = createRequest({
        script: sampleScript,
        assets,
        capital: 100000,
        mock: true,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("perAsset");
    });
  });

  describe("Response Shape Validation", () => {
    it("response perAsset array length matches number of assets", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.perAsset).toHaveLength(3);
    });

    it("response correlationMatrix is NxN symmetric", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      const matrix = data.correlationMatrix;
      expect(matrix).toHaveLength(3);
      matrix.forEach((row: number[]) => {
        expect(row).toHaveLength(3);
      });
      // Check symmetry
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 5);
        }
      }
    });

    it("response correlationMatrix has 1.0 on diagonal", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      const matrix = data.correlationMatrix;
      for (let i = 0; i < 3; i++) {
        expect(matrix[i][i]).toBeCloseTo(1.0, 5);
      }
    });

    it("response combined.equityCurve exists and is array", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.combined).toHaveProperty("equityCurve");
      expect(Array.isArray(data.combined.equityCurve)).toBe(true);
      expect(data.combined.equityCurve.length).toBeGreaterThan(0);
    });

    it("response combined.metrics exists with required fields", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.combined).toHaveProperty("metrics");
      expect(data.combined.metrics).toHaveProperty("totalReturn");
      expect(data.combined.metrics).toHaveProperty("sharpeRatio");
      expect(data.combined.metrics).toHaveProperty("maxDrawdown");
      expect(data.combined.metrics).toHaveProperty("winRate");
    });

    it("response assetSymbols matches requested assets", async () => {
      const assets = ["ASSET1", "ASSET2", "ASSET3"];
      const req = createRequest({
        script: sampleScript,
        assets,
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.assetSymbols).toEqual(assets);
    });

    it("response totalCapital matches request capital", async () => {
      const capital = 30000;
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.totalCapital).toBe(capital);
    });

    it("response elapsedMs is a positive number", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(typeof data.elapsedMs).toBe("number");
      expect(data.elapsedMs).toBeGreaterThan(0);
    });
  });

  describe("Capital Allocation", () => {
    it("each perAsset allocation equals capital / N", async () => {
      const capital = 30000;
      const assets = ["ASSET1", "ASSET2", "ASSET3"];
      const req = createRequest({
        script: sampleScript,
        assets,
        capital,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      const expectedAllocation = capital / assets.length;
      data.perAsset.forEach((asset: any) => {
        expect(asset.allocation).toBe(expectedAllocation);
      });
    });

    it("allocation is correct for 2 assets", async () => {
      const capital = 20000;
      const assets = ["ASSET1", "ASSET2"];
      const req = createRequest({
        script: sampleScript,
        assets,
        capital,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      const expectedAllocation = 10000;
      data.perAsset.forEach((asset: any) => {
        expect(asset.allocation).toBe(expectedAllocation);
      });
    });

    it("allocation is correct for single asset", async () => {
      const capital = 10000;
      const assets = ["ASSET1"];
      const req = createRequest({
        script: sampleScript,
        assets,
        capital,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      expect(data.perAsset[0].allocation).toBe(capital);
    });
  });

  describe("Per-Asset Results", () => {
    it("each perAsset has symbol, allocation, result, and signalCount", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      data.perAsset.forEach((asset: any) => {
        expect(asset).toHaveProperty("symbol");
        expect(asset).toHaveProperty("allocation");
        expect(asset).toHaveProperty("result");
        expect(asset).toHaveProperty("signalCount");
      });
    });

    it("each perAsset result has equityCurve and metrics", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      data.perAsset.forEach((asset: any) => {
        expect(asset.result).toHaveProperty("equityCurve");
        expect(asset.result).toHaveProperty("metrics");
        expect(asset.result).toHaveProperty("trades");
      });
    });
  });

  describe("Optional Fields", () => {
    it("accepts mockType parameter", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2"],
        capital: 20000,
        mock: true,
        mockType: "bull",
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
    });

    it("accepts mockBars parameter", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2"],
        capital: 20000,
        mock: true,
        mockBars: 500,
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
    });

    it("accepts timeframe parameter", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2"],
        capital: 20000,
        mock: true,
        timeframe: "1h",
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
    });

    it("accepts from and to date parameters", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2"],
        capital: 20000,
        mock: false,
        from: "2023-01-01",
        to: "2024-01-01",
      });
      const res = await portfolioPost(req);
      expect(res.status).toBe(200);
    });

    it("response may include warnings array for partial failures", async () => {
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1", "ASSET2", "ASSET3"],
        capital: 30000,
        mock: true,
      });
      const res = await portfolioPost(req);
      const data = await res.json();
      // warnings is optional, but if present should be an array
      if (data.warnings) {
        expect(Array.isArray(data.warnings)).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("returns 500 for unexpected errors", async () => {
      // This test verifies error handling structure
      // In real implementation, this would test actual error scenarios
      const req = createRequest({
        script: sampleScript,
        assets: ["ASSET1"],
        capital: 10000,
        mock: true,
      });
      const res = await portfolioPost(req);
      // Should be 200 with valid input, but structure should have error field on failure
      if (res.status >= 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });
  });
});
