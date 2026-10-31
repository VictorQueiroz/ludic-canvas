import {
  Font,
  FontBook,
  validateFontMetrics,
  createHeadlessHost,
  createPortableUI,
  RecordingRenderer,
  type LayoutBackend,
} from '../../src/core.ts';
import metrics from '../../assets/default-font.json';
import { App } from '../../examples/portable/App.tsx';

export async function contract(createLayout: () => Promise<LayoutBackend> | LayoutBackend) {
  let checks = 0;
  const check = (value: unknown, message: string) => {
    checks++;
    if (!value) throw new Error(message);
  };
  const roots = [];
  for (let i = 0; i < 2; i++) {
    const fonts = new FontBook();
    fonts.add(
      new Font('default', 0, validateFontMetrics(metrics), {
        handle: 1,
        width: metrics.atlas.width,
        height: metrics.atlas.height,
        bytes: 0,
      }),
    );
    const host = createHeadlessHost({ width: 720, height: 640, scale: 2 }),
      renderer = new RecordingRenderer();
    const ui = createPortableUI({ host, renderer, fonts, layout: await createLayout(), reducedMotion: true });
    ui.render(<App />);
    roots.push({ ui, host, renderer });
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  const [a, b] = roots;
  a!.ui.frame(0);
  b!.ui.frame(0);
  const initial = a!.ui.inspect();
  check(a!.renderer.frame.commands.length > 1000, 'No drawing commands');
  check(a!.ui.isPointerOverUI({ x: 50, y: 140 }), 'Pointer occupancy');
  a!.host.activate('increment');
  a!.ui.frame(16);
  check(JSON.stringify(a!.ui.inspect()).includes('Count: 1'), 'React activation');
  check(JSON.stringify(b!.ui.inspect()).includes('Count: 0'), 'Root isolation');
  a!.host.activate('open-dialog');
  a!.ui.frame(32);
  check(a!.host.focused === a!.host.semantics.find((n) => n.id === 'close-dialog')?.key, 'Modal focus');
  a!.host.activate('increment');
  a!.ui.frame(48);
  check(JSON.stringify(a!.ui.inspect()).includes('Count: 1'), 'Background activation');
  a!.host.activate('close-dialog');
  a!.ui.frame(64);
  const editor = a!.host.semantics.find((n) => n.id === 'name')!;
  a!.host.dispatch({ type: 'edit', key: editor.key, value: 'Ada', composing: false });
  a!.ui.frame(80);
  check(JSON.stringify(a!.ui.inspect()).includes('Hello, Ada.'), 'Controlled editing');
  a!.host.resize(480, 400, 1);
  a!.ui.frame(96);
  check(a!.renderer.frame.width === 480, 'Resize');
  const resized = a!.ui.inspect();
  a!.ui.destroy();
  b!.ui.frame(112);
  b!.ui.destroy();
  check(a!.host.destroyed && b!.host.destroyed && a!.renderer.destroyed && b!.renderer.destroyed, 'Teardown');
  return { initial, resized, checks };
}
