import {
  createScrollHandle,
  createVirtualListHandle,
  VirtualList,
  Text,
  View,
  type ScrollHandle,
  type ViewStyle,
} from 'ludic-canvas';

/** Matched retained/windowed fixtures. The 40k case is a windowed scalability probe. */
export const collectionWorkloads = [
  'retained-400',
  'virtual-400',
  'retained-4000',
  'virtual-4000',
  'virtual-40000',
] as const;
export type CollectionWorkload = (typeof collectionWorkloads)[number];
const sizes = {
  'retained-400': 400,
  'virtual-400': 400,
  'retained-4000': 4000,
  'virtual-4000': 4000,
  'virtual-40000': 40000,
};
const datasets = new Map<number, readonly number[]>();
const family = ['interface', 'latin'] as const;
const rowStyle: ViewStyle = {
  height: 36,
  flexShrink: 0,
  flexDirection: 'row',
  gap: 12,
  alignItems: 'center',
  paddingX: 8,
  background: '#203347',
};
const itemKey = (index: number) => index;
const itemLabel = (index: number) => `Inventory item ${index + 1}`;
const noPress = () => {};
function contents(index: number) {
  return (
    <>
      <Text style={{ fontFamily: family, fontSize: 16, width: 80 }}>{`#${index + 1}`}</Text>
      <Text style={{ fontFamily: family, fontSize: 16, flex: 1 }}>{`Café supplies ${(index * 73) % 1000}`}</Text>
    </>
  );
}
function RetainedInventory({ items, scroll }: { items: readonly number[]; scroll: ScrollHandle }) {
  return (
    <View
      label="Benchmark inventory"
      role="listbox"
      orientation="vertical"
      scrollHandle={scroll}
      style={{ flex: 1, overflow: 'scroll', padding: 12, gap: 4, background: '#111c29' }}
    >
      {items.map((index) => (
        <View
          key={index}
          focusable
          role="option"
          label={itemLabel(index)}
          selected={false}
          positionInSet={index + 1}
          setSize={items.length}
          tabIndex={index === 0 ? 0 : -1}
          onPress={noPress}
          style={rowStyle}
        >
          {contents(index)}
        </View>
      ))}
    </View>
  );
}
export function createCollectionWorkload(workload: CollectionWorkload) {
  const count = sizes[workload];
  let items = datasets.get(count);
  if (!items) {
    items = Object.freeze(Array.from({ length: count }, (_, index) => index));
    datasets.set(count, items);
  }
  const virtual = workload.startsWith('virtual-');
  const list = createVirtualListHandle(),
    scroll = virtual ? list.scroll : createScrollHandle();
  const element = virtual ? (
    <VirtualList
      label="Benchmark inventory"
      handle={list}
      items={items}
      getItemKey={itemKey}
      getItemLabel={itemLabel}
      itemHeight={36}
      gap={4}
      contentPadding={12}
      overscan={2}
      rowStyle={rowStyle}
      onItemPress={noPress}
      style={{ flex: 1, background: '#111c29' }}
      renderItem={contents}
    />
  ) : (
    <RetainedInventory items={items} scroll={scroll} />
  );
  return { count, virtual, scroll, element, totalHeight: count * 40 - 4 + 24 };
}

/** Same pixel motion and deterministic distant jumps for each matched item count. */
export function collectionOffset(step: number, maxOffset: number): number {
  const phase = Math.floor(step / 30) % 4,
    local = (step % 30) * 12;
  return Math.max(
    0,
    Math.min(
      maxOffset,
      phase === 0
        ? local
        : phase === 1
          ? maxOffset / 2 + local
          : phase === 2
            ? maxOffset - 348 + local
            : maxOffset / 2 - local,
    ),
  );
}
