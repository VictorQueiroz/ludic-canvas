import type { RefObject } from 'react';
import type { TextInputHandle, TextInputProps } from '../text-input.tsx';
import type { HostNode } from './nodes.ts';

/** @internal Native state is owned by a root, never by a global active editor. */
export interface EditorProps extends Pick<
  TextInputProps,
  | 'value'
  | 'onValueChange'
  | 'placeholder'
  | 'readOnly'
  | 'maxLength'
  | 'type'
  | 'inputMode'
  | 'autoComplete'
  | 'spellCheck'
  | 'dir'
  | 'error'
  | 'onSubmit'
  | 'textStyle'
> {
  multiline: boolean;
  binding: RefObject<TextInputHandle | null>;
}

export type EditorElement = HTMLInputElement | HTMLTextAreaElement;
interface Entry {
  element: EditorElement;
  description: HTMLSpanElement;
  events: AbortController;
  composing: boolean;
  propValue: string;
  reported: string;
  pendingReset?: string;
  binding: EditorProps['binding'];
  eligible: boolean;
}

const hiddenDescription =
  'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

/** @internal Persistent DOM editors. Geometry is updated from the last painted frame. */
export class EditorManager {
  readonly #entries = new Map<HostNode, Entry>();
  readonly #prefix = `ludic-editor-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
  readonly container: HTMLElement;
  readonly commit: (callback: () => void) => void;
  readonly focusChanged: (node: HostNode, focused: boolean) => void;
  readonly activity: () => void;
  constructor(
    container: HTMLElement,
    commit: (callback: () => void) => void,
    focusChanged: (node: HostNode, focused: boolean) => void,
    activity: () => void,
  ) {
    this.container = container;
    this.commit = commit;
    this.focusChanged = focusChanged;
    this.activity = activity;
  }

  isComposing(node: HostNode) {
    return this.#entries.get(node)?.composing ?? false;
  }
  value(node: HostNode) {
    return this.#entries.get(node)?.element.value ?? node.props.editor?.value ?? '';
  }

