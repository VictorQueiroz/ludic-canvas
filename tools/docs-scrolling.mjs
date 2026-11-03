export function scrollingGuide(code) {
  return `<p>Browser roots use native scrolling for supported <code>ScrollArea</code> and <code>VirtualList</code> surfaces. The browser owns dragging, momentum and overscroll, moving prepared canvas tiles. React owns composition and state, Yoga owns geometry, and the application still supplies frames.</p>${code(
    `// Automatic native presentation with a safe canvas fallback:
const ui = await createUI({ canvas });
ui.render(<ScrollArea label="Inventory" scrollHandle={scroll}
  style={{ flex: 1 }}>{items}</ScrollArea>);

// Preserve the single-canvas/custom-input path for a region or root:
<ScrollArea scrollMode="canvas" label="Custom gesture area">{items}</ScrollArea>
const gameUI = await createUI({ canvas, context: gameContext, scrollMode: 'canvas' });

// Require native support; unsupported arrangements report an error:
<VirtualList scrollMode="native" {...listProps} />
const mode = scroll.getSnapshot().mode; // 'native' or 'canvas' after layout`,
    'tsx',
    'Scroll presentation',
  )}
<p>The default <code>auto</code> mode supports unscaled, topmost scrolling panels fully inside a root-owned WebGL canvas, with labeled pressable children. Shared engine contexts, nested scrollers, interior clipping, native editors, custom pointer/wheel handlers, blocking descendants, hover-only targets without native controls, overlapping foreground content, unlabeled controls and browser extent/resource limits retain canvas presentation. Use <code>native</code> only when your layout guarantees those conditions. Portable hosts use canvas presentation.</p>
<p>The same mounted tree, textures and font registrations render native tiles. <code>VirtualList</code> prepares a bounded raster window in addition to its requested row overscan; it still does not mount the full collection. Existing scroll/focus commands settle in the next application frame. Snapshots describe the latest frame, while native motion can advance between frames. Keep drawing during scrolling so the browser does not outrun the prepared tiles.</p>
<p><code>nativeScrollBudgetBytes</code> defaults to 16 MiB of estimated tile RGBA storage per root. <code>frame().nativeScroll</code> reports regions, tiles, estimated bytes and copy-call work. These exclude browser/GPU overhead and do not measure presentation. The <a href="/native-scroll/">original comparison experiment</a> explains the validation approach; read <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/docs/SCROLLING.md">the full scrolling contract</a> for the support boundary.</p>`;
}
