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
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to allocate a WebGL shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}\n${source}`);
    }
    return shader;
  };
  let handle: WebGLProgram | null = null;
  let vs: WebGLShader | undefined, fs: WebGLShader | undefined;
  try {
    vs = compile(gl.VERTEX_SHADER, vertex);
    fs = compile(gl.FRAGMENT_SHADER, fragment);
    handle = gl.createProgram();
    if (!handle) throw new Error('Unable to allocate a WebGL program');
    gl.attachShader(handle, vs);
    gl.attachShader(handle, fs);
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS))
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(handle)}`);
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
  } catch (error) {
    if (handle) gl.deleteProgram(handle);
    throw error;
  } finally {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
  }
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
  options: { premultiply?: boolean; linear?: boolean; maxSize?: number } = {},
): Texture {
  const size = 'displayWidth' in source ? { width: source.displayWidth, height: source.displayHeight } : source;
  const width = Number(
    'videoWidth' in size ? size.videoWidth : 'naturalWidth' in size ? size.naturalWidth : size.width,
  );
  const height = Number(
    'videoHeight' in size ? size.videoHeight : 'naturalHeight' in size ? size.naturalHeight : size.height,
  );
  const limit = Math.min(options.maxSize ?? 8192, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > limit ||
    height > limit
  )
    throw new Error(`Texture dimensions ${width} x ${height} exceed the supported limit ${limit}`);
  const handle = gl.createTexture();
  if (!handle) throw new Error('Unable to allocate a WebGL texture');
  // Decodes resolve between frames. Restore upload state so an engine's cached
  // bindings, alignment and Y orientation remain valid until the UI draw pass.
  const binding = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
  const parameters = [
    gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
    gl.UNPACK_FLIP_Y_WEBGL,
    gl.UNPACK_ALIGNMENT,
  ];
  const values = parameters.map((parameter) => gl.getParameter(parameter) as number);
  try {
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiply ?? true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    if ('data' in source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    const filter = options.linear === false ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { handle, width, height, bytes: width * height * 4 };
  } catch (error) {
    gl.deleteTexture(handle);
    throw error;
  } finally {
    for (const [index, parameter] of parameters.entries()) gl.pixelStorei(parameter, values[index]!);
    gl.bindTexture(gl.TEXTURE_2D, binding);
  }
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
