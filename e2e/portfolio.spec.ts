import { test, expect, type Page } from "@playwright/test";

const STRATEGY_SCRIPT = `//@version=5
strategy("SMA Cross", overlay=true)
fastSMA = ta.sma(close, 10)
slowSMA = ta.sma(close, 30)
if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)
if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`;

async function goToPortfolio(page: Page): Promise<void> {
  await page.goto("/portfolio");
  await page.waitForLoadState("networkidle");
}

async function runPortfolioBacktest(
  page: Page,
  assets = "AAPL, MSFT",
): Promise<void> {
  await goToPortfolio(page);

  const scriptArea = page.locator("textarea");
  const assetInput = page.locator('input[placeholder*="AAPL"]');
  const capitalInput = page.locator('input[type="number"]');
  const mockCheckbox = page.locator("#useMock");
  const runButton = page.locator("button", {
    hasText: /run portfolio backtest/i,
  });

  await scriptArea.fill(STRATEGY_SCRIPT);
  await assetInput.fill(assets);
  await capitalInput.fill("20000");

  if (!(await mockCheckbox.isChecked())) {
    await mockCheckbox.check();
  }

  await runButton.click();
  await expect(
    page.getByRole("heading", { name: "Portfolio Equity", exact: true }),
  ).toBeVisible({
    timeout: 30000,
  });
}

test.describe("Portfolio page", () => {
  test("page loads with all form elements", async ({ page }) => {
    await goToPortfolio(page);

    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator('input[placeholder*="AAPL"]')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(
      page.locator("button", { hasText: /run portfolio backtest/i }),
    ).toBeVisible();
  });

  test("nav link to portfolio exists and navigates correctly", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("nav a", { hasText: "Portfolio" })).toBeVisible();
    await page.locator("nav a", { hasText: "Portfolio" }).click();
    await page.waitForURL("**/portfolio");
    await expect(page).toHaveURL(/\/portfolio$/);
  });

  test("run portfolio backtest with 2 mock assets shows summary cards", async ({
    page,
  }) => {
    await runPortfolioBacktest(page, "AAPL, MSFT");

    await expect(page.locator("text=Total Return")).toBeVisible();
    await expect(page.locator("text=Sharpe Ratio")).toBeVisible();
    await expect(page.locator("text=Max Drawdown")).toBeVisible();
    await expect(page.locator("text=Total Trades")).toBeVisible();
  });

  test("combined equity chart canvas exists after run", async ({ page }) => {
    await runPortfolioBacktest(page, "AAPL, MSFT");
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("per-asset table shows 2 rows for 2 assets", async ({ page }) => {
    await runPortfolioBacktest(page, "AAPL, MSFT");
    await expect(page.locator("table tbody tr")).toHaveCount(2);
  });

  test("correlation heatmap renders visible grid cells", async ({ page }) => {
    await runPortfolioBacktest(page, "AAPL, MSFT");

    const heatmap = page
      .locator("text=Correlation Matrix")
      .locator("../..")
      .locator('div[title*=" / "]');
    await expect(heatmap.first()).toBeVisible();
    await expect(heatmap).toHaveCount(4);
  });

  test("error state shows message when assets input is empty", async ({
    page,
  }) => {
    await goToPortfolio(page);

    await page.locator('input[placeholder*="AAPL"]').fill("");
    await page
      .locator("button", { hasText: /run portfolio backtest/i })
      .click();

    await expect(
      page.locator("text=Enter at least one asset symbol"),
    ).toBeVisible();
  });

  test("captures screenshot of results after successful run", async ({
    page,
  }) => {
    await runPortfolioBacktest(page, "AAPL, MSFT");

    await page.screenshot({
      path: "e2e/screenshots/portfolio-results.png",
      fullPage: true,
    });
  });

  test("error state shows message when script is empty", async ({ page }) => {
    await goToPortfolio(page);

    // Clear the strategy textarea
    await page.locator("textarea").fill("");
    // Keep assets filled
    await page.locator('input[placeholder*="AAPL"]').fill("AAPL");

    await page
      .locator("button", { hasText: /run portfolio backtest/i })
      .click();

    // The API returns 400 with "script is required" — the page shows it as error
    await expect(page.locator("text=script is required")).toBeVisible({
      timeout: 15000,
    });
  });
});
