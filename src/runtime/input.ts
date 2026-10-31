// Per-root pointer capture, keyboard routing, modal focus and DOM semantics.
import { HostNode } from './nodes.ts';
import type { Painter } from './paint.ts';
import { PointerRouter, inside, type HostPointerEvent, type HostWheelEvent } from '../platform/pointer.ts';
import { EditorManager, type EditorElement } from './editing.ts';

type ControlElement = HTMLButtonElement | EditorElement;

type Direction = 'up' | 'down' | 'left' | 'right';
const pressable = (n: HostNode) => Boolean(n.props.onPress || n.props.focusable);
const semanticGroup = (n: HostNode) => ['tablist', 'dialog', 'region', 'listbox'].includes(n.props.role ?? '');

export class InputSystem extends PointerRouter {
  readonly #canvas: HTMLCanvasElement;
  readonly #a11y: HTMLElement;
  readonly #live: HTMLElement;
  readonly #events = new AbortController();
  readonly #controls = new Map<HostNode, ControlElement>();
  readonly #editors: EditorManager;
  readonly #groups = new Map<HostNode, HTMLDivElement>();
  #announced = '';
  #pendingModalFocus = false;
  readonly #modalFocus = new Map<HostNode, HTMLElement>();

  constructor(canvas: HTMLCanvasElement, a11y: HTMLElement, painter: Painter, commit: (callback: () => void) => void) {
    super(painter, {
      size: () => canvas.getBoundingClientRect(),
      focusSurface: () => canvas.focus({ preventScroll: true }),
      setCursor: (cursor) => {
        canvas.style.cursor = cursor;
      },
      capturePointer: (id) => canvas.setPointerCapture(id),
      hasPointerCapture: (id) => canvas.hasPointerCapture(id),
      releasePointer: (id) => canvas.releasePointerCapture(id),
    });
    this.#canvas = canvas;
    this.#a11y = a11y;
    this.#editors = new EditorManager(
      a11y,
      (callback) => this.call(() => commit(callback)),
      (node, focused) => {
        node.focused = focused;
        if (focused) this.#reveal(node);
        if (!node.destroyed) this.call(focused ? node.props.onFocus : node.props.onBlur);
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
            this.report(error);
          }
        },
        { ...options, ...(passive === undefined ? {} : { passive }) },
      );
    };
    listen(canvas, 'pointermove', (e) => this.pointerMove(this.#pointerEvent(e)));
    listen(canvas, 'pointerdown', (e) => this.pointerDown(this.#pointerEvent(e)));
    listen(canvas, 'pointerup', (e) => this.pointerUp(this.#pointerEvent(e)));
    listen(canvas, 'pointercancel', (e) => {
      this.pointerCancel(this.#pointerEvent(e));
    });
    listen(canvas, 'lostpointercapture', (e) => {
      this.pointerCancel(this.#pointerEvent(e));
    });
    listen(canvas, 'pointerleave', () => this.pointerLeave());
    listen(canvas, 'wheel', (e) => this.wheel(this.#wheelEvent(e)), false);
    listen(canvas, 'keydown', (e) => this.#key(e));
    listen(a11y, 'keydown', (e) => this.#key(e));
    listen(a11y, 'wheel', (e) => this.wheel(this.#wheelEvent(e)), false);
    window.addEventListener('blur', () => this.cancelPointer(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.cancelPointer();
      },
      options,
    );
  }
  destroy() {
    this.enabled = false;
    this.#events.abort();
    this.#editors.destroy();
    this.cancelPointer();
    this.setHovered(new Set());
    for (const button of this.#controls.values()) button.remove();
    this.#controls.clear();
    for (const group of this.#groups.values()) group.remove();
    this.#groups.clear();
    this.#modalFocus.clear();
    this.#live.remove();
  }
  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.cancelPointer();
      this.resetHover();
    }
    if (!enabled) this.#editors.suspend();
    for (const [node, button] of this.#controls)
      button.disabled = !enabled || Boolean(node.props.disabled) || !inside(node, this.modal);
  }
  afterPaint() {
    this.refreshPointer();
    this.#syncMirror();
  }
  isPointerOverUI(point: { clientX: number; clientY: number } | { x: number; y: number }): boolean {
    // Browser events also expose x/y as aliases for viewport coordinates.
    if (!('clientX' in point)) return this.isSurfaceOccupied(point.x, point.y);
    const rect = this.#canvas.getBoundingClientRect();
    return this.isSurfaceOccupied(point.clientX - rect.left, point.clientY - rect.top);
  }
  #pointerEvent(e: PointerEvent): HostPointerEvent {
    const [x, y] = this.#local(e);
    return {
      x,
      y,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      button: e.button,
      buttons: e.buttons,
      isPrimary: e.isPrimary,
      get defaultPrevented() {
        return e.defaultPrevented;
      },
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
    };
  }
  #wheelEvent(e: WheelEvent): HostWheelEvent {
    const [x, y] = this.#local(e);
    return {
      x,
      y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      get defaultPrevented() {
        return e.defaultPrevented;
      },
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      nativeScroll: () => {
        const editor = e.target;
        return (
          editor instanceof HTMLTextAreaElement &&
          !editor.disabled &&
          ((e.deltaY < 0 && editor.scrollTop > 0) ||
            (e.deltaY > 0 && editor.scrollTop + editor.clientHeight < editor.scrollHeight))
        );
      },
    };
  }
  announce(text: string) {
    if (text !== this.#announced) {
      this.#announced = text;
      this.#live.textContent = text;
    }
  }

  #local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.#canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  #focused(): HostNode | undefined {
    return [...this.#controls].find(([, button]) => button === document.activeElement)?.[0];
  }
  #eligible() {
    return [...this.#controls].filter(
      ([n, button]) => !button.disabled && !n.props.disabled && !n.destroyed && inside(n, this.modal),
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
    for (let node = current; node && inside(node, this.modal); node = node.parent) {
      if (node.props.onNavigate) {
        let handled = false;
        this.call(() => {
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
    if (!this.enabled || !n?.props.onPress || n.props.disabled || !inside(n, this.modal)) return false;
    this.call(n.props.onPress);
    return true;
  }
  #key(e: KeyboardEvent) {
    if (!this.enabled) return;
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
          this.call(() => focused.props.editor?.onSubmit?.(this.#editors.value(focused)));
        }
        return;
      }
    }
    let stopped = false;
    for (let n = this.#focused(); n && inside(n, this.modal); n = n.parent) {
      const callback = n.props.onKeyDown;
      this.call(() =>
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
      if (stopped || n === this.modal) break;
    }
    if (e.defaultPrevented || stopped) return;
    if (e.key === 'Tab' && this.modal) {
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
    for (let i = this.painter.hitList.length - 1; i >= 0; i--) {
      const n = this.painter.hitList[i]!;
      if (
        !n.destroyed &&
        inside(n, this.modal) &&
        !n.props.disabled &&
        n.props.hotkey?.toLowerCase() === e.key.toLowerCase()
      ) {
        e.preventDefault();
        this.call(n.props.onPress);
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
    const modal = this.painter.visible.findLast((n) => Boolean(n.props.modal));
    const changedModal = modal !== this.modal;
    const returning = Boolean(modal && this.#modalFocus.has(modal));
    const restore: HTMLElement[] = [];
    if (changedModal) {
      this.cancelPointer();
      if (modal && !returning) {
        // A replacement dialog inherits the departing scope's return target.
        // A nested dialog remembers the control that opened that inner scope.
        const previous =
          this.modal && !this.painter.visible.includes(this.modal) ? this.#modalFocus.get(this.modal) : undefined;
        const active =
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== document.body &&
          document.activeElement !== document.documentElement
            ? document.activeElement
            : this.#canvas;
        this.#modalFocus.set(modal, previous ?? active);
      }
      this.modal = modal;
    }
    for (const [scope, target] of [...this.#modalFocus].reverse()) {
      if (!this.painter.visible.includes(scope)) {
        restore.push(target);
        this.#modalFocus.delete(scope);
      }
    }
    const live = new Set<HostNode>();
    const liveEditors = new Set<HostNode>();
    const liveGroups = new Set<HostNode>();
    for (const n of this.painter.hitList) {
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
    const painted = new Set(this.painter.hitList);
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
    for (const n of this.painter.hitList) {
      const group = this.#groups.get(n);
      if (group && liveGroups.has(n)) place(n, group);
      if (semanticGroup(n)) continue;
      if (!pressable(n) || n.destroyed) continue;
      const label = n.props.label ?? labelOf(n);
      if (!label) continue;
      live.add(n);
      if (n.props.editor) {
        liveEditors.add(n);
        const visible = this.enabled && inside(n, modal);
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
          if (this.enabled && !n.destroyed && !n.props.disabled && inside(n, this.modal)) this.call(n.props.onPress);
        });
        button.addEventListener('focus', () => {
          n.focused = true;
          this.#reveal(n);
          this.call(n.props.onFocus);
        });
        button.addEventListener('blur', () => {
          n.focused = false;
          if (!n.destroyed) this.call(n.props.onBlur);
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
      button.disabled = !this.enabled || Boolean(n.props.disabled) || !inside(n, modal);
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
