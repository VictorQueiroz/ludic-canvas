// Root-owned asynchronous image loading, bounded fetches and a soft GPU LRU.
import type { AssetResolver } from '../assets.ts';
import { defaultResourceLimits, fetchBytes, LoadQueue, throwIfAborted, type ResourceLimits } from '../resources.ts';
import { createTexture, type GL, type Texture } from './gl.ts';

interface Slot {
  id: string;
  key: string;
  texture?: Texture;
  ready: Promise<void>;
  lastUsed: number;
  pins: number;
  abort: AbortController;
}

export class TextureStore {
  readonly #slots = new Map<string, Slot>();
  readonly #queue: LoadQueue;
  #frame = 0;
  #disposed = false;
  #bytes = 0;
  #onLoad: () => void = () => {};
  readonly gl: GL;
  readonly resolve: AssetResolver;
  readonly budget: number;
  readonly onError: (error: unknown) => void;
  readonly limits: Readonly<ResourceLimits>;
  constructor(
    gl: GL,
    resolve: AssetResolver,
    budget = 64 * 1024 * 1024,
    onError: (error: unknown) => void = console.error,
    limits: Readonly<ResourceLimits> = defaultResourceLimits,
  ) {
    this.gl = gl;
    this.resolve = resolve;
    this.budget = budget;
    this.onError = onError;
    this.limits = limits;
    this.#queue = new LoadQueue(limits.maxConcurrentLoads);
  }

  set onLoad(fn: () => void) {
    this.#onLoad = fn;
  }
  get bytes() {
    return this.#bytes;
  }
  tick() {
    this.#frame++;
    this.#evict();
  }

  #slot(id: string, pixelWidth = 0, pixelHeight = 0): Slot | undefined {
    if (this.#disposed) return undefined;
    const entry = this.resolve(id);
    if (!entry) return undefined;
    const vector = entry.kind === 'vector';
    const q = (value: number) =>
      Math.min(
        this.limits.maxTextureSize,
        this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
        Math.max(64, Math.ceil(value / 128) * 128),
      );
    const width = vector ? q(pixelWidth || entry.width || 256) : 0;
    const height = vector ? q(pixelHeight || entry.height || 256) : 0;
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid vector size: ${id}`);
    const key = JSON.stringify([id, vector, width, height]);
    let slot = this.#slots.get(key);
    if (!slot) {
      if (this.#slots.size >= 2048) {
        for (const candidate of this.#slots.values())
          if (!candidate.pins && candidate.lastUsed < this.#frame - 2) {
            this.#remove(candidate);
            break;
          }
        if (this.#slots.size >= 2048)
          throw new Error('Image cache has reached its 2048-entry limit; invalidate unused assets');
      }
      const abort = new AbortController();
      slot = { id, key, lastUsed: this.#frame, pins: 0, abort, ready: Promise.resolve() };
      const target = slot;
      this.#slots.set(key, target);
      target.ready = this.#queue
        .run(
          () =>
            vector
              ? this.#loadVector(entry.url, width, height, abort.signal)
              : this.#loadRaster(entry.url, abort.signal),
          abort.signal,
        )
        .then((texture) => {
          if (this.#disposed || abort.signal.aborted || this.#slots.get(key) !== target) {
            this.gl.deleteTexture(texture.handle);
            throw abort.signal.reason ?? new DOMException('Aborted', 'AbortError');
          }
          target.texture = texture;
          this.#bytes += texture.bytes;
          this.#evict();
          this.#onLoad();
        })
        .catch((error) => {
          if (!this.#disposed && !abort.signal.aborted) this.onError(error);
          throw error;
        });
      void target.ready.catch(() => {});
    }
    this.#touch(slot);
    return slot;
  }

  get(id: string, pixelWidth = 0, pixelHeight = 0): Texture | undefined {
    return this.#slot(id, pixelWidth, pixelHeight)?.texture;
  }

  async preload(ids: readonly string[]): Promise<void> {
    if (this.#disposed) throw new Error('UI has been destroyed');
    const pinned: Slot[] = [];
    try {
      for (const id of ids) {
        const slot = this.#slot(id);
        if (!slot) throw new Error(`Unknown image asset: ${id}`);
        slot.pins++;
        pinned.push(slot);
      }
      await Promise.all(pinned.map((slot) => slot.ready));
      for (const slot of pinned) this.#touch(slot);
    } finally {
      for (const slot of pinned) slot.pins--;
    }
  }

  /** Drop cached failures or outdated images. Next paint/preload retries them. */
  invalidate(ids?: readonly string[]) {
    const selected = ids ? new Set(ids) : undefined;
    for (const slot of this.#slots.values()) if (!selected || selected.has(slot.id)) this.#remove(slot);
  }

  async #loadRaster(url: string, signal: AbortSignal): Promise<Texture> {
    const bytes = await fetchBytes(url, { signal, maxBytes: this.limits.maxBytes, label: 'Image' });
    // ImageBitmap ignores WebGL's unpack-premultiply flag. Request actual
    // premultiplied pixels for ONE/ONE_MINUS_SRC_ALPHA blending at decode time.
    const bitmap = await createImageBitmap(new Blob([bytes]), {
      premultiplyAlpha: 'premultiply',
      colorSpaceConversion: 'none',
    });
    try {
      throwIfAborted(signal);
      return createTexture(this.gl, bitmap, { premultiply: true, maxSize: this.limits.maxTextureSize });
    } finally {
      bitmap.close();
    }
  }

  async #loadVector(url: string, width: number, height: number, signal: AbortSignal): Promise<Texture> {
    const bytes = await fetchBytes(url, { signal, maxBytes: this.limits.maxBytes, label: 'Vector image' });
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
    const image = new Image();
    const cancel = () => {
      image.src = '';
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      image.decoding = 'async';
      image.src = blobUrl;
      await image.decode();
      throwIfAborted(signal);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to allocate the SVG rasterization canvas');
      context.drawImage(image, 0, 0, width, height);
      return createTexture(this.gl, canvas, { premultiply: true, maxSize: this.limits.maxTextureSize });
    } finally {
      signal.removeEventListener('abort', cancel);
      image.src = '';
      URL.revokeObjectURL(blobUrl);
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.invalidate();
  }

  #touch(slot: Slot) {
    slot.lastUsed = this.#frame;
    this.#slots.delete(slot.key);
    this.#slots.set(slot.key, slot);
  }
  #remove(slot: Slot) {
    slot.abort.abort();
    if (slot.texture) {
      this.gl.deleteTexture(slot.texture.handle);
      this.#bytes -= slot.texture.bytes;
    }
    this.#slots.delete(slot.key);
  }
  #evict() {
    if (this.#bytes <= this.budget) return;
    for (const slot of this.#slots.values()) {
      if (this.#bytes <= this.budget * 0.8) break;
      if (!slot.texture || slot.pins) continue;
      if (slot.lastUsed >= this.#frame - 2) break;
      this.#remove(slot);
    }
  }
}
