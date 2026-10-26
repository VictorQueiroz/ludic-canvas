import type { ReactNode } from 'react';
import { createAssetResolver, type AssetResolver, type ImageAssets } from './assets.ts';
import { defaultAssets } from './defaults.ts';
import { UiBatch } from './gfx/batch.ts';
import { Font, FontBook, loadFontJson, type AtlasJson } from './gfx/font.ts';
import { createTexture, parseColor } from './gfx/gl.ts';
import { TextureStore } from './gfx/textures.ts';
import { UiRuntime } from './runtime/runtime.ts';
import { YogaLayout } from './wasm/layout.ts';

/** An MTSDF atlas and its metrics, produced by msdf-atlas-gen. Maximum: four faces per root. */
export interface FontSource {
  name: string;
  atlas: string;
  metrics: string | AtlasJson;
}

/** Visual defaults. Individual primitive styles take precedence. */
export interface UITheme {
  textColor: string;
  emphasisColor: string;
  focusRing: string;
}

/** CSS and device-pixel dimensions of the latest frame. */
export interface FrameInfo {
  width: number;
  height: number;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
  drawCalls: number;
}

/** Browser root configuration. Game state and image content stay application-owned. */
export interface UIOptions {
  canvas: HTMLCanvasElement;
  /** Existing WebGL 1 context. Draw UI last and restore engine state before its next pass. */
  context?: WebGLRenderingContext;
  /** WebAssembly URL or bytes. Defaults to the bundled Yoga reactor. */
  layout?: string | ArrayBuffer | Uint8Array;
  /** First face is the default. Omit to use bundled Barlow Condensed. */
  fonts?: readonly FontSource[];
  assets?: ImageAssets | AssetResolver;
  theme?: Partial<UITheme>;
  /** Defaults to true. Set false and call frame() from the game's loop. */
  autoStart?: boolean;
  /** Resize backing canvas to CSS dimensions. Defaults to false for a supplied context. */
  manageCanvasSize?: boolean;
  /** Device-pixel ratio cap when managing canvas size. Default: 2. */
  maxDpr?: number;
  /** Clear before drawing. Omit for transparent overlay or shared-context rendering. */
  clearColor?: string;
  /** Existing overlay aligned with the canvas. Otherwise created inside its parent. */
  accessibilityContainer?: HTMLElement;
  /** Positive text measurement multiplier. Default: 1. */
  textScale?: number;
  /** Defaults to the browser's prefers-reduced-motion setting. */
  reducedMotion?: boolean;
  /** Soft cache budget in bytes. Currently visible textures may exceed it. */
  textureBudgetBytes?: number;
  onError?: (error: unknown) => void;
}

/** A mounted React interface and its layout, input and GPU resources. */
export interface UIRoot {
  /** Schedule an update. State, context and ordinary React hooks work inside the tree. */
  render(element: ReactNode): void;
  /** Draw a frame; now is a requestAnimationFrame timestamp in milliseconds. */
  frame(now?: number): FrameInfo;
  /** Start or resume automatic drawing. Idempotent. */
  start(): void;
  /** Pause automatic drawing; the React tree stays mounted. */
  stop(): void;
  /** Unmount React, cancel frames, remove listeners and free resources. Idempotent. */
  destroy(): void;
  setTextScale(scale: number): void;
  setReducedMotion(enabled: boolean): void;
  setTheme(theme: Partial<UITheme>): void;
  /** Preload image identifiers. Rejects on unknown assets or failed requests. */
  preloadImages(ids: readonly string[]): Promise<void>;
  /** Host tree with computed boxes for development tools. */
  inspect(): unknown;
}

const mounted = new WeakSet<HTMLCanvasElement>();
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
}

