import { useState, useSyncExternalStore } from 'react';
import { View, Text, Image, Line } from 'ludic-canvas';
import { STOPS, WORLD, type Game, type Snapshot } from '../game.ts';
import { gameLayout } from '../layout.ts';
import { Manifest, Mono } from '../missions/Manifest.tsx';
import { Button } from './Button.tsx';
import { colors, panel } from './theme.ts';

function Title({ children, size = 20 }: { children: string; size?: number }) {
  return <Text style={{ fontFamily: 'display', fontSize: size, color: colors.text }}>{children}</Text>;
}

function Overlay({ snapshot, game, compact }: { snapshot: Snapshot; game: Game; compact: boolean }) {
  const ready = snapshot.status === 'ready',
    paused = snapshot.status === 'paused',
    won = snapshot.status === 'won';
  return (
    <View
      block
      zIndex={20}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        background: '#06101bdf',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}
    >
      <View
        style={{ ...panel, padding: compact ? 20 : 28, width: '100%', maxWidth: 410, gap: compact ? 13 : 17 }}
        enter={{ opacity: 0, translateY: 12, duration: 220 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Image src="courier" style={{ width: 44, height: 44, fit: 'contain' }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Mono style={{ color: colors.mint }}>
              {paused
                ? 'FLIGHT SUSPENDED'
                : won
                  ? 'CONTRACT COMPLETE'
                  : ready
                    ? 'A LUDIC CANVAS MINI GAME'
                    : 'CONTRACT ENDED'}
            </Mono>
            <Title size={compact ? 29 : 34}>
              {paused ? 'Take a breather.' : won ? 'Special delivery.' : ready ? 'Orbital Relay' : 'One more flight?'}
            </Title>
          </View>
        </View>
        <Text style={{ fontFamily: 'display', fontSize: 16, color: '#c8d5dc', lineHeight: 1.5 }}>
          {ready
            ? 'Three cargo pods. One debris belt. Get the supplies home before the delivery window closes.'
            : paused
              ? 'Your ship and the delivery clock are paused. Your cargo is safe.'
              : snapshot.message}
        </Text>
        {ready ? (
          <View style={{ gap: 9, background: '#1a2a37', padding: 13, borderRadius: 7 }}>
            <Mono>01 / Select a beacon to fly there.</Mono>
            <Mono>02 / Use boost to cross drifting debris.</Mono>
            <Mono>03 / Return to Relay with all 3 pods.</Mono>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingY: 7 }}>
            <Mono style={{ color: colors.gold }}>{`${snapshot.delivered.length}/3 DELIVERED`}</Mono>
            <Mono>{`${Math.ceil(snapshot.hull)}% HULL`}</Mono>
            <Mono>{`${Math.ceil(snapshot.remaining)}s LEFT`}</Mono>
          </View>
        )}
        <Button
          primary
          hotkey="Enter"
        label={paused ? 'Resume flight' : ready ? 'Launch courier' : 'Fly again'}
          onPress={paused ? game.pause : game.start}
        >
          {paused ? 'Resume flight' : ready ? 'Launch courier   [Enter]' : 'Fly again   [Enter]'}
        </Button>
        {paused && (
          <Button label="Restart flight" onPress={game.start}>
            Restart flight
          </Button>
        )}
        <Mono style={{ fontSize: 9, textAlign: 'center' }}>CLICK / TAP TO PLAY | 1-4 COURSE B BOOST ESC PAUSE</Mono>
      </View>
    </View>
  );
}

