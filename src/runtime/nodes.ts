// Host nodes: what the reconciler creates. Each node owns a Yoga node in
// lc_layout.wasm and keeps the last computed box; painting and hit-testing
// read those boxes. Style objects are diffed key-by-key so only changed
// properties cross into wasm.

import {
  ALIGN,
  DISPLAY,
  Edge,
  EnumProp,
  FLEX_DIRECTION,
  Gutter,
  JUSTIFY,
  LengthProp,
  NumberProp,
  OVERFLOW,
  POSITION,
  Unit,
  WRAP,
} from '../wasm/abi.ts';
import type { YogaLayout } from '../wasm/layout.ts';
import type { FontBook, TextStyle } from '../gfx/font.ts';
import type { AnyProps, Dim, HostType, LayoutStyle, TextStyleProp } from './types.ts';
import { detachScroll, type ScrollSnapshot } from '../scroll.ts';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RuntimeContext {
  layout: YogaLayout;
  fonts: FontBook;
  textScale: number;
  invalidate(): void;
  onError?: (error: unknown) => void;
  nextNodeId?: number;
}

export class TextInstance {
  text: string;
  parent: HostNode | undefined;
  constructor(text: string) {
    this.text = text;
  }
  setText(text: string) {
    this.text = text;
    this.parent?.textChanged();
  }
}

export class HostNode {
  readonly id: number;
  readonly type: HostType;
  readonly yoga: number;
  readonly ctx: RuntimeContext;
  props: AnyProps;
  parent: HostNode | undefined;
  children: (HostNode | TextInstance)[] = [];
  hidden = false;
  destroyed = false;

  // Layout (relative to parent) and last painted absolute box (CSS px).
  box: Box = { x: 0, y: 0, w: 0, h: 0 };
  abs: Box = { x: 0, y: 0, w: 0, h: 0 };
  clip: Box | undefined;
  /** Final inherited opacity shared with native editors. */
  paintedOpacity = 1;
  releaseEditor?: () => void;

  // Interaction & animation state, owned by the painter/input system.
  hovered = false;
  pressed = false;
  focused = false;
  scrollY = 0;
  contentHeight = 0;
  scrollSnapshot?: ScrollSnapshot;
  scrollEventQueued = false;
  mountedAt = performance.now();
  tweens = new Map<string, { from: number[]; to: number[]; start: number; duration: number }>();
  hoverT = 0;
  pressT = 0;
  focusT = 0;

  #measureId = 0;
  #textCache = '';

