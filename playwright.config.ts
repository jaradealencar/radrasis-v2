import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:43173",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    trace: "off",
  },
  webServer: {
    command: "corepack yarn vite --config vite.e2e.config.ts --configLoader runner --host 127.0.0.1 --port 43173 --strictPort",
    url: "http://127.0.0.1:43173/e2e-roi-marketing.html",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
