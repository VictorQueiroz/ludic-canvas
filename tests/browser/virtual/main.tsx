import { StrictMode, useLayoutEffect, useState } from 'react';
import { createUI, createVirtualListHandle, VirtualList, Text, View, Dialog } from '../../../src/index.ts';
const canvas = document.querySelector('canvas')!;
const handle = createVirtualListHandle();
const errors: string[] = [];
let renders = 0;
let changeCount: (count: number) => void = () => {};
let reverse = () => {};
let remove = (_key: number) => {};
let modal = (_open: boolean) => {};
let rowHeight = (_height: number) => {};
const pressed: number[] = [];
const isItemDisabled = (value: number) => value === 7;
const root = await createUI({
  canvas,
  autoStart: false,
  maxDpr: 1,
  profile: true,
  reducedMotion: true,
  onError: (error) => errors.push(String(error)),
});
const getItemKey = (value: number) => value;
function App() {
  const [items, setItems] = useState(() => Array.from({ length: 40000 }, (_, i) => i));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [height, setHeight] = useState(40);
  const [replaced, setReplaced] = useState(false);
  useLayoutEffect(() => {
    changeCount = (count) => setItems(Array.from({ length: count }, (_, i) => i));
    reverse = () => setItems((items) => [...items].reverse());
    remove = (key) => setItems((items) => items.filter((item) => item !== key));
    modal = setOpen;
    rowHeight = setHeight;
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <VirtualList
        items={items}
        getItemKey={getItemKey}
        getItemLabel={(value) => `Row ${value}`}
        isItemDisabled={isItemDisabled}
        selectedKey={selected}
        onItemPress={(value) => {
          pressed.push(value);
          setSelected(value);
        }}
        itemHeight={height}
        overscan={2}
        handle={handle}
        label="Inventory"
        style={{ flex: 1 }}
        rowStyle={{ background: '#204060' }}
        renderItem={(value) => {
          renders++;
          return <Text>{`Row ${value}`}</Text>;
        }}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        label="Inventory dialog"
        style={{ padding: 20, background: '#102030' }}
      >
        <View label="Close dialog" onPress={() => setOpen(false)} style={{ height: 40 }}>
          <Text>Close</Text>
        </View>
        {!replaced && (
          <View label="Replace modal contents" onPress={() => setReplaced(true)} style={{ height: 40 }}>
            <Text>Replace contents</Text>
          </View>
        )}
        {replaced && (
          <View label="Replacement action" onPress={() => {}} style={{ height: 40 }}>
            <Text>Replacement</Text>
          </View>
        )}
      </Dialog>
    </View>
  );
}
root.render(
  new URLSearchParams(location.search).has('strict') ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
);
const frame = () => {
  const info = root.frame();
  document.querySelector('output')!.textContent = JSON.stringify(info);
  return info;
};
Object.assign(window, {
  virtual: {
    root,
    handle,
    frame,
    errors,
    get renders() {
      return renders;
    },
    changeCount: (count: number) => changeCount(count),
    reverse: () => reverse(),
    remove: (key: number) => remove(key),
    modal: (open: boolean) => modal(open),
    rowHeight: (height: number) => rowHeight(height),
    pressed,
  },
});
function tick() {
  try {
    frame();
    requestAnimationFrame(tick);
  } catch {}
}
requestAnimationFrame(tick);
