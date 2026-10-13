import { defineConfig, devices } from "@playwright/test";

const preview = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL: preview ?? "http://127.0.0.1:3200", trace: "retain-on-failure" },
  webServer: preview ? undefined : {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3200",
    url: "http://127.0.0.1:3200/login",
    reuseExistingServer: false,
    timeout: 180000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
  ],
});
