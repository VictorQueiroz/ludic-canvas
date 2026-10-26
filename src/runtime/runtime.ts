// UiRuntime: per-frame glue between React's host tree, Yoga and the painter.

import type { ReactNode } from 'react';
import type { UiBatch } from '../gfx/batch.ts';
import type { FontBook } from '../gfx/font.ts';
import type { TextureStore } from '../gfx/textures.ts';
import type { YogaLayout } from '../wasm/layout.ts';
import { InputSystem } from './input.ts';
import { HostNode, type RuntimeContext } from './nodes.ts';
import { Painter } from './paint.ts';
import { createUiRoot, type UiRoot } from './reconciler.ts';

export class UiRuntime {
  readonly ctx: RuntimeContext;
  readonly input: InputSystem;
  readonly #root: UiRoot;
  readonly #painter = new Painter();
  readonly #layout: YogaLayout;
  #handles = new Uint32Array(256);
  #boxes = new Float32Array(1024);
  #size = [0, 0];
  #scale = 0;
  theme = { focusRing: '#90b4ff', textColor: '#edf2ff', emphasisColor: '#90b4ff' };
  reducedMotion = false;

  constructor(options: { canvas: HTMLCanvasElement; a11y: HTMLElement; layout: YogaLayout; fonts: FontBook }) {
    this.#layout = options.layout;
    this.ctx = { layout: options.layout, fonts: options.fonts, textScale: 1, invalidate: () => {} };
    this.#root = createUiRoot(this.ctx);
    this.input = new InputSystem(options.canvas, options.a11y, this.#painter);
  }

  /** Development aid: the host tree with computed boxes. */
  dump(): unknown {
    const walk = (n: HostNode): unknown => ({
      t: n.type,
      text: n.type === 'text' ? n.text.slice(0, 24) : undefined,
      box: [n.box.x, n.box.y, n.box.w, n.box.h].map((v) => Math.round(v * 10) / 10),
      c: n.children.filter((c): c is HostNode => c instanceof HostNode).map(walk),
    });
    return walk(this.#root.root);
  }

  render(element: ReactNode) {
    this.#root.render(element);
  }

  destroy() {
    this.input.destroy();
    this.#root.destroy();
    this.#layout.dispose();
  }

  setTextScale(scale: number) {
    if (this.ctx.textScale === scale) return;
    this.ctx.textScale = scale;
    // Every text leaf must re-measure.
    const walk = (n: HostNode) => {
      if (n.type === 'text') this.#layout.markDirty(n.yoga);
      for (const c of n.children) if (c instanceof HostNode) walk(c);
    };
    walk(this.#root.root);
  }

  frame(
    batch: UiBatch,
    textures: TextureStore,
    fonts: FontBook,
    size: { width: number; height: number; dpr: number },
    now: number,
    dt: number,
  ) {
    const { width, height, dpr } = size;
    if (this.#scale !== dpr) {
      this.#scale = dpr;
      this.#layout.setPointScale(dpr);
    }
    const cssW = width / dpr;
    const cssH = height / dpr;
    if (this.#size[0] !== cssW || this.#size[1] !== cssH) this.#size = [cssW, cssH];
    const root = this.#root.root;
    this.#layout.calculate(root.yoga, cssW, cssH);

    // Read every box in one boundary crossing.
    const nodes: HostNode[] = [];
    const collect = (n: HostNode) => {
      nodes.push(n);
      for (const c of n.children) if (c instanceof HostNode) collect(c);
    };
    collect(root);
    if (this.#handles.length < nodes.length) {
      this.#handles = new Uint32Array(nodes.length * 2);
      this.#boxes = new Float32Array(nodes.length * 8);
    }
    for (let i = 0; i < nodes.length; i++) this.#handles[i] = nodes[i]!.yoga;
    this.#layout.readLayouts(this.#handles.subarray(0, nodes.length), this.#boxes.subarray(0, nodes.length * 4));
    const changed: HostNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const x = this.#boxes[i * 4]!;
      const y = this.#boxes[i * 4 + 1]!;
      const w = this.#boxes[i * 4 + 2]!;
      const h = this.#boxes[i * 4 + 3]!;
      if (n.props.onLayout && (n.box.x !== x || n.box.y !== y || n.box.w !== w || n.box.h !== h)) changed.push(n);
      n.box.x = x;
      n.box.y = y;
      n.box.w = w;
      n.box.h = h;
    }
    if (changed.length) {
      queueMicrotask(() => {
        for (const n of changed)
          if (!n.destroyed) n.props.onLayout?.({ x: n.box.x, y: n.box.y, width: n.box.w, height: n.box.h });
      });
    }

    batch.begin(width, height, now / 1000);
    this.#painter.paint(root, {
      batch,
      textures,
      fonts,
      dpr,
      now,
      time: now / 1000,
      dt,
      ...this.theme,
      reducedMotion: this.reducedMotion,
    });
    batch.end();
    this.input.afterPaint();

    // Live region: the newest announced text.
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!;
      if (n.type === 'text' && n.props.announce) {
        this.input.announce(n.text.replace(/\*\*/g, ''));
        break;
      }
    }
  }
}
