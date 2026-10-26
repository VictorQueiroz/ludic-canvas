/** Bundler-resolved URLs for the included layout reactor and OFL font atlas. */
export const defaultAssets = {
  layout: new URL('../assets/layout.wasm', import.meta.url).href,
  fontAtlas: new URL('../assets/default-font.png', import.meta.url).href,
  fontMetrics: new URL('../assets/default-font.json', import.meta.url).href,
};
