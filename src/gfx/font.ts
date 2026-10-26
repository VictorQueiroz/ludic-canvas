// MSDF fonts: metrics from msdf-atlas-gen's JSON, text shaping (word wrap,
// alignment, tracking, **emphasis** runs) into glyph quads in CSS pixels.

import type { Texture } from './gl.ts';
import { fetchBytes } from '../resources.ts';

export type FontName = string;

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AtlasJson {
  atlas: {
    distanceRange: number;
    size: number;
    width: number;
    height: number;
    type?: 'msdf' | 'mtsdf';
    yOrigin?: 'top';
  };
  metrics: { emSize: number; lineHeight: number; ascender: number; descender: number };
  glyphs: { unicode: number; advance: number; planeBounds?: Bounds; atlasBounds?: Bounds }[];
}

/** Validate external data before it reaches text measurement or GPU allocation. */
export function validateFontMetrics(value: unknown): AtlasJson {
  const fail = (detail: string): never => {
    throw new Error(`Invalid font metrics: ${detail}`);
  };
  if (!value || typeof value !== 'object') fail('expected an object');
  const json = value as AtlasJson;
  const atlas = json.atlas,
    metrics = json.metrics;
  if (!atlas || !metrics || !Array.isArray(json.glyphs)) fail('atlas, metrics and glyphs are required');
  if (atlas.yOrigin !== undefined && atlas.yOrigin !== 'top') fail('only top-origin atlases are supported');
  if (atlas.type !== undefined && atlas.type !== 'msdf' && atlas.type !== 'mtsdf')
    fail('atlas.type must be msdf or mtsdf');
  for (const key of ['width', 'height'] as const)
    if (!Number.isInteger(atlas[key]) || atlas[key] < 1 || atlas[key] > 16384)
      fail(`atlas.${key} must be an integer from 1 to 16384`);
  for (const [key, number] of Object.entries({
    size: atlas.size,
    distanceRange: atlas.distanceRange,
    emSize: metrics.emSize,
    lineHeight: metrics.lineHeight,
  }))
    if (!Number.isFinite(number) || number <= 0) fail(`${key} must be positive and finite`);
  if (
    !Number.isFinite(metrics.ascender) ||
    !Number.isFinite(metrics.descender) ||
    metrics.ascender >= metrics.descender
  )
    fail('ascender and descender must use top-origin, finite coordinates');
  if (!json.glyphs.length || json.glyphs.length > 65536) fail('provide between 1 and 65536 glyphs');
  const seen = new Set<number>();
  for (const glyph of json.glyphs) {
    if (
      !glyph ||
      !Number.isInteger(glyph.unicode) ||
      glyph.unicode < 0 ||
      glyph.unicode > 0x10ffff ||
      (glyph.unicode >= 0xd800 && glyph.unicode <= 0xdfff)
    )
      fail('glyph Unicode values must be scalar codepoints');
    if (seen.has(glyph.unicode)) fail(`duplicate glyph U+${glyph.unicode.toString(16)}`);
    seen.add(glyph.unicode);
    if (!Number.isFinite(glyph.advance)) fail('glyph advances must be finite');
    if (Boolean(glyph.planeBounds) !== Boolean(glyph.atlasBounds))
      fail('planeBounds and atlasBounds must appear together');
    for (const bounds of [glyph.planeBounds, glyph.atlasBounds]) {
      if (!bounds) continue;
      if (!['left', 'top', 'right', 'bottom'].every((key) => Number.isFinite(bounds[key as keyof Bounds])))
        fail('glyph bounds must be finite');
      if (bounds.left > bounds.right || bounds.top > bounds.bottom)
        fail('glyph bounds must use top-origin coordinates');
    }
    const bounds = glyph.atlasBounds;
    if (bounds && (bounds.left < 0 || bounds.top < 0 || bounds.right > atlas.width || bounds.bottom > atlas.height))
      fail('glyph bounds exceed the atlas');
  }
  if (!seen.has(63) || !seen.has(32)) fail("include space and '?' fallback glyphs");
  return json;
}

interface Glyph {
  advance: number;
  plane?: Bounds;
  uv?: [number, number, number, number];
}

export class Font {
  readonly glyphs = new Map<number, Glyph>();
  readonly distanceRange: number;
  readonly atlasEm: number;
  readonly lineHeight: number;
  readonly ascender: number;
  readonly descender: number;

  readonly name: FontName;
  readonly index: number;
  readonly texture: Texture;

