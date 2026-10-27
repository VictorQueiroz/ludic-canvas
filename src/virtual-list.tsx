import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ScrollAreaProps } from './controls.tsx';
import { useUIRoot } from './context.ts';
import { View } from './primitives.ts';
import { createScrollHandle, observeScrollFrames, hasPendingScroll, type ScrollHandle } from './scroll.ts';
import { fixedRange, offsetForIndex, type ScrollAlignment } from './virtual/range.ts';
import type { Interactive, UIKeyEvent, ViewStyle } from './runtime/types.ts';

export type VirtualItemKey = string | number;
export type { ScrollAlignment } from './virtual/range.ts';
/** An imperative collection handle; all operations use the owning root's application frames. */
export interface VirtualListHandle {
  readonly scroll: ScrollHandle;
  /** False before layout, after unmount or for an invalid index. */
  scrollToIndex(index: number, align?: ScrollAlignment): boolean;
  /** Scroll, mount and focus. Resolves after a frame, or false on cancellation/unavailable targets. */
  focusIndex(index: number): Promise<boolean>;
  focusKey(key: VirtualItemKey): Promise<boolean>;
}
export interface VirtualItemState {
  active: boolean;
  selected: boolean;
  disabled: boolean;
}
interface Controller {
  scrollToIndex(index: number, align?: ScrollAlignment): boolean;
  focusIndex(index: number): Promise<boolean>;
  focusKey(key: VirtualItemKey): Promise<boolean>;
}
interface Interaction {
  active?: string;
  pointer?: string;
  pending?: string;
}
interface CollectionStore {
  current?: Controller;
  snapshot: Interaction;
  subscribe(listener: () => void): () => void;
  getSnapshot(): Interaction;
  listeners: Set<() => void>;
  focused: boolean;
  pending?: { key: string; resolve: (focused: boolean) => void };
}
const controllers = new WeakMap<VirtualListHandle, CollectionStore>();
const keyString = (key: VirtualItemKey) => `${typeof key}:${key}`;
function publish(store: CollectionStore, next: Interaction) {
  if (
    store.snapshot.active === next.active &&
    store.snapshot.pointer === next.pointer &&
    store.snapshot.pending === next.pending
  )
    return;
  store.snapshot = Object.freeze(next);
  for (const listener of [...store.listeners]) listener();
}
function complete(store: CollectionStore, result: boolean) {
  const pending = store.pending;
  store.pending = undefined;
  publish(store, { ...store.snapshot, pending: undefined });
  pending?.resolve(result);
}
/** Create one independent handle per collection. Does not retain items or a root after unmount. */
export function createVirtualListHandle(): VirtualListHandle {
  const listeners = new Set<() => void>();
  const store: CollectionStore = {
    snapshot: Object.freeze({}),
    listeners,
    focused: false,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => store.snapshot,
  };
  const handle: VirtualListHandle = Object.freeze({
    scroll: createScrollHandle(),
    scrollToIndex: (index: number, align?: ScrollAlignment) => store.current?.scrollToIndex(index, align) ?? false,
    focusIndex: (index: number) => store.current?.focusIndex(index) ?? Promise.resolve(false),
    focusKey: (key: VirtualItemKey) => store.current?.focusKey(key) ?? Promise.resolve(false),
  });
  controllers.set(handle, store);
  return handle;
}
/** Fixed-height, single-select listbox. Row contents are visual; put independent controls outside options. */
export interface VirtualListProps<T> extends Omit<ScrollAreaProps, 'children' | 'scrollHandle'> {
  items: readonly T[];
  getItemKey(item: T, index: number): VirtualItemKey;
  getItemLabel(item: T, index: number): string;
  renderItem(item: T, index: number, state: VirtualItemState): ReactNode;
  itemHeight: number;
  gap?: number;
  /** Uniform inset in CSS pixels. Use this instead of style.padding. */
  contentPadding?: number;
  /** Extra rows on each side. Default: 2. Active, pending-focus and pointer targets may retain three additional rows. */
  overscan?: number;
  rowStyle?: ViewStyle | ((item: T, index: number, state: VirtualItemState) => ViewStyle);
  rowHoverStyle?: Interactive['hoverStyle'];
  rowPressStyle?: Interactive['pressStyle'];
  /** Application-owned selection; focus/navigation does not select automatically. */
  selectedKey?: VirtualItemKey;
  isItemDisabled?: (item: T, index: number) => boolean;
  onItemPress?: (item: T, index: number) => void;
  handle?: VirtualListHandle;
}
const zeroPadding = {
  padding: 0,
  paddingX: 0,
  paddingY: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  gap: 0,
  rowGap: 0,
  columnGap: 0,
} as const;

