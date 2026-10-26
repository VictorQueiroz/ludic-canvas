// Shared host imports for our reactor modules: logging and the handful of
// WASI preview1 calls that libc may reference (Yoga's default logger pulls in
// stdio). Nothing here touches a real filesystem; stdout/stderr go to the
// console and everything else reports "not supported".

import { fetchBytes, throwIfAborted } from '../resources.ts';

const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;
const ERRNO_NOSYS = 52;

export interface ModuleMemory {
  memory: WebAssembly.Memory | undefined;
}

const decoder = new TextDecoder();

export function readCString(memory: WebAssembly.Memory, ptr: number, length?: number): string {
  const bytes = new Uint8Array(memory.buffer);
  let end = ptr;
  if (length === undefined) {
    while (end < bytes.length && bytes[end] !== 0) end++;
  } else {
    end = ptr + length;
  }
  return decoder.decode(bytes.subarray(ptr, end));
}

export function hostImports(name: string, mem: ModuleMemory, extraEnv: Record<string, WebAssembly.ImportValue> = {}) {
  const levels = ['debug', 'info', 'warn', 'error'] as const;
  const view = () => new DataView(mem.memory!.buffer);
  let stdout = '';

  return {
    env: {
      lc_log(level: number, ptr: number, length: number) {
        const message = readCString(mem.memory!, ptr, length);
        console[levels[level] ?? 'log'](`[${name}] ${message}`);
      },
      ...extraEnv,
    },
    wasi_snapshot_preview1: {
      fd_write(fd: number, iovs: number, iovsLen: number, nwritten: number) {
        if (fd !== 1 && fd !== 2) return ERRNO_BADF;
        const dv = view();
        let written = 0;
        for (let i = 0; i < iovsLen; i++) {
          const ptr = dv.getUint32(iovs + i * 8, true);
          const len = dv.getUint32(iovs + i * 8 + 4, true);
          stdout += readCString(mem.memory!, ptr, len);
          written += len;
        }
        const lines = stdout.split('\n');
        stdout = lines.pop() ?? '';
        for (const line of lines) console.warn(`[${name}] ${line}`);
        dv.setUint32(nwritten, written, true);
        return ERRNO_SUCCESS;
      },
      fd_close: () => ERRNO_SUCCESS,
      fd_seek: () => ERRNO_NOSYS,
      fd_fdstat_get: () => ERRNO_NOSYS,
      clock_time_get(_id: number, _precision: bigint, out: number) {
        view().setBigUint64(out, BigInt(Math.round(performance.now() * 1e6)), true);
        return ERRNO_SUCCESS;
      },
      proc_exit(code: number) {
        throw new Error(`[${name}] proc_exit(${code})`);
      },
    },
  };
}

export async function instantiate(
  source: string | ArrayBuffer | Uint8Array,
  imports: (mem: ModuleMemory) => WebAssembly.Imports,
  options: { signal?: AbortSignal; maxBytes?: number } = {},
): Promise<{ instance: WebAssembly.Instance; memory: WebAssembly.Memory }> {
  const mem: ModuleMemory = { memory: undefined };
  let bytes = source;
  if (typeof source === 'string') {
    bytes = await fetchBytes(source, { ...options, label: 'Layout module' });
  }
  throwIfAborted(options.signal);
  const { instance } = await WebAssembly.instantiate(bytes as BufferSource, imports(mem));
  throwIfAborted(options.signal);
  mem.memory = instance.exports.memory as WebAssembly.Memory;
  // Reactor modules run their static constructors from _initialize.
  (instance.exports._initialize as (() => void) | undefined)?.();
  return { instance, memory: mem.memory };
}
