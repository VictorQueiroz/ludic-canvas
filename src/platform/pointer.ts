import { HostNode } from '../runtime/nodes.ts';
import type { Painter } from '../runtime/paint.ts';
import type { UIPointerEvent, UIWheelEvent } from '../runtime/types.ts';

export interface HostEvent {
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}
export interface HostPointerEvent extends HostEvent {
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  button: number;
  buttons: number;
  isPrimary?: boolean;
}
export interface HostWheelEvent extends HostEvent {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaMode: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  nativeScroll?: () => boolean;
}
export interface PointerSurface {
  size(): { width: number; height: number };
  focusSurface(): void;
  setCursor(cursor: string): void;
  capturePointer(id: number): void;
  hasPointerCapture(id: number): boolean;
  releasePointer(id: number): void;
}
type PointerHandler = 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel';
const pointerTarget = (n: HostNode) =>
  Boolean(n.props.onPress || n.props.onPointerDown || n.props.onPointerMove || n.props.onPointerUp);
export const inside = (n: HostNode, scope: HostNode | undefined): boolean => {
  if (!scope) return true;
  for (let p: HostNode | undefined = n; p; p = p.parent) if (p === scope) return true;
  return false;
};

/** Shared paint-order hit testing, pointer capture routing and wheel defaults. No platform globals. */
export class PointerRouter {
  protected readonly painter: Painter;
  protected readonly surface: PointerSurface;
  protected enabled = true;
  protected modal: HostNode | undefined;
  #hovered = new Set<HostNode>();
  #pressed: HostNode | undefined;
  #capture: HostNode | undefined;
  #pointerId: number | undefined;
  #lastEvent: HostPointerEvent | undefined;
  #drag: { node: HostNode; startY: number; scroll: number; moved: boolean } | undefined;
  #pointer: [number, number] | undefined;
  onPointer: (nx: number, ny: number) => void = () => {};
  onActivity: () => void = () => {};
  constructor(painter: Painter, surface: PointerSurface) {
    this.painter = painter;
    this.surface = surface;
  }
  protected refreshPointer() {
    if (this.#capture?.destroyed || this.#pressed?.destroyed) this.cancelPointer();
    if (this.enabled && this.#pointer && !this.#drag) this.hover(...this.#pointer);
  }
  pointerCancel(e: HostPointerEvent) {
    if (e.pointerId === this.#pointerId) this.cancelPointer(e);
  }
  pointerLeave() {
    if (this.#pointerId === undefined) this.resetHover();
  }
  protected resetHover() {
    this.#pointer = undefined;
    this.setHovered(new Set());
  }
  isSurfaceOccupied(x: number, y: number): boolean {
    const { width, height } = this.surface.size();
    if (!this.enabled || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height)
      return false;
    return Boolean((this.modal && !this.modal.destroyed) || this.surfaceAt(x, y));
  }
  report(error: unknown) {
    const report = this.painter.hitList[0]?.ctx.onError;
    if (report) report(error);
    else console.error('[ludic-canvas]', error);
  }
  call(callback: (() => void) | undefined) {
    try {
      callback?.();
    } catch (error) {
      this.report(error);
    }
  }
  contains(n: HostNode, x: number, y: number): boolean {
    const a = n.abs,
      c = n.clip;
    return (
      !n.destroyed &&
      inside(n, this.modal) &&
      a.w > 0 &&
      a.h > 0 &&
      x >= a.x &&
      y >= a.y &&
      x <= a.x + a.w &&
      y <= a.y + a.h &&
      (!c || (c.w > 0 && c.h > 0 && x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h))
    );
  }
  // Occupancy is separate from callback eligibility: disabled controls and block boxes
  // still reserve their geometry, and a wheel must never search through them for a sibling.
  surfaceAt(x: number, y: number): HostNode | undefined {
    if (!this.enabled) return;
    for (let i = this.painter.hitList.length - 1; i >= 0; i--) {
      const n = this.painter.hitList[i]!;
      if (this.contains(n, x, y)) return n;
    }
  }
  hit(x: number, y: number, predicate: (n: HostNode) => boolean, blockDisabled = true): HostNode | undefined {
    if (!this.enabled) return;
    for (let i = this.painter.hitList.length - 1; i >= 0; i--) {
      const n = this.painter.hitList[i]!;
      if (!this.contains(n, x, y)) continue;
      const matches = predicate(n);
      if (!matches && !n.props.block && (!n.props.disabled || !blockDisabled)) continue;
      return matches && !n.props.disabled ? n : undefined;
    }
  }
  hover(x: number, y: number) {
    const top = this.hit(x, y, (n) => pointerTarget(n) || Boolean(n.props.onHover));
    const path = new Set<HostNode>();
    for (let n = top; n && inside(n, this.modal); n = n.parent) if (pointerTarget(n) || n.props.onHover) path.add(n);
    this.setHovered(path);
    this.surface.setCursor(top?.props.cursor ?? (top?.props.onPress ? 'pointer' : 'default'));
  }
  setHovered(next: Set<HostNode>) {
    for (const n of this.#hovered)
      if (!next.has(n)) {
        n.hovered = false;
        this.call(() => n.props.onHover?.(false));
      }
    for (const n of next)
      if (!this.#hovered.has(n)) {
        n.hovered = true;
        this.call(() => n.props.onHover?.(true));
      }
    this.#hovered = next;
  }
  dispatchPointer(type: PointerHandler, target: HostNode | undefined, e: HostPointerEvent): boolean {
    if (!target || target.destroyed) return false;
    const [x, y] = [e.x, e.y];
    let stopped = false,
      prevented = false;
    for (let n: HostNode | undefined = target; n && inside(n, this.modal); n = n.parent) {
      const event: UIPointerEvent = {
        x,
        y,
        localX: (x - n.abs.x) / (n.abs.w / n.box.w || 1),
        localY: (y - n.abs.y) / (n.abs.h / n.box.h || 1),
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        button: e.button,
        buttons: e.buttons,
        preventDefault() {
          prevented = true;
          e.preventDefault();
        },
        stopPropagation() {
          stopped = true;
          e.stopPropagation();
        },
      };
      if (!n.props.disabled) {
        const callback = n.props[type];
        this.call(() => callback?.(event));
      }
      if (stopped || n === this.modal) break;
    }
    return prevented;
  }
  pointerMove(e: HostPointerEvent) {
    if (
      !this.enabled ||
      e.isPrimary === false ||
      (e.pointerType === 'touch' && this.#pointerId === undefined) ||
      (this.#pointerId !== undefined && e.pointerId !== this.#pointerId)
    )
      return;
    const [x, y] = [e.x, e.y];
    this.#pointer = [x, y];
    this.#lastEvent = e;
    const r = this.surface.size();
    if (r.width && r.height) this.onPointer((x / r.width) * 2 - 1, (y / r.height) * 2 - 1);
    const prevented = this.dispatchPointer('onPointerMove', this.#capture ?? this.hit(x, y, pointerTarget), e);
    if (this.#drag && !prevented) {
      const dy = y - this.#drag.startY;
      if (Math.abs(dy) > 8) {
        this.#drag.moved = true;
        if (this.#pressed) this.#pressed.pressed = false;
      }
      if (this.#drag.moved)
        this.#drag.node.scrollY = this.#drag.scroll - dy / (this.#drag.node.abs.h / this.#drag.node.box.h || 1);
    } else this.hover(x, y);
  }
  pointerDown(e: HostPointerEvent) {
    if (!this.enabled || e.isPrimary === false || e.button !== 0 || this.#pointerId !== undefined) return;
    this.surface.focusSurface();
    this.onActivity();
    const [x, y] = [e.x, e.y];
    this.#pointer = [x, y];
    this.#lastEvent = e;
    this.hover(x, y);
    const target = this.hit(x, y, pointerTarget);
    const scroller = this.hit(x, y, (n) => n.props.style?.overflow === 'scroll', false);
    this.#pointerId = e.pointerId;
    this.#capture = target;
    const prevented = this.dispatchPointer('onPointerDown', target, e);
    if (!prevented && target?.props.onPress) {
      this.#pressed = target;
      target.pressed = true;
    }
    if (!prevented && scroller && e.pointerType !== 'mouse')
      this.#drag = { node: scroller, startY: y, scroll: scroller.scrollY, moved: false };
    this.surface.capturePointer(e.pointerId);
  }
  pointerUp(e: HostPointerEvent) {
    if (e.pointerId !== this.#pointerId || e.button !== 0) return;
    const [x, y] = [e.x, e.y],
      pressed = this.#pressed,
      dragged = this.#drag?.moved;
    const prevented = this.dispatchPointer('onPointerUp', this.#capture, e);
    this.cancelPointer(undefined, false);
    if (!prevented && !dragged && pressed && !pressed.destroyed && this.hit(x, y, pointerTarget) === pressed)
      this.call(pressed.props.onPress);
    if (e.pointerType !== 'mouse') {
      this.#pointer = undefined;
      this.setHovered(new Set());
    }
  }
  cancelPointer(event = this.#lastEvent, dispatch = true) {
    if (dispatch && event) this.dispatchPointer('onPointerCancel', this.#capture, event);
    if (this.#pressed) this.#pressed.pressed = false;
    const id = this.#pointerId;
    this.#pointerId = undefined;
    this.#capture = undefined;
    this.#pressed = undefined;
    this.#drag = undefined;
    this.#lastEvent = undefined;
    if (id !== undefined && this.surface.hasPointerCapture(id)) this.surface.releasePointer(id);
  }
  wheel(e: HostWheelEvent) {
    const deltaMode = e.deltaMode;
    const [x, y] = [e.x, e.y];
    const target = this.surfaceAt(x, y);
    if (!target) return;
    this.onActivity();
    // Freeze this route: callbacks may unmount nodes or change the tree.
    const path: HostNode[] = [];
    for (let n: HostNode | undefined = target; n && inside(n, this.modal); n = n.parent) {
      path.push(n);
      if (n === this.modal) break;
    }
    let prevented = e.defaultPrevented,
      stopped = false;
    for (const n of path) {
      if (!this.enabled) return;
      if (n.destroyed) continue;
      const event: UIWheelEvent = {
        x,
        y,
        localX: (x - n.abs.x) / (n.abs.w / n.box.w || 1),
        localY: (y - n.abs.y) / (n.abs.h / n.box.h || 1),
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        get defaultPrevented() {
          return prevented;
        },
        preventDefault() {
          prevented = true;
          e.preventDefault();
        },
        stopPropagation() {
          stopped = true;
          e.stopPropagation();
        },
      };
      if (!n.props.disabled) this.call(() => n.props.onWheel?.(event));
      if (stopped) break;
    }
    if (prevented || target.destroyed || !this.enabled) return;
    // Native textarea scrolling precedes the Yoga default, after custom handlers.
    if (e.nativeScroll?.()) return;
    for (const n of path) {
      if (n.destroyed || n.props.disabled || n.props.style?.overflow !== 'scroll') continue;
      const max = Math.max(0, n.contentHeight - n.box.h),
        before = n.scrollY;
      n.scrollY = Math.max(
        0,
        Math.min(max, before + e.deltaY * (deltaMode === 1 ? 32 : deltaMode === 2 ? n.box.h : 1)),
      );
      if (n.scrollY !== before) {
        e.preventDefault();
        return;
      }
      if (n === this.modal) return;
    }
  }
}
