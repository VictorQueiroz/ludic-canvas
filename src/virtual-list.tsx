import { useId, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ScrollArea, type ScrollAreaProps } from './controls.tsx';
import { View } from './primitives.ts';
import { createScrollHandle, type ScrollHandle } from './scroll.ts';
import { fixedRange, offsetForIndex, type ScrollAlignment } from './virtual/range.ts';
import type { ViewStyle } from './runtime/types.ts';

export type VirtualItemKey = string | number;
export type { ScrollAlignment } from './virtual/range.ts';
/** An imperative collection handle; scrolling uses the owning root's next frame. */
export interface VirtualListHandle {
  readonly scroll: ScrollHandle;
  /** False before mount, after unmount or for an invalid index. */
  scrollToIndex(index: number, align?: ScrollAlignment): boolean;
}
interface Controller {
  scrollToIndex(index: number, align?: ScrollAlignment): boolean;
}
const controllers = new WeakMap<VirtualListHandle, { current?: Controller }>();
/** Create one independent handle per collection. */
export function createVirtualListHandle(): VirtualListHandle {
  const state: { current?: Controller } = {};
  const handle: VirtualListHandle = Object.freeze({
    scroll: createScrollHandle(),
    scrollToIndex: (index: number, align?: ScrollAlignment) => state.current?.scrollToIndex(index, align) ?? false,
  });
  controllers.set(handle, state);
  return handle;
}
/** Fixed-height vertical collection. Supply stable item keys and keep persistent item state outside rows. */
export interface VirtualListProps<T> extends Omit<ScrollAreaProps, 'children' | 'scrollHandle'> {
  items: readonly T[];
  getItemKey(item: T, index: number): VirtualItemKey;
  getItemLabel(item: T, index: number): string;
  renderItem(item: T, index: number): ReactNode;
  itemHeight: number;
  gap?: number;
  /** Uniform inset for the collection, in CSS pixels. Use this instead of style.padding. */
  contentPadding?: number;
  /** Extra rows on each side. Default: 2. */
  overscan?: number;
  rowStyle?: ViewStyle;
  onItemPress?: (item: T, index: number) => void;
  handle?: VirtualListHandle;
}
const keyString = (key: VirtualItemKey) => `${typeof key}:${key}`;
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

/** Render only the viewport and overscan; no DOM row measurements or private host refs. */
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
  onItemPress,
  handle: suppliedHandle,
  style,
  ...props
}: VirtualListProps<T>) {
  const [ownedHandle] = useState(createVirtualListHandle);
  const handle = suppliedHandle ?? ownedHandle;
  const controller = controllers.get(handle);
  if (!controller) throw new Error('Use createVirtualListHandle() to create collection handles');
  const prefix = useId();
  const keys = useMemo(() => {
    const unique = new Set<string>();
    return items.map((item, index) => {
      const key = getItemKey(item, index);
      if ((typeof key !== 'string' && typeof key !== 'number') || (typeof key === 'number' && !Number.isFinite(key)))
        throw new Error('Item keys must be strings or finite numbers');
      const encoded = keyString(key);
      if (unique.has(encoded)) throw new Error(`Duplicate virtual item key: ${key}`);
      unique.add(encoded);
      return encoded;
    });
  }, [items, getItemKey]);
  const getRange = useMemo(() => {
    let previous: ReturnType<typeof fixedRange> | undefined;
    return () => {
      const snapshot = handle.scroll.getSnapshot();
      const next = fixedRange({
        count: items.length,
        itemHeight,
        gap,
        padding: contentPadding,
        viewport: snapshot.viewportHeight,
        offset: snapshot.offset,
        overscan,
      });
      if (
        previous &&
        previous.start === next.start &&
        previous.end === next.end &&
        previous.totalHeight === next.totalHeight
      )
        return previous;
      return (previous = next);
    };
  }, [handle, items.length, itemHeight, gap, contentPadding, overscan]);
  const range = useSyncExternalStore(handle.scroll.subscribe, getRange);
  useLayoutEffect(() => {
    if (controller.current) throw new Error('A collection handle can attach to only one VirtualList at a time');
    const current: Controller = {
      scrollToIndex(index, align) {
        const state = handle.scroll.getSnapshot();
        if (!state.connected || !Number.isSafeInteger(index) || index < 0 || index >= items.length) return false;
        handle.scroll.scrollTo(
          offsetForIndex({
            count: items.length,
            itemHeight,
            gap,
            padding: contentPadding,
            viewport: state.viewportHeight,
            offset: state.offset,
            index,
            align,
          }),
        );
        return true;
      },
    };
    controller.current = current;
    return () => {
      if (controller.current === current) controller.current = undefined;
    };
  }, [controller, handle, items.length, itemHeight, gap, contentPadding]);
  const rows: ReactNode[] = [];
  for (let index = range.start; index < range.end; index++) {
    const item = items[index]!;
    rows.push(
      <View
        key={keys[index]}
        id={`${prefix}-${keys[index]}`}
        focusable
        label={getItemLabel(item, index)}
        onPress={() => onItemPress?.(item, index)}
        style={{
          ...rowStyle,
          position: 'absolute',
          left: contentPadding,
          right: contentPadding,
          top: contentPadding + index * (itemHeight + gap),
          height: itemHeight,
          flexShrink: 0,
        }}
      >
        {renderItem(item, index)}
      </View>,
    );
  }
  return (
    <ScrollArea {...props} scrollHandle={handle.scroll} style={{ ...style, ...zeroPadding, flexDirection: 'column' }}>
      <View style={{ height: range.totalHeight, width: '100%', flexShrink: 0 }}>{rows}</View>
    </ScrollArea>
  );
}
