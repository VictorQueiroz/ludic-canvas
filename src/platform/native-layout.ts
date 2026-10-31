import type { LayoutBackend, MeasureFn } from './contracts.ts';

/** Native binding operations; versioned independently from the WASM pointer ABI. */
export const NATIVE_LAYOUT_VERSION = 1;
export interface NativeLayoutBinding {
  createLayout(
    measure: (id: number, width: number, widthMode: number, height: number, heightMode: number) => [number, number],
  ): number;
  layout(context: number, operation: number, ...args: number[]): number;
  readLayouts(context: number, nodes: Uint32Array, boxes: Float32Array): void;
}

export class NativeYogaLayout implements LayoutBackend {
  readonly #binding: NativeLayoutBinding;
  readonly #context: number;
  #measurers = new Map<number, MeasureFn>();
  #next = 0;
  #disposed = false;
  constructor(binding: NativeLayoutBinding) {
    this.#binding = binding;
    this.#context = binding.createLayout(
      (id, w, wm, h, hm) =>
        this.#measurers.get(id)?.(wm === 0 ? Infinity : w, wm, hm === 0 ? Infinity : h, hm) ?? [0, 0],
    );
  }
  #call(operation: number, ...args: number[]) {
    if (this.#disposed) throw new Error('Layout context destroyed');
    return this.#binding.layout(this.#context, operation, ...args);
  }
  dispose() {
    if (this.#disposed) return;
    this.#call(0);
    this.#disposed = true;
    this.#measurers.clear();
  }
  create() {
    return this.#call(1);
  }
  free(n: number) {
    this.#call(2, n);
  }
  insert(p: number, c: number, i: number) {
    this.#call(3, p, c, i);
  }
  remove(p: number, c: number) {
    this.#call(4, p, c);
  }
  childCount(n: number) {
    return this.#call(5, n);
  }
  setPointScale(scale: number) {
    this.#call(6, scale);
  }
  setMeasure(n: number, fn: MeasureFn | undefined) {
    const id = fn ? ++this.#next : 0;
    if (fn) this.#measurers.set(id, fn);
    this.#call(7, n, id);
    return id;
  }
  releaseMeasure(id: number) {
    this.#measurers.delete(id);
  }
  markDirty(n: number) {
    this.#call(8, n);
  }
  setEnum(n: number, prop: number, value: number) {
    this.#call(9, n, prop, value);
  }
  setNumber(n: number, prop: number, value: number) {
    this.#call(10, n, prop, value);
  }
  setLength(n: number, prop: number, slot: number, value: number, unit: number) {
    this.#call(11, n, prop, slot, value, unit);
  }
  calculate(root: number, width: number, height: number) {
    this.#call(12, root, width, height);
  }
  hasNewLayout(n: number) {
    return this.#call(13, n) === 1;
  }
  paddingBottom(n: number) {
    return this.#call(14, n);
  }
  readLayouts(nodes: Uint32Array, boxes: Float32Array) {
    if (this.#disposed) throw new Error('Layout context destroyed');
    if (boxes.length < nodes.length * 4) throw new Error('Layout result buffer is too small');
    this.#binding.readLayouts(this.#context, nodes, boxes);
  }
}
