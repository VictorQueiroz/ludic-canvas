// MSDF fonts: metrics from msdf-atlas-gen's JSON, text shaping (word wrap,
// alignment, tracking, **emphasis** runs) into glyph quads in CSS pixels.

import type { Texture } from './gl.ts';

export type FontName = string;

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AtlasJson {
  atlas: { distanceRange: number; size: number; width: number; height: number };
  metrics: { emSize: number; lineHeight: number; ascender: number; descender: number };
  glyphs: { unicode: number; advance: number; planeBounds?: Bounds; atlasBounds?: Bounds }[];
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
    this.name = name;
    this.index = index;
    this.texture = texture;
    this.distanceRange = json.atlas.distanceRange;
    this.atlasEm = json.atlas.size;
    this.lineHeight = json.metrics.lineHeight;
    this.ascender = json.metrics.ascender;
    this.descender = json.metrics.descender;
    const { width, height } = json.atlas;
    for (const g of json.glyphs) {
      const a = g.atlasBounds;
      this.glyphs.set(g.unicode, {
        advance: g.advance,
        ...(g.planeBounds ? { plane: g.planeBounds } : {}),
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

  /** Lays out text inside maxWidth (CSS px). Cached; inputs are immutable. */
  shape(text: string, style: TextStyle, maxWidth = Infinity): ShapedText {
    const key = `${style.font}|${style.size}|${style.lineHeight ?? 1}|${style.tracking ?? 0}|${style.align ?? 'left'}|${style.upper ? 1 : 0}|${style.rich ? 1 : 0}|${style.maxLines ?? 0}|${Number.isFinite(maxWidth) ? Math.floor(maxWidth) : -1}|${text}`;
    let shaped = this.#cache.get(key);
    if (!shaped) {
      shaped = this.#layout(text, style, maxWidth);
      if (this.#cache.size > 2000) this.#cache.clear();
      this.#cache.set(key, shaped);
    }
    return shaped;
  }

  #layout(raw: string, style: TextStyle, maxWidth: number): ShapedText {
    const font = this.get(style.font);
    const size = style.size;
    const tracking = (style.tracking ?? 0) * size;
    const text = style.upper ? raw.toUpperCase() : raw;
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
    for (const word of words) {
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
    if (style.maxLines && lines.length > style.maxLines) lines.length = style.maxLines;

    const widths = lines.map((line) =>
      line.reduce((w, word, i) => w + word.width + (i < line.length - 1 ? word.space : 0), 0),
    );
    // Measurement reports the natural width; alignment happens inside the
    // width we were given (the node's final box when painting).
    const natural = Math.max(0, ...widths);
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

export async function loadFontJson(url: string): Promise<AtlasJson> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font metrics failed: ${response.status} ${url}`);
  return (await response.json()) as AtlasJson;
}
