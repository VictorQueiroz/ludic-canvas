// Thin WebGL 1.0 helpers: programs, textures, framebuffers. No abstractions
// beyond what the renderers actually share.

export type GL = WebGLRenderingContext;

export interface Program {
  handle: WebGLProgram;
  attrib: Record<string, number>;
  uniform: Record<string, WebGLUniformLocation | null>;
}

export function createProgram(gl: GL, vertex: string, fragment: string): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}\n${source}`);
    }
    return shader;
  };
  const handle = gl.createProgram()!;
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(handle, vs);
  gl.attachShader(handle, fs);
  gl.linkProgram(handle);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(handle)}`);
  }
  const attrib: Record<string, number> = {};
  for (let i = 0; i < gl.getProgramParameter(handle, gl.ACTIVE_ATTRIBUTES); i++) {
    const info = gl.getActiveAttrib(handle, i)!;
    attrib[info.name] = gl.getAttribLocation(handle, info.name);
  }
  const uniform: Record<string, WebGLUniformLocation | null> = {};
  for (let i = 0; i < gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS); i++) {
    const info = gl.getActiveUniform(handle, i)!;
    const name = info.name.replace(/\[0\]$/, '');
    uniform[name] = gl.getUniformLocation(handle, name);
  }
  return { handle, attrib, uniform };
}

/** Fragment precision: highp where available (UI SDFs work in device pixels). */
export function fragmentPrecision(gl: GL): string {
  const high = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  return high && high.precision > 0 ? 'precision highp float;' : 'precision mediump float;';
}

export interface Texture {
  handle: WebGLTexture;
  width: number;
  height: number;
  bytes: number;
}

export function createTexture(
  gl: GL,
  source: TexImageSource | { width: number; height: number; data: Uint8Array | null },
  options: { premultiply?: boolean; linear?: boolean } = {},
): Texture {
  const handle = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiply ?? true);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  let width: number;
  let height: number;
  if ('data' in source) {
    ({ width, height } = source);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
  } else {
    width = (source as { width: number }).width;
    height = (source as { height: number }).height;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }
  const filter = options.linear === false ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  return { handle, width, height, bytes: width * height * 4 };
}

export interface Framebuffer {
  fbo: WebGLFramebuffer;
  texture: Texture;
}

export function createFramebuffer(gl: GL, width: number, height: number): Framebuffer {
  const texture = createTexture(gl, { width, height, data: null }, { premultiply: false });
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.handle, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, texture };
}

export function deleteFramebuffer(gl: GL, fb: Framebuffer | undefined) {
  if (!fb) return;
  gl.deleteFramebuffer(fb.fbo);
  gl.deleteTexture(fb.texture.handle);
}

/** A unit quad (two triangles) in [0,1]², shared by full-screen passes. */
export function createQuad(gl: GL): WebGLBuffer {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  return buffer;
}

/** Parses "#rrggbb", "#rrggbbaa" or "rgba(r,g,b,a)" into premultiplied [r,g,b,a] 0..1. */
export function parseColor(input: string | undefined, alpha = 1): [number, number, number, number] {
  if (!input || input === 'transparent') return [0, 0, 0, 0];
  let r = 0,
    g = 0,
    b = 0,
    a = 1;
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const v = parseInt(hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex.slice(0, 6), 16);
    r = ((v >> 16) & 255) / 255;
    g = ((v >> 8) & 255) / 255;
    b = (v & 255) / 255;
    if (hex.length === 8) a = parseInt(hex.slice(6), 16) / 255;
  } else {
    const m = /rgba?\(([^)]+)\)/.exec(input);
    if (m) {
      const parts = m[1]!.split(',').map((s) => parseFloat(s));
      [r, g, b] = [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
      a = parts[3] ?? 1;
    }
  }
  a *= alpha;
  return [r * a, g * a, b * a, a];
}
