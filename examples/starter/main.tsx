import { useState } from 'react';
import { createUI, Text, View } from 'ludic-canvas';

function Counter() {
  const [score, setScore] = useState(0);
  return (
    <View style={{ width: '100%', height: '100%', padding: 24, gap: 16, justifyContent: 'center' }}>
      <Text style={{ fontSize: 36, color: '#f1f5ff' }}>Your first game UI</Text>
      <Text style={{ fontSize: 20, color: '#91a9c7' }}>Score: {score}</Text>
      <View
        label="Increase score"
        onPress={() => setScore((value) => value + 1)}
        hoverStyle={{ background: '#6c8dff' }}
        style={{ padding: 16, background: '#526dff', borderRadius: 8, alignSelf: 'flex-start' }}
      >
        <Text style={{ fontSize: 20, color: '#ffffff' }}>Collect a coin</Text>
      </View>
    </View>
  );
}

async function main() {
  const stage = document.querySelector<HTMLDivElement>('#root')!;
  document.body.style.margin = '0';
  stage.style.cssText = 'position:relative;width:100%;height:100svh;min-height:320px';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-label', 'Game UI with an interactive score counter');
  stage.replaceChildren(canvas);

  const ui = await createUI({ canvas, clearColor: '#0c1728' });
  ui.render(<Counter />);

  // Dispose when this scene leaves. Vite calls this on module replacement.
  if (import.meta.hot) import.meta.hot.dispose(() => ui.destroy());
}

void main().catch((error: unknown) => {
  document.querySelector('#root')!.textContent = `Unable to start: ${String(error)}`;
  console.error(error);
});
