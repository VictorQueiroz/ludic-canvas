import { createUI, createScrollHandle, ScrollArea, Text, View, type UIRoot } from 'ludic-canvas';
import { memo, useLayoutEffect } from 'react';
import { planTiles, RASTER_BUDGET, TILE_HEIGHT } from './tiles.ts';
import { version } from '../../package.json';

declare const __LUDIC_REVISION__: string;
const ROW_COUNT = 100;
const ROW_HEIGHT = 72;
const ownerKey = Symbol.for('ludic-canvas.native-scroll-experiment');
const items = Array.from({ length: ROW_COUNT }, (_, index) => ({
  title: `Item ${index + 1}`,
  detail: `Survey record ${String(index + 1).padStart(3, '0')}`,
}));

const Rows = memo(function Rows({ selected, select }: { selected: number; select?: (index: number) => void }) {
  return items.map((item, index) => (
    <View
      key={index}
      label={select ? item.title : undefined}
      onPress={select ? () => select(index) : undefined}
      style={{
        height: ROW_HEIGHT,
        flexShrink: 0,
        paddingX: 18,
        justifyContent: 'center',
        gap: 3,
        borderWidth: 1,
        borderColor: '#293850',
        background: selected === index ? '#244a52' : index % 2 ? '#142238' : '#101c30',
      }}
    >
      <Text style={{ fontSize: 23, color: '#eef4ff' }}>{item.title}</Text>
      <Text style={{ fontSize: 15, color: '#a8b9d1' }}>{item.detail}</Text>
    </View>
  ));
});

function TileScene({ offset, selected, committed }: { offset: number; selected: number; committed: () => void }) {
  useLayoutEffect(committed, [committed]);
  return (
    <View style={{ flex: 1, overflow: 'hidden', background: '#0c1323' }}>
      <View style={{ flexShrink: 0, translateY: -offset }}>
        <Rows selected={selected} />
      </View>
    </View>
  );
}

