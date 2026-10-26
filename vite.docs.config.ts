import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'docs',
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: { alias: { 'ludic-canvas': resolve(import.meta.dirname, 'src/index.ts') } },
  build: {
    outDir: '../site',
    emptyOutDir: true,
    target: 'es2023',
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'docs/index.html'),
        guide: resolve(import.meta.dirname, 'docs/guide/index.html'),
        api: resolve(import.meta.dirname, 'docs/api/index.html'),
        play: resolve(import.meta.dirname, 'docs/play/index.html'),
        survey: resolve(import.meta.dirname, 'docs/3d/index.html'),
      },
    },
  },
  server: { host: '127.0.0.1' },
});
