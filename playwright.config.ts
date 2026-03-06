import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run web",
    port: 3000,
    timeout: 60000,
    reuseExistingServer: true,
  },
});
