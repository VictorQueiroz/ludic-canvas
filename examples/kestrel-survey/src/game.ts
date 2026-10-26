/** Application-owned simulation. No renderer, DOM, global store or wall clock. */
export const sites = [
  {
    name: 'Basalt Rise',
    material: 'VOLCANIC SILICATE',
    x: 4,
    z: -2,
    color: '#cad787',
    description: 'A green mineral seam exposed by the northern winds.',
  },
  {
    name: 'Amber Shelf',
    material: 'FERRIC SANDSTONE',
    x: -10,
    z: -9,
    color: '#efb878',
    description: 'Iron-rich deposits along the edge of an ancient basin.',
  },
  {
    name: 'Echo Spire',
    material: 'CRYSTALLINE QUARTZ',
    x: 12,
    z: -14,
    color: '#a7d8d1',
    description: 'A quiet outcrop carrying an unusually clear resonance.',
  },
] as const;
export type Dialog = 'none' | 'pause' | 'settings' | 'help' | 'sites' | 'samples';
export interface Marker {
  index: number;
  x: number;
  y: number;
  visible: boolean;
}
export interface SurveyState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  battery: number;
  elapsed: number;
  distance: number;
  selected: number;
  samples: boolean[];
  scan: number;
  scanning: boolean;
  destination?: { x: number; z: number };
  dialog: Dialog;
  complete: boolean;
  zoom: number;
  yaw: number;
  overview: boolean;
  lowPower: boolean;
  reducedMotion: boolean;
  message: string;
  markers: readonly Marker[];
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const terrainHeight = (x: number, z: number) =>
  Math.sin(x * 0.13) * 0.5 + Math.cos(z * 0.16) * 0.5 + Math.sin((x + z) * 0.09) * 0.35;
const initial = (): SurveyState => ({
  x: 0,
  z: 7,
  heading: 0,
  speed: 0,
  battery: 1,
  elapsed: 0,
  distance: 0,
  selected: 0,
  samples: [false, false, false],
  scan: 0,
  scanning: false,
  dialog: 'none',
  complete: false,
  zoom: 0.45,
  yaw: 0.6,
  overview: false,
  lowPower: false,
  reducedMotion: false,
  message: 'Choose a survey site. Navigate there, then collect a sample.',
  markers: [],
});
export function createSurvey() {
  let state = initial(),
    snapshot = { ...state, samples: [...state.samples] };
  let input = { x: 0, z: 0, boost: false };
  const subscribers = new Set<() => void>();
  const publish = (markers = state.markers) => {
    state.markers = markers;
    snapshot = { ...state, samples: [...state.samples] };
    for (const listener of subscribers) listener();
  };
  const selectedSite = () => sites[state.selected]!;
  const range = () => Math.hypot(state.x - selectedSite().x, state.z - selectedSite().z);
  const api = {
    read: () => state as Readonly<SurveyState>,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    publish,
    range,
    select(index: number) {
      if (!sites[index] || state.complete) return;
      state.selected = index;
      state.scanning = false;
      state.scan = 0;
      state.destination = undefined;
      state.message = `${selectedSite().name} selected. ${state.samples[index] ? 'Sample already secured.' : 'Set a course when ready.'}`;
      publish();
    },
    navigate() {
      if (state.dialog !== 'none' || state.complete || state.scanning) return;
      const site = selectedSite();
      state.destination = { x: site.x, z: site.z };
      state.message = `Autopilot engaged. Approaching ${site.name}.`;
      publish();
    },
    driveTo(x: number, z: number) {
      if (state.dialog !== 'none' || state.complete) return;
      state.scanning = false;
      state.scan = 0;
      state.destination = { x: clamp(x, -25, 25), z: clamp(z, -25, 25) };
      state.message = 'Waypoint set. Surface navigation active.';
      publish();
    },
    scan() {
      if (state.dialog !== 'none' || state.complete || state.scanning || state.samples[state.selected]) return;
      if (range() > 2.5) {
        state.message = 'Move within 2.5 m of the selected site to collect a sample.';
        publish();
        return;
      }
      state.destination = undefined;
      state.scanning = true;
      state.scan = 0;
      state.message = `Sampling ${selectedSite().material.toLowerCase()}...`;
      publish();
    },
    dialog(value: Dialog) {
      if (state.complete) return;
      state.dialog = value;
      input = { x: 0, z: 0, boost: false };
      state.speed = 0;
      publish();
    },
    setInput(x: number, z: number, boost = false) {
      input = { x, z, boost };
    },
    zoom(value: number) {
      state.zoom = clamp(value, 0, 1);
      publish();
    },
    rotate(delta: number) {
      state.yaw += delta;
      publish();
    },
    overview() {
      state.overview = !state.overview;
      publish();
    },
    quality(lowPower: boolean) {
      state.lowPower = lowPower;
      publish();
    },
    motion(reducedMotion: boolean) {
      state.reducedMotion = reducedMotion;
      publish();
    },
    reset() {
      const settings = { zoom: state.zoom, lowPower: state.lowPower, reducedMotion: state.reducedMotion };
      state = { ...initial(), ...settings };
      input = { x: 0, z: 0, boost: false };
      publish();
    },
    tick(delta: number) {
      if (!Number.isFinite(delta) || delta <= 0 || state.dialog !== 'none' || state.complete) return;
      const dt = Math.min(delta, 0.05);
      state.elapsed += dt;
      let dx = input.x,
        dz = input.z;
      const manual = Math.hypot(dx, dz) > 0.01;
      if (manual) {
        state.destination = undefined;
        state.scanning = false;
        state.scan = 0;
      } else if (state.destination) {
        dx = state.destination.x - state.x;
        dz = state.destination.z - state.z;
        if (Math.hypot(dx, dz) < 0.3) {
          state.destination = undefined;
          dx = dz = 0;
          state.message = range() <= 2.5 ? 'Survey site reached. Collect the sample to continue.' : 'Waypoint reached.';
        }
      }
      const length = Math.hypot(dx, dz);
      state.speed = 0;
      if (length > 0.01) {
        const boost = input.boost && state.battery > 0.08;
        const step = Math.min(length, (boost ? 8 : 5) * dt);
        const oldX = state.x,
          oldZ = state.z;
        state.x = clamp(state.x + (dx / length) * step, -25, 25);
        state.z = clamp(state.z + (dz / length) * step, -25, 25);
        const travelled = Math.hypot(state.x - oldX, state.z - oldZ);
        state.distance += travelled;
        state.speed = travelled / dt;
        state.heading = Math.atan2(dx, dz);
        state.battery = clamp(state.battery - (boost ? 0.045 : 0.006) * dt, 0, 1);
      } else state.battery = clamp(state.battery + 0.035 * dt, 0, 1);
      if (state.scanning) {
        if (range() > 2.5) {
          state.scanning = false;
          state.scan = 0;
        } else {
          state.scan = Math.min(1, state.scan + dt / 1.6);
          if (state.scan >= 1) {
            state.scanning = false;
            state.samples[state.selected] = true;
            state.complete = state.samples.every(Boolean);
            state.message = state.complete
              ? 'All three samples secured. Survey complete.'
              : `${selectedSite().name} sample secured. Choose the next site.`;
            publish();
          }
        }
      }
    },
  };
  return api;
}
export type SurveyGame = ReturnType<typeof createSurvey>;

/** Catch up a slow foreground frame without changing the simulation step size. */
export function advanceSurvey(game: SurveyGame, delta: number) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  let remaining = Math.min(delta, 0.25);
  while (remaining > 0.000001) {
    const step = Math.min(remaining, 0.05);
    game.tick(step);
    remaining -= step;
  }
}
