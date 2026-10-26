// Input for the canvas UI: pointer hover/press/scroll via hit-testing the
// painter's last frame, keyboard hotkeys, and an invisible DOM mirror of every
// pressable node so the game works with Tab/Enter and screen readers.

import { HostNode } from './nodes.ts';
import type { Painter } from './paint.ts';

export class InputSystem {
  readonly #canvas: HTMLCanvasElement;
  readonly #a11y: HTMLElement;
  readonly #live: HTMLElement;
  readonly #painter: Painter;
  readonly #events = new AbortController();
  readonly #buttons = new Map<number, HTMLButtonElement>();
  #hovered = new Set<HostNode>();
  #pressed: HostNode | undefined;
  #drag: { node: HostNode; startY: number; scroll: number; moved: boolean } | undefined;
  #pointer: [number, number] | undefined;
  #announced = '';
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
    canvas.addEventListener('pointermove', (e) => this.#move(e), options);
    canvas.addEventListener('pointerdown', (e) => this.#down(e), options);
    canvas.addEventListener('pointerup', (e) => this.#up(e), options);
    canvas.addEventListener('pointercancel', () => this.#cancel(), options);
    canvas.addEventListener(
      'pointerleave',
      () => {
        this.#pointer = undefined;
        this.#setHovered(new Set());
      },
      options,
    );
    canvas.addEventListener('wheel', (e) => this.#wheel(e), { ...options, passive: false });
    canvas.addEventListener('keydown', (e) => this.#key(e), options);
    a11y.addEventListener('keydown', (e) => this.#key(e), options);
  }

  destroy() {
    this.#events.abort();
    this.#cancel();
    this.#setHovered(new Set());
    for (const button of this.#buttons.values()) button.remove();
    this.#buttons.clear();
    this.#live.remove();
    this.#canvas.style.cursor = '';
  }

  /** Called after each paint: refresh hover under a still pointer and the DOM mirror. */
  afterPaint() {
    if (this.#pointer && !this.#drag) this.#hover(this.#pointer[0], this.#pointer[1]);
    this.#syncMirror();
  }

  announce(text: string) {
    if (text === this.#announced) return;
    this.#announced = text;
    this.#live.textContent = text;
  }

  // ── Hit testing ────────────────────────────────────────────────────────────

  /** Topmost node under the point that satisfies `predicate`; a `block` node above it wins (returns undefined). */
  #hit(x: number, y: number, predicate: (n: HostNode) => boolean): HostNode | undefined {
    const list = this.#painter.hitList;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]!;
      const matches = predicate(n);
      if (n.destroyed || (!matches && !n.props.block)) continue;
      const a = n.abs;
      if (x < a.x || y < a.y || x > a.x + a.w || y > a.y + a.h) continue;
      const c = n.clip;
      if (c && (x < c.x || y < c.y || x > c.x + c.w || y > c.y + c.h)) continue;
      return matches ? n : undefined;
    }
    return undefined;
  }

  #local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.#canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  #hover(x: number, y: number) {
    const top = this.#hit(x, y, (n) => Boolean(n.props.onPress || n.props.onHover));
    const path = new Set<HostNode>();
    for (let n: HostNode | undefined = top; n; n = n.parent) if (n.props.onPress || n.props.onHover) path.add(n);
    this.#setHovered(path);
    const pointer = top?.props.onPress && !top.props.disabled ? 'pointer' : 'default';
    if (this.#canvas.style.cursor !== pointer) this.#canvas.style.cursor = pointer;
  }

  #setHovered(next: Set<HostNode>) {
    for (const n of this.#hovered) {
      if (!next.has(n)) {
        n.hovered = false;
        n.props.onHover?.(false);
      }
    }
    for (const n of next) {
      if (!this.#hovered.has(n)) {
        n.hovered = true;
        n.props.onHover?.(true);
      }
    }
    this.#hovered = next;
  }

  // ── Pointer ────────────────────────────────────────────────────────────────

  #move(e: PointerEvent) {
    const [x, y] = this.#local(e);
    this.#pointer = [x, y];
    const r = this.#canvas.getBoundingClientRect();
    this.onPointer((x / r.width) * 2 - 1, (y / r.height) * 2 - 1);
    if (this.#drag) {
      const dy = y - this.#drag.startY;
      if (Math.abs(dy) > 8) {
        this.#drag.moved = true;
        if (this.#pressed) this.#pressed.pressed = false;
      }
      if (this.#drag.moved) this.#drag.node.scrollY = this.#drag.scroll - dy;
      return;
    }
    this.#hover(x, y);
  }

  #down(e: PointerEvent) {
    if (e.button !== 0) return;
    this.#canvas.focus({ preventScroll: true });
    this.onActivity();
    const [x, y] = this.#local(e);
    this.#pointer = [x, y];
    this.#hover(x, y);
    const target = this.#hit(x, y, (n) => Boolean(n.props.onPress) && !n.props.disabled);
    if (target) {
      this.#pressed = target;
      target.pressed = true;
    }
    const scroller = this.#hit(
      x,
      y,
      (n) => (n.props.style as { overflow?: string } | undefined)?.overflow === 'scroll',
    );
    if (scroller && e.pointerType !== 'mouse')
      this.#drag = { node: scroller, startY: y, scroll: scroller.scrollY, moved: false };
    this.#canvas.setPointerCapture(e.pointerId);
  }

  #up(e: PointerEvent) {
    const [x, y] = this.#local(e);
    const pressed = this.#pressed;
    const dragged = this.#drag?.moved;
    this.#cancel();
    if (!pressed || dragged) return;
    const target = this.#hit(x, y, (n) => Boolean(n.props.onPress) && !n.props.disabled);
    if (target === pressed) pressed.props.onPress?.();
    if (e.pointerType !== 'mouse') {
      this.#pointer = undefined;
      this.#setHovered(new Set());
    }
  }

  #cancel() {
    if (this.#pressed) this.#pressed.pressed = false;
    this.#pressed = undefined;
    this.#drag = undefined;
  }

  #wheel(e: WheelEvent) {
    const [x, y] = this.#local(e);
    const scroller = this.#hit(
      x,
      y,
      (n) => (n.props.style as { overflow?: string } | undefined)?.overflow === 'scroll',
    );
    if (!scroller) return;
    e.preventDefault();
    scroller.scrollY += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  #key(e: KeyboardEvent) {
    this.onActivity();
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
    const list = this.#painter.hitList;
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]!;
      if (!n.destroyed && !n.props.disabled && n.props.hotkey && n.props.hotkey.toLowerCase() === e.key.toLowerCase()) {
        e.preventDefault();
        n.props.onPress?.();
        return;
      }
    }
  }

