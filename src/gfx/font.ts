// MSDF fonts: metrics from msdf-atlas-gen's JSON, text layout (word wrap,
// alignment, tracking, **emphasis** runs) into glyph quads in CSS pixels.

import type { TextureResource as Texture } from '../platform/contracts.ts';

export type FontName = string;
/** An explicitly ordered list of registered faces. No implicit system-font lookup. */
export type FontFamily = FontName | readonly FontName[];

/** Opt-in, root-local diagnostic. Does not contain the original text or game state. */
export interface FontDiagnostic {
  type: 'missing-glyph';
  codePoint: number;
  character: string;
  fonts: readonly FontName[];
  replacement: '?';
  message: string;
}

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
  /** Additive pair adjustments, in the same emSize units as glyph advances. */
  kerning?: { unicode1: number; unicode2: number; advance: number }[];
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
  if (json.kerning !== undefined) {
    if (!Array.isArray(json.kerning) || json.kerning.length > 262144)
      fail('kerning must be an array with at most 262144 pairs');
    const pairs = new Set<number>();
    for (const pair of json.kerning) {
      if (!pair || !seen.has(pair.unicode1) || !seen.has(pair.unicode2) || !Number.isFinite(pair.advance))
        fail('kerning pairs must reference atlas glyphs and have finite advances');
      const key = pair.unicode1 * 0x110000 + pair.unicode2;
      if (pairs.has(key)) fail('duplicate kerning pair');
      pairs.add(key);
    }
  }
  return json;
}

interface Glyph {
  advance: number;
  plane?: Bounds;
  uv?: [number, number, number, number];
}

export class Font {
  readonly glyphs = new Map<number, Glyph>();
  readonly #kerning = new Map<number, number>();
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
    for (const pair of json.kerning ?? [])
      this.#kerning.set(pair.unicode1 * 0x110000 + pair.unicode2, pair.advance / em);
  }

  kerning(left: number, right: number): number {
    return this.#kerning.get(left * 0x110000 + right) ?? 0;
  }

  glyph(code: number): Glyph {
    return this.glyphs.get(code) ?? this.glyphs.get(63)!; // '?'
  }
}

export interface TextStyle {
  font: FontFamily;
  size: number;
  lineHeight?: number; // multiplier of the font's natural line height
  tracking?: number; // extra letter spacing, in em
  align?: 'left' | 'center' | 'right';
  upper?: boolean;
  rich?: boolean; // parse **emphasis**
  maxLines?: number;
  ellipsis?: boolean;
  kerning?: boolean;
}

export interface ShapedGlyph {
  font: FontName;
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

interface ResolvedChar {
  code: number;
  font: Font;
  glyph: Glyph;
  emphasis: boolean;
}
interface TextLine {
  chars: ResolvedChar[];
  width: number;
}

export class FontBook {
  readonly #fonts = new Map<FontName, Font>();
  readonly #cache = new Map<string, ShapedText>();
  readonly #reported = new Set<string>();
  readonly #onDiagnostic?: (diagnostic: FontDiagnostic) => void;
  #cachedGlyphs = 0;

  constructor(onDiagnostic?: (diagnostic: FontDiagnostic) => void) {
    this.#onDiagnostic = onDiagnostic;
  }

  get defaultName(): string {
    const name = this.#fonts.keys().next().value;
    if (!name) throw new Error('No font is registered');
    return name;
  }

