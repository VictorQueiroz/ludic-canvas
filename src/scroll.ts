import type { HostNode } from './runtime/nodes.ts';

/** Latest laid-out vertical scroll state, in local CSS pixels (before visual transforms). */
export interface ScrollSnapshot {
  readonly connected: boolean;
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
  node?: HostNode;
  pending?: number;
}
const stores = new WeakMap<ScrollHandle, Store>();
const empty = (): ScrollSnapshot =>
  Object.freeze({ connected: false, offset: 0, viewportWidth: 0, viewportHeight: 0, contentHeight: 0, maxOffset: 0 });
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('Scroll offset must be finite');
};

/** Create an independent scroll store. No active-root singleton or browser listeners. */
export function createScrollHandle(): ScrollHandle {
  const state: Store = { snapshot: empty(), listeners: new Set() };
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
export function updateScroll(node: HostNode) {
  if (node.props.style?.overflow !== 'scroll') return;
  let bottom = 0;
  for (const child of node.children) if ('box' in child) bottom = Math.max(bottom, child.box.y + child.box.h);
  node.contentHeight = Math.max(0, bottom + node.ctx.layout.paddingBottom(node.yoga));
  const maxOffset = Math.max(0, node.contentHeight - node.box.h);
  const handle = node.props.scrollHandle;
  const state = handle ? stores.get(handle) : undefined;
  if (handle && !state) throw new Error('Use createScrollHandle() to create scroll handles');
  if (state) {
    if (state.node && state.node !== node)
      throw new Error('A scroll handle can attach to only one ScrollArea at a time');
    state.node = node;
    if (state.pending !== undefined) {
      node.scrollY = state.pending;
      state.pending = undefined;
    }
  }
  node.scrollY = Math.max(0, Math.min(node.scrollY, maxOffset));
  const prev = node.scrollSnapshot;
  if (
    prev &&
    prev.offset === node.scrollY &&
    prev.viewportWidth === node.box.w &&
    prev.viewportHeight === node.box.h &&
    prev.contentHeight === node.contentHeight
  ) {
    if (state && state.snapshot !== prev) {
      state.snapshot = prev;
      emit(state, node);
    }
    return;
  }
  const snapshot: ScrollSnapshot = Object.freeze({
    connected: true,
    offset: node.scrollY,
    viewportWidth: node.box.w,
    viewportHeight: node.box.h,
    contentHeight: node.contentHeight,
    maxOffset,
  });
  node.scrollSnapshot = snapshot;
  if (state) {
    state.snapshot = snapshot;
    emit(state, node);
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
