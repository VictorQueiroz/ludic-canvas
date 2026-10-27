import { expect, test } from '@playwright/test';

test('fixed workloads export raw measurements and tear down every scene', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:6174/performance/');
  await page.waitForFunction(() => !!(window as any).ludicPerformance);
  const report = await page.evaluate(
    async ({ hardwareLabel, execution }) =>
      (window as any).ludicPerformance.run({
        sampleFrames: 8,
        warmupFrames: 2,
        lifecycleCycles: 2,
        hardwareLabel,
        execution,
      }),
    {
      hardwareLabel: `automated:${testInfo.project.name}`,
      execution: process.env.CI ? 'ci-software-rendering' : 'automated-browser',
    },
  );
  expect(report.qualification).toBe('microbenchmark-only');
  expect(report.revision).not.toBe('unrecorded');
  expect(report.results.map((result: any) => result.workload)).toEqual([
    'static-hud',
    'telemetry',
    'inventory-scroll',
    'responsive-layout',
  ]);
  for (const result of report.results) {
    expect(result.nodes).toBeGreaterThan(result.items);
    expect(result.cpuFrameMs.samples).toHaveLength(8);
    expect(result.cpuFrameMs.summary.count).toBe(8);
    expect(result.frameIntervalMs.samples).toHaveLength(7);
    expect(result.frameIntervalMs.summary.count).toBe(7);
    expect(result.cpuFrameMs.summary.p95).toBeGreaterThanOrEqual(0);
    expect(result.maxDrawCalls).toBeGreaterThan(0);
    expect(result.maxDrawCalls).toBeLessThan(32);
    expect(result.budget.status).toBe('not-set');
    expect(result.dimensions.every((size: any) => size.width > 0 && size.height === 540 && size.dpr <= 2.01)).toBe(
      true,
    );
  }
  expect(report.lifecycle).toHaveLength(2);
  expect(report.lifecycle.every((cycle: any) => cycle.remainingMirrors === 0)).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.diagnostics).toEqual([]);
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#performance-download')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#performance-download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ludic-canvas-performance-\d+\.json$/);
  await testInfo.attach('performance-smoke.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});

test('stopping a run disposes the root and leaves no completed report', async ({ page }) => {
  await page.goto('http://127.0.0.1:6174/performance/');
  await page.locator('#performance-start').click();
  await expect(page.locator('#performance-stop')).toBeEnabled();
  await page.locator('#performance-stop').click();
  await expect(page.locator('#performance-status')).toContainText('Incomplete:');
  await expect(page.locator('[data-ludic-canvas]')).toHaveCount(0);
  await expect(page.locator('#performance-start')).toBeEnabled();
  await expect(page.locator('#performance-download')).toBeHidden();
});
