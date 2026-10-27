import { describe, expect, it } from 'vitest';
import { Font, FontBook, validateFontMetrics, type AtlasJson, type FontDiagnostic } from '../src/gfx/font.ts';

function face(codes = [32, 63, 65, 86, 46], em = 1): AtlasJson {
  return {
    atlas: { width: 16, height: 16, size: 32, distanceRange: 4, type: 'mtsdf', yOrigin: 'top' },
    metrics: { emSize: em, lineHeight: em, ascender: -0.8 * em, descender: 0.2 * em },
    glyphs: codes.map((unicode) => ({
      unicode,
      advance: (unicode === 32 ? 0.25 : 0.6) * em,
      ...(unicode === 32
        ? {}
        : {
            planeBounds: { left: 0, top: -0.8 * em, right: 0.6 * em, bottom: 0.2 * em },
            atlasBounds: { left: 0, top: 0, right: 8, bottom: 8 },
          }),
    })),
  };
}
function register(book: FontBook, name: string, index: number, json: AtlasJson) {
  book.add(new Font(name, index, json, { handle: {} as WebGLTexture, width: 16, height: 16, bytes: 1024 }));
}
function fixture(onDiagnostic?: (diagnostic: FontDiagnostic) => void) {
  const book = new FontBook(onDiagnostic);
  const ui = face();
  ui.kerning = [{ unicode1: 65, unicode2: 86, advance: -0.1 }];
  register(book, 'ui', 0, ui);
  const symbols = face([32, 63, 0x3a9, 0x2026], 2);
  symbols.glyphs.find((glyph) => glyph.unicode === 0x3a9)!.advance = 1.6;
  register(book, 'symbols', 1, symbols);
  return book;
}

