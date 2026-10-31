import { mountMapSidebar } from '../../examples/input-routing/main.tsx';
const cleanup: (() => void)[] = [];
for (const mode of ['ui', 'external'] as const) {
  const stage = document.querySelector<HTMLElement>(`#map-${mode}`)!;
  const status = document.querySelector<HTMLOutputElement>(`#zoom-${mode}`)!;
  try {
    cleanup.push(await mountMapSidebar(stage, mode, status));
  } catch (error) {
    status.value = `Unable to start: ${String(error)}`;
  }
}
window.addEventListener('pagehide', () => cleanup.forEach((dispose) => dispose()), { once: true });
