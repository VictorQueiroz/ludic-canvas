const bridge = globalThis.__ludicNative;
const surface = bridge.createSurface('Ludic startup regression', 200, 100);
bridge.listen(surface, () => false);
const layout = bridge.createLayout(() => [0, 0]);
bridge.layout(layout, 1);
throw new Error('expected host startup failure with live resources');
