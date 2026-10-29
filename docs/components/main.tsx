import { useState } from 'react';
import {
  Button,
  Dialog,
  ScrollArea,
  Slider,
  Switch,
  Tabs,
  Text,
  TextInput,
  TextArea,
  View,
  createUI,
  useUIRoot,
  type UIRoot,
  type ViewStyle,
} from 'ludic-canvas';

interface Skin {
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  ink: string;
  line: string;
  radius: number;
}
const skins: Record<string, Skin> = {
  night: {
    background: '#111625',
    panel: '#202b43',
    text: '#eef2ff',
    muted: '#a2b1cd',
    accent: '#acb8ff',
    ink: '#172039',
    line: '#445578',
    radius: 9,
  },
  field: {
    background: '#eee7d5',
    panel: '#e1d8bf',
    text: '#293e35',
    muted: '#536856',
    accent: '#45694e',
    ink: '#f3f0df',
    line: '#a7af91',
    radius: 2,
  },
};

function ControlLab({ skin, width, disabled }: { skin: Skin; width: number; disabled: boolean }) {
  const root = useUIRoot();
  const [tab, setTab] = useState('loadout');
  const [strength, setStrength] = useState(0.4);
  const [hints, setHints] = useState(true);
  const [equipped, setEquipped] = useState(0);
  const [cargo, setCargo] = useState(0);
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [telemetry, setTelemetry] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [notes, setNotes] = useState('');
  const compact = width < 400;
  const text = { fontSize: compact ? 15 : 17, color: skin.text };
  const action: ViewStyle = {
    minHeight: 44,
    paddingX: compact ? 9 : 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: skin.line,
    borderRadius: skin.radius,
    background: skin.panel,
  };
  const panel: ViewStyle = {
    width: '90%',
    maxWidth: 340,
    padding: 22,
    gap: 16,
    borderRadius: skin.radius,
    background: skin.background,
    borderWidth: 1,
    borderColor: skin.line,
  };
  return (
    <View style={{ width: '100%', height: '100%', padding: compact ? 16 : 24, gap: 15, background: skin.background }}>
      <View style={{ gap: 6 }}>
        <Text style={{ ...text, fontSize: compact ? 25 : 30 }}>
          {skin.radius > 3 ? 'Station / 07' : 'Field kit / 07'}
        </Text>
        <Text style={{ ...text, fontSize: 14, color: skin.muted }}>One set of controls. Your composition.</Text>
      </View>
      <Tabs
        label="Equipment sections"
        value={tab}
        onValueChange={setTab}
        disabled={disabled}
        items={[
          { value: 'loadout', label: 'Loadout' },
          { value: 'research', label: 'Research', disabled: true },
          { value: 'cargo', label: 'Cargo' },
        ]}
        style={{ gap: 7 }}
        tabStyle={({ selected }) => ({
          ...action,
          flex: 1,
          paddingX: 5,
          background: selected ? skin.accent : skin.panel,
        })}
      >
        {(item, { selected, disabled: unavailable }) => (
          <Text style={{ ...text, fontSize: 15, color: unavailable ? skin.muted : selected ? skin.ink : skin.text }}>
            {item.label}
          </Text>
        )}
      </Tabs>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Button
          label="Equip scanner"
          disabled={disabled}
          onPress={() => setEquipped((n) => n + 1)}
          hoverStyle={{ background: skin.accent }}
          pressStyle={{ scale: 0.98 }}
          style={{ ...action, flex: 1 }}
        >
          <Text style={text}>Equip scanner</Text>
        </Button>
        <Button label="Open settings" disabled={disabled} onPress={() => setOpen(true)} style={{ ...action, flex: 1 }}>
          <Text style={text}>Settings</Text>
        </Button>
      </View>
      <View style={{ gap: 5 }}>
        <Text style={{ ...text, fontSize: 15 }}>{`Signal strength / ${Math.round(strength * 100)}%`}</Text>
        <Slider
          label="Signal strength"
          value={strength}
          step={0.05}
          onValueChange={setStrength}
          disabled={disabled}
          valueText={`${Math.round(strength * 100)} percent`}
          style={{ height: 44, justifyContent: 'center' }}
        >
          {({ ratio, dragging }) => (
            <>
              <View
                fill={ratio}
                fillColor={skin.accent}
                style={{ height: 5, background: skin.line, borderRadius: skin.radius }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: `${ratio * 100}%`,
                  top: 14,
                  marginLeft: -7,
                  width: 14,
                  height: 16,
                  background: dragging ? skin.text : skin.accent,
                  borderRadius: skin.radius,
                }}
              />
            </>
          )}
        </Slider>
      </View>
      <Switch
        label="Enable navigation hints"
        checked={hints}
        onCheckedChange={setHints}
        disabled={disabled}
        style={{ ...action, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}
      >
        <Text style={text}>Navigation hints</Text>
        <View
          style={{
            width: 40,
            height: 22,
            padding: 3,
            background: hints ? skin.accent : skin.line,
            borderRadius: skin.radius,
            flexDirection: 'row',
            justifyContent: hints ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{ width: 16, height: 16, background: hints ? skin.ink : skin.background, borderRadius: skin.radius }}
          />
        </View>
      </Switch>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ ...text, fontSize: 16 }}>{tab === 'cargo' ? 'Cargo hold' : 'Available equipment'}</Text>
        <Button
          label="Focus last cargo"
          disabled={disabled}
          onPress={() => root.focus('cargo-12')}
          style={{ ...action, minHeight: 36, paddingX: 8 }}
        >
          <Text style={{ ...text, fontSize: 13 }}>Last item</Text>
        </Button>
      </View>
      <ScrollArea
        label="Cargo inventory"
        style={{ height: 145, padding: 8, gap: 6, background: skin.panel, borderRadius: skin.radius }}
      >
        {Array.from({ length: 12 }, (_, index) => (
          <Button
            key={index}
            id={`cargo-${index + 1}`}
            label={`Select cargo ${index + 1}`}
            disabled={disabled}
            onPress={() => setCargo(index + 1)}
            style={{
              minHeight: 36,
              paddingX: 10,
              justifyContent: 'center',
              background: cargo === index + 1 ? skin.accent : skin.background,
              borderRadius: skin.radius,
            }}
          >
            <Text style={{ ...text, fontSize: 15, color: cargo === index + 1 ? skin.ink : skin.text }}>
              {`0${index + 1}`.slice(-2)} / Survey supply
            </Text>
          </Button>
        ))}
      </ScrollArea>
      <Text
        announce
        style={{ ...text, fontSize: 14, color: skin.muted }}
      >{`Equipped ${equipped} / Cargo ${cargo || '-'} / ${hints ? 'Hints on' : 'Hints off'}`}</Text>
      {telemetry && (
        <Text style={{ ...text, fontSize: 13, color: skin.muted }}>
          Keyboard + pointer + touch / one controlled model
        </Text>
      )}
      <Button label="Edit profile" disabled={disabled} onPress={() => setProfileOpen(true)} style={action}>
        <Text style={text}>Edit profile</Text>
      </Button>
      <Dialog
        label="Player profile"
        open={profileOpen}
        onOpenChange={setProfileOpen}
        zIndex={40}
        style={{ background: '#0b1418e8', alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ ...panel, padding: compact ? 14 : 22, gap: 12 }}>
          <Text style={{ ...text, fontSize: 25 }}>Your profile.</Text>
          <ScrollArea label="Profile fields" style={{ height: 240, gap: 12 }}>
            <Text style={{ ...text, fontSize: 15 }}>Player name</Text>
            <TextInput
              label="Player name"
              value={playerName}
              onValueChange={setPlayerName}
              placeholder="Enter your name"
              maxLength={40}
              error={playerName.trim() ? undefined : 'Enter a player name.'}
              onSubmit={() => {
                if (playerName.trim()) setProfileOpen(false);
              }}
              style={{ background: skin.panel, borderWidth: 1, borderColor: skin.line, borderRadius: skin.radius }}
              textStyle={{ color: skin.text, fontSize: 16 }}
            />
            <Text style={{ ...text, fontSize: 15 }}>Field notes</Text>
            <TextArea
              label="Field notes"
              value={notes}
              onValueChange={setNotes}
              placeholder="Write a note"
              style={{
                height: 100,
                background: skin.panel,
                borderWidth: 1,
                borderColor: skin.line,
                borderRadius: skin.radius,
              }}
              textStyle={{ color: skin.text, fontSize: 16 }}
            />
          </ScrollArea>
          <Button
            label="Save profile"
            disabled={!playerName.trim()}
            onPress={() => setProfileOpen(false)}
            style={{ ...action, background: skin.accent }}
          >
            <Text style={{ ...text, color: skin.ink }}>Save profile</Text>
          </Button>
          <Button label="Close profile" onPress={() => setProfileOpen(false)} style={action}>
            <Text style={text}>Close profile</Text>
          </Button>
        </View>
      </Dialog>
      <Dialog
        label="Interface settings"
        open={open}
        onOpenChange={setOpen}
        zIndex={20}
        style={{ background: '#0b1418c9', alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={panel}>
          <Text style={{ ...text, fontSize: 26 }}>Make it yours.</Text>
          <Text style={text}>The application owns these values. The dialog owns input isolation.</Text>
          <Switch label="Show telemetry" checked={telemetry} onCheckedChange={setTelemetry} style={action}>
            <Text style={text}>{telemetry ? '[ON]' : '[OFF]'} Telemetry</Text>
          </Switch>
          <Button label="Advanced settings" onPress={() => setAdvanced(true)} style={action}>
            <Text style={text}>Advanced settings</Text>
          </Button>
          <Button label="Close settings" onPress={() => setOpen(false)} style={{ ...action, background: skin.accent }}>
            <Text style={{ ...text, color: skin.ink }}>Close settings</Text>
          </Button>
        </View>
        <Dialog
          label="Advanced interface settings"
          open={advanced}
          onOpenChange={setAdvanced}
          zIndex={30}
          style={{ background: '#0b1418c9', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={panel}>
            <Text style={{ ...text, fontSize: 24 }}>A separate focus scope.</Text>
            <Text style={text}>Escape returns to the parent dialog.</Text>
            <Button label="Back to settings" onPress={() => setAdvanced(false)} style={action}>
              <Text style={text}>Back to settings</Text>
            </Button>
          </View>
        </Dialog>
      </Dialog>
    </View>
  );
}

const lifetime = new AbortController();
const roots: { name: string; root: UIRoot }[] = [];
const observers: ResizeObserver[] = [];
let frame = 0;
let lastStats = 0;
const disabled = document.querySelector<HTMLInputElement>('#controls-disabled')!;
const largeText = document.querySelector<HTMLInputElement>('#controls-text')!;
const motion = document.querySelector<HTMLInputElement>('#controls-motion')!;
motion.checked = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderers: (() => void)[] = [];
for (const name of ['night', 'field']) {
  const canvas = document.querySelector<HTMLCanvasElement>(`#controls-${name}`)!;
  try {
    const root = await createUI({
      canvas,
      autoStart: false,
      signal: lifetime.signal,
      reducedMotion: motion.checked,
      theme: { focusRing: skins[name]!.accent },
    });
    roots.push({ name, root });
    const render = () =>
      root.render(<ControlLab skin={skins[name]!} width={canvas.clientWidth} disabled={disabled.checked} />);
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    observers.push(observer);
    renderers.push(render);
    render();
    canvas.parentElement!.querySelector('.control-loading')!.remove();
  } catch (error) {
    canvas.parentElement!.querySelector('.control-loading')!.textContent = `Unable to load controls: ${String(error)}`;
    console.error(error);
  }
}
disabled.addEventListener('change', () => renderers.forEach((render) => render()), { signal: lifetime.signal });
largeText.addEventListener(
  'change',
  () => roots.forEach(({ root }) => root.setTextScale(largeText.checked ? 1.15 : 1)),
  {
    signal: lifetime.signal,
  },
);
motion.addEventListener('change', () => roots.forEach(({ root }) => root.setReducedMotion(motion.checked)), {
  signal: lifetime.signal,
});
const tick = (now: number) => {
  roots.forEach(({ name, root }) => {
    const info = root.frame(now);
    if (now - lastStats >= 500) {
      document.querySelector(`#stats-${name}`)!.textContent =
        `${info.drawCalls} UI draws / ${(info.textureBytes / 1024).toFixed(0)} KiB image textures / independent root`;
    }
  });
  if (now - lastStats >= 500) lastStats = now;
  frame = requestAnimationFrame(tick);
};
frame = requestAnimationFrame(tick);
function destroy() {
  cancelAnimationFrame(frame);
  observers.forEach((observer) => observer.disconnect());
  lifetime.abort();
  roots.forEach(({ root }) => root.destroy());
}
window.addEventListener(
  'pagehide',
  (event) => {
    if (!event.persisted) destroy();
  },
  { signal: lifetime.signal },
);
import.meta.hot?.dispose(destroy);
