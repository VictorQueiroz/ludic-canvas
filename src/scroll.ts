import type { HostNode } from './runtime/nodes.ts';

/** auto uses browser-native scrolling where supported, with canvas fallback. */
export type ScrollMode = 'auto' | 'canvas' | 'native';

/** @internal A root-owned presentation binding. No browser globals cross this contract. */
export interface ScrollDriver {
  setExtent(contentHeight: number, viewportHeight: number): void;
  getOffset(): number;
  setOffset(offset: number): void;
}

const nativeCallbacks = new WeakSet<object>();
/** @internal Collection bookkeeping does not claim the native pan gesture. */
export function nativeScrollCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  nativeCallbacks.add(callback);
  return callback;
}
/** @internal */
export const isNativeScrollCallback = (callback: unknown) =>
  typeof callback === 'function' && nativeCallbacks.has(callback);

/** Latest laid-out vertical scroll state, in local CSS pixels (before visual transforms). */
export interface ScrollSnapshot {
  readonly connected: boolean;
  readonly mode: 'canvas' | 'native';
  readonly offset: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly contentHeight: number;
  readonly maxOffset: number;
}

/** Attach to one ScrollArea at a time. Commands take effect in the next application frame. */
export interface ScrollHandle {
  getSnapshot(): ScrollSnapshot;
  /** Synchronous store subscription. Return value removes the listener. */
  subscribe(listener: () => void): () => void;
  /** Finite offset; clamped to the laid-out extent. May be queued before mounting. */
  scrollTo(offset: number): void;
  scrollBy(delta: number): void;
}
interface Store {
  snapshot: ScrollSnapshot;
  listeners: Set<() => void>;
  frameListeners: Set<() => void>;
  node?: HostNode;
  pending?: number;
}
const stores = new WeakMap<ScrollHandle, Store>();
const empty = (): ScrollSnapshot =>
  Object.freeze({
    connected: false,
    mode: 'canvas',
    offset: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    contentHeight: 0,
    maxOffset: 0,
  });
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('Scroll offset must be finite');
};

/** Create an independent scroll store. No active-root singleton or browser listeners. */
export function createScrollHandle(): ScrollHandle {
  const state: Store = { snapshot: empty(), listeners: new Set(), frameListeners: new Set() };
  const handle: ScrollHandle = Object.freeze({
    getSnapshot: () => state.snapshot,
    subscribe(listener: () => void) {
      state.listeners.add(listener);
      return () => {
        state.listeners.delete(listener);
      };
    },
    scrollTo(offset: number) {
      finite(offset);
      state.pending = offset;
    },
    scrollBy(delta: number) {
      finite(delta);
      const offset = (state.pending ?? state.node?.scrollY ?? state.snapshot.offset) + delta;
      finite(offset);
      state.pending = offset;
    },
  });
  stores.set(handle, state);
  return handle;
}
function emit(state: Store, node: HostNode) {
  for (const listener of [...state.listeners]) {
    try {
      listener();
    } catch (error) {
      if (node.ctx.onError) node.ctx.onError(error);
      else console.error(error);
    }
  }
}
/** @internal Publish after layout, before paint. */
export function prepareScroll(node: HostNode) {
  if (node.props.style?.overflow !== 'scroll') return;
  if (node.props.scrollMode !== undefined && !['auto', 'canvas', 'native'].includes(node.props.scrollMode))
    throw new Error('Unknown scrollMode');
  if (node.props.scrollMode === 'native' && !node.ctx.nativeScrollSupported)
    throw new Error('Native scrolling requires a supported browser root');
  let bottom = 0;
  for (const child of node.children) if ('box' in child) bottom = Math.max(bottom, child.box.y + child.box.h);
  node.contentHeight = Math.max(0, bottom + node.ctx.layout.paddingBottom(node.yoga));
  const maxOffset = Math.max(0, node.contentHeight - node.box.h);
  // Update the browser's range before commands/anchors, so it cannot clamp to an old extent.
  node.scrollDriver?.setExtent(node.contentHeight, node.box.h);
  const handle = node.props.scrollHandle;
  const state = handle ? stores.get(handle) : undefined;
  if (handle && !state) throw new Error('Use createScrollHandle() to create scroll handles');
  if (state) {
    if (state.node && state.node !== node)
      throw new Error('A scroll handle can attach to only one ScrollArea at a time');
    state.node = node;
    if (state.pending !== undefined) {
      setScrollPosition(node, state.pending);
      state.pending = undefined;
    }
  }
  if (node.scrollDriver) node.scrollY = node.scrollDriver.getOffset();
  node.scrollY = Math.max(0, Math.min(node.scrollY, maxOffset));
}