describe('kerning and explicit fallback', () => {
  it('uses pair adjustments in measurement, painting positions, tracking and rich text', () => {
    const book = fixture();
    const shaped = book.shape('AV', { font: 'ui', size: 20 });
    expect(shaped.width).toBe(22);
    expect(shaped.glyphs[1]!.x0).toBeCloseTo(10);
    expect(book.shape('A**V**', { font: 'ui', size: 20, rich: true }).width).toBe(22);
    expect(book.shape('AV', { font: 'ui', size: 20, tracking: 0.1 }).width).toBe(26);
    expect(book.shape('AV', { font: 'ui', size: 20, kerning: false }).width).toBe(24);
  });
  it('resets pair context on a wrapped line and applies alignment after kerning', () => {
    const book = fixture();
    expect(book.shape('AV', { font: 'ui', size: 20 }, 22).lines).toBe(1);
    const narrow = book.shape('AV', { font: 'ui', size: 20 }, 21);
    expect(narrow.lines).toBe(2);
    expect(narrow.width).toBe(12);
    expect(narrow.glyphs[1]!.x0).toBe(0);
    expect(book.shape('AV', { font: 'ui', size: 20, align: 'right' }, 40).glyphs[0]!.x0).toBeCloseTo(18);
  });
  it('includes spacing-boundary pairs in both greedy wrapping and glyph placement', () => {
    const book = new FontBook();
    const json = face();
    json.kerning = [
      { unicode1: 65, unicode2: 32, advance: -0.05 },
      { unicode1: 32, unicode2: 86, advance: -0.02 },
    ];
    register(book, 'ui', 0, json);
    const shaped = book.shape('A V', { font: 'ui', size: 20 }, 28);
    expect(shaped.lines).toBe(1);
    expect(shaped.width).toBe(28);
    expect(shaped.glyphs[1]!.x0).toBeCloseTo(15.6);
    expect(book.shape('A V', { font: 'ui', size: 20 }, 27).lines).toBe(2);
  });
  it('uses ordered fallbacks for glyph metrics and atlas identity without cross-face kerning', () => {
    const book = fixture();
    const shaped = book.shape('AΩV', { font: ['ui', 'symbols'], size: 20 });
    expect(shaped.width).toBe(40);
    expect(shaped.glyphs.map((glyph) => glyph.font)).toEqual(['ui', 'symbols', 'ui']);
    expect(shaped.glyphs[2]!.x0).toBeCloseTo(28);
    expect(book.shape('AΩV', { font: ['ui', 'symbols'], size: 20 }, 30).lines).toBe(2);
    expect(book.shape('Ω', { font: ['symbols', 'ui'], size: 20 }).glyphs[0]!.font).toBe('symbols');
  });
  it('reserves enough line height for fallback ascenders and descenders on a shared baseline', () => {
    const book = fixture();
    const tall = face([32, 63, 0x3a9]);
    tall.metrics = { emSize: 1, lineHeight: 2, ascender: -1.4, descender: 0.6 };
    book.replace(new Font('symbols', 1, tall, { handle: {} as WebGLTexture, width: 16, height: 16, bytes: 1024 }));
    const shaped = book.shape('AΩ', { font: ['ui', 'symbols'], size: 20 });
    expect(shaped.height).toBe(40);
    expect(shaped.glyphs[0]!.y0).toBeCloseTo(shaped.glyphs[1]!.y0);
  });
  it('finds an ellipsis in the fallback chain and fits the truncated result', () => {
    const book = fixture();
    const shaped = book.shape('AV AV AV', { font: ['ui', 'symbols'], size: 20, maxLines: 1, ellipsis: true }, 40);
    expect(shaped.lines).toBe(1);
    expect(shaped.width).toBeLessThanOrEqual(40);
    expect(shaped.glyphs.at(-1)!.font).toBe('symbols');
    expect(book.shape('AV AV', { font: 'ui', size: 20, maxLines: 1, ellipsis: true }, 1).width).toBe(0);
  });
  it('keeps cache keys distinct for font order and clears layouts when fonts are replaced', () => {
    const book = fixture();
    const first = book.shape('A', { font: ['ui', 'symbols'], size: 20 });
    expect(book.shape('A', { font: ['symbols', 'ui'], size: 20 })).not.toBe(first);
    const wide = face();
    wide.glyphs.find((glyph) => glyph.unicode === 65)!.advance = 0.9;
    book.replace(new Font('ui', 0, wide, { handle: {} as WebGLTexture, width: 16, height: 16, bytes: 1024 }));
    expect(book.shape('A', { font: ['ui', 'symbols'], size: 20 }).width).toBe(18);
  });
  it('rejects empty chains and misspelled fallbacks even when the primary contains the text', () => {
    const book = fixture();
    expect(() => book.shape('A', { font: [], size: 20 })).toThrow('font');
    expect(() => book.shape('A', { font: ['ui', 'typo'], size: 20 })).toThrow('Unknown font: typo');
  });
  it('reports missing codepoints once per root and ordered chain, with an actionable replacement', () => {
    const diagnostics: FontDiagnostic[] = [];
    const book = fixture((diagnostic) => diagnostics.push(diagnostic));
    book.shape('ΩΩ', { font: ['ui', 'symbols'], size: 20 });
    expect(diagnostics).toHaveLength(0);
    const missing = book.shape('🛸🛸', { font: ['ui', 'symbols'], size: 20 });
    book.shape('🛸', { font: ['ui', 'symbols'], size: 30 }, 100);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      type: 'missing-glyph',
      codePoint: 0x1f6f8,
      character: '🛸',
      fonts: ['ui', 'symbols'],
      replacement: '?',
    });
    expect(diagnostics[0]!.message).toContain('U+1F6F8');
    expect(diagnostics[0]!.message).toContain('charset');
    expect(missing.glyphs.map((glyph) => glyph.font)).toEqual(['ui', 'ui']);
    book.shape('🛸', { font: ['symbols', 'ui'], size: 20 });
    expect(diagnostics).toHaveLength(2);
    const other: FontDiagnostic[] = [];
    fixture((diagnostic) => other.push(diagnostic)).shape('🛸', { font: ['ui', 'symbols'], size: 20 });
    expect(other).toHaveLength(1);
  });
  it('bounds diagnostic deduplication memory and callback volume for arbitrary text', () => {
    const diagnostics: FontDiagnostic[] = [];
    const book = fixture((diagnostic) => diagnostics.push(diagnostic));
    const text = Array.from({ length: 1200 }, (_, i) => String.fromCodePoint(0x4000 + i)).join('');
    book.shape(text, { font: 'ui', size: 10 });
    book.shape(text, { font: 'ui', size: 20 });
    expect(diagnostics).toHaveLength(1024);
  });
  it('validates pair records and normalizes kerning in the same em units as advances', () => {
    const json = face(undefined, 2);
    json.kerning = [{ unicode1: 65, unicode2: 86, advance: -0.2 }];
    const book = new FontBook();
    register(book, 'scaled', 0, json);
    expect(book.shape('AV', { font: 'scaled', size: 20 }).width).toBe(22);
    for (const kerning of [
      null,
      [{ unicode1: 65, unicode2: 86, advance: NaN }],
      [{ unicode1: 65, unicode2: 10000, advance: 0 }],
      [...json.kerning, ...json.kerning],
    ]) {
      expect(() => validateFontMetrics({ ...json, kerning })).toThrow('kerning');
    }
  });
});
