import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/campanhas-whatsapp-fila.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "yarn vite --host 127.0.0.1 --port 4175",
    url: `${baseURL}/e2e-campanhas-whatsapp.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
