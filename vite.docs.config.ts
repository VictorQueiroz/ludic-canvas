import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'docs',
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
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
      },
    },
  },
  server: { host: '127.0.0.1' },
});
