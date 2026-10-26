import { describe, expect, it, vi } from 'vitest';
import { createProgram, createTexture } from '../src/gfx/gl.ts';
function context() {
  const state = new Map<number, unknown>([
    [1, { engine: true }],
    [2, true],
    [3, 99],
    [4, true],
    [5, 1],
    [6, 4096],
  ]);
  const gl = {
    TEXTURE_BINDING_2D: 1,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 2,
    UNPACK_COLORSPACE_CONVERSION_WEBGL: 3,
    UNPACK_FLIP_Y_WEBGL: 4,
    UNPACK_ALIGNMENT: 5,
    MAX_TEXTURE_SIZE: 6,
    TEXTURE_2D: 7,
    NONE: 0,
    RGBA: 8,
    UNSIGNED_BYTE: 9,
    NEAREST: 10,
    LINEAR: 11,
    CLAMP_TO_EDGE: 12,
    TEXTURE_MIN_FILTER: 13,
    TEXTURE_MAG_FILTER: 14,
    TEXTURE_WRAP_S: 15,
    TEXTURE_WRAP_T: 16,
    getParameter: (key: number) => state.get(key),
    createTexture: vi.fn(() => ({})),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn((_target: number, value: unknown) => state.set(1, value)),
    pixelStorei: vi.fn((key: number, value: unknown) => state.set(key, value)),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
  };
  return { gl: gl as unknown as WebGLRenderingContext, mock: gl, state };
}
describe('shared-context allocations', () => {
  it('restores texture bindings and every pixel-store parameter after success and failure', () => {
    const { gl, mock, state } = context(),
      before = new Map(state);
    const texture = createTexture(gl, { width: 2, height: 3, data: null });
    expect(texture.bytes).toBe(24);
    expect(state).toEqual(before);
    mock.texImage2D.mockImplementationOnce(() => {
      throw new Error('upload failed');
    });
    expect(() => createTexture(gl, { width: 2, height: 2, data: null })).toThrow('upload failed');
    expect(mock.deleteTexture).toHaveBeenCalledOnce();
    expect(state).toEqual(before);
  });
  it('rejects dimensions before allocation', () => {
    const { gl, mock } = context();
    expect(() => createTexture(gl, { width: 4097, height: 1, data: null })).toThrow('supported limit');
    expect(() => createTexture(gl, { width: NaN, height: 1, data: null })).toThrow('supported limit');
    expect(mock.createTexture).not.toHaveBeenCalled();
  });
  it('releases shaders and the program after a link failure', () => {
    const gl = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      createShader: () => ({}),
      shaderSource() {},
      compileShader() {},
      getShaderParameter: () => true,
      deleteShader: vi.fn(),
      createProgram: () => ({}),
      attachShader() {},
      linkProgram() {},
      getProgramParameter: () => false,
      getProgramInfoLog: () => 'link error',
      deleteProgram: vi.fn(),
    };
    expect(() => createProgram(gl as unknown as WebGLRenderingContext, 'vertex', 'fragment')).toThrow('link error');
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(gl.deleteProgram).toHaveBeenCalledOnce();
  });
});
