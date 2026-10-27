import { createElement, type ReactNode } from 'react';
import { UIRootContext } from './context.ts';
import { createAssetResolver, type AssetResolver, type ImageAssets } from './assets.ts';
import { defaultAssets } from './defaults.ts';
import { UiBatch } from './gfx/batch.ts';
import { Font, FontBook, loadFontJson, validateFontMetrics, type AtlasJson, type FontDiagnostic } from './gfx/font.ts';
import { createTexture, parseColor } from './gfx/gl.ts';
import { TextureStore } from './gfx/textures.ts';
import { UiRuntime } from './runtime/runtime.ts';
import type { FrameProfile } from './runtime/profile.ts';
import { YogaLayout } from './wasm/layout.ts';
import { defaultResourceLimits, fetchBytes, throwIfAborted, type ResourceLimits } from './resources.ts';

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
  contextLost: boolean;
  textureBytes: number;
  /** Present only when profiling is enabled and a frame is drawn. */
  profile?: FrameProfile;
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
  /** Collect runtime stage timings and counts. Default: false. Adds measurement overhead. */
  profile?: boolean;
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
  /** Abort initialization; after initialization, abort destroys this root. */
  signal?: AbortSignal;
  resourceLimits?: Partial<ResourceLimits>;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onError?: (error: unknown) => void;
  /** Opt-in missing-glyph diagnostics, queued after layout. At most 1024 unique codepoint/chain reports per root. */
  onFontDiagnostic?: (diagnostic: FontDiagnostic) => void;
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
  invalidateImages(ids?: readonly string[]): void;
  /** Focus a named pressable, or navigate spatially from a gamepad adapter. */
  focus(id: string): boolean;
  /** Navigate mounted geometry or an owning collection's logical items. Accepted collection focus settles in a frame. */
  navigate(direction: 'up' | 'down' | 'left' | 'right'): boolean;
  activateFocused(): boolean;
  inspect(): unknown;
}

// Ownership lives on the associated DOM surface, including across bundled copies.
const ownerKey = Symbol.for('ludic-canvas.root');
const parentKey = Symbol.for('ludic-canvas.parent-position');
type OwnedCanvas = HTMLCanvasElement & { [ownerKey]?: object };
type OwnedParent = HTMLElement & { [parentKey]?: { count: number; original: string } };
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
}
function positionParent(parent: OwnedParent): () => void {
  let state = parent[parentKey];
  if (state) state.count++;
  else if (getComputedStyle(parent).position === 'static') {
    state = parent[parentKey] = { count: 1, original: parent.style.position };
    parent.style.position = 'relative';
  }
  if (!state) return () => {};
  return () => {
    if (--state.count === 0) {
      if (parent.style.position === 'relative') parent.style.position = state.original;
      delete parent[parentKey];
    }
  };
}

