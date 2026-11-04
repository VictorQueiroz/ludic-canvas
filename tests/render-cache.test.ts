import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiBatch } from '../src/gfx/batch.ts';
import { TextureStore } from '../src/gfx/textures.ts';

afterEach(() => vi.unstubAllGlobals());

function graphics() {
  const buffers = new Map<object, Uint8Array>();
  const bindings = new Map<number, object>();
  const draws: number[][] = [];
  let constant = 100;
  let gl: WebGLRenderingContext;
  const attributes = ['a_pos', 'a_uv', 'a_color', 'a_params', 'a_shape', 'a_local'];
  const mock = {
    createShader: () => ({}),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: () => true,
    deleteShader() {},
    createProgram: () => ({}),
    attachShader() {},
    linkProgram() {},
    deleteProgram() {},
    getProgramParameter: (_p: unknown, key: number) =>
      key === gl.LINK_STATUS ? true : key === gl.ACTIVE_ATTRIBUTES ? attributes.length : 0,
    getActiveAttrib: (_p: unknown, index: number) => ({ name: attributes[index] }),
    getAttribLocation: (_p: unknown, name: string) => attributes.indexOf(name),
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    getExtension: () => null,
    getParameter: () => 0,
    createBuffer: vi.fn(() => ({})),
    deleteBuffer: vi.fn((buffer: object) => buffers.delete(buffer)),
    bindBuffer: (target: number, buffer: object) => bindings.set(target, buffer),
    bufferData: vi.fn((target: number, data: ArrayBufferView) =>
      buffers.set(bindings.get(target)!, new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()),
    ),
    bufferSubData: vi.fn((target: number, offset: number, data: ArrayBufferView) =>
      buffers.get(bindings.get(target)!)!.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset),
    ),
    drawElements: vi.fn(() => draws.push([...new Float32Array(buffers.get(bindings.get(gl.ARRAY_BUFFER)!)!.buffer)])),
    useProgram() {},
    uniform2f() {},
    uniform1f() {},
    uniform1i() {},
    activeTexture() {},
    bindTexture() {},
    enable() {},
    disable() {},
    blendEquation() {},
    blendFunc() {},
    scissor() {},
    enableVertexAttribArray() {},
    disableVertexAttribArray() {},
    vertexAttribPointer() {},
  };
  gl = new Proxy(mock, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      if (typeof key === 'string' && /^[A-Z_0-9]+$/.test(key))
        return Reflect.set(target, key, constant++) && Reflect.get(target, key);
      throw new Error(`Unexpected WebGL method ${String(key)}`);
    },
  }) as unknown as WebGLRenderingContext;
  return { gl, mock, buffers, draws };
}

