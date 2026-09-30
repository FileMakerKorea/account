import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4185", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4185 --strictPort",
    url: "http://127.0.0.1:4185",
    reuseExistingServer: !process.env.CI,
  },
})
