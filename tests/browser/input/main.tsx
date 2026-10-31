import { useLayoutEffect } from 'react';
import {
  createUI,
  createScrollHandle,
  View,
  TextArea,
  ScrollArea,
  Dialog,
  type UIWheelEvent,
  type UIRoot,
} from '../../../src/index.ts';

const canvas = document.querySelector('canvas')!;
const stage = document.querySelector('#stage')!;
const errors: string[] = [];
const calls: {
  name: string;
  x: number;
  y: number;
  localX: number;
  localY: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  prevented: boolean;
}[] = [];
const outer = createScrollHandle(),
  inner = createScrollHandle();
const root = await createUI({ canvas, autoStart: false, onError: (e) => errors.push(String(e)) });
const roots = new Set<UIRoot>([root]);
let committed = '',
  ready = '',
  external = 0,
  mode = '';
const record =
  (name: string, behavior = '') =>
  (e: UIWheelEvent) => {
    calls.push({
      name,
      x: e.x,
      y: e.y,
      localX: e.localX,
      localY: e.localY,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      prevented: e.defaultPrevented,
    });
    if (behavior === 'prevent') e.preventDefault();
    if (behavior === 'stop') e.stopPropagation();
  };
const box = { position: 'absolute', left: 40, top: 40, width: 100, height: 100 } as const;
function Scene({ name, behavior }: { name: string; behavior: string }) {
  useLayoutEffect(() => {
    committed = name + (behavior ? ':' + behavior : '');
  }, [name, behavior]);
  if (name === 'geometry')
    return (
      <View style={{ width: 320, height: 300 }}>
        <View block style={{ ...box, left: 10, top: 10, width: 30, height: 30 }} />
        <View onPress={() => {}} disabled style={{ ...box, left: 50, top: 10, width: 30, height: 30 }} />
        <View style={{ ...box, left: 90, top: 10, width: 30, height: 30, background: '#fff' }} />
        <View pointerEvents="none" style={{ ...box, left: 130, top: 10, width: 30, height: 30 }}>
          <View block style={{ flex: 1 }} />
        </View>
        <View pointerEvents="box-none" block style={{ ...box, left: 170, top: 10, width: 60, height: 30 }}>
          <View block style={{ width: 20, height: 20 }} />
        </View>
        <View style={{ ...box, left: 10, top: 80, width: 50, height: 40, overflow: 'hidden' }}>
          <View block style={{ width: 100, height: 100, flexShrink: 0 }} />
        </View>
        <View block style={{ ...box, left: 100, top: 80, width: 40, height: 40, scale: 2, translateX: 20 }} />
        <View block style={{ ...box, left: 210, top: 80, opacity: 0 }} />
      </View>
    );
  if (name === 'scroll' || name === 'prevent' || name === 'stop' || name === 'editor')
    return (
      <ScrollArea label="Outer" scrollHandle={outer} onWheel={record('outer')} style={{ width: 250, height: 240 }}>
        <ScrollArea
          label="Inner"
          scrollHandle={inner}
          onWheel={record('inner', name)}
          style={{ height: 100, width: 220, flexShrink: 0 }}
        >
          {name === 'editor' ? (
            <TextArea
              label="Notes"
              value={'line\n'.repeat(50)}
              onValueChange={() => {}}
              onWheel={record('editor')}
              style={{ width: 200, height: 80, flexShrink: 0 }}
            />
          ) : (
            <View disabled onWheel={record('disabled')} onPress={() => {}} style={{ height: 80, flexShrink: 0 }} />
          )}
          <View style={{ height: 300, flexShrink: 0 }} />
        </ScrollArea>
        <View style={{ height: 500, flexShrink: 0 }} />
      </ScrollArea>
    );
  return (
    <View style={{ width: 320, height: 300 }}>
      {name !== 'overlay' && (
        <View onWheel={record('map', 'prevent')} style={{ position: 'absolute', width: 320, height: 300 }} />
      )}
      {name === 'bubble' ? (
        <View onWheel={record('parent')} style={{ ...box, scale: 2 }}>
          <View onWheel={record('child', behavior)} style={{ width: 40, height: 40 }} />
        </View>
      ) : (
        <View block style={box} />
      )}
      {name === 'button' && <View onPress={() => {}} style={{ ...box, left: 180 }} />}
      {name === 'disabled' && (
        <View disabled onWheel={record('disabled')} onPress={() => {}} style={{ ...box, left: 180 }} />
      )}
      {name === 'modal' && (
        <Dialog open label="Modal" onOpenChange={() => {}} style={{ left: 40, top: 40, width: 100, height: 100 }} />
      )}
    </View>
  );
}
function render(name: string) {
  root.render(<Scene name={name} behavior={name === 'bubble' ? mode : ''} />);
}
function frame() {
  for (const ui of roots) ui.frame();
  ready = committed;
  document.querySelector('output')!.textContent = ready;
}
const externalEvents = new AbortController();
stage.addEventListener(
  'wheel',
  (event) => {
    const e = event as WheelEvent;
    if (root.isPointerOverUI(e)) return;
    external++;
    e.preventDefault();
  },
  { passive: false, signal: externalEvents.signal },
);
function wheel(x: number, y: number, init: WheelEventInit = {}, target: Element = canvas) {
  const rect = canvas.getBoundingClientRect();
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
    deltaY: 40,
    ...init,
  });
  target.dispatchEvent(event);
  frame();
  return event.defaultPrevented;
}
function over(x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  return root.isPointerOverUI({ clientX: rect.left + x, clientY: rect.top + y });
}
async function second() {
  const container = document.createElement('div');
  const surface = document.createElement('canvas');
  container.append(surface);
  document.body.append(container);
  surface.style.cssText = 'width:320px;height:100px;display:block';
  const ui = await createUI({ canvas: surface, autoStart: false });
  ui.render(<View block style={{ width: 100, height: 80 }} />);
  roots.add(ui);
  return { ui, surface };
}
Object.assign(window, {
  routing: {
    root,
    canvas,
    render,
    wheel,
    over,
    frame,
    calls,
    errors,
    outer,
    inner,
    second,
    get ready() {
      return ready;
    },
    get external() {
      return external;
    },
    mode(value: string) {
      mode = value;
      render('bubble');
    },
    destroy() {
      roots.delete(root);
      externalEvents.abort();
      root.destroy();
    },
  },
});
render('map');
function tick() {
  frame();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
