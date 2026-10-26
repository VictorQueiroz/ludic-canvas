import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssetResolver } from '../src/index.ts';
import { TextureStore } from '../src/gfx/textures.ts';
afterEach(() => vi.unstubAllGlobals());
describe('application-owned assets', () => {
  it('resolves URLs, catalogs and custom identifiers without prototype properties', () => {
    expect(createAssetResolver()('/hero.webp')).toEqual({ url: '/hero.webp' });
    const resolve = createAssetResolver({ hero: { url: '/hero.webp' } });
    expect(resolve('hero')?.url).toBe('/hero.webp');
    expect(resolve('missing')).toBeUndefined();
    expect(resolve('toString')).toBeUndefined();
    expect(createAssetResolver((id) => ({ url: '/theme/' + id + '.png' }))('button')?.url).toBe('/theme/button.png');
  });
  it('rejects unknown identifiers and failed HTTP preloads', async () => {
    const report = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })));
    const cache = new TextureStore(
      {} as WebGLRenderingContext,
      createAssetResolver({ icon: { url: '/icon.png' } }),
      undefined,
      report,
    );
    await expect(cache.preload(['unknown'])).rejects.toThrow('Unknown image asset');
    await expect(cache.preload(['icon'])).rejects.toThrow('Image failed: 404');
    expect(report).toHaveBeenCalledOnce();
    cache.dispose();
  });
  it('aborts pending fetches and rejects preloads after disposal', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) =>
          signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        );
      }),
    );
    const report = vi.fn();
    const cache = new TextureStore({} as WebGLRenderingContext, createAssetResolver(), undefined, report);
    const pending = cache.preload(['/icon.png']);
    await vi.waitFor(() => expect(signal).toBeDefined());
    cache.dispose();
    expect(signal?.aborted).toBe(true);
    await expect(pending).rejects.toThrow('Aborted');
    expect(report).not.toHaveBeenCalled();
    await expect(cache.preload(['/icon.png'])).rejects.toThrow('destroyed');
  });
});
