import { defineConfig, devices } from "@playwright/test";
const port = process.env.CAUSEVAL_TEST_PORT || "3000";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/web",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: baseURL,
    env: { PORT: port },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
