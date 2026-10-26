import { createUI, type UIRoot } from 'ludic-canvas';
import { createSurvey } from './game.ts';
import { createSurveyWorld, type SurveyWorld } from './world.ts';
import { SurveyHud } from './ui/Hud.tsx';
import { displayFont } from './ui/fonts.ts';
import { telemetryFont } from './telemetry/fonts.ts';

/** A standard engine-owned loop: simulation -> Three.js world -> Ludic Canvas UI. */
export async function mountSurvey() {
  const stage = document.querySelector<HTMLElement>('#survey-stage')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#survey-ui')!;
  const worldCanvas = document.querySelector<HTMLCanvasElement>('#survey-world')!;
  const loading = document.querySelector<HTMLElement>('#survey-loading')!;
  const status = document.querySelector<HTMLElement>('#survey-stats');
  const events = new AbortController(),
    game = createSurvey();
  let ui: UIRoot | undefined,
    world: SurveyWorld | undefined,
    observer: ResizeObserver | undefined,
    intersection: IntersectionObserver | undefined;
  let request = 0,
    destroyed = false,
    width = 0,
    height = 0,
    last = 0,
    nextPublish = 0,
    nextStatus = 0,
    visible = true;
  const keys = new Set<string>();
  const releaseKeys = () => {
    keys.clear();
    game.setInput(0, 0);
  };
  const dispose = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(request);
    events.abort();
    observer?.disconnect();
    intersection?.disconnect();
    releaseKeys();
    try {
      ui?.destroy();
    } finally {
      world?.dispose();
    }
  };
  const error = (error: unknown) => {
    loading.hidden = false;
    loading.textContent = `Unable to render this example: ${String(error)}. It requires WebGL 2 for Three.js and WebGL 1 for the UI.`;
    console.error(error);
  };
  try {
    world = createSurveyWorld(worldCanvas);
    ui = await createUI({
      canvas,
      autoStart: false,
      fonts: [displayFont, telemetryFont],
      theme: { textColor: '#f4efd9', focusRing: '#efa96a', emphasisColor: '#d6e89a' },
      signal: events.signal,
      onError: error,
      onContextLost() {
        releaseKeys();
        game.dialog('pause');
      },
    });
    if (destroyed) return dispose();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    game.motion(motion.matches);
    ui.setReducedMotion(motion.matches);
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      ui!.render(
        <SurveyHud
          game={game}
          width={width}
          height={height}
          onGround={(x, y) => {
            const hit = world!.pick(x, y);
            if (hit) game.driveTo(hit.x, hit.z);
          }}
        />,
      );
    };
    observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    const keyboard = (event: KeyboardEvent, down: boolean) => {
      if (event.defaultPrevented) return;
      const state = game.read(),
        key = event.key.toLowerCase();
      if (state.dialog !== 'none' || state.complete) {
        releaseKeys();
        return;
      }
      if (down && ['1', '2', '3'].includes(key)) {
        game.select(Number(key) - 1);
        return;
      }
      if (!['w', 'a', 's', 'd', 'shift'].includes(key)) return;
      event.preventDefault();
      if (down) keys.add(key);
      else keys.delete(key);
      game.setInput(
        Number(keys.has('d')) - Number(keys.has('a')),
        Number(keys.has('s')) - Number(keys.has('w')),
        keys.has('shift'),
      );
    };
    stage.addEventListener(
      'click',
      () => {
        if (game.read().dialog === 'none' && !game.read().complete) canvas.focus({ preventScroll: true });
      },
      { signal: events.signal },
    );
    stage.addEventListener('keydown', (event) => keyboard(event, true), { signal: events.signal });
    stage.addEventListener('keyup', (event) => keyboard(event, false), { signal: events.signal });
    window.addEventListener('blur', releaseKeys, { signal: events.signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        releaseKeys();
        last = 0;
        if (document.hidden && game.read().dialog === 'none') game.dialog('pause');
      },
      { signal: events.signal },
    );
    intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (!visible) {
          releaseKeys();
          if (game.read().dialog === 'none') game.dialog('pause');
        }
        last = 0;
      },
      { threshold: 0.05 },
    );
    intersection.observe(stage);
    worldCanvas.addEventListener(
      'webglcontextlost',
      () => {
        releaseKeys();
        game.dialog('pause');
        loading.hidden = false;
        loading.textContent = '3D graphics paused. Waiting for the browser to restore the context...';
      },
      { signal: events.signal },
    );
    worldCanvas.addEventListener(
      'webglcontextrestored',
      () => {
        loading.hidden = true;
        last = 0;
      },
      { signal: events.signal },
    );
    motion.addEventListener(
      'change',
      () => {
        game.motion(motion.matches);
        ui!.setReducedMotion(motion.matches);
      },
      { signal: events.signal },
    );
    let reduced = false;
    const frame = (now: number) => {
      if (destroyed) return;
      try {
        if (!document.hidden && visible && width > 0 && height > 0) {
          const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
          if (!world!.contextLost) game.tick(dt);
          const state = game.read();
          if (state.dialog !== 'none' || state.complete) releaseKeys();
          if (reduced !== state.reducedMotion) {
            reduced = state.reducedMotion;
            ui!.setReducedMotion(reduced);
          }
          world!.draw(state, width, height, dt);
          if (now >= nextPublish) {
            game.publish(world!.project());
            nextPublish = now + 70;
          }
          const info = ui!.frame(now);
          stage.dataset.phase = state.complete ? 'complete' : state.dialog === 'none' ? 'playing' : state.dialog;
          stage.dataset.samples = String(state.samples.filter(Boolean).length);
          stage.dataset.selected = String(state.selected);
          stage.dataset.camera = state.overview ? 'overview' : 'follow';
          if (now >= nextStatus) {
            if (status)
              status.textContent = `Three.js WebGL 2: ${world!.drawCalls} draws / Ludic Canvas WebGL 1: ${info.drawCalls} draws / 2 font families`;
            nextStatus = now + 500;
          }
        }
        last = now;
        request = requestAnimationFrame(frame);
      } catch (cause) {
        error(cause);
        dispose();
      }
    };
    request = requestAnimationFrame(frame);
    loading.hidden = true;
    stage.dataset.ready = 'true';
    window.addEventListener(
      'pagehide',
      (event) => {
        if (!event.persisted) dispose();
      },
      { signal: events.signal },
    );
    if (import.meta.hot) import.meta.hot.dispose(dispose);
  } catch (cause) {
    dispose();
    error(cause);
  }
  return { game, destroy: dispose };
}
