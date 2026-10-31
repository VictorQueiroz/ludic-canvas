import { readFile } from 'node:fs/promises';
import { createElement, createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  Dialog,
  ScrollArea,
  TextInput,
  Text,
  View,
  createPortableUI,
  createHeadlessHost,
  RecordingRenderer,
  Font,
  FontBook,
  createScrollHandle,
  type TextInputHandle,
  type HostKeyEvent,
} from '../src/core.ts';
import { YogaLayout } from '../src/wasm/layout.ts';

async function services() {
  const layout = await YogaLayout.load(
    new Uint8Array(await readFile(new URL('../assets/layout.wasm', import.meta.url))),
  );
  const metrics = JSON.parse(await readFile(new URL('../assets/default-font.json', import.meta.url), 'utf8'));
  const fonts = new FontBook();
  fonts.add(
    new Font('default', 0, metrics, {
      handle: 'atlas',
      width: metrics.atlas.width,
      height: metrics.atlas.height,
      bytes: 0,
    }),
  );
  const host = createHeadlessHost({ width: 400, height: 300 });
  const renderer = new RecordingRenderer();
  return { layout, fonts, host, renderer };
}
async function fixture() {
  const owned = await services();
  return { ...owned, ui: createPortableUI(owned) };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const key = (value: string): HostKeyEvent & { type: 'keydown' } => ({
  type: 'keydown',
  key: value,
  code: value,
  repeat: false,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
  stopPropagation() {},
});

describe('portable UI contract', () => {
  it('releases owned services when automatic scheduling fails during creation', async () => {
    const owned = await services();
    const dispose = vi.spyOn(owned.layout, 'dispose');
    owned.host.scheduler.requestFrame = () => {
      throw new Error('scheduler unavailable');
    };
    try {
      expect(() => createPortableUI({ ...owned, autoStart: true })).toThrow('scheduler unavailable');
      expect(dispose).toHaveBeenCalledOnce();
      expect(owned.host.destroyed).toBe(true);
      expect(owned.renderer.destroyed).toBe(true);
    } finally {
      owned.layout.dispose();
      owned.renderer.dispose();
      owned.host.destroy();
    }
  });

  it('releases the tree and services even when cancelling a frame fails', async () => {
    const { ui, host, renderer, layout } = await fixture();
    const dispose = vi.spyOn(layout, 'dispose');
    const ref = createRef<TextInputHandle>();
    ui.render(<TextInput ref={ref} label="Editor" value="text" onValueChange={() => {}} />);
    await settle();
    ui.frame(0);
    expect(ref.current).not.toBeNull();
    ui.start();
    host.scheduler.cancelFrame = () => {
      throw new Error('cancel failed');
    };
    try {
      expect(() => ui.destroy()).toThrow('cancel failed');
      expect(dispose).toHaveBeenCalledOnce();
      expect(ref.current).toBeNull();
      expect(host.destroyed).toBe(true);
      expect(renderer.destroyed).toBe(true);
      expect(() => ui.destroy()).not.toThrow();
    } finally {
      layout.dispose();
      renderer.dispose();
      host.destroy();
    }
  });

  it('renders and activates the same React component without DOM globals', async () => {
    expect(typeof document).toBe('undefined');
    const { ui, host, renderer } = await fixture();
    function Counter() {
      const [count, setCount] = useState(0);
      return (
        <View style={{ width: 300, padding: 12 }}>
          <Text>Count: {count}</Text>
          <Button id="add" label="Add" onPress={() => setCount(count + 1)} />
        </View>
      );
    }
    ui.render(createElement(Counter));
    await new Promise((resolve) => setTimeout(resolve, 0));
    ui.frame(100);
    expect(renderer.frame.commands.length).toBeGreaterThan(0);
    expect(host.semantics.find((node) => node.id === 'add')?.label).toBe('Add');
    host.activate('add');
    await new Promise((resolve) => setTimeout(resolve, 0));
    ui.frame(116);
    expect(JSON.stringify(ui.inspect())).toContain('Count: 1');
    ui.destroy();
    expect(host.semantics).toEqual([]);
    expect(renderer.destroyed).toBe(true);
    expect(ui.isPointerOverUI({ x: 20, y: 20 })).toBe(false);
  });

  it('keeps hit geometry, resources and teardown independent between roots', async () => {
    const a = await fixture(),
      b = await fixture();
    a.ui.render(<View block style={{ width: 80, height: 60 }} />);
    b.ui.render(<View style={{ width: 80, height: 60 }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    a.ui.frame(100);
    b.ui.frame(100);
    expect(a.ui.isPointerOverUI({ x: 20, y: 20 })).toBe(true);
    expect(b.ui.isPointerOverUI({ x: 20, y: 20 })).toBe(false);
    a.ui.destroy();
    b.ui.frame(116);
    expect(b.renderer.destroyed).toBe(false);
    b.ui.destroy();
  });

  it('routes wheels through shared scrolling and cancels the owned frame loop', async () => {
    const { ui, host, renderer } = await fixture(),
      scroll = createScrollHandle();
    ui.render(
      <ScrollArea label="Items" scrollHandle={scroll} style={{ width: 200, height: 100 }}>
        <View style={{ height: 500, flexShrink: 0 }} />
      </ScrollArea>,
    );
    await settle();
    ui.frame(0);
    const wheel = { ...key(''), type: 'wheel' as const, x: 20, y: 20, deltaX: 0, deltaY: 70, deltaZ: 0, deltaMode: 0 };
    host.dispatch(wheel);
    ui.frame(16);
    expect(wheel.defaultPrevented).toBe(true);
    expect(scroll.getSnapshot().offset).toBe(70);
    host.resize(200, 100, 2);
    ui.start();
    host.tick(32);
    expect(renderer.frame.width).toBe(400);
    ui.destroy();
    host.tick(48);
    expect(renderer.frame.commands.length).toBe(0);
  });

  it('traps modal focus, suppresses background actions and restores the opener', async () => {
    const { ui, host } = await fixture();
    let presses = 0;
    function Scene() {
      const [open, setOpen] = useState(false);
      return (
        <View>
          <Button id="open" label="Open" onPress={() => setOpen(true)} />
          <Button id="background" label="Background" onPress={() => presses++} />
          <Dialog label="Dialog" open={open} onOpenChange={setOpen}>
            <Button id="close" label="Close" onPress={() => setOpen(false)} />
          </Dialog>
        </View>
      );
    }
    ui.render(<Scene />);
    await settle();
    ui.frame(0);
    host.activate('open');
    ui.frame(16);
    expect(host.focused).toBe(host.semantics.find((n) => n.id === 'close')?.key);
    host.activate('background');
    expect(presses).toBe(0);
    host.dispatch(key('Tab'));
    expect(host.focused).toBe(host.semantics.find((n) => n.id === 'close')?.key);
    host.dispatch(key('Escape'));
    await settle();
    ui.frame(32);
    expect(host.focused).toBe(host.semantics.find((n) => n.id === 'open')?.key);
    ui.destroy();
  });

  it('preserves editor identity, controlled values and external resets during composition', async () => {
    const { ui, host } = await fixture();
    const ref = createRef<TextInputHandle>();
    const changes: string[] = [];
    let replace: (value: string) => void = () => {};
    function Scene() {
      const [value, setValue] = useState('start');
      replace = setValue;
      return (
        <TextInput
          ref={ref}
          id="editor"
          label="Editor"
          value={value}
          onValueChange={(v) => {
            changes.push(v);
            setValue(v);
          }}
        />
      );
    }
    ui.render(<Scene />);
    await settle();
    ui.frame(0);
    const handle = ref.current,
      id = host.semantics.find((n) => n.id === 'editor')!.key;
    host.dispatch({ type: 'edit', key: id, value: 'draft', composing: true });
    replace('reset');
    await settle();
    host.dispatch({ type: 'edit', key: id, value: 'later draft', composing: true });
    expect(host.semantics.find((n) => n.key === id)?.editor?.value).toBe('later draft');
    host.dispatch({ type: 'compositionend', key: id, value: 'final' });
    expect(changes).toEqual(['draft']);
    expect(host.semantics.find((n) => n.key === id)?.editor?.value).toBe('reset');
    host.dispatch({ type: 'edit', key: id, value: 'accepted', composing: false });
    host.dispatch({ type: 'compositionend', key: id, value: 'accepted' });
    expect(changes).toEqual(['draft', 'accepted']);
    expect(ref.current).toBe(handle);
    host.resize(0, 0);
    ui.frame(16);
    expect(ref.current?.focus()).toBe(false);
    expect(host.semantics.find((n) => n.key === id)?.hidden).toBe(true);
    host.resize(400, 300);
    ui.frame(32);
    expect(ref.current).toBe(handle);
    ui.destroy();
    expect(ref.current).toBeNull();
  });

  it('restores the original opener when all nested dialogs unmount together', async () => {
    const { ui, host } = await fixture();
    function Scene() {
      const [depth, setDepth] = useState(0);
      return (
        <View>
          <Button id="open" label="Open" onPress={() => setDepth(1)} />
          <Dialog open={depth > 0} label="Outer" onOpenChange={() => setDepth(0)}>
            <Button id="inner" label="Inner" onPress={() => setDepth(2)} />
            <Dialog open={depth > 1} label="Inner dialog" onOpenChange={() => setDepth(1)}>
              <Button id="all" label="Close all" onPress={() => setDepth(0)} />
            </Dialog>
          </Dialog>
        </View>
      );
    }
    ui.render(<Scene />);
    await settle();
    ui.frame(0);
    host.activate('open');
    ui.frame(16);
    host.activate('inner');
    ui.frame(32);
    expect(host.focused).toBe(host.semantics.find((n) => n.id === 'all')?.key);
    host.activate('all');
    ui.frame(48);
    expect(host.focused).toBe(host.semantics.find((n) => n.id === 'open')?.key);
    ui.destroy();
  });
});
