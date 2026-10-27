// The UI batcher: one uber-shader draws every 2D primitive the interface
// needs — SDF rounded rects and borders, images with rounded clipping, MSDF
// glyphs from four font atlases, soft glows, dashed capsule lines and
// gradients — as quads in a single dynamic vertex buffer. A draw call is only
// issued when the image texture or the clip rectangle changes.
//
// All coordinates are device pixels, origin top-left.

import type { Font } from './font.ts';
import { createProgram, fragmentPrecision, type GL, type Program, type Texture } from './gl.ts';

export type Rgba = readonly [number, number, number, number];

const enum_ = { rect: 0, ring: 1, image: 2, glyph: 3, glow: 4, line: 5, gradient: 6 } as const;
const FLOATS = 18; // pos2 uv2 color4 params4 shape4 local2
const MAX_QUADS = 8192;

const VERTEX = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute vec4 a_color;
attribute vec4 a_params;
attribute vec4 a_shape;
attribute vec2 a_local;
uniform vec2 u_viewport;
varying vec2 v_uv;
varying vec4 v_color;
varying vec4 v_params;
varying vec4 v_shape;
varying vec2 v_local;
void main() {
  vec2 clip = a_pos / u_viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv; v_color = a_color; v_params = a_params; v_shape = a_shape; v_local = a_local;
}`;

const FRAGMENT = (precision: string) => `${precision}
uniform sampler2D u_image;
uniform sampler2D u_font0;
uniform sampler2D u_font1;
uniform sampler2D u_font2;
uniform sampler2D u_font3;
uniform float u_time;
varying vec2 v_uv;
varying vec4 v_color;
varying vec4 v_params;
varying vec4 v_shape;
varying vec2 v_local;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }

