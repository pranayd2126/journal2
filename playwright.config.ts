import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  workers: 2,
  use: {
    baseURL: "https://localhost:3100",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: "npx tsx tests/browser-server.ts",
    url: "https://localhost:3100/api/health",
    timeout: 120000,
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "tablet", use: { viewport: { width: 820, height: 1180 } } },
    {
      name: "firefox",
      use: { browserName: "firefox", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
});
