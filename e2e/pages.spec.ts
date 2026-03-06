import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/", name: "dashboard" },
  { path: "/backtest", name: "backtest" },
  { path: "/rank", name: "rank" },
  { path: "/optimize", name: "optimize" },
  { path: "/walk-forward", name: "walk-forward" },
  { path: "/portfolio", name: "portfolio" },
  { path: "/arena", name: "arena" },
  { path: "/export", name: "export" },
];

test.describe("Page rendering and screenshots", () => {
  for (const page of PAGES) {
    test(`${page.name} page loads correctly`, async ({ page: p }) => {
      await p.goto(page.path);
      await p.waitForLoadState("networkidle");

      // Verify the page has loaded (nav bar exists)
      await expect(p.locator("nav")).toBeVisible();

      // Take a full-page screenshot
      await p.screenshot({
        path: `e2e/screenshots/${page.name}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("Dashboard", () => {
  test("displays feature cards", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have navigation links
    const navLinks = page.locator("nav a");
    await expect(navLinks).toHaveCount(9); // logo + 8 nav items

    // Should have main heading
    await expect(page.locator("h1")).toContainText("PineScript Utils");
  });
});

test.describe("Backtest page", () => {
  test("has code editor and run button", async ({ page }) => {
    await page.goto("/backtest");
    await page.waitForLoadState("networkidle");

    // Should have a textarea for script input
    await expect(page.locator("textarea")).toBeVisible();

    // Should have a run button
    const runBtn = page.locator("button", { hasText: /run backtest/i });
    await expect(runBtn).toBeVisible();
  });

  test("runs backtest with mock data", async ({ page }) => {
    await page.goto("/backtest");
    await page.waitForLoadState("networkidle");

    // Enable mock data
    const mockCheckbox = page.locator('input[type="checkbox"]');
    if (!(await mockCheckbox.isChecked())) {
      await mockCheckbox.check();
    }

    // Click run
    const runBtn = page.locator("button", { hasText: /run backtest/i });
    await runBtn.click();

    // Wait for results (metrics should appear)
    await page.waitForSelector("text=/Total Return|Return/i", {
      timeout: 15000,
    });

    // Screenshot with results
    await page.screenshot({
      path: "e2e/screenshots/backtest-results.png",
      fullPage: true,
    });
  });
});

test.describe("Rank page", () => {
  test("has strategy list and rank button", async ({ page }) => {
    await page.goto("/rank");
    await page.waitForLoadState("networkidle");

    // Should have heading
    await expect(page.locator("h1")).toContainText("Rank");
  });
});

test.describe("Optimize page", () => {
  test("has strategy editor and objective selector", async ({ page }) => {
    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();

    const runBtn = page.locator("button", { hasText: /run optimization/i });
    await expect(runBtn).toBeVisible();
  });

  test("runs optimization with mock data", async ({ page }) => {
    await page.goto("/optimize");
    await page.waitForLoadState("networkidle");

    // Enable mock data
    const mockCheckbox = page.locator('input[type="checkbox"]');
    if (!(await mockCheckbox.isChecked())) {
      await mockCheckbox.check();
    }

    // Click run
    const runBtn = page.locator("button", { hasText: /run optimization/i });
    await runBtn.click();

    // Wait for results
    await page.waitForSelector("text=/Best Score|Best Parameters/i", {
      timeout: 30000,
    });

    await page.screenshot({
      path: "e2e/screenshots/optimize-results.png",
      fullPage: true,
    });
  });
});

test.describe("Walk-Forward page", () => {
  test("has strategy editor and settings", async ({ page }) => {
    await page.goto("/walk-forward");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Walk-Forward");
  });
});

test.describe("Arena page", () => {
  test("has tabs for generate and tournament", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("LLM Arena");

    // Should have tab buttons
    await expect(
      page.locator("button", { hasText: /Generate & Chat/i }),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: /Tournament/i }),
    ).toBeVisible();
  });

  test("tournament tab shows model selection", async ({ page }) => {
    await page.goto("/arena");
    await page.waitForLoadState("networkidle");

    // Click tournament tab
    await page.locator("button", { hasText: /Tournament/i }).click();

    // Should show model checkboxes
    await expect(page.locator("text=zai-org-glm-4.7")).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/arena-tournament.png",
      fullPage: true,
    });
  });
});

test.describe("Export page", () => {
  test("has template selector and live preview", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Pine Exporter");

    // Should show generated code in pre block
    await expect(page.locator("pre")).toBeVisible();

    // Should have copy button
    await expect(page.locator("button", { hasText: /copy/i })).toBeVisible();
  });

  test("switching templates updates preview", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("networkidle");

    // Click RSI template
    await page.locator("button", { hasText: /^RSI Overbought/i }).click();

    // Preview should contain RSI-related code
    const codeBlock = page.locator("pre");
    await expect(codeBlock).toContainText("rsi");

    await page.screenshot({
      path: "e2e/screenshots/export-rsi.png",
      fullPage: true,
    });
  });
});

test.describe("Navigation", () => {
  test("all nav links work", async ({ page }) => {
    const navLinks = [
      { text: "Backtest", url: "/backtest" },
      { text: "Rank", url: "/rank" },
      { text: "Optimize", url: "/optimize" },
      { text: "Walk-Forward", url: "/walk-forward" },
      { text: "LLM Arena", url: "/arena" },
      { text: "Export", url: "/export" },
    ];

    for (const link of navLinks) {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.locator(`nav a`, { hasText: link.text }).click();
      await page.waitForURL(`**${link.url}`);
      expect(page.url()).toContain(link.url);
    }
  });
});
