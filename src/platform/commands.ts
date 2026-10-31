import type { Font } from '../gfx/font.ts';
import type { RenderContext, Rgba, TextureResource } from './contracts.ts';

/** Fixed-width records make one native submission possible without per-glyph bridge calls. */
export const DRAW_COMMAND_VERSION = 1;
export const DRAW_COMMAND_STRIDE = 24;
export const DrawOp = { Rect: 0, Ring: 1, Gradient: 2, Image: 3, Glyph: 4, Glow: 5, Line: 6, Clip: 7 } as const;

export interface DrawFrame {
  version: typeof DRAW_COMMAND_VERSION;
  width: number;
  height: number;
  physicalWidth: number;
  physicalHeight: number;
  time: number;
  /** Borrowed until the next begin(). A retaining renderer must copy. */
  commands: Float32Array;
  resources: readonly TextureResource[];
}

/** Reusable command writer. Resource handles remain in a separate root-local table. */
export class CommandRenderer implements RenderContext {
  #data = new Float32Array(DRAW_COMMAND_STRIDE * 256);
  #length = 0;
  #resources: TextureResource[] = [];
  #ids = new Map<TextureResource, number>();
  #open = false;
  protected destroyed = false;
  drawCalls = 0;
  submittedQuads = 0;
  #frame: Omit<DrawFrame, 'commands' | 'resources'> = {
    version: 1,
    width: 0,
    height: 0,
    physicalWidth: 0,
    physicalHeight: 0,
    time: 0,
  };
  readonly submit: (frame: DrawFrame) => void;
  constructor(submit: (frame: DrawFrame) => void) {
    this.submit = submit;
  }
  begin(width: number, height: number, time: number, physicalWidth = width, physicalHeight = height) {
    if (this.destroyed || this.#open) throw new Error('Render context is destroyed or already in a frame');
    this.#open = true;
    this.#length = 0;
    this.#resources = [];
    this.#ids.clear();
    this.drawCalls = this.submittedQuads = 0;
    this.#frame = { version: 1, width, height, physicalWidth, physicalHeight, time };
  }
  #write(op: number, values: readonly number[]) {
    if (!this.#open) throw new Error('Draw outside a frame');
    const end = this.#length + DRAW_COMMAND_STRIDE;
    if (end > this.#data.length) {
      const next = new Float32Array(this.#data.length * 2);
      next.set(this.#data);
      this.#data = next;
    }
    this.#data.fill(0, this.#length, end);
    this.#data[this.#length] = op;
    this.#data.set(values, this.#length + 1);
    this.#length = end;
    if (op !== DrawOp.Clip) this.submittedQuads++;
  }
  #resource(texture: TextureResource) {
    let id = this.#ids.get(texture);
    if (id === undefined) {
      id = this.#resources.length;
      this.#resources.push(texture);
      this.#ids.set(texture, id);
    }
    return id;
  }
  end() {
    if (!this.#open) return;
    this.#open = false;
    this.submit({ ...this.#frame, commands: this.#data.subarray(0, this.#length), resources: this.#resources });
    this.drawCalls = this.#length ? 1 : 0;
  }
  dispose() {
    this.destroyed = true;
    this.#open = false;
    this.#resources = [];
    this.#ids.clear();
    this.#data = new Float32Array(0);
  }
  setClip(rect: [number, number, number, number] | undefined) {
    this.#write(DrawOp.Clip, rect ? [1, ...rect] : [0]);
  }
  rect(x: number, y: number, w: number, h: number, c: Rgba, radius = 0) {
    this.#write(DrawOp.Rect, [x, y, w, h, ...c, radius]);
  }
  ring(x: number, y: number, w: number, h: number, c: Rgba, radius: number, width: number) {
    this.#write(DrawOp.Ring, [x, y, w, h, ...c, radius, width]);
  }
  gradient(x: number, y: number, w: number, h: number, top: Rgba, bottom: Rgba, radius = 0) {
    this.#write(DrawOp.Gradient, [x, y, w, h, ...top, ...bottom, radius]);
  }
  image(
    texture: TextureResource,
    x: number,
    y: number,
    w: number,
    h: number,
    uv: readonly [number, number, number, number],
    tint: Rgba,
    radius = 0,
    desaturate = 0,
    darken = 0,
  ) {
    this.#write(DrawOp.Image, [x, y, w, h, ...tint, ...uv, this.#resource(texture), radius, desaturate, darken]);
  }
  glyph(
    font: Font,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    uv: readonly number[],
    color: Rgba,
    pxRange: number,
    weight = 0,
  ) {
    this.#write(DrawOp.Glyph, [
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      ...color,
      ...uv,
      this.#resource(font.texture),
      pxRange,
      weight,
    ]);
  }
  glow(cx: number, cy: number, rx: number, ry: number, color: Rgba, falloff = 3, pulse = 0, phase = 0) {
    this.#write(DrawOp.Glow, [cx, cy, rx, ry, ...color, falloff, pulse, phase]);
  }
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba, dash = 0, speed = 0) {
    this.#write(DrawOp.Line, [x1, y1, x2, y2, ...color, width, dash, speed]);
  }
}

/** Headless acquisition backend: captures the actual commands, without drawing pixels. */
export class RecordingRenderer extends CommandRenderer {
  frame: DrawFrame = {
    version: 1,
    width: 0,
    height: 0,
    physicalWidth: 0,
    physicalHeight: 0,
    time: 0,
    commands: new Float32Array(),
    resources: [],
  };
  declare destroyed: boolean;
  constructor() {
    super((frame) => {
      this.frame = { ...frame, commands: frame.commands.slice(), resources: [...frame.resources] };
    });
  }
  override dispose() {
    super.dispose();
    this.frame = { ...this.frame, commands: new Float32Array(), resources: [] };
  }
}
