import { useState } from 'react';
import { Button, createUI, Text, View } from 'ludic-canvas';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <View style={{ width: '100%', height: '100%', padding: 24, gap: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, color: '#f1f5ff' }}>Your first interface</Text>
      <Text style={{ fontSize: 20, color: '#a8bedb' }}>Count: {count}</Text>
      <Button
        label={`Add one (count ${count})`}
        onPress={() => setCount((value) => value + 1)}
        style={{ padding: 16, background: '#526dff', borderRadius: 8, alignSelf: 'flex-start' }}
        hoverStyle={{ background: '#6c8dff' }}
      >
        <Text style={{ fontSize: 20, color: '#ffffff' }}>Add one</Text>
      </Button>
    </View>
  );
}

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#ui')!;
  const ui = await createUI({ canvas, clearColor: '#0c1728' });
  ui.render(<Counter />);
  document.querySelector<HTMLElement>('#status')!.hidden = true;

  // Release the renderer when Vite reloads this module after an edit.
  if (import.meta.hot) import.meta.hot.dispose(() => ui.destroy());
}

void main().catch((error: unknown) => {
  const status = document.querySelector<HTMLElement>('#status')!;
  status.hidden = false;
  status.textContent = `Unable to start: ${String(error)}`;
  console.error(error);
});
