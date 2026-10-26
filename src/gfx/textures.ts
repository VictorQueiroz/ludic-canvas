// GPU texture cache for art. Rasters decode off the main thread through
// createImageBitmap; SVGs are rasterized at the exact pixel size they are
// drawn at (so vector images stay crisp at any DPR).
// A byte budget with LRU eviction keeps mobile GPUs comfortable.

import type { AssetResolver } from '../assets.ts';
import { createTexture, type GL, type Texture } from './gl.ts';

interface Slot {
  key: string;
  texture: Texture | undefined;
  loading: Promise<void> | undefined;
  lastUsed: number;
  failed: boolean;
}

export class TextureStore {
  readonly #gl: GL;
  readonly #slots = new Map<string, Slot>();
  readonly #budget: number;
  #frame = 0;
  #disposed = false;
  readonly #abort = new AbortController();
  readonly #resolve: AssetResolver;
  readonly #onError: (error: unknown) => void;
  #onLoad: () => void;

  constructor(
    gl: GL,
    resolve: AssetResolver,
    budgetBytes = 64 * 1024 * 1024,
    onError: (error: unknown) => void = console.error,
  ) {
    this.#resolve = resolve;
    this.#onError = onError;
    this.#gl = gl;
    this.#budget = budgetBytes;
    this.#onLoad = () => {};
  }

  set onLoad(fn: () => void) {
    this.#onLoad = fn;
  }

  tick() {
    this.#frame++;
  }

  /**
   * Returns the texture for an art id if ready, starting a load otherwise.
   * Vectors take a target pixel size; they are re-rasterized when it grows.
   */
  get(id: string, pixelWidth = 0, pixelHeight = 0): Texture | undefined {
    if (this.#disposed) return undefined;
    const entry = this.#resolve(id);
    if (!entry) return undefined;
    let key = id;
    if (entry.kind === 'vector') {
      // Quantize so small resizes don't thrash the rasterizer.
      const q = (v: number) => Math.max(64, Math.ceil(v / 128) * 128);
      key = `${id}@${q(pixelWidth || entry.width || 256)}x${q(pixelHeight || entry.height || 256)}`;
    }
    let slot = this.#slots.get(key);
    if (!slot) {
      slot = { key, texture: undefined, loading: undefined, lastUsed: this.#frame, failed: false };
      this.#slots.set(key, slot);
      const target = slot;
      slot.loading = (entry.kind === 'vector' ? this.#loadVector(entry.url, key) : this.#loadRaster(entry.url))
        .then((texture) => {
          if (this.#disposed) {
            this.#gl.deleteTexture(texture.handle);
            return;
          }
          target.texture = texture;
          this.#evict();
          this.#onLoad();
        })
        .catch((err) => {
          target.failed = true;
          if (!this.#disposed) this.#onError(err);
          throw err;
        });
    }
    void slot.loading?.catch(() => {});
    slot.lastUsed = this.#frame;
    return slot.texture;
  }

  /** Resolves once the given ids are resident (used for preloading screens). */
  async preload(ids: readonly string[]): Promise<void> {
    if (this.#disposed) throw new Error('UI has been destroyed');
    await Promise.all(
      ids.map((id) => {
        const entry = this.#resolve(id);
        if (!entry) throw new Error(`Unknown image asset: ${id}`);
        this.get(id);
        const q = (v: number) => Math.max(64, Math.ceil(v / 128) * 128);
        const key = entry.kind === 'vector' ? `${id}@${q(entry.width || 256)}x${q(entry.height || 256)}` : id;
        return this.#slots.get(key)?.loading;
      }),
    );
  }

  async #loadRaster(url: string): Promise<Texture> {
    const response = await fetch(url, { signal: this.#abort.signal });
    if (!response.ok) throw new Error(`Image failed: ${response.status} ${url}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const texture = createTexture(this.#gl, bitmap, { premultiply: true });
    bitmap.close();
    return texture;
  }

  async #loadVector(url: string, key: string): Promise<Texture> {
    const size = key.slice(key.lastIndexOf('@') + 1);
    const [w, h] = size.split('x').map(Number) as [number, number];
    const response = await fetch(url, { signal: this.#abort.signal });
    if (!response.ok) throw new Error(`Vector image failed: ${response.status} ${url}`);
    const svg = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = blobUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      return createTexture(this.#gl, canvas, { premultiply: true });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  dispose() {
    this.#disposed = true;
    this.#abort.abort();
    for (const slot of this.#slots.values()) if (slot.texture) this.#gl.deleteTexture(slot.texture.handle);
    this.#slots.clear();
  }

  #evict() {
    let total = 0;
    for (const s of this.#slots.values()) total += s.texture?.bytes ?? 0;
    if (total <= this.#budget) return;
    const resident = [...this.#slots.values()].filter((s) => s.texture).sort((a, b) => a.lastUsed - b.lastUsed);
    for (const s of resident) {
      if (total <= this.#budget * 0.8 || s.lastUsed >= this.#frame - 2) break;
      this.#gl.deleteTexture(s.texture!.handle);
      total -= s.texture!.bytes;
      this.#slots.delete(s.key);
    }
  }
}