  #clearCache() {
    this.#cache.clear();
    this.#cachedGlyphs = 0;
  }
  add(font: Font) {
    if (this.#fonts.has(font.name)) throw new Error(`Duplicate font: ${font.name}`);
    if (this.#fonts.size >= 4) throw new Error('At most four font atlases are supported');
    this.#fonts.set(font.name, font);
    this.#clearCache();
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
    this.#clearCache();
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
    const names = typeof style.font === 'string' ? [style.font] : [...style.font];
    if (!names.length || names.length > 4 || new Set(names).size !== names.length)
      throw new Error('Provide a font name or an ordered chain of one to four unique font names');
    const fonts = names.map((name) => this.get(name));
    const key = JSON.stringify([
      names,
      style.size,
      style.lineHeight ?? 1,
      style.tracking ?? 0,
      style.align ?? 'left',
      !!style.upper,
      !!style.rich,
      style.maxLines ?? 0,
      !!style.ellipsis,
      style.kerning !== false,
      maxWidth,
      text,
    ]);
    let shaped = this.#cache.get(key);
    if (shaped) {
      this.#cache.delete(key);
      this.#cache.set(key, shaped);
    } else {
      shaped = this.#layout(text, style, maxWidth, fonts);
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

  #resolve(code: number, emphasis: boolean, fonts: Font[]): ResolvedChar {
    for (const font of fonts) {
      const glyph = font.glyphs.get(code);
      if (glyph) return { code, font, glyph, emphasis };
    }
    if (this.#onDiagnostic && this.#reported.size < 1024) {
      const names = fonts.map((font) => font.name);
      const key = JSON.stringify([names, code]);
      if (!this.#reported.has(key)) {
        this.#reported.add(key);
        const character = String.fromCodePoint(code);
        this.#onDiagnostic({
          type: 'missing-glyph',
          codePoint: code,
          character,
          fonts: names,
          replacement: '?',
          message: `Missing glyph U+${code.toString(16).toUpperCase().padStart(4, '0')} in [${names.join(', ')}]; rendering '?'. Add the codepoint to a font charset and regenerate its atlas, or register a face containing it in this fontFamily chain.`,
        });
      }
    }
    const font = fonts[0]!;
    return { code: 63, font, glyph: font.glyph(63), emphasis };
  }

  #layout(raw: string, style: TextStyle, maxWidth: number, fonts: Font[]): ShapedText {
    const primary = fonts[0]!;
    const size = style.size;
    const tracking = (style.tracking ?? 0) * size;
    const advance = (previous: ResolvedChar | undefined, char: ResolvedChar) => {
      const pair =
        style.kerning !== false && previous?.font === char.font
          ? char.font.kerning(previous.code, char.code) * size
          : 0;
      return pair + char.glyph.advance * size + tracking;
    };
    const measure = (chars: ResolvedChar[], previous?: ResolvedChar) => {
      let width = 0;
      for (const char of chars) {
        width += advance(previous, char);
        previous = char;
      }
      return width;
    };
    const lines: TextLine[] = [{ chars: [], width: 0 }];
    let line = lines[0]!;
    const nextLine = () => {
      line = { chars: [], width: 0 };
      lines.push(line);
    };
    const append = (char: ResolvedChar) => {
      line.width += advance(line.chars.at(-1), char);
      line.chars.push(char);
    };
    let pendingSpaces: ResolvedChar[] = [];
    let word: ResolvedChar[] = [];
    const flush = () => {
      if (!word.length) return;
      const last = pendingSpaces.at(-1) ?? line.chars.at(-1);
      const needed = measure(pendingSpaces, line.chars.at(-1)) + measure(word, last);
      if (line.chars.length && line.width + needed > maxWidth + 0.01) {
        nextLine();
        pendingSpaces = [];
      }
      // Whitespace at a wrapping boundary is discarded; explicit leading spaces survive.
      for (const char of pendingSpaces) append(char);
      pendingSpaces = [];
      for (const char of word) {
        if (line.chars.length && line.width + advance(line.chars.at(-1), char) > maxWidth + 0.01) nextLine();
        append(char);
      }
      word = [];
    };
    const normalized = raw.replace(/\r\n?/g, '\n');
    const text = style.upper ? normalized.toUpperCase() : normalized;
    let emphasis = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (style.rich && ch === '*' && text[i + 1] === '*') {
        emphasis = !emphasis;
        i++;
      } else if (ch === '\n') {
        flush();
        pendingSpaces = [];
        nextLine();
      } else if (ch === ' ') {
        flush();
        pendingSpaces.push(this.#resolve(32, emphasis, fonts));
      } else {
        const code = text.codePointAt(i)!;
        if (code > 0xffff) i++;
        word.push(this.#resolve(code, emphasis, fonts));
      }
    }
    flush();
    if (style.maxLines && lines.length > style.maxLines) {
      lines.length = style.maxLines;
      if (style.ellipsis) {
        line = lines.at(-1)!;
        const codes = fonts.some((font) => font.glyphs.has(0x2026)) ? [0x2026] : [46, 46, 46];
        let marker = codes.map((code) => this.#resolve(code, false, fonts));
        // A marker that cannot fit is omitted instead of drawing beyond the box.
        if (measure(marker) > maxWidth) marker = [];
        while (line.chars.length && line.width + measure(marker, line.chars.at(-1)) > maxWidth + 0.01) {
          const last = line.chars.pop()!;
          line.width -= advance(line.chars.at(-1), last);
        }
        for (const char of marker) append(char);
      }
    }
    const natural = lines.reduce((maximum, current) => Math.max(maximum, current.width), 0);
    const boxWidth = Number.isFinite(maxWidth) ? Math.max(natural, maxWidth) : natural;
    const glyphs: ShapedGlyph[] = [];
    let height = 0;
    for (const current of lines) {
      // All faces share a baseline; fallback metrics enlarge the line, never shrink it.
      let ascender = primary.ascender,
        descender = primary.descender,
        naturalHeight = primary.lineHeight;
      for (const char of current.chars) {
        ascender = Math.min(ascender, char.font.ascender);
        descender = Math.max(descender, char.font.descender);
        naturalHeight = Math.max(naturalHeight, char.font.lineHeight);
      }
      const lineH = Math.max(naturalHeight, descender - ascender) * size * (style.lineHeight ?? 1);
      const baseline = height + (lineH - (descender - ascender) * size) / 2 - ascender * size;
      let pen =
        style.align === 'center'
          ? (boxWidth - current.width) / 2
          : style.align === 'right'
            ? boxWidth - current.width
            : 0;
      let previous: ResolvedChar | undefined;
      for (const char of current.chars) {
        const g = char.glyph;
        const step = advance(previous, char);
        pen += step - g.advance * size - tracking;
        if (g.plane && g.uv)
          glyphs.push({
            font: char.font.name,
            x0: pen + g.plane.left * size,
            y0: baseline + g.plane.top * size,
            x1: pen + g.plane.right * size,
            y1: baseline + g.plane.bottom * size,
            uv: g.uv,
            emphasis: char.emphasis,
          });
        pen += g.advance * size + tracking;
        previous = char;
      }
      height += lineH;
    }
    return { width: Math.ceil(natural), height: Math.ceil(height), lines: lines.length, glyphs };
  }
}
