// The painter: walks the host tree after layout and turns it into batched
// draw calls. It also owns per-node animation (transitions, enter, hover and
// press blending) so React never re-renders for motion.

import type { UiBatch, Rgba } from '../gfx/batch.ts';
import { parseColor } from '../gfx/gl.ts';
import type { TextureStore } from '../gfx/textures.ts';
import type { FontBook } from '../gfx/font.ts';
import { HostNode, type Box } from './nodes.ts';
import type { ImageStyleProp, TextStyleProp, ViewStyle } from './types.ts';

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const mixN = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t);
const evaluate = (t: { from: number[]; to: number[]; start: number; duration: number }, now: number) =>
  t.duration > 0 && now - t.start < t.duration
    ? mixN(t.from, t.to, ease(Math.max(0, (now - t.start) / t.duration)))
    : t.to;

export interface PaintFrame {
  batch: UiBatch;
  textures: TextureStore;
  fonts: FontBook;
  dpr: number;
  now: number; // ms
  time: number; // s
  dt: number; // s
  focusRing: string;
  textColor: string;
  emphasisColor: string;
  reducedMotion: boolean;
}

export class Painter {
  /** Interactive nodes in paint order, for hit-testing (last = topmost). */
  hitList: HostNode[] = [];
  visible: HostNode[] = [];
  readonly #colors = new Map<string, Rgba>();
  #color(input: string | undefined): Rgba {
    if (!input) return [0, 0, 0, 0];
    let result = this.#colors.get(input);
    if (!result) {
      result = parseColor(input);
      if (this.#colors.size >= 512) this.#colors.delete(this.#colors.keys().next().value!);
      this.#colors.set(input, result);
    }
    return result;
  }
  #f!: PaintFrame;

  paint(root: HostNode, frame: PaintFrame) {
    this.#f = frame;
    this.hitList = [];
    this.visible = [];
    this.#node(root, 0, 0, 1, undefined, 1, true);
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  /** Returns the displayed value for a channel, starting a tween when the target changes. */
  #value(node: HostNode, key: string, target: number[], duration: number): number[] {
    const now = this.#f.now;
    if (this.#f.reducedMotion) {
      node.tweens.delete(key);
      return target;
    }
    let tween = node.tweens.get(key);
    if (!tween) {
      node.tweens.set(key, { from: target, to: target, start: now, duration: 0 });
      return target;
    }
    if (tween.to.some((v, i) => v !== target[i])) {
      const current = evaluate(tween, now);
      tween =
        duration > 0
          ? { from: current, to: target, start: now, duration }
          : { from: target, to: target, start: now, duration: 0 };
      node.tweens.set(key, tween);
    }
    return evaluate(tween, now);
  }

