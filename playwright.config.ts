import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/store`,
    reuseExistingServer: true,
    // Browser tests use Wick's built-in notes, so they never spend AI requests.
    env: { SENTINEL_AI: "off" },
    timeout: 60_000,
  },
});
