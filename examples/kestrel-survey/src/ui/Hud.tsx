import { useSyncExternalStore, type ReactNode } from 'react';
import { View, Text, Line, type CommonProps, type TextStyleProp, type ViewStyle } from 'ludic-canvas';
import { sites, type SurveyGame, type SurveyState, type Dialog } from '../game.ts';

const c = {
  paper: '#f4efd9',
  muted: '#b2bdac',
  ink: '#172723ed',
  line: '#8c9d7a55',
  acid: '#d6e89a',
  amber: '#efa96a',
  black: '#17231e',
};
function T({ children, style }: { children: ReactNode; style?: TextStyleProp }) {
  return <Text style={{ fontFamily: 'display', fontSize: 15, color: c.paper, ...style }}>{children}</Text>;
}
function Mono({ children, style }: { children: ReactNode; style?: TextStyleProp }) {
  return (
    <Text style={{ fontFamily: 'telemetry', fontSize: 9, color: c.muted, letterSpacing: 0.015, ...style }}>
      {children}
    </Text>
  );
}
function Kicker({ children }: { children: ReactNode }) {
  return <Mono style={{ fontSize: 8, color: c.acid, letterSpacing: 0.13 }}>{children}</Mono>;
}
function Panel({ children, style, ...props }: CommonProps & { style?: ViewStyle }) {
  return (
    <View
      block
      {...props}
      style={{
        padding: 18,
        gap: 12,
        background: c.ink,
        borderColor: c.line,
        borderWidth: 1,
        borderRadius: 4,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
function Rule() {
  return <View style={{ height: 1, background: c.line, flexShrink: 0 }} />;
}
function Button({
  children,
  primary = false,
  style,
  ...props
}: CommonProps & { primary?: boolean; style?: ViewStyle }) {
  return (
    <View
      {...props}
      hoverStyle={{ background: primary ? '#e6f3b8' : '#3a5145' }}
      pressStyle={{ scale: 0.98 }}
      style={{
        minHeight: 40,
        paddingX: 12,
        paddingY: 9,
        justifyContent: 'center',
        alignItems: 'center',
        background: primary ? c.acid : '#304037',
        borderWidth: 1,
        borderColor: primary ? c.acid : c.line,
        borderRadius: 3,
        ...style,
      }}
    >
      <T style={{ fontSize: 13, color: primary ? c.black : c.paper, textAlign: 'center' }}>{children}</T>
    </View>
  );
}
function Meter({
  label,
  value,
  right,
  color = c.acid,
}: {
  label: string;
  value: number;
  right: string;
  color?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Mono>{label}</Mono>
        <Mono style={{ color: c.paper }}>{right}</Mono>
      </View>
      <View
        fill={value}
        fillColor={color}
        transition={120}
        style={{ height: 4, background: '#81917933', borderRadius: 2 }}
      />
    </View>
  );
}
const number = (n: number, width = 2) => String(Math.floor(n)).padStart(width, '0');
const time = (n: number) => `${number(n / 60)}:${number(n % 60)}`;

function SiteList({ game, state, dismiss = false }: { game: SurveyGame; state: SurveyState; dismiss?: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      {sites.map((site, index) => (
        <View
          key={site.name}
          label={`Select ${site.name}`}
          selected={index === state.selected}
          role="tab"
          onPress={() => {
            game.select(index);
            if (dismiss) game.dialog('none');
          }}
          hoverStyle={{ background: '#425644' }}
          style={{
            padding: 12,
            gap: 7,
            background: index === state.selected ? '#3b4f3b' : '#23342c',
            borderWidth: 1,
            borderColor: index === state.selected ? c.acid : c.line,
            borderRadius: 3,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T style={{ fontSize: 24, color: state.samples[index] ? c.acid : '#cbd1b5' }}>
              {state.samples[index] ? 'OK' : number(index + 1)}
            </T>
            <View style={{ flex: 1, gap: 3 }}>
              <T style={{ fontSize: 15 }}>{site.name}</T>
              <Mono style={{ fontSize: 7, color: site.color }}>
                {state.samples[index] ? 'SAMPLE SECURED' : site.material}
              </Mono>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Mono style={{ fontSize: 8 }}>
              {Math.hypot(state.x - site.x, state.z - site.z).toFixed(1)} m from rover
            </Mono>
            <Mono style={{ fontSize: 8, color: c.acid }}>{index === state.selected ? 'TRACKING' : 'SELECT >'}</Mono>
          </View>
        </View>
      ))}
    </View>
  );
}

function MiniMap({ state }: { state: SurveyState }) {
  const pos = (x: number, z: number): [number, number] => [15 + ((x + 25) / 50) * 164, 8 + ((z + 25) / 50) * 110];
  const rover = pos(state.x, state.z),
    target = pos(sites[state.selected]!.x, sites[state.selected]!.z);
  return (
    <View style={{ height: 126, width: 194, background: '#70806918', overflow: 'hidden' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Line key={`x${i}`} from={[15 + i * 41, 0]} to={[15 + i * 41, 126]} color="#a0b19420" width={1} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Line key={`y${i}`} from={[0, 8 + i * 36]} to={[194, 8 + i * 36]} color="#a0b19420" width={1} />
      ))}
      <Line from={rover} to={target} color="#d6e89a88" dash={4} width={1} />
      {sites.map((site, i) => {
        const p = pos(site.x, site.z);
        return (
          <View
            key={site.name}
            style={{
              position: 'absolute',
              left: p[0] - 4,
              top: p[1] - 4,
              width: 8,
              height: 8,
              borderRadius: 2,
              background: state.samples[i] ? c.acid : site.color,
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: rover[0] - 4,
          top: rover[1] - 4,
          width: 8,
          height: 8,
          borderWidth: 2,
          borderColor: c.paper,
          background: c.black,
          borderRadius: 4,
        }}
      />
      <Mono style={{ position: 'absolute', left: 7, top: 7, fontSize: 7, color: c.paper }}>N</Mono>
    </View>
  );
}
function RoverDiagram() {
  return (
    <View style={{ height: 95, width: 194 }}>
      <View
        style={{
          position: 'absolute',
          left: 56,
          top: 25,
          width: 82,
          height: 42,
          borderWidth: 1,
          borderColor: c.acid,
          background: '#d6e89a08',
          borderRadius: 5,
        }}
      />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: 65 + i * 25,
            top: 29,
            width: 16,
            height: 34,
            borderColor: '#d6e89a77',
            borderWidth: 1,
          }}
        />
      ))}
      {[0, 1, 2].flatMap((i) =>
        [0, 1].map((side) => (
          <View
            key={`${i}${side}`}
            style={{
              position: 'absolute',
              left: 62 + i * 27,
              top: side ? 69 : 10,
              width: 16,
              height: 12,
              borderWidth: 1,
              borderColor: c.acid,
              borderRadius: 3,
            }}
          />
        )),
      )}
      <Line from={[97, 25]} to={[97, 3]} color={c.acid} />
      <Line from={[138, 45]} to={[159, 45]} color={c.acid} />
      <Mono style={{ position: 'absolute', top: 82, left: 42, fontSize: 7 }}>KESTREL / SIX-WHEEL DRIVE</Mono>
    </View>
  );
}
function Zoom({ game, value, width = 190 }: { game: SurveyGame; value: number; width?: number }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Mono>CAMERA DISTANCE</Mono>
        <Mono style={{ color: c.paper }}>{(20 + value * 18).toFixed(0)} m</Mono>
      </View>
      <View
        id="camera-zoom"
        focusable
        role="slider"
        label="Camera distance"
        valueMin={20}
        valueMax={38}
        valueNow={Math.round(20 + value * 18)}
        onPointerDown={(event) => {
          event.preventDefault();
          game.zoom(event.localX / width);
        }}
        onPointerMove={(event) => {
          if (event.buttons) {
            event.preventDefault();
            game.zoom(event.localX / width);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            game.zoom(value + (event.key === 'ArrowRight' ? 0.05 : -0.05));
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            game.zoom(event.key === 'Home' ? 0 : 1);
          }
        }}
        style={{ width, height: 24, justifyContent: 'center' }}
      >
        <View fill={value} fillColor={c.acid} style={{ height: 3, background: '#7d8a6955' }} />
        <View
          style={{
            position: 'absolute',
            left: Math.max(0, (width - 12) * value),
            top: 6,
            width: 12,
            height: 12,
            background: c.paper,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

function Overlay({
  game,
  state,
  width,
  height,
}: {
  game: SurveyGame;
  state: SurveyState;
  width: number;
  height: number;
}) {
  const complete = state.complete,
    dialog = state.dialog;
  if (!complete && dialog === 'none') return null;
  const compact = width < 700,
    cardWidth = Math.min(440, width - 32),
    cardHeight = Math.min(height - 36, dialog === 'sites' ? 520 : dialog === 'settings' ? 490 : 440);
  const title = complete
    ? 'A world, documented.'
    : dialog === 'pause'
      ? 'Take a moment.'
      : dialog === 'settings'
        ? 'Make it yours.'
        : dialog === 'sites'
          ? 'Survey sites.'
          : dialog === 'samples'
            ? 'Field collection.'
            : 'Your field manual.';
  return (
    <View
      modal
      block
      zIndex={50}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        background: '#101c18b8',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Panel
        style={{
          width: cardWidth,
          maxHeight: cardHeight,
          padding: compact ? 20 : 28,
          gap: 15,
          overflow: 'scroll',
          borderColor: '#aebc8255',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker>{complete ? 'SURVEY COMPLETE' : 'KESTREL / FIELD SYSTEMS'}</Kicker>
          {!complete && (
            <Button
              label="Close panel"
              hotkey="Escape"
              onPress={() => game.dialog('none')}
              style={{ minHeight: 30, paddingY: 4, paddingX: 10 }}
            >
              Close
            </Button>
          )}
        </View>
        <T style={{ fontSize: compact ? 30 : 38, lineHeight: 1 }}>{title}</T>
        <Rule />
        {complete ? (
          <>
            <T style={{ fontSize: 16, color: c.muted }}>
              Three places. Three fragments of a larger story. Your samples are ready for the lab.
            </T>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View style={{ gap: 4 }}>
                <Kicker>FIELD TIME</Kicker>
                <T style={{ fontSize: 28 }}>{time(state.elapsed)}</T>
              </View>
              <View style={{ gap: 4 }}>
                <Kicker>DISTANCE</Kicker>
                <T style={{ fontSize: 28 }}>{state.distance.toFixed(0)} m</T>
              </View>
            </View>
            <Button primary label="Begin a new survey" onPress={game.reset}>
              Begin a new survey
            </Button>
          </>
        ) : dialog === 'sites' ? (
          <SiteList game={game} state={state} dismiss />
        ) : dialog === 'settings' ? (
          <>
            <T style={{ color: c.muted }}>The world is Three.js. Every control in this panel is Ludic Canvas.</T>
            <Zoom game={game} value={state.zoom} width={Math.min(300, cardWidth - 56)} />
            <Button
              label="Toggle low power rendering"
              role="switch"
              checked={state.lowPower}
              onPress={() => game.quality(!state.lowPower)}
            >
              {state.lowPower ? '[ON]' : '[OFF]'} Low power rendering
            </Button>
            <Button
              label="Toggle reduced motion"
              role="switch"
              checked={state.reducedMotion}
              onPress={() => game.motion(!state.reducedMotion)}
            >
              {state.reducedMotion ? '[ON]' : '[OFF]'} Reduced motion
            </Button>
            <Mono>Low power: 1x resolution, no shadows or dust.</Mono>
          </>
        ) : dialog === 'samples' ? (
          <View style={{ gap: 15 }}>
            {sites.map((site, i) => (
              <View key={site.name} style={{ gap: 5 }}>
                <Kicker>{state.samples[i] ? 'SECURED' : 'AWAITING COLLECTION'}</Kicker>
                <T style={{ fontSize: 20, color: state.samples[i] ? site.color : c.muted }}>{site.name}</T>
                <T style={{ fontSize: 13, color: c.muted }}>{site.description}</T>
              </View>
            ))}
          </View>
        ) : dialog === 'help' ? (
          <>
            <T style={{ color: c.muted, lineHeight: 1.15 }}>
              Select a site, then choose Navigate. Once the rover arrives, collect its sample. Visit all three sites to
              complete the survey.
            </T>
            <Mono>W A S D / Drive manually</Mono>
            <Mono>SHIFT / Boost while driving</Mono>
            <Mono>E / Collect a nearby sample</Mono>
            <Mono>1 2 3 / Select survey site</Mono>
            <Mono>ESC / Pause or close a panel</Mono>
            <Mono>GROUND / Tap to set a waypoint</Mono>
            <T style={{ fontSize: 13, color: c.muted }}>
              Camera orbit, overview and zoom are custom UI controls. On mobile, use site navigation and tap-to-drive.
            </T>
          </>
        ) : (
          <>
            <T style={{ color: c.muted }}>Your rover is holding position. The desert can wait.</T>
            <Button primary label="Resume survey" onPress={() => game.dialog('none')}>
              Resume survey
            </Button>
            <Button label="Restart survey" onPress={game.reset}>
              Restart survey
            </Button>
          </>
        )}
      </Panel>
    </View>
  );
}

export function SurveyHud({
  game,
  width,
  height,
  onGround,
}: {
  game: SurveyGame;
  width: number;
  height: number;
  onGround: (x: number, y: number) => void;
}) {
  const state = useSyncExternalStore(game.subscribe, game.getSnapshot),
    compact = width < 850 || height < 680,
    pad = compact ? 14 : 24;
  const site = sites[state.selected]!,
    range = Math.hypot(state.x - site.x, state.z - site.z),
    count = state.samples.filter(Boolean).length,
    secured = state.samples[state.selected];
  const action = secured
    ? 'Next survey site'
    : state.scanning
      ? 'Collecting sample...'
      : range <= 2.5
        ? 'Collect sample'
        : 'Navigate to site';
  const actionPress = () => {
    if (secured) {
      const index = state.samples.findIndex((sample) => !sample);
      if (index >= 0) game.select(index);
    } else if (range <= 2.5) game.scan();
    else game.navigate();
  };
  const show = (dialog: Dialog) => game.dialog(dialog);
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <View
        label="Set a surface waypoint"
        onPointerDown={(event) => {
          event.preventDefault();
          onGround(event.x, event.y);
        }}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      />
      {state.markers
        .filter((marker) => marker.visible && !state.samples[marker.index])
        .map((marker) => (
          <View
            key={marker.index}
            zIndex={1}
            label={`Track ${sites[marker.index]!.name}`}
            hotkey={String(marker.index + 1)}
            onPress={() => game.select(marker.index)}
            hoverStyle={{ background: '#344c3a' }}
            style={{
              position: 'absolute',
              left: Math.max(8, Math.min(width - 132, marker.x - 64)),
              top: Math.max(compact ? 100 : 95, Math.min(height - 190, marker.y - 38)),
              width: 128,
              padding: 9,
              gap: 3,
              background: marker.index === state.selected ? '#25382beb' : '#1a2922b0',
              borderColor: marker.index === state.selected ? c.acid : '#aeb99088',
              borderWidth: 1,
              borderRadius: 3,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
              <Mono style={{ color: sites[marker.index]!.color, fontSize: 10 }}>{number(marker.index + 1)}</Mono>
              <T style={{ fontSize: 12 }}>{sites[marker.index]!.name}</T>
            </View>
            <Mono style={{ fontSize: 7 }}>
              {Math.hypot(state.x - sites[marker.index]!.x, state.z - sites[marker.index]!.z).toFixed(1)} m /{' '}
              {marker.index === state.selected ? 'TRACKING' : 'SELECT'}
            </Mono>
            <Line from={[64, 42]} to={[64, 59]} color="#e7edce88" />
            <View
              style={{
                position: 'absolute',
                left: 61,
                top: 58,
                width: 6,
                height: 6,
                background: c.acid,
                borderRadius: 3,
              }}
            />
          </View>
        ))}
      <View
        block
        zIndex={5}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: compact ? 76 : 88,
          paddingX: pad,
          background: ['#15251ff5', '#15251fe0'],
          borderColor: c.line,
          borderWidth: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? 12 : 22,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.acid,
            borderRadius: 3,
          }}
        >
          <Line from={[9, 24]} to={[17, 9]} color={c.acid} width={2} />
          <Line from={[17, 9]} to={[26, 24]} color={c.acid} width={2} />
          <Line from={[13, 21]} to={[22, 21]} color={c.acid} width={1} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <T style={{ fontSize: compact ? 24 : 29, letterSpacing: 0.08 }}>KESTREL</T>
          <Mono style={{ fontSize: compact ? 6 : 8, letterSpacing: 0.12 }}>FIELD ROBOTICS / SURVEY 014</Mono>
        </View>
        {!compact && (
          <View style={{ flexDirection: 'row', gap: 32, marginRight: 20 }}>
            <View style={{ gap: 3 }}>
              <Kicker>EXPEDITION</Kicker>
              <T style={{ fontSize: 17 }}>The quiet frontier</T>
            </View>
            <View style={{ gap: 3 }}>
              <Kicker>SAMPLES</Kicker>
              <T style={{ fontSize: 20 }}>{number(count)} / 03</T>
            </View>
            <View style={{ gap: 3 }}>
              <Kicker>FIELD TIME</Kicker>
              <T style={{ fontSize: 20 }}>{time(state.elapsed)}</T>
            </View>
          </View>
        )}
        <Button
          label="Pause survey"
          hotkey="Escape"
          onPress={() => show('pause')}
          style={{ minHeight: 36, paddingX: compact ? 10 : 16 }}
        >
          Pause
        </Button>
      </View>
      {!compact ? (
        <>
          <Panel
            zIndex={5}
            style={{
              position: 'absolute',
              left: pad,
              top: 112,
              width: 246,
              gap: 12,
              padding: 16,
              maxHeight: height >= 680 ? height - 348 : height - 136,
              overflow: 'scroll',
            }}
          >
            <Kicker>01 / EXPEDITION BRIEF</Kicker>
            <T style={{ fontSize: 31, lineHeight: 0.95 }}>Read the{'\n'}unwritten.</T>
            <Rule />
            <SiteList game={game} state={state} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Mono>{count} OF 3 SECURED</Mono>
              <Mono style={{ color: c.acid }}>SURVEY ACTIVE</Mono>
            </View>
          </Panel>
          <Panel zIndex={5} style={{ position: 'absolute', right: pad, top: 112, width: 232, padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Kicker>ROVER TELEMETRY</Kicker>
              <Mono style={{ color: c.acid }}>ONLINE</Mono>
            </View>
            <RoverDiagram />
            <Rule />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T style={{ fontSize: 35 }}>{(state.speed * 3.6).toFixed(1)}</T>
              <Mono>KM / H</Mono>
            </View>
            <Meter label="POWER RESERVE" value={state.battery} right={`${Math.round(state.battery * 100)}%`} />
            <Meter label="SAMPLE STORAGE" value={count / 3} right={`${count} / 3`} color={c.amber} />
            <Rule />
            <Mono>
              X {state.x.toFixed(1)} / Z {state.z.toFixed(1)}
            </Mono>
          </Panel>
          {height >= 680 && (
            <Panel zIndex={5} style={{ position: 'absolute', left: pad, bottom: pad, width: 246, padding: 18, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Kicker>SURFACE MAP</Kicker>
                <Mono style={{ fontSize: 7 }}>50 m x 50 m</Mono>
              </View>
              <MiniMap state={state} />
              <Mono style={{ fontSize: 7 }}>KESTREL POSITION / SELECTED ROUTE</Mono>
            </Panel>
          )}
          <Panel zIndex={5} style={{ position: 'absolute', right: pad, bottom: pad, width: 232, padding: 18, gap: 10 }}>
            <Kicker>CAMERA / NAVIGATION</Kicker>
            <Zoom game={game} value={state.zoom} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button label="Orbit camera left" onPress={() => game.rotate(-Math.PI / 6)} style={{ flex: 1 }}>
                &lt;
              </Button>
              <Button
                label="Toggle overview camera"
                role="switch"
                checked={state.overview}
                onPress={game.overview}
                style={{ flex: 3 }}
              >
                {state.overview ? 'Follow' : 'Overview'}
              </Button>
              <Button label="Orbit camera right" onPress={() => game.rotate(Math.PI / 6)} style={{ flex: 1 }}>
                &gt;
              </Button>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button label="Open field collection" onPress={() => show('samples')} style={{ flex: 1 }}>
                Collection
              </Button>
              <Button label="Open survey settings" onPress={() => show('settings')} style={{ flex: 1 }}>
                Settings
              </Button>
            </View>
            <Button label="Open field manual" onPress={() => show('help')} style={{ minHeight: 28, paddingY: 4 }}>
              Field manual / controls
            </Button>
          </Panel>
        </>
      ) : (
        <View zIndex={5} style={{ position: 'absolute', left: pad, right: pad, top: 88, flexDirection: 'row', gap: 8 }}>
          <Panel style={{ flex: 1, padding: 11, gap: 5 }}>
            <Kicker>SELECTED SITE {number(state.selected + 1)}</Kicker>
            <T style={{ fontSize: 19 }}>{site.name}</T>
          </Panel>
          <Panel style={{ padding: 11, gap: 5, width: 93 }}>
            <Kicker>SAMPLES</Kicker>
            <T style={{ fontSize: 19 }}>{number(count)} / 03</T>
          </Panel>
        </View>
      )}
      <View
        zIndex={5}
        style={{
          position: 'absolute',
          left: compact ? pad : Math.max(285, width / 2 - 190),
          bottom: pad,
          width: compact ? width - pad * 2 : Math.max(230, Math.min(380, width - 574)),
          gap: 10,
        }}
      >
        {!compact && (
          <View pointerEvents="none" style={{ alignItems: 'center', gap: 6 }}>
            <Mono style={{ color: c.black, background: '#f2ebd3bb', padding: 6, fontSize: 8 }}>
              W A S D / DRIVE SHIFT / BOOST E / SAMPLE
            </Mono>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Line from={[0, 8]} to={[38, 8]} color="#253b2b88" />
              <Mono style={{ fontSize: 8, color: c.black }}>SURFACE LINK STABLE</Mono>
            </View>
          </View>
        )}
        <Panel style={{ padding: compact ? 13 : 17, gap: 8, background: '#172723f5' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Kicker>
              {state.scanning ? 'SAMPLING IN PROGRESS' : state.destination ? 'AUTOPILOT ACTIVE' : 'FIELD OPERATIONS'}
            </Kicker>
            <Mono style={{ fontSize: 8, color: site.color }}>{range.toFixed(1)} m</Mono>
          </View>
          <T style={{ fontSize: compact ? 13 : 14, color: c.muted, maxLines: 2, textOverflow: 'ellipsis' }}>
            {state.message}
          </T>
          {state.scanning && (
            <View
              fill={state.scan}
              fillColor={site.color}
              transition={80}
              style={{ height: 5, background: '#8d9b6d44' }}
            />
          )}
          <Button
            primary
            label={
              secured
                ? 'Select next survey site'
                : range <= 2.5
                  ? `Collect ${site.name} sample`
                  : `Navigate to ${site.name}`
            }
            hotkey={range <= 2.5 ? 'e' : undefined}
            disabled={state.scanning || state.complete}
            onPress={actionPress}
            style={{ minHeight: 44 }}
          >
            {action} {state.scanning ? `${Math.round(state.scan * 100)}%` : secured ? '>' : range <= 2.5 ? '[E]' : '>'}
          </Button>
        </Panel>
        {compact && (
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Button label="Open survey sites" onPress={() => show('sites')} style={{ flex: 1 }}>
              Sites
            </Button>
            <Button label="Toggle overview camera" onPress={game.overview} style={{ flex: 1 }}>
              {state.overview ? 'Follow' : 'View'}
            </Button>
            <Button label="Open survey settings" onPress={() => show('settings')} style={{ flex: 1 }}>
              Prefs
            </Button>
            <Button label="Open field manual" onPress={() => show('help')} style={{ width: 38, paddingX: 4 }}>
              ?
            </Button>
          </View>
        )}
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 3, background: c.acid }}
      />
      <Overlay game={game} state={state} width={width} height={height} />
    </View>
  );
}
