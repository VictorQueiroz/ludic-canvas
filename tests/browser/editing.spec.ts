import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/editing/');
  await expect(page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true })).toBeVisible();
  await expect(page.locator('#second').getByRole('textbox', { name: 'Player name', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }) => {
  if (!page || page.isClosed()) return;
  expect(await page.evaluate(() => (window as any).editing.errors)).toEqual([]);
});

test('native fields preserve caret, node identity and undo across controlled frame updates', async ({ page }) => {
  const first = page.locator('#first'),
    name = first.getByRole('textbox', { name: 'Player name', exact: true });
  await name.evaluate((el) => {
    (window as any).originalEditor = el;
  });
  await name.click();
  await name.press('End');
  await name.pressSequentially('x');
  await expect(name).toHaveValue('Adax');
  await name.press('ControlOrMeta+z');
  await expect(name).toHaveValue('Ada');
  // Establish the same caret position independently of platform-specific Home bindings.
  await name.evaluate((el) => (el as HTMLInputElement).setSelectionRange(1, 1));
  await name.pressSequentially('bc');
  await expect(name).toHaveValue('Abcda');
  expect(await name.evaluate((el) => (el as HTMLInputElement).selectionStart)).toBe(3);
  expect(await name.evaluate((el) => el === (window as any).originalEditor)).toBe(true);
  await expect(page.locator('#second').getByRole('textbox', { name: 'Player name', exact: true })).toHaveValue('Ada');
  expect(await page.evaluate(() => (window as any).editing.values.first.hotkeys)).toBe(0);
  expect(await page.evaluate(() => (window as any).editing.bubbledKeys)).toBe(0);
});

test('external resets, rejected edits, readonly, errors and disabled state follow props', async ({ page }) => {
  const name = page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true });
  await name.fill('Captain');
  await page.evaluate(() => (window as any).editing.controls.first.reset('Reset'));
  await expect(name).toHaveValue('Reset');
  // Returning to a previously emitted string is a new edit after an external reset.
  await name.fill('Captain');
  await expect(name).toHaveValue('Captain');
  await page.evaluate(() => (window as any).editing.controls.first.reset('Reset'));
  await expect(name).toHaveValue('Reset');
  await page.evaluate(() => (window as any).editing.controls.first.reject(true));
  await name.press('End');
  await name.pressSequentially('x');
  await expect(name).toHaveValue('Reset');
  await page.evaluate(() => {
    const c = (window as any).editing.controls.first;
    c.readonly(true);
    c.error('Choose a different name');
  });
  await expect(name).toHaveAttribute('readonly', '');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  const description = await name.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${description}"]`)).toHaveText('Choose a different name');
  await name.pressSequentially('q');
  await expect(name).toHaveValue('Reset');
  await page.evaluate(() => (window as any).editing.controls.first.disable(true));
  await expect(name).toBeDisabled();
  expect(await page.evaluate(() => (window as any).editing.handles.first.current.focus())).toBe(false);
});

