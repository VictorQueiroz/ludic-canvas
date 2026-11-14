import type { TextSelectionLayout } from '../gfx/font.ts';
import { HostNode } from '../runtime/nodes.ts';
import type { Painter } from '../runtime/paint.ts';
import { inside } from '../platform/pointer.ts';
import { isNativeScrollCallback, setScrollPosition } from '../scroll.ts';

interface Run {
  node: HostNode;
  layout: TextSelectionLayout;
  scale: number;
}
interface Position {
  node: HostNode;
  offset: number;
}
type Unit = 'character' | 'word' | 'paragraph';

/** Browser clipboard/gesture bridge. Geometry and highlight painting remain in the renderer. */
export class TextSelectionManager {
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly painter: Painter;
  readonly accepts: (node: HostNode, x: number, y: number) => boolean;
  readonly activity: () => void;
  readonly #events = new AbortController();
  readonly #proxy: HTMLSpanElement;
  #runs: Run[] = [];
  #anchor?: Position;
  #focus?: Position;
  #drag?: { id: number; x: number; y: number; seed: readonly [Position, Position]; unit: Unit };
  #click = { time: 0, x: 0, y: 0, count: 0 };
  #marked = new Set<HostNode>();
  #text = '';
  #signature = '';
  #lastFrame = 0;
  #enabled = true;
  #modal?: HostNode;
  #longPress?: ReturnType<typeof setTimeout>;
  #touch?: { id: number; x: number; y: number };
  #handles: HTMLButtonElement[] = [];
  #menu?: HTMLDivElement;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    painter: Painter,
    accepts: (node: HostNode, x: number, y: number) => boolean,
    activity: () => void,
  ) {
    this.canvas = canvas;
    this.container = container;
    this.painter = painter;
    this.accepts = accepts;
    this.activity = activity;
    this.#proxy = document.createElement('span');
    this.#proxy.dataset.ludicTextSelection = '';
    this.#proxy.setAttribute('aria-hidden', 'true');
    this.#proxy.style.cssText =
      'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:pre;pointer-events:none;user-select:text';
    container.append(this.#proxy);
    const options = { signal: this.#events.signal };
    for (const surface of [canvas, container])
      surface.addEventListener(
        'contextmenu',
        (event) => {
          if (!this.#enabled || !this.#text || this.#editing(event.target)) return;
          event.preventDefault();
          const rect = canvas.getBoundingClientRect();
          this.#showMenu(event.clientX - rect.left, event.clientY - rect.top);
        },
        options,
      );
    document.addEventListener(
      'copy',
      (event) => {
        if (!this.#ownsSelection() || !this.#text || !this.#enabled || this.#editing(event.target)) return;
        event.clipboardData?.setData('text/plain', this.#text);
        event.preventDefault();
      },
      options,
    );
    document.addEventListener(
      'selectionchange',
      () => {
        if (this.#text && !this.#ownsSelection()) this.clear(false);
      },
      options,
    );
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (this.#editing(event.target) || (event.target !== canvas && !container.contains(event.target as Node)))
          this.clear();
        else if (!this.#menu?.contains(event.target as Node)) this.#hideMenu();
      },
      options,
    );
    window.addEventListener('blur', () => this.cancel(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.cancel();
      },
      options,
    );
  }

  #editing(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('input,textarea,[contenteditable="true"]'));
  }
  #ownsSelection() {
    const anchor = document.getSelection()?.anchorNode;
    return Boolean(anchor && (anchor === this.#proxy || this.#proxy.contains(anchor)));
  }
  #policy(node: HostNode) {
    for (let n: HostNode | undefined = node; n; n = n.parent) {
      if (n.props.pointerEvents === 'none' || n.props.disabled || n.props.editor) return 'none';
    }
    for (let n: HostNode | undefined = node; n; n = n.parent) {
      if (n.props.userSelect && n.props.userSelect !== 'auto') return n.props.userSelect;
      if (n.props.onPress || n.props.focusable) return 'none';
      if (
        ['onPointerDown', 'onPointerMove', 'onPointerUp'].some((key) => {
          const handler = n.props[key as 'onPointerDown'];
          return handler && !isNativeScrollCallback(handler);
        })
      )
        return 'none';
    }
    return 'text';
  }
  sync(enabled: boolean, modal: HostNode | undefined) {
    this.#enabled = enabled;
    if (modal !== this.#modal || !enabled) this.clear();
    this.#modal = modal;
    const visible = new Set(this.painter.visible);
    const runs: Run[] = [];
    const visit = (node: HostNode) => {
      if (!visible.has(node) || node.destroyed) return;
      if (node.type === 'text' && inside(node, modal) && this.#policy(node) !== 'none') {
        const layout = node.shape(node.box.w).selection;
        if (layout.text) runs.push({ node, layout, scale: node.abs.w / node.box.w || 1 });
      }
      for (const child of node.children) if (child instanceof HostNode) visit(child);
    };
    const root = this.painter.visible[0];
    if (root) visit(root);
    const changed = runs.map((run) => `${run.node.id}:${run.layout.text}`).join('\0');
    if (this.#signature !== changed) this.clear();
    this.#signature = changed;
    this.#runs = runs;
    const now = performance.now();
    if (this.#drag) {
      const elapsed = Math.min(50, now - (this.#lastFrame || now));
      const origin = this.#runs.find((run) => run.node === this.#drag!.seed[0].node)?.node;
      for (let node = origin?.parent; node; node = node.parent) {
        if (node.props.style?.overflow !== 'scroll') continue;
        const box = node.abs,
          edge = Math.min(24, box.h / 4);
        const delta =
          this.#drag.y < box.y + edge
            ? this.#drag.y - box.y - edge
            : this.#drag.y > box.y + box.h - edge
              ? this.#drag.y - box.y - box.h + edge
              : 0;
        const before = node.scrollY;
        if (delta) setScrollPosition(node, before + (Math.max(-24, Math.min(24, delta * 0.2)) * elapsed) / 16);
        if (node.scrollY !== before) break;
      }
      this.#extend(this.#drag.x, this.#drag.y);
    }
    this.#lastFrame = now;
    this.#paint();
    this.#placeHandles();
  }
  #at(x: number, y: number, nearest = false): Position | undefined {
    let best: Position | undefined,
      distance = Infinity;
    for (const run of [...this.#runs].reverse()) {
      const { node, layout, scale } = run;
      const clip = node.clip;
      if (!nearest && clip && (x < clip.x || x > clip.x + clip.w || y < clip.y || y > clip.y + clip.h)) continue;
      if (!nearest && !this.accepts(node, x, y)) continue;
      for (const line of layout.lines) {
        const left = node.abs.x + line.x * scale,
          top = node.abs.y + line.y * scale;
        const right = left + line.width * scale,
          bottom = top + line.height * scale;
        if (!nearest && (x < left || x > right || y < top || y > bottom)) continue;
        const dy = Math.max(top - y, 0, y - bottom),
          dx = Math.max(left - x, 0, x - right);
        const score = dy * dy * 1000 + dx * dx;
        if (score >= distance) continue;
        let offset = line.start;
        for (const cell of layout.cells) {
          if (layout.lines[cell.line] !== line) continue;
          offset = x < node.abs.x + ((cell.x0 + cell.x1) * scale) / 2 ? cell.start : cell.end;
          if (offset === cell.start) break;
        }
        // The renderer has no bidi/shaping yet. Never expose a caret inside a Unicode grapheme.
        const boundaries = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(layout.text)];
        const cluster = boundaries.find((part) => offset > part.index && offset < part.index + part.segment.length);
        if (cluster)
          offset =
            offset - cluster.index < cluster.segment.length / 2
              ? cluster.index
              : cluster.index + cluster.segment.length;
        best = { node, offset };
        distance = score;
      }
    }
    return best;
  }
  #compare(a: Position, b: Position) {
    return a.node === b.node
      ? a.offset - b.offset
      : this.#runs.findIndex((run) => run.node === a.node) - this.#runs.findIndex((run) => run.node === b.node);
  }
  #bounds(position: Position, unit: Unit): readonly [Position, Position] {
    const run = this.#runs.find((run) => run.node === position.node)!;
    const text = run.layout.text;
    let start = position.offset,
      end = start;
    if (this.#policy(position.node) === 'all') {
      let scope = position.node;
      for (let n: HostNode | undefined = position.node; n; n = n.parent) {
        if (n.props.userSelect === 'all') {
          scope = n;
          break;
        }
      }
      const members = this.#runs.filter((run) => inside(run.node, scope));
      return [
        { node: members[0]!.node, offset: 0 },
        { node: members.at(-1)!.node, offset: members.at(-1)!.layout.text.length },
      ];
    } else if (unit === 'word') {
      const parts = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)];
      const part = parts.find((p) => start >= p.index && start < p.index + p.segment.length) ?? parts.at(-1);
      if (part) {
        start = part.index;
        end = start + part.segment.length;
      }
    } else if (unit === 'paragraph') {
      start = text.lastIndexOf('\n', Math.max(-1, start - 1)) + 1;
      const next = text.indexOf('\n', position.offset);
      end = next < 0 ? text.length : next + 1;
    }
    return [
      { node: position.node, offset: start },
      { node: position.node, offset: end },
    ];
  }
  #extend(x: number, y: number) {
    const drag = this.#drag,
      point = this.#at(x, y, true);
    if (!drag || !point) return;
    const [start, end] = this.#bounds(point, drag.unit);
    const reverse = this.#compare(point, drag.seed[0]) < 0;
    this.#anchor = reverse ? drag.seed[1] : drag.seed[0];
    this.#focus = reverse ? start : end;
    this.#paint();
  }
  pointerDown(event: PointerEvent): boolean {
    if (!this.#enabled || event.button !== 0 || !event.isPrimary) return false;
    const rect = this.canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    const point = this.#at(x, y);
    if (event.pointerType === 'touch') {
      this.cancel();
      if (!point) return false;
      this.#touch = { id: event.pointerId, x, y };
      this.#longPress = setTimeout(() => {
        this.#longPress = undefined;
        if (!this.#touch || !this.#enabled || !this.#runs.some((run) => run.node === point.node)) return;
        const [start, end] = this.#bounds(point, 'word');
        this.#anchor = start;
        this.#focus = end;
        this.#paint();
        this.#showHandles();
        this.#showMenu(x, y - 46);
        this.activity();
      }, 500);
      return false;
    }
    if (!point) {
      this.clear();
      return false;
    }
    this.#hideHandles();
    this.#hideMenu();
    const time = performance.now();
    const count =
      time - this.#click.time < 500 && Math.hypot(x - this.#click.x, y - this.#click.y) < 5
        ? (this.#click.count % 3) + 1
        : 1;
    this.#click = { time, x, y, count };
    const unit: Unit = count === 2 ? 'word' : count === 3 ? 'paragraph' : 'character';
    let seed = this.#bounds(point, unit);
    if (event.shiftKey && this.#anchor) seed = [this.#anchor, this.#anchor];
    this.#drag = { id: event.pointerId, x, y, seed, unit };
    this.#anchor = seed[0];
    this.#focus = seed[1];
    if (event.shiftKey) this.#extend(x, y);
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    this.#paint();
    this.activity();
    return true;
  }
  pointerMove(event: PointerEvent): boolean {
    const rect = this.canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    if (this.#touch?.id === event.pointerId && Math.hypot(x - this.#touch.x, y - this.#touch.y) > 8) this.cancel();
    if (this.#drag?.id === event.pointerId) {
      this.#drag.x = x;
      this.#drag.y = y;
      this.#extend(x, y);
      event.preventDefault();
      this.activity();
      return true;
    }
    return false;
  }
  pointerUp(event: PointerEvent): boolean {
    if (this.#touch?.id === event.pointerId) this.cancel();
    if (this.#drag?.id !== event.pointerId) return false;
    this.pointerMove(event);
    this.cancel();
    return true;
  }
  hover(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    if (this.#at(event.clientX - rect.left, event.clientY - rect.top)) this.canvas.style.cursor = 'text';
  }
  contains(x: number, y: number) {
    const bounds = this.canvas.getBoundingClientRect();
    return this.#enabled && x >= 0 && y >= 0 && x < bounds.width && y < bounds.height && Boolean(this.#at(x, y));
  }
  key(event: KeyboardEvent): boolean {
    if (!this.#enabled || this.#editing(event.target) || event.isComposing) return false;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a') {
      const first = this.#runs[0],
        last = this.#runs.at(-1);
      if (!first || !last) return false;
      this.#anchor = { node: first.node, offset: 0 };
      this.#focus = { node: last.node, offset: last.layout.text.length };
    } else if (event.key === 'Escape' && this.#anchor) this.clear();
    else return false;
    event.preventDefault();
    event.stopPropagation();
    this.#paint();
    this.activity();
    return true;
  }
  #paint() {
    for (const node of this.#marked) node.textSelection = undefined;
    this.#marked.clear();
    let text = '';
    if (this.#anchor && this.#focus && this.#compare(this.#anchor, this.#focus) !== 0) {
      const [start, end] =
        this.#compare(this.#anchor, this.#focus) < 0 ? [this.#anchor, this.#focus] : [this.#focus, this.#anchor];
      let included = false;
      for (const run of this.#runs) {
        if (run.node === start.node) included = true;
        if (!included) continue;
        const from = run.node === start.node ? start.offset : 0,
          to = run.node === end.node ? end.offset : run.layout.text.length;
        run.node.textSelection = [from, to];
        this.#marked.add(run.node);
        text += (text ? '\n' : '') + run.layout.text.slice(from, to);
        if (run.node === end.node) break;
      }
    }
    if (text !== this.#text) {
      const owned = this.#ownsSelection();
      this.#text = text;
      this.#proxy.textContent = text;
      if (text) {
        const selection = document.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.#proxy);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else if (owned) document.getSelection()?.removeAllRanges();
    }
  }
  cancel() {
    clearTimeout(this.#longPress);
    this.#longPress = undefined;
    this.#touch = undefined;
    const id = this.#drag?.id;
    this.#drag = undefined;
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }
  clear(native = true) {
    this.cancel();
    this.#hideHandles();
    this.#hideMenu();
    const owned = this.#ownsSelection();
    this.#anchor = this.#focus = undefined;
    for (const node of this.#marked) node.textSelection = undefined;
    this.#marked.clear();
    this.#text = '';
    this.#proxy.textContent = '';
    if (native && owned) document.getSelection()?.removeAllRanges();
  }
  #showHandles() {
    this.#hideHandles();
    for (const endpoint of ['anchor', 'focus'] as const) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.tabIndex = -1;
      handle.setAttribute('aria-label', `Move selection ${endpoint === 'anchor' ? 'start' : 'end'}`);
      handle.dataset.ludicSelectionHandle = endpoint;
      handle.style.cssText =
        'position:absolute;width:22px;height:22px;padding:0;margin:0;border:2px solid white;border-radius:50%;background:#295cc0;pointer-events:auto;touch-action:none;transform:translate(-50%,0);z-index:2147483647';
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const rect = this.canvas.getBoundingClientRect(),
          point = this.#at(e.clientX - rect.left, e.clientY - rect.top - 10, true);
        if (point) {
          if (endpoint === 'anchor') this.#anchor = point;
          else this.#focus = point;
          this.#paint();
          this.#placeHandles();
          this.activity();
        }
      });
      this.container.append(handle);
      this.#handles.push(handle);
    }
    this.#placeHandles();
  }
  #placeHandles() {
    for (let i = 0; i < this.#handles.length; i++) {
      const position = i === 0 ? this.#anchor : this.#focus;
      const run = this.#runs.find((r) => r.node === position?.node);
      if (!run || !position) {
        this.#hideHandles();
        return;
      }
      const cell =
        run.layout.cells.find((c) => position.offset >= c.start && position.offset < c.end) ?? run.layout.cells.at(-1);
      const line = run.layout.lines[cell?.line ?? 0]!;
      const x = run.node.abs.x + (cell ? (position.offset <= cell.start ? cell.x0 : cell.x1) : line.x) * run.scale;
      const y = run.node.abs.y + (line.y + line.height) * run.scale;
      const clip = run.node.clip;
      const visible = !clip || (x >= clip.x && x <= clip.x + clip.w && y >= clip.y && y <= clip.y + clip.h);
      Object.assign(this.#handles[i]!.style, {
        left: `${x}px`,
        top: `${y}px`,
        visibility: visible ? 'visible' : 'hidden',
      });
    }
  }
  #hideHandles() {
    for (const handle of this.#handles) handle.remove();
    this.#handles = [];
  }
  #showMenu(x: number, y: number) {
    this.#hideMenu();
    const menu = document.createElement('div');
    menu.dataset.ludicSelectionMenu = '';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Text selection');
    const rect = this.canvas.getBoundingClientRect();
    menu.style.cssText = `position:absolute;left:${Math.max(0, Math.min(x, rect.width - 170))}px;top:${Math.max(0, Math.min(y, rect.height - 44))}px;display:flex;gap:4px;padding:4px;background:#18253c;border:1px solid #61718f;border-radius:6px;pointer-events:auto;user-select:none;z-index:2147483647`;
    const button = (label: string, action: () => void) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = label;
      control.setAttribute('role', 'menuitem');
      control.style.cssText =
        'appearance:none;position:static;transform:none;margin:0;padding:8px 12px;width:auto;height:auto;border:0;border-radius:3px;background:#233754;color:white;font:14px system-ui;cursor:pointer';
      control.addEventListener('pointerdown', (e) => e.preventDefault());
      control.addEventListener('click', action);
      menu.append(control);
    };
    button('Copy', () => {
      // The DOM selection proxy also supports the browser's own Copy command.
      const copy = navigator.clipboard?.writeText(this.#text);
      if (copy)
        void copy.catch(() => {
          document.execCommand('copy');
        });
      else document.execCommand('copy');
      this.#hideMenu();
      this.canvas.focus({ preventScroll: true });
    });
    button('Select all', () => {
      const first = this.#runs[0],
        last = this.#runs.at(-1);
      if (first && last) {
        this.#anchor = { node: first.node, offset: 0 };
        this.#focus = { node: last.node, offset: last.layout.text.length };
        this.#paint();
        this.activity();
      }
      this.#hideMenu();
      this.canvas.focus({ preventScroll: true });
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.#hideMenu();
        this.canvas.focus({ preventScroll: true });
      }
    });
    this.container.append(menu);
    this.#menu = menu;
  }
  #hideMenu() {
    this.#menu?.remove();
    this.#menu = undefined;
  }
  destroy() {
    this.clear();
    this.#events.abort();
    this.#proxy.remove();
    this.#runs = [];
  }
}
