import { test, expect, type Page } from '@playwright/test';

async function catalogue(page: Page) {
  await page.goto('http://127.0.0.1:6174/components/');
  const night = page.locator('#lab-night'),
    field = page.locator('#lab-field');
  await field.locator('canvas').scrollIntoViewIfNeeded();
  await expect(field.getByRole('slider', { name: 'Signal strength' })).toBeAttached();
  await night.locator('canvas').scrollIntoViewIfNeeded();
  await expect(night.getByRole('slider', { name: 'Signal strength' })).toBeAttached();
  return { night, field };
}

test('shared controls keep state independent and tabs provide one keyboard stop', async ({ page }) => {
  test.setTimeout(60000);
  const { night, field } = await catalogue(page);
  const slider = night.getByRole('slider', { name: 'Signal strength' });
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(field.getByRole('slider', { name: 'Signal strength' })).toHaveAttribute('aria-valuenow', '0.4');
  const hints = night.getByRole('switch', { name: 'Enable navigation hints' });
  await hints.press('Space');
  await expect(hints).toHaveAttribute('aria-checked', 'false');
  await expect(field.getByRole('switch', { name: 'Enable navigation hints' })).toHaveAttribute('aria-checked', 'true');
  const tabs = night.getByRole('tablist', { name: 'Equipment sections' });
  const loadout = tabs.getByRole('tab', { name: 'Loadout' }),
    cargo = tabs.getByRole('tab', { name: 'Cargo' });
  await loadout.press('ArrowRight');
  await expect(cargo).toBeFocused();
  await expect(cargo).toHaveAttribute('aria-selected', 'true');
  await expect(loadout).toHaveAttribute('tabindex', '-1');
  await expect(tabs.getByRole('tab', { name: 'Research' })).toBeDisabled();
  await cargo.press('Home');
  await expect(loadout).toHaveAttribute('tabindex', '0');
  await loadout.press('Tab');
  await expect(night.getByRole('button', { name: 'Equip scanner' })).toBeFocused();
});

test('nested dialogs restore each trigger and isolate only their owning root', async ({ page }) => {
  test.setTimeout(60000);
  const { night, field } = await catalogue(page);
  await night.getByRole('button', { name: 'Open settings' }).press('Enter');
  const parent = night.getByRole('dialog', { name: 'Interface settings', exact: true });
  await expect(parent).toHaveAttribute('aria-modal', 'true');
  await expect(parent.getByRole('switch', { name: 'Show telemetry' })).toBeFocused();
  await expect(night.getByRole('button', { name: 'Equip scanner' })).toHaveCount(0);
  await expect(field.getByRole('button', { name: 'Equip scanner' })).toBeEnabled();
  await parent.getByRole('button', { name: 'Advanced settings' }).press('Enter');
  const child = night.getByRole('dialog', { name: 'Advanced interface settings', exact: true });
  await expect(parent).toHaveAttribute('aria-modal', 'false');
  await expect(child.getByRole('button', { name: 'Back to settings' })).toBeFocused();
  await child.getByRole('button', { name: 'Back to settings' }).press('Tab');
  await expect(child.getByRole('button', { name: 'Back to settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(parent.getByRole('button', { name: 'Advanced settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(parent).toHaveCount(0);
  await expect(night.getByRole('button', { name: 'Open settings' })).toBeFocused();
});

test('focus reveals scroll content and disabled controls block real pointer activation', async ({ page }) => {
  test.setTimeout(60000);
  const { night, field } = await catalogue(page);
  await night.getByRole('button', { name: 'Focus last cargo' }).press('Enter');
  const last = night.getByRole('button', { name: 'Select cargo 12' });
  await expect(last).toBeFocused();
  await expect(field.getByRole('button', { name: 'Select cargo 12' })).not.toBeFocused();
  await expect
    .poll(async () => {
      const canvas = await night.locator('canvas').boundingBox(),
        target = await last.boundingBox();
      return Boolean(canvas && target && target.y >= canvas.y && target.y + target.height <= canvas.y + canvas.height);
    })
    .toBe(true);
  await page.getByLabel('Disable controls', { exact: true }).check();
  const equip = night.getByRole('button', { name: 'Equip scanner' });
  await expect(equip).toBeDisabled();
  await night.locator('canvas').scrollIntoViewIfNeeded();
  const box = (await equip.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(night.getByText('Equipped 0 / Cargo - / Hints on', { exact: true })).toBeAttached();
  await page.getByLabel('Disable controls', { exact: true }).uncheck();
  await expect(equip).toBeEnabled();
  await night.locator('canvas').scrollIntoViewIfNeeded();
  const enabledBox = (await equip.boundingBox())!;
  await page.mouse.click(enabledBox.x + enabledBox.width / 2, enabledBox.y + enabledBox.height / 2);
  await expect(night.getByText('Equipped 1 / Cargo - / Hints on', { exact: true })).toBeAttached();
});

test('the catalogue and large-text controls fit a 320 pixel viewport', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 844 });
  const { night } = await catalogue(page);
  await page.getByLabel('Larger text', { exact: true }).check();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await night.locator('canvas').scrollIntoViewIfNeeded();
  await night.getByRole('slider', { name: 'Signal strength' }).press('Home');
  await expect(night.getByRole('slider', { name: 'Signal strength' })).toHaveAttribute('aria-valuenow', '0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  const canvas = (await night.locator('canvas').boundingBox())!;
  expect(canvas.width).toBeLessThanOrEqual(320);
  await night.getByRole('button', { name: 'Open settings' }).press('Enter');
  const close = night.getByRole('button', { name: 'Close settings' });
  await expect(close).toBeAttached();
  await close.press('Escape');
  await expect(night.getByRole('button', { name: 'Open settings' })).toBeFocused();
});
