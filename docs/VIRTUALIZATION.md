# Fixed-height collections

`VirtualList` owns a vertical ScrollArea and mounts only the viewport, two overscan
rows on each side by default, and retained interaction targets. Its range math is
constant-time. Initial key validation/indexing is linear in the collection size;
keep the items array and key function stable between actual data changes.

```tsx
const [inventory] = useState(createVirtualListHandle);
return (
  <VirtualList
    label="Inventory"
    items={items}
    getItemKey={itemKey}
    getItemLabel={(item) => item.name}
    itemHeight={48}
    gap={4}
    contentPadding={12}
    handle={inventory}
    style={{ flex: 1 }}
    rowStyle={{ background: '#203347', paddingX: 8 }}
    onItemPress={(item) => inspectItem(item.id)}
    renderItem={(item) => <Text>{item.name}</Text>}
  />
);
```

Use string or finite numeric keys that identify the item across insertions and
reordering. Duplicate keys are rejected. Persistent selection, expansion, edits
and game state belong in the application, not in rows that may unmount.

`inventory.scrollToIndex(index, alignment)` supports `auto`, `start`, `center` and
`end`. It returns false before layout, after unmount and for an invalid index.
Its command takes effect in the next application frame. The renderer synchronizes
the React window and lays out its newly mounted nodes before painting that frame;
there is no additional component animation loop. `inventory.scroll` exposes the
same observation contract as an ordinary ScrollArea.

`itemHeight`, `gap` and `contentPadding` are local CSS pixels. Use `contentPadding`
instead of outer style padding; the component owns outer padding/gaps, row
placement and height. Row styles may customize content layout and appearance.
Changing the height is explicit: when text scale, localization or content requires
taller rows, supply a suitable new `itemHeight`. Variable-height measurement,
grids, trees and automatic font-driven sizing are outside this first contract.

The implementation uses a small internal fixed-height range calculation and the
native scroll store. It adds no DOM virtualizer or browser measurement dependency.
This keeps manual engine frames, Yoga geometry and root ownership in one contract.
