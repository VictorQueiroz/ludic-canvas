import { useLayoutEffect, useState } from 'react';
import {
  createUI,
  createScrollHandle,
  createVirtualListHandle,
  ScrollArea,
  VirtualList,
  Text,
  View,
  TextInput,
} from '../../../src/index.ts';

const canvas = document.querySelector('canvas')!;
const scroll = createScrollHandle();
const virtual = createVirtualListHandle();
const errors: string[] = [];
const hoverEvents: boolean[] = [];
const params = new URLSearchParams(location.search);
if (params.get('kind') === 'viewport-resize') canvas.style.height = '600px';
const root = await createUI({
  canvas,
  autoStart: false,
  maxDpr: 2,
  profile: true,
  reducedMotion: params.has('reduced'),
  ...(params.has('budget') ? { nativeScrollBudgetBytes: Number(params.get('budget')) } : {}),
  onError: (error) => errors.push(String(error)),
  ...(params.has('shared') ? { context: canvas.getContext('webgl')! } : {}),
});
let change = (_kind: string) => {};
let committed = 0;
function App() {
  const [kind, setKind] = useState(params.get('kind') ?? 'simple');
  const [selected, select] = useState(-1);
  useLayoutEffect(() => {
    change = setKind;
    committed++;
  });
  const mode = kind === 'canvas' ? 'canvas' : kind === 'required' ? 'native' : 'auto';
  const rows = Array.from({ length: 200 }, (_, index) => (
    <View
      key={index}
      id={`row-${index}`}
      label={`Row ${index}${selected === index ? ' selected' : ''}`}
      onPress={() => select(index)}
      onHover={kind === 'hover-button' && index === 0 ? (hovered) => hoverEvents.push(hovered) : undefined}
      pressStyle={{ opacity: 0.5 }}
      transition={kind.startsWith('transition-') ? 100 : undefined}
      style={{
        height: 40,
        flexShrink: 0,
        background: kind.startsWith('transition-')
          ? kind === 'transition-green'
            ? '#00ff00'
            : '#ff0000'
          : index === selected
            ? '#406080'
            : index % 2
              ? '#182838'
              : '#203040',
      }}
    >
      <Text>{`Row ${index}${selected === index ? ' selected' : ''}`}</Text>
    </View>
  ));
  return (
    <View style={{ flex: 1 }} onPointerDown={kind === 'gesture' ? () => {} : undefined}>
      {kind === 'virtual' ? (
        <VirtualList
          label="Native virtual"
          items={Array.from({ length: 40000 }, (_, i) => i)}
          getItemKey={(i) => i}
          getItemLabel={(i) => `Virtual ${i}`}
          itemHeight={Number(params.get('height') ?? 40)}
          handle={virtual}
          renderItem={(i) => <Text>{`Virtual ${i}`}</Text>}
          style={{ flex: 1 }}
        />
      ) : (
        <ScrollArea
          label="Native rows"
          scrollMode={mode}
          scrollHandle={scroll}
          style={{
            flex: kind === 'viewport-resize' ? undefined : 1,
            height: kind === 'viewport-resize' ? '50%' : undefined,
            scale: kind === 'scale' ? 0.9 : 1,
          }}
        >
          {kind === 'hover-only' ? (
            <View
              label="Hover target"
              onHover={(hovered) => hoverEvents.push(hovered)}
              hoverStyle={{ background: '#00ff00' }}
              style={{ height: 40, flexShrink: 0, background: '#ff0000' }}
            >
              <Text>Hover target</Text>
            </View>
          ) : null}
          {kind === 'unlabeled' ? <View onPress={() => {}} style={{ height: 40, flexShrink: 0 }} /> : null}
          {kind === 'editor' ? (
            <TextInput label="Editor" value="keep selection" onValueChange={() => {}} readOnly />
          ) : null}
          {kind === 'nested' ? (
            <ScrollArea label="Inner" style={{ height: 80, flexShrink: 0 }}>
              <View style={{ height: 400, flexShrink: 0 }} />
            </ScrollArea>
          ) : null}
          {rows}
          {kind === 'block' ? (
            <View
              block
              label="Blocking overlay"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 40, background: '#804020' }}
            />
          ) : null}
          {kind === 'viewport-resize' ? (
            <View
              label="Percent target"
              onPress={() => {}}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%', background: '#ff0000' }}
            />
          ) : null}
        </ScrollArea>
      )}
      {kind === 'overlap' ? (
        <View
          label="Overlay"
          onPress={() => {}}
          style={{ position: 'absolute', top: 0, left: 0, width: 160, height: 100, background: '#ff0000' }}
        />
      ) : null}
    </View>
  );
}
root.render(<App />);
const frame = () => {
  const result = root.frame();
  document.querySelector('output')!.textContent = JSON.stringify({
    committed,
    scroll: scroll.getSnapshot(),
    virtual: virtual.scroll.getSnapshot(),
    errors,
    hoverEvents,
  });
  return result;
};
let raf = 0;
const destroy = () => {
  cancelAnimationFrame(raf);
  root.destroy();
};
Object.assign(window, {
  nativeScrolling: {
    root,
    get committed() {
      return committed;
    },
    scroll,
    virtual,
    errors,
    hoverEvents,
    frame,
    pause: () => cancelAnimationFrame(raf),
    contextLoss: canvas.getContext('webgl')!.getExtension('WEBGL_lose_context'),
    destroy,
    change: (kind: string) => change(kind),
    second: async () => {
      const surface = document.createElement('canvas');
      surface.style.cssText = 'display:block;width:240px;height:160px';
      document.body.append(surface);
      const handle = createScrollHandle();
      const ui = await createUI({ canvas: surface, autoStart: false, maxDpr: 1 });
      let ready = () => {};
      const committed = new Promise<void>((resolve) => {
        ready = resolve;
      });
      function Second() {
        useLayoutEffect(ready, []);
        return (
          <ScrollArea label="Second rows" scrollHandle={handle} style={{ flex: 1 }}>
            <View style={{ height: 4000, flexShrink: 0, background: '#405060' }} />
          </ScrollArea>
        );
      }
      ui.render(<Second />);
      await committed;
      ui.frame();
      return { root: ui, scroll: handle };
    },
  },
});
raf = requestAnimationFrame(function tick() {
  try {
    frame();
    raf = requestAnimationFrame(tick);
  } catch (error) {
    errors.push(String(error));
    document.querySelector('output')!.textContent = JSON.stringify({ errors });
  }
});