  constructor(type: HostType, props: AnyProps, ctx: RuntimeContext) {
    this.id = ctx.nextNodeId = (ctx.nextNodeId ?? 0) + 1;
    this.type = type;
    this.ctx = ctx;
    this.props = props;
    this.yoga = ctx.layout.create();
    if (type === 'line') {
      ctx.layout.setEnum(this.yoga, EnumProp.PositionType, POSITION.absolute);
    }
    applyLayout(ctx.layout, this.yoga, {}, layoutOf(props));
    if (type === 'text') {
      this.#measureId = ctx.layout.setMeasure(this.yoga, (width) => {
        const shaped = this.shape(width);
        return [shaped.width, shaped.height];
      });
      this.#textCache = textOf(this);
    }
  }

  get text(): string {
    return this.#textCache;
  }

  /** Text style resolved for the font book. */
  textStyle(): TextStyle {
    const s = (this.props.style ?? {}) as TextStyleProp;
    return {
      font: s.fontFamily ?? this.ctx.fonts.defaultName,
      kerning: s.fontKerning !== 'none',
      size: (s.fontSize ?? 16) * this.ctx.textScale,
      lineHeight: s.lineHeight ?? 1,
      tracking: s.letterSpacing ?? 0,
      align: s.textAlign ?? 'left',
      upper: s.textTransform === 'uppercase',
      rich: Boolean(this.props.rich),
      ...(s.maxLines !== undefined ? { maxLines: s.maxLines } : {}),
      ellipsis: s.textOverflow === 'ellipsis',
    };
  }

  shape(width: number) {
    return this.ctx.fonts.shape(this.#textCache, this.textStyle(), width);
  }

  // ── Tree ───────────────────────────────────────────────────────────────────

  append(child: HostNode | TextInstance) {
    this.insert(child, undefined);
  }

  insert(child: HostNode | TextInstance, before: HostNode | TextInstance | undefined) {
    if (child.parent) child.parent.remove(child, false);
    const index = before ? this.children.indexOf(before) : -1;
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.push(child);
    child.parent = this;
    if (child instanceof HostNode) {
      // Yoga only knows host nodes; text instances live inside <text>.
      const yogaIndex = this.children
        .slice(0, index >= 0 ? index : this.children.length - 1)
        .filter((c) => c instanceof HostNode).length;
      if (this.type !== 'text') this.ctx.layout.insert(this.yoga, child.yoga, yogaIndex);
    } else {
      this.textChanged();
    }
    this.ctx.invalidate();
  }

  remove(child: HostNode | TextInstance, destroy = true) {
    const i = this.children.indexOf(child);
    if (i < 0) return;
    this.children.splice(i, 1);
    child.parent = undefined;
    if (child instanceof HostNode) {
      if (this.type !== 'text') this.ctx.layout.remove(this.yoga, child.yoga);
      if (destroy) child.destroy();
    } else {
      this.textChanged();
    }
    this.ctx.invalidate();
  }

  update(next: AnyProps) {
    const prev = this.props;
    if (prev.scrollHandle !== next.scrollHandle || next.style?.overflow !== 'scroll')
      detachScroll(prev.scrollHandle, this);
    this.props = next;
    applyLayout(this.ctx.layout, this.yoga, layoutOf(prev), layoutOf(next));
    if (this.type === 'text') {
      const before = this.#textCache;
      this.#textCache = textOf(this);
      if (before !== this.#textCache || textStyleChanged(prev, next)) this.ctx.layout.markDirty(this.yoga);
    }
    this.ctx.invalidate();
  }

  textChanged() {
    if (this.type !== 'text') return;
    this.#textCache = textOf(this);
    this.ctx.layout.markDirty(this.yoga);
    this.ctx.invalidate();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseEditor?.();
    detachScroll(this.props.scrollHandle, this);
    for (const c of this.children) if (c instanceof HostNode) c.destroy();
    if (this.#measureId) this.ctx.layout.releaseMeasure(this.#measureId);
    this.ctx.layout.free(this.yoga);
  }

  /** Children sorted for painting (stable by zIndex). */
  paintOrder(): HostNode[] {
    const nodes = this.children.filter((c): c is HostNode => c instanceof HostNode);
    if (!nodes.some((n) => n.props.zIndex)) return nodes;
    return nodes
      .map((n, i) => [n, i] as const)
      .sort((a, b) => (a[0].props.zIndex ?? 0) - (b[0].props.zIndex ?? 0) || a[1] - b[1])
      .map(([n]) => n);
  }
}

function textOf(node: HostNode): string {
  const c = node.props.children;
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  return node.children.map((ch) => (ch instanceof TextInstance ? ch.text : '')).join('');
}

function textStyleChanged(a: AnyProps, b: AnyProps) {
  const sa = (a.style ?? {}) as TextStyleProp;
  const sb = (b.style ?? {}) as TextStyleProp;
  return (
    sa.fontFamily !== sb.fontFamily ||
    sa.fontKerning !== sb.fontKerning ||
    sa.fontSize !== sb.fontSize ||
    sa.lineHeight !== sb.lineHeight ||
    sa.letterSpacing !== sb.letterSpacing ||
    sa.textTransform !== sb.textTransform ||
    sa.maxLines !== sb.maxLines ||
    sa.textOverflow !== sb.textOverflow ||
    sa.textAlign !== sb.textAlign ||
    a.rich !== b.rich
  );
}

// ── Style → Yoga ─────────────────────────────────────────────────────────────

const LAYOUT_KEYS = new Set<keyof LayoutStyle>([
  'display',
  'position',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'alignContent',
  'flexWrap',
  'overflow',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'aspectRatio',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'marginX',
  'marginY',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'padding',
  'paddingX',
  'paddingY',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'gap',
  'rowGap',
  'columnGap',
]);

function layoutOf(props: AnyProps): LayoutStyle {
  const style = (props.style ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key in style) if (LAYOUT_KEYS.has(key as keyof LayoutStyle)) out[key] = style[key];
  return out as LayoutStyle;
}

function dim(v: Dim | undefined): [number, number] {
  if (v === undefined) return [NaN, Unit.Undefined];
  if (v === 'auto') return [NaN, Unit.Auto];
  if (typeof v === 'string') return [parseFloat(v), Unit.Percent];
  return [v, Unit.Point];
}

const EDGE_PROPS: [keyof LayoutStyle, number, number][] = [
  ['top', LengthProp.Position, Edge.Top],
  ['left', LengthProp.Position, Edge.Left],
  ['right', LengthProp.Position, Edge.Right],
  ['bottom', LengthProp.Position, Edge.Bottom],
  ['margin', LengthProp.Margin, Edge.All],
  ['marginX', LengthProp.Margin, Edge.Horizontal],
  ['marginY', LengthProp.Margin, Edge.Vertical],
  ['marginTop', LengthProp.Margin, Edge.Top],
  ['marginBottom', LengthProp.Margin, Edge.Bottom],
  ['marginLeft', LengthProp.Margin, Edge.Left],
  ['marginRight', LengthProp.Margin, Edge.Right],
  ['padding', LengthProp.Padding, Edge.All],
  ['paddingX', LengthProp.Padding, Edge.Horizontal],
  ['paddingY', LengthProp.Padding, Edge.Vertical],
  ['paddingTop', LengthProp.Padding, Edge.Top],
  ['paddingBottom', LengthProp.Padding, Edge.Bottom],
  ['paddingLeft', LengthProp.Padding, Edge.Left],
  ['paddingRight', LengthProp.Padding, Edge.Right],
];

const SIZE_PROPS: [keyof LayoutStyle, number][] = [
  ['width', LengthProp.Width],
  ['height', LengthProp.Height],
  ['minWidth', LengthProp.MinWidth],
  ['minHeight', LengthProp.MinHeight],
  ['maxWidth', LengthProp.MaxWidth],
  ['maxHeight', LengthProp.MaxHeight],
  ['flexBasis', LengthProp.FlexBasis],
];

function applyLayout(y: YogaLayout, n: number, prev: LayoutStyle, next: LayoutStyle) {
  const changed = (k: keyof LayoutStyle) => prev[k] !== next[k];
  const en = (k: keyof LayoutStyle, prop: number, table: Record<string, number>, fallback: string) => {
    if (changed(k)) y.setEnum(n, prop, table[(next[k] as string | undefined) ?? fallback]!);
  };
  en('display', EnumProp.Display, DISPLAY, 'flex');
  en('position', EnumProp.PositionType, POSITION, 'relative');
  en('flexDirection', EnumProp.FlexDirection, FLEX_DIRECTION, 'column');
  en('justifyContent', EnumProp.JustifyContent, JUSTIFY, 'flex-start');
  en('alignItems', EnumProp.AlignItems, ALIGN, 'stretch');
  en('alignSelf', EnumProp.AlignSelf, ALIGN, 'auto');
  en('alignContent', EnumProp.AlignContent, ALIGN, 'flex-start');
  en('flexWrap', EnumProp.FlexWrap, WRAP, 'nowrap');
  en('overflow', EnumProp.Overflow, OVERFLOW, 'visible');

  const num = (k: keyof LayoutStyle, prop: number, fallback: number) => {
    if (changed(k)) y.setNumber(n, prop, (next[k] as number | undefined) ?? fallback);
  };
  num('flex', NumberProp.Flex, NaN);
  num('flexGrow', NumberProp.FlexGrow, 0);
  num('flexShrink', NumberProp.FlexShrink, 0);
  num('aspectRatio', NumberProp.AspectRatio, NaN);

  for (const [k, prop] of SIZE_PROPS) {
    if (!changed(k)) continue;
    const [v, u] = dim(next[k] as Dim | undefined);
    y.setLength(n, prop, 0, v, u);
  }
  for (const [k, prop, edge] of EDGE_PROPS) {
    if (!changed(k)) continue;
    const [v, u] = dim(next[k] as Dim | undefined);
    y.setLength(n, prop, edge, v, u);
  }
  for (const [k, gutter] of [
    ['gap', Gutter.All],
    ['rowGap', Gutter.Row],
    ['columnGap', Gutter.Column],
  ] as const) {
    if (!changed(k)) continue;
    const v = next[k];
    y.setLength(n, LengthProp.Gap, gutter, v ?? NaN, v === undefined ? Unit.Undefined : Unit.Point);
  }
}
