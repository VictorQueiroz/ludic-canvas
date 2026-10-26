import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: { target: 'es2023', assetsInlineLimit: 0 },
});
