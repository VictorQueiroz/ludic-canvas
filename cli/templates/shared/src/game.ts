export interface Snapshot {
  paused: boolean;
  speed: number;
  elapsed: number;
}

/** The simulation belongs to the game. React reads snapshots, never advances it. */
export function createGame() {
  let elapsed = 0,
    publishedAt = -Infinity;
  let snapshot: Snapshot = { paused: false, speed: 1, elapsed: 0 };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot> = {}) => {
    snapshot = { ...snapshot, ...patch, elapsed };
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    togglePause: () => publish({ paused: !snapshot.paused }),
    setSpeed: (speed: number) => publish({ speed }),
    reset() {
      elapsed = 0;
      publish({ paused: false });
    },
    advance(now: number, deltaSeconds: number) {
      if (!snapshot.paused) elapsed += deltaSeconds * snapshot.speed;
      if (now - publishedAt >= 100) {
        publishedAt = now;
        publish();
      }
      return elapsed;
    },
  };
}

export type Game = ReturnType<typeof createGame>;
