import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, Slider, Switch, Tabs, View, type UIKeyEvent, type UIPointerEvent, type UIRoot } from '../src/index.ts';
import { UIRootContext } from '../src/context.ts';
import { FontBook } from '../src/gfx/font.ts';
import { HostNode } from '../src/runtime/nodes.ts';
import { createUiRoot } from '../src/runtime/reconciler.ts';
import { YogaLayout } from '../src/wasm/layout.ts';

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
async function setup() {
  const layout = await YogaLayout.load(readFileSync(new URL('../assets/layout.wasm', import.meta.url)));
  const onError = vi.fn();
  const tree = createUiRoot({ layout, fonts: new FontBook(), textScale: 1, invalidate() {}, onError });
  const focus = vi.fn(() => true);
  const owner = { focus } as unknown as UIRoot;
  cleanups.push(() => {
    tree.destroy();
    layout.dispose();
  });
  const all = (node: HostNode): HostNode[] => [
    node,
    ...node.children.filter((n): n is HostNode => n instanceof HostNode).flatMap(all),
  ];
  const nodes = (role: string) => all(tree.root).filter((node) => node.props.role === role);
  return {
    render: (element: React.ReactNode) =>
      tree.render(<UIRootContext.Provider value={owner}>{element}</UIRootContext.Provider>),
    nodes,
    focus,
    onError,
  };
}
const key = (name: string): UIKeyEvent => ({
  key: name,
  code: name,
  repeat: false,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});
const pointer = (x: number, id = 1): UIPointerEvent => ({
  x,
  y: 0,
  localX: x,
  localY: 0,
  pointerId: id,
  pointerType: 'mouse',
  button: 0,
  buttons: 1,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe('controlled canvas controls', () => {
  it('snaps slider keys relative to min and leaves the value controlled by the application', async () => {
    const { render, nodes } = await setup();
    const change = vi.fn(),
      commit = vi.fn();
    render(
      <Slider label="Volume" value={0.1} min={0.1} max={0.9} step={0.2} onValueChange={change} onValueCommit={commit}>
        {() => <View />}
      </Slider>,
    );
    await vi.waitFor(() => expect(nodes('slider')).toHaveLength(1));
    const slider = nodes('slider')[0]!;
    slider.props.onKeyDown!(key('ArrowRight'));
    expect(change).toHaveBeenLastCalledWith(0.3);
    expect(commit).toHaveBeenLastCalledWith(0.3);
    expect(slider.props.valueNow).toBe(0.1);
    slider.props.onKeyDown!(key('End'));
    expect(change).toHaveBeenLastCalledWith(0.9);
    slider.props.onKeyDown!(key('Home'));
    expect(change).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith(0.1);
    slider.props.onKeyDown!(key('PageUp'));
    expect(change).toHaveBeenLastCalledWith(0.9);
  });

  it('captures one slider pointer, clamps outside bounds and never commits a cancellation', async () => {
    const { render, nodes } = await setup();
    const change = vi.fn(),
      commit = vi.fn();
    render(
      <Slider label="Volume" value={0} step={0.1} onValueChange={change} onValueCommit={commit}>
        {() => <View />}
      </Slider>,
    );
    await vi.waitFor(() => expect(nodes('slider')).toHaveLength(1));
    const slider = nodes('slider')[0]!;
    slider.props.onLayout!({ x: 0, y: 0, width: 200, height: 40 });
    slider.props.onPointerMove!(pointer(100));
    expect(change).not.toHaveBeenCalled();
    slider.props.onPointerDown!(pointer(100));
    expect(change).toHaveBeenLastCalledWith(0.5);
    slider.props.onPointerMove!(pointer(170, 2));
    expect(change).toHaveBeenCalledTimes(1);
    slider.props.onPointerMove!(pointer(250));
    expect(change).toHaveBeenLastCalledWith(1);
    slider.props.onPointerCancel!(pointer(250));
    slider.props.onPointerUp!(pointer(250));
    expect(commit).not.toHaveBeenCalled();
  });

  it.each([{ min: 1, max: 1 }, { min: 2, max: 1 }, { step: 0 }, { value: NaN }])(
    'reports invalid slider ranges: %j',
    async (invalid) => {
      const { render, onError } = await setup();
      render(
        <Slider label="Invalid" value={0} onValueChange={() => {}} {...invalid}>
          {() => <View />}
        </Slider>,
      );
      await vi.waitFor(() => expect(onError).toHaveBeenCalled());
      expect(String(onError.mock.calls[0]![0])).toContain('Slider requires');
    },
  );

  it('switches request state changes without maintaining a second source of truth', async () => {
    const { render, nodes } = await setup();
    const change = vi.fn();
    render(
      <Switch label="Motion" checked={false} onCheckedChange={change}>
        <View />
      </Switch>,
    );
    await vi.waitFor(() => expect(nodes('switch')).toHaveLength(1));
    nodes('switch')[0]!.props.onPress!();
    expect(change).toHaveBeenCalledWith(true);
    expect(nodes('switch')[0]!.props.checked).toBe(false);
    render(
      <Switch label="Motion" checked onCheckedChange={change}>
        <View />
      </Switch>,
    );
    await vi.waitFor(() => expect(nodes('switch')[0]!.props.checked).toBe(true));
    nodes('switch')[0]!.props.onPress!();
    expect(change).toHaveBeenLastCalledWith(false);
  });

  it('tabs skip disabled entries and focus through their own root', async () => {
    const left = await setup(),
      right = await setup();
    const items = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
      { value: 'c', label: 'C' },
    ];
    const change = vi.fn();
    const element = (
      <Tabs label="Inventory" value="a" items={items} onValueChange={change}>
        {() => <View />}
      </Tabs>
    );
    left.render(element);
    right.render(element);
    await vi.waitFor(() => expect(left.nodes('tab')).toHaveLength(3));
    await vi.waitFor(() => expect(right.nodes('tab')).toHaveLength(3));
    left.nodes('tab')[0]!.props.onKeyDown!(key('ArrowRight'));
    expect(change).toHaveBeenLastCalledWith('c');
    expect(left.focus).toHaveBeenLastCalledWith(left.nodes('tab')[2]!.props.id);
    expect(right.focus).not.toHaveBeenCalled();
    right.nodes('tab')[0]!.props.onKeyDown!(key('End'));
    expect(right.focus).toHaveBeenLastCalledWith(right.nodes('tab')[2]!.props.id);
    expect(left.nodes('tab').map((tab) => tab.props.tabIndex)).toEqual([0, -1, -1]);
  });

  it('dialogs request Escape dismissal and unmount only after the owner closes them', async () => {
    const { render, nodes } = await setup();
    const close = vi.fn();
    render(
      <Dialog label="Pause" open onOpenChange={close}>
        <View />
      </Dialog>,
    );
    await vi.waitFor(() => expect(nodes('dialog')).toHaveLength(1));
    const event = key('Escape');
    nodes('dialog')[0]!.props.onKeyDown!(event);
    expect(close).toHaveBeenCalledWith(false);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(nodes('dialog')).toHaveLength(1);
    render(
      <Dialog label="Pause" open={false} onOpenChange={close}>
        <View />
      </Dialog>,
    );
    await vi.waitFor(() => expect(nodes('dialog')).toHaveLength(0));
  });
});
