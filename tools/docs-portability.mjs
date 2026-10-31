export const portabilityGuide = (code) =>
  `<p>The experimental portable core separates React composition and interaction from layout, drawing and host services. The same component tree can run through the browser adapter or the repository's standalone macOS proof with Hermes, native Yoga and Skia/Metal.</p>${code(`// Browser entry
import { createUI } from 'ludic-canvas';
const browserUI = await createUI({ canvas });
browserUI.render(<App />);

// Native entry, inside a compatible Ludic host
import { createNativeUI } from 'ludic-canvas/native';
const nativeUI = createNativeUI({ title: 'My interface' });
nativeUI.render(<App />);`)}<p><code>ludic-canvas/core</code> exports the rendering/layout/host contracts, a command recorder and a headless host. Browser applications retain direct WebGL drawing and DOM text editing. Native builds compile the JavaScript bundle to Hermes bytecode; they do not translate React into platform widget source.</p><p>The first native host is an experimental macOS development bundle. Android, iOS, Windows and Linux ports, distribution packaging, native editing parity and device/accessibility qualification remain future work. Read the <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/docs/PORTABILITY.md">portability architecture and build instructions</a> for exact boundaries.</p>`;
