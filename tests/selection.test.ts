import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Font, FontBook, type AtlasJson } from '../src/gfx/font.ts';

const metrics = JSON.parse(readFileSync(new URL('../assets/default-font.json', import.meta.url), 'utf8')) as AtlasJson;
const fonts = new FontBook();
fonts.add(new Font('ui', 0, metrics, { handle: {}, width: 512, height: 512, bytes: 0 }));

it('retains selectable advance cells, source offsets and soft-wrap boundaries', () => {
  const shaped = fonts.shape('AV one two\n\nlast', { font: 'ui', size: 20 }, 75);
  expect(shaped.selection.text).toBe('AV one two\n\nlast');
  expect(shaped.selection.lines.length).toBe(shaped.lines);
  expect(shaped.selection.cells.some((cell) => cell.end - cell.start === 1 && cell.x1 > cell.x0)).toBe(true);
  expect(shaped.selection.cells.map((cell) => shaped.selection.text.slice(cell.start, cell.end)).join('')).toBe(
    'AV onetwolast',
  );
  expect(shaped.selection.lines.some((line) => line.start === line.end)).toBe(true);
});

it('copies displayed rich/uppercase text and truncation without exposing hidden source', () => {
  const rich = fonts.shape('**hello** ß 😀', { font: 'ui', size: 20, rich: true, upper: true });
  expect(rich.selection.text).toBe('HELLO SS 😀');
  const emoji = rich.selection.cells.at(-1)!;
  expect(emoji.end - emoji.start).toBe(2);
  const clipped = fonts.shape('one two three four', { font: 'ui', size: 20, maxLines: 1, ellipsis: true }, 85);
  expect(clipped.selection.text).not.toContain('four');
  expect(clipped.selection.text.endsWith('…') || clipped.selection.text.endsWith('...')).toBe(true);
});
