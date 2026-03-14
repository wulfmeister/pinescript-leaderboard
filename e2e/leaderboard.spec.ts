import { test, expect } from "@playwright/test";

const MOCK_RANKINGS = [
  {
    rank: 1,
    name: "SMA Crossover",
    score: 0.85,
    metrics: {
      totalReturn: 0.12,
      sharpeRatio: 1.5,
      maxDrawdown: -0.08,
      winRate: 0.55,
      profitFactor: 1.8,
      totalTrades: 20,
    },
    finalCapital: 11200,
    equityCurve: [
      { timestamp: 1700000000000, equity: 10000, drawdown: 0 },
      { timestamp: 1700100000000, equity: 10500, drawdown: 0 },
      { timestamp: 1700200000000, equity: 11200, drawdown: 0 },
    ],
  },
  {
    rank: 2,
    name: "EMA Crossover Simple",
    score: 0.72,
    metrics: {
      totalReturn: 0.08,
      sharpeRatio: 1.2,
      maxDrawdown: -0.1,
      winRate: 0.5,
      profitFactor: 1.5,
      totalTrades: 15,
    },
    finalCapital: 10800,
    equityCurve: [
      { timestamp: 1700000000000, equity: 10000, drawdown: 0 },
      { timestamp: 1700100000000, equity: 10300, drawdown: 0 },
      { timestamp: 1700200000000, equity: 10800, drawdown: 0 },
    ],
  },
];

test.describe("Leaderboard", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the /api/rank endpoint for CI reliability
    await page.route("**/api/rank", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rankings: MOCK_RANKINGS }),
      });
    });
  });

  test("loading indicator appears", async ({ page }) => {
    // Delay the API response to catch loading state
    await page.route("**/api/rank", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rankings: MOCK_RANKINGS }),
      });
    });

    await page.goto("/");
    await expect(page.locator("text=Backtesting")).toBeVisible();
  });

  test("rankings section renders after loading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Live Leaderboard")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Rankings")).toBeVisible();
  });

  test("score comparison heading visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Score Comparison")).toBeVisible({ timeout: 10000 });
  });

  test("canvas element renders for equity curves", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Equity Curves Comparison")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("data source badge present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-testid='data-source-badge']")).toBeVisible({ timeout: 10000 });
  });

  test("feature cards still visible below leaderboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Live Leaderboard")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Backtest").first()).toBeVisible();
    await expect(page.locator("text=Optimize").first()).toBeVisible();
    await expect(page.locator("text=Quick Start")).toBeVisible();
  });

  test("full page screenshot", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Live Leaderboard")).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: "e2e/screenshots/leaderboard.png",
      fullPage: true,
    });
  });
});
