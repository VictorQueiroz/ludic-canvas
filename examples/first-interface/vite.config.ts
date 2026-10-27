import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  // Keep the library's WASM and font URLs relative to its installed files.
  optimizeDeps: {
    exclude: ['ludic-canvas'],
    include: ['react', 'react-reconciler', 'react-reconciler/constants.js'],
  },
  build: { target: 'es2023', assetsInlineLimit: 0 },
});
