import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

let revision = process.env.VERCEL_GIT_COMMIT_SHA ?? 'unrecorded';
try {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  revision = head + (dirty ? '-dirty' : '');
} catch {
  /* Source archives can still build with an explicit unrecorded revision. */
}

export default defineConfig({
  root: 'docs',
  define: { __LUDIC_REVISION__: JSON.stringify(revision) },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  resolve: {
    alias: { 'ludic-canvas': resolve(import.meta.dirname, 'src/index.ts') },
    // Standalone examples may have their own installation; hooks and the renderer must share React.
    dedupe: ['react'],
  },
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
        input: resolve(import.meta.dirname, 'docs/input/index.html'),
        components: resolve(import.meta.dirname, 'docs/components/index.html'),
        performance: resolve(import.meta.dirname, 'docs/performance/index.html'),
        play: resolve(import.meta.dirname, 'docs/play/index.html'),
        orbital: resolve(import.meta.dirname, 'docs/play/orbital-relay/index.html'),
        survey: resolve(import.meta.dirname, 'docs/3d/index.html'),
      },
    },
  },
  server: { host: '127.0.0.1' },
});
