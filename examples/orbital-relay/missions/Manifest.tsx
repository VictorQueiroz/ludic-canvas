import type { ReactNode } from 'react';
import { View, Text, type TextStyleProp } from 'ludic-canvas';
import { STOPS, type Snapshot } from '../game.ts';
import { colors, panel } from '../ui/theme.ts';

/** Font styles are explicit: View deliberately has no text-style cascade. */
export function Mono({
  children,
  style,
  announce = false,
}: {
  children: ReactNode;
  style?: TextStyleProp;
  announce?: boolean;
}) {
  return (
    <Text
      announce={announce}
      style={{ fontFamily: 'telemetry', fontSize: 10, lineHeight: 1.5, color: colors.muted, ...style }}
    >
      {children}
    </Text>
  );
}

export function Manifest({ snapshot, cargoTab = false }: { snapshot: Snapshot; cargoTab?: boolean }) {
  const aboard = snapshot.cargo.length,
    delivered = snapshot.delivered.length;
  return (
    <View style={{ ...panel, padding: 14, gap: 13 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Mono style={{ color: colors.mint }}>{cargoTab ? 'CARGO HOLD' : 'DELIVERY MANIFEST'}</Mono>
        <Mono>{`${String(delivered).padStart(2, '0')} / 03`}</Mono>
      </View>
      {STOPS.slice(0, 3).map((stop) => {
        const done = snapshot.delivered.includes(stop.id),
          carrying = snapshot.cargo.includes(stop.id);
        return (
          <View key={stop.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingY: 4 }}>
            <View
              style={{
                width: 28,
                height: 30,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: done ? colors.mint : stop.color,
                background: '#1d3040',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Mono style={{ color: done ? colors.mint : stop.color }}>{done ? 'OK' : `0${stop.id + 1}`}</Mono>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: 'display', fontSize: 15, color: colors.text }}>
                {cargoTab ? stop.cargo : stop.name}
              </Text>
              <Mono style={{ fontSize: 9, color: carrying ? colors.gold : colors.muted }}>
                {done ? 'DELIVERED' : carrying ? 'SECURED / ABOARD' : cargoTab ? 'AWAITING PICKUP' : stop.cargo}
              </Mono>
            </View>
          </View>
        );
      })}
      <View style={{ height: 1, background: colors.line }} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 7, borderRadius: 2, background: i < aboard ? colors.gold : '#2b3c48' }}
          />
        ))}
      </View>
      <Mono>{`${aboard}/3 pods aboard. ${delivered}/3 delivered.`}</Mono>
    </View>
  );
}