test('synthetic composition preserves drafts, ignores IME Escape and defers external resets', async ({ page }) => {
  const name = page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true });
  await name.click();
  await name.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = 'に';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'に', isComposing: true }));
  });
  await expect(name).toHaveValue('に');
  await page.evaluate(() => (window as any).editing.controls.first.reset('External'));
  await expect.poll(() => page.evaluate(() => (window as any).editing.values.first.name)).toBe('External');
  // Wait for the frame to observe the new prop; the composing native draft stays untouched.
  await expect.poll(() => name.evaluate((el) => (el as HTMLInputElement).value)).toBe('に');
  await name.evaluate((el) => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'に' })));
  await expect(name).toHaveValue('External');
  await page.locator('#first').getByRole('button', { name: 'Open editor', exact: true }).press('Enter');
  const dialog = page.locator('#first').getByRole('dialog', { name: 'Edit profile', exact: true });
  const editor = dialog.getByRole('textbox', { name: 'Dialog name', exact: true });
  await expect(editor).toBeFocused();
  await editor.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', isComposing: true }));
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  await expect(dialog).toBeAttached();
  await editor.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('native editors join modal Tab order, nested focus return and background isolation', async ({ page }) => {
  const first = page.locator('#first');
  await first.getByRole('button', { name: 'Open editor', exact: true }).press('Enter');
  const dialog = first.getByRole('dialog', { name: 'Edit profile', exact: true });
  const editor = dialog.getByRole('textbox', { name: 'Dialog name', exact: true });
  await expect(editor).toBeFocused();
  await expect(first.locator('input[aria-label="Player name"]')).toBeHidden();
  await expect(page.locator('#second').getByRole('textbox', { name: 'Player name', exact: true })).toBeEnabled();
  await editor.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Close editor', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editor).toBeFocused();
  await editor.press('Tab');
  const nestedTrigger = dialog.getByRole('button', { name: 'Nested editor', exact: true });
  await expect(nestedTrigger).toBeFocused();
  await nestedTrigger.press('Enter');
  await expect(first.getByRole('textbox', { name: 'Nested name', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nestedTrigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(first.getByRole('button', { name: 'Open editor', exact: true })).toBeFocused();
});

test('imperative focus reveals clipped fields and geometry follows transforms and text scale', async ({ page }) => {
  const first = page.locator('#first');
  const name = first.getByRole('textbox', { name: 'Player name', exact: true });
  await page.evaluate(() => {
    const e = (window as any).editing;
    e.controls.first.transform(0.75);
    e.roots[0].setTextScale(1.25);
  });
  await expect(name).toHaveCSS('font-size', '20px');
  await expect(name).toHaveCSS('transform', 'matrix(0.75, 0, 0, 0.75, 0, 0)');
  await expect(name).toHaveCSS('opacity', '0.8');
  expect(await page.evaluate(() => (window as any).editing.roots[0].focus('last'))).toBe(true);
  const last = first.getByRole('textbox', { name: 'Last field', exact: true });
  await expect(last).toBeFocused();
  await expect.poll(() => last.evaluate((el) => getComputedStyle(el).clipPath)).toBe('inset(0px)');
  expect(await page.evaluate(() => (window as any).editing.handles.first.current.select())).toBe(true);
  await expect(name).toBeFocused();
  await expect.poll(() => name.evaluate((el) => getComputedStyle(el).clipPath)).toBe('inset(0px)');
  expect(
    await name.evaluate((el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd]),
  ).toEqual([0, 3]);
});

test('multiline edits stay native, while single-line Enter requests submit once', async ({ page }) => {
  const first = page.locator('#first'),
    notes = first.getByRole('textbox', { name: 'Notes', exact: true });
  await notes.fill('First');
  await notes.press('End');
  await notes.press('Enter');
  await notes.pressSequentially('Second');
  await expect(notes).toHaveValue('First\nSecond');
  expect(await page.evaluate(() => (window as any).editing.values.first.submits)).toBe(0);
  await first.getByRole('textbox', { name: 'Player name', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).editing.values.first.submits)).toBe(1);
});

test('removing a focused field and destroying one root releases elements, handles and callbacks', async ({ page }) => {
  const first = page.locator('#first'),
    name = first.getByRole('textbox', { name: 'Player name', exact: true });
  await name.click();
  await name.evaluate((el) => {
    (window as any).detachedEditor = el;
  });
  await page.evaluate(() => (window as any).editing.controls.first.show(false));
  await expect(name).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).editing.handles.first.current)).toBeNull();
  const edits = await page.evaluate(() => (window as any).editing.edits.first.length);
  await page.evaluate(() => {
    const el = (window as any).detachedEditor as HTMLInputElement;
    el.value = 'Detached';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  expect(await page.evaluate(() => (window as any).editing.edits.first.length)).toBe(edits);
  await page.evaluate(() => (window as any).editing.controls.first.show(true));
  await expect(name).toHaveValue('Ada');
  await page.evaluate(() => (window as any).editing.destroy(0));
  await expect(first.locator('[data-ludic-editor]')).toHaveCount(0);
  await expect(first.locator('[data-ludic-canvas]')).toHaveCount(0);
  const other = page.locator('#second').getByRole('textbox', { name: 'Player name', exact: true });
  await other.fill('Still alive');
  await expect(other).toHaveValue('Still alive');
});

test('native clipboard paste and its undo update the controlled value', async ({ page, context, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Clipboard permissions are acquired only for Chromium; other engines retain editing coverage.',
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const name = page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true });
  await page.evaluate(() => navigator.clipboard.writeText('Pasted name'));
  await name.click();
  await name.press('ControlOrMeta+a');
  await name.press('ControlOrMeta+v');
  await expect(name).toHaveValue('Pasted name');
  await name.press('ControlOrMeta+z');
  await expect(name).toHaveValue('Ada');
});

test('native maxLength and zero-size suspension preserve the mounted field', async ({ page }) => {
  const name = page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true });
  await name.fill('');
  await page.keyboard.insertText('x'.repeat(45));
  await expect(name).toHaveValue('x'.repeat(40));
  await name.evaluate((el) => {
    (window as any).suspendedEditor = el;
  });
  const canvas = page.locator('#first canvas');
  await canvas.evaluate((el) => {
    el.style.width = '0px';
  });
  const hidden = page.locator('#first input[aria-label="Player name"]');
  await expect(hidden).toBeDisabled();
  await expect(hidden).toBeHidden();
  await canvas.evaluate((el) => {
    el.style.width = '360px';
  });
  await expect(name).toBeVisible();
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue('x'.repeat(40));
  expect(await name.evaluate((el) => el === (window as any).suspendedEditor)).toBe(true);
});

test('hiding a mounted field preserves its element and follows native undo behavior', async ({ page }) => {
  // Establish this engine's ordinary undo behavior across blur/hide/disable.
  await page.evaluate(() => {
    const reference = document.createElement('input');
    reference.id = 'native-reference';
    reference.value = 'Ada';
    document.body.appendChild(reference);
  });
  const reference = page.locator('#native-reference');
  await reference.focus();
  await reference.press('End');
  await reference.pressSequentially('x');
  await reference.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.blur();
    input.disabled = true;
    input.style.visibility = 'hidden';
  });
  await expect(reference).toBeHidden();
  await reference.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.disabled = false;
    input.style.visibility = 'visible';
  });
  await reference.focus();
  await reference.press('ControlOrMeta+z');
  const nativeUndo = await reference.inputValue();
  const name = page.locator('#first').getByRole('textbox', { name: 'Player name', exact: true });
  await name.click();
  await name.press('End');
  await name.pressSequentially('x');
  await expect(name).toHaveValue('Adax');
  await name.evaluate((el) => {
    (window as any).hiddenEditor = el;
  });
  await page.evaluate(() => (window as any).editing.controls.first.hide(true));
  await expect(name).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).editing.handles.first.current.focus())).toBe(false);
  await page.evaluate(() => (window as any).editing.controls.first.hide(false));
  await expect(name).toHaveValue('Adax');
  expect(await name.evaluate((el) => el === (window as any).hiddenEditor)).toBe(true);
  await name.focus();
  await name.press('ControlOrMeta+z');
  await expect(name).toHaveValue(nativeUndo);
});
