import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { YogaLayout } from '../src/wasm/layout.ts';
import { EnumProp, LengthProp, NumberProp, FLEX_DIRECTION, Unit, Edge } from '../src/wasm/abi.ts';
const bytes = readFileSync(new URL('../assets/layout.wasm', import.meta.url));
describe('committed Yoga reactor', () => {
  it('reads resolved percentage padding inside padded containing blocks', async () => {
    const layout = await YogaLayout.load(bytes),
      root = layout.create(),
      scroller = layout.create();
    layout.setLength(root, LengthProp.Padding, Edge.All, 20, Unit.Point);
    layout.setLength(scroller, LengthProp.Padding, Edge.Bottom, 10, Unit.Percent);
    layout.insert(root, scroller, 0);
    layout.calculate(root, 300, 200);
    expect(layout.paddingBottom(scroller)).toBeCloseTo(26);
    layout.remove(root, scroller);
    layout.free(scroller);
    layout.free(root);
    layout.dispose();
  });
  it('exposes only the neutral layout ABI and expected imports', async () => {
    const module = await WebAssembly.compile(bytes);
    expect(WebAssembly.Module.exports(module).map((x) => x.name)).toContain('lcl_abi_version');
    expect(
      WebAssembly.Module.imports(module)
        .map((x) => x.module + '.' + x.name)
        .sort(),
    ).toEqual([
      'env.lc_log',
      'env.lcl_measure',
      'wasi_snapshot_preview1.fd_fdstat_get',
      'wasi_snapshot_preview1.fd_write',
    ]);
  });
  it('lays out a fixed and flexible child through a bulk memory read', async () => {
    const layout = await YogaLayout.load(bytes);
    const root = layout.create(),
      a = layout.create(),
      b = layout.create();
    layout.setEnum(root, EnumProp.FlexDirection, FLEX_DIRECTION.row);
    layout.setLength(a, LengthProp.Width, 0, 80, Unit.Point);
    layout.setNumber(b, NumberProp.FlexGrow, 1);
    layout.insert(root, a, 0);
    layout.insert(root, b, 1);
    layout.calculate(root, 300, 100);
    const output = new Float32Array(12);
    layout.readLayouts(new Uint32Array([root, a, b]), output);
    expect([...output]).toEqual([0, 0, 300, 100, 0, 0, 80, 100, 80, 0, 220, 100]);
    layout.remove(root, a);
    layout.remove(root, b);
    layout.free(a);
    layout.free(b);
    layout.free(root);
    layout.dispose();
  });
  it('remeasures host text after invalidation', async () => {
    const layout = await YogaLayout.load(bytes);
    const root = layout.create(),
      leaf = layout.create();
    let width = 75;
    const measure = layout.setMeasure(leaf, () => [width, 24]);
    layout.setEnum(root, EnumProp.AlignItems, 1);
    layout.insert(root, leaf, 0);
    layout.calculate(root, 400, 100);
    const output = new Float32Array(4);
    layout.readLayouts(new Uint32Array([leaf]), output);
    expect([...output]).toEqual([0, 0, 75, 24]);
    width = 125;
    layout.markDirty(leaf);
    layout.calculate(root, 400, 100);
    layout.readLayouts(new Uint32Array([leaf]), output);
    expect(output[2]).toBe(125);
    layout.releaseMeasure(measure);
    layout.remove(root, leaf);
    layout.free(leaf);
    layout.free(root);
    layout.dispose();
  });
});