interface InspectedNode {
  box: [number, number, number, number];
  c: InspectedNode[];
}
interface CopySample {
  tile: number;
  sceneCommitMs: number;
  frameCallMs: number;
  copyCallMs: number;
}
export async function createNativeScrollExperiment(scope: HTMLElement & { [ownerKey]?: object }) {
  if (scope[ownerKey]) throw new Error('This container already owns a scrolling experiment');
  const element = <T extends HTMLElement>(id: string) => {
    const result = scope.querySelector<T>(`#${id}`);
    if (!result) throw new Error(`Missing experiment element: ${id}`);
    return result;
  };
  const viewport = element<HTMLDivElement>('native-scroll');
  const content = element<HTMLDivElement>('native-content');
  const reference = element<HTMLDivElement>('dom-scroll');
  const canvas = element<HTMLCanvasElement>('canvas-scroll');
  const status = element('scroll-status');
  const output = element('scroll-diagnostics');
  const pause = element<HTMLButtonElement>('pause-drawing');
  const owner = {};
  scope[ownerKey] = owner;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const staging = document.createElement('div');
  staging.className = 'scroll-staging';
  staging.inert = true;
  staging.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('canvas');
  staging.append(stage);
  scope.append(staging);
  const tiles = new Map<number, HTMLCanvasElement>();
  const samples: CopySample[] = [];
  const errors: string[] = [];
  const roots: UIRoot[] = [];
  const canvasScroll = createScrollHandle();
  let selected = -1;
  let canvasSelected = -1;
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let painting = false;
  let requested = false;
  let pendingCommit: (() => void) | undefined;
  let stall = 0;
  let downloadUrl: string | undefined;
  let width = 0;
  let dpr = 1;
  let contentHeight = 0;
  let rowBoxes: InspectedNode['box'][] = [];
  let tilePaints = 0;
  let highWaterBytes = 0;
  let revision = 0;
  let observer: ResizeObserver | undefined;
  let stagingRoot: UIRoot;
  let canvasRoot: UIRoot;

  const report = (error: unknown) => {
    errors.push(String(error));
    status.textContent = `Experiment stopped: ${String(error)}`;
    destroy();
  };
  const snapshot = () => ({
    source: typeof __LUDIC_REVISION__ === 'undefined' ? 'unrecorded' : __LUDIC_REVISION__,
    packageVersion: version,
    userAgent: navigator.userAgent,
    devicePixelRatio: devicePixelRatio,
    rasterDpr: dpr,
    viewportWidth: width,
    viewportHeight: viewport.clientHeight,
    contentHeight,
    rawOffset: viewport.scrollTop,
    logicalOffset: Math.max(0, Math.min(viewport.scrollTop, Math.max(0, contentHeight - viewport.clientHeight))),
    mountedTiles: [...tiles.keys()],
    estimatedRasterBytes:
      [...tiles.values()].reduce((sum, tile) => sum + tile.width * tile.height * 4, 0) + stage.width * stage.height * 4,
    highWaterBytes,
    rasterBudgetBytes: RASTER_BUDGET,
    tilePaints,
    samples: [...samples],
    retainedRows: ROW_COUNT,
    selected,
    paused,
    destroyed,
    errors: [...errors],
    qualification:
      'Physical iPhone Chrome/Safari pending. Call timings and RGBA estimates are not GPU or presentation measurements.',
  });
  const publish = () => {
    const { samples, ...state } = snapshot();
    output.textContent = JSON.stringify({ ...state, recentCopies: samples.slice(-8) }, null, 2);
  };
  const releaseTiles = () => {
    for (const tile of tiles.values()) {
      tile.remove();
      tile.width = tile.height = 0;
    }
    tiles.clear();
  };
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    lifetime.abort();
    cancelAnimationFrame(raf);
    clearTimeout(stall);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    observer?.disconnect();
    pendingCommit?.();
    releaseTiles();
    for (const root of roots) root.destroy();
    roots.length = 0;
    nativeButtons.length = 0;
    rowBoxes = [];
    stage.width = stage.height = canvas.width = canvas.height = 0;
    staging.remove();
    content.replaceChildren();
    reference.replaceChildren();
    if (scope[ownerKey] === owner) delete scope[ownerKey];
    for (const button of scope.querySelectorAll<HTMLButtonElement>('.scroll-actions button')) button.disabled = true;
    if (!errors.length) status.textContent = 'Experiment stopped. Reload to start again.';
    publish();
  }
  const canvasScene = () => {
    canvasRoot.render(
      <ScrollArea label="Canvas items" scrollHandle={canvasScroll} style={{ flex: 1 }}>
        <Rows selected={canvasSelected} select={selectCanvas} />
      </ScrollArea>,
    );
  };
  function selectCanvas(index: number) {
    canvasSelected = index;
    element('canvas-selection').textContent = `Selected item ${index + 1}`;
    canvasScene();
  }
  const stageScene = (offset: number) =>
    new Promise<void>((resolve) => {
      pendingCommit = () => {
        pendingCommit = undefined;
        resolve();
      };
      stagingRoot.render(<TileScene offset={offset} selected={selected} committed={pendingCommit} />);
    });
  const nativeButtons: HTMLButtonElement[] = [];
  const selectNative = (index: number) => {
    selected = index;
    element('native-selection').textContent = `Selected item ${index + 1}`;
    for (const [i, button] of nativeButtons.entries()) button.setAttribute('aria-pressed', String(i === index));
    revision++;
    schedule();
  };
  const createButtons = () => {
    for (const [index, item] of items.entries()) {
      const native = document.createElement('button');
      native.type = 'button';
      native.className = 'scroll-item scroll-hit';
      native.textContent = item.title;
      native.setAttribute('aria-pressed', 'false');
      native.addEventListener('click', () => selectNative(index), { signal });
      content.append(native);
      nativeButtons.push(native);
      const dom = document.createElement('button');
      dom.type = 'button';
      dom.className = 'scroll-item';
      dom.append(item.title);
      const detail = document.createElement('small');
      detail.textContent = item.detail;
      dom.append(detail);
      dom.setAttribute('aria-pressed', 'false');
      dom.addEventListener(
        'click',
        () => {
          for (const button of reference.querySelectorAll('button'))
            button.setAttribute('aria-pressed', String(button === dom));
          element('dom-selection').textContent = `Selected item ${index + 1}`;
        },
        { signal },
      );
      reference.append(dom);
    }
  };
  let paintedRevision = -1;
  async function paintWindow() {
    if (destroyed || paused) return;
    const nextWidth = viewport.clientWidth;
    const nextDpr = Math.min(devicePixelRatio || 1, 2);
    if (!nextWidth) return;
    if (nextWidth !== width || nextDpr !== dpr) {
      releaseTiles();
      width = nextWidth;
      dpr = nextDpr;
      stage.style.width = `${width}px`;
      await stageScene(0);
      if (destroyed || paused) return;
      stagingRoot.frame();
      const tree = stagingRoot.inspect() as InspectedNode;
      const list = tree.c[0]?.c[0];
      if (!list || list.c.length !== ROW_COUNT) throw new Error('Unexpected Yoga list geometry');
      contentHeight = list.box[3];
      rowBoxes = list.c.map((row) => row.box);
      content.style.height = `${contentHeight}px`;
      for (const [index, button] of nativeButtons.entries()) {
        const box = rowBoxes[index]!;
        button.style.top = `${box[1]}px`;
        button.style.height = `${box[3]}px`;
      }
    }
    if (revision !== paintedRevision) {
      releaseTiles();
      paintedRevision = revision;
    }
    const plan = planTiles(viewport.scrollTop, width, viewport.clientHeight, contentHeight, dpr);
    for (const [index, tile] of tiles)
      if (!plan.indices.includes(index)) {
        tile.remove();
        tile.width = tile.height = 0;
        tiles.delete(index);
      }
    for (const index of plan.indices) {
      if (tiles.has(index)) continue;
      const tile = document.createElement('canvas');
      tile.className = 'scroll-tile';
      tile.setAttribute('aria-hidden', 'true');
      tile.dataset.tile = String(index);
      const height = Math.min(TILE_HEIGHT, contentHeight - index * TILE_HEIGHT);
      tile.width = Math.ceil(width * dpr);
      tile.height = Math.ceil(height * dpr);
      tile.style.cssText = `top:${index * TILE_HEIGHT}px;width:${width}px;height:${height}px`;
      const ctx = tile.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable for tile presentation');
      const begin = performance.now();
      await stageScene(index * TILE_HEIGHT);
      if (destroyed || paused) {
        tile.width = tile.height = 0;
        return;
      }
      const committed = performance.now();
      const frame = stagingRoot.frame();
      if (frame.contextLost) throw new Error('Staging WebGL context lost');
      const copied = performance.now();
      // Copy in the same task as drawing, before the default WebGL buffer is discarded.
      // drawImage may synchronize internally; this is not a zero-copy/GPU-time claim.
      ctx.drawImage(stage, 0, 0, stage.width, Math.ceil(height * dpr), 0, 0, tile.width, tile.height);
      samples.push({
        tile: index,
        sceneCommitMs: committed - begin,
        frameCallMs: copied - committed,
        copyCallMs: performance.now() - copied,
      });
      if (samples.length > 512) samples.shift();
      tilePaints++;
      content.append(tile);
      tiles.set(index, tile);
    }
    const bytes = snapshot().estimatedRasterBytes;
    if (bytes > RASTER_BUDGET) throw new Error('Prototype exceeded raster budget');
    highWaterBytes = Math.max(highWaterBytes, bytes);
    publish();
  }
  function schedule() {
    if (destroyed || paused) return;
    requested = true;
    if (raf || painting) return;
    raf = requestAnimationFrame(async () => {
      raf = 0;
      requested = false;
      painting = true;
      try {
        await paintWindow();
      } catch (error) {
        report(error);
      } finally {
        painting = false;
        if (requested) schedule();
      }
    });
  }
  function setPaused(value: boolean) {
    if (destroyed) return;
    paused = value;
    pause.setAttribute('aria-pressed', String(value));
    pause.textContent = value ? 'Resume drawing' : 'Pause drawing';
    if (value) canvasRoot.stop();
    else {
      canvasRoot.start();
      schedule();
    }
    publish();
  }
  try {
    stage.style.width = `${viewport.clientWidth}px`;
    stagingRoot = await createUI({
      canvas: stage,
      signal,
      autoStart: false,
      maxDpr: 2,
      clearColor: '#0c1323',
      onError: report,
      onContextLost: () => report('Staging WebGL context lost'),
    });
    roots.push(stagingRoot);
    canvasRoot = await createUI({
      canvas,
      signal,
      maxDpr: 2,
      clearColor: '#0c1323',
      onError: report,
      onContextLost: () => report('Reference WebGL context lost'),
    });
    roots.push(canvasRoot);
    canvasScene();
    createButtons();
    viewport.addEventListener('scroll', schedule, { passive: true, signal });
    pause.addEventListener('click', () => setPaused(!paused), { signal });
    element('reset-scroll').addEventListener(
      'click',
      () => {
        viewport.scrollTop = reference.scrollTop = 0;
        canvasScroll.scrollTo(0);
        schedule();
      },
      { signal },
    );
    element<HTMLButtonElement>('stall-script').addEventListener(
      'click',
      () => {
        clearTimeout(stall);
        status.textContent = 'Flick a list now: JavaScript will block for 250 ms in one second.';
        stall = window.setTimeout(() => {
          const until = performance.now() + 250;
          while (performance.now() < until) {
            /* Deliberate operator-triggered long task. */
          }
          status.textContent =
            'JavaScript block finished. Observe motion on your device; diagnostics do not measure presentation.';
        }, 1000);
      },
      { signal },
    );
    element('destroy-scroll').addEventListener('click', destroy, { signal });
    element('save-scroll-report').addEventListener(
      'click',
      () => {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(
          new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }),
        );
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'native-scroll-prototype.json';
        link.hidden = true;
        scope.append(link);
        link.click();
        link.remove();
      },
      { signal },
    );
    window.addEventListener(
      'pagehide',
      (event) => {
        if (!event.persisted) destroy();
      },
      { signal },
    );
    observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    painting = true;
    await paintWindow();
    painting = false;
    if (destroyed) throw new Error('Experiment stopped during initialization');
    status.textContent = 'Ready. Flick each list, then try stopping momentum and selecting an item.';
    return {
      snapshot,
      scrollTo: (offset: number) => {
        if (!Number.isFinite(offset)) throw new Error('Scroll offset must be finite');
        if (!destroyed) {
          viewport.scrollTop = offset;
          schedule();
        }
      },
      setPaused,
      refresh: schedule,
      destroy,
    };
  } catch (error) {
    report(error);
    throw error;
  }
}

export type NativeScrollExperiment = Awaited<ReturnType<typeof createNativeScrollExperiment>>;

declare global {
  interface Window {
    nativeScrollExperiment?: NativeScrollExperiment;
  }
}
const scope = document.querySelector<HTMLElement>('.native-scroll-document');
if (scope) {
  createNativeScrollExperiment(scope)
    .then((experiment) => {
      window.nativeScrollExperiment = experiment;
    })
    .catch(console.error);
}
