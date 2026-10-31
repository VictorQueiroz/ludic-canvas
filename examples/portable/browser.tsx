import { createUI } from '../../src/index.ts';
import { App } from './App.tsx';

const ui = await createUI({ canvas: document.querySelector('canvas')!, reducedMotion: true });
ui.render(<App />);
ui.start();
Object.assign(window, { portableUI: ui });