export function Hud({ game, width, height }: { game: Game; width: number; height: number }) {
  const snapshot = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [cargoTab, setCargoTab] = useState(false);
  const [manifestOpen, setManifestOpen] = useState(false);
  const { compact, padding, arena } = gameLayout(width, height);
  const playing = snapshot.status === 'playing';
  const totalSeconds = Math.ceil(snapshot.remaining),
    minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60;
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <View style={{ position: 'absolute', top: padding, left: padding, right: padding, gap: compact ? 10 : 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
            <Image src="courier" style={{ width: 29, height: 29, fit: 'contain' }} />
            <View style={{ gap: 2, flex: 1 }}>
              <Title size={compact ? 20 : 24}>ORBITAL RELAY</Title>
              <Mono style={{ fontSize: 8, letterSpacing: 0.08 }}>COURIER 07 / THE OUTER BELT</Mono>
            </View>
          </View>
          <Button
            label="Pause flight"
            hotkey="Escape"
            onPress={game.pause}
            disabled={!playing}
            style={{ minHeight: 36, paddingY: 7, paddingX: 12 }}
          >
            Pause
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: compact ? 12 : 24, alignItems: 'center', paddingX: compact ? 0 : 4 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Mono style={{ fontSize: 9 }}>HULL INTEGRITY</Mono>
              <Mono
                style={{ fontSize: 9, color: snapshot.hull < 30 ? '#ff9990' : colors.mint }}
              >{`${Math.ceil(snapshot.hull)}%`}</Mono>
            </View>
            <View
              fill={snapshot.hull / 100}
              fillColor={snapshot.hull < 30 ? '#ff9990' : colors.mint}
              transition={180}
              style={{ height: 4, background: '#263e4b', borderRadius: 2 }}
            />
          </View>
          <View style={{ gap: 3 }}>
            <Mono style={{ fontSize: 8 }}>DELIVERED</Mono>
            <Title size={17}>{`0${snapshot.delivered.length} / 03`}</Title>
          </View>
          <View style={{ gap: 3 }}>
            <Mono style={{ fontSize: 8 }}>WINDOW</Mono>
            <Mono
              style={{ fontSize: 17, color: snapshot.remaining < 30 ? '#ff9990' : colors.gold }}
            >{`${minutes}:${String(seconds).padStart(2, '0')}`}</Mono>
          </View>
        </View>
      </View>
      {!compact && (
        <View
          style={{
            position: 'absolute',
            left: padding,
            top: arena.y,
            width: 248,
            height: arena.height,
            overflow: 'scroll',
            gap: 13,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Button
              label="Show manifest"
              disabled={!playing}
              onPress={() => setCargoTab(false)}
              primary={!cargoTab}
              style={{ flex: 1, paddingX: 8, minHeight: 35, paddingY: 7 }}
            >
              Manifest
            </Button>
            <Button
              label="Show cargo hold"
              disabled={!playing}
              onPress={() => setCargoTab(true)}
              primary={cargoTab}
              style={{ flex: 1, paddingX: 8, minHeight: 35, paddingY: 7 }}
            >
              Cargo hold
            </Button>
          </View>
          <Manifest snapshot={snapshot} cargoTab={cargoTab} />
          <View style={{ ...panel, padding: 14, gap: 9 }}>
            <Mono style={{ color: colors.gold }}>FLIGHT NOTES</Mono>
            <Text style={{ fontFamily: 'display', fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
              Cargo loads automatically on arrival. Return to Relay to deliver and repair your hull.
            </Text>
            <Mono style={{ fontSize: 9 }}>1-4 / CHART COURSE</Mono>
            <Mono style={{ fontSize: 9 }}>B / BOOST ESC / PAUSE</Mono>
          </View>
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: arena.x,
          top: arena.y,
          width: arena.width,
          height: arena.height,
          borderWidth: 1,
          borderColor: '#3b535e',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 13,
            left: 13,
            right: 13,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Mono style={{ fontSize: compact ? 8 : 10 }}>SECTOR 04 / DEBRIS BELT</Mono>
          <Mono style={{ fontSize: 8, color: colors.mint }}>LINK ONLINE</Mono>
        </View>
        {STOPS.map((stop) => {
          const secured = snapshot.cargo.includes(stop.id) || snapshot.delivered.includes(stop.id);
          return (
            <View
              key={stop.id}
              style={{
                position: 'absolute',
                left: `${(stop.x / WORLD.width) * 100}%`,
                top: `${(stop.y / WORLD.height) * 100}%`,
                width: compact ? 70 : 90,
                marginLeft: compact ? -35 : -45,
                marginTop: -20,
                gap: 5,
                alignItems: 'center',
              }}
            >
              <View
                label={`Chart course to ${stop.name}`}
                onPress={() => game.navigate(stop.id)}
                hotkey={String(stop.id + 1)}
                disabled={!playing || secured}
                hoverStyle={{ background: '#314858', borderColor: '#ffffff' }}
                transition={160}
                style={{
                  width: 42,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: snapshot.target === stop.id ? '#ffffff' : stop.color,
                  background: '#102330e8',
                  opacity: secured ? 0.5 : 1,
                }}
              >
                <Text style={{ fontFamily: 'display', fontSize: 17, color: stop.color }}>
                  {stop.id === 3 ? 'R' : secured ? 'OK' : `0${stop.id + 1}`}
                </Text>
              </View>
              <Mono
                style={{ fontSize: 9, color: stop.color, background: '#0a1722d9', paddingX: 4, textAlign: 'center' }}
              >
                {stop.name.toUpperCase()}
              </Mono>
            </View>
          );
        })}
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 13, right: 13 }}>
          <Line from={[0, 0]} to={[1, 0]} relative color="#42606b" dash={6} speed={4} width={1} />
          <Mono style={{ fontSize: 8, marginTop: 8 }}>
            {snapshot.target === null
              ? 'SELECT A BEACON TO CHART YOUR COURSE'
              : `AUTOPILOT > ${STOPS[snapshot.target]!.name.toUpperCase()}`}
          </Mono>
        </View>
      </View>
      <View style={{ position: 'absolute', bottom: padding, left: padding, right: padding, gap: compact ? 8 : 10 }}>
        <Mono announce style={{ fontSize: compact ? 9 : 10, color: colors.gold, maxLines: compact ? 2 : 1 }}>
          {snapshot.message}
        </Mono>
        <View style={{ flexDirection: 'row', gap: compact ? 5 : 8 }}>
          {STOPS.map((stop) => (
            <Button
              key={stop.id}
              label={`Navigate to ${stop.name}`}
              onPress={() => game.navigate(stop.id)}
              disabled={!playing || snapshot.cargo.includes(stop.id) || snapshot.delivered.includes(stop.id)}
              style={{
                flex: 1,
                paddingX: 3,
                minHeight: compact ? 38 : 42,
                borderColor: snapshot.target === stop.id ? stop.color : colors.line,
              }}
            >{`${stop.id + 1} ${stop.name}`}</Button>
          ))}
          {!compact && (
            <Button
              primary
              label="Boost engines"
              hotkey="b"
              onPress={game.boost}
              disabled={!playing || snapshot.target === null || snapshot.cooling > 0}
              style={{ width: 155 }}
            >
              {snapshot.cooling > 0 ? `Cooling ${Math.ceil(snapshot.cooling)}s` : 'Boost engines [B]'}
            </Button>
          )}
        </View>
        {compact && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="Open cargo manifest"
              disabled={!playing}
              onPress={() => {
                game.pause();
                setManifestOpen(true);
              }}
              style={{ flex: 1, minHeight: 36, paddingY: 7 }}
            >
              Cargo {snapshot.cargo.length}/3
            </Button>
            <Button
              primary
              label="Boost engines"
              hotkey="b"
              onPress={game.boost}
              disabled={!playing || snapshot.target === null || snapshot.cooling > 0}
              style={{ flex: 1, minHeight: 36, paddingY: 7 }}
            >
              {snapshot.cooling > 0 ? `Cooling ${Math.ceil(snapshot.cooling)}s` : 'Boost engines'}
            </Button>
          </View>
        )}
      </View>
      {manifestOpen && snapshot.status === 'paused' ? (
        <View
          block
          zIndex={20}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            background: '#06101bef',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 22,
          }}
        >
          <View style={{ width: '100%', maxWidth: 360, gap: 14 }}>
            <Manifest snapshot={snapshot} cargoTab />
            <Button
              primary
              hotkey="Enter"
              label="Close manifest and resume"
              onPress={() => {
                setManifestOpen(false);
                game.pause();
              }}
            >
              Close manifest / Resume
            </Button>
          </View>
        </View>
      ) : (
        snapshot.status !== 'playing' && <Overlay snapshot={snapshot} game={game} compact={compact} />
      )}
    </View>
  );
}
