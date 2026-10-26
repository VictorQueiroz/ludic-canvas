/** Per-resource fetch and GPU-upload limits, owned by a UI root. */
export interface ResourceLimits {
  /** Maximum downloaded bytes for each image, atlas, metrics file or layout module. Default: 32 MiB. */
  maxBytes: number;
  /** Maximum uploaded image/atlas dimension, also capped by the GPU. Default: 8192. */
  maxTextureSize: number;
  /** Maximum concurrent image fetch/decode/upload tasks. Default: 4. */
  maxConcurrentLoads: number;
}

export const defaultResourceLimits: Readonly<ResourceLimits> = Object.freeze({
  maxBytes: 32 * 1024 * 1024,
  maxTextureSize: 8192,
  maxConcurrentLoads: 4,
});

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

/** Bound streamed responses as well as Content-Length; URLs retain browser CORS semantics. */
export async function fetchBytes(
  url: string,
  {
    signal,
    maxBytes = defaultResourceLimits.maxBytes,
    label = 'Resource',
  }: {
    signal?: AbortSignal;
    maxBytes?: number;
    label?: string;
  } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  throwIfAborted(signal);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${url}`);
  const tooLarge = () => new Error(`${label} exceeds the ${maxBytes}-byte resource limit: ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw tooLarge();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  throwIfAborted(signal);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** A root-owned load pool. Queued work is canceled before it allocates resources. */
export class LoadQueue {
  #active = 0;
  readonly #pending: (() => void)[] = [];
  readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }
  run<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let canceled = signal.aborted;
      const cancel = () => {
        canceled = true;
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      if (canceled) {
        cancel();
        return;
      }
      signal.addEventListener('abort', cancel, { once: true });
      this.#pending.push(() => {
        signal.removeEventListener('abort', cancel);
        if (canceled) return;
        this.#active++;
        void Promise.resolve()
          .then(work)
          .then(resolve, reject)
          .finally(() => {
            this.#active--;
            this.#drain();
          });
      });
      this.#drain();
    });
  }
  #drain() {
    while (this.#active < this.limit && this.#pending.length) this.#pending.shift()!();
  }
}