  // ── Accessibility mirror ───────────────────────────────────────────────────

  #syncMirror() {
    const live = new Set<number>();
    let previous: HTMLButtonElement | undefined;
    for (const n of this.#painter.hitList) {
      if (!n.props.onPress || n.destroyed) continue;
      const label = n.props.label ?? labelOf(n);
      if (!label) continue;
      live.add(n.id);
      let button = this.#buttons.get(n.id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        const node = n;
        button.addEventListener('click', () => {
          if (!node.props.disabled) node.props.onPress?.();
        });
        button.addEventListener('focus', () => (node.focused = true));
        button.addEventListener('blur', () => (node.focused = false));
        this.#buttons.set(n.id, button);
      }
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      button.disabled = Boolean(n.props.disabled);
      const a = n.abs;
      const style = `position:absolute;opacity:0;pointer-events:none;margin:0;padding:0;border:0;left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px`;
      if (button.dataset.box !== style) {
        button.dataset.box = style;
        button.style.cssText = style;
      }
      // Keep DOM order == visual order so Tab walks the screen naturally.
      const expectedNext = previous ? previous.nextSibling : this.#a11y.firstChild;
      if (expectedNext !== button) this.#a11y.insertBefore(button, expectedNext);
      previous = button;
    }
    for (const [id, button] of this.#buttons) {
      if (!live.has(id)) {
        button.remove();
        this.#buttons.delete(id);
      }
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
