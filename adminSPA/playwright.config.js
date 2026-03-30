// CommonJS: evita conflictos ESM/CJS al cargar la config en Windows.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'e2e', '.env'), quiet: true });

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4200';

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer:
    process.env.E2E_START_WEB_SERVER === '1'
      ? {
          command: 'npx ng serve --host 127.0.0.1 --port 4200',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180_000,
        }
      : undefined,
});
