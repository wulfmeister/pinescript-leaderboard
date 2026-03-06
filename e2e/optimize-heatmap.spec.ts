import { test, expect } from "@playwright/test";

const SMA_STRATEGY = `//@version=5
strategy("SMA Crossover", overlay=true)

fastLength = input(10, title="Fast SMA Length")
slowLength = input(30, title="Slow SMA Length")

fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

if (ta.crossover(fastSMA, slowSMA))
    strategy.entry("Long", strategy.long)

if (ta.crossunder(fastSMA, slowSMA))
    strategy.close("Long")`;

test.describe("Parameter Sensitivity Heatmap", () => {
  test("heatmap section appears after optimization with 2+ params", async ({
    page,
  }) => {
    test.setTimeout(70000);

    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await page.locator("button", { hasText: /run optimization/i }).click();
    await page.waitForSelector("text=Best Score", { timeout: 60000 });

    await expect(
      page.locator("text=Parameter Sensitivity Heatmap"),
    ).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/optimize-heatmap.png",
      fullPage: true,
    });
  });

  test("heatmap renders colored cells", async ({ page }) => {
    test.setTimeout(130000);

    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await page.locator("button", { hasText: /run optimization/i }).click();
    await page.waitForSelector("text=Parameter Sensitivity Heatmap", {
      timeout: 60000,
    });

    const heatmapSection = page
      .locator("text=Parameter Sensitivity Heatmap")
      .locator("../../..");
    await expect(heatmapSection).toBeVisible();

    const cells = heatmapSection.locator("div[style*='background-color']");
    await expect(cells.first()).toBeVisible();
  });

  test("heatmap can be toggled", async ({ page }) => {
    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await page.locator("button", { hasText: /run optimization/i }).click();
    await page.waitForSelector("text=Parameter Sensitivity Heatmap", {
      timeout: 60000,
    });

    const heatmapSection = page
      .locator("text=Parameter Sensitivity Heatmap")
      .locator("../../..");

    await page
      .locator("text=Parameter Sensitivity Heatmap")
      .locator("../..")
      .locator("button", { hasText: /hide/i })
      .click();
    await expect(
      heatmapSection.locator("div[style*='linear-gradient']"),
    ).not.toBeVisible();

    await page
      .locator("text=Parameter Sensitivity Heatmap")
      .locator("../..")
      .locator("button", { hasText: /show/i })
      .click();
    await expect(
      heatmapSection.locator("div[style*='linear-gradient']"),
    ).toBeVisible();
  });

  test("clicking a heatmap cell loads selected run details", async ({
    page,
  }) => {
    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await page.locator("button", { hasText: /run optimization/i }).click();
    await page.waitForSelector("text=Parameter Sensitivity Heatmap", {
      timeout: 60000,
    });

    const heatmapSection = page
      .locator("text=Parameter Sensitivity Heatmap")
      .locator("../../..");
    const cells = heatmapSection.locator("div[style*='background-color: rgb']");
    const count = await cells.count();
    if (count > 0) {
      await cells.first().click();
      await expect(heatmapSection.locator("text=Selected Run")).toBeVisible();
    }
  });

  test("optimize page still shows results table and best parameters", async ({
    page,
  }) => {
    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await page.locator("button", { hasText: /run optimization/i }).click();
    await page.waitForSelector("text=Best Parameters", { timeout: 60000 });

    await expect(page.locator("text=Best Parameters")).toBeVisible();
    await expect(page.locator("text=Best Run Performance")).toBeVisible();
    await expect(
      page.locator("text=Parameter Sensitivity Heatmap"),
    ).toBeVisible();
  });
});
