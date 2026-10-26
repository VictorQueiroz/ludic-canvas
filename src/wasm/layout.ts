// Adapter: Yoga (compiled into lc_layout.wasm by our own toolchain) behind a
// small object API. Nodes are opaque 32-bit handles; text measurement calls
// back into JavaScript through the `lcl_measure` import.

import { LAYOUT_ABI_VERSION, MeasureMode } from './abi.ts';
import { hostImports, instantiate } from './host.ts';

interface LayoutExports {
  memory: WebAssembly.Memory;
  lcl_abi_version(): number;
  lcl_measure_slot(): number;
  lcl_set_point_scale(scale: number): void;
  lcl_node_new(): number;
  lcl_node_free(n: number): void;
  lcl_insert_child(p: number, c: number, i: number): void;
  lcl_remove_child(p: number, c: number): void;
  lcl_child_count(n: number): number;
  lcl_mark_dirty(n: number): void;
  lcl_set_measured(n: number, ctx: number): void;
  lcl_set_enum(n: number, prop: number, v: number): void;
  lcl_set_number(n: number, prop: number, v: number): void;
  lcl_set_length(n: number, prop: number, slot: number, v: number, unit: number): void;
  lcl_calculate(root: number, w: number, h: number): void;
  lcl_has_new_layout(n: number): number;
  lcl_read_layouts(handles: number, count: number, out: number): void;
  lcl_alloc(bytes: number): number;
  lcl_free(p: number): void;
}

export type MeasureFn = (width: number, widthMode: number, height: number, heightMode: number) => [number, number];

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class YogaLayout {
  readonly #x: LayoutExports;
  readonly #measurers = new Map<number, MeasureFn>();
  #nextMeasureId = 1;
  #scratch = { ptr: 0, capacity: 0 };

  private constructor(x: LayoutExports) {
    this.#x = x;
    if (x.lcl_abi_version() !== LAYOUT_ABI_VERSION) throw new Error('lc_layout ABI mismatch');
  }

  static async load(
    source: string | ArrayBuffer | Uint8Array,
    options: { signal?: AbortSignal; maxBytes?: number } = {},
  ): Promise<YogaLayout> {
    let self: YogaLayout | undefined;
    const { instance } = await instantiate(
      source,
      (mem) =>
        hostImports('lc_layout', mem, {
          lcl_measure(ctx: number, w: number, wm: number, h: number, hm: number) {
            self!.#measure(ctx, w, wm, h, hm);
          },
        }),
      options,
    );
    self = new YogaLayout(instance.exports as unknown as LayoutExports);
    return self;
  }

  #measure(ctx: number, w: number, wm: number, h: number, hm: number) {
    const fn = this.#measurers.get(ctx);
    const [mw, mh] = fn
      ? fn(wm === MeasureMode.Undefined ? Infinity : w, wm, hm === MeasureMode.Undefined ? Infinity : h, hm)
      : [0, 0];
    const slot = new Float32Array(this.#x.memory.buffer, this.#x.lcl_measure_slot(), 2);
    slot[0] = mw;
    slot[1] = mh;
  }

  dispose() {
    if (this.#scratch.ptr) this.#x.lcl_free(this.#scratch.ptr);
    this.#scratch = { ptr: 0, capacity: 0 };
    this.#measurers.clear();
  }

  setPointScale(scale: number) {
    this.#x.lcl_set_point_scale(scale);
  }
  create(): number {
    return this.#x.lcl_node_new();
  }
  free(node: number) {
    this.#x.lcl_node_free(node);
  }
  insert(parent: number, child: number, index: number) {
    this.#x.lcl_insert_child(parent, child, index);
  }
  remove(parent: number, child: number) {
    this.#x.lcl_remove_child(parent, child);
  }
  childCount(node: number) {
    return this.#x.lcl_child_count(node);
  }

  /** Turns a leaf into a host-measured node (text). Returns the measurer id. */
  setMeasure(node: number, fn: MeasureFn | undefined): number {
    if (!fn) {
      this.#x.lcl_set_measured(node, 0);
      return 0;
    }
    const id = this.#nextMeasureId++;
    this.#measurers.set(id, fn);
    this.#x.lcl_set_measured(node, id);
    return id;
  }
  releaseMeasure(id: number) {
    this.#measurers.delete(id);
  }
  markDirty(node: number) {
    this.#x.lcl_mark_dirty(node);
  }

  setEnum(node: number, prop: number, value: number) {
    this.#x.lcl_set_enum(node, prop, value);
  }
  setNumber(node: number, prop: number, value: number) {
    this.#x.lcl_set_number(node, prop, value);
  }
  setLength(node: number, prop: number, slot: number, value: number, unit: number) {
    this.#x.lcl_set_length(node, prop, slot, value, unit);
  }

  calculate(root: number, width: number, height: number) {
    this.#x.lcl_calculate(root, width, height);
  }
  hasNewLayout(node: number) {
    return this.#x.lcl_has_new_layout(node) === 1;
  }

  /** Reads [left, top, width, height] for many nodes in one boundary crossing. */
  readLayouts(nodes: Uint32Array, out: Float32Array) {
    const needed = nodes.length * 4 + nodes.length * 16;
    if (this.#scratch.capacity < needed) {
      if (this.#scratch.ptr) this.#x.lcl_free(this.#scratch.ptr);
      this.#scratch = { ptr: this.#x.lcl_alloc(needed * 2), capacity: needed * 2 };
    }
    const handles = this.#scratch.ptr;
    const results = handles + nodes.length * 4;
    new Uint32Array(this.#x.memory.buffer, handles, nodes.length).set(nodes);
    this.#x.lcl_read_layouts(handles, nodes.length, results);
    out.set(new Float32Array(this.#x.memory.buffer, results, nodes.length * 4));
  }
}
