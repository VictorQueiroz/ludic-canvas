import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  build: { target: 'es2023', assetsInlineLimit: 0 },
});
