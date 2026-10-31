import { HostNode } from '../runtime/nodes.ts';
import type { Painter } from '../runtime/paint.ts';
import type { ClientPoint, InputDriver, SurfacePoint } from './contracts.ts';
import { PointerRouter, inside } from './pointer.ts';
import { parseColor } from './color.ts';
import type { HostKeyEvent, PlatformEvent, PlatformHost, SemanticNode } from './host.ts';

const group = (n: HostNode) => ['dialog', 'tablist', 'region', 'listbox'].includes(n.props.role ?? '');
const control = (n: HostNode) => Boolean(n.props.onPress || n.props.focusable);
function labelOf(n: HostNode): string {
  return (
    n.props.label ??
    (n.type === 'text'
      ? n.text.replace(/\*\*/g, '')
      : n.children
          .filter((child): child is HostNode => child instanceof HostNode)
          .map(labelOf)
          .join(' ')
          .trim())
  );
}

/** Platform-independent semantic actions, keyboard policy and editor synchronization. */
export class PlatformInput extends PointerRouter implements InputDriver {
  readonly #host: PlatformHost;
  readonly #commit: (callback: () => void) => void;
  readonly #unsubscribe: () => void;
  #focused: HostNode | undefined;
  #nodes = new Map<number, HostNode>();
  #editors = new Map<number, HostNode>();
  #composing = new Map<number, { value: string; prop: string; pending?: string }>();
  #reported = new Map<number, string>();
  #returns = new Map<HostNode, number | undefined>();
  #announced = '';
  #destroyed = false;
  constructor(painter: Painter, host: PlatformHost, commit: (callback: () => void) => void) {
    super(painter, host);
    this.#host = host;
    this.#commit = commit;
    this.#unsubscribe = host.subscribe((event) => this.call(() => this.#event(event)));
  }
  #event(e: PlatformEvent) {
    if (!this.enabled || this.#destroyed) return;
    this.onActivity();
    switch (e.type) {
      case 'pointermove':
        this.pointerMove(e);
        break;
      case 'pointerdown':
        this.pointerDown(e);
        break;
      case 'pointerup':
        this.pointerUp(e);
        break;
      case 'pointercancel':
        this.pointerCancel(e);
        break;
      case 'wheel':
        this.wheel(e);
        break;
      case 'leave':
        this.pointerLeave();
        break;
      case 'blur':
        this.cancelPointer();
        this.resetHover();
        this.#setFocus(undefined);
        break;
      case 'focus':
        this.#setFocus(e.key);
        break;
      case 'activate': {
        const node = e.key === undefined ? undefined : this.#nodes.get(e.key);
        if (this.#eligible(node)) {
          this.#host.focus(node.id);
          this.#commit(() => node.props.onPress?.());
        }
        break;
      }
      case 'keydown':
        this.#key(e);
        break;
      case 'edit':
      case 'compositionend':
        this.#edit(e);
        break;
    }
  }
  #eligible(node: HostNode | undefined): node is HostNode {
    return Boolean(
      this.enabled &&
      node &&
      !node.destroyed &&
      !node.props.disabled &&
      inside(node, this.modal) &&
      this.painter.hitList.includes(node),
    );
  }
  #controls() {
    return [...this.#nodes.values()].filter((n) => control(n) && !group(n) && this.#eligible(n));
  }
  #setFocus(key: number | undefined) {
    const next = key === undefined ? undefined : this.#nodes.get(key);
    if (next && !this.#eligible(next)) return;
    if (next === this.#focused) return;
    const before = this.#focused;
    this.#focused = next;
    if (before) {
      before.focused = false;
      if (!before.destroyed) this.call(before.props.onBlur);
    }
    if (next) {
      next.focused = true;
      this.#reveal(next);
      this.call(next.props.onFocus);
    }
  }
  #reveal(node: HostNode) {
    for (let p = node.parent; p; p = p.parent) {
      if (p.props.style?.overflow !== 'scroll') continue;
      const top = Math.max(p.abs.y, p.clip?.y ?? -Infinity),
        bottom = Math.min(p.abs.y + p.abs.h, p.clip ? p.clip.y + p.clip.h : Infinity);
      const dy =
        node.abs.y < top ? node.abs.y - top : node.abs.y + node.abs.h > bottom ? node.abs.y + node.abs.h - bottom : 0;
      p.scrollY = Math.max(
        0,
        Math.min(Math.max(0, p.contentHeight - p.box.h), p.scrollY + dy / (p.abs.h / p.box.h || 1)),
      );
    }
  }
  focus(id: string) {
    const n = this.#controls().find((n) => n.props.id === id);
    return n ? this.#host.focus(n.id) : false;
  }
  activateFocused() {
    if (!this.#eligible(this.#focused) || !this.#focused.props.onPress) return false;
    this.#commit(() => this.#focused?.props.onPress?.());
    return true;
  }
  navigate(direction: 'up' | 'down' | 'left' | 'right') {
    const candidates = this.#controls();
    if (!candidates.length) return false;
    const current = this.#focused;
    for (let n = current; n && inside(n, this.modal); n = n.parent) if (n.props.onNavigate?.(direction)) return true;
    if (!current) return this.#host.focus(candidates[0]!.id);
    let best: HostNode | undefined,
      score = Infinity;
    for (const n of candidates) {
      if (n === current) continue;
      const dx = n.abs.x + n.abs.w / 2 - current.abs.x - current.abs.w / 2,
        dy = n.abs.y + n.abs.h / 2 - current.abs.y - current.abs.h / 2;
      const forward = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
      const cross = direction === 'right' || direction === 'left' ? Math.abs(dy) : Math.abs(dx);
      const distance = forward + cross * 2 + (cross * cross) / Math.max(1, forward);
      if (forward > 0.5 && distance < score) {
        best = n;
        score = distance;
      }
    }
    return best ? this.#host.focus(best.id) : false;
  }
  #key(e: HostKeyEvent) {
    const focused = this.#focused,
      editor = focused?.props.editor;
    if (editor) {
      e.stopPropagation();
      if (e.isComposing || this.#composing.has(focused!.id)) return;
      if (e.key !== 'Tab' && e.key !== 'Escape') {
        if (
          e.key === 'Enter' &&
          !e.repeat &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          !editor.multiline &&
          editor.onSubmit
        ) {
          e.preventDefault();
          this.call(() => editor.onSubmit?.(editor.value));
        }
        return;
      }
    }
    let stopped = false;
    for (let n = focused; n && inside(n, this.modal); n = n.parent) {
      this.call(() =>
        n!.props.onKeyDown?.({
          ...e,
          stopPropagation() {
            stopped = true;
            e.stopPropagation();
          },
          preventDefault: () => e.preventDefault(),
        }),
      );
      if (stopped || n === this.modal) break;
    }
    if (e.defaultPrevented || stopped) return;
    if (e.key === 'Tab') {
      const candidates = this.#controls().filter((n) => (n.props.tabIndex ?? 0) >= 0);
      const index = candidates.indexOf(focused!);
      const next =
        candidates[
          index < 0
            ? e.shiftKey
              ? candidates.length - 1
              : 0
            : (index + (e.shiftKey ? -1 : 1) + candidates.length) % candidates.length
        ];
      if (next) {
        e.preventDefault();
        this.#host.focus(next.id);
      }
      return;
    }
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (focused && (e.key === 'Enter' || e.key === ' ')) {
      if (this.activateFocused()) e.preventDefault();
      return;
    }
    for (const n of [...this.painter.hitList].reverse())
      if (this.#eligible(n) && n.props.hotkey?.toLowerCase() === e.key.toLowerCase()) {
        e.preventDefault();
        this.#commit(() => n.props.onPress?.());
        return;
      }
  }
  #edit(e: Extract<PlatformEvent, { type: 'edit' | 'compositionend' }>) {
    const n = this.#editors.get(e.key),
      editor = n?.props.editor;
    if (!this.#eligible(n) || !editor || editor.readOnly) return;
    const previous = this.#composing.get(e.key);
    if (previous && editor.value !== previous.prop && editor.value !== previous.value) previous.pending = editor.value;
    if (e.type === 'edit' && e.composing) {
      const state = this.#composing.get(e.key) ?? { value: e.value, prop: editor.value };
      state.value = e.value;
      this.#composing.set(e.key, state);
    }
    const state = this.#composing.get(e.key);
    if (state?.pending === undefined && e.value !== this.#reported.get(e.key)) {
      this.#reported.set(e.key, e.value);
      this.#commit(() => n.props.editor?.onValueChange(e.value));
    }
    if (state) state.prop = n.props.editor?.value ?? editor.value;
    if (e.type === 'compositionend' || !e.composing) {
      this.#composing.delete(e.key);
    }
    this.afterPaint();
  }
  #semantic(n: HostNode, hidden: boolean): SemanticNode {
    let parent = n.parent;
    while (parent && !group(parent)) parent = parent.parent;
    const p = n.props,
      editor = p.editor;
    const result: SemanticNode = {
      key: n.id,
      parent: parent?.id,
      id: p.id,
      role: editor ? 'textbox' : (p.role ?? (n.type === 'text' ? 'text' : 'button')),
      label: labelOf(n),
      x: n.abs.x,
      y: n.abs.y,
      width: n.abs.w,
      height: n.abs.h,
      clip: n.clip,
      opacity: n.paintedOpacity,
      disabled: !this.enabled || Boolean(p.disabled),
      hidden,
      tabIndex: p.tabIndex ?? 0,
      checked: p.checked,
      selected: p.selected,
      expanded: p.expanded,
      valueMin: p.valueMin,
      valueMax: p.valueMax,
      valueNow: p.valueNow,
      valueText: p.valueText,
      modal: p.modal,
    };
    if (editor) {
      const { binding: _binding, onValueChange: _change, onSubmit: _submit, ...description } = editor;
      const composition = this.#composing.get(n.id);
      if (composition) {
        if (editor.value !== composition.prop && editor.value !== composition.value) composition.pending = editor.value;
        composition.prop = editor.value;
      }
      result.editor = {
        ...description,
        value: composition?.value ?? editor.value,
        foreground: parseColor(editor.textStyle?.color ?? '#edf2ff'),
        textStyle: {
          ...editor.textStyle,
          fontSize: (editor.textStyle?.fontSize ?? 16) * n.ctx.textScale * (n.abs.w / n.box.w || 1),
          letterSpacing: (editor.textStyle?.letterSpacing ?? 0) * n.ctx.textScale * (n.abs.w / n.box.w || 1),
          padding: (editor.textStyle?.padding ?? 10) * (n.abs.w / n.box.w || 1),
        },
      };
      if (!composition) this.#reported.set(n.id, editor.value);
    }
    return result;
  }
  afterPaint() {
    const modal = this.painter.visible.findLast((n) => Boolean(n.props.modal));
    const changed = modal !== this.modal;
    const restore: number[] = [];
    if (changed) {
      this.cancelPointer();
      if (modal && !this.#returns.has(modal))
        this.#returns.set(
          modal,
          this.modal && !this.painter.visible.includes(this.modal) ? this.#returns.get(this.modal) : this.#focused?.id,
        );
      for (const [scope, target] of [...this.#returns].reverse())
        if (!this.painter.visible.includes(scope)) {
          if (target !== undefined) restore.push(target);
          this.#returns.delete(scope);
        }
      this.modal = modal;
    }
    this.#nodes.clear();
    const semantics: SemanticNode[] = [];
    for (const n of this.painter.visible) {
      if (n.destroyed || !(group(n) || control(n) || n.type === 'text')) continue;
      if (n.type === 'text') {
        let owner = n.parent;
        while (owner && !control(owner)) owner = owner.parent;
        if (owner) continue;
      }
      if (!labelOf(n) && !group(n)) continue;
      this.#nodes.set(n.id, n);
      if (n.props.editor) {
        if (!this.#editors.has(n.id)) {
          this.#editors.set(n.id, n);
          n.props.editor.binding.current = {
            focus: () => this.#eligible(n) && this.#host.focus(n.id),
            blur: () => {
              if (this.#focused === n) this.#host.focus(undefined);
            },
            select: () => this.#eligible(n) && this.#host.selectEditor(n.id),
          };
        }
      }
      semantics.push(this.#semantic(n, !inside(n, modal) && !inside(modal ?? n, n)));
    }
    for (const [key, n] of this.#editors) {
      if (n.destroyed) {
        if (n.props.editor) n.props.editor.binding.current = null;
        this.#editors.delete(key);
        this.#composing.delete(key);
        this.#reported.delete(key);
      } else if (!this.#nodes.has(key)) semantics.push(this.#semantic(n, true));
    }
    this.#host.syncSemantics(semantics);
    if (changed || (this.#focused && !this.#eligible(this.#focused)) || (modal && !this.#focused)) {
      const target = restore.map((id) => this.#nodes.get(id)).find((n) => this.#eligible(n));
      this.#host.focus(
        this.#eligible(target)
          ? target.id
          : modal
            ? this.#controls().find((n) => (n.props.tabIndex ?? 0) >= 0)?.id
            : undefined,
      );
    }
    this.refreshPointer();
  }
  isPointerOverUI(point: SurfacePoint | ClientPoint) {
    return 'clientX' in point
      ? this.isSurfaceOccupied(point.clientX, point.clientY)
      : this.isSurfaceOccupied(point.x, point.y);
  }
  announce(text: string) {
    if (text !== this.#announced) {
      this.#announced = text;
      this.#host.announce(text);
    }
  }
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.cancelPointer();
      this.resetHover();
      this.#setFocus(undefined);
      this.#host.syncSemantics([...this.#nodes.values()].map((n) => this.#semantic(n, true)));
    }
  }
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.setEnabled(false);
    this.#unsubscribe();
    this.#host.syncSemantics([]);
    for (const n of this.#editors.values()) if (n.props.editor) n.props.editor.binding.current = null;
    this.#editors.clear();
    this.#nodes.clear();
    this.#returns.clear();
    this.#composing.clear();
    this.#reported.clear();
  }
}
