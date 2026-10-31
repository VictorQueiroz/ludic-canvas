import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { 'ludic-canvas': fileURLToPath(new URL('./src/index.ts', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { host: '127.0.0.1', port: 6173, strictPort: true },
});
