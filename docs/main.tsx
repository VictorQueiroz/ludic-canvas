import { useState } from 'react';
import { createUI, View, Text, Image, Line, type ViewStyle } from 'ludic-canvas';

type Example = 'hud' | 'menu' | 'inventory';
const canvas = document.querySelector<HTMLCanvasElement>('#demo')!;
const status = document.querySelector<HTMLElement>('#demo-status')!;
const stats = document.querySelector<HTMLElement>('#frame-stats')!;
const feedback = (message: string) => {
  status.textContent = message;
};
const panel: ViewStyle = {
  padding: 20,
  background: '#12223bee',
  borderWidth: 1,
  borderColor: '#38516d',
  borderRadius: 12,
  gap: 12,
};

function Button({
  children,
  label,
  onPress,
  primary = false,
}: {
  children: string;
  label?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <View
      label={label ?? children}
      onPress={onPress}
      transition={160}
      hoverStyle={{ background: primary ? '#6c8dff' : '#304566', translateY: -2 }}
      pressStyle={{ scale: 0.98 }}
      style={{
        paddingX: 20,
        paddingY: 11,
        background: primary ? '#526dff' : '#20334d',
        borderRadius: 7,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 17, color: '#ffffff', letterSpacing: 0.03 }}>{children}</Text>
    </View>
  );
}

function Demo({ example }: { example: Example }) {
  const [shield, setShield] = useState(68);
  const [width, setWidth] = useState(720);
  const [selected, setSelected] = useState(0);
  const [music, setMusic] = useState(true);
  const items = ['Prism', 'Beacon', 'Compass', 'Module', 'Battery', 'Token'];
  return (
    <View
      onLayout={({ width }) => setWidth(width)}
      style={{ width: '100%', height: '100%', padding: 24, justifyContent: 'center', gap: 14 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#8ca7c8', letterSpacing: 0.15, textTransform: 'uppercase' }}>
          LUDIC / {example === 'hud' ? 'FLIGHT SYSTEMS' : example === 'menu' ? 'INTERFACE STUDY' : 'EQUIPMENT'}
        </Text>
        <Text style={{ fontSize: 13, color: '#72dfbb' }}>SYSTEM ONLINE</Text>
      </View>
      {example === 'hud' && (
        <>
          <View style={{ ...panel, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Image src="sigil" style={{ width: 66, height: 66, fit: 'contain' }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 29, color: '#f1f5ff' }}>PATHFINDER</Text>
              <Text style={{ fontSize: 15, color: '#91a9c7' }}>EXPLORATION CLASS / LEVEL 12</Text>
            </View>
          </View>
          <View style={{ ...panel, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18 }}>Shield integrity</Text>
              <Text style={{ fontSize: 18, color: '#72dfbb' }}>{shield}%</Text>
            </View>
            <View
              fill={shield / 100}
              fillColor="#72dfbb"
              transition={320}
              style={{ height: 9, borderRadius: 5, background: '#263951' }}
            />
            <View
              style={{
                flexDirection: width < 520 ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: width < 520 ? 'stretch' : 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 15, color: '#91a9c7' }}>A small action. A smooth update.</Text>
              <Button
                primary
                onPress={() => {
                  setShield((value) => (value >= 100 ? 25 : Math.min(100, value + 8)));
                  feedback('Shield updated. The meter animates without React rendering each frame.');
                }}
              >
                Boost shield
              </Button>
            </View>
          </View>
          <View style={{ height: 20 }}>
            <Line from={[0, 0.5]} to={[1, 0.5]} relative color="#536c8c" dash={18} speed={12} width={1} />
            <Text style={{ fontSize: 12, color: '#91a9c7', textAlign: 'center', background: '#0c1728' }}>
              NAVIGATION LINK ESTABLISHED
            </Text>
          </View>
        </>
      )}
      {example === 'menu' && (
        <View
          style={{ ...panel, alignSelf: 'center', width: '100%', maxWidth: 360, alignItems: 'stretch', gap: 12 }}
          enter={{ opacity: 0, translateY: 12, duration: 250 }}
        >
          <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 2 }}>Take a breath.</Text>
          <Text style={{ fontSize: 16, color: '#91a9c7', textAlign: 'center', marginBottom: 8 }}>
            Your next move can wait.
          </Text>
          <Button primary onPress={() => feedback('Resume selected. Connect this action to your own game.')}>
            Resume session
          </Button>
          <Button
            onPress={() => {
              setMusic((value) => !value);
              feedback(`Music ${music ? 'disabled' : 'enabled'}. React state updated.`);
            }}
          >{`Music: ${music ? 'on' : 'off'}`}</Button>
          <Button
            onPress={() => feedback('Settings selected. Compose your own settings panel with the same primitives.')}
          >
            Open settings
          </Button>
        </View>
      )}
      {example === 'inventory' && (
        <View style={{ ...panel, gap: 12 }}>
          <Text style={{ fontSize: 26 }}>FIELD EQUIPMENT</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {items.map((item, index) => (
              <View
                key={item}
                label={`Select ${item}`}
                onPress={() => {
                  setSelected(index);
                  feedback(`${item} selected. Inventory data is owned by your application.`);
                }}
                transition={180}
                hoverStyle={{ borderColor: '#8ba5ff', background: '#263d60' }}
                style={{
                  width: '30%',
                  flexGrow: 1,
                  padding: 12,
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: index === selected ? '#90b4ff' : '#38516d',
                  background: index === selected ? '#2b4168' : '#182c45',
                }}
              >
                <Image
                  src="sigil"
                  style={{ width: 29, height: 29, tint: index === selected ? '#90b4ff' : '#72dfbb' }}
                />
                <Text style={{ fontSize: 17 }}>{item}</Text>
              </View>
            ))}
          </View>
          <Text announce style={{ fontSize: 16, color: '#91a9c7' }}>
            {items[selected]} selected · Ready to equip
          </Text>
        </View>
      )}
    </View>
  );
}

try {
  const ui = await createUI({
    canvas,
    clearColor: '#0c1728',
    autoStart: false,
    assets: { sigil: { url: '/sigil.svg', kind: 'vector', width: 96, height: 96 } },
    onError: (error) => {
      feedback(`Renderer error: ${String(error)}`);
      console.error(error);
    },
  });
  ui.render(<Demo example="hud" />);
  feedback('Try Boost shield, then explore the other examples.');
  let request = 0;
  const draw = (now: number) => {
    const frame = ui.frame(now);
    stats.textContent = `${frame.drawCalls} draw calls · ${frame.cssWidth.toFixed(0)} × ${frame.cssHeight.toFixed(0)}`;
    request = requestAnimationFrame(draw);
  };
  request = requestAnimationFrame(draw);
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
    tab.addEventListener('click', () => {
      for (const sibling of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
        sibling.classList.toggle('active', sibling === tab);
        sibling.setAttribute('aria-pressed', String(sibling === tab));
      }
      ui.render(<Demo key={tab.dataset.example} example={tab.dataset.example as Example} />);
      feedback('Click the canvas or Tab into its controls.');
    });
  }
  const motion = document.querySelector<HTMLInputElement>('#motion')!;
  motion.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  motion.addEventListener('change', () => ui.setReducedMotion(motion.checked));
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(request);
      ui.destroy();
    });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      cancelAnimationFrame(request);
      ui.destroy();
    }
  });
} catch (error) {
  feedback(`This example could not start: ${String(error)}. The guides and API remain available.`);
  stats.textContent = 'Renderer unavailable';
  console.error(error);
}
