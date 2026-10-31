import type { Font, FontBook } from '../gfx/font.ts';
import type { Painter } from '../runtime/paint.ts';

/** Renderer-owned resource. Its opaque handle never crosses into the UI model. */
export interface TextureResource {
  readonly handle: unknown;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export type Rgba = readonly [number, number, number, number];
export type MeasureFn = (width: number, widthMode: number, height: number, heightMode: number) => [number, number];

/** Each root owns an independent layout context; numeric handles are not native pointers. */
export interface LayoutBackend {
  dispose(): void;
  setPointScale(scale: number): void;
  create(): number;
  free(node: number): void;
  insert(parent: number, child: number, index: number): void;
  remove(parent: number, child: number): void;
  childCount(node: number): number;
  setMeasure(node: number, fn: MeasureFn | undefined): number;
  releaseMeasure(id: number): void;
  markDirty(node: number): void;
  setEnum(node: number, prop: number, value: number): void;
  setNumber(node: number, prop: number, value: number): void;
  setLength(node: number, prop: number, slot: number, value: number, unit: number): void;
  calculate(root: number, width: number, height: number): void;
  hasNewLayout(node: number): boolean;
  paddingBottom(node: number): number;
  readLayouts(nodes: Uint32Array, out: Float32Array): void;
}

export interface ImageProvider {
  get(id: string, pixelWidth?: number, pixelHeight?: number): TextureResource | undefined;
}

/** Premultiplied RGBA, top-left origin, device-pixel draw coordinates. */
export interface RenderContext {
  readonly drawCalls: number;
  readonly submittedQuads: number;
  begin(width: number, height: number, time: number, physicalWidth?: number, physicalHeight?: number): void;
  end(): void;
  dispose(): void;
  setClip(rect: [number, number, number, number] | undefined): void;
  rect(x: number, y: number, w: number, h: number, color: Rgba, radius?: number): void;
  ring(x: number, y: number, w: number, h: number, color: Rgba, radius: number, width: number): void;
  gradient(x: number, y: number, w: number, h: number, top: Rgba, bottom: Rgba, radius?: number): void;
  image(
    texture: TextureResource,
    x: number,
    y: number,
    w: number,
    h: number,
    uv: readonly [number, number, number, number],
    tint: Rgba,
    radius?: number,
    desaturate?: number,
    darken?: number,
  ): void;
  glyph(
    font: Font,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    uv: readonly number[],
    color: Rgba,
    pxRange: number,
    weight?: number,
  ): void;
  glow(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Rgba,
    falloff?: number,
    pulse?: number,
    phase?: number,
  ): void;
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba, dash?: number, speed?: number): void;
}

export type SurfacePoint = { x: number; y: number };
/** Browser compatibility form. Native hosts normally use SurfacePoint. */
export type ClientPoint = { clientX: number; clientY: number };

/** Host interaction implementation, isolated from layout and painting. */
export interface InputDriver {
  onPointer: (nx: number, ny: number) => void;
  onActivity: () => void;
  destroy(): void;
  setEnabled(enabled: boolean): void;
  afterPaint(): void;
  announce(text: string): void;
  focus(id: string): boolean;
  navigate(direction: 'up' | 'down' | 'left' | 'right'): boolean;
  activateFocused(): boolean;
  isPointerOverUI(point: SurfacePoint | ClientPoint): boolean;
}

export type InputFactory = (painter: Painter, commit: (callback: () => void) => void) => InputDriver;

/** Host clock and queues. Callbacks belong to this root and must be cancelled on teardown. */
export interface Scheduler {
  now(): number;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(id: number): void;
  microtask(callback: () => void): void;
}

export interface RuntimeDependencies {
  layout: LayoutBackend;
  fonts: FontBook;
  input: InputFactory;
  scheduler: Scheduler;
  onError?: (error: unknown) => void;
}
