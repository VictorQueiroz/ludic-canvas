import { useLayoutEffect, useState } from 'react';
import { createUI, View, Text, Button, TextInput, ScrollArea, createScrollHandle, type UIRoot } from 'ludic-canvas';

const roots: UIRoot[] = [];
const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
let renderCount = 0;
const scrolls: Record<string, ReturnType<typeof createScrollHandle>> = {};
function App({ name }: { name: string }) {
  const [scroll] = useState(createScrollHandle);
  scrolls[name] = scroll;
  const [value, setValue] = useState('Native editing keeps its own selection');
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    renderCount++;
  }, []);
  return (
    <View style={{ width: '100%', height: '100%', padding: 22, gap: 16, background: '#111827' }}>
      <Text
        onLayout={(box) => {
          boxes[`${name}:title`] = box;
        }}
        style={{ fontSize: 26, color: '#f4f7ff' }}
      >
        Selectable canvas text
      </Text>
      <Text
        onLayout={(box) => {
          boxes[`${name}:first`] = box;
        }}
        style={{ fontSize: 20, color: '#d9e5ff' }}
      >
        {revision
          ? 'Replacement content clears stale selection.'
          : 'Alpha bravo charlie. Drag in either direction across these words.'}
      </Text>
      <Text
        onLayout={(box) => {
          boxes[`${name}:second`] = box;
        }}
        rich
        style={{ fontSize: 18, color: '#d9e5ff', lineHeight: 1.3 }}
      >
        A second **paragraph** wraps naturally. Double click selects a word; triple click selects a paragraph. Shift
        click extends the anchor.
      </Text>
      <Text
        onLayout={(box) => {
          boxes[`${name}:none`] = box;
        }}
        userSelect="none"
        style={{ fontSize: 15, color: '#8191af' }}
      >
        This note opts out of selection.
      </Text>
      <Text
        onLayout={(box) => {
          boxes[`${name}:all`] = box;
        }}
        userSelect="all"
        style={{ fontSize: 17, color: '#c7b8ff' }}
      >
        Select this whole reference: LC-2048
      </Text>
      <ScrollArea
        onLayout={(box) => {
          boxes[`${name}:scroll`] = box;
        }}
        label="Selection scroll area"
        scrollHandle={scroll}
        scrollMode={new URLSearchParams(location.search).get('scroll') === 'native' ? 'native' : 'canvas'}
        style={{ height: 145, flexShrink: 0, background: '#1c2940', padding: 12 }}
      >
        {Array.from({ length: 14 }, (_, i) => (
          <Text key={i} style={{ fontSize: 18, flexShrink: 0, marginBottom: 12, color: '#dfebff' }}>
            Log {i + 1}: select and drag past the edge to scroll.
          </Text>
        ))}
      </ScrollArea>
      <TextInput
        label={`${name} editor`}
        value={value}
        onValueChange={setValue}
        style={{ height: 44, background: '#22324d', padding: 10 }}
        textStyle={{ fontSize: 17, color: '#fff' }}
      />
      <Button
        label={`${name} replace text`}
        onPress={() => setRevision((value) => value + 1)}
        style={{ padding: 12, background: '#324a74', alignSelf: 'flex-start' }}
      >
        <Text style={{ fontSize: 16 }}>Replace the first paragraph</Text>
      </Button>
    </View>
  );
}
for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-selection-demo]')) {
  const root = await createUI({ canvas, manageCanvasSize: true, maxDpr: 2 });
  roots.push(root);
  root.render(<App name={canvas.id} />);
}
Object.assign(window, {
  selectionDemo: {
    roots,
    boxes,
    scrolls,
    get ready() {
      return (
        renderCount === roots.length &&
        ['one', 'two'].every((name) => boxes[`${name}:first`] && boxes[`${name}:scroll`])
      );
    },
  },
});
addEventListener(
  'pagehide',
  () => {
    for (const root of roots) root.destroy();
  },
  { once: true },
);
