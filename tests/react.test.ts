import { readFileSync } from 'node:fs';
import { createElement, useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { View, Text } from '../src/index.ts';
import { Font, FontBook, type AtlasJson } from '../src/gfx/font.ts';
import { createUiRoot } from '../src/runtime/reconciler.ts';
import { HostNode } from '../src/runtime/nodes.ts';
import { YogaLayout } from '../src/wasm/layout.ts';
async function setup(onError?: (error: unknown) => void) {
  const layout = await YogaLayout.load(readFileSync(new URL('../assets/layout.wasm', import.meta.url)));
  const fonts = new FontBook();
  const metrics = JSON.parse(
    readFileSync(new URL('../assets/default-font.json', import.meta.url), 'utf8'),
  ) as AtlasJson;
  fonts.add(new Font('custom-face', 0, metrics, { handle: {} as WebGLTexture, width: 512, height: 512, bytes: 0 }));
  const create = vi.spyOn(layout, 'create'),
    free = vi.spyOn(layout, 'free');
  const root = createUiRoot({ layout, fonts, textScale: 1, invalidate() {}, onError });
  return { root, layout, create, free };
}
function texts(node: HostNode): string {
  return [
    node.type === 'text' ? node.text : '',
    ...node.children.filter((x): x is HostNode => x instanceof HostNode).map(texts),
  ].join('');
}
describe('public React primitives', () => {
  it('routes unsupported host errors to the root error callback', async () => {
    const onError = vi.fn();
    const { root, layout } = await setup(onError);
    root.render(createElement('div'));
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(String(onError.mock.calls[0]![0])).toContain('Unsupported');
    root.destroy();
    layout.dispose();
  });
  it('commits hook updates and releases every Yoga node and effect on unmount', async () => {
    const { root, layout, create, free } = await setup();
    const cleanup = vi.fn();
    let increment: (() => void) | undefined;
    function Counter() {
      const [count, setCount] = useState(0);
      useEffect(() => cleanup, []);
      increment = () => setCount((x) => x + 1);
      return createElement(
        View,
        { onPress: () => increment?.(), label: 'Increase' },
        createElement(Text, null, 'Count ' + count),
      );
    }
    root.render(createElement(Counter));
    await vi.waitFor(() => expect(texts(root.root)).toBe('Count 0'));
    increment!();
    await vi.waitFor(() => expect(texts(root.root)).toBe('Count 1'));
    layout.calculate(root.root.yoga, 320, 200);
    root.destroy();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(free).toHaveBeenCalledTimes(create.mock.calls.length);
    layout.dispose();
  });
  it('reorders keyed children and frees removed nodes', async () => {
    const { root, layout, create, free } = await setup();
    const list = (ids: string[]) =>
      createElement(
        View,
        null,
        ids.map((id) => createElement(Text, { key: id }, id)),
      );
    root.render(list(['A', 'B', 'C']));
    await vi.waitFor(() => expect(texts(root.root)).toBe('ABC'));
    root.render(list(['C', 'A']));
    await vi.waitFor(() => expect(texts(root.root)).toBe('CA'));
    root.destroy();
    expect(free).toHaveBeenCalledTimes(create.mock.calls.length);
    layout.dispose();
  });
});