  constructor(name: FontName, index: number, json: AtlasJson, texture: Texture) {
    validateFontMetrics(json);
    if (texture.width !== json.atlas.width || texture.height !== json.atlas.height)
      throw new Error(`Font atlas dimensions do not match metrics: ${name}`);
    this.name = name;
    this.index = index;
    this.texture = texture;
    this.distanceRange = json.atlas.distanceRange;
    this.atlasEm = json.atlas.size;
    const em = json.metrics.emSize;
    this.lineHeight = json.metrics.lineHeight / em;
    this.ascender = json.metrics.ascender / em;
    this.descender = json.metrics.descender / em;
    const { width, height } = json.atlas;
    for (const g of json.glyphs) {
      const a = g.atlasBounds;
      this.glyphs.set(g.unicode, {
        advance: g.advance / em,
        ...(g.planeBounds
          ? {
              plane: Object.fromEntries(
                Object.entries(g.planeBounds).map(([key, value]) => [key, value / em]),
              ) as unknown as Bounds,
            }
          : {}),
        ...(a
          ? {
              uv: [a.left / width, a.top / height, a.right / width, a.bottom / height] as [
                number,
                number,
                number,
                number,
              ],
            }
          : {}),
      });
    }
  }

  glyph(code: number): Glyph {
    return this.glyphs.get(code) ?? this.glyphs.get(63)!; // '?'
  }
}

export interface TextStyle {
  font: FontName;
  size: number;
  lineHeight?: number; // multiplier of the font's natural line height
  tracking?: number; // extra letter spacing, in em
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
  rich?: boolean; // parse **emphasis**
  maxLines?: number;
  ellipsis?: boolean;
}

export interface ShapedGlyph {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  uv: [number, number, number, number];
  emphasis: boolean;
}

export interface ShapedText {
  width: number;
  height: number;
  lines: number;
  glyphs: ShapedGlyph[];
}

interface Word {
  chars: { code: number; emphasis: boolean }[];
  width: number;
  space: number; // width of the following space (0 at paragraph end)
  hardBreak: boolean;
}

export class FontBook {
  readonly #fonts = new Map<FontName, Font>();
  readonly #cache = new Map<string, ShapedText>();
  #cachedGlyphs = 0;

  get defaultName(): string {
    const name = this.#fonts.keys().next().value;
    if (!name) throw new Error('No font is registered');
    return name;
  }

