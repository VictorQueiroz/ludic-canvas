export function virtualizationGuide(code) {
  return `<p>Use ordinary components for small HUDs and short menus. Use <code>VirtualList</code> for a large, fixed-height, single-select collection: it mounts the viewport and overscan while your application owns the full dataset and selection.</p>${code(`import { useState } from 'react';
import { VirtualList, createVirtualListHandle, Text } from 'ludic-canvas';

interface Item { id: string; name: string; }
const key = (item: Item) => item.id;
function Inventory({ items }: { items: readonly Item[] }) {
  const [list] = useState(createVirtualListHandle);
  const [selected, select] = useState<string>();
  return <VirtualList label="Inventory" items={items}
    getItemKey={key} getItemLabel={(item) => item.name}
    selectedKey={selected} onItemPress={(item) => select(item.id)}
    itemHeight={48} gap={4} contentPadding={12} handle={list}
    style={{ flex: 1 }}
    rowStyle={(_item, _index, state) => ({
      background: state.selected ? '#3b4f3b' : '#23342c',
      padding: 10, justifyContent: 'center',
    })}
    renderItem={(item) => <Text>{item.name}</Text>} />;
}`)}<p>Keep item keys stable and update arrays immutably. Rows may unmount, so store persistent item state outside them. The initial key/index metadata remains linear in item count; mounted React/Yoga nodes scale with the visible window and overscan. Fixed row height is explicit: supply a larger height when text scale or localization needs more space.</p>
<p>Arrow keys, Home/End, PageUp/PageDown, prefix search and <code>ui.navigate()</code> use logical items and skip disabled choices. Focus and selection are separate. Options expose logical position/size and one Tab stop. Active, pending-focus and pointer targets can retain three extra rows.</p>${code(
    `// A running game loop supplies the next frame automatically.
const focused = await list.focusKey(item.id);

// With a manually driven, stopped root, queue first, then draw:
const pending = list.focusIndex(3999);
ui.frame();
const didFocus = await pending;

// An ordinary ScrollArea can also expose a typed scroll handle:
const scroll = createScrollHandle(); // Pass to <ScrollArea scrollHandle={scroll}>
scroll.scrollTo(240); // Applied and clamped during the next frame
const state = scroll.getSnapshot(); // Cached immutable CSS-pixel state`,
    'tsx',
    'Focus and scrolling',
  )}<p>Focus requests resolve false on missing/disabled targets, modal rejection, supersession, removal or teardown. The last active row remains available for modal focus return. Reordering uses stable keys, and a surviving viewport anchor follows data and explicit height changes.</p>
<p>Listbox options contain visual content. Put independent buttons, checkboxes and editors outside options; interactive grids and variable-height rows require a different collection contract. The lower-level <code>createScrollHandle</code> provides viewport/offset observation for custom compositions.</p>
<p>Try <a href="/play/?example=kestrel-survey">Kestrel Survey</a> → Collection → Regional archive: 4,000 records, custom row layouts, two font families and responsive sizing, inside the existing 3D game loop. The three live mission samples remain a short ordinary list.</p><p>The <a href="/performance/">performance lab</a> compares matched 400/4,000-item collections and a 40,000-item windowed probe. Read the <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/docs/VIRTUALIZATION.md">full collection contract</a> and <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/docs/PERFORMANCE.md">measurement limits</a>. Browser tests do not replace physical-device and screen-reader qualification.</p>`;
}
