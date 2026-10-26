import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBytes, LoadQueue } from '../src/resources.ts';
afterEach(() => vi.unstubAllGlobals());
describe('bounded resource loading', () => {
  it('rejects excessive declared and streamed bytes', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { 'content-length': '100' } })),
    );
    await expect(fetchBytes('/large', { maxBytes: 4 })).rejects.toThrow('4-byte resource limit');
    expect(cancel).toHaveBeenCalledOnce();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(3));
              c.enqueue(new Uint8Array(3));
              c.close();
            },
          }),
        ),
      ),
    );
    await expect(fetchBytes('/chunked', { maxBytes: 4 })).rejects.toThrow('4-byte resource limit');
  });
  it('limits concurrency and skips cancelled queued work', async () => {
    const queue = new LoadQueue(1),
      signal = new AbortController(),
      cancelled = new AbortController();
    let finish!: () => void;
    const first = queue.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      signal.signal,
    );
    const skipped = vi.fn(async () => 42);
    const second = queue.run(skipped, cancelled.signal);
    cancelled.abort();
    await expect(second).rejects.toThrow('abort');
    await vi.waitFor(() => expect(finish).toBeDefined());
    finish();
    await first;
    expect(skipped).not.toHaveBeenCalled();
    expect(await queue.run(async () => 7, signal.signal)).toBe(7);
  });
});