/** @internal Commands/focus share one writer; gestures are read without echoing scrollTop. */
export function setScrollPosition(node: HostNode, offset: number) {
  node.scrollY = Math.max(0, Math.min(offset, Math.max(0, node.contentHeight - node.box.h)));
  node.scrollDriver?.setOffset(node.scrollY);
}

/** @internal Raster overscan belongs to the owning root, not application list state. */
export function getScrollRenderRange(handle: ScrollHandle) {
  return stores.get(handle)?.node?.scrollRenderRange;
}

/** @internal Publish after layout and presentation synchronization, before paint. */
export function updateScroll(node: HostNode, notifications?: (() => void)[], prepared = false) {
  if (node.props.style?.overflow !== 'scroll') return;
  if (!prepared) prepareScroll(node);
  const maxOffset = Math.max(0, node.contentHeight - node.box.h);
  const state = node.props.scrollHandle ? stores.get(node.props.scrollHandle) : undefined;
  const mode = node.scrollDriver ? 'native' : 'canvas';
  const range = node.scrollRenderRange;
  const previousRange = node.scrollPublishedRange;
  const prev = node.scrollSnapshot;
  if (
    prev &&
    prev.mode === mode &&
    previousRange?.start === range?.start &&
    previousRange?.end === range?.end &&
    prev.offset === node.scrollY &&
    prev.viewportWidth === node.box.w &&
    prev.viewportHeight === node.box.h &&
    prev.contentHeight === node.contentHeight
  ) {
    if (state && state.snapshot !== prev) {
      state.snapshot = prev;
      if (notifications && state.listeners.size) notifications.push(() => emit(state, node));
      else emit(state, node);
    }
    return;
  }
  const snapshot: ScrollSnapshot = Object.freeze({
    connected: true,
    mode,
    offset: node.scrollY,
    viewportWidth: node.box.w,
    viewportHeight: node.box.h,
    contentHeight: node.contentHeight,
    maxOffset,
  });
  node.scrollSnapshot = snapshot;
  node.scrollPublishedRange = range;
  if (state) {
    state.snapshot = snapshot;
    if (notifications && state.listeners.size) notifications.push(() => emit(state, node));
    else emit(state, node);
  }
  if (node.props.onScroll && !node.scrollEventQueued) {
    node.scrollEventQueued = true;
    queueMicrotask(() => {
      node.scrollEventQueued = false;
      if (node.destroyed) return;
      try {
        node.props.onScroll?.(node.scrollSnapshot!);
      } catch (error) {
        if (node.ctx.onError) node.ctx.onError(error);
        else console.error(error);
      }
    });
  }
}
/** @internal Release ownership without retaining the host node in application handles. */
export function detachScroll(handle: ScrollHandle | undefined, node: HostNode) {
  const state = handle && stores.get(handle);
  if (!state || state.node !== node) return;
  state.node = undefined;
  state.pending = undefined;
  state.snapshot = empty();
  emit(state, node);
}

/** @internal Collection focus settles after painted geometry and mirrors exist. */
export function observeScrollFrames(handle: ScrollHandle, listener: () => void): () => void {
  const state = stores.get(handle)!;
  state.frameListeners.add(listener);
  return () => {
    state.frameListeners.delete(listener);
  };
}
/** @internal Explicit application commands take precedence over collection anchoring. */
export function hasPendingScroll(handle: ScrollHandle): boolean {
  return stores.get(handle)?.pending !== undefined;
}
/** @internal Called only by the owning application's frame; never starts a loop. */
export function finishScrollFrame(node: HostNode) {
  const state = node.props.scrollHandle && stores.get(node.props.scrollHandle);
  if (state?.node === node)
    for (const listener of [...state.frameListeners]) {
      try {
        listener();
      } catch (error) {
        if (node.ctx.onError) node.ctx.onError(error);
        else console.error(error);
      }
    }
}
