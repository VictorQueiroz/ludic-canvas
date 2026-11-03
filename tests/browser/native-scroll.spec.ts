import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { panTouch } from './touch-pan.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:6174/native-scroll/');
  await expect(page.locator('#scroll-status')).toContainText('Ready.');
});

test('native scrolling moves actual painted tiles without another application paint', async ({ page }) => {
  const before = await page.evaluate(() => {
    const experiment = window.nativeScrollExperiment!;
    experiment.setPaused(true);
    const tile = document.querySelector<HTMLCanvasElement>('.scroll-tile')!;
    const pixel = [...tile.getContext('2d')!.getImageData(20, 20, 1, 1).data];
    return { y: tile.getBoundingClientRect().y, paints: experiment.snapshot().tilePaints, pixel };
  });
  expect(before.pixel[3]).toBe(255);
  expect(before.pixel.slice(0, 3).some((channel) => channel > 0)).toBe(true);
  await page.evaluate(() => window.nativeScrollExperiment!.scrollTo(100));
  const after = await page.evaluate(() => ({
    y: document.querySelector('.scroll-tile')!.getBoundingClientRect().y,
    state: window.nativeScrollExperiment!.snapshot(),
  }));
  expect(after.y).toBeCloseTo(before.y - 100, 1);
  expect(after.state.tilePaints).toBe(before.paints);
  expect(after.state.rawOffset).toBe(100);
  expect(after.state.errors).toEqual([]);
});

test('distant jumps paint the correct window and native item activation survives scrolling', async ({ page }) => {
  await page.evaluate(() => window.nativeScrollExperiment!.scrollTo(6000));
  await expect.poll(() => page.evaluate(() => window.nativeScrollExperiment!.snapshot().mountedTiles)).toContain(15);
  const state = await page.evaluate(() => window.nativeScrollExperiment!.snapshot());
  expect(state.logicalOffset).toBe(6000);
  expect(state.estimatedRasterBytes).toBeLessThanOrEqual(state.rasterBudgetBytes);
  await page.locator('#native-content').getByRole('button', { name: 'Item 85', exact: true }).click();
  await expect(page.locator('#native-selection')).toHaveText('Selected item 85');
  await expect(page.locator('#canvas-selection')).toHaveText('No item selected');
  await expect(page.locator('#dom-selection')).toHaveText('No item selected');
  await expect.poll(() => page.evaluate(() => window.nativeScrollExperiment!.snapshot().selected)).toBe(84);
  await page.locator('#native-content').getByRole('button', { name: 'Item 86', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#native-selection')).toHaveText('Selected item 86');
});

test('resizing preserves browser ownership and teardown releases surfaces and listeners', async ({ page }) => {
  await page.evaluate(() => {
    window.nativeScrollExperiment!.scrollTo(1700);
    document.querySelector<HTMLElement>('#native-scroll')!.style.width = '240px';
  });
  await expect
    .poll(() => page.evaluate(() => window.nativeScrollExperiment!.snapshot().viewportWidth))
    .toBeLessThanOrEqual(240);
  const state = await page.evaluate(() => window.nativeScrollExperiment!.snapshot());
  expect(state.rawOffset).toBe(1700);
  expect(state.highWaterBytes).toBeLessThanOrEqual(state.rasterBudgetBytes);
  await page.getByRole('button', { name: 'Stop experiment', exact: true }).click();
  await expect(page.locator('.scroll-tile, .scroll-staging, [data-ludic-canvas]')).toHaveCount(0);
  const stopped = await page.evaluate(() => {
    const experiment = window.nativeScrollExperiment!;
    experiment.scrollTo(100);
    experiment.refresh();
    experiment.setPaused(false);
    experiment.destroy();
    return experiment.snapshot();
  });
  expect(stopped.destroyed).toBe(true);
  expect(stopped.mountedTiles).toEqual([]);
  expect(stopped.estimatedRasterBytes).toBe(0);
  expect(stopped.errors).toEqual([]);
});

test('diagnostics download identifies the source and retains raw copy samples', async ({ page }) => {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download diagnostics', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('native-scroll-prototype.json');
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(report.source).toMatch(/^[a-f0-9]{40}(-dirty)?$/);
  expect(report.samples.length).toBeGreaterThan(0);
  expect(report.samples[0]).toHaveProperty('sceneCommitMs');
  expect(report.samples[0]).toHaveProperty('copyCallMs');
  expect(report.estimatedRasterBytes).toBeLessThanOrEqual(report.rasterBudgetBytes);
  expect(report.errors).toEqual([]);
});

test('touch panning belongs to the native scroller and does not select a row', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Trusted touch-drag injection is Chromium-only; physical iPhone evaluation remains pending.',
  );
  const viewport = page.locator('#native-scroll');
  await panTouch(page, viewport);
  await expect.poll(() => page.evaluate(() => window.nativeScrollExperiment!.snapshot().rawOffset)).toBeGreaterThan(50);
  expect(await page.evaluate(() => window.nativeScrollExperiment!.snapshot().selected)).toBe(-1);
  await viewport.getByRole('button', { name: 'Item 5', exact: true }).tap();
  await expect(page.locator('#native-selection')).toHaveText('Selected item 5');
});

test('persisted page transitions preserve the experiment and ordinary exit tears it down', async ({ page }) => {
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  expect(await page.evaluate(() => window.nativeScrollExperiment!.snapshot().destroyed)).toBe(false);
  await page.evaluate(() => window.nativeScrollExperiment!.scrollTo(6000));
  await expect.poll(() => page.evaluate(() => window.nativeScrollExperiment!.snapshot().mountedTiles)).toContain(15);
  await page.locator('#native-content').getByRole('button', { name: 'Item 85', exact: true }).press('Enter');
  await expect(page.locator('#native-selection')).toHaveText('Selected item 85');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  expect(await page.evaluate(() => window.nativeScrollExperiment!.snapshot().destroyed)).toBe(true);
  await expect(page.locator('.scroll-tile, .scroll-staging, [data-ludic-canvas]')).toHaveCount(0);
});
