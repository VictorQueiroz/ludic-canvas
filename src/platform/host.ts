import type { Scheduler, Rgba } from './contracts.ts';
import type { NativeTextStyle } from '../text-input.tsx';
import type { HostEvent, HostPointerEvent, HostWheelEvent, PointerSurface } from './pointer.ts';

export interface SemanticNode {
  key: number;
  parent?: number;
  id?: string;
  role: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clip?: { x: number; y: number; w: number; h: number };
  opacity: number;
  disabled: boolean;
  hidden: boolean;
  tabIndex: number;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  valueMin?: number;
  valueMax?: number;
  valueNow?: number;
  valueText?: string;
  modal?: boolean;
  editor?: {
    value: string;
    multiline: boolean;
    placeholder?: string;
    readOnly?: boolean;
    maxLength?: number;
    type?: string;
    inputMode?: string;
    autoComplete?: string;
    spellCheck?: boolean;
    dir?: string;
    error?: string;
    textStyle?: NativeTextStyle;
    foreground?: Rgba;
  };
}

export interface HostKeyEvent extends HostEvent {
  key: string;
  code: string;
  repeat: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

export type PlatformEvent =
  | ({ type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' } & HostPointerEvent)
  | ({ type: 'wheel' } & HostWheelEvent)
  | ({ type: 'keydown' } & HostKeyEvent)
  | { type: 'leave' | 'blur' }
  | { type: 'activate' | 'focus'; key?: number }
  | { type: 'edit'; key: number; value: string; composing: boolean }
  | { type: 'compositionend'; key: number; value: string };

/** Native services are root-local. Implementations must keep editor instances stable by key. */
export interface PlatformHost extends PointerSurface {
  readonly scheduler: Scheduler;
  size(): { width: number; height: number; scale: number };
  subscribe(handler: (event: PlatformEvent) => void): () => void;
  syncSemantics(nodes: readonly SemanticNode[]): void;
  focus(key: number | undefined): boolean;
  selectEditor(key: number): boolean;
  announce(text: string): void;
  destroy(): void;
}

/** Test host with real event routing and inspectable semantic output; it does not render pixels. */
export function createHeadlessHost(initialSize: { width: number; height: number; scale?: number }) {
  let size = { ...initialSize, scale: initialSize.scale ?? 1 };
  let handler: ((event: PlatformEvent) => void) | undefined;
  let captured: number | undefined;
  let nextFrame = 0;
  const frames = new Map<number, (now: number) => void>();
  const host: PlatformHost & {
    semantics: readonly SemanticNode[];
    focused?: number;
    destroyed: boolean;
    announcements: string[];
    dispatch(event: PlatformEvent): void;
    activate(id: string): void;
    resize(width: number, height: number, scale?: number): void;
    tick(now: number): void;
  } = {
    semantics: [],
    destroyed: false,
    announcements: [],
    scheduler: {
      now: () => performance.now(),
      microtask: (callback) => queueMicrotask(callback),
      requestFrame(callback) {
        const id = ++nextFrame;
        frames.set(id, callback);
        return id;
      },
      cancelFrame: (id) => {
        frames.delete(id);
      },
    },
    size: () => size,
    resize(width, height, scale = size.scale) {
      size = { width, height, scale };
    },
    tick(now) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(now);
    },
    subscribe(callback) {
      if (handler || host.destroyed) throw new Error('Host is already owned or destroyed');
      handler = callback;
      return () => {
        handler = undefined;
      };
    },
    dispatch: (event) => handler?.(event),
    syncSemantics(nodes) {
      host.semantics = nodes;
    },
    focus(key) {
      host.focused = key;
      handler?.({ type: 'focus', key });
      return true;
    },
    focusSurface() {
      host.focus(undefined);
    },
    selectEditor(key) {
      return host.focus(key);
    },
    setCursor() {},
    capturePointer(id) {
      captured = id;
    },
    hasPointerCapture: (id) => captured === id,
    releasePointer(id) {
      if (captured === id) captured = undefined;
    },
    announce(text) {
      host.announcements.push(text);
    },
    activate(id) {
      const key = host.semantics.find((node) => node.id === id)?.key;
      if (key !== undefined) handler?.({ type: 'activate', key });
    },
    destroy() {
      handler = undefined;
      frames.clear();
      host.semantics = [];
      host.focused = undefined;
      host.destroyed = true;
      captured = undefined;
    },
  };
  return host;
}
