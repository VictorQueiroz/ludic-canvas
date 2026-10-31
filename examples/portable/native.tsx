import { createNativeUI } from 'ludic-canvas/native';
import { App } from './App.tsx';

const ui = createNativeUI({
  title: 'Ludic Canvas · Native',
  width: 720,
  height: 640,
  reducedMotion: true,
  profile: true,
});
ui.render(<App />);