/** Render a bounded window with logical keyboard/gamepad navigation and stable-key focus. */
export function VirtualList<T>({
  items,
  getItemKey,
  getItemLabel,
  renderItem,
  itemHeight,
  gap = 0,
  contentPadding = 0,
  overscan = 2,
  rowStyle,
  rowHoverStyle,
  rowPressStyle,
  selectedKey,
  isItemDisabled,
  onItemPress,
  handle: suppliedHandle,
  style,
  ...props
}: VirtualListProps<T>) {
  const root = useUIRoot();
  const [ownedHandle] = useState(createVirtualListHandle);
  const handle = suppliedHandle ?? ownedHandle;
  const store = controllers.get(handle);
  if (!store) throw new Error('Use createVirtualListHandle() to create collection handles');
  const prefix = useId();
  const id = (key: string) => `${prefix}-${key}`;
  const metadata = useMemo(() => {
    const keys: string[] = [],
      indexes = new Map<string, number>(),
      enabled: number[] = [],
      enabledPositions = new Map<number, number>();
    for (let index = 0; index < items.length; index++) {
      const item = items[index]!,
        key = getItemKey(item, index);
      if ((typeof key !== 'string' && typeof key !== 'number') || (typeof key === 'number' && !Number.isFinite(key)))
        throw new Error('Item keys must be strings or finite numbers');
      const encoded = keyString(key);
      if (indexes.has(encoded)) throw new Error(`Duplicate virtual item key: ${key}`);
      keys.push(encoded);
      indexes.set(encoded, index);
      if (!props.disabled && !isItemDisabled?.(item, index)) {
        enabledPositions.set(index, enabled.length);
        enabled.push(index);
      }
    }
    return { keys, indexes, enabled, enabledPositions };
  }, [items, getItemKey, isItemDisabled, props.disabled]);
  const interaction = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const selection = selectedKey === undefined ? undefined : keyString(selectedKey);
  const data = { ...metadata, items, itemHeight, gap, padding: contentPadding, getItemLabel, selection };
  const committed = useRef(data);
  const activeIndex = interaction.active === undefined ? undefined : metadata.indexes.get(interaction.active);
  const initialIndex = selection === undefined ? undefined : metadata.indexes.get(selection);
  const tabIndex =
    activeIndex !== undefined && metadata.enabledPositions.has(activeIndex)
      ? activeIndex
      : initialIndex !== undefined && metadata.enabledPositions.has(initialIndex)
        ? initialIndex
        : metadata.enabled[0];
  const active = tabIndex === undefined ? undefined : metadata.keys[tabIndex];
  const getRange = useMemo(() => {
    let previous: (ReturnType<typeof fixedRange> & { hasViewport: boolean }) | undefined;
    return () => {
      const snapshot = handle.scroll.getSnapshot();
      const next = {
        ...fixedRange({
          count: items.length,
          itemHeight,
          gap,
          padding: contentPadding,
          viewport: snapshot.viewportHeight,
          offset: snapshot.offset,
          overscan,
        }),
        hasViewport: snapshot.viewportHeight > 0,
      };
      if (
        previous &&
        previous.start === next.start &&
        previous.end === next.end &&
        previous.totalHeight === next.totalHeight &&
        previous.hasViewport === next.hasViewport
      )
        return previous;
      return (previous = next);
    };
  }, [handle, items.length, itemHeight, gap, contentPadding, overscan]);
  const range = useSyncExternalStore(handle.scroll.subscribe, getRange);

  useLayoutEffect(() => {
    const previous = committed.current;
    committed.current = data;
    const state = handle.scroll.getSnapshot();
    if (store.pending) {
      const index = data.indexes.get(store.pending.key);
      if (index === undefined || !data.enabledPositions.has(index)) complete(store, false);
    }
    // Preserve a surviving viewport anchor across item and row-geometry changes.
    if (
      state.connected &&
      !store.pending &&
      !hasPendingScroll(handle.scroll) &&
      previous.keys.length &&
      ((previous.keys !== data.keys &&
        (previous.keys.length !== data.keys.length || previous.keys.some((key, index) => key !== data.keys[index]))) ||
        previous.itemHeight !== itemHeight ||
        previous.gap !== gap ||
        previous.padding !== contentPadding)
    ) {
      const oldIndex = Math.max(
        0,
        Math.min(
          previous.keys.length - 1,
          Math.floor((state.offset - previous.padding) / (previous.itemHeight + previous.gap)),
        ),
      );
      const anchor = [previous.keys[oldIndex], previous.keys[oldIndex + 1], previous.keys[oldIndex - 1]].find(
        (key) => key !== undefined && data.indexes.has(key),
      );
      if (anchor !== undefined) {
        const oldAnchor = previous.indexes.get(anchor)!,
          newAnchor = data.indexes.get(anchor)!;
        const within = state.offset - previous.padding - oldAnchor * (previous.itemHeight + previous.gap);
        handle.scroll.scrollTo(contentPadding + newAnchor * (itemHeight + gap) + Math.min(within, itemHeight + gap));
      }
    }
    let next = store.snapshot.active;
    const oldIndex = next === undefined ? undefined : previous.indexes.get(next);
    const newIndex = next === undefined ? undefined : data.indexes.get(next);
    const unavailable = next !== undefined && (newIndex === undefined || !data.enabledPositions.has(newIndex));
    if (next === undefined || unavailable) {
      const selected = selection === undefined ? undefined : data.indexes.get(selection);
      const replacement =
        !unavailable && selected !== undefined && data.enabledPositions.has(selected)
          ? selected
          : (data.enabled.find((index) => index >= (oldIndex ?? 0)) ?? data.enabled.at(-1));
      next = replacement === undefined ? undefined : data.keys[replacement];
      publish(store, { ...store.snapshot, active: next });
      if (unavailable && store.focused && next !== undefined && !store.pending) {
        store.pending = { key: next, resolve: () => {} };
        publish(store, { ...store.snapshot, pending: next });
      }
    }
    if (store.pending) {
      const index = data.indexes.get(store.pending.key);
      if (index === undefined || !data.enabledPositions.has(index)) complete(store, false);
      else store.current?.scrollToIndex(index);
    }
    const pointerIndex = store.snapshot.pointer === undefined ? undefined : data.indexes.get(store.snapshot.pointer);
    if (store.snapshot.pointer && (pointerIndex === undefined || !data.enabledPositions.has(pointerIndex)))
      publish(store, { ...store.snapshot, pointer: undefined });
  });

  useLayoutEffect(() => {
    if (store.current) throw new Error('A collection handle can attach to only one VirtualList at a time');
    const current: Controller = {
      scrollToIndex(index, align) {
        const state = handle.scroll.getSnapshot(),
          data = committed.current;
        if (
          !state.connected ||
          state.viewportHeight <= 0 ||
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= data.items.length
        )
          return false;
        handle.scroll.scrollTo(
          offsetForIndex({
            count: data.items.length,
            itemHeight: data.itemHeight,
            gap: data.gap,
            padding: data.padding,
            viewport: state.viewportHeight,
            offset: state.offset,
            index,
            align,
          }),
        );
        return true;
      },
      focusIndex(index) {
        const data = committed.current;
        if (!data.enabledPositions.has(index) || !current.scrollToIndex(index)) return Promise.resolve(false);
        complete(store, false);
        const key = data.keys[index]!;
        const promise = new Promise<boolean>((resolve) => {
          store.pending = { key, resolve };
        });
        publish(store, { ...store.snapshot, pending: key });
        return promise;
      },
      focusKey(key) {
        const index = committed.current.indexes.get(keyString(key));
        return index === undefined ? Promise.resolve(false) : current.focusIndex(index);
      },
    };
    store.current = current;
    const stop = observeScrollFrames(handle.scroll, () => {
      if (!store.pending) return;
      const index = committed.current.indexes.get(store.pending.key);
      complete(
        store,
        index !== undefined &&
          committed.current.enabledPositions.has(index) &&
          root.focus(`${prefix}-${store.pending.key}`),
      );
    });
    return () => {
      stop();
      complete(store, false);
      store.focused = false;
      if (store.current === current) store.current = undefined;
      publish(store, {});
    };
  }, [store, handle, root, prefix]);

  const move = (from: number, delta: number) => {
    const position = metadata.enabledPositions.get(from);
    if (position === undefined) return false;
    const target = metadata.enabled[Math.max(0, Math.min(metadata.enabled.length - 1, position + delta))];
    if (target === undefined || target === from) return false;
    void handle.focusIndex(target);
    return true;
  };
  const typing = useRef({ text: '', at: 0 });
  const keyboard = (event: UIKeyEvent, index: number) => {
    const page = Math.max(1, Math.floor(handle.scroll.getSnapshot().viewportHeight / (itemHeight + gap)));
    const delta =
      event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowUp'
          ? -1
          : event.key === 'PageDown'
            ? page
            : event.key === 'PageUp'
              ? -page
              : undefined;
    if (delta !== undefined || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      if (delta !== undefined) move(index, delta);
      else {
        const target = event.key === 'Home' ? metadata.enabled[0] : metadata.enabled.at(-1);
        if (target !== undefined) void handle.focusIndex(target);
      }
    } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now(),
        character = event.key.normalize('NFKC').toLocaleLowerCase();
      typing.current.text = now - typing.current.at < 600 ? (typing.current.text + character).slice(-64) : character;
      typing.current.at = now;
      const query = [...typing.current.text].every((letter) => letter === character) ? character : typing.current.text;
      const position = metadata.enabledPositions.get(index) ?? -1;
      for (let step = 1; step <= metadata.enabled.length; step++) {
        const next = metadata.enabled[(position + step) % metadata.enabled.length]!;
        if (getItemLabel(items[next]!, next).normalize('NFKC').toLocaleLowerCase().startsWith(query)) {
          event.preventDefault();
          event.stopPropagation();
          void handle.focusIndex(next);
          break;
        }
      }
    }
  };
  const indices = new Set<number>();
  for (let index = range.start; index < range.end; index++) indices.add(index);
  for (const key of range.hasViewport ? [active, interaction.pointer, interaction.pending] : []) {
    const index = key === undefined ? undefined : metadata.indexes.get(key);
    if (index !== undefined) indices.add(index);
  }
  const rows = [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const item = items[index]!,
        key = metadata.keys[index]!,
        label = getItemLabel(item, index);
      if (typeof label !== 'string' || !label.trim())
        throw new Error('Virtual items require nonempty accessible labels');
      const state: VirtualItemState = {
        active: key === active,
        selected: key === selection,
        disabled: !metadata.enabledPositions.has(index),
      };
      return (
        <View
          key={key}
          id={id(key)}
          focusable
          role="option"
          label={label}
          selected={state.selected}
          disabled={state.disabled}
          tabIndex={state.active ? 0 : -1}
          positionInSet={index + 1}
          setSize={items.length}
          hoverStyle={rowHoverStyle}
          pressStyle={rowPressStyle}
          onFocus={() => {
            store.focused = true;
            publish(store, { ...store.snapshot, active: key });
          }}
          onBlur={() => {
            store.focused = false;
          }}
          onNavigate={(direction) =>
            direction === 'up' ? move(index, -1) : direction === 'down' ? move(index, 1) : false
          }
          onKeyDown={(event) => keyboard(event, index)}
          onPointerDown={() => {
            publish(store, { ...store.snapshot, pointer: key });
            root.focus(id(key));
          }}
          onPointerUp={() => publish(store, { ...store.snapshot, pointer: undefined })}
          onPointerCancel={() => publish(store, { ...store.snapshot, pointer: undefined })}
          onPress={() => {
            root.focus(id(key));
            onItemPress?.(item, index);
          }}
          style={{
            ...(typeof rowStyle === 'function' ? rowStyle(item, index, state) : rowStyle),
            position: 'absolute',
            left: contentPadding,
            right: contentPadding,
            top: contentPadding + index * (itemHeight + gap),
            height: itemHeight,
            minHeight: itemHeight,
            maxHeight: itemHeight,
            width: undefined,
            minWidth: 0,
            maxWidth: undefined,
            margin: 0,
            marginX: 0,
            marginY: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            flexShrink: 0,
          }}
        >
          {renderItem(item, index, state)}
        </View>
      );
    });
  return (
    <View
      {...props}
      role="listbox"
      orientation="vertical"
      scrollHandle={handle.scroll}
      style={{ ...style, ...zeroPadding, flexDirection: 'column', overflow: 'scroll' }}
    >
      <View style={{ height: range.totalHeight, width: '100%', flexShrink: 0 }}>{rows}</View>
    </View>
  );
}