void main() {
  float mode = v_params.x;
  if (mode < 0.5) {                       // filled rounded rect
    float d = sdRoundRect(v_local, v_shape.xy, v_shape.z);
    gl_FragColor = v_color * clamp(0.5 - d, 0.0, 1.0);
  } else if (mode < 1.5) {                // border ring
    float d = sdRoundRect(v_local, v_shape.xy, v_shape.z);
    float a = clamp(0.5 - d, 0.0, 1.0) * clamp(0.5 + d + v_shape.w, 0.0, 1.0);
    gl_FragColor = v_color * a;
  } else if (mode < 2.5) {                // image, rounded clip, desaturate
    vec4 t = texture2D(u_image, v_uv);
    float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    t.rgb = mix(t.rgb, vec3(l), v_params.y);
    t.rgb *= 1.0 - v_params.z;            // darken
    float d = sdRoundRect(v_local, v_shape.xy, v_shape.z);
    gl_FragColor = t * v_color * clamp(0.5 - d, 0.0, 1.0);
  } else if (mode < 3.5) {                // MSDF glyph
    float f = v_params.y;
    vec4 s;
    if (f < 0.5) s = texture2D(u_font0, v_uv);
    else if (f < 1.5) s = texture2D(u_font1, v_uv);
    else if (f < 2.5) s = texture2D(u_font2, v_uv);
    else s = texture2D(u_font3, v_uv);
    float sd = median(s.r, s.g, s.b) - 0.5 + v_params.w;   // w: weight (embolden)
    float a = clamp(sd * v_params.z + 0.5, 0.0, 1.0);       // z: screen px range
    gl_FragColor = v_color * a;
  } else if (mode < 4.5) {                // soft glow ellipse
    vec2 q = v_local / v_shape.xy;
    float r2 = dot(q, q);
    float a = exp(-r2 * v_shape.z) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
    float pulse = 1.0 + v_shape.w * sin(u_time * 2.2 + v_params.y);
    gl_FragColor = v_color * a * pulse;
  } else if (mode < 5.5) {                // capsule line, optional marching dashes
    float hx = v_shape.x;
    float d = length(vec2(max(abs(v_local.x) - hx, 0.0), v_local.y)) - v_shape.y;
    float a = clamp(0.5 - d, 0.0, 1.0);
    if (v_shape.z > 0.0) {
      float t = mod(v_local.x + hx - u_time * v_params.y, v_shape.z);
      a *= smoothstep(0.0, 1.0, t) * (1.0 - smoothstep(v_shape.z * 0.55 - 1.0, v_shape.z * 0.55, t));
    }
    gl_FragColor = v_color * a;
  } else {                                // vertical gradient, rounded
    float d = sdRoundRect(v_local, v_shape.xy, v_shape.z);
    float t = clamp(v_local.y / (2.0 * v_shape.y) + 0.5, 0.0, 1.0);
    vec4 c = mix(v_color, vec4(v_params.yzw, 1.0) * v_shape.w, t);
    gl_FragColor = c * clamp(0.5 - d, 0.0, 1.0);
  }
}`;

export class UiBatch {
  readonly #gl: GL;
  readonly #program: Program;
  readonly #vbo: WebGLBuffer;
  readonly #ibo: WebGLBuffer;
  readonly #vaoExtension: OES_vertex_array_object | null;
  readonly #instancing: ANGLE_instanced_arrays | null;
  readonly #vao: WebGLVertexArrayObjectOES | null;
  #previousVao: WebGLVertexArrayObjectOES | null = null;
  #disposed = false;
  readonly #data = new Float32Array(MAX_QUADS * 4 * FLOATS);
  #quads = 0;
  #image: Texture | undefined;
  #fonts: Font[] = [];
  #clip: [number, number, number, number] | undefined;
  #viewport: [number, number] = [1, 1];
  #physical: [number, number] = [1, 1];
  #time = 0;
  drawCalls = 0;
  submittedQuads = 0;

  constructor(gl: GL) {
    this.#gl = gl;
    this.#program = createProgram(gl, VERTEX, FRAGMENT(fragmentPrecision(gl)));
    this.#vaoExtension = gl.getExtension('OES_vertex_array_object');
    this.#instancing = gl.getExtension('ANGLE_instanced_arrays');
    this.#vao = this.#vaoExtension?.createVertexArrayOES() ?? null;
    const vbo = gl.createBuffer(),
      ibo = gl.createBuffer();
    if (!vbo || !ibo || (this.#vaoExtension && !this.#vao)) {
      if (vbo) gl.deleteBuffer(vbo);
      if (ibo) gl.deleteBuffer(ibo);
      if (this.#vao) this.#vaoExtension?.deleteVertexArrayOES(this.#vao);
      gl.deleteProgram(this.#program.handle);
      throw new Error('Unable to allocate WebGL batch resources');
    }
    this.#vbo = vbo;
    this.#ibo = ibo;
    const indices = new Uint16Array(MAX_QUADS * 6);
    for (let i = 0, v = 0; i < indices.length; i += 6, v += 4) {
      indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i);
    }
    const previous = this.#vaoExtension
      ? (gl.getParameter(this.#vaoExtension.VERTEX_ARRAY_BINDING_OES) as WebGLVertexArrayObjectOES | null)
      : null;
    const previousBuffer = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    try {
      this.#vaoExtension?.bindVertexArrayOES(this.#vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      if (this.#vaoExtension) this.#vaoExtension.bindVertexArrayOES(previous);
      else gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previousBuffer);
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#gl.deleteBuffer(this.#vbo);
    this.#gl.deleteBuffer(this.#ibo);
    this.#gl.deleteProgram(this.#program.handle);
    if (this.#vao) this.#vaoExtension?.deleteVertexArrayOES(this.#vao);
  }

  setFonts(fonts: Font[]) {
    this.#fonts = fonts;
  }

  begin(width: number, height: number, time: number, physicalWidth = width, physicalHeight = height) {
    this.#viewport = [width, height];
    this.#physical = [physicalWidth, physicalHeight];
    this.#time = time;
    this.#quads = 0;
    this.#image = undefined;
    this.#clip = undefined;
    this.drawCalls = 0;
    this.submittedQuads = 0;
    const gl = this.#gl;
    if (this.#vaoExtension) {
      this.#previousVao = gl.getParameter(
        this.#vaoExtension.VERTEX_ARRAY_BINDING_OES,
      ) as WebGLVertexArrayObjectOES | null;
      this.#vaoExtension.bindVertexArrayOES(this.#vao);
    } else {
      const count = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) as number;
      for (let index = 0; index < count; index++) gl.disableVertexAttribArray(index);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  end() {
    try {
      this.flush();
    } finally {
      this.#gl.disable(this.#gl.SCISSOR_TEST);
      this.#vaoExtension?.bindVertexArrayOES(this.#previousVao);
    }
  }

  /** Clip subsequent primitives to a device-pixel rectangle (undefined = none). */
  setClip(rect: [number, number, number, number] | undefined) {
    const same =
      rect === this.#clip ||
      (rect &&
        this.#clip &&
        rect[0] === this.#clip[0] &&
        rect[1] === this.#clip[1] &&
        rect[2] === this.#clip[2] &&
        rect[3] === this.#clip[3]);
    if (same) return;
    this.flush();
    this.#clip = rect;
  }

  // ── Primitives ─────────────────────────────────────────────────────────────

  rect(x: number, y: number, w: number, h: number, color: Rgba, radius = 0) {
    if (color[3] <= 0) return;
    this.#quad(
      x,
      y,
      w,
      h,
      color,
      [enum_.rect, 0, 0, 0],
      [w / 2, h / 2, Math.min(radius, w / 2, h / 2), 0],
      0,
      0,
      1,
      1,
      1,
    );
  }

  ring(x: number, y: number, w: number, h: number, color: Rgba, radius: number, width: number) {
    if (color[3] <= 0 || width <= 0) return;
    this.#quad(
      x,
      y,
      w,
      h,
      color,
      [enum_.ring, 0, 0, 0],
      [w / 2, h / 2, Math.min(radius, w / 2, h / 2), width],
      0,
      0,
      1,
      1,
      1,
    );
  }

  gradient(x: number, y: number, w: number, h: number, top: Rgba, bottom: Rgba, radius = 0) {
    // Bottom colour travels un-premultiplied in params, alpha in shape.w.
    const a = bottom[3] || 1e-6;
    this.#quad(
      x,
      y,
      w,
      h,
      top,
      [enum_.gradient, bottom[0] / a, bottom[1] / a, bottom[2] / a],
      [w / 2, h / 2, Math.min(radius, w / 2, h / 2), bottom[3]],
      0,
      0,
      1,
      1,
      1,
    );
  }

  image(
    texture: Texture,
    x: number,
    y: number,
    w: number,
    h: number,
    uv: readonly [number, number, number, number],
    tint: Rgba,
    radius = 0,
    desaturate = 0,
    darken = 0,
  ) {
    if (tint[3] <= 0) return;
    if (this.#image !== texture) {
      if (this.#image) this.flush();
      this.#image = texture;
    }
    this.#quad(
      x,
      y,
      w,
      h,
      tint,
      [enum_.image, desaturate, darken, 0],
      [w / 2, h / 2, Math.min(radius, w / 2, h / 2), 0],
      uv[0],
      uv[1],
      uv[2],
      uv[3],
      1,
    );
  }

  glyph(
    font: Font,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    uv: readonly number[],
    color: Rgba,
    pxRange: number,
    weight = 0,
  ) {
    this.#quad(
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      color,
      [enum_.glyph, font.index, pxRange, weight],
      [0, 0, 0, 0],
      uv[0]!,
      uv[1]!,
      uv[2]!,
      uv[3]!,
      1,
    );
  }

  /** A soft elliptical glow centred on (cx, cy). falloff ≈ 2–6; pulse 0..1. */
  glow(cx: number, cy: number, rx: number, ry: number, color: Rgba, falloff = 3, pulse = 0, phase = 0) {
    if (color[3] <= 0) return;
    this.#quad(
      cx - rx,
      cy - ry,
      rx * 2,
      ry * 2,
      color,
      [enum_.glow, phase, 0, 0],
      [rx, ry, falloff, pulse],
      0,
      0,
      1,
      1,
      1,
    );
  }

  /** A capsule from (x1,y1) to (x2,y2). dash > 0 draws marching dashes. */
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgba, dash = 0, speed = 0) {
    if (color[3] <= 0) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-3;
    const ux = dx / len;
    const uy = dy / len;
    const hw = width / 2 + 1;
    const hx = len / 2;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    // Oriented quad: corners in (along, across) local space.
    const corners: [number, number][] = [
      [-hx - hw, -hw],
      [hx + hw, -hw],
      [-hx - hw, hw],
      [hx + hw, hw],
    ];
    this.#ensure();
    let o = this.#quads * 4 * FLOATS;
    for (const [lx, ly] of corners) {
      const px = cx + ux * lx - uy * ly;
      const py = cy + uy * lx + ux * ly;
      o = this.#vertex(o, px, py, 0, 0, color, [enum_.line, speed, 0, 0], [hx, width / 2, dash, 0], lx, ly);
    }
    this.#quads++;
  }

  flush() {
    if (this.#quads === 0) return;
    const gl = this.#gl;
    const p = this.#program;
    gl.useProgram(p.handle);
    gl.uniform2f(p.uniform.u_viewport!, this.#viewport[0], this.#viewport[1]);
    gl.uniform1f(p.uniform.u_time!, this.#time);
    gl.uniform1i(p.uniform.u_image!, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#image?.handle ?? null);
    this.#fonts.forEach((font, i) => {
      gl.uniform1i(p.uniform[`u_font${i}`]!, i + 1);
      gl.activeTexture(gl.TEXTURE0 + i + 1);
      gl.bindTexture(gl.TEXTURE_2D, font.texture.handle);
    });
    gl.activeTexture(gl.TEXTURE0);

    if (this.#clip) {
      const [x, y, w, h] = this.#clip;
      gl.enable(gl.SCISSOR_TEST);
      const sx = this.#physical[0] / this.#viewport[0],
        sy = this.#physical[1] / this.#viewport[1];
      const left = Math.floor(x * sx),
        bottom = Math.floor(this.#physical[1] - (y + h) * sy);
      gl.scissor(
        left,
        bottom,
        Math.max(0, Math.ceil((x + w) * sx) - left),
        Math.max(0, Math.ceil(this.#physical[1] - y * sy) - bottom),
      );
    } else {
      gl.disable(gl.SCISSOR_TEST);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.#data.subarray(0, this.#quads * 4 * FLOATS), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
    const stride = FLOATS * 4;
    const attr = (name: string, size: number, offset: number) => {
      const loc = p.attrib[name];
      if (loc === undefined || loc < 0) return;
      gl.enableVertexAttribArray(loc);
      this.#instancing?.vertexAttribDivisorANGLE(loc, 0);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
    };
    attr('a_pos', 2, 0);
    attr('a_uv', 2, 2);
    attr('a_color', 4, 4);
    attr('a_params', 4, 8);
    attr('a_shape', 4, 12);
    attr('a_local', 2, 16);
    gl.drawElements(gl.TRIANGLES, this.#quads * 6, gl.UNSIGNED_SHORT, 0);
    this.submittedQuads += this.#quads;
    this.drawCalls++;
    this.#quads = 0;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  #ensure() {
    if (this.#quads >= MAX_QUADS) this.flush();
  }

  #quad(
    x: number,
    y: number,
    w: number,
    h: number,
    color: Rgba,
    params: readonly [number, number, number, number],
    shape: readonly [number, number, number, number],
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    pad: number,
  ) {
    this.#ensure();
    // Pad by a pixel so SDF anti-aliasing isn't clipped by the quad edge.
    const p = params[0] === enum_.glyph || params[0] === enum_.image ? 0 : pad;
    const hw = w / 2 + p;
    const hh = h / 2 + p;
    const cx = x + w / 2;
    const cy = y + h / 2;
    let o = this.#quads * 4 * FLOATS;
    o = this.#vertex(o, cx - hw, cy - hh, u0, v0, color, params, shape, -hw, -hh);
    o = this.#vertex(o, cx + hw, cy - hh, u1, v0, color, params, shape, hw, -hh);
    o = this.#vertex(o, cx - hw, cy + hh, u0, v1, color, params, shape, -hw, hh);
    this.#vertex(o, cx + hw, cy + hh, u1, v1, color, params, shape, hw, hh);
    this.#quads++;
  }

  #vertex(
    o: number,
    x: number,
    y: number,
    u: number,
    v: number,
    c: Rgba,
    params: readonly number[],
    shape: readonly number[],
    lx: number,
    ly: number,
  ): number {
    const d = this.#data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = u;
    d[o + 3] = v;
    d[o + 4] = c[0];
    d[o + 5] = c[1];
    d[o + 6] = c[2];
    d[o + 7] = c[3];
    d[o + 8] = params[0]!;
    d[o + 9] = params[1]!;
    d[o + 10] = params[2]!;
    d[o + 11] = params[3]!;
    d[o + 12] = shape[0]!;
    d[o + 13] = shape[1]!;
    d[o + 14] = shape[2]!;
    d[o + 15] = shape[3]!;
    d[o + 16] = lx;
    d[o + 17] = ly;
    return o + FLOATS;
  }
}
