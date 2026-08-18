import { defineConfig } from '@playwright/test';

const baseUse = {
  baseURL: 'http://127.0.0.1:4173',
  colorScheme: 'dark',
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Cordoba',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: baseUse,
  projects: [
    {
      name: 'desktop-chromium-1920',
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
    {
      name: 'notebook-firefox-1366',
      use: { browserName: 'firefox', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
    },
    {
      name: 'tablet-webkit-1024',
      use: { browserName: 'webkit', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true },
    },
    {
      name: 'mobile-chromium-390',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    },
    {
      name: 'mobile-webkit-390',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    },
    {
      name: 'mobile-webkit-landscape',
      use: { browserName: 'webkit', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
    },
    {
      name: 'narrow-chromium-320',
      use: { browserName: 'chromium', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
