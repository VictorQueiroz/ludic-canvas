import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:6174/3d/');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Pause survey', exact: true })).toBeAttached();
});
test('a Three.js world and custom canvas controls complete a full survey', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  expect(
    await page
      .locator('#survey-world')
      .evaluate((canvas) => Boolean((canvas as HTMLCanvasElement).getContext('webgl2'))),
  ).toBe(true);
  await expect(page.locator('#survey-stats')).toContainText('2 font families');
  // Software-rendered CI uses the real low-power control; rendering quality
  // and the default scene are also covered by the other browser cases.
  await page.getByRole('button', { name: 'Open survey settings', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
  await page.getByRole('switch', { name: 'Toggle low power rendering', exact: true }).press('Space');
  await page.keyboard.press('Escape');
  const names = ['Basalt Rise', 'Amber Shelf', 'Echo Spire'];
  for (const [index, name] of names.entries()) {
    if (index) {
      await page.getByRole('button', { name: 'Select next survey site', exact: true }).press('Enter');
    }
    await page.getByRole('button', { name: `Navigate to ${name}`, exact: true }).press('Enter');
    const collect = page.getByRole('button', { name: `Collect ${name} sample`, exact: true });
    await expect(collect).toBeEnabled({ timeout: 30000 });
    await collect.press('Enter');
    await expect(page.locator('#survey-stage')).toHaveAttribute('data-samples', String(index + 1), { timeout: 15000 });
  }
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'complete');
  await page.getByRole('button', { name: 'Begin a new survey', exact: true }).press('Enter');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-samples', '0');
  expect(errors).toEqual([]);
});
test('custom settings expose keyboard zoom, switches and modal focus', async ({ page }) => {
  test.setTimeout(60000);
  await page.getByRole('button', { name: 'Open survey settings', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
  const slider = page.getByRole('slider', { name: 'Camera distance', exact: true });
  const before = Number(await slider.getAttribute('aria-valuenow'));
  await slider.press('ArrowRight');
  await expect(slider).not.toHaveAttribute('aria-valuenow', String(before));
  const power = page.getByRole('switch', { name: 'Toggle low power rendering', exact: true });
  await power.press('Space');
  await expect(power).toHaveAttribute('aria-checked', 'true');
  await power.press('Escape');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
  await page.getByRole('button', { name: 'Pause survey', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
});
test('the mobile HUD fits 320 pixels and offers a modal site selector', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const sites = page.getByRole('button', { name: 'Open survey sites', exact: true });
  await expect(sites).toBeAttached();
  await sites.press('Enter');
  await page.getByRole('tab', { name: 'Select Amber Shelf', exact: true }).press('Enter');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-selected', '1');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Toggle overview camera', exact: true }).press('Enter');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-camera', 'overview');
});

test('the regional archive virtualizes real game UI with modal focus and controlled selection', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open field collection', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Browse regional archive', exact: true }).press('Enter');
  await expect(page.getByRole('listbox', { name: 'Regional specimen archive' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Close panel', exact: true })).toBeFocused();
  expect(await page.getByRole('option').count()).toBeLessThan(20);
  await page.getByRole('button', { name: 'Focus latest archive record', exact: true }).press('Enter');
  const last = page.getByRole('option', { name: 'Archive record KS-4000: Ironstone', exact: true });
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute('aria-setsize', '4000');
  await page.keyboard.press('Enter');
  await expect(last).toHaveAttribute('aria-selected', 'true');
  const canvas = await page.locator('#survey-ui').boundingBox();
  const row = await last.boundingBox();
  expect(row!.x).toBeGreaterThanOrEqual(canvas!.x);
  expect(row!.x + row!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#survey-stage')).toHaveAttribute('data-phase', 'playing');
});