/** Create a React → Yoga WebAssembly → WebGL interface on a browser canvas. */
export async function createUI(options: UIOptions): Promise<UIRoot> {
  const { canvas } = options;
  if (mounted.has(canvas)) throw new Error('This canvas already has a UI root');
  positive(options.maxDpr ?? 2, 'maxDpr');
  positive(options.textScale ?? 1, 'textScale');
  positive(options.textureBudgetBytes ?? 64 * 1024 * 1024, 'textureBudgetBytes');
  const sources = options.fonts ?? [
    { name: 'default', atlas: defaultAssets.fontAtlas, metrics: defaultAssets.fontMetrics },
  ];
  if (!sources.length || sources.length > 4) throw new Error('Provide between one and four font atlases');
  if (new Set(sources.map((font) => font.name)).size !== sources.length || sources.some((font) => !font.name))
    throw new Error('Font names must be nonempty and unique');
  mounted.add(canvas);
  const report = options.onError ?? ((error: unknown) => console.error('[ludic-canvas]', error));
  const fonts = new FontBook();
  let layout: YogaLayout | undefined;
  let batch: UiBatch | undefined;
  let textures: TextureStore | undefined;
  let runtime: UiRuntime | undefined;
  let ownedA11y: HTMLElement | undefined;
  let restoreParent = () => {};
  const originalTabIndex = canvas.getAttribute('tabindex');
  const originalTouchAction = canvas.style.touchAction;
  const originalCursor = canvas.style.cursor;
  let gl: WebGLRenderingContext | undefined;
  try {
    gl =
      options.context ??
      canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
      }) ??
      undefined;
    if (!gl) throw new Error('WebGL 1 is unavailable');
    if (gl.canvas !== canvas) throw new Error('The context must belong to the supplied canvas');
    layout = await YogaLayout.load(options.layout ?? defaultAssets.layout);
    for (const [index, source] of sources.entries()) {
      const metrics = typeof source.metrics === 'string' ? await loadFontJson(source.metrics) : source.metrics;
      const response = await fetch(source.atlas);
      if (!response.ok) throw new Error(`Font atlas failed: ${response.status} ${source.atlas}`);
      const bitmap = await createImageBitmap(await response.blob(), {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      });
      try {
        fonts.add(new Font(source.name, index, metrics, createTexture(gl, bitmap, { premultiply: false })));
      } finally {
        bitmap.close();
      }
    }
    let a11y = options.accessibilityContainer;
    if (!a11y) {
      const parent = canvas.parentElement;
      if (!parent) throw new Error('Attach the canvas or supply an accessibilityContainer');
      const position = parent.style.position;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
        restoreParent = () => {
          parent.style.position = position;
        };
      }
      a11y = ownedA11y = document.createElement('div');
      a11y.dataset.ludicCanvas = 'accessibility';
      a11y.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
      parent.appendChild(a11y);
    }
    if (originalTabIndex === null) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    textures = new TextureStore(gl, createAssetResolver(options.assets), options.textureBudgetBytes, report);
    batch = new UiBatch(gl);
    batch.setFonts(fonts.all());
    runtime = new UiRuntime({ canvas, a11y, layout, fonts });
    Object.assign(runtime.theme, options.theme);
    runtime.setTextScale(options.textScale ?? 1);
    runtime.reducedMotion = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = gl,
      ui = runtime,
      cache = textures,
      uiBatch = batch;
    let destroyed = false,
      raf = 0,
      running = false,
      last = 0;
    const clear = options.clearColor === undefined ? undefined : parseColor(options.clearColor);
    const ensureAlive = () => {
      if (destroyed) throw new Error('UI has been destroyed');
    };
    const root: UIRoot = {
      render(element) {
        ensureAlive();
        ui.render(element);
      },
      frame(now = performance.now()) {
        ensureAlive();
        const rect = canvas.getBoundingClientRect();
        if (options.manageCanvasSize ?? !options.context) {
          const scale = Math.min(options.maxDpr ?? 2, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.round(rect.width * scale));
          const height = Math.max(1, Math.round(rect.height * scale));
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
        }
        const width = canvas.width,
          height = canvas.height;
        const dpr = rect.width > 0 ? width / rect.width : 1;
        if (ownedA11y) {
          ownedA11y.style.left = `${canvas.offsetLeft}px`;
          ownedA11y.style.top = `${canvas.offsetTop}px`;
          ownedA11y.style.width = `${rect.width}px`;
          ownedA11y.style.height = `${rect.height}px`;
        }
        context.bindFramebuffer(context.FRAMEBUFFER, null);
        context.viewport(0, 0, width, height);
        context.disable(context.DEPTH_TEST);
        context.disable(context.CULL_FACE);
        context.disable(context.STENCIL_TEST);
        context.disable(context.SCISSOR_TEST);
        context.colorMask(true, true, true, true);
        if (clear) {
          context.clearColor(clear[0] * clear[3], clear[1] * clear[3], clear[2] * clear[3], clear[3]);
          context.clear(context.COLOR_BUFFER_BIT);
        } else if (!options.context) {
          context.clearColor(0, 0, 0, 0);
          context.clear(context.COLOR_BUFFER_BIT);
        }
        cache.tick();
        const dt = last ? Math.max(0, Math.min(0.1, (now - last) / 1000)) : 1 / 60;
        last = now;
        ui.frame(uiBatch, cache, fonts, { width, height, dpr }, now, dt);
        return { width, height, dpr, cssWidth: width / dpr, cssHeight: height / dpr, drawCalls: uiBatch.drawCalls };
      },
      start() {
        ensureAlive();
        if (running) return;
        running = true;
        last = 0;
        const tick = (now: number) => {
          if (!running || destroyed) return;
          try {
            root.frame(now);
          } catch (error) {
            root.stop();
            report(error);
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      },
      destroy() {
        if (destroyed) return;
        root.stop();
        destroyed = true;
        ui.destroy();
        cache.dispose();
        uiBatch.dispose();
        for (const font of fonts.all()) context.deleteTexture(font.texture.handle);
        ownedA11y?.remove();
        restoreParent();
        if (originalTabIndex === null) canvas.removeAttribute('tabindex');
        else canvas.setAttribute('tabindex', originalTabIndex);
        canvas.style.touchAction = originalTouchAction;
        canvas.style.cursor = originalCursor;
        mounted.delete(canvas);
      },
      setTextScale(scale) {
        ensureAlive();
        positive(scale, 'textScale');
        ui.setTextScale(scale);
      },
      setReducedMotion(enabled) {
        ensureAlive();
        ui.reducedMotion = enabled;
      },
      setTheme(theme) {
        ensureAlive();
        Object.assign(ui.theme, theme);
      },
      preloadImages(ids) {
        ensureAlive();
        return cache.preload(ids);
      },
      inspect() {
        ensureAlive();
        return ui.dump();
      },
    };
    if (options.autoStart !== false) root.start();
    return root;
  } catch (error) {
    runtime?.destroy();
    if (!runtime) layout?.dispose();
    textures?.dispose();
    batch?.dispose();
    for (const font of fonts.all()) gl?.deleteTexture(font.texture.handle);
    ownedA11y?.remove();
    restoreParent();
    if (originalTabIndex === null) canvas.removeAttribute('tabindex');
    else canvas.setAttribute('tabindex', originalTabIndex);
    canvas.style.touchAction = originalTouchAction;
    canvas.style.cursor = originalCursor;
    mounted.delete(canvas);
    throw error;
  }
}
