# Fixed-height collections

`VirtualList` owns a vertical scrolling region and mounts only the viewport, two overscan
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

## Focus, selection and semantics

This first component is a single-select listbox. Options may contain complex visual
layouts; place independent buttons, checkboxes and text editors outside options.
Use the lower-level scroll handle when designing a different interaction pattern.
This boundary follows the [WAI-ARIA listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).

`selectedKey` is application-owned. `onItemPress` handles Enter, Space or pointer
activation; update selection there. Arrow keys, Home/End, PageUp/PageDown and
prefix search move focus without automatically changing selection. `ui.navigate`
routes vertical gamepad navigation through logical items and skips disabled items.
`isItemDisabled` determines availability. There is one Tab stop, with position and
total-size metadata on mounted options. `VirtualItemState` supplies active,
selected and disabled values to row rendering and optional row style functions.

`handle.focusIndex(index)` and `focusKey(key)` return a Promise that resolves after
an application frame has scrolled, mounted and focused the target. Do not wait for
the Promise before driving a manually stopped root's next frame. Requests resolve
false for unavailable/disabled targets, modal rejection, supersession, removal or
teardown. `root.focus(id)` retains its existing mounted-node contract.

Active, pending-focus and pointer targets can retain at most three extra rows.
The last active row stays mounted while a modal owns focus so it can receive focus
on return. A failed request does not replace that return target. Item state and
focus follow stable keys during reorder; deleting the focused item chooses a
nearby enabled replacement. A surviving viewport anchor keeps its key and local
offset through data and explicit row-height changes. The library indexes item
metadata, so application data/index memory remains linear in item count.

Browser contracts cover these behaviors; actual screen-reader and physical-mobile
qualification remains recorded separately in [QUALIFICATION_RESULTS.md](QUALIFICATION_RESULTS.md).
