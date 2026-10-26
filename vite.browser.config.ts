import { defineConfig } from 'vite';
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { host: '127.0.0.1', port: 6173, strictPort: true },
});
