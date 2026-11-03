import { HostNode, type Box } from '../runtime/nodes.ts';
import { Painter, type PaintFrame } from '../runtime/paint.ts';
import type { ScrollPresentation, PresentationSize } from '../runtime/presentation.ts';
import { isNativeScrollCallback, type ScrollMode } from '../scroll.ts';
import type { NativeScrollInfo } from '../platform/root-types.ts';
import { planNativeTiles, type NativeTilePlan } from './native-scroll-plan.ts';
import { labelOf } from '../runtime/semantics.ts';

interface Entry {
  node: HostNode;
  host: HTMLDivElement;
  viewport: HTMLDivElement;
  content: HTMLDivElement;
  tiles: Map<number, HTMLCanvasElement>;
  plan: NativeTilePlan;
  key: string;
}
const inside = (node: HostNode, ancestor: HostNode) => {
  for (let n: HostNode | undefined = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
};
const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  inner.x + inner.w <= outer.x + outer.w + 0.01 &&
  inner.y + inner.h <= outer.y + outer.h + 0.01;
const pointerHandlers = ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel'] as const;

/** Browser-only adapter. Raster replay shares the owning root's context, tree and textures. */
export class NativeScrollManager implements ScrollPresentation {
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly gl: WebGLRenderingContext;
  readonly options: { mode: ScrollMode; budget: number; ownedContext: boolean; clear: () => void };
  readonly active = new Set<HostNode>();
  readonly info: NativeScrollInfo = {
    regions: 0,
    tiles: 0,
    rasterBytes: 0,
    copiedTiles: 0,
    copyCallMs: 0,
    drawCalls: 0,
    submittedQuads: 0,
  };
  readonly #entries = new Map<HostNode, Entry>();
  readonly #retired: Entry[] = [];
  readonly #extentFailures = new WeakMap<HostNode, { height: number; viewport: number; width: number }>();
  readonly #painter = new Painter();
  #enabled = true;
  #destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    gl: WebGLRenderingContext,
    options: { mode: ScrollMode; budget: number; ownedContext: boolean; clear: () => void },
  ) {
    this.canvas = canvas;
    this.container = container;
    this.gl = gl;
    this.options = options;
  }

  host(node: HostNode) {
    return this.#entries.get(node)?.host;
  }
  content(node: HostNode) {
    return this.#entries.get(node)?.content;
  }
  owns(node: HostNode) {
    return Boolean(this.ancestor(node));
  }
  ancestor(node: HostNode): HostNode | undefined {
    for (let n: HostNode | undefined = node; n; n = n.parent) if (this.active.has(n)) return n;
  }
  placement(node: HostNode) {
    const ancestor = this.ancestor(node);
    if (!ancestor) return;
    return { x: node.abs.x - ancestor.abs.x, y: node.abs.y - ancestor.abs.y + ancestor.paintedScrollY };
  }
  containsTarget(target: EventTarget | null) {
    return (
      target instanceof Element && Boolean(target.closest('[data-ludic-scroll]')) && this.container.contains(target)
    );
  }

  #unsupported(node: HostNode, visible: readonly HostNode[], size: PresentationSize): string | undefined {
    if (!this.options.ownedContext) return 'a root-owned WebGL context';
    const failed = this.#extentFailures.get(node);
    if (failed && failed.height === node.contentHeight && failed.viewport === node.box.h && failed.width === node.box.w)
      return 'content within the browser scrollable-height limit';
    if (node.type !== 'view') return 'a View scrolling region';
    if (node.props.onPress || node.props.focusable) return 'a separate pressable child';
    if (Math.abs(node.abs.w - node.box.w) > 0.01 || Math.abs(node.abs.h - node.box.h) > 0.01)
      return 'an unscaled scroll surface';
    const bounds = {
      x: 0,
      y: 0,
      w: size.cssWidth ?? size.width / size.dpr,
      h: size.cssHeight ?? size.height / size.dpr,
    };
    if (!contains(bounds, node.abs) || (node.clip && !contains(node.clip, node.abs)))
      return 'an unclipped scroll surface inside the canvas';
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor.props.style?.overflow === 'scroll') return 'a top-level scrolling region';
      if (
        ancestor.props.onWheel ||
        pointerHandlers.some((key) => ancestor.props[key] && !isNativeScrollCallback(ancestor.props[key]))
      )
        return 'browser-owned pointer and wheel gestures';
    }
    const visit = (n: HostNode): string | undefined => {
      if (n.props.editor) return 'canvas presentation for native editors';
      if (n !== node && n.props.block) return 'canvas presentation for blocking descendants';
      if (n.props.onHover && !n.props.onPress && !n.props.focusable)
        return 'canvas presentation for hover-only targets without a native event surface';
      if (
        (n.props.onPress || n.props.focusable) &&
        (!(n.props.label ?? labelOf(n)).trim() ||
          ['region', 'dialog', 'listbox', 'tablist'].includes(n.props.role ?? ''))
      )
        return 'labeled pressable controls with distinct button/option semantics';
      if (n !== node && n.props.style?.overflow && n.props.style.overflow !== 'visible')
        return 'content without nested scrolling or clipping';
      if (n.props.onWheel || pointerHandlers.some((key) => n.props[key] && !isNativeScrollCallback(n.props[key])))
        return 'browser-owned pointer and wheel gestures';
      for (const child of n.children)
        if (child instanceof HostNode) {
          const reason = visit(child);
          if (reason) return reason;
        }
    };
    const reason = visit(node);
    if (reason) return reason;
    const at = visible.indexOf(node);
    for (let i = at + 1; i < visible.length; i++) {
      const other = visible[i]!;
      if (inside(other, node) || inside(node, other)) continue;
      const box = other.clip
        ? {
            x: Math.max(other.abs.x, other.clip.x),
            y: Math.max(other.abs.y, other.clip.y),
            w: Math.max(
              0,
              Math.min(other.abs.x + other.abs.w, other.clip.x + other.clip.w) - Math.max(other.abs.x, other.clip.x),
            ),
            h: Math.max(
              0,
              Math.min(other.abs.y + other.abs.h, other.clip.y + other.clip.h) - Math.max(other.abs.y, other.clip.y),
            ),
          }
        : other.abs;
      if (box.w > 0 && box.h > 0 && intersects(node.abs, box)) return 'a topmost, non-overlapping scroll surface';
    }
  }

  #clearTiles(entry: Entry) {
    for (const tile of entry.tiles.values()) {
      tile.remove();
      tile.width = tile.height = 0;
    }
    entry.tiles.clear();
  }
  #retire(node: HostNode) {
    const entry = this.#entries.get(node);
    if (!entry) return;
    node.scrollY = Math.max(0, Math.min(node.scrollY, Math.max(0, node.contentHeight - node.box.h)));
    node.scrollDriver = undefined;
    node.scrollRenderRange = undefined;
    this.#clearTiles(entry);
    this.#entries.delete(node);
    this.active.delete(node);
    // Semantic controls move back in InputSystem.afterPaint before the host is removed.
    this.#retired.push(entry);
  }
  #create(node: HostNode, plan: NativeTilePlan): Entry {
    const host = document.createElement('div');
    host.dataset.ludicScrollHost = String(node.id);
    const viewport = document.createElement('div');
    viewport.dataset.ludicScroll = String(node.id);
    viewport.style.cssText =
      'position:relative;width:100%;height:100%;overflow-x:hidden;overflow-y:scroll;overflow-anchor:none;touch-action:pan-y pinch-zoom;overscroll-behavior-y:contain;pointer-events:auto;';
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;width:100%;pointer-events:none';
    viewport.append(content);
    host.append(viewport);
    this.container.append(host);
    const entry: Entry = { node, host, viewport, content, tiles: new Map(), plan, key: '' };
    this.#entries.set(node, entry);
    this.active.add(node);
    let representable = true;
    let fallbackOffset = node.scrollY;
    node.scrollDriver = {
      setExtent: (height, viewportHeight) => {
        if (representable) fallbackOffset = viewport.scrollTop;
        content.style.height = `${height}px`;
        host.style.height = `${viewportHeight}px`;
        representable = Math.abs(viewport.scrollHeight - Math.max(height, viewport.clientHeight)) <= 1;
      },
      getOffset: () => (representable ? viewport.scrollTop : fallbackOffset),
      setOffset: (offset) => {
        fallbackOffset = offset;
        if (representable) viewport.scrollTop = offset;
      },
    };
    return entry;
  }

  prepare(
    root: HostNode,
    nodes: readonly HostNode[],
    painter: Painter,
    frame: PaintFrame,
    size: PresentationSize,
    revision: number,
  ) {
    const candidates = nodes.filter(
      (node) => node.props.style?.overflow === 'scroll' && (node.props.scrollMode ?? this.options.mode) !== 'canvas',
    );
    if (!candidates.length) {
      for (const node of this.#entries.keys()) this.#retire(node);
      return false;
    }
    painter.measure(root, frame);
    const wanted = new Set<HostNode>();
    const modal = painter.visible.findLast((node) => Boolean(node.props.modal));
    let remaining = this.options.budget;
    for (const node of candidates) {
      if (
        node.destroyed ||
        node.hidden ||
        node.props.disabled ||
        node.paintedOpacity <= 0.003 ||
        !painter.hitList.includes(node) ||
        !inside(node, modal ?? root) ||
        node.box.w <= 0 ||
        node.box.h <= 0 ||
        node.contentHeight <= node.box.h
      )
        continue;
      const mode = node.props.scrollMode ?? this.options.mode;
      const reason = this.#unsupported(node, painter.visible, size);
      const tileHeight = Math.min(384, Math.floor(size.height / frame.dpr));
      const plan = reason
        ? undefined
        : planNativeTiles(node.box.w, node.box.h, node.contentHeight, node.scrollY, frame.dpr, tileHeight, remaining);
      if (!plan) {
        if (mode === 'native')
          throw new Error(`Native scrolling requires ${reason ?? 'a scroll surface within the raster budget'}`);
        continue;
      }
      wanted.add(node);
      remaining -= plan.bytes;
      const existing = this.#entries.get(node);
      const entry = existing ?? this.#create(node, plan);
      const a = node.abs;
      entry.host.style.cssText = `position:absolute;left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;overflow:hidden;pointer-events:auto;visibility:${this.#enabled ? 'visible' : 'hidden'};`;
      entry.content.style.height = `${node.contentHeight}px`;
      // Hide only classic scrollbar gutters outside the host. iOS overlay indicators remain native.
      entry.viewport.style.width = '100%';
      const gutter = entry.viewport.offsetWidth - entry.viewport.clientWidth;
      if (gutter) entry.viewport.style.width = `calc(100% + ${gutter}px)`;
      if (!existing) entry.viewport.scrollTop = node.scrollY;
      if (Math.abs(entry.viewport.scrollHeight - node.contentHeight) > 1) {
        this.#extentFailures.set(node, { height: node.contentHeight, viewport: node.box.h, width: node.box.w });
        this.#retire(node);
        wanted.delete(node);
        remaining += plan.bytes;
        if (mode === 'native')
          throw new Error('Native scrolling requires content within the browser scrollable-height limit');
        continue;
      }
      node.scrollY = Math.max(0, Math.min(entry.viewport.scrollTop, node.contentHeight - node.box.h));
      const range = { start: plan.start, end: plan.end };
      if (node.scrollRenderRange?.start !== range.start || node.scrollRenderRange.end !== range.end)
        node.scrollRenderRange = range;
      entry.plan = plan;
      let animated = false;
      const interactions: string[] = [];
      const scan = (n: HostNode) => {
        if (n.hovered || n.pressed || n.focused)
          interactions.push(`${n.id}:${Number(n.hovered)}${Number(n.pressed)}${Number(n.focused)}`);
        if (
          n.type === 'image' ||
          n.type === 'line' ||
          n.props.style?.breathe ||
          n.props.style?.glow?.pulse ||
          n.props.hoverStyle?.glow?.pulse ||
          n.props.pressStyle?.glow?.pulse ||
          (n.props.enter && frame.now - n.mountedAt < (n.props.enter.delay ?? 0) + (n.props.enter.duration ?? 420)) ||
          Math.abs(n.hoverT - Number(n.hovered && !n.props.disabled)) > 0.001 ||
          Math.abs(n.pressT - Number(n.pressed && !n.props.disabled)) > 0.001 ||
          Math.abs(n.focusT - Number(n.focused)) > 0.001 ||
          [...n.tweens.values()].some((tween) => frame.now - tween.start < tween.duration)
        )
          animated = true;
        for (const child of n.children) if (child instanceof HostNode) scan(child);
      };
      scan(node);
      const key = `${revision}/${node.box.w}/${node.box.h}/${node.contentHeight}/${frame.dpr}/${tileHeight}/${node.paintedOpacity}/${frame.textColor}/${frame.emphasisColor}/${frame.focusRing}/${frame.reducedMotion}/${interactions.join(',')}`;
      if (key !== entry.key || animated) {
        this.#clearTiles(entry);
        entry.key = key;
      }
    }
    for (const node of [...this.#entries.keys()]) if (!wanted.has(node)) this.#retire(node);
    return true;
  }

  capture(frame: PaintFrame, size: PresentationSize) {
    this.info.copiedTiles = this.info.copyCallMs = this.info.drawCalls = this.info.submittedQuads = 0;
    let touched = false;
    try {
      for (const entry of this.#entries.values()) {
        for (const [index, tile] of entry.tiles)
          if (!entry.plan.indices.includes(index)) {
            tile.remove();
            tile.width = tile.height = 0;
            entry.tiles.delete(index);
          }
      }
      for (const entry of this.#entries.values()) {
        for (const index of entry.plan.indices) {
          if (entry.tiles.has(index)) continue;
          const tile = document.createElement('canvas');
          const offset = index * entry.plan.tileHeight;
          const height = Math.min(entry.plan.tileHeight, entry.node.contentHeight - offset);
          tile.width = Math.min(size.width, Math.ceil(entry.node.box.w * frame.dpr));
          tile.height = Math.min(size.height, Math.ceil(height * frame.dpr));
          tile.dataset.ludicScrollTile = String(index);
          tile.setAttribute('aria-hidden', 'true');
          tile.style.cssText = `position:absolute;pointer-events:none;left:0;top:${offset}px;width:${entry.node.box.w}px;height:${height}px`;
          const context = tile.getContext('2d');
          if (!context) {
            tile.width = tile.height = 0;
            throw new Error('Native scrolling requires Canvas 2D tile presentation');
          }
          try {
            touched = true;
            this.gl.viewport(0, 0, tile.width, tile.height);
            this.gl.enable(this.gl.SCISSOR_TEST);
            this.gl.scissor(0, 0, tile.width, tile.height);
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            frame.batch.begin(entry.node.box.w * frame.dpr, height * frame.dpr, frame.time, tile.width, tile.height);
            try {
              this.#painter.paintScrollContent(entry.node, frame, offset, height);
            } finally {
              frame.batch.end();
            }
            this.info.drawCalls += frame.batch.drawCalls;
            this.info.submittedQuads += frame.batch.submittedQuads;
            const started = performance.now();
            // Same-task capture of the bottom-left WebGL viewport, using HTML top-left image coordinates.
            context.drawImage(
              this.canvas,
              0,
              this.canvas.height - tile.height,
              tile.width,
              tile.height,
              0,
              0,
              tile.width,
              tile.height,
            );
            this.info.copyCallMs += performance.now() - started;
            this.info.copiedTiles++;
            entry.content.append(tile);
            entry.tiles.set(index, tile);
          } catch (error) {
            tile.width = tile.height = 0;
            throw error;
          }
        }
      }
    } finally {
      if (touched) {
        this.gl.viewport(0, 0, size.width, size.height);
        this.gl.disable(this.gl.SCISSOR_TEST);
        this.options.clear();
      }
      this.info.regions = this.#entries.size;
      this.info.tiles = this.info.rasterBytes = 0;
      for (const entry of this.#entries.values())
        for (const tile of entry.tiles.values()) {
          this.info.tiles++;
          this.info.rasterBytes += tile.width * tile.height * 4;
        }
    }
  }
  afterPaint() {
    for (const entry of this.#retired.splice(0)) entry.host.remove();
  }
  setEnabled(enabled: boolean) {
    this.#enabled = enabled;
    for (const entry of this.#entries.values()) {
      entry.host.style.visibility = enabled ? 'visible' : 'hidden';
      entry.host.style.pointerEvents = enabled ? 'auto' : 'none';
    }
  }
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const node of [...this.#entries.keys()]) this.#retire(node);
    this.afterPaint();
    Object.assign(this.info, {
      regions: 0,
      tiles: 0,
      rasterBytes: 0,
      copiedTiles: 0,
      drawCalls: 0,
      submittedQuads: 0,
      copyCallMs: 0,
    });
  }
}