  #enter(node: HostNode, key: 'opacity' | 'translateX' | 'translateY' | 'scale', value: number): number {
    const enter = node.props.enter;
    if (this.#f.reducedMotion || !enter || enter[key] === undefined) return value;
    const t = (this.#f.now - node.mountedAt - (enter.delay ?? 0)) / (enter.duration ?? 420);
    if (t >= 1) return value;
    return enter[key]! + (value - enter[key]!) * ease(Math.max(0, t));
  }

  #blend(node: HostNode) {
    const dt = this.#f.dt;
    const step = (cur: number, on: boolean, speed: number) =>
      cur + ((on ? 1 : 0) - cur) * (this.#f.reducedMotion ? 1 : Math.min(1, dt * speed));
    node.hoverT = step(node.hoverT, node.hovered && !node.props.disabled, 14);
    node.pressT = step(node.pressT, node.pressed && !node.props.disabled, 22);
    node.focusT = step(node.focusT, node.focused, 14);
  }

  // ── Traversal ──────────────────────────────────────────────────────────────

  #node(
    node: HostNode,
    px: number,
    py: number,
    parentOpacity: number,
    clip: Box | undefined,
    parentScale: number,
    inputEnabled: boolean,
  ) {
    if (node.hidden || node.destroyed) return;
    const style = (node.props.style ?? {}) as ViewStyle & TextStyleProp & ImageStyleProp;
    if (style.display === 'none') return;
    this.#blend(node);

    const duration = node.props.transition ?? 0;
    const hover = node.props.hoverStyle;
    const press = node.props.pressStyle;
    const pick = (key: 'opacity' | 'translateX' | 'translateY' | 'scale', base: number) => {
      let v = base;
      const h = hover?.[key];
      const p = press?.[key];
      if (typeof h === 'number') v += (h - v) * node.hoverT;
      if (typeof p === 'number') v += (p - v) * node.pressT;
      return v;
    };

    const [baseOpacity] = this.#value(node, 'opacity', [style.opacity ?? 1], duration);
    const [tx] = this.#value(node, 'tx', [style.translateX ?? 0], duration);
    const [ty] = this.#value(node, 'ty', [style.translateY ?? 0], duration);
    const [sc] = this.#value(node, 'scale', [style.scale ?? 1], duration);
    let opacity = this.#enter(node, 'opacity', pick('opacity', baseOpacity!)) * parentOpacity;
    if (style.breathe && !this.#f.reducedMotion)
      opacity *= 1 - style.breathe * (0.5 + 0.5 * Math.sin(this.#f.time * 1.3 + node.id));
    if (node.props.disabled) opacity *= 0.45;
    const localScale = Math.max(0, this.#enter(node, 'scale', pick('scale', sc!)));
    const scale = parentScale * localScale;
    const x = px + (node.box.x + this.#enter(node, 'translateX', pick('translateX', tx!))) * parentScale;
    const y = py + (node.box.y + this.#enter(node, 'translateY', pick('translateY', ty!))) * parentScale;
    const w = node.box.w * scale;
    const h = node.box.h * scale;
    const ax = x + (node.box.w * parentScale - w) / 2;
    const ay = y + (node.box.h * parentScale - h) / 2;
    node.abs = { x: ax, y: ay, w, h };
    node.clip = clip;

    if (opacity <= 0.003 || scale <= 0) return;
    this.visible.push(node);
    const pe = node.props.pointerEvents ?? 'auto';
    if (
      inputEnabled &&
      pe === 'auto' &&
      (node.props.onPress ||
        node.props.focusable ||
        node.props.onPointerDown ||
        node.props.onPointerMove ||
        node.props.onPointerUp ||
        node.props.onHover ||
        node.props.block ||
        node.props.role === 'tablist' ||
        node.props.role === 'dialog' ||
        node.props.role === 'region' ||
        style.overflow === 'scroll')
    )
      this.hitList.push(node);

    const f = this.#f;
    const d = f.dpr;
    const b = f.batch;
    const radius = (style.borderRadius ?? 0) * d * scale;
    const hoverColor = (key: 'background' | 'borderColor' | 'color' | 'tint', base: string | undefined): Rgba => {
      let c = this.#color(base);
      const h = hover?.[key];
      if (typeof h === 'string' && node.hoverT > 0.001) c = mixN(c, this.#color(h), node.hoverT) as unknown as Rgba;
      return this.#value(node, `c:${key}`, [...c], duration) as unknown as Rgba;
    };
    const fade = (c: Rgba, a = opacity): Rgba => [c[0] * a, c[1] * a, c[2] * a, c[3] * a];

    // Glow sits behind everything else of this node.
    const glow = style.glow ?? (node.hoverT > 0.01 ? hover?.glow : undefined);
    if (glow) {
      const spread = (glow.spread ?? 24) * d * scale;
      const g = this.#color(glow.color);
      const strength = style.glow ? 1 : node.hoverT;
      b.glow(
        (ax + w / 2) * d,
        (ay + h / 2) * d,
        (w / 2) * d + spread,
        (h / 2) * d + spread,
        fade(g, opacity * strength),
        glow.falloff ?? 3,
        f.reducedMotion ? 0 : (glow.pulse ?? 0),
        node.id,
      );
    }

    // Background (solid or gradient) and border.
    if (Array.isArray(style.background)) {
      b.gradient(
        ax * d,
        ay * d,
        w * d,
        h * d,
        fade(this.#color(style.background[0])),
        fade(this.#color(style.background[1])),
        radius,
      );
    } else if (style.background || hover?.background) {
      b.rect(
        ax * d,
        ay * d,
        w * d,
        h * d,
        fade(hoverColor('background', style.background as string | undefined)),
        radius,
      );
    }
    if (node.props.fill !== undefined) {
      const [fill] = this.#value(node, 'fill', [Math.max(0, Math.min(1, node.props.fill))], duration || 350);
      if (fill! > 0.001)
        b.rect(ax * d, ay * d, w * fill! * d, h * d, fade(this.#color(node.props.fillColor ?? '#3be3c6')), radius);
    }
    const bw = style.borderWidth ?? (style.borderColor ? 1 : 0);
    if (bw > 0 && (style.borderColor || hover?.borderColor)) {
      b.ring(ax * d, ay * d, w * d, h * d, fade(hoverColor('borderColor', style.borderColor)), radius, bw * d * scale);
    }
    if (node.focusT > 0.01) {
      const pad = 3 * d;
      b.ring(
        ax * d - pad,
        ay * d - pad,
        w * d + pad * 2,
        h * d + pad * 2,
        fade(this.#color(f.focusRing), opacity * node.focusT),
        radius + pad,
        1.5 * d,
      );
    }

    // Children, clipped and scrolled if needed.
    const clips = style.overflow === 'hidden' || style.overflow === 'scroll';
    let childClip = clip;
    if (clips) {
      const box = { x: ax, y: ay, w, h };
      childClip = clip ? intersect(clip, box) : box;
    }
    if (style.overflow === 'scroll') {
      let bottom = 0;
      for (const c of node.children) if (c instanceof HostNode) bottom = Math.max(bottom, c.box.y + c.box.h);
      node.contentHeight = bottom + node.ctx.layout.paddingBottom(node.yoga);
      node.scrollY = Math.max(0, Math.min(node.scrollY, node.contentHeight - node.box.h));
    }
    const children = node.paintOrder();
    if (childClip !== clip)
      b.setClip(childClip ? [childClip.x * d, childClip.y * d, childClip.w * d, childClip.h * d] : undefined);
    // Content.
    if (node.type === 'text') this.#text(node, style, ax, ay, scale, opacity, hoverColor);
    else if (node.type === 'image') this.#image(node, style, ax, ay, w, h, radius, opacity, hoverColor);
    else if (node.type === 'line') this.#line(node, px, py, opacity, node.parent?.box, parentScale);

    const oy = style.overflow === 'scroll' ? -node.scrollY : 0;
    for (const child of children)
      this.#node(child, ax, ay + oy * scale, opacity, childClip, scale, inputEnabled && pe !== 'none');
    if (childClip !== clip) b.setClip(clip ? [clip.x * d, clip.y * d, clip.w * d, clip.h * d] : undefined);

    // Scroll affordance: a thin teal thumb when content overflows.
    if (style.overflow === 'scroll' && node.contentHeight > node.box.h + 1) {
      const ratio = node.box.h / node.contentHeight;
      const th = Math.max(24, h * ratio);
      const tyy = ay + (h - th) * (node.scrollY / (node.contentHeight - node.box.h));
      b.rect((ax + w - 3) * d, tyy * d, 2 * d, th * d, fade(this.#color('#3be3c655')), d);
    }
  }

  #text(
    node: HostNode,
    style: TextStyleProp,
    x: number,
    y: number,
    scale: number,
    opacity: number,
    hoverColor: (k: 'color', base: string | undefined) => Rgba,
  ) {
    const f = this.#f;
    const d = f.dpr;
    const ts = node.textStyle();
    const shaped = f.fonts.shape(node.text, ts, node.box.w);
    const size = ts.size * scale;
    const range = (font: ReturnType<typeof f.fonts.get>) =>
      Math.max(1, font.distanceRange * ((size * d) / font.atlasEm));
    const base = hoverColor('color', style.color ?? f.textColor);
    const emph = this.#color(style.emphasisColor ?? f.emphasisColor);
    const weight = style.weight ?? 0;
    const oy = 0;
    if (style.shadow) {
      // A soft drop shadow: same glyphs, offset, with a widened edge.
      const sh: Rgba = [0, 0, 0, 0.7 * opacity];
      const off = Math.max(1.5, size * 0.04);
      for (const g of shaped.glyphs) {
        const font = f.fonts.get(g.font);
        f.batch.glyph(
          font,
          (x + g.x0 * scale) * d,
          (y + oy + g.y0 * scale + off) * d,
          (x + g.x1 * scale) * d,
          (y + oy + g.y1 * scale + off) * d,
          g.uv,
          sh,
          Math.max(1, range(font) * 0.3),
          weight + 0.1,
        );
      }
    }
    for (const g of shaped.glyphs) {
      const font = f.fonts.get(g.font);
      const c = g.emphasis ? emph : base;
      f.batch.glyph(
        font,
        (x + g.x0 * scale) * d,
        (y + oy + g.y0 * scale) * d,
        (x + g.x1 * scale) * d,
        (y + oy + g.y1 * scale) * d,
        g.uv,
        [c[0] * opacity, c[1] * opacity, c[2] * opacity, c[3] * opacity],
        range(font),
        weight + (g.emphasis ? 0.03 : 0),
      );
    }
  }

  #image(
    node: HostNode,
    style: ImageStyleProp,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    opacity: number,
    hoverColor: (k: 'tint', base: string | undefined) => Rgba,
  ) {
    const f = this.#f;
    const d = f.dpr;
    const tint = hoverColor('tint', style.tint ?? '#ffffff');
    const draw = (src: string | undefined, alpha: number) => {
      if (!src || alpha <= 0.001) return;
      const tex = f.textures.get(src, w * d, h * d);
      if (!tex) return;
      const fit = style.fit ?? 'cover';
      let uv: [number, number, number, number] = [0, 0, 1, 1];
      let [dx, dy, dw, dh] = [x, y, w, h];
      const ia = tex.width / tex.height;
      const ba = w / Math.max(h, 1e-3);
      if (fit === 'cover') {
        if (ia > ba) {
          const span = ba / ia;
          const fx = style.focusX ?? 0.5;
          const u0 = (1 - span) * fx;
          uv = [u0, 0, u0 + span, 1];
        } else {
          const span = ia / ba;
          const fy = style.focusY ?? 0.5;
          const v0 = (1 - span) * fy;
          uv = [0, v0, 1, v0 + span];
        }
      } else if (fit === 'contain') {
        if (ia > ba) {
          dh = w / ia;
          dy = y + (h - dh) / 2;
        } else {
          dw = h * ia;
          dx = x + (w - dw) / 2;
        }
      }
      if (style.flipX) uv = [uv[2], uv[1], uv[0], uv[3]];
      if (style.flipY) uv = [uv[0], uv[3], uv[2], uv[1]];
      const a = opacity * alpha;
      f.batch.image(
        tex,
        dx * d,
        dy * d,
        dw * d,
        dh * d,
        uv,
        [tint[0] * a, tint[1] * a, tint[2] * a, tint[3] * a],
        radius,
        style.desaturate ?? 0,
        style.darken ?? 0,
      );
    };
    const props = node.props;
    const [mix] = this.#value(node, 'mix', [props.mix ?? 0], props.transition ?? 600);
    draw(props.src, 1);
    if (props.src2) draw(props.src2, mix!);
  }

  #line(node: HostNode, px: number, py: number, opacity: number, parent: Box | undefined, scale: number) {
    const f = this.#f;
    const d = f.dpr;
    const p = node.props;
    if (!p.from || !p.to) return;
    const sx = p.relative && parent ? parent.w : 1;
    const sy = p.relative && parent ? parent.h : 1;
    const from = [p.from[0] * sx, p.from[1] * sy];
    const to = [p.to[0] * sx, p.to[1] * sy];
    const c = this.#color(p.color ?? f.emphasisColor);
    f.batch.line(
      (px + from[0]! * scale) * d,
      (py + from[1]! * scale) * d,
      (px + to[0]! * scale) * d,
      (py + to[1]! * scale) * d,
      (p.width ?? 1.5) * d * scale,
      [c[0] * opacity, c[1] * opacity, c[2] * opacity, c[3] * opacity],
      (p.dash ?? 0) * d * scale,
      (f.reducedMotion ? 0 : (p.speed ?? 0)) * d,
    );
  }
}

function intersect(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
    h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y),
  };
}
