export function imageUpdatesGuide(code) {
  return `<p>Vector cache dimensions are rounded for reuse. <code>contain</code> and <code>cover</code> fit the decoded SVG's intrinsic dimensions independently of those physical raster buckets; <code>fill</code> stretches into the destination. Give SVGs explicit intrinsic dimensions for predictable fitting. Asset <code>width</code>/<code>height</code> remain rasterization hints.</p>
<p>For a changing diagram, keep one image identifier and replace its resolver URL before invalidating it:</p>${code(
    `let diagramUrl = initialSvgUrl;
const ui = await createUI({
  canvas,
  assets: (id) => id === 'diagram'
    ? { url: diagramUrl, kind: 'vector' }
    : undefined,
});
ui.render(<Image src="diagram" style={{ width: 320, height: 160, fit: 'contain' }} />);

function replaceDiagram(nextSvgUrl: string) {
  diagramUrl = nextSvgUrl;
  ui.invalidateImages(['diagram']);
  // The application's next frames load and paint the replacement.
}`,
    'tsx',
    'Replace a vector resource',
  )}
<p>Invalidation aborts old loads and releases cached textures for that identifier. Replacement is asynchronous and can briefly leave the image empty; it deletes/reuploads textures rather than mutating a GPU texture in place. Applications own and revoke any object URLs they create. Use ordinary primitives for continuously animated values and keep the existing application frame loop.</p>`;
}
