import { useState } from 'react';
import { createUI, View, Text } from 'ludic-canvas';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 28 }}>A fresh interface</Text>
      <View
        label="Increase score"
        onPress={() => setCount(count + 1)}
        style={{ padding: 16, background: '#526dff', borderRadius: 8 }}
      >
        <Text>Score: {count}</Text>
      </View>
    </View>
  );
}

export async function mountExample(canvas: HTMLCanvasElement) {
  const ui = await createUI({ canvas });
  ui.render(<Counter />);
  return () => ui.destroy();
}
