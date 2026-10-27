import { memo, useState } from 'react';
import { Button, createVirtualListHandle, Text, View, VirtualList } from 'ludic-canvas';

interface Palette {
  paper: string;
  muted: string;
  ink: string;
  line: string;
  acid: string;
  amber: string;
}
const materials = ['Basalt', 'Amber', 'Silica', 'Ironstone'] as const;
const records = Object.freeze(
  Array.from({ length: 4000 }, (_, id) =>
    Object.freeze({
      id,
      code: `KS-${String(id + 1).padStart(4, '0')}`,
      material: materials[id % materials.length]!,
      signal: (id * 73) % 100,
      grid: `${String.fromCharCode(65 + (id % 26))}${Math.floor(id / 26) + 1}`,
    }),
  ),
);
const itemKey = (record: (typeof records)[number]) => record.id;
const itemLabel = (record: (typeof records)[number]) => `Archive record ${record.code}: ${record.material}`;
const disabled = (record: (typeof records)[number]) => record.id % 37 === 36;

/** Application-owned data/selection. Ludic Canvas owns only the bounded option window. */
export const FieldArchive = memo(function FieldArchive({ compact, colors: c }: { compact: boolean; colors: Palette }) {
  const [handle] = useState(createVirtualListHandle);
  const [selected, setSelected] = useState(0);
  const record = records[selected]!;
  const display = { fontFamily: 'display', color: c.paper };
  const mono = { fontFamily: 'telemetry', fontSize: 9, color: c.muted };
  const action = {
    flex: 1,
    minHeight: 40,
    padding: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    background: '#304037',
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 3,
  };
  return (
    <View style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <Text style={mono}>4,000 regional references / select a specimen</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Focus first archive record"
          onPress={() => {
            void handle.focusIndex(0);
          }}
          style={action}
        >
          <Text style={{ ...display, fontSize: 13 }}>First record</Text>
        </Button>
        <Button
          label="Focus latest archive record"
          onPress={() => {
            void handle.focusIndex(records.length - 1);
          }}
          style={action}
        >
          <Text style={{ ...display, fontSize: 13 }}>Latest record</Text>
        </Button>
      </View>
      <View style={{ gap: 4, padding: 10, background: '#3b4f3b' }}>
        <Text announce style={{ ...display, fontSize: 18 }}>{`Selected ${record.code} / ${record.material}`}</Text>
        <Text style={mono}>{`GRID ${record.grid} / SIGNAL ${record.signal}%`}</Text>
      </View>
      <VirtualList
        label="Regional specimen archive"
        items={records}
        getItemKey={itemKey}
        getItemLabel={itemLabel}
        isItemDisabled={disabled}
        selectedKey={selected}
        onItemPress={(record) => setSelected(record.id)}
        handle={handle}
        itemHeight={compact ? 88 : 72}
        gap={6}
        overscan={2}
        contentPadding={4}
        style={{ flex: 1, minHeight: 0, background: '#10201b' }}
        rowStyle={(_record, _index, state) => ({
          padding: 10,
          justifyContent: 'center',
          gap: 6,
          background: state.selected ? '#3b4f3b' : '#23342c',
          borderWidth: 1,
          borderColor: state.selected ? c.acid : c.line,
          borderRadius: 3,
        })}
        rowHoverStyle={{ background: '#425644' }}
        rowPressStyle={{ scale: 0.99 }}
        renderItem={(record, _index, state) => (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Text style={{ ...display, fontSize: compact ? 18 : 20, width: 82 }}>{record.code}</Text>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ ...display, fontSize: 15 }}>{`${record.material} reference`}</Text>
                <Text style={mono}>{`GRID ${record.grid} / ${record.signal}%`}</Text>
              </View>
            </View>
            <Text style={{ ...mono, fontSize: 8, color: state.selected ? c.acid : c.muted }}>
              {state.disabled
                ? 'REFERENCE UNDER REVIEW'
                : state.selected
                  ? 'SELECTED / APPLICATION STATE'
                  : 'ENTER OR TAP TO INSPECT'}
            </Text>
          </>
        )}
      />
    </View>
  );
});
