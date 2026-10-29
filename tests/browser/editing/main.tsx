import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  ScrollArea,
  Text,
  TextArea,
  TextInput,
  View,
  createUI,
  type TextInputHandle,
  type UIRoot,
} from '../../../src/index.ts';

const errors: string[] = [];
const roots: UIRoot[] = [];
const active = new Set<UIRoot>();
const controls: Record<
  string,
  {
    reset(value: string): void;
    disable(value: boolean): void;
    readonly(value: boolean): void;
    show(value: boolean): void;
    reject(value: boolean): void;
    error(value: string): void;
    transform(value: number): void;
    open(value: boolean): void;
    hide(value: boolean): void;
  }
> = {};
const handles: Record<string, { current: TextInputHandle | null }> = {};
const values: Record<string, { name: string; notes: string; hotkeys: number; submits: number }> = {};
const edits: Record<string, string[]> = { first: [], second: [] };
let bubbledKeys = 0;
document.addEventListener('keydown', () => bubbledKeys++);
const action = { height: 40, padding: 8, background: '#304567', flexShrink: 0 } as const;

function Form({ id }: { id: string }) {
  const [name, setName] = useState('Ada');
  const [notes, setNotes] = useState('');
  const [disabled, disable] = useState(false);
  const [readOnly, readonly] = useState(false);
  const [show, setShow] = useState(true);
  const [hidden, hide] = useState(false);
  const [reject, setReject] = useState(false);
  const [error, setError] = useState('');
  const [scale, transform] = useState(1);
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [dialogName, setDialogName] = useState('Dialog');
  const [hotkeys, setHotkeys] = useState(0);
  const [submits, setSubmits] = useState(0);
  const handle = useRef<TextInputHandle>(null);
  controls[id] = {
    reset: setName,
    disable,
    readonly,
    show: setShow,
    reject: setReject,
    error: setError,
    transform,
    open: setOpen,
    hide,
  };
  handles[id] = handle;
  values[id] = { name, notes, hotkeys, submits };
  return (
    <View style={{ width: '100%', height: '100%', background: '#18263c', padding: 16, gap: 12 }}>
      <Text>Native editing form</Text>
      <View style={{ scale, translateX: 4, opacity: 0.8, display: hidden ? 'none' : 'flex' }}>
        <ScrollArea id="form-scroll" label="Form fields" style={{ height: 138, gap: 10, background: '#22344f' }}>
          {show && (
            <TextInput
              id="player"
              ref={handle}
              label="Player name"
              value={name}
              onValueChange={(value) => {
                edits[id]!.push(value);
                if (!reject) setName(value);
              }}
              onSubmit={() => setSubmits((n) => n + 1)}
              disabled={disabled}
              readOnly={readOnly}
              maxLength={40}
              placeholder="Your name"
              error={error}
              style={{ borderWidth: 1, borderColor: '#6686ae', background: '#263d5f' }}
            />
          )}
          <View style={{ height: 190, flexShrink: 0 }} />
          <TextInput id="last" label="Last field" value="Last" onValueChange={() => {}} />
        </ScrollArea>
      </View>
      <TextArea label="Notes" value={notes} onValueChange={setNotes} style={{ height: 100, background: '#263d5f' }} />
      <Button label="Open editor" onPress={() => setOpen(true)} style={action}>
        <Text>Open editor</Text>
      </Button>
      <Button label="Hotkey action" hotkey="x" onPress={() => setHotkeys((n) => n + 1)} style={action}>
        <Text>Hotkey action</Text>
      </Button>
      <Dialog
        label="Edit profile"
        open={open}
        onOpenChange={setOpen}
        zIndex={20}
        style={{ background: '#112033ee', padding: 20, gap: 12 }}
      >
        <TextInput label="Dialog name" value={dialogName} onValueChange={setDialogName} />
        <Button label="Nested editor" onPress={() => setNested(true)} style={action}>
          <Text>Nested editor</Text>
        </Button>
        <Button label="Close editor" onPress={() => setOpen(false)} style={action}>
          <Text>Close editor</Text>
        </Button>
        <Dialog
          label="Nested profile"
          open={nested}
          onOpenChange={setNested}
          zIndex={30}
          style={{ background: '#172840', padding: 24, gap: 12 }}
        >
          <TextInput label="Nested name" value={dialogName} onValueChange={setDialogName} />
          <Button label="Close nested" onPress={() => setNested(false)} style={action}>
            <Text>Close nested</Text>
          </Button>
        </Dialog>
      </Dialog>
    </View>
  );
}

for (const id of ['first', 'second']) {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${id} canvas`)!;
  const root = await createUI({
    canvas,
    autoStart: false,
    reducedMotion: true,
    onError: (error) => errors.push(String(error)),
  });
  roots.push(root);
  active.add(root);
  root.render(<Form id={id} />);
}
Object.assign(window, {
  editing: {
    roots,
    controls,
    handles,
    values,
    edits,
    errors,
    get bubbledKeys() {
      return bubbledKeys;
    },
    destroy(index: number) {
      const root = roots[index]!;
      active.delete(root);
      root.destroy();
    },
  },
});
function tick() {
  try {
    for (const root of active) root.frame();
  } catch (error) {
    errors.push(String(error));
  }
  document.querySelector('#ready')!.textContent = 'Ready';
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
