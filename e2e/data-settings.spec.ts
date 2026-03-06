import { test, expect } from "@playwright/test";

const PAGES_WITH_DATA_SETTINGS = [
  { path: "/backtest", name: "backtest" },
  { path: "/rank", name: "rank" },
  { path: "/optimize", name: "optimize" },
  { path: "/walk-forward", name: "walk-forward" },
];

test.describe("DataSettings Component", () => {
  for (const page of PAGES_WITH_DATA_SETTINGS) {
    test.describe(`${page.name} page`, () => {
      test("DataSettings component renders with all controls", async ({
        page: p,
      }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        // Check for mock data toggle
        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
        await expect(mockCheckbox).toBeVisible();

        // Check for help tooltip
        const helpTooltip = p.locator("text=[?]");
        await expect(helpTooltip).toBeVisible();

        // Check for mock data settings (market type, bar count)
        // By default mock is enabled, so these should be visible
        const marketTypeSelect = p
          .locator("select")
          .filter({ hasText: /random|bull|bear/i });
        const barCountSlider = p
          .locator("label", { hasText: /Bar Count:/ })
          .locator("xpath=following-sibling::input[@type='range'][1]");

        // Market type dropdown should be visible when mock is enabled
        await expect(p.locator("text=Market Type")).toBeVisible();
        await expect(barCountSlider).toBeVisible();
      });

      test("toggling mock data switches UI correctly", async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');

        // Initially should show mock settings (checked by default)
        await expect(p.locator("text=Market Type")).toBeVisible();

        // Uncheck to switch to real data
        await mockCheckbox.uncheck();

        // Should now show real data settings
        await expect(p.locator("text=Timeframe")).toBeVisible();
        await expect(p.locator("label", { hasText: /^From$/ })).toBeVisible();
        await expect(p.locator("label", { hasText: /^To$/ })).toBeVisible();

        // Check again to switch back to mock
        await mockCheckbox.check();

        // Should show mock settings again
        await expect(p.locator("text=Market Type")).toBeVisible();
      });

      test("mock data market type dropdown works", async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        // Ensure mock is enabled
        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
        if (!(await mockCheckbox.isChecked())) {
          await mockCheckbox.check();
        }

        // Find and interact with market type dropdown
        const marketTypeSelect = p
          .locator("label", { hasText: /^Market Type$/ })
          .locator("xpath=following-sibling::select[1]");
        await expect(marketTypeSelect).toBeVisible();

        // Select different options
        await marketTypeSelect.selectOption("bull");
        await expect(marketTypeSelect).toHaveValue("bull");

        await marketTypeSelect.selectOption("bear");
        await expect(marketTypeSelect).toHaveValue("bear");

        await marketTypeSelect.selectOption("random");
        await expect(marketTypeSelect).toHaveValue("random");
      });

      test("mock data bar count slider works", async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        // Ensure mock is enabled
        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
        if (!(await mockCheckbox.isChecked())) {
          await mockCheckbox.check();
        }

        // Find the bar count slider
        const barCountSlider = p
          .locator("label", { hasText: /Bar Count:/ })
          .locator("xpath=following-sibling::input[@type='range'][1]");
        await expect(barCountSlider).toBeVisible();

        // Check min and max values
        await expect(barCountSlider).toHaveAttribute("min", "50");
        await expect(barCountSlider).toHaveAttribute("max", "1000");

        // Set to a specific value
        await barCountSlider.fill("500");

        // Verify the value is displayed
        await expect(p.locator("text=500")).toBeVisible();
      });

      test("real data timeframe selector works", async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        // Switch to real data
        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
        await mockCheckbox.uncheck();

        // Find timeframe dropdown
        const timeframeSelect = p
          .locator("label", { hasText: /^Timeframe$/ })
          .locator("xpath=following-sibling::select[1]");
        await expect(timeframeSelect).toBeVisible();

        // Select different timeframes
        const timeframes = [
          "1m",
          "5m",
          "15m",
          "30m",
          "1h",
          "4h",
          "1d",
          "1w",
          "1M",
        ];
        for (const tf of timeframes) {
          await timeframeSelect.selectOption(tf);
          await expect(timeframeSelect).toHaveValue(tf);
        }
      });

      test("real data date pickers work", async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState("networkidle");

        // Switch to real data
        const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
        await mockCheckbox.uncheck();

        // Find date inputs
        const fromDateInput = p.locator('input[type="date"]').first();
        const toDateInput = p.locator('input[type="date"]').nth(1);

        await expect(fromDateInput).toBeVisible();
        await expect(toDateInput).toBeVisible();

        // Set valid date range
        await fromDateInput.fill("2023-01-01");
        await toDateInput.fill("2024-01-01");

        await expect(fromDateInput).toHaveValue("2023-01-01");
        await expect(toDateInput).toHaveValue("2024-01-01");
      });
    });
  }

  test.describe("Validation", () => {
    test("shows error when from date is after to date - backtest", async ({
      page: p,
    }) => {
      await p.goto("/backtest");
      await p.waitForLoadState("networkidle");

      // Switch to real data
      const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
      await mockCheckbox.uncheck();

      // Set invalid date range
      const fromDateInput = p.locator('input[type="date"]').first();
      const toDateInput = p.locator('input[type="date"]').nth(1);

      await fromDateInput.fill("2024-06-01");
      await toDateInput.fill("2024-01-01");

      // Click run button
      const runBtn = p.locator("button", { hasText: /run backtest/i });
      await runBtn.click();

      // Should show error
      await expect(
        p.locator("text=From date must be before To date"),
      ).toBeVisible({ timeout: 5000 });
    });

    test("shows error when from date is after to date - rank", async ({
      page: p,
    }) => {
      await p.goto("/rank");
      await p.waitForLoadState("networkidle");

      // Switch to real data
      const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
      await mockCheckbox.uncheck();

      // Set invalid date range
      const fromDateInput = p.locator('input[type="date"]').first();
      const toDateInput = p.locator('input[type="date"]').nth(1);

      await fromDateInput.fill("2024-06-01");
      await toDateInput.fill("2024-01-01");

      // Click rank button
      const rankBtn = p.locator("button", { hasText: /rank/i });
      await rankBtn.click();

      // Should show error
      await expect(
        p.locator("text=From date must be before To date"),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Data Source Badge", () => {
    test("shows mock data badge after backtest run", async ({ page: p }) => {
      await p.goto("/backtest");
      await p.waitForLoadState("networkidle");

      // Ensure mock is enabled
      const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
      if (!(await mockCheckbox.isChecked())) {
        await mockCheckbox.check();
      }

      // Click run
      const runBtn = p.locator("button", { hasText: /run backtest/i });
      await runBtn.click();

      // Wait for results and check for mock data badge
      await p.waitForSelector("text=MOCK DATA", { timeout: 15000 });
      await expect(p.getByText("MOCK DATA", { exact: true })).toBeVisible();
    });

    test("shows yahoo finance badge after backtest with real data", async ({
      page: p,
    }) => {
      await p.goto("/backtest");
      await p.waitForLoadState("networkidle");

      // Switch to real data (mock disabled)
      const mockCheckbox = p.locator('input[type="checkbox"]#useMock');
      await mockCheckbox.uncheck();

      await expect(p.locator("text=Timeframe")).toBeVisible();
    });
  });
});
