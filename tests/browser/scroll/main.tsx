import { createUI, createScrollHandle, ScrollArea, Text, View } from '../../../src/index.ts';
const canvas = document.querySelector('canvas')!;
const scroll = createScrollHandle();
const events: unknown[] = [];
const errors: string[] = [];
const root = await createUI({ canvas, autoStart: false, maxDpr: 1, onError: (error) => errors.push(String(error)) });
root.render(
  <ScrollArea label="Items" scrollHandle={scroll} onScroll={(state) => events.push(state)} style={{ flex: 1 }}>
    {Array.from({ length: 100 }, (_, i) => (
      <View key={i} id={`item-${i}`} label={`Item ${i}`} onPress={() => {}} style={{ height: 40, flexShrink: 0 }}>
        <Text>{`Row ${i}`}</Text>
      </View>
    ))}
  </ScrollArea>,
);
const frame = () => {
  root.frame();
  document.querySelector('output')!.textContent = JSON.stringify(scroll.getSnapshot());
};
async function second(shared = false) {
  const surface = document.createElement('canvas');
  surface.style.cssText = 'display:block;width:160px;height:120px';
  document.body.appendChild(surface);
  const handle = shared ? scroll : createScrollHandle();
  const ui = await createUI({ canvas: surface, onError: (error) => errors.push(String(error)) });
  ui.render(
    <ScrollArea label="Second items" scrollHandle={handle} style={{ flex: 1 }}>
      <View style={{ height: 1000, flexShrink: 0 }} />
    </ScrollArea>,
  );
  return { root: ui, scroll: handle };
}
Object.assign(window, { scrolling: { root, scroll, frame, events, errors, second } });
function tick() {
  try {
    frame();
    requestAnimationFrame(tick);
  } catch (error) {
    errors.push(String(error));
  }
}
requestAnimationFrame(tick);
