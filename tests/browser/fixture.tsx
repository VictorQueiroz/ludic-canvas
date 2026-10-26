import { useLayoutEffect, useState } from 'react';
import { createUI, defaultAssets, View, Text, Image, type UIRoot } from '../../src/index.ts';
const canvas = document.querySelector('canvas')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const selector = document.querySelector<HTMLSelectElement>('#scenario')!;
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true })!;
const contextLoss = gl.getExtension('WEBGL_lose_context')!;
const metrics = await (await fetch(defaultAssets.fontMetrics)).json();
const image = document.createElement('canvas');
image.width = 2;
image.height = 2;
const pixels = image.getContext('2d')!;
pixels.fillStyle = 'rgba(255,0,0,0.5)';
pixels.fillRect(0, 0, 2, 1);
pixels.fillStyle = '#00ff00';
pixels.fillRect(0, 1, 2, 1);
let root: UIRoot,
  scenario = 'basic',
  count = 0,
  restored = 0,
  errors = 0;
let committedScenario = '';
const update = () => {
  const frame = root.frame();
  status.textContent = JSON.stringify({ count, restored, errors, scenario: committedScenario, ...frame });
};
function App() {
  useLayoutEffect(() => {
    committedScenario = scenario;
  }, [scenario]);
  const [value, setValue] = useState(0);
  const [open, setOpen] = useState(true);
  return (
    <View style={{ flex: 1, background: '#102030' }}>
      <View
        id="below"
        label="Below"
        hotkey="b"
        onPress={() => {
          count++;
          setValue((value) => value + 1);
        }}
        style={{ position: 'absolute', top: 10, left: 10, width: 130, height: 48, background: '#4080c0' }}
      >
        <Text>Below {value}</Text>
      </View>
      {scenario === 'basic' && (
        <View style={{ position: 'absolute', top: 65, left: 10, width: 290, gap: 4 }}>
          {['default', 'second', 'third', 'fourth'].map((fontFamily) => (
            <Text key={fontFamily} style={{ fontFamily, fontSize: 18 }}>
              Font {fontFamily}
            </Text>
          ))}
        </View>
      )}
      {scenario === 'disabled' && (
        <View
          disabled
          label="Disabled"
          onPress={() => {
            errors++;
          }}
          style={{ position: 'absolute', top: 10, left: 10, width: 130, height: 48, background: '#c04040' }}
        >
          <Text>Disabled</Text>
        </View>
      )}
      {(scenario === 'modal' || scenario === 'animated') && open && (
        <View
          modal
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#00000088',
            padding: 20,
            gap: 10,
          }}
        >
          <View
            enter={scenario === 'animated' ? { opacity: 0, delay: 120, duration: 200 } : undefined}
            style={{ gap: 10 }}
          >
            <View
              id="close"
              label="Close dialog"
              onPress={() => setOpen(false)}
              style={{ height: 50, background: '#304060' }}
            >
              <Text>Close dialog</Text>
            </View>
            <View
              id="other"
              label="Other action"
              onPress={() => {
                count += 10;
              }}
              style={{ height: 50, background: '#304060' }}
            >
              <Text>Other action</Text>
            </View>
          </View>
        </View>
      )}
      {scenario === 'pointer' && (
        <View
          id="slider"
          focusable
          role="slider"
          label="Volume"
          valueMin={0}
          valueMax={100}
          valueNow={value}
          onPointerDown={(e) => {
            e.preventDefault();
            setValue(Math.round(e.localX));
          }}
          onPointerMove={(e) => {
            if (e.buttons) {
              e.preventDefault();
              setValue(Math.round(e.localX));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setValue((v) => v + 1);
            }
          }}
          style={{ position: 'absolute', left: 10, top: 80, width: 200, height: 50, background: '#508050' }}
        >
          <Text>Volume {value}</Text>
        </View>
      )}
      {scenario === 'scale' && (
        <View
          style={{
            position: 'absolute',
            left: 100,
            top: 100,
            width: 100,
            height: 100,
            scale: 2,
            background: '#000000',
          }}
        >
          <View
            label="Scaled child"
            onPress={() => {
              count++;
            }}
            style={{ position: 'absolute', left: 10, top: 10, width: 20, height: 20, background: '#ff0000' }}
          />
        </View>
      )}
      {scenario === 'scroll' && (
        <View
          style={{
            position: 'absolute',
            left: 10,
            top: 80,
            width: 280,
            height: 150,
            overflow: 'scroll',
            paddingBottom: '10%',
            gap: 5,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <View
              key={i}
              id={`item-${i}`}
              label={`Item ${i}`}
              onPress={() => {
                count = i;
              }}
              style={{ height: 40, flexShrink: 0, background: '#405060' }}
            >
              <Text>Item {i}</Text>
            </View>
          ))}
        </View>
      )}
      {scenario === 'image' && (
        <Image src="alpha" style={{ position: 'absolute', left: 10, top: 80, width: 100, height: 100, fit: 'fill' }} />
      )}
      {scenario === 'stress' && (
        <View style={{ position: 'absolute', left: 0, top: 70, width: 320, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 1000 }, (_, i) => (
            <View key={i} style={{ width: 8, height: 8, background: i % 2 ? '#90a0b0' : '#506070' }} />
          ))}
        </View>
      )}
    </View>
  );
}
async function mount(manageCanvasSize = true) {
  root = await createUI({
    canvas,
    context: gl,
    manageCanvasSize,
    maxDpr: 1,
    fonts: ['default', 'second', 'third', 'fourth'].map((name) => ({ name, atlas: defaultAssets.fontAtlas, metrics })),
    assets: { alpha: { url: image.toDataURL() } },
    onError(error) {
      errors++;
      console.error(error);
    },
    onContextRestored() {
      restored++;
    },
  });
  root.render(<App />);
  status.dataset.ready = 'true';
}
selector.addEventListener('change', () => {
  scenario = selector.value;
  root.render(<App />);
});
document.querySelector('#loss')!.addEventListener('click', () => contextLoss.loseContext());
document.querySelector('#restore')!.addEventListener('click', () => contextLoss.restoreContext());
document.querySelector('#destroy')!.addEventListener('click', () => root.destroy());
document.querySelector('#recreate')!.addEventListener('click', () => {
  root.destroy();
  void mount();
});
document.querySelector('#size')!.addEventListener('click', () => {
  root.destroy();
  canvas.width = 640;
  canvas.height = 240;
  void mount(false);
});
document.querySelector('#hidden')!.addEventListener('click', () => {
  canvas.style.display = canvas.style.display === 'none' ? 'block' : 'none';
});
await mount();
function tick() {
  try {
    update();
  } catch {}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
// This fixture deliberately exposes only the test contract to remote CI.
Object.assign(window, {
  contract: {
    createUI,
    get root() {
      return root;
    },
    gl,
    canvas,
    get state() {
      return JSON.parse(status.textContent!);
    },
  },
});
