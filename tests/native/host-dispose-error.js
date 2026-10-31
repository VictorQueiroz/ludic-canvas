const bridge = globalThis.__ludicNative;
const surface = bridge.createSurface('Ludic teardown regression', 200, 100);
let received = false;
bridge.listen(surface, () => {
  received = true;
  bridge.destroySurface(surface);
  throw new Error('expected error after surface disposal');
});
bridge.focus(surface, 0);
if (!received) throw new Error('Native focus event was not delivered');
if (bridge.inspectNative().surfaces !== 0) throw new Error('Surface was not released');
console.log('Reentrant surface disposal recovered.');
throw new Error('intentional host test exit');
