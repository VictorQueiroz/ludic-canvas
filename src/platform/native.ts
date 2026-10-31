import { Font, FontBook, validateFontMetrics } from '../gfx/font.ts';
import { CommandRenderer } from './commands.ts';
import type { PlatformEvent, PlatformHost } from './host.ts';
import { NativeYogaLayout, type NativeLayoutBinding } from './native-layout.ts';
import { createPortableUI, type PortableUIOptions, type PortableImages } from './root.ts';
import type { TextureResource } from './contracts.ts';
import type { UIRoot } from './root-types.ts';

interface NativeBridge extends NativeLayoutBinding {
  version: number;
  createSurface(title: string, width: number, height: number): number;
  size(surface: number): { width: number; height: number; scale: number };
  listen(
    surface: number,
    callback: ((event: Record<string, unknown> & { type: PlatformEvent['type'] | 'close' }) => boolean) | null,
  ): void;
  semantics(surface: number, json: string): void;
  focus(surface: number, key: number): boolean;
  selectEditor(surface: number, key: number): boolean;
  cursor(surface: number, name: string): void;
  announce(surface: number, text: string): void;
  loadImage(surface: number, name: string): TextureResource;
  releaseImage(surface: number, handle: number): void;
  submit(
    surface: number,
    commands: Float32Array,
    resources: number[],
    width: number,
    height: number,
    time: number,
  ): void;
  readAsset(name: string): string;
  destroySurface(surface: number): void;
}
declare const __ludicNative: NativeBridge;
// These queues are supplied by the native embedding, without DOM libraries.
declare const requestAnimationFrame: (callback: (now: number) => void) => number;
declare const cancelAnimationFrame: (id: number) => void;

/** Experimental macOS proof host. See docs/PORTABILITY.md for supported capabilities. */
export interface NativeUIOptions extends Pick<
  PortableUIOptions,
  'theme' | 'textScale' | 'reducedMotion' | 'profile' | 'onError'
> {
  title?: string;
  width?: number;
  height?: number;
  fonts?: readonly { name: string; atlas: string; metrics: string }[];
  /** Bundle-relative image paths. Native apps do not implicitly fetch network resources. */
  assets?: Readonly<Record<string, string>>;
  autoStart?: boolean;
}

export function createNativeUI(options: NativeUIOptions = {}): UIRoot {
  if (typeof __ludicNative === 'undefined' || __ludicNative.version !== 1)
    throw new Error('A compatible Ludic native host is required');
  const bridge = __ludicNative;
  const surface = bridge.createSurface(options.title ?? 'Ludic Canvas', options.width ?? 720, options.height ?? 640);
  let captured: number | undefined,
    disposed = false;
  let root: UIRoot | undefined;
  const host: PlatformHost = {
    scheduler: {
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
      microtask: (callback) => queueMicrotask(callback),
    },
    size: () => bridge.size(surface),
    subscribe(callback) {
      bridge.listen(surface, (raw) => {
        if (raw.type === 'close') {
          root?.destroy();
          return true;
        }
        const event = {
          defaultPrevented: false,
          shiftKey: false,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          deltaX: 0,
          deltaY: 0,
          deltaZ: 0,
          deltaMode: 0,
          repeat: false,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          buttons: 0,
          ...raw,
          preventDefault() {
            this.defaultPrevented = true;
          },
          stopPropagation() {},
        };
        callback(event as PlatformEvent);
        return event.defaultPrevented;
      });
      return () => bridge.listen(surface, null);
    },
    syncSemantics: (nodes) => bridge.semantics(surface, JSON.stringify(nodes)),
    focus: (key) => bridge.focus(surface, key ?? 0),
    focusSurface: () => {
      bridge.focus(surface, 0);
    },
    selectEditor: (key) => bridge.selectEditor(surface, key),
    setCursor: (cursor) => bridge.cursor(surface, cursor),
    capturePointer: (id) => {
      captured = id;
    },
    hasPointerCapture: (id) => captured === id,
    releasePointer: (id) => {
      if (captured === id) captured = undefined;
    },
    announce: (text) => bridge.announce(surface, text),
    destroy() {
      if (disposed) return;
      disposed = true;
      bridge.destroySurface(surface);
    },
  };
  const images = new Map<string, TextureResource>();
  const provider: PortableImages = {
    get bytes() {
      return [...images.values()].reduce((sum, image) => sum + image.bytes, 0);
    },
    get(id) {
      let image = images.get(id);
      if (!image) {
        const path = options.assets?.[id];
        if (!path) throw new Error(`Unknown bundled image: ${id}`);
        image = bridge.loadImage(surface, path);
        images.set(id, image);
      }
      return image;
    },
    tick() {},
    async preload(ids) {
      for (const id of ids) this.get(id);
    },
    invalidate(ids) {
      for (const id of ids ?? images.keys()) {
        const image = images.get(id);
        if (image) bridge.releaseImage(surface, Number(image.handle));
        images.delete(id);
      }
    },
    dispose() {
      this.invalidate();
    },
  };
  const fonts = new FontBook();
  const sources = options.fonts ?? [{ name: 'default', atlas: 'default-font.png', metrics: 'default-font.json' }];
  if (sources.length < 1 || sources.length > 4) {
    host.destroy();
    throw new Error('Provide between one and four font atlases');
  }
  try {
    let fontBytes = 0;
    for (const [index, source] of sources.entries()) {
      const metrics = validateFontMetrics(JSON.parse(bridge.readAsset(source.metrics)));
      const texture = bridge.loadImage(surface, source.atlas);
      fontBytes += texture.bytes;
      if (fontBytes > 64 * 1024 * 1024) throw new Error('Font atlases exceed 64 MiB');
      if (metrics.atlas.width !== texture.width || metrics.atlas.height !== texture.height)
        throw new Error('Atlas dimensions disagree with metrics');
      fonts.add(new Font(source.name, index, metrics, texture));
    }
    const layout = new NativeYogaLayout(bridge);
    const renderer = new CommandRenderer((frame) =>
      bridge.submit(
        surface,
        frame.commands,
        frame.resources.map((resource) => Number(resource.handle)),
        frame.width,
        frame.height,
        frame.time,
      ),
    );
    root = createPortableUI({
      ...options,
      host,
      layout,
      renderer,
      fonts,
      images: provider,
      autoStart: options.autoStart ?? true,
    });
    return root;
  } catch (error) {
    host.destroy();
    throw error;
  }
}