  add(font: Font) {
    if (this.#fonts.has(font.name)) throw new Error(`Duplicate font: ${font.name}`);
    if (this.#fonts.size >= 4) throw new Error('At most four font atlases are supported');
    this.#fonts.set(font.name, font);
  }
  get(name: FontName): Font {
    const font = this.#fonts.get(name);
    if (!font) throw new Error(`Unknown font: ${name}`);
    return font;
  }
  all(): Font[] {
    return [...this.#fonts.values()];
  }
  replace(font: Font) {
    if (!this.#fonts.has(font.name)) throw new Error(`Unknown font: ${font.name}`);
    this.#fonts.set(font.name, font);
  }

  /** Lays out text inside maxWidth (CSS px). Cached; inputs are immutable. */
  shape(text: string, style: TextStyle, maxWidth = Infinity): ShapedText {
    if (
      !Number.isFinite(style.size) ||
      style.size <= 0 ||
      !Number.isFinite(style.lineHeight ?? 1) ||
      (style.lineHeight ?? 1) <= 0 ||
      !Number.isFinite(style.tracking ?? 0)
    )
      throw new Error('Font size/line height must be positive and text spacing must be finite');
    if (Number.isNaN(maxWidth)) throw new Error('Text width cannot be NaN');
    maxWidth = Math.max(0, maxWidth);
    if (style.maxLines !== undefined && (!Number.isInteger(style.maxLines) || style.maxLines < 0))
      throw new Error('maxLines must be a nonnegative integer');
    const key = JSON.stringify([
      style.font,
      style.size,
      style.lineHeight ?? 1,
      style.tracking ?? 0,
      style.align ?? 'left',
      !!style.upper,
      !!style.rich,
      style.maxLines ?? 0,
      !!style.ellipsis,
      maxWidth,
      text,
    ]);
    let shaped = this.#cache.get(key);
    if (shaped) {
      this.#cache.delete(key);
      this.#cache.set(key, shaped);
    } else {
      shaped = this.#layout(text, style, maxWidth);
      if (text.length <= 16384 && shaped.glyphs.length <= 16384) {
        while (this.#cache.size >= 2000 || this.#cachedGlyphs + shaped.glyphs.length > 100000) {
          const oldest = this.#cache.keys().next().value;
          if (oldest === undefined) break;
          this.#cachedGlyphs -= this.#cache.get(oldest)!.glyphs.length;
          this.#cache.delete(oldest);
        }
        this.#cache.set(key, shaped);
        this.#cachedGlyphs += shaped.glyphs.length;
      }
    }
    return shaped;
  }

  #layout(raw: string, style: TextStyle, maxWidth: number): ShapedText {
    const font = this.get(style.font);
    const size = style.size;
    const tracking = (style.tracking ?? 0) * size;
    const normalized = raw.replace(/\r\n?/g, '\n');
    const text = style.upper ? normalized.toUpperCase() : normalized;
    const lineH = font.lineHeight * size * (style.lineHeight ?? 1);
    const space = font.glyph(32).advance * size + tracking;

    // Split into words, carrying emphasis state across ** markers.
    const words: Word[] = [];
    let emphasis = false;
    let current: Word = { chars: [], width: 0, space: 0, hardBreak: false };
    const flush = (spaceAfter: number, hardBreak: boolean) => {
      current.space = spaceAfter;
      current.hardBreak = hardBreak;
      words.push(current);
      current = { chars: [], width: 0, space: 0, hardBreak: false };
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (style.rich && ch === '*' && text[i + 1] === '*') {
        emphasis = !emphasis;
        i++;
        continue;
      }
      if (ch === '\n') {
        flush(0, true);
        continue;
      }
      if (ch === ' ') {
        flush(space, false);
        continue;
      }
      const code = text.codePointAt(i)!;
      if (code > 0xffff) i++;
      current.chars.push({ code, emphasis });
      current.width += font.glyph(code).advance * size + tracking;
    }
    flush(0, false);

    // Greedy line breaking.
    const lines: Word[][] = [[]];
    let lineWidth = 0;
    // Break overlong words at codepoint boundaries (not script shaping).
    const wrapped: Word[] = [];
    for (const word of words) {
      if (!Number.isFinite(maxWidth) || word.width <= maxWidth || word.chars.length < 2) {
        wrapped.push(word);
        continue;
      }
      let part: Word = { chars: [], width: 0, space: 0, hardBreak: false };
      for (const char of word.chars) {
        const advance = font.glyph(char.code).advance * size + tracking;
        if (part.chars.length && part.width + advance > maxWidth + 0.01) {
          wrapped.push(part);
          part = { chars: [], width: 0, space: 0, hardBreak: false };
        }
        part.chars.push(char);
        part.width += advance;
      }
      part.space = word.space;
      part.hardBreak = word.hardBreak;
      wrapped.push(part);
    }
    for (const word of wrapped) {
      const line = lines[lines.length - 1]!;
      const prev = line[line.length - 1];
      const needed = (prev ? prev.space : 0) + word.width;
      if (line.length > 0 && lineWidth + needed > maxWidth + 0.01) {
        lines.push([word]);
        lineWidth = word.width;
      } else {
        line.push(word);
        lineWidth += needed;
      }
      if (word.hardBreak) {
        lines.push([]);
        lineWidth = 0;
      }
    }
    if (lines.length > 1 && lines[lines.length - 1]!.length === 0 && !words[words.length - 1]?.hardBreak) lines.pop();
    if (style.maxLines && lines.length > style.maxLines) {
      lines.length = style.maxLines;
      if (style.ellipsis) {
        const line = lines[lines.length - 1]!;
        const codes = font.glyphs.has(0x2026) ? [0x2026] : [46, 46, 46];
        const marker: Word = {
          chars: codes.map((code) => ({ code, emphasis: false })),
          width: codes.reduce((w, code) => w + font.glyph(code).advance * size + tracking, 0),
          space: 0,
          hardBreak: false,
        };
        const width = () => line.reduce((w, word, i) => w + word.width + (i < line.length - 1 ? word.space : 0), 0);
        while (line.length && width() + marker.width > maxWidth) {
          const last = line[line.length - 1]!;
          if (last.chars.length) {
            const char = last.chars.pop()!;
            last.width -= font.glyph(char.code).advance * size + tracking;
          } else line.pop();
        }
        if (line.length) line[line.length - 1]!.space = 0;
        line.push(marker);
      }
    }

    const widths = lines.map((line) =>
      line.reduce((w, word, i) => w + word.width + (i < line.length - 1 ? word.space : 0), 0),
    );
    // Measurement reports the natural width; alignment happens inside the
    // width we were given (the node's final box when painting).
    const natural = widths.reduce((maximum, width) => Math.max(maximum, width), 0);
    const boxWidth = Number.isFinite(maxWidth) ? Math.max(natural, maxWidth) : natural;
    const glyphs: ShapedGlyph[] = [];
    const contentH = (font.descender - font.ascender) * size;
    lines.forEach((line, li) => {
      const lw = widths[li]!;
      let pen = style.align === 'center' ? (boxWidth - lw) / 2 : style.align === 'right' ? boxWidth - lw : 0;
      const baseline = li * lineH + (lineH - contentH) / 2 - font.ascender * size;
      line.forEach((word, wi) => {
        for (const c of word.chars) {
          const g = font.glyph(c.code);
          if (g.plane && g.uv) {
            glyphs.push({
              x0: pen + g.plane.left * size,
              y0: baseline + g.plane.top * size,
              x1: pen + g.plane.right * size,
              y1: baseline + g.plane.bottom * size,
              uv: g.uv,
              emphasis: c.emphasis,
            });
          }
          pen += g.advance * size + tracking;
        }
        if (wi < line.length - 1) pen += word.space;
      });
    });
    return { width: Math.ceil(natural), height: Math.ceil(lines.length * lineH), lines: lines.length, glyphs };
  }
}

export async function loadFontJson(
  url: string,
  options: { signal?: AbortSignal; maxBytes?: number } = {},
): Promise<AtlasJson> {
  const bytes = await fetchBytes(url, { ...options, label: 'Font metrics' });
  return validateFontMetrics(JSON.parse(new TextDecoder().decode(bytes)));
}
