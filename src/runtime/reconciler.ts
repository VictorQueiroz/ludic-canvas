// A React 19 custom renderer: React components → host nodes backed by Yoga,
// painted by WebGL. Mutation mode, no hydration, no portals to the DOM.

import { createContext, type ReactNode } from 'react';
import Reconciler from 'react-reconciler';
import { ConcurrentRoot, DefaultEventPriority, NoEventPriority } from 'react-reconciler/constants.js';
import { HostNode, TextInstance, type RuntimeContext } from './nodes.ts';
import type { AnyProps, HostType } from './types.ts';

interface Container {
  root: HostNode;
  ctx: RuntimeContext;
}

let currentPriority: number = NoEventPriority;

const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  rendererVersion: '0.1.0',
  rendererPackageName: 'ludic-canvas',
  extraDevToolsConfig: null,

  createInstance(type: HostType, props: AnyProps, container: Container): HostNode {
    if (!['view', 'text', 'image', 'line'].includes(type))
      throw new Error(`Unsupported canvas host type: ${type}. Use View, Text, Image or Line.`);
    return new HostNode(type, props, container.ctx);
  },
  createTextInstance(text: string): TextInstance {
    return new TextInstance(text);
  },
  appendInitialChild(parent: HostNode, child: HostNode | TextInstance) {
    parent.append(child);
  },
  finalizeInitialChildren: () => false,
  shouldSetTextContent(type: HostType, props: AnyProps) {
    return type === 'text' && (typeof props.children === 'string' || typeof props.children === 'number');
  },
  getRootHostContext: () => ({}),
  getChildHostContext: (parent: object) => parent,
  getPublicInstance: (instance: HostNode) => instance,
  prepareForCommit: () => null,
  resetAfterCommit(container: Container) {
    container.ctx.invalidate();
  },
  preparePortalMount() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
  detachDeletedInstance(node: HostNode) {
    node.destroy();
  },

  // ── Mutation ───────────────────────────────────────────────────────────────
  appendChild(parent: HostNode, child: HostNode | TextInstance) {
    parent.append(child);
  },
  appendChildToContainer(container: Container, child: HostNode) {
    container.root.append(child);
  },
  insertBefore(parent: HostNode, child: HostNode | TextInstance, before: HostNode | TextInstance) {
    parent.insert(child, before);
  },
  insertInContainerBefore(container: Container, child: HostNode, before: HostNode) {
    container.root.insert(child, before);
  },
  removeChild(parent: HostNode, child: HostNode | TextInstance) {
    parent.remove(child);
  },
  removeChildFromContainer(container: Container, child: HostNode) {
    container.root.remove(child);
  },
  resetTextContent() {},
  commitTextUpdate(text: TextInstance, _old: string, next: string) {
    text.setText(next);
  },
  commitMount() {},
  commitUpdate(node: HostNode, _type: HostType, _prev: AnyProps, next: AnyProps) {
    node.update(next);
  },
  hideInstance(node: HostNode) {
    node.hidden = true;
  },
  unhideInstance(node: HostNode) {
    node.hidden = false;
  },
  hideTextInstance(text: TextInstance) {
    text.setText('');
  },
  unhideTextInstance(text: TextInstance, value: string) {
    text.setText(value);
  },
  clearContainer(container: Container) {
    for (const child of [...container.root.children]) container.root.remove(child);
  },

  // ── React 19 scheduling & transitions ─────────────────────────────────────
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  setCurrentUpdatePriority(priority: number) {
    currentPriority = priority;
  },
  getCurrentUpdatePriority: () => currentPriority,
  resolveUpdatePriority: () => (currentPriority !== NoEventPriority ? currentPriority : DefaultEventPriority),
  resetFormInstance() {},
  requestPostPaintCallback(callback: (time: number) => void) {
    const frame = (globalThis as { requestAnimationFrame?: (fn: (time: number) => void) => unknown })
      .requestAnimationFrame;
    if (frame) frame(callback);
    else setTimeout(() => callback(performance.now()), 16);
  },
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  maySuspendCommit: () => false,
  maySuspendCommitOnUpdate: () => false,
  maySuspendCommitInSyncRender: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  suspendOnActiveViewTransition() {},
  waitForCommitToBeReady: () => null,
  getSuspendedCommitReason: () => null,
  bindToConsole(methodName: string, args: unknown[]) {
    const method = (console as unknown as Record<string, (...a: unknown[]) => void>)[methodName]!;
    return method.bind(console, ...args);
  },
};

// The typings model every host-config generic; ours are concrete, so cast once here.
const reconciler = Reconciler(hostConfig as unknown as Parameters<typeof Reconciler>[0]);

export interface UiRoot {
  readonly root: HostNode;
  render(element: ReactNode): void;
  flushSync(callback: () => void): void;
  destroy(): void;
}

export function createUiRoot(ctx: RuntimeContext): UiRoot {
  const root = new HostNode('view', { style: { width: '100%', height: '100%' } }, ctx);
  const container: Container = { root, ctx };
  const fiberRoot = reconciler.createContainer(
    container,
    ConcurrentRoot,
    null,
    false,
    null,
    'lc',
    (error) => {
      if (ctx.onError) ctx.onError(error);
      else console.error('Uncaught UI error', error);
    },
    (error) => {
      if (ctx.onError) ctx.onError(error);
      else console.error('Caught UI error', error);
    },
    (error) => {
      if (ctx.onError) ctx.onError(error);
      else console.warn('Recoverable UI error', error);
    },
    () => {},
    null,
  );
  return {
    root,
    flushSync(callback) {
      reconciler.flushSyncFromReconciler(callback);
    },
    destroy() {
      reconciler.updateContainerSync(null, fiberRoot, null, null);
      reconciler.flushSyncWork();
      reconciler.flushPassiveEffects();
      root.destroy();
    },
    render(element: ReactNode) {
      reconciler.updateContainer(element, fiberRoot, null, null);
    },
  };
}
