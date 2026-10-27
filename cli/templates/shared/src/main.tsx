import { createUI, type UIRoot } from 'ludic-canvas';
import { interfaceFont } from './fonts.ts';
import { createGame } from './game.ts';
import { Hud } from './Hud.tsx';
import { createWorld } from './world.ts';
import './style.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const overlay = document.querySelector<HTMLCanvasElement>('#ui')!;
const worldCanvas = document.querySelector<HTMLCanvasElement>('#world')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const lifetime = new AbortController();
const game = createGame();
let ui: UIRoot | undefined;
let world: ReturnType<typeof createWorld> | undefined;
let observer: ResizeObserver | undefined;
let raf = 0,
  previous = 0,
  width = 0,
  height = 0;

function destroy() {
  lifetime.abort();
  cancelAnimationFrame(raf);
  observer?.disconnect();
  ui?.destroy();
  world?.destroy();
  ui = undefined;
  world = undefined;
}
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) destroy();
  },
  { signal: lifetime.signal },
);
import.meta.hot?.dispose(destroy);

try {
  world = createWorld(worldCanvas);
  ui = await createUI({ canvas: overlay, fonts: [interfaceFont], autoStart: false, signal: lifetime.signal });
  const resize = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    ui?.render(<Hud game={game} width={width} />);
  };
  observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  loading.remove();
  const frame = (now: number) => {
    const delta = previous ? Math.min(0.1, Math.max(0, (now - previous) / 1000)) : 0;
    previous = now;
    const elapsed = game.advance(now, delta);
    world!.draw(elapsed, width, height);
    ui!.frame(now);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
} catch (error) {
  destroy();
  loading.textContent = `Unable to start the game: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
}
