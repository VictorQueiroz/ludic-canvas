import type { Page } from '@playwright/test';

/** Native operations keep their original return values; logs locate platform startup stalls. */
export async function traceStartup(page: Page) {
  page.on('console', (message) => {
    if (message.text().startsWith('[UI startup]')) console.log(message.text());
  });
  await page.evaluate(() => {
    let next = 0;
    const wrap = (object: any, key: string, label: string) => {
      const original = object[key];
      if (typeof original !== 'function') return;
      object[key] = new Proxy(original, {
        apply(target, receiver, args) {
          const id = ++next;
          console.log(`[UI startup] ${id} ${label} start ${performance.now()}`);
          try {
            const result = Reflect.apply(target, receiver, args);
            if (result && typeof result.then === 'function')
              result.then(
                () => console.log(`[UI startup] ${id} ${label} ready ${performance.now()}`),
                () => console.log(`[UI startup] ${id} ${label} rejected`),
              );
            else console.log(`[UI startup] ${id} ${label} ready ${performance.now()}`);
            return result;
          } catch (error) {
            console.log(`[UI startup] ${id} ${label} threw`);
            throw error;
          }
        },
      });
    };
    wrap(window, 'fetch', 'fetch');
    wrap(window, 'createImageBitmap', 'bitmap');
    wrap(WebAssembly, 'instantiate', 'wasm');
    wrap(HTMLCanvasElement.prototype, 'getContext', 'context');
    wrap(WebGLRenderingContext.prototype, 'texImage2D', 'texture');
  });
}
