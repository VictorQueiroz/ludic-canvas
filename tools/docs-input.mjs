export function inputGuide(code, version) {
  const pending = Number(version.split('.')[0]) === 0 && Number(version.split('.')[1]) < 8;
  return `${pending ? '<p><strong>Unreleased:</strong> these APIs are available in the source checkout and its local tarball; npm 0.7.0 does not include them.</p>' : ''}
<p>Use <code>onWheel</code> when a map, viewport or custom control already receives pointer input through a View. Wheel input selects the frontmost input surface and bubbles through its ancestors. Overlapping controls, disabled controls and <code>block</code> panels keep events away from unrelated surfaces behind them, even without a wheel handler.</p>${code(
    `// Place this behind the sidebar as a sibling, not its ancestor.
<View onPointerDown={beginPan} onPointerMove={pan} onPointerUp={endPan}
  onWheel={(event) => {
    event.preventDefault();
    zoomMap(event); // Application-owned camera policy.
  }} style={{ position: 'absolute', width: '100%', height: '100%' }} />`,
    'tsx',
    'Wheel input in the UI tree',
  )}
<p><code>UIWheelEvent</code> exposes canvas CSS-pixel coordinates <code>x/y</code>, element-local <code>localX/localY</code>, raw <code>deltaX/Y/Z</code>, <code>deltaMode</code> (0 pixels, 1 lines, 2 pages), modifier keys and <code>defaultPrevented</code>. It is not a scroll-position notification. Choose camera sensitivity and trackpad-pinch policy in the application. Existing vertical scrolling uses 32 pixels per line and the scroller height per page.</p>
<p>Handlers run before default scrolling. <code>preventDefault()</code> cancels the library default and requests browser cancellation. <code>stopPropagation()</code> stops ancestor callbacks and DOM propagation but leaves default scrolling intact; it does not suppress other listeners on the same DOM element. Native textareas scroll themselves before chaining to an ancestor ScrollArea at their boundary. Disabled children still allow ancestor scrolling. Custom handlers also work on TextInput/TextArea.</p>
<p>For a camera controlled outside the UI tree, query the owning root directly:</p>${code(
    `stage.addEventListener('wheel', (event) => {
  if (ui.isPointerOverUI(event)) return;
  event.preventDefault();
  zoomWorld(event);
}, { passive: false, signal: sceneAbort.signal });`,
    'typescript',
    'External camera controls',
  )}
<p><code>isPointerOverUI({ clientX, clientY })</code> accepts viewport coordinates, including a browser pointer/wheel event. It reads the latest painted geometry without requiring a pointermove, dispatching events or drawing. Controls, wheel surfaces, scroll regions and <code>block</code> boxes count, including disabled controls. Ordinary decorative/layout boxes do not; use <code>block</code> for panel backgrounds. Clipping, transforms, stacking and <code>pointerEvents</code> apply. A modal reserves the root's entire canvas. Points outside the canvas, an unpainted/suspended root and destroyed roots return false.</p>
<p>A full-size map interaction View is itself UI, so use its <code>onWheel</code> instead of expecting the external guard to exclude it. The query reports geometry, not pointer capture ownership: retain the existing owner of an in-progress drag. Keep calling <code>frame()</code> after layout or viewport changes. Abort application listeners on scene teardown.</p>
<p>Try the <a href="/input/">map-and-sidebar example</a> with both arrangements or read its <a href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/input-routing">source</a>.</p>`;
}

export function inputPage() {
  return `<h1>Map and sidebar input</h1><p>Scroll over a map to zoom. Scroll over its sidebar to browse waypoints. The map stays still even when the list reaches its end. Use Reset zoom to return to the starting view.</p>
${[
  ['ui', 'Wheel inside the UI tree'],
  ['external', 'External camera controls'],
]
  .map(
    ([mode, title]) =>
      `<section><h2>${title}</h2><div id="map-${mode}" style="position:relative;width:100%;max-width:640px;height:300px;border-radius:12px;overflow:hidden"></div><output id="zoom-${mode}" aria-live="polite">Loading…</output></section>`,
  )
  .join('')}
<p><a href="/guide/#world-input">Read the input integration guide</a> · <a href="https://github.com/VictorQueiroz/ludic-canvas/tree/main/examples/input-routing">View the example source</a></p>`;
}
