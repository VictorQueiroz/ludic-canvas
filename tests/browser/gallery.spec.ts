import { test, expect } from '@playwright/test';

test('the Play gallery switches one game viewport and its integration notes', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:6174/play/');
  const orbital = page.getByRole('button', { name: /Orbital Relay/ });
  const kestrel = page.getByRole('button', { name: /Kestrel Survey/ });
  const player = page.locator('#example-player');
  const game = page.frameLocator('#example-player');
  await expect(orbital).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(game.getByRole('button', { name: 'Launch courier', exact: true })).toBeAttached();
  expect(
    await page
      .locator('.game-thumbnail img')
      .evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0)),
  ).toBe(true);
  await kestrel.click();
  await expect(kestrel).toHaveAttribute('aria-pressed', 'true');
  await expect(orbital).toHaveAttribute('aria-pressed', 'false');
  await expect(player).toHaveAttribute('data-example', 'kestrel-survey');
  await expect(game.getByRole('button', { name: 'Pause survey', exact: true })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'How Kestrel Survey uses Ludic Canvas.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How Orbital Relay uses Ludic Canvas.', exact: true })).toHaveCount(0);
  await expect(game.locator('body')).toHaveClass('game-page embedded');
  await expect(game.getByRole('heading', { name: 'Kestrel Survey', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('play-gallery.png'), fullPage: true });
  await orbital.press('Enter');
  await expect(player).toHaveAttribute('data-example', 'orbital-relay');
  await expect(game.getByRole('button', { name: 'Launch courier', exact: true })).toBeAttached();
  await expect(page.locator('iframe')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('gallery selection supports deep links and browser history', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://127.0.0.1:6174/play/?example=kestrel-survey');
  const player = page.locator('#example-player');
  await expect(player).toHaveAttribute('data-example', 'kestrel-survey');
  await page.getByRole('button', { name: /Orbital Relay/ }).click();
  await expect(page).toHaveURL(/example=orbital-relay/);
  await page.goBack();
  await expect(page).toHaveURL(/example=kestrel-survey/);
  await expect(player).toHaveAttribute('data-example', 'kestrel-survey');
  await expect(
    page.frameLocator('#example-player').getByRole('button', { name: 'Pause survey', exact: true }),
  ).toBeAttached();
  await expect(page.getByRole('button', { name: /Kestrel Survey/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(player).toHaveAttribute('data-example', 'orbital-relay');
  await expect(
    page.frameLocator('#example-player').getByRole('button', { name: 'Launch courier', exact: true }),
  ).toBeAttached();
});

test('the gallery and selected game fit 320 pixels, and legacy embeds still work', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('http://127.0.0.1:6174/play/?example=kestrel-survey');
  const game = page.frameLocator('#example-player');
  await expect(game.getByRole('button', { name: 'Open survey sites', exact: true })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await game.locator('#survey-ui').evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(320);
  await page.goto('http://127.0.0.1:6174/play/?embed=1');
  await expect(page).toHaveURL(/\/play\/orbital-relay\/\?embed=1$/);
  await expect(page.getByRole('button', { name: 'Launch courier', exact: true })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
