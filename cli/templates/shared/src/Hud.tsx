import { useSyncExternalStore } from 'react';
import { Button, Slider, Text, View } from 'ludic-canvas';
import type { Game } from './game.ts';

export function Hud({ game, width }: { game: Game; width: number }) {
  const snapshot = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const compact = width < 540;
  const button = {
    paddingX: 18,
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 6,
    background: '#b4ecd5',
  };
  return (
    <View style={{ width: '100%', height: '100%', padding: compact ? 16 : 28, justifyContent: 'space-between' }}>
      <View
        block
        style={{ padding: 20, gap: 10, width: '100%', maxWidth: 330, background: '#112b32ee', borderRadius: 10 }}
      >
        <Text style={{ fontSize: 25, color: '#e9f5ef' }}>Your world. Your interface.</Text>
        <Text style={{ fontSize: 16, color: '#b9cfc5' }}>
          The game owns the simulation. Ludic Canvas owns this HUD.
        </Text>
        <Text style={{ fontSize: 18, color: '#b4ecd5' }}>{`Time ${snapshot.elapsed.toFixed(1)} s`}</Text>
      </View>
      <View
        block
        style={{ padding: 20, gap: 14, width: '100%', maxWidth: 330, background: '#112b32ee', borderRadius: 10 }}
      >
        <Text style={{ fontSize: 17, color: '#e9f5ef' }}>{`Simulation speed / ${snapshot.speed.toFixed(1)}x`}</Text>
        <Slider
          label="Simulation speed"
          value={snapshot.speed}
          min={0.2}
          max={2}
          step={0.1}
          onValueChange={game.setSpeed}
          style={{ height: 44, justifyContent: 'center' }}
        >
          {({ ratio }) => (
            <>
              <View fill={ratio} fillColor="#b4ecd5" style={{ height: 4, background: '#466354' }} />
              <View
                style={{
                  position: 'absolute',
                  left: `${ratio * 100}%`,
                  marginLeft: -6,
                  top: 16,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: '#e9f5ef',
                }}
              />
            </>
          )}
        </Slider>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label={snapshot.paused ? 'Resume world' : 'Pause world'}
            onPress={game.togglePause}
            style={{ ...button, flex: 1 }}
          >
            <Text style={{ fontSize: 17, color: '#112b32', textAlign: 'center' }}>
              {snapshot.paused ? 'Resume' : 'Pause'}
            </Text>
          </Button>
          <Button label="Reset world" onPress={game.reset} style={{ ...button, flex: 1 }}>
            <Text style={{ fontSize: 17, color: '#112b32', textAlign: 'center' }}>Reset</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
