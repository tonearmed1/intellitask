import { defineConfig, devices } from "@playwright/test";
import { E2E_API_PORT, E2E_DATABASE_URL } from "./tests/e2e/db";

const CLIENT_PORT = 5175;
const BASE_URL = `http://localhost:${CLIENT_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "npx tsx --tsconfig tsconfig.worker.json scripts/dev-server.ts",
      url: `http://localhost:${E2E_API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        API_PORT: String(E2E_API_PORT),
      },
    },
    {
      command: `npx vite dev --port ${CLIENT_PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        API_PORT: String(E2E_API_PORT),
      },
    },
  ],
});
