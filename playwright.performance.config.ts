import { defineConfig } from '@playwright/test';

/** Operator acquisition only. No software GPU flags, retries or shared user profile. */
export default defineConfig({
  testDir: './tests/benchmarks',
  outputDir: 'build/performance-browser',
  timeout: 300000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1710, height: 930 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run docs:build && npm run docs:preview -- --host 127.0.0.1 --port 6176 --strictPort',
    url: 'http://127.0.0.1:6176/performance/',
    reuseExistingServer: false,
  },
});
