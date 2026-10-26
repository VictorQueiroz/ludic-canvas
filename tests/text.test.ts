import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Font, FontBook, validateFontMetrics, type AtlasJson } from '../src/gfx/font.ts';
const metrics = JSON.parse(readFileSync(new URL('../assets/default-font.json', import.meta.url), 'utf8')) as AtlasJson;
function book() {
  const fonts = new FontBook();
  fonts.add(
    new Font('ui', 0, structuredClone(metrics), { handle: {} as WebGLTexture, width: 512, height: 512, bytes: 0 }),
  );
  return fonts;
}
describe('production text measurement', () => {
  it('rejects invalid external metrics before allocating glyph geometry', () => {
    expect(() => validateFontMetrics({ ...metrics, atlas: { ...metrics.atlas, yOrigin: 'bottom' } })).toThrow(
      'top-origin',
    );
    expect(() => validateFontMetrics({ ...metrics, glyphs: [...metrics.glyphs, metrics.glyphs[0]] })).toThrow(
      'duplicate',
    );
    expect(() => validateFontMetrics({ ...metrics, glyphs: metrics.glyphs.filter((g) => g.unicode !== 63) })).toThrow(
      'fallback',
    );
    expect(() => new Font('bad', 0, metrics, { handle: {} as WebGLTexture, width: 1, height: 1, bytes: 4 })).toThrow(
      'dimensions',
    );
  });
  it('keeps fractional widths distinct at wrapping boundaries', () => {
    const fonts = book(),
      style = { font: 'ui', size: 20 };
    const advance = fonts.get('ui').glyph(65).advance * 20;
    const first = fonts.shape('AA', style, advance * 2 - 0.1),
      second = fonts.shape('AA', style, advance * 2 + 0.1);
    expect(first.lines).toBe(2);
    expect(second.lines).toBe(1);
    expect(first).not.toBe(second);
  });
  it('wraps long words, normalizes CRLF and truncates with an ellipsis', () => {
    const fonts = book(),
      style = { font: 'ui', size: 20 };
    expect(fonts.shape('A\r\nB', style).lines).toBe(2);
    const wrapped = fonts.shape('ABCDEFGHIJKLMN', style, 40);
    expect(wrapped.lines).toBeGreaterThan(2);
    expect(wrapped.width).toBeLessThanOrEqual(41);
    const truncated = fonts.shape('ABCDE FGHIJ KLMNO', { ...style, maxLines: 1, ellipsis: true }, 80);
    expect(truncated.lines).toBe(1);
    expect(truncated.width).toBeLessThanOrEqual(80);
    expect(truncated.glyphs.length).toBeGreaterThan(0);
  });
  it('rejects invalid input and normalizes em-scaled metrics', () => {
    const fonts = book();
    expect(() => fonts.shape('a', { font: 'ui', size: NaN })).toThrow('positive');
    const doubled = structuredClone(metrics);
    doubled.metrics.emSize *= 2;
    doubled.metrics.lineHeight *= 2;
    doubled.metrics.ascender *= 2;
    doubled.metrics.descender *= 2;
    for (const glyph of doubled.glyphs) {
      glyph.advance *= 2;
      if (glyph.planeBounds) for (const key of ['left', 'top', 'right', 'bottom'] as const) glyph.planeBounds[key] *= 2;
    }
    const other = new FontBook();
    other.add(new Font('ui', 0, doubled, { handle: {} as WebGLTexture, width: 512, height: 512, bytes: 0 }));
    expect(other.shape('Hello', { font: 'ui', size: 20 })).toEqual(fonts.shape('Hello', { font: 'ui', size: 20 }));
  });
});
