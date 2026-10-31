// Per-root pointer capture, keyboard routing, modal focus and DOM semantics.
import { HostNode } from './nodes.ts';
import type { Painter } from './paint.ts';
import type { UIPointerEvent, UIWheelEvent } from './types.ts';
import { EditorManager, type EditorElement } from './editing.ts';

type ControlElement = HTMLButtonElement | EditorElement;

type Direction = 'up' | 'down' | 'left' | 'right';
type PointerHandler = 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel';
const pressable = (n: HostNode) => Boolean(n.props.onPress || n.props.focusable);
const semanticGroup = (n: HostNode) => ['tablist', 'dialog', 'region', 'listbox'].includes(n.props.role ?? '');
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
  readonly #controls = new Map<HostNode, ControlElement>();
  readonly #editors: EditorManager;
  readonly #groups = new Map<HostNode, HTMLDivElement>();
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
  #pendingModalFocus = false;
  readonly #modalFocus = new Map<HostNode, HTMLElement>();
  onPointer: (nx: number, ny: number) => void = () => {};
  onActivity: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, a11y: HTMLElement, painter: Painter, commit: (callback: () => void) => void) {
    this.#canvas = canvas;
    this.#a11y = a11y;
    this.#painter = painter;
    this.#editors = new EditorManager(
      a11y,
      (callback) => this.#call(() => commit(callback)),
      (node, focused) => {
        node.focused = focused;
        if (focused) this.#reveal(node);
        if (!node.destroyed) this.#call(focused ? node.props.onFocus : node.props.onBlur);
      },
      () => this.onActivity(),
    );
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
    listen(a11y, 'wheel', (e) => this.#wheel(e), false);
    window.addEventListener('blur', () => this.#cancel(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.#cancel();
      },
      options,
    );
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
    this.#enabled = false;
    this.#events.abort();
    this.#editors.destroy();
    this.#cancel();
    this.#setHovered(new Set());
    for (const button of this.#controls.values()) button.remove();
    this.#controls.clear();
    for (const group of this.#groups.values()) group.remove();
    this.#groups.clear();
    this.#modalFocus.clear();
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
    if (!enabled) this.#editors.suspend();
    for (const [node, button] of this.#controls)
      button.disabled = !enabled || Boolean(node.props.disabled) || !inside(node, this.#modal);
  }
  afterPaint() {
    if (this.#capture?.destroyed || this.#pressed?.destroyed) this.#cancel();
    if (this.#enabled && this.#pointer && !this.#drag) this.#hover(...this.#pointer);
    this.#syncMirror();
  }
  isPointerOverUI(point: { clientX: number; clientY: number }): boolean {
    if (!this.#enabled || !Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) return false;
    const rect = this.#canvas.getBoundingClientRect();
    const x = point.clientX - rect.left,
      y = point.clientY - rect.top;
    if (rect.width <= 0 || rect.height <= 0 || x < 0 || y < 0 || x >= rect.width || y >= rect.height) return false;
    return Boolean((this.#modal && !this.#modal.destroyed) || this.#surface(x, y));
  }
  #contains(n: HostNode, x: number, y: number): boolean {
    const a = n.abs,
      c = n.clip;
    return (
      !n.destroyed &&
      inside(n, this.#modal) &&
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
  #surface(x: number, y: number): HostNode | undefined {
    if (!this.#enabled) return;
    for (let i = this.#painter.hitList.length - 1; i >= 0; i--) {
      const n = this.#painter.hitList[i]!;
      if (this.#contains(n, x, y)) return n;
    }
  }
  announce(text: string) {
    if (text !== this.#announced) {
      this.#announced = text;
      this.#live.textContent = text;
    }
  }

  #hit(x: number, y: number, predicate: (n: HostNode) => boolean, blockDisabled = true): HostNode | undefined {
    if (!this.#enabled) return;
    for (let i = this.#painter.hitList.length - 1; i >= 0; i--) {
      const n = this.#painter.hitList[i]!;
      if (!this.#contains(n, x, y)) continue;
      const matches = predicate(n);
      if (!matches && !n.props.block && (!n.props.disabled || !blockDisabled)) continue;
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
    if (
      !this.#enabled ||
      e.isPrimary === false ||
      (e.pointerType === 'touch' && this.#pointerId === undefined) ||
      (this.#pointerId !== undefined && e.pointerId !== this.#pointerId)
    )
      return;
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
    if (!this.#enabled || e.isPrimary === false || e.button !== 0 || this.#pointerId !== undefined) return;
    this.#canvas.focus({ preventScroll: true });
    this.onActivity();
    const [x, y] = this.#local(e);
    this.#pointer = [x, y];
    this.#lastEvent = e;
    this.#hover(x, y);
    const target = this.#hit(x, y, pointerTarget);
    const scroller = this.#hit(x, y, (n) => n.props.style?.overflow === 'scroll', false);
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
    const deltaMode = e.deltaMode;
    const [x, y] = this.#local(e);
    const target = this.#surface(x, y);
    if (!target) return;
    this.onActivity();
    // Freeze this route: callbacks may unmount nodes or change the tree.
    const path: HostNode[] = [];
    for (let n: HostNode | undefined = target; n && inside(n, this.#modal); n = n.parent) {
      path.push(n);
      if (n === this.#modal) break;
    }
    let prevented = e.defaultPrevented,
      stopped = false;
    for (const n of path) {
      if (!this.#enabled) return;
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
      if (!n.props.disabled) this.#call(() => n.props.onWheel?.(event));
      if (stopped) break;
    }
    if (prevented || target.destroyed || !this.#enabled) return;
    // Native textarea scrolling precedes the Yoga default, after custom handlers.
    const editor = e.target;
    if (
      editor instanceof HTMLTextAreaElement &&
      !editor.disabled &&
      ((e.deltaY < 0 && editor.scrollTop > 0) ||
        (e.deltaY > 0 && editor.scrollTop + editor.clientHeight < editor.scrollHeight))
    )
      return;
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
      if (n === this.#modal) return;
    }
  }
  #focused(): HostNode | undefined {
    return [...this.#controls].find(([, button]) => button === document.activeElement)?.[0];
  }
  #eligible() {
    return [...this.#controls].filter(
      ([n, button]) => !button.disabled && !n.props.disabled && !n.destroyed && inside(n, this.#modal),
    );
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
    for (let node = current; node && inside(node, this.#modal); node = node.parent) {
      if (node.props.onNavigate) {
        let handled = false;
        this.#call(() => {
          handled = node.props.onNavigate!(direction);
        });
        if (handled) return true;
      }
    }
    if (!current) {
      candidates[0]![1].focus({ preventScroll: true });
      return true;
    }
    const cx = current.abs.x + current.abs.w / 2,
      cy = current.abs.y + current.abs.h / 2;
    let best: ControlElement | undefined,
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
    const focused = this.#focused();
    if (focused?.props.editor) {
      e.stopPropagation(); // Game bubble listeners must not consume typing or editing shortcuts.
      if (focused.props.disabled) return;
      if (e.isComposing || e.keyCode === 229 || this.#editors.isComposing(focused)) return;
      if (e.key !== 'Tab' && e.key !== 'Escape') {
        if (
          e.key === 'Enter' &&
          !e.repeat &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          !focused.props.editor.multiline &&
          focused.props.editor.onSubmit
        ) {
          e.preventDefault();
          this.#call(() => focused.props.editor?.onSubmit?.(this.#editors.value(focused)));
        }
        return;
      }
    }
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
      const controls = this.#eligible()
        .map(([, button]) => button)
        .filter((button) => button.tabIndex >= 0);
      const index = controls.indexOf(document.activeElement as ControlElement);
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
    const focusedBefore = this.#focused();
    const modal = this.#painter.visible.findLast((n) => Boolean(n.props.modal));
    const changedModal = modal !== this.#modal;
    const returning = Boolean(modal && this.#modalFocus.has(modal));
    const restore: HTMLElement[] = [];
    if (changedModal) {
      this.#cancel();
      if (modal && !returning) {
        // A replacement dialog inherits the departing scope's return target.
        // A nested dialog remembers the control that opened that inner scope.
        const previous =
          this.#modal && !this.#painter.visible.includes(this.#modal) ? this.#modalFocus.get(this.#modal) : undefined;
        const active =
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== document.body &&
          document.activeElement !== document.documentElement
            ? document.activeElement
            : this.#canvas;
        this.#modalFocus.set(modal, previous ?? active);
      }
      this.#modal = modal;
    }
    for (const [scope, target] of [...this.#modalFocus].reverse()) {
      if (!this.#painter.visible.includes(scope)) {
        restore.push(target);
        this.#modalFocus.delete(scope);
      }
    }
    const live = new Set<HostNode>();
    const liveEditors = new Set<HostNode>();
    const liveGroups = new Set<HostNode>();
    for (const n of this.#painter.hitList) {
      if (n.destroyed || !semanticGroup(n)) continue;
      liveGroups.add(n);
      let group = this.#groups.get(n);
      if (!group) {
        group = document.createElement('div');
        group.style.cssText = 'position:static;pointer-events:none';
        this.#groups.set(n, group);
      }
      group.setAttribute('role', n.props.role!);
      group.setAttribute('aria-label', n.props.label ?? labelOf(n));
      group.setAttribute('aria-hidden', String(Boolean(modal && !inside(n, modal) && !inside(modal, n))));
      if (n.props.role === 'dialog') group.setAttribute('aria-modal', String(n === modal));
      else group.removeAttribute('aria-modal');
      if (n.props.orientation) group.setAttribute('aria-orientation', n.props.orientation);
      else group.removeAttribute('aria-orientation');
    }
    const dormant = new Set<HTMLElement>();
    const painted = new Set(this.#painter.hitList);
    for (const [node, group] of this.#groups) if (!liveGroups.has(node)) dormant.add(group);
    for (const [node, control] of this.#controls)
      if (node.props.editor && !painted.has(node) && !node.destroyed) dormant.add(control);
    const previous = new Map<HTMLElement, HTMLElement>();
    const place = (node: HostNode, element: HTMLElement) => {
      let parent: HTMLElement = this.#a11y;
      for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        const group = this.#groups.get(ancestor);
        if (group && liveGroups.has(ancestor)) {
          parent = group;
          break;
        }
      }
      const before = previous.get(parent);
      let next = before ? before.nextSibling : parent.firstChild;
      // Hidden editors and bookkeeping nodes do not change the order of live controls.
      // Moving their semantic group would reset native editing history in Chromium.
      while (
        next &&
        next !== element &&
        (next === this.#live || (next instanceof HTMLElement && (next.hidden || dormant.has(next))))
      )
        next = next.nextSibling;
      if (next !== element) parent.insertBefore(element, next);
      previous.set(parent, element);
    };
    for (const n of this.#painter.hitList) {
      const group = this.#groups.get(n);
      if (group && liveGroups.has(n)) place(n, group);
      if (semanticGroup(n)) continue;
      if (!pressable(n) || n.destroyed) continue;
      const label = n.props.label ?? labelOf(n);
      if (!label) continue;
      live.add(n);
      if (n.props.editor) {
        liveEditors.add(n);
        const visible = this.#enabled && inside(n, modal);
        const editor = this.#editors.sync(n, visible && !n.props.disabled, visible);
        this.#controls.set(n, editor);
        place(n, editor);
        continue;
      }
      const previousControl = this.#controls.get(n);
      let button = previousControl instanceof HTMLButtonElement ? previousControl : undefined;
      if (!button) {
        previousControl?.remove();
        button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', () => {
          if (this.#enabled && !n.destroyed && !n.props.disabled && inside(n, this.#modal)) this.#call(n.props.onPress);
        });
        button.addEventListener('focus', () => {
          n.focused = true;
          this.#reveal(n);
          this.#call(n.props.onFocus);
        });
        button.addEventListener('blur', () => {
          n.focused = false;
          if (!n.destroyed) this.#call(n.props.onBlur);
        });
        this.#controls.set(n, button);
      }
      button.setAttribute('aria-label', label);
      button.setAttribute('role', n.props.role ?? 'button');
      button.tabIndex = n.props.tabIndex ?? 0;
      for (const [key, value] of Object.entries({
        checked: n.props.checked,
        expanded: n.props.expanded,
        selected: n.props.selected,
        valuemin: n.props.valueMin,
        valuemax: n.props.valueMax,
        valuenow: n.props.valueNow,
        valuetext: n.props.valueText,
        orientation: n.props.orientation,
        posinset: n.props.positionInSet,
        setsize: n.props.setSize,
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
      place(n, button);
    }
    this.#editors.retain(liveEditors);
    for (const [node, button] of this.#controls)
      if (!live.has(node)) {
        if (!node.props.editor || node.destroyed) button.remove();
        this.#controls.delete(node);
      }
    for (const [node, group] of this.#groups)
      if (!liveGroups.has(node)) {
        // A mounted but hidden editor keeps its DOM node (and native undo history).
        if (!node.destroyed && group.querySelector('[data-ludic-editor]')) {
          group.setAttribute('aria-hidden', 'true');
          continue;
        }
        group.remove();
        this.#groups.delete(node);
      }
    if (!changedModal && focusedBefore && !focusedBefore.destroyed) {
      const button = this.#controls.get(focusedBefore);
      if (button && !button.disabled && button.isConnected && document.activeElement !== button)
        button.focus({ preventScroll: true });
    }
    if (changedModal) {
      if (modal) {
        const eligible = this.#eligible();
        const target = returning
          ? restore.find((element) => eligible.some(([, button]) => button === element))
          : undefined;
        const first = eligible.find(([, button]) => button.tabIndex >= 0)?.[1];
        this.#pendingModalFocus = !target && !first;
        (target ?? first ?? this.#canvas).focus({ preventScroll: true });
      } else {
        this.#pendingModalFocus = false;
        const target = restore.find((element) => element.isConnected && !('disabled' in element && element.disabled));
        (target ?? this.#canvas).focus({ preventScroll: true });
      }
    } else if (modal && (this.#pendingModalFocus || focusedBefore?.destroyed)) {
      const first = this.#eligible().find(([, button]) => button.tabIndex >= 0)?.[1];
      const canFocus =
        document.activeElement === this.#canvas ||
        (focusedBefore?.destroyed && document.activeElement === document.body);
      if (first && canFocus) {
        // Enter animations may hide all controls during the first modal frame.
        // Honor a deliberate focus move outside this root while waiting.
        first.focus({ preventScroll: true });
        this.#pendingModalFocus = false;
      } else if (!first && canFocus) {
        this.#pendingModalFocus = true;
        this.#canvas.focus({ preventScroll: true });
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