  #write(entry: Entry, value: string) {
    const el = entry.element;
    if (el.value === value) return; // Preserve native selection, scroll and undo for prop echoes.
    const start = el.selectionStart,
      end = el.selectionEnd,
      direction = el.selectionDirection;
    el.value = value;
    if (document.activeElement === el && start !== null && end !== null)
      el.setSelectionRange(Math.min(start, value.length), Math.min(end, value.length), direction ?? undefined);
  }

  #reconcile(node: HostNode, entry: Entry) {
    const props = node.props.editor;
    if (!props || node.destroyed) return;
    if (entry.composing) {
      if (props.value !== entry.propValue && props.value !== entry.element.value) entry.pendingReset = props.value;
    } else {
      this.#write(entry, props.value);
      entry.reported = entry.element.value;
    }
    entry.propValue = props.value;
  }

  #input(node: HostNode, entry: Entry) {
    if (!entry.eligible || node.destroyed || node.props.disabled || node.props.editor?.readOnly) return;
    if (entry.composing) this.#reconcile(node, entry);
    const value = entry.element.value;
    // An external reset during composition wins at compositionend. Do not echo later drafts over it.
    if (entry.pendingReset === undefined && value !== entry.reported) {
      entry.reported = value;
      this.commit(() => node.props.editor?.onValueChange(value));
    }
    if (node.destroyed) return;
    this.#reconcile(node, entry);
    if (!entry.composing) entry.reported = entry.element.value;
  }

  #create(node: HostNode): Entry {
    const props = node.props.editor!;
    const element = document.createElement(props.multiline ? 'textarea' : 'input');
    const description = document.createElement('span');
    description.id = `${this.#prefix}-${node.id}-error`;
    description.style.cssText = hiddenDescription;
    description.hidden = true;
    this.container.appendChild(description);
    const entry: Entry = {
      element,
      description,
      events: new AbortController(),
      composing: false,
      propValue: props.value,
      reported: props.value,
      binding: props.binding,
      eligible: false,
    };
    element.value = props.value;
    element.dataset.ludicEditor = props.multiline ? 'textarea' : 'input';
    const options = { signal: entry.events.signal };
    element.addEventListener(
      'input',
      () => {
        this.activity();
        this.#input(node, entry);
      },
      options,
    );
    element.addEventListener(
      'compositionstart',
      () => {
        entry.composing = true;
      },
      options,
    );
    element.addEventListener(
      'compositionend',
      () => {
        this.#reconcile(node, entry);
        entry.composing = false;
        if (entry.pendingReset !== undefined) {
          this.#write(entry, entry.pendingReset);
          entry.reported = entry.pendingReset;
          entry.pendingReset = undefined;
          this.#reconcile(node, entry);
        } else this.#input(node, entry);
      },
      options,
    );
    element.addEventListener('focus', () => this.focusChanged(node, true), options);
    element.addEventListener('blur', () => this.focusChanged(node, false), options);
    element.addEventListener('pointerdown', () => this.activity(), options);
    this.#entries.set(node, entry);
    node.releaseEditor = () => this.remove(node);
    return entry;
  }

  sync(node: HostNode, eligible: boolean, visible: boolean): EditorElement {
    const entry = this.#entries.get(node) ?? this.#create(node);
    const props = node.props.editor!;
    const el = entry.element;
    entry.eligible = eligible;
    if (entry.binding !== props.binding) entry.binding.current = null;
    entry.binding = props.binding;
    if (!entry.binding.current) {
      const focus = () => {
        if (!entry.eligible || node.destroyed || node.props.disabled || !el.isConnected) return false;
        el.focus({ preventScroll: true });
        return document.activeElement === el;
      };
      entry.binding.current = {
        focus,
        blur: () => el.blur(),
        select: () => {
          if (!focus()) return false;
          el.select();
          return true;
        },
      };
    }
    if (el instanceof HTMLInputElement && el.type !== (props.type ?? 'text')) el.type = props.type ?? 'text';
    el.disabled = !eligible;
    el.readOnly = Boolean(props.readOnly);
    el.placeholder = props.placeholder ?? '';
    el.inputMode = props.inputMode ?? 'text';
    el.setAttribute('autocomplete', props.autoComplete ?? 'off');
    el.spellcheck = props.spellCheck ?? false;
    el.dir = props.dir ?? 'auto';
    el.tabIndex = node.props.tabIndex ?? 0;
    el.setAttribute('aria-label', node.props.label!);
    el.setAttribute('aria-hidden', String(!visible));
    if (props.maxLength === undefined) el.removeAttribute('maxlength');
    else el.maxLength = props.maxLength;
    entry.description.textContent = props.error ?? '';
    if (props.error) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', entry.description.id);
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
    this.#reconcile(node, entry);
    const a = node.abs,
      c = node.clip,
      scale = a.w / node.box.w || 1;
    const text = props.textStyle ?? {},
      textScale = node.ctx.textScale;
    const inset = c
      ? [
          Math.max(0, c.y - a.y),
          Math.max(0, a.x + a.w - c.x - c.w),
          Math.max(0, a.y + a.h - c.y - c.h),
          Math.max(0, c.x - a.x),
        ].map((v) => v / scale)
      : [0, 0, 0, 0];
    const css =
      `position:absolute;box-sizing:border-box;pointer-events:auto;appearance:none;outline:none;resize:none;` +
      `margin:0;border:0;background:transparent;box-shadow:none;min-width:0;min-height:0;max-width:none;max-height:none;` +
      `left:${a.x}px;top:${a.y}px;width:${node.box.w}px;height:${node.box.h}px;transform-origin:0 0;transform:scale(${scale});` +
      `opacity:${node.paintedOpacity};visibility:${visible ? 'visible' : 'hidden'};clip-path:inset(${inset.map((v) => `${v}px`).join(' ')});` +
      `font-family:${text.fontFamily ?? 'system-ui, sans-serif'};font-size:${(text.fontSize ?? 16) * textScale}px;` +
      `font-weight:400;line-height:${text.lineHeight ?? 1.4};letter-spacing:${(text.letterSpacing ?? 0) * textScale}px;` +
      `color:${text.color ?? '#edf2ff'};text-align:${text.textAlign ?? 'left'};padding:${text.padding ?? 10}px;` +
      `text-transform:none;touch-action:auto;white-space:${props.multiline ? 'pre-wrap' : 'pre'};`;
    if (el.dataset.box !== css) {
      el.dataset.box = css;
      el.style.cssText = css;
    }
    return el;
  }

  retain(live: Set<HostNode>) {
    for (const [node, entry] of this.#entries)
      if (!live.has(node)) {
        if (node.destroyed || !node.props.editor) this.remove(node);
        else this.#hide(node, entry);
      }
  }
  #hide(node: HostNode, entry: Entry) {
    entry.eligible = false;
    entry.element.blur();
    if (node.destroyed) return;
    entry.composing = false;
    entry.pendingReset = undefined;
    this.#reconcile(node, entry);
    entry.element.disabled = true;
    entry.element.setAttribute('aria-hidden', 'true');
    entry.element.style.visibility = 'hidden';
    delete entry.element.dataset.box;
  }
  suspend() {
    for (const [node, entry] of this.#entries) this.#hide(node, entry);
  }
  remove(node: HostNode) {
    const entry = this.#entries.get(node);
    if (!entry) return;
    entry.eligible = false;
    entry.events.abort();
    entry.binding.current = null;
    entry.element.remove();
    entry.description.remove();
    this.#entries.delete(node);
    node.releaseEditor = undefined;
    node.focused = false;
  }
  destroy() {
    for (const node of this.#entries.keys()) this.remove(node);
  }
}
