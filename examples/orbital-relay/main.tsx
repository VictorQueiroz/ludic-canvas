import { createUI } from 'ludic-canvas';
import { createGame } from './game.ts';
import { createWorld } from './world.ts';
import { Hud } from './ui/Hud.tsx';
import { interfaceFont } from './ui/fonts.ts';
import { telemetryFont } from './missions/fonts.ts';
import emblem from './ui/emblem.svg?url';

export async function mountGame() {
  const stage = document.querySelector<HTMLElement>('#game-stage')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#game-ui')!;
  const loading = document.querySelector<HTMLElement>('#game-loading')!;
  const stats = document.querySelector<HTMLElement>('#game-stats')!;
  const events = new AbortController();
  let dispose = () => events.abort();

  try {
    const game = createGame();
    const world = createWorld(document.querySelector<HTMLCanvasElement>('#game-world')!);
    const ui = await createUI({
      canvas,
      autoStart: false,
      // Each feature exports its own font; only this application root composes them.
      fonts: [interfaceFont, telemetryFont],
      assets: { courier: { url: emblem, kind: 'vector', width: 96, height: 96 } },
      theme: { textColor: '#f1f3eb', focusRing: '#f4c77e' },
      onError(error) {
        loading.hidden = false;
        loading.textContent = `Game UI error: ${String(error)}`;
        console.error(error);
      },
    });
    let width = 0,
      height = 0,
      request = 0,
      last = 0,
      nextStats = 0;
    let visible = true;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motion.matches;
    const reduce = document.querySelector<HTMLInputElement>('#game-motion')!;
    reduce.checked = reducedMotion;
    reduce.addEventListener(
      'change',
      () => {
        reducedMotion = reduce.checked;
        ui.setReducedMotion(reducedMotion);
      },
      { signal: events.signal },
    );
    motion.addEventListener(
      'change',
      () => {
        reducedMotion = reduce.checked = motion.matches;
        ui.setReducedMotion(reducedMotion);
      },
      { signal: events.signal },
    );
    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.width === width && bounds.height === height) return;
      width = bounds.width;
      height = bounds.height;
      ui.render(<Hud game={game} width={width} height={height} />);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (!visible && game.getSnapshot().status === 'playing') game.pause();
      },
      { threshold: 0.2 },
    );
    intersection.observe(stage);
    const draw = (now: number) => {
      if (!document.hidden && visible) {
        game.tick(last ? (now - last) / 1000 : 0);
        world.draw(game, width, height, reducedMotion);
        const frame = ui.frame(now);
        if (now >= nextStats) {
          stats.textContent = `${Math.round(width)} x ${Math.round(height)} / ${frame.drawCalls} UI draw calls / 2 MSDF families`;
          nextStats = now + 500;
        }
      }
      last = now;
      request = requestAnimationFrame(draw);
    };
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden && game.getSnapshot().status === 'playing') game.pause();
        last = 0;
      },
      { signal: events.signal },
    );
    document.querySelector<HTMLButtonElement>('#game-size')!.addEventListener(
      'click',
      (event) => {
        const compact = stage.classList.toggle('preview-compact');
        (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(compact));
      },
      { signal: events.signal },
    );
    // Independent roots, world state and observers all leave with this scene.
    dispose = () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      intersection.disconnect();
      events.abort();
      ui.destroy();
    };
    request = requestAnimationFrame(draw);
    loading.hidden = true;
    window.addEventListener(
      'pagehide',
      (event) => {
        if (!event.persisted) dispose();
      },
      { signal: events.signal },
    );
    if (import.meta.hot) import.meta.hot.dispose(() => dispose());
  } catch (error) {
    dispose();
    loading.hidden = false;
    loading.textContent = `The game could not start: ${String(error)}. Try a browser with WebGL enabled.`;
    console.error(error);
  }
}
