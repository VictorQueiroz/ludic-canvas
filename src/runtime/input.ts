// Per-root pointer capture, keyboard routing, modal focus and DOM semantics.
import { HostNode } from './nodes.ts';
import type { Painter } from './paint.ts';
import type { UIPointerEvent } from './types.ts';

type Direction = 'up' | 'down' | 'left' | 'right';
type PointerHandler = 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel';
const pressable = (n: HostNode) => Boolean(n.props.onPress || n.props.focusable);
const pointerTarget = (n: HostNode) =>
  Boolean(n.props.onPress || n.props.onPointerDown || n.props.onPointerMove || n.props.onPointerUp);
const inside = (n: HostNode, scope: HostNode | undefined): boolean => {
  if (!scope) return true;
  for (let p: HostNode | undefined = n; p; p = p.parent) if (p === scope) return true;
  return false;
};

export class InputSystem {
  readonly #canvas: HTMLCanvasElement;
  readonly #a11y: HTMLElement;
  readonly #live: HTMLElement;
  readonly #painter: Painter;
  readonly #events = new AbortController();
  readonly #buttons = new Map<HostNode, HTMLButtonElement>();
  #hovered = new Set<HostNode>();
  #pressed: HostNode | undefined;
  #capture: HostNode | undefined;
  #pointerId: number | undefined;
  #lastEvent: PointerEvent | undefined;
  #drag: { node: HostNode; startY: number; scroll: number; moved: boolean } | undefined;
  #pointer: [number, number] | undefined;
  #announced = '';
  #enabled = true;
  #modal: HostNode | undefined;
  #previousFocus: HTMLElement | undefined;
  onPointer: (nx: number, ny: number) => void = () => {};
  onActivity: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, a11y: HTMLElement, painter: Painter) {
    this.#canvas = canvas;
    this.#a11y = a11y;
    this.#painter = painter;
    this.#live = document.createElement('div');
    this.#live.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    this.#live.setAttribute('aria-live', 'polite');
    a11y.appendChild(this.#live);
    const options = { signal: this.#events.signal };
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      passive?: boolean,
    ) => {
      target.addEventListener(
        type,
        (event) => {
          try {
            handler(event);
          } catch (error) {
            this.#report(error);
          }
        },
        { ...options, ...(passive === undefined ? {} : { passive }) },
      );
    };
    listen(canvas, 'pointermove', (e) => this.#move(e));
    listen(canvas, 'pointerdown', (e) => this.#down(e));
    listen(canvas, 'pointerup', (e) => this.#up(e));
    listen(canvas, 'pointercancel', (e) => {
      if (e.pointerId === this.#pointerId) this.#cancel(e);
    });
    listen(canvas, 'lostpointercapture', (e) => {
      if (e.pointerId === this.#pointerId) this.#cancel(e);
    });
    listen(canvas, 'pointerleave', () => {
      if (this.#pointerId === undefined) {
        this.#pointer = undefined;
        this.#setHovered(new Set());
      }
    });
    listen(canvas, 'wheel', (e) => this.#wheel(e), false);
    listen(canvas, 'keydown', (e) => this.#key(e));
    listen(a11y, 'keydown', (e) => this.#key(e));
    window.addEventListener('blur', () => this.#cancel(), options);
  }
  #report(error: unknown) {
    const report = this.#painter.hitList[0]?.ctx.onError;
    if (report) report(error);
    else console.error('[ludic-canvas]', error);
  }
  #call(callback: (() => void) | undefined) {
    try {
      callback?.();
    } catch (error) {
      this.#report(error);
    }
  }
  destroy() {
    this.#events.abort();
    this.#cancel();
    this.#setHovered(new Set());
    for (const button of this.#buttons.values()) button.remove();
    this.#buttons.clear();
    this.#live.remove();
  }
  setEnabled(enabled: boolean) {
    if (enabled === this.#enabled) return;
    this.#enabled = enabled;
    if (!enabled) {
      this.#cancel();
      this.#pointer = undefined;
      this.#setHovered(new Set());
    }
    for (const [node, button] of this.#buttons)
      button.disabled = !enabled || Boolean(node.props.disabled) || !inside(node, this.#modal);
  }
  afterPaint() {
    if (this.#enabled && this.#pointer && !this.#drag) this.#hover(...this.#pointer);
    this.#syncMirror();
  }
  announce(text: string) {
    if (text !== this.#announced) {
      this.#announced = text;
      this.#live.textContent = text;
    }
  }

  #hit(x: number, y: number, predicate: (n: HostNode) => boolean): HostNode | undefined {
    if (!this.#enabled) return;
    for (let i = this.#painter.hitList.length - 1; i >= 0; i--) {
      const n = this.#painter.hitList[i]!;
      if (n.destroyed || !inside(n, this.#modal)) continue;
      const matches = predicate(n),
        a = n.abs,
        c = n.clip;
      if ((!matches && !n.props.block && !n.props.disabled) || x < a.x || y < a.y || x > a.x + a.w || y > a.y + a.h)
        continue;
      if (c && (x < c.x || y < c.y || x > c.x + c.w || y > c.y + c.h)) continue;
      return matches && !n.props.disabled ? n : undefined;
    }
  }
  #local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.#canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  #hover(x: number, y: number) {
    const top = this.#hit(x, y, (n) => pointerTarget(n) || Boolean(n.props.onHover));
    const path = new Set<HostNode>();
    for (let n = top; n && inside(n, this.#modal); n = n.parent) if (pointerTarget(n) || n.props.onHover) path.add(n);
    this.#setHovered(path);
    this.#canvas.style.cursor = top?.props.cursor ?? (top?.props.onPress ? 'pointer' : 'default');
  }
  #setHovered(next: Set<HostNode>) {
    for (const n of this.#hovered)
      if (!next.has(n)) {
        n.hovered = false;
        this.#call(() => n.props.onHover?.(false));
      }
    for (const n of next)
      if (!this.#hovered.has(n)) {
        n.hovered = true;
        this.#call(() => n.props.onHover?.(true));
      }
    this.#hovered = next;
  }
  #dispatch(type: PointerHandler, target: HostNode | undefined, e: PointerEvent): boolean {
    if (!target || target.destroyed) return false;
    const [x, y] = this.#local(e);
    let stopped = false,
      prevented = false;
    for (let n: HostNode | undefined = target; n && inside(n, this.#modal); n = n.parent) {
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
        this.#call(() => callback?.(event));
      }
      if (stopped || n === this.#modal) break;
    }
    return prevented;
  }
  #move(e: PointerEvent) {
    if (!this.#enabled || (this.#pointerId !== undefined && e.pointerId !== this.#pointerId)) return;
    const [x, y] = this.#local(e);
    this.#pointer = [x, y];
    this.#lastEvent = e;
    const r = this.#canvas.getBoundingClientRect();
    if (r.width && r.height) this.onPointer((x / r.width) * 2 - 1, (y / r.height) * 2 - 1);
    const prevented = this.#dispatch('onPointerMove', this.#capture ?? this.#hit(x, y, pointerTarget), e);
    if (this.#drag && !prevented) {
      const dy = y - this.#drag.startY;
      if (Math.abs(dy) > 8) {
        this.#drag.moved = true;
        if (this.#pressed) this.#pressed.pressed = false;
      }
      if (this.#drag.moved)
        this.#drag.node.scrollY = this.#drag.scroll - dy / (this.#drag.node.abs.h / this.#drag.node.box.h || 1);
    } else this.#hover(x, y);
  }
  #down(e: PointerEvent) {
    if (!this.#enabled || e.button !== 0 || this.#pointerId !== undefined) return;
    this.#canvas.focus({ preventScroll: true });
    this.onActivity();
    const [x, y] = this.#local(e);
    this.#pointer = [x, y];
    this.#lastEvent = e;
    this.#hover(x, y);
    const target = this.#hit(x, y, pointerTarget);
    const scroller = this.#hit(x, y, (n) => n.props.style?.overflow === 'scroll');
    this.#pointerId = e.pointerId;
    this.#capture = target;
    const prevented = this.#dispatch('onPointerDown', target, e);
    if (!prevented && target?.props.onPress) {
      this.#pressed = target;
      target.pressed = true;
    }
    if (!prevented && scroller && e.pointerType !== 'mouse')
      this.#drag = { node: scroller, startY: y, scroll: scroller.scrollY, moved: false };
    this.#canvas.setPointerCapture(e.pointerId);
  }
  #up(e: PointerEvent) {
    if (e.pointerId !== this.#pointerId || e.button !== 0) return;
    const [x, y] = this.#local(e),
      pressed = this.#pressed,
      dragged = this.#drag?.moved;
    const prevented = this.#dispatch('onPointerUp', this.#capture, e);
    this.#cancel(undefined, false);
    if (!prevented && !dragged && pressed && !pressed.destroyed && this.#hit(x, y, pointerTarget) === pressed)
      this.#call(pressed.props.onPress);
    if (e.pointerType !== 'mouse') {
      this.#pointer = undefined;
      this.#setHovered(new Set());
    }
  }
  #cancel(event = this.#lastEvent, dispatch = true) {
    if (dispatch && event) this.#dispatch('onPointerCancel', this.#capture, event);
    if (this.#pressed) this.#pressed.pressed = false;
    const id = this.#pointerId;
    this.#pointerId = undefined;
    this.#capture = undefined;
    this.#pressed = undefined;
    this.#drag = undefined;
    this.#lastEvent = undefined;
    if (id !== undefined && this.#canvas.hasPointerCapture(id)) this.#canvas.releasePointerCapture(id);
  }
  #wheel(e: WheelEvent) {
    const [x, y] = this.#local(e);
    for (let n = this.#hit(x, y, (node) => node.props.style?.overflow === 'scroll'); n; n = n.parent) {
      if (n.props.style?.overflow !== 'scroll') continue;
      const max = Math.max(0, n.contentHeight - n.box.h),
        before = n.scrollY;
      n.scrollY = Math.max(
        0,
        Math.min(max, before + e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? n.box.h : 1)),
      );
      if (n.scrollY !== before) {
        e.preventDefault();
        return;
      }
      if (n === this.#modal) return;
    }
  }
  #focused(): HostNode | undefined {
    return [...this.#buttons].find(([, button]) => button === document.activeElement)?.[0];
  }
  #eligible() {
    return [...this.#buttons].filter(([n, button]) => !button.disabled && !n.destroyed && inside(n, this.#modal));
  }
  focus(id: string): boolean {
    const match = this.#eligible().find(([n]) => n.props.id === id);
    if (!match) return false;
    match[1].focus({ preventScroll: true });
    return true;
  }
  navigate(direction: Direction): boolean {
    const candidates = this.#eligible();
    if (!candidates.length) return false;
    const current = this.#focused();
    if (!current) {
      candidates[0]![1].focus({ preventScroll: true });
      return true;
    }
    const cx = current.abs.x + current.abs.w / 2,
      cy = current.abs.y + current.abs.h / 2;
    let best: HTMLButtonElement | undefined,
      score = Infinity;
    for (const [n, button] of candidates) {
      if (n === current) continue;
      const dx = n.abs.x + n.abs.w / 2 - cx,
        dy = n.abs.y + n.abs.h / 2 - cy;
      const forward = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
      const cross = direction === 'right' || direction === 'left' ? Math.abs(dy) : Math.abs(dx);
      const distance = forward + cross * 2 + (cross * cross) / Math.max(1, forward);
      if (forward > 0.5 && distance < score) {
        score = distance;
        best = button;
      }
    }
    best?.focus({ preventScroll: true });
    return Boolean(best);
  }
  activateFocused(): boolean {
    const n = this.#focused();
    if (!this.#enabled || !n?.props.onPress || n.props.disabled || !inside(n, this.#modal)) return false;
    this.#call(n.props.onPress);
    return true;
  }
  #key(e: KeyboardEvent) {
    if (!this.#enabled) return;
    this.onActivity();
    let stopped = false;
    for (let n = this.#focused(); n && inside(n, this.#modal); n = n.parent) {
      const callback = n.props.onKeyDown;
      this.#call(() =>
        callback?.({
          key: e.key,
          code: e.code,
          repeat: e.repeat,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          preventDefault() {
            e.preventDefault();
          },
          stopPropagation() {
            stopped = true;
            e.stopPropagation();
          },
        }),
      );
      if (stopped || n === this.#modal) break;
    }
    if (e.defaultPrevented || stopped) return;
    if (e.key === 'Tab' && this.#modal) {
      const controls = this.#eligible().map(([, button]) => button);
      const index = controls.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus({ preventScroll: true });
      return;
    }
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.#focused() && (e.key === 'Enter' || e.key === ' ')) return;
    for (let i = this.#painter.hitList.length - 1; i >= 0; i--) {
      const n = this.#painter.hitList[i]!;
      if (
        !n.destroyed &&
        inside(n, this.#modal) &&
        !n.props.disabled &&
        n.props.hotkey?.toLowerCase() === e.key.toLowerCase()
      ) {
        e.preventDefault();
        this.#call(n.props.onPress);
        return;
      }
    }
  }
  #reveal(node: HostNode) {
    for (let p = node.parent; p; p = p.parent) {
      if (p.props.style?.overflow !== 'scroll') continue;
      const clip = p.clip,
        top = Math.max(p.abs.y, clip?.y ?? -Infinity),
        bottom = Math.min(p.abs.y + p.abs.h, clip ? clip.y + clip.h : Infinity);
      const dy =
        node.abs.y < top ? node.abs.y - top : node.abs.y + node.abs.h > bottom ? node.abs.y + node.abs.h - bottom : 0;
      p.scrollY = Math.max(
        0,
        Math.min(Math.max(0, p.contentHeight - p.box.h), p.scrollY + dy / (p.abs.h / p.box.h || 1)),
      );
    }
  }
  #syncMirror() {
    const modal = this.#painter.visible.findLast((n) => Boolean(n.props.modal));
    const changedModal = modal !== this.#modal;
    if (changedModal) {
      this.#cancel();
      if (!this.#modal && modal)
        this.#previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      this.#modal = modal;
    }
    const live = new Set<HostNode>();
    let previous: HTMLButtonElement | undefined;
    for (const n of this.#painter.hitList) {
      if (!pressable(n) || n.destroyed) continue;
      const label = n.props.label ?? labelOf(n);
      if (!label) continue;
      live.add(n);
      let button = this.#buttons.get(n);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', () => {
          if (this.#enabled && !n.destroyed && !n.props.disabled && inside(n, this.#modal)) this.#call(n.props.onPress);
        });
        button.addEventListener('focus', () => {
          n.focused = true;
          this.#reveal(n);
        });
        button.addEventListener('blur', () => {
          n.focused = false;
        });
        this.#buttons.set(n, button);
      }
      button.setAttribute('aria-label', label);
      button.setAttribute('role', n.props.role ?? 'button');
      for (const [key, value] of Object.entries({
        checked: n.props.checked,
        expanded: n.props.expanded,
        selected: n.props.selected,
        valuemin: n.props.valueMin,
        valuemax: n.props.valueMax,
        valuenow: n.props.valueNow,
        valuetext: n.props.valueText,
      })) {
        if (value === undefined) button.removeAttribute(`aria-${key}`);
        else button.setAttribute(`aria-${key}`, String(value));
      }
      button.disabled = !this.#enabled || Boolean(n.props.disabled) || !inside(n, modal);
      button.setAttribute('aria-hidden', String(!inside(n, modal)));
      const a = n.abs;
      const style = `position:absolute;opacity:0;pointer-events:none;margin:0;padding:0;border:0;left:${a.x}px;top:${a.y}px;width:${Math.max(0, a.w)}px;height:${Math.max(0, a.h)}px`;
      if (button.dataset.box !== style) {
        button.dataset.box = style;
        button.style.cssText = style;
      }
      const next = previous ? previous.nextSibling : this.#a11y.firstChild;
      if (next !== button) this.#a11y.insertBefore(button, next);
      previous = button;
    }
    for (const [node, button] of this.#buttons)
      if (!live.has(node)) {
        button.remove();
        this.#buttons.delete(node);
      }
    if (changedModal) {
      if (modal) (this.#eligible()[0]?.[1] ?? this.#canvas).focus({ preventScroll: true });
      else if (this.#previousFocus?.isConnected) this.#previousFocus.focus({ preventScroll: true });
      if (!modal) this.#previousFocus = undefined;
    }
  }
}
function labelOf(node: HostNode): string {
  const parts: string[] = [];
  const walk = (n: HostNode) => {
    if (n.type === 'text' && n.text) parts.push(n.text.replace(/\*\*/g, ''));
    for (const c of n.children) if (c instanceof HostNode) walk(c);
  };
  walk(node);
  return parts.join(' ').trim();
}
