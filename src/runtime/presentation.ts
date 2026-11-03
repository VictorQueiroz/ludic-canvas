import type { HostNode } from './nodes.ts';
import type { Painter, PaintFrame } from './paint.ts';
import type { NativeScrollInfo } from '../platform/root-types.ts';

export interface PresentationSize {
  width: number;
  height: number;
  dpr: number;
  cssWidth?: number;
  cssHeight?: number;
}

/** Optional host presentation; the portable runtime never imports browser globals. */
export interface ScrollPresentation {
  readonly active: ReadonlySet<HostNode>;
  readonly info: NativeScrollInfo;
  prepare(
    root: HostNode,
    nodes: readonly HostNode[],
    painter: Painter,
    frame: PaintFrame,
    size: PresentationSize,
    revision: number,
  ): boolean;
  capture(frame: PaintFrame, size: PresentationSize): void;
  afterPaint(): void;
  setEnabled(enabled: boolean): void;
  destroy(): void;
}
