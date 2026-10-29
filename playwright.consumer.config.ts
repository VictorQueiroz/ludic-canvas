import { defineConfig, devices } from '@playwright/test';

const artifact = process.env.LUDIC_CONSUMER_PACKAGE ? 'registry' : 'packed';

export default defineConfig({
  testDir: './tests/consumers',
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  maxFailures: 1,
  outputDir: `test-results/consumers/${artifact}`,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/consumers/${artifact}` }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
