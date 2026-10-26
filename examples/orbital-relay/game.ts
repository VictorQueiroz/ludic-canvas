/** Application-owned simulation. This module has no React, DOM or renderer dependency. */
export const WORLD = { width: 1000, height: 640 };
export const STOPS = [
  { id: 0, name: 'Helix', cargo: 'Medical supplies', x: 270, y: 170, color: '#8edbc3' },
  { id: 1, name: 'Vesper', cargo: 'Navigation core', x: 760, y: 150, color: '#f4c77e' },
  { id: 2, name: 'Echo', cargo: 'Research samples', x: 740, y: 490, color: '#afa5ef' },
  { id: 3, name: 'Relay', cargo: 'Delivery station', x: 210, y: 460, color: '#9ecbfa' },
] as const;
export type Status = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export interface Snapshot {
  status: Status;
  hull: number;
  remaining: number;
  cargo: readonly number[];
  delivered: readonly number[];
  target: number | null;
  boost: number;
  cooling: number;
  message: string;
}
export interface Rock {
  x: number;
  y: number;
  radius: number;
  phase: number;
}
export interface Flight {
  x: number;
  y: number;
  angle: number;
  elapsed: number;
  hit: number;
}

export function debrisAt(time: number): Rock[] {
  return Array.from({ length: 9 }, (_, i) => ({
    x: 420 + Math.sin(time * (0.19 + i * 0.013) + i * 2.4) * (140 + (i % 3) * 42),
    y: 90 + ((i * 69 + time * (9 + (i % 3) * 4)) % 470),
    radius: 14 + (i % 3) * 5,
    phase: i * 1.8,
  }));
}

export function createGame() {
  const listeners = new Set<() => void>();
  let state: Snapshot;
  let snapshot: Snapshot;
  let flight: Flight;
  let broadcast = 0;
  const publish = () => {
    snapshot = { ...state };
    for (const listener of listeners) listener();
  };
  function reset(start = false) {
    state = {
      status: start ? 'playing' : 'ready',
      hull: 100,
      remaining: 120,
      cargo: [],
      delivered: [],
      target: null,
      boost: 0,
      cooling: 0,
      message: 'Chart a course to a cargo beacon.',
    };
    flight = { x: STOPS[3].x, y: STOPS[3].y, angle: -0.8, elapsed: 0, hit: 0 };
    broadcast = 0;
    publish();
  }
  function navigate(id: number) {
    if (state.status !== 'playing' || !STOPS[id]) return;
    if (state.cargo.includes(id) || state.delivered.includes(id)) {
      state.message = 'Cargo secured. Choose another beacon or return to Relay.';
    } else {
      state.target = id;
      state.message = id === 3 ? 'Returning to Relay. Cargo unloads on arrival.' : `Course set: ${STOPS[id]!.name}.`;
    }
    publish();
  }
  function pause() {
    if (state.status !== 'playing' && state.status !== 'paused') return;
    state.status = state.status === 'playing' ? 'paused' : 'playing';
    publish();
  }
  function boost() {
    if (state.status !== 'playing' || state.cooling > 0 || state.target === null) return;
    state.boost = 2.5;
    state.cooling = 8;
    state.message = 'Burn engaged. Faster flight, less time in the debris field.';
    publish();
  }
  function tick(delta: number) {
    if (state.status !== 'playing' || !Number.isFinite(delta) || delta <= 0) return;
    // Clamp long browser stalls: a background tab cannot consume a whole run.
    const dt = Math.min(delta, 0.05);
    flight.elapsed += dt;
    flight.hit = Math.max(0, flight.hit - dt);
    state.remaining = Math.max(0, state.remaining - dt);
    state.cooling = Math.max(0, state.cooling - dt);
    state.boost = Math.max(0, state.boost - dt);
    if (state.target !== null) {
      const stop = STOPS[state.target]!;
      const dx = stop.x - flight.x,
        dy = stop.y - flight.y,
        distance = Math.hypot(dx, dy);
      const step = (state.boost > 0 ? 190 : 95) * dt;
      flight.angle = Math.atan2(dy, dx);
      if (distance <= Math.max(step, 12)) {
        flight.x = stop.x;
        flight.y = stop.y;
        if (stop.id === 3) {
          const count = state.cargo.length;
          state.delivered = [...state.delivered, ...state.cargo];
          state.cargo = [];
          state.hull = Math.min(100, state.hull + 20);
          state.message = count
            ? `${count} pod${count === 1 ? '' : 's'} delivered. Hull serviced +20.`
            : 'Docked at Relay. Hull serviced +20.';
          if (state.delivered.length === 3) {
            state.status = 'won';
            state.message = 'All three deliveries complete. The relay is back online.';
          }
        } else {
          state.cargo = [...state.cargo, stop.id];
          state.message = `${stop.cargo} secured. ${state.cargo.length}/3 pods aboard.`;
        }
        state.target = null;
        publish();
      } else {
        flight.x += (dx / distance) * step;
        flight.y += (dy / distance) * step;
      }
    }
    if (
      flight.hit <= 0 &&
      debrisAt(flight.elapsed).some((rock) => Math.hypot(rock.x - flight.x, rock.y - flight.y) < rock.radius + 10)
    ) {
      state.hull = Math.max(0, state.hull - 14);
      flight.hit = 1.4;
      state.message = 'Debris impact. Hull -14. Dock at Relay for repairs.';
      publish();
    }
    if (state.status === 'playing' && (state.hull <= 0 || state.remaining <= 0)) {
      state.status = 'lost';
      state.message =
        state.hull <= 0
          ? 'Hull integrity lost. Plot a different route and try again.'
          : 'The delivery window closed. Use boost to save time.';
      publish();
    }
    broadcast += dt;
    if (broadcast >= 0.1) {
      broadcast = 0;
      publish();
    }
  }
  reset();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getFlight: () => flight,
    navigate,
    pause,
    boost,
    tick,
    start: () => reset(true),
  };
}
export type Game = ReturnType<typeof createGame>;
