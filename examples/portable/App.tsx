import { useState } from 'react';
import { Button, Dialog, ScrollArea, Text, TextInput, View } from 'ludic-canvas';

/** This component is shared, unchanged, by the browser and Hermes native entry points. */
export function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('Explorer');
  const [dialog, setDialog] = useState(false);
  return (
    <View style={{ width: '100%', height: '100%', padding: 28, gap: 14, background: '#101620' }}>
      <Text style={{ fontSize: 34, color: '#e8f5ff' }}>One interface. Two hosts.</Text>
      <Text style={{ fontSize: 18, color: '#a0b6cd' }}>React composition · Yoga layout · Ludic interaction</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Button
          id="increment"
          label="Add one"
          style={{ padding: 10, background: '#315d85', borderRadius: 6 }}
          onPress={() => setCount((value) => value + 1)}
        >
          <Text>Add one</Text>
        </Button>
        <Text announce style={{ fontSize: 24 }}>
          Count: {count}
        </Text>
        <Button
          id="open-dialog"
          label="Open dialog"
          style={{ padding: 10, background: '#315d85', borderRadius: 6 }}
          onPress={() => setDialog(true)}
        >
          <Text>Open dialog</Text>
        </Button>
      </View>
      <TextInput
        id="name"
        label="Your name"
        value={name}
        onValueChange={setName}
        style={{ width: '100%', height: 46, background: '#243247', borderRadius: 6 }}
      />
      <Text id="greeting" announce style={{ fontSize: 21 }}>
        Hello, {name}.
      </Text>
      <ScrollArea
        id="waypoints"
        label="Waypoints"
        style={{ flex: 1, minHeight: 80, background: '#192435', borderRadius: 8 }}
      >
        {Array.from({ length: 30 }, (_, i) => (
          <View key={i} style={{ height: 44, flexShrink: 0, padding: 10, borderWidth: 1, borderColor: '#26394e' }}>
            <Text style={{ fontSize: 19 }}>Waypoint {String(i + 1).padStart(2, '0')} — shared layout</Text>
          </View>
        ))}
      </ScrollArea>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        label="Shared dialog"
        style={{
          position: 'absolute',
          left: '8%',
          width: '84%',
          height: 250,
          top: 100,
          padding: 24,
          gap: 18,
          background: '#22354b',
          borderRadius: 12,
          borderColor: '#6ca7d9',
          borderWidth: 1,
        }}
      >
        <Text style={{ fontSize: 28 }}>Same component, native window.</Text>
        <Text style={{ fontSize: 18 }}>Keyboard focus stays in this dialog.</Text>
        <Button
          id="close-dialog"
          label="Close dialog"
          style={{ padding: 10, background: '#315d85', borderRadius: 6 }}
          onPress={() => setDialog(false)}
        >
          <Text>Close dialog</Text>
        </Button>
      </Dialog>
    </View>
  );
}