describe('retained UI vertices', () => {
  it('draws unchanged batches without uploading again, updates changed ranges, and frees unused buffers', () => {
    const { gl, mock, draws } = graphics();
    const batch = new UiBatch(gl);
    const frame = (red = 0.4, second = true) => {
      batch.begin(200, 100, 0);
      batch.rect(1, 2, 30, 40, [0.1, 0.2, 0.3, 1]);
      if (second) {
        batch.setClip([0, 0, 100, 100]);
        batch.rect(50, 2, 30, 40, [red, 0.5, 0.6, 1]);
      }
      batch.end();
    };
    frame();
    const first = draws.slice();
    mock.bufferData.mockClear();
    mock.bufferSubData.mockClear();
    frame();
    expect(draws.slice(2)).toEqual(first);
    expect(mock.bufferData).not.toHaveBeenCalled();
    expect(mock.bufferSubData).not.toHaveBeenCalled();
    frame(0.8);
    expect(mock.bufferSubData).toHaveBeenCalledOnce();
    expect(mock.bufferSubData.mock.calls[0]![2].byteLength).toBeLessThan(4 * 18 * 4);
    expect(draws[4]).toEqual(first[0]);
    expect(draws[5]).not.toEqual(first[1]);
    const deleted = mock.deleteBuffer.mock.calls.length;
    frame(0.8, false);
    expect(mock.deleteBuffer.mock.calls.length).toBe(deleted + 1);
    batch.dispose();
    batch.dispose();
    expect(mock.deleteBuffer).toHaveBeenCalledTimes(mock.createBuffer.mock.calls.length);
  });

  it('keeps main-view vertices when tile captures use another viewport', () => {
    const { gl, mock, draws } = graphics();
    const batch = new UiBatch(gl);
    const paint = (width: number, color: number, physical = width) => {
      batch.begin(width, 100, 0, physical, 100);
      batch.rect(1, 2, 30, 40, [color, 0.2, 0.3, 1]);
      batch.end();
    };
    paint(800, 0.1);
    paint(200, 0.4);
    paint(200, 0.6, 400);
    const first = draws.slice();
    mock.bufferData.mockClear();
    mock.bufferSubData.mockClear();
    paint(800, 0.1);
    paint(200, 0.4);
    paint(200, 0.6, 400);
    expect(draws.slice(3)).toEqual(first);
    expect(mock.bufferData).not.toHaveBeenCalled();
    expect(mock.bufferSubData).not.toHaveBeenCalled();
    batch.dispose();
    expect(mock.deleteBuffer).toHaveBeenCalledTimes(mock.createBuffer.mock.calls.length);
  });

  it('shares one budget across viewport sizes and retains the most recent viewport', () => {
    const { gl, mock, buffers } = graphics();
    const batch = new UiBatch(gl);
    const frame = (width: number) => {
      batch.begin(width, 100, 0);
      for (let i = 0; i < 2000; i++) batch.rect(i, 0, 1, 1, [1, 1, 1, 1]);
      batch.end();
    };
    const streaming = mock.createBuffer.mock.results[0]!.value;
    const indices = mock.createBuffer.mock.results[1]!.value;
    for (let width = 200; width < 212; width++) {
      frame(width);
      expect(
        [...buffers]
          .filter(([buffer]) => buffer !== streaming && buffer !== indices)
          .reduce((sum, [, data]) => sum + data.byteLength, 0),
      ).toBeLessThanOrEqual(4 * 1024 * 1024);
    }
    mock.bufferData.mockClear();
    mock.bufferSubData.mockClear();
    frame(211);
    expect(mock.bufferData).not.toHaveBeenCalled();
    expect(mock.bufferSubData).not.toHaveBeenCalled();
    expect(mock.deleteBuffer).toHaveBeenCalled();
    batch.dispose();
    expect(buffers.size).toBe(0);
  });

  it('streams many small overflow batches without repeatedly scanning protected entries', () => {
    const { gl, mock } = graphics();
    let visited = 0,
      evictionIterators = 0;
    class CountedMap<K, V> extends Map<K, V> {
      override entries(): MapIterator<[K, V]> {
        evictionIterators++;
        return super.entries();
      }
      override *[Symbol.iterator](): MapIterator<[K, V]> {
        for (const entry of super[Symbol.iterator]()) {
          visited++;
          yield entry;
        }
      }
    }
    vi.stubGlobal('Map', CountedMap);
    const batch = new UiBatch(gl),
      quads = 14800;
    const frame = (width = 200) => {
      batch.begin(width, 100, 0);
      for (let i = 0; i < quads; i++) {
        batch.setClip([i % 2, 0, 100, 100]);
        batch.rect(0, 0, 1, 1, [1, 1, 1, 1]);
      }
      batch.end();
    };
    frame();
    visited = 0;
    mock.createBuffer.mockClear();
    mock.deleteBuffer.mockClear();
    frame();
    expect(batch.submittedQuads).toBe(quads);
    expect(visited).toBeLessThan(quads * 4);
    expect(mock.createBuffer).not.toHaveBeenCalled();
    expect(mock.deleteBuffer).not.toHaveBeenCalled();
    evictionIterators = 0;
    frame(201);
    expect(batch.submittedQuads).toBe(quads);
    expect(evictionIterators).toBeLessThan(32);
    batch.dispose();
  });

  it('keeps retained allocations bounded while oversized frames still render every quad', () => {
    const { gl, mock, buffers } = graphics();
    const batch = new UiBatch(gl);
    const streaming = mock.createBuffer.mock.results[0]!.value;
    const indices = mock.createBuffer.mock.results[1]!.value;
    for (let frame = 0; frame < 2; frame++) {
      mock.bufferData.mockClear();
      mock.bufferSubData.mockClear();
      mock.createBuffer.mockClear();
      mock.deleteBuffer.mockClear();
      batch.begin(200, 100, frame);
      for (let i = 0; i < 18000; i++) batch.rect(i, 0, 1, 1, [1, 1, 1, 1]);
      batch.end();
      expect(batch.submittedQuads).toBe(18000);
      if (frame === 1) {
        expect(mock.createBuffer).not.toHaveBeenCalled();
        expect(mock.deleteBuffer).not.toHaveBeenCalled();
        expect(mock.bufferData).toHaveBeenCalledOnce();
        expect(mock.bufferData.mock.calls[0]![1].byteLength).toBe(8192 * 4 * 18 * 4);
        expect(mock.bufferSubData).not.toHaveBeenCalled();
      }
      expect(
        [...buffers]
          .filter(([buffer]) => buffer !== streaming && buffer !== indices)
          .reduce((n, [, data]) => n + data.byteLength, 0),
      ).toBeLessThanOrEqual(4 * 1024 * 1024);
    }
    batch.dispose();
    expect(buffers.size).toBe(0);
  });
});

it('caches vector limits across lookups and refreshes them after full/context invalidation', () => {
  const getParameter = vi.fn(() => 1024);
  vi.stubGlobal(
    'fetch',
    (_url: unknown, { signal }: RequestInit) =>
      new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason))),
  );
  const cache = new TextureStore({ MAX_TEXTURE_SIZE: 1, getParameter } as unknown as WebGLRenderingContext, () => ({
    url: '/icon.svg',
    kind: 'vector',
  }));
  for (let i = 0; i < 10; i++) cache.get('icon', 100, 100);
  expect(getParameter).toHaveBeenCalledOnce();
  cache.invalidate(['icon']);
  cache.get('icon', 100, 100);
  expect(getParameter).toHaveBeenCalledOnce();
  cache.invalidate();
  getParameter.mockReturnValue(512);
  cache.get('icon', 100, 100);
  expect(getParameter).toHaveBeenCalledTimes(2);
  cache.dispose();
});
