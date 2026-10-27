import { useLayoutEffect, useState } from 'react';
import { createUI, createVirtualListHandle, VirtualList, Text } from '../../../src/index.ts';
const canvas = document.querySelector('canvas')!;
const handle = createVirtualListHandle();
const errors: string[] = [];
let renders = 0;
let changeCount: (count: number) => void = () => {};
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
  useLayoutEffect(() => {
    changeCount = (count) => setItems(Array.from({ length: count }, (_, i) => i));
  }, []);
  return (
    <VirtualList
      items={items}
      getItemKey={getItemKey}
      getItemLabel={(value) => `Row ${value}`}
      itemHeight={40}
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
  );
}
root.render(<App />);
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
  },
});
function tick() {
  try {
    frame();
    requestAnimationFrame(tick);
  } catch {}
}
requestAnimationFrame(tick);