/** Create a React → Yoga WebAssembly → WebGL interface on a browser canvas. */
export async function createUI(options: UIOptions): Promise<UIRoot> {
  const canvas = options.canvas as OwnedCanvas;
  if (canvas[ownerKey]) throw new Error('This canvas already has a UI root');
  throwIfAborted(options.signal);
  positive(options.maxDpr ?? 2, 'maxDpr');
  positive(options.textScale ?? 1, 'textScale');
  positive(options.textureBudgetBytes ?? 64 * 1024 * 1024, 'textureBudgetBytes');
  const limits = { ...defaultResourceLimits, ...options.resourceLimits };
  for (const [name, value] of Object.entries(limits)) {
    positive(value, `resourceLimits.${name}`);
    if (!Number.isSafeInteger(value)) throw new Error(`resourceLimits.${name} must be an integer`);
  }
  const sources = options.fonts ?? [
    { name: 'default', atlas: defaultAssets.fontAtlas, metrics: defaultAssets.fontMetrics },
  ];
  if (!sources.length || sources.length > 4) throw new Error('Provide between one and four font atlases');
  if (new Set(sources.map((font) => font.name)).size !== sources.length || sources.some((font) => !font.name))
    throw new Error('Font names must be nonempty and unique');
  const owner = {};
  canvas[ownerKey] = owner;
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  const report = (error: unknown) => {
    try {
      (options.onError ?? ((error: unknown) => console.error('[ludic-canvas]', error)))(error);
    } catch (callbackError) {
      console.error('[ludic-canvas] onError failed', callbackError);
    }
  };
  const notify = (callback: (() => void) | undefined) => {
    try {
      callback?.();
    } catch (error) {
      report(error);
    }
  };
  const fonts = new FontBook(
    options.onFontDiagnostic
      ? (diagnostic) => {
          queueMicrotask(() => {
            if (destroyed) return;
            try {
              options.onFontDiagnostic?.(diagnostic);
            } catch (error) {
              report(error);
            }
          });
        }
      : undefined,
  );
  const loaded: { name: string; metrics: AtlasJson; blob: Blob }[] = [];
  let layout: YogaLayout | undefined,
    batch: UiBatch | undefined,
    textures: TextureStore | undefined,
    runtime: UiRuntime | undefined;
  let ownedA11y: HTMLElement | undefined;
  let restoreParent = () => {};
  let gl: WebGLRenderingContext | undefined;
  let destroyed = false,
    lost = false,
    generation = 0,
    raf = 0,
    running = false,
    last = 0;
  const originalTabIndex = canvas.getAttribute('tabindex');
  const originalTouchAction = canvas.style.touchAction,
    originalCursor = canvas.style.cursor;
  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    generation++;
    running = false;
    cancelAnimationFrame(raf);
    lifetime.abort();
    options.signal?.removeEventListener('abort', abort);
    try {
      runtime?.destroy();
    } finally {
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
      if (canvas[ownerKey] === owner) delete canvas[ownerKey];
    }
  };
  const abort = () => cleanup();
  options.signal?.addEventListener('abort', abort, { once: true });
  const uploadFonts = async () => {
    const created: Font[] = [];
    try {
      for (const [index, source] of loaded.entries()) {
        const bitmap = await createImageBitmap(source.blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        try {
          throwIfAborted(signal);
          if (gl!.isContextLost()) throw new Error('WebGL context lost while loading fonts');
          const texture = createTexture(gl!, bitmap, { premultiply: false, maxSize: limits.maxTextureSize });
          try {
            created.push(new Font(source.name, index, source.metrics, texture));
          } catch (error) {
            gl!.deleteTexture(texture.handle);
            throw error;
          }
        } finally {
          bitmap.close();
        }
      }
      return created;
    } catch (error) {
      for (const font of created) gl!.deleteTexture(font.texture.handle);
      throw error;
    }
  };
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
    // GLSL 1.00 and OES vertex arrays are a WebGL 1 contract.
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
      throw new Error('Supply a WebGL 1 context');
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        lost = true;
        generation++;
        runtime?.input.setEnabled(false);
        textures?.invalidate();
        notify(options.onContextLost);
      },
      { signal },
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        if (!runtime || destroyed) return;
        const attempt = ++generation;
        void (async () => {
          const replacement = await uploadFonts();
          if (destroyed || attempt !== generation) {
            for (const font of replacement) gl!.deleteTexture(font.texture.handle);
            return;
          }
          let next: UiBatch;
          try {
            next = new UiBatch(gl!);
            next.setFonts(replacement);
          } catch (error) {
            for (const font of replacement) gl!.deleteTexture(font.texture.handle);
            throw error;
          }
          batch?.dispose();
          for (const font of fonts.all()) gl!.deleteTexture(font.texture.handle);
          for (const font of replacement) fonts.replace(font);
          batch = next;
          lost = false;
          last = 0;
          notify(options.onContextRestored);
        })().catch((error) => {
          if (!destroyed) report(error);
        });
      },
      { signal },
    );
    layout = await YogaLayout.load(options.layout ?? defaultAssets.layout, { signal, maxBytes: limits.maxBytes });
    for (const source of sources) {
      const metrics = validateFontMetrics(
        structuredClone(
          typeof source.metrics === 'string'
            ? await loadFontJson(source.metrics, { signal, maxBytes: limits.maxBytes })
            : source.metrics,
        ),
      );
      const fontBytes =
        loaded.reduce((sum, source) => sum + source.metrics.atlas.width * source.metrics.atlas.height * 4, 0) +
        metrics.atlas.width * metrics.atlas.height * 4;
      if (fontBytes > limits.maxFontBytes) throw new Error('Font atlases exceed resourceLimits.maxFontBytes');
      const bytes = await fetchBytes(source.atlas, { signal, maxBytes: limits.maxBytes, label: 'Font atlas' });
      loaded.push({ name: source.name, metrics, blob: new Blob([bytes]) });
    }
    for (const font of await uploadFonts()) fonts.add(font);
    throwIfAborted(signal);
    let a11y = options.accessibilityContainer;
    if (!a11y) {
      const parent = canvas.parentElement;
      if (!parent) throw new Error('Attach the canvas or supply an accessibilityContainer');
      restoreParent = positionParent(parent);
      a11y = ownedA11y = document.createElement('div');
      a11y.dataset.ludicCanvas = 'accessibility';
      a11y.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
      parent.appendChild(a11y);
    }
    if (originalTabIndex === null) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    textures = new TextureStore(gl, createAssetResolver(options.assets), options.textureBudgetBytes, report, limits);
    batch = new UiBatch(gl);
    batch.setFonts(fonts.all());
    runtime = new UiRuntime({ canvas, a11y, layout, fonts, onError: report });
    Object.assign(runtime.theme, options.theme);
    runtime.setTextScale(options.textScale ?? 1);
    runtime.reducedMotion = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ui = runtime,
      cache = textures,
      context = gl;
    const clear = options.clearColor === undefined ? undefined : parseColor(options.clearColor);
    const ensureAlive = () => {
      if (destroyed) throw new Error('UI has been destroyed');
    };
    const root: UIRoot = {
      render(element) {
        ensureAlive();
        ui.render(createElement(UIRootContext.Provider, { value: root }, element));
      },
      frame(now = performance.now()) {
        ensureAlive();
        const rect = canvas.getBoundingClientRect();
        if (options.manageCanvasSize ?? !options.context) {
          const scale = Math.min(options.maxDpr ?? 2, window.devicePixelRatio || 1);
          const width = Math.max(1, Math.round(rect.width * scale)),
            height = Math.max(1, Math.round(rect.height * scale));
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
        }
        const width = canvas.width,
          height = canvas.height,
          dpr = rect.width > 0 ? width / rect.width : 1;
        const suspended =
          lost || context.isContextLost() || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0;
        ui.input.setEnabled(!suspended);
        if (ownedA11y) {
          ownedA11y.style.left = `${canvas.offsetLeft}px`;
          ownedA11y.style.top = `${canvas.offsetTop}px`;
          ownedA11y.style.width = `${rect.width}px`;
          ownedA11y.style.height = `${rect.height}px`;
        }
        const info = {
          width,
          height,
          dpr,
          cssWidth: rect.width,
          cssHeight: rect.height,
          drawCalls: 0,
          contextLost: lost || context.isContextLost(),
          textureBytes: cache.bytes,
        };
        if (suspended) {
          last = 0;
          return info;
        }
        context.bindFramebuffer(context.FRAMEBUFFER, null);
        context.viewport(0, 0, width, height);
        context.disable(context.DEPTH_TEST);
        context.disable(context.CULL_FACE);
        context.disable(context.STENCIL_TEST);
        context.disable(context.SCISSOR_TEST);
        context.colorMask(true, true, true, true);
        if (clear) {
          context.clearColor(...clear);
          context.clear(context.COLOR_BUFFER_BIT);
        } else if (!options.context) {
          context.clearColor(0, 0, 0, 0);
          context.clear(context.COLOR_BUFFER_BIT);
        }
        cache.tick();
        const dt = last ? Math.max(0, Math.min(0.1, (now - last) / 1000)) : 1 / 60;
        last = now;
        const profile = ui.frame(
          batch!,
          cache,
          fonts,
          { width, height, dpr, cssWidth: rect.width, cssHeight: rect.height },
          now,
          dt,
          options.profile,
        );
        return { ...info, drawCalls: batch!.drawCalls, textureBytes: cache.bytes, ...(profile ? { profile } : {}) };
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
      destroy: cleanup,
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
      invalidateImages(ids) {
        ensureAlive();
        cache.invalidate(ids);
      },
      focus(id) {
        ensureAlive();
        return ui.input.focus(id);
      },
      navigate(direction) {
        ensureAlive();
        return ui.input.navigate(direction);
      },
      activateFocused() {
        ensureAlive();
        return ui.input.activateFocused();
      },
      inspect() {
        ensureAlive();
        return ui.dump();
      },
    };
    if (options.autoStart !== false) root.start();
    return root;
  } catch (error) {
    cleanup();
    throw error;
  }
}
