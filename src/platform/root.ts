import { createElement } from 'react';
import { UIRootContext } from '../context.ts';
import type { FontBook } from '../gfx/font.ts';
import { UiRuntime } from '../runtime/runtime.ts';
import type { ImageProvider, LayoutBackend, RenderContext } from './contracts.ts';
import type { PlatformHost } from './host.ts';
import { PlatformInput } from './input.ts';
import type { UITheme, UIRoot } from './root-types.ts';

export interface PortableImages extends ImageProvider {
  readonly bytes: number;
  tick(): void;
  preload(ids: readonly string[]): Promise<void>;
  invalidate(ids?: readonly string[]): void;
  dispose(): void;
}

export interface PortableUIOptions {
  host: PlatformHost;
  renderer: RenderContext;
  layout: LayoutBackend;
  fonts: FontBook;
  images?: PortableImages;
  theme?: Partial<UITheme>;
  textScale?: number;
  reducedMotion?: boolean;
  autoStart?: boolean;
  profile?: boolean;
  onError?: (error: unknown) => void;
}

/** Create a root from platform services. The root takes ownership of the supplied services. */
export function createPortableUI(options: PortableUIOptions): UIRoot {
  const { host, renderer, layout, fonts } = options;
  const images: PortableImages = options.images ?? {
    bytes: 0,
    tick() {},
    invalidate() {},
    dispose() {},
    get(id) {
      throw new Error(`No image provider configured for ${id}`);
    },
    async preload(ids) {
      if (ids.length) throw new Error('No image provider configured');
    },
  };
  let runtime: UiRuntime;
  try {
    if (!Number.isFinite(options.textScale ?? 1) || (options.textScale ?? 1) <= 0)
      throw new Error('textScale must be positive');
    runtime = new UiRuntime({
      layout,
      fonts,
      scheduler: host.scheduler,
      input: (painter, commit) => new PlatformInput(painter, host, commit),
      onError: options.onError,
    });
  } catch (error) {
    try {
      layout.dispose();
    } finally {
      try {
        renderer.dispose();
      } finally {
        try {
          images.dispose();
        } finally {
          host.destroy();
        }
      }
    }
    throw error;
  }
  Object.assign(runtime.theme, options.theme);
  runtime.reducedMotion = options.reducedMotion ?? false;
  runtime.setTextScale(options.textScale ?? 1);
  let destroyed = false,
    running = false,
    scheduled: number | undefined,
    last: number | undefined;
  const alive = () => {
    if (destroyed) throw new Error('UI has been destroyed');
  };
  const root: UIRoot = {
    render(element) {
      alive();
      runtime.render(createElement(UIRootContext.Provider, { value: root }, element));
    },
    frame(now = host.scheduler.now()) {
      alive();
      const size = host.size();
      if (
        ![size.width, size.height, size.scale, now].every(Number.isFinite) ||
        size.width < 0 ||
        size.height < 0 ||
        size.scale <= 0
      )
        throw new Error('Invalid surface dimensions or frame timestamp');
      const width = Math.round(size.width * size.scale),
        height = Math.round(size.height * size.scale);
      const frame = {
        width,
        height,
        dpr: size.scale,
        cssWidth: size.width,
        cssHeight: size.height,
        drawCalls: 0,
        contextLost: false,
        textureBytes: images.bytes,
      };
      if (!width || !height) {
        runtime.input.setEnabled(false);
        last = undefined;
        return frame;
      }
      runtime.input.setEnabled(true);
      images.tick();
      const dt = last === undefined ? 0 : Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      const profile = runtime.frame(renderer, images, fonts, frame, now, dt, options.profile);
      return { ...frame, drawCalls: renderer.drawCalls, textureBytes: images.bytes, ...(profile ? { profile } : {}) };
    },
    start() {
      alive();
      if (running) return;
      running = true;
      const tick = (now: number) => {
        scheduled = undefined;
        if (!running || destroyed) return;
        try {
          root.frame(now);
        } catch (error) {
          root.stop();
          if (options.onError) options.onError(error);
          else throw error;
        }
        if (running && !destroyed) scheduled = host.scheduler.requestFrame(tick);
      };
      scheduled = host.scheduler.requestFrame(tick);
    },
    stop() {
      running = false;
      const pending = scheduled;
      scheduled = undefined;
      last = undefined;
      if (pending !== undefined) host.scheduler.cancelFrame(pending);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        root.stop();
      } finally {
        try {
          runtime.destroy();
        } finally {
          try {
            renderer.dispose();
          } finally {
            try {
              images.dispose();
            } finally {
              host.destroy();
            }
          }
        }
      }
    },
    setTextScale(scale) {
      alive();
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('textScale must be positive');
      runtime.setTextScale(scale);
    },
    setReducedMotion(enabled) {
      alive();
      runtime.reducedMotion = enabled;
    },
    setTheme(theme) {
      alive();
      Object.assign(runtime.theme, theme);
    },
    preloadImages(ids) {
      alive();
      return images.preload(ids);
    },
    invalidateImages(ids) {
      alive();
      images.invalidate(ids);
    },
    focus: (id) => !destroyed && runtime.input.focus(id),
    navigate: (direction) => !destroyed && runtime.input.navigate(direction),
    activateFocused: () => !destroyed && runtime.input.activateFocused(),
    isPointerOverUI: (point) => !destroyed && runtime.input.isPointerOverUI(point),
    inspect: () => runtime.dump(),
  };
  if (options.autoStart) {
    try {
      root.start();
    } catch (error) {
      root.destroy();
      throw error;
    }
  }
  return root;
}
